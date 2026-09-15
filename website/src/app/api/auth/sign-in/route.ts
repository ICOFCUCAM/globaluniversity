// ---------------------------------------------------------------------------
// SIGNING IN WITH A STUDENT NUMBER.
//
// POST { identifier, password } -> { access_token, refresh_token }
//
// ---------------------------------------------------------------------------
// WHY THIS EXISTS
// ---------------------------------------------------------------------------
//
// The admission package has always told admitted students:
//
//     Username            ICOF202600001
//     Temporary password  ...
//
// and the sign-in box was an email field that rejected it. The University said
// one thing in writing and accepted another on screen, which is the same class
// of fault as a letter promising a password change that nothing enforced.
//
// The University's ruling, September 2026: accept both. Staff keep signing in
// with an email address; a student may use either.
//
// ---------------------------------------------------------------------------
// WHY THE SIGN-IN HAPPENS HERE AND NOT IN THE BROWSER
// ---------------------------------------------------------------------------
//
// The obvious design is a lookup — the browser asks "what email belongs to
// ICOF202600001?" and then signs in normally. That endpoint would be a
// STUDENT EMAIL ADDRESS DIRECTORY, open to anyone, because student numbers are
// sequential: ICOF202600001, 00002, 00003. Walking them would harvest the
// personal email address of every student the University has admitted.
//
// So the number and the password arrive together and the sign-in is completed
// here. A wrong number and a wrong password are indistinguishable from
// outside — both come back as the same refusal — and nothing is disclosed to
// somebody who does not already hold the password.
//
// ---------------------------------------------------------------------------
// AND ONLY FOR A NUMBER, NEVER FOR AN EMAIL
// ---------------------------------------------------------------------------
//
// An identifier containing `@` is refused here and signed in directly by the
// browser, exactly as before. That is deliberate: Supabase rate-limits sign-in
// attempts BY IP, and every attempt routed through this server shares this
// server's address. Sending the ordinary path through here would pool every
// member of staff behind one limit, so one person guessing passwords could
// lock out the University.
//
// Confining it to student numbers keeps that surface as small as the feature
// allows. It is a real limitation rather than a solved problem, and it is
// written down here so the next person weighing "why not route everything
// through the route" has the answer in front of them.
// ---------------------------------------------------------------------------

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { adminClient } from '@/lib/adminAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * ONE REFUSAL FOR EVERY FAILURE.
 *
 * A number that belongs to nobody, a number that belongs to somebody with a
 * different password, and an account that is suspended must all look the same
 * from outside. Saying "no student holds that number" turns this route back
 * into the directory it was written to avoid.
 */
const REFUSED = 'That student number or password is not right.';

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return bad('bad-json', 400); }

  const identifier = String(body.identifier ?? '').trim();
  const password = String(body.password ?? '');

  if (!identifier || !password) {
    return NextResponse.json({ ok: false, error: REFUSED }, { status: 400 });
  }

  // AN EMAIL ADDRESS IS THE BROWSER'S OWN BUSINESS. See the note above: this
  // path exists for student numbers, and widening it would pool every sign-in
  // in the University behind one address for rate-limiting purposes.
  if (identifier.includes('@')) {
    return NextResponse.json({
      ok: false,
      error: 'use-the-browser',
      detail: 'An email address is signed in directly.',
    }, { status: 400 });
  }

  const admin = adminClient();
  if (!admin) {
    return NextResponse.json({
      ok: false, error: 'service-role-key-missing',
    }, { status: 500 });
  }

  // ---- WHOSE NUMBER IS IT? ------------------------------------------------
  //
  // The student number first, then the matriculation number: both are printed
  // on things a student holds, and somebody reading either off a letter should
  // not have to know which one the system calls the username.
  const { data: student } = await admin
    .from('students')
    .select('auth_user_id')
    .or(`student_number.eq.${identifier},matric_no.eq.${identifier}`)
    .not('auth_user_id', 'is', null)
    .maybeSingle();

  if (!student?.auth_user_id) {
    return NextResponse.json({ ok: false, error: REFUSED }, { status: 401 });
  }

  const { data: profile } = await admin
    .from('profiles')
    .select('email, suspended_at')
    .eq('id', student.auth_user_id)
    .maybeSingle();

  if (!profile?.email) {
    return NextResponse.json({ ok: false, error: REFUSED }, { status: 401 });
  }

  // ---- NOW ACTUALLY SIGN IN ----------------------------------------------
  //
  // WITH THE PUBLISHABLE KEY, not the service key. This must be a real sign-in
  // that Supabase itself judges — the password is checked by the auth service
  // against the stored hash, and this route never sees, stores or compares it.
  // Using the service key here would mean minting a session without anybody
  // having proved anything.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    return NextResponse.json({ ok: false, error: 'supabase-not-configured' }, { status: 500 });
  }

  const asUser = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: signed, error } = await asUser.auth.signInWithPassword({
    email: profile.email,
    password,
  });

  if (error || !signed.session) {
    return NextResponse.json({ ok: false, error: REFUSED }, { status: 401 });
  }

  // A SUSPENDED ACCOUNT IS REFUSED HERE TOO. The browser checks it as well, and
  // both are wanted: this closes the window in which a session exists before
  // the profile has been read.
  if (profile.suspended_at) {
    await asUser.auth.signOut();
    return NextResponse.json({ ok: false, error: REFUSED }, { status: 401 });
  }

  // THE TOKENS, AND NOTHING ELSE. Not the email address the number resolved
  // to: the browser is about to hold a session for this account and can read
  // its own profile, so sending it here would only widen what a failed attempt
  // could be made to reveal.
  return NextResponse.json({
    ok: true,
    access_token: signed.session.access_token,
    refresh_token: signed.session.refresh_token,
  });
}

function bad(error: string, status: number) {
  return NextResponse.json({ ok: false, error }, { status });
}
