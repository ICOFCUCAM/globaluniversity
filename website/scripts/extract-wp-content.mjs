#!/usr/bin/env node
/**
 * Extract readable page/post content from a WordPress export so it can be
 * copied into src/content/site.ts.
 *
 * Accepts either:
 *   - a WordPress WXR XML export  (wp-admin → Tools → Export → All content)
 *   - a phpMyAdmin SQL dump       (looks for INSERT INTO `wpst_posts` rows)
 *
 * Usage:
 *   node scripts/extract-wp-content.mjs path/to/export.xml
 *   node scripts/extract-wp-content.mjs path/to/dump.sql
 *
 * Output: one .txt file per published page/post in ./content-export/
 */

import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, basename } from 'node:path';

const SPAM_WORDS = /casino|pinco|pin-?up|slot|betting|kazino|1win|aviator/i;

const file = process.argv[2];
if (!file) {
  console.error('Usage: node scripts/extract-wp-content.mjs <export.xml | dump.sql>');
  process.exit(1);
}

const raw = readFileSync(file, 'utf8');
const outDir = join(process.cwd(), 'content-export');
mkdirSync(outDir, { recursive: true });

/** Strip Elementor/Gutenberg markup down to readable text. */
function toText(html) {
  return html
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/\[\/?[a-z_]+[^\]]*\]/gi, ' ') // shortcodes
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<br\s*\/?>(\s*)/gi, '\n')
    .replace(/<\/(p|div|h[1-6]|li|section)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#8217;|&rsquo;/g, "'")
    .replace(/&#8220;|&#8221;|&ldquo;|&rdquo;/g, '"')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function save(title, type, status, content) {
  if (status && status !== 'publish') return;
  const text = toText(content);
  if (text.length < 40) return;
  const spam = SPAM_WORDS.test(title) ? 'SPAM-' : '';
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 60) || 'untitled';
  const name = `${spam}${type || 'page'}-${slug}.txt`;
  writeFileSync(join(outDir, name), `TITLE: ${title}\nTYPE: ${type}\n\n${text}\n`);
  count++;
  if (spam) spamCount++;
}

let count = 0;
let spamCount = 0;

if (/<rss|<channel>/i.test(raw)) {
  // --- WXR XML export ---
  const items = raw.split(/<item>/).slice(1);
  for (const item of items) {
    const get = (tag) => {
      const m = item.match(new RegExp(`<${tag}>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${tag}>`));
      return m ? m[1] : '';
    };
    save(get('title'), get('wp:post_type'), get('wp:status'), get('content:encoded'));
  }
} else if (/INSERT INTO/i.test(raw)) {
  // --- SQL dump: pull rows out of the posts table (any prefix) ---
  const inserts = raw.match(/INSERT INTO `?\w*posts`?[^;]+;/gi) || [];
  for (const stmt of inserts) {
    // Row format follows wp_posts column order; grab title (5th), content (4th),
    // status and type by position after splitting on top-level tuples.
    const tuples = stmt.match(/\(((?:[^()']|'(?:[^'\\]|\\.)*')*)\)/g) || [];
    for (const tuple of tuples) {
      const fields = tuple
        .slice(1, -1)
        .match(/'(?:[^'\\]|\\.)*'|[^,]+/g)
        ?.map((f) => f.trim().replace(/^'|'$/g, '').replace(/\\'/g, "'").replace(/\\n/g, '\n'));
      if (!fields || fields.length < 21) continue;
      const [content, title, status, type] = [fields[4], fields[5], fields[7], fields[20]];
      save(title, type, status, content);
    }
  }
} else {
  console.error('Unrecognized file: expected a WordPress XML export or SQL dump.');
  process.exit(1);
}

console.log(`Extracted ${count} published items to ${outDir}/`);
if (spamCount) {
  console.log(`⚠️  ${spamCount} items look like injected spam (filenames prefixed SPAM-) — review and discard.`);
}
