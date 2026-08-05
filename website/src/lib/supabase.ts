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
// cannot open a connection to either database host — the network policy answers
// 403 to CONNECT — so no check has ever run. Before a real intake, confirm from
// a machine that can reach the project that `students` is not readable by the
// anon role. If it is, every applicant's record is public, including the full
// application text stored on it.
// ---------------------------------------------------------------------------

import { createClient } from '@supabase/supabase-js';

const FALLBACK_URL = 'https://djotoapomhlavxknwsxw.databasepad.com';
const FALLBACK_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6Ijk1MDg0NDA0LTIzYTgtNDFiMy1hZGY5LThkZjAxZGQ0YjFhZCJ9.eyJwcm9qZWN0SWQiOiJkam90b2Fwb21obGF2eGtud3N4dyIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNzc1NzQ5MjUzLCJleHAiOjIwOTExMDkyNTMsImlzcyI6ImZhbW91cy5kYXRhYmFzZXBhZCIsImF1ZCI6ImZhbW91cy5jbGllbnRzIn0.HX5KXmq66DJnKg2kXth1sVc41vcgMRxB04zyHRZLQ18';

export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? FALLBACK_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? FALLBACK_KEY;

/** True while the app is still pointing at the original project. */
export const usingFallbackProject = supabaseUrl === FALLBACK_URL;

const supabase = createClient(supabaseUrl, supabaseKey);

export { supabase };
