// ---------------------------------------------------------------------------
// The database client.
//
// The URL and the publishable key were hardcoded here, which meant pointing the
// university at a different project required a code change and a redeploy — and
// it meant the key sat in the repository. Both now come from the environment,
// with the previous values kept as a fallback so nothing breaks before the
// variables are set.
//
// WHICH KEY GOES HERE. The anon / publishable key only. It is designed to be
// public — it reaches every visitor's browser — and it is safe there only
// because row-level security decides what it can actually read. The service
// role key must never appear in this file, or in any variable prefixed
// NEXT_PUBLIC_: it bypasses RLS on every table. It is read server-side, in
// src/app/api/admissions/approve/route.ts, and nowhere else.
//
// RLS IS WHAT MAKES THIS SAFE, AND IT HAS NEVER BEEN VERIFIED. This sandbox
// cannot open a connection to the database host — the network policy answers
// 403 to CONNECT — so no check has ever run, on this project or the previous
// one. Before a real intake, run the query in docs/ADMISSIONS-PIPELINE.md §5b
// from a machine that can reach the project and confirm that `students` is not
// readable with this key. If it is, every applicant's record is public,
// including the full application text stored in the address column.
// ---------------------------------------------------------------------------

import { createClient } from '@supabase/supabase-js';

// The university's Supabase project. These are the defaults; the environment
// still wins, so a staging deployment overrides them without a code change.
//
// The key is a *publishable* key (`sb_publishable_…`), the successor to the
// anon key. Like the anon key it is meant to be public and is committed here on
// that basis — supabase-js sends it as the `apikey` header on every request
// from every browser, so treating it as a secret would be self-deception. What
// keeps it safe is row-level security, and nothing else.
const DEFAULT_URL = 'https://bhpsftesricwotkziokd.supabase.co';
const DEFAULT_KEY = 'sb_publishable_lQm8dFmj8PnQinSZooQbVg_WAfKJcGS';

export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? DEFAULT_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? DEFAULT_KEY;

/**
 * The project this build is talking to. Exported so a diagnostic screen can
 * show it — pointing at the wrong database is otherwise invisible until data
 * goes missing.
 */
export const supabaseProjectRef = supabaseUrl.replace(/^https:\/\//, '').split('.')[0];

const supabase = createClient(supabaseUrl, supabaseKey);

export { supabase };
