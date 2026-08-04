// ---------------------------------------------------------------------------
// Data access layer
//
// Today all content is served from src/content/site.ts (static, versioned in
// git — fast and free on Vercel). When you are ready to serve content from a
// database, change ONLY this file:
//
//   Option A — Postgres (recommended on Vercel: Neon / Supabase / Vercel
//   Postgres). Import the WordPress export using scripts in MIGRATION.md,
//   then query here with `@vercel/postgres` or `postgres`.
//
//   Option B — your existing cPanel MySQL. Enable "Remote MySQL" in cPanel
//   for Vercel's egress IPs, set DATABASE_URL in Vercel env vars, and query
//   with `mysql2`. Works, but keeps the old server in the serving path.
//
// Every page component consumes these functions, so swapping the backend
// never touches the UI.
// ---------------------------------------------------------------------------

import {
  site,
  hero,
  quickLinks,
  stats,
  about,
  leadership,
  faculty,
  programs,
  admissions,
  tuition,
  campusLife,
  events,
  news,
  contact,
  cta,
  type Program,
  type EventItem,
  type NewsItem,
  type FacultyMember,
} from '@/content/site';

export async function getSite() {
  return site;
}

export async function getHomePage() {
  return { hero, quickLinks, stats, about, events, news, cta };
}

export async function getPrograms(): Promise<Program[]> {
  return programs;
}

export async function getProgram(slug: string): Promise<Program | undefined> {
  return programs.find((p) => p.slug === slug);
}

export async function getFaculty(): Promise<{ leadership: FacultyMember[]; faculty: FacultyMember[] }> {
  return { leadership, faculty };
}

export async function getEvents(): Promise<EventItem[]> {
  return [...events].sort((a, b) => a.date.localeCompare(b.date));
}

export async function getNews(): Promise<NewsItem[]> {
  return news;
}

export async function getAbout() {
  return about;
}

export async function getAdmissions() {
  return admissions;
}

export async function getTuition() {
  return tuition;
}

export async function getCampusLife() {
  return campusLife;
}

export async function getContact() {
  return contact;
}

export async function getCta() {
  return cta;
}
