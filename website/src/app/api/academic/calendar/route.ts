// ---------------------------------------------------------------------------
// THE ACADEMIC CALENDAR — the year boundary, and who may move it.
//
//   POST /api/academic/calendar  { action, ... }
//
//   roll        { }                              bring every status into line
//   year-status { yearId, status }               planning|current|closed
//   term-dates  { termId, startsOn, endsOn }      move a semester
//   year-add    { startsIn }                      extend the calendar
//   period-set  { termId, kind, startsOn, endsOn, note }   a window in a term
//   period-clear{ periodId }                     remove one
//
// ---------------------------------------------------------------------------
// WHY THIS EXISTS AT ALL
// ---------------------------------------------------------------------------
//
// `reachability.test.mjs` found `academic_years` read by three screens and
// written by nothing, and the entry it was filed under said exactly this:
//
//   "Seeded 2015–2035 by 059, but nothing can roll the year over: marking one
//   year current and the previous one closed is an act with no screen, and
//   three screens now open on whichever year is current."
//
// Building it turned up something worse than a missing screen. 059 set every
// year's status ONCE, with `current_date`, on the day the migration ran — under
// a comment claiming the date decides it. It decided it once. On 15 August
// 2027 the column would still have said 2026/2027, and Course Offerings, the
// Timetable and the Academic Overview would all have opened on the wrong year
// in silence.
//
// 065 fixes the reading half: `academic_year_now` derives the year from the
// dates and cannot go stale. This is the writing half.
//
// ---------------------------------------------------------------------------
// ROLLING THE YEAR IS ONE FUNCTION IN THE DATABASE, NOT AN UPDATE HERE
// ---------------------------------------------------------------------------
//
// `roll_the_academic_year()` stands the leaving year down BEFORE standing the
// arriving one up, because `academic_years_one_current` is a unique index and
// a single statement doing both can be evaluated in the order that trips it.
// Rewriting that logic here would mean the screen and an operator with psql
// performing two different acts, one of which fails on the August it matters.
// ---------------------------------------------------------------------------

import { NextResponse } from 'next/server';
import { guard, audit } from '@/lib/adminAuth';
import type { Capability } from '@/lib/roles';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const bad = (error: string, status: number, detail?: string) =>
  NextResponse.json({ ok: false, error, ...(detail ? { detail } : {}) }, { status });

// NOT EXPORTED — Next.js route files export only handlers and runtime flags.
const CAPABILITY: Capability = 'manage-academic-calendar' as Capability;
const STATUSES = ['planning', 'current', 'closed'];
const ACTIONS = [
  'roll', 'year-status', 'term-dates', 'year-add', 'period-set', 'period-clear',
];
const PERIOD_KINDS = [
  'registration', 'add-drop', 'teaching', 'examinations', 'results', 'break',
];

const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return bad('bad-json', 400); }

  const action = String(body.action ?? '');
  if (!ACTIONS.includes(action)) {
    return bad('unknown-action', 400, `They are: ${ACTIONS.join(', ')}.`);
  }

  const g = await guard(request, CAPABILITY);
  if (!g.ok) {
    return NextResponse.json({
      ok: false,
      error: g.error,
      detail: 'Moving the academic year moves three screens onto a different year for everybody '
        + 'at once. It is the Registry’s, not a teaching office’s.',
    }, { status: g.status });
  }
  const { caller, admin } = g;

  // =========================================================================
  // ROLL — bring every stored status into line with the calendar
  // =========================================================================
  if (action === 'roll') {
    const { data, error } = await admin.rpc('roll_the_academic_year');
    if (error) {
      return bad('roll-failed', 500, /does not exist/i.test(error.message)
        ? 'Migration 065 has not been run on this database, so there is no function to roll the '
          + 'year with.'
        : error.message);
    }
    const moved = (data ?? []) as { label: string; was: string; now_is: string }[];

    // NOTHING MOVED IS A RESULT, NOT A FAILURE. Pressing this on a calendar
    // that is already in step should say so plainly rather than imply an
    // error or imply a change that did not happen.
    if (moved.length === 0) {
      return NextResponse.json({
        ok: true, moved: [],
        detail: 'Nothing moved — every year’s status already matches the calendar.',
      });
    }

    await audit(admin, {
      // ROLLING TOUCHES SEVERAL YEARS AT ONCE, so there is no single entity id
      // to name. The years that moved are in the details, which is the record
      // that matters at an audit: which year stopped being current, and when.
      action: 'academic-year-rolled', entityType: 'academic_year',
      performedBy: caller.id, details: { moved },
    });
    return NextResponse.json({
      ok: true,
      moved,
      detail: moved.map((m) => `${m.label}: ${m.was} → ${m.now_is}`).join('; ')
        + '. Course offerings, the timetable and the academic overview now open on the year '
        + 'today falls in.',
    });
  }

  // =========================================================================
  // YEAR-STATUS — one year, moved by hand
  // =========================================================================
  if (action === 'year-status') {
    const id = String(body.yearId ?? '');
    const status = String(body.status ?? '');
    if (!id) return bad('no-year', 400);
    if (!STATUSES.includes(status)) {
      return bad('bad-status', 400, `It is one of: ${STATUSES.join(', ')}.`);
    }

    const { data: year } = await admin.from('academic_years')
      .select('id, label, starts_on, ends_on, status').eq('id', id).maybeSingle();
    if (!year) return bad('year-not-found', 404);
    const y = year as Record<string, unknown>;

    // ---- MARKING A YEAR CURRENT THAT TODAY IS NOT IN ---------------------
    //
    // NOT REFUSED, and this is a considered decision rather than an omission.
    // A University may genuinely need to open next year's registration in
    // July, before the year has technically begun. Refusing would make a
    // normal August impossible in order to prevent a mistake that the drift
    // report already makes visible.
    //
    // So it is allowed, and it is ANSWERED WITH THE DISAGREEMENT, so that
    // nobody does it by accident and then wonders why the calendar screen has
    // a warning on it.
    const today = new Date().toISOString().slice(0, 10);
    const insideToday = String(y.starts_on) <= today && today <= String(y.ends_on);
    let warning: string | null = null;
    if (status === 'current' && !insideToday) {
      warning = `Today does not fall inside ${y.label} (${y.starts_on} to ${y.ends_on}). `
        + 'That is allowed — a term is often opened early — but the calendar will show it as '
        + 'out of step until today catches up.';
    }
    if (status === 'closed' && insideToday) {
      warning = `Today falls inside ${y.label}, so closing it marks the year the University is `
        + 'actually in as finished. Allowed, but the calendar will show it as out of step.';
    }

    // TWO YEARS CANNOT BOTH BE CURRENT. 059's unique index refuses it, and a
    // caller meeting `duplicate key value violates unique constraint
    // "academic_years_one_current"` learns nothing. So the outgoing year is
    // stood down FIRST — the same order `roll_the_academic_year()` uses, and
    // for the same reason.
    if (status === 'current') {
      const { data: sitting } = await admin.from('academic_years')
        .select('id, label, ends_on').eq('status', 'current').maybeSingle();
      const s = sitting as Record<string, unknown> | null;
      if (s && s.id !== id) {
        const standDown = String(s.ends_on) < today ? 'closed' : 'planning';
        const { error: downErr } = await admin.from('academic_years')
          .update({ status: standDown }).eq('id', s.id as string);
        if (downErr) return bad('stand-down-failed', 500, downErr.message);
        await audit(admin, {
          action: 'academic-year-status', entityType: 'academic_year',
          entityId: s.id as string, performedBy: caller.id,
          details: { status: standDown, because: `${y.label} was made current` },
        });
      }
    }

    const { error } = await admin.from('academic_years').update({ status }).eq('id', id);
    if (error) return bad('status-failed', 500, error.message);
    await audit(admin, {
      action: 'academic-year-status', entityType: 'academic_year', entityId: id,
      performedBy: caller.id, details: { status },
    });
    return NextResponse.json({
      ok: true,
      ...(warning ? { warning } : {}),
      detail: `${y.label} is now ${status}.`,
    });
  }

  // =========================================================================
  // TERM-DATES — moving a semester
  // =========================================================================
  //
  // 059 refuses two terms of one year that overlap, with a trigger, because an
  // overlap is a date belonging to two semesters — and then every question the
  // table exists to answer has two answers. The trigger's message is good;
  // this passes it through rather than replacing it with 'update failed'.
  if (action === 'term-dates') {
    const id = String(body.termId ?? '');
    const startsOn = String(body.startsOn ?? '');
    const endsOn = String(body.endsOn ?? '');
    if (!id) return bad('no-term', 400);
    if (!isDate(startsOn) || !isDate(endsOn)) {
      return bad('bad-dates', 400, 'Both dates are needed, as YYYY-MM-DD.');
    }
    if (endsOn <= startsOn) {
      return bad('backwards', 400, 'A semester ends after it begins.');
    }

    const { error } = await admin.from('academic_terms')
      .update({ starts_on: startsOn, ends_on: endsOn }).eq('id', id);
    if (error) {
      return bad('term-failed', 409, error.message);
    }
    await audit(admin, {
      action: 'academic-term-moved', entityType: 'academic_term', entityId: id,
      performedBy: caller.id, details: { startsOn, endsOn },
    });
    return NextResponse.json({
      ok: true,
      detail: 'Moved. Registrations already filed under this term keep the year they were filed '
        + 'under — the term’s dates decide what happens next, not what has already happened.',
    });
  }

  // =========================================================================
  // YEAR-ADD — extending the calendar past what 059 seeded
  // =========================================================================
  //
  // 059 seeds 2015 to 2035. That is nine years of slack and then it runs out,
  // and the day it does, `academic_year_now` returns nothing and every screen
  // says so. This is how the University adds 2036 without a migration.
  //
  // THE TWO SEMESTERS COME WITH IT. A year with no terms in it is a year
  // `academic_term_on` cannot answer for, which is the same outage one line
  // further down.
  if (action === 'year-add') {
    const startsIn = Number(body.startsIn ?? 0);
    if (!Number.isInteger(startsIn) || startsIn < 1900 || startsIn > 2200) {
      return bad('bad-year', 400, 'A year is the calendar year the session opens in, such as 2036.');
    }

    const label = `${startsIn}/${startsIn + 1}`;
    // THE UNIVERSITY'S OWN RULE, stated by it and already in 059: the western
    // calendar, 15 August to 14 August, Semester 1 to 1 January and Semester 2
    // from the 2nd. Derived here rather than asked for, so a year added in a
    // hurry cannot quietly use different dates from every other year.
    const opens = `${startsIn}-08-15`;
    const closes = `${startsIn + 1}-08-14`;

    const { data, error } = await admin.from('academic_years').insert({
      label, starts_in: startsIn, starts_on: opens, ends_on: closes, status: 'planning',
    }).select('id').single();
    if (error) {
      return bad('year-failed', 409, /duplicate|unique/i.test(error.message)
        ? `${label} is already in the calendar.`
        : error.message);
    }
    const yearId = data.id as string;

    const { error: termErr } = await admin.from('academic_terms').insert([
      {
        academic_year_id: yearId, sequence: 1, name: 'Semester 1',
        starts_on: opens, ends_on: `${startsIn + 1}-01-01`,
      },
      {
        academic_year_id: yearId, sequence: 2, name: 'Semester 2',
        starts_on: `${startsIn + 1}-01-02`, ends_on: closes,
      },
    ]);
    if (termErr) return bad('terms-failed', 500, termErr.message);

    await audit(admin, {
      action: 'academic-year-added', entityType: 'academic_year', entityId: yearId,
      performedBy: caller.id, details: { label },
    });
    return NextResponse.json({
      ok: true,
      id: yearId,
      detail: `${label} added, running ${opens} to ${closes}, with both semesters — `
        + 'Semester 1 to 1 January, Semester 2 from the 2nd. It is in planning; it becomes '
        + 'current on its own when the calendar reaches it and somebody rolls the year.',
    });
  }

  // =========================================================================
  // PERIODS — registration, add/drop, teaching, examinations, results
  // =========================================================================
  //
  // 059 created `academic_periods` and left it empty, saying why: the
  // University had stated when its semesters open, not when registration does,
  // and "a plausible deadline that was never agreed is worse than none."
  //
  // This is how one gets agreed. 066 adds the rule that applies once a window
  // exists — a student may register only while it is open; the Registry may
  // register at any time and a late one is RECORDED as late — and until a
  // window is recorded, nothing is refused.
  if (action === 'period-set') {
    const termId = String(body.termId ?? '');
    const kind = String(body.kind ?? '');
    const startsOn = String(body.startsOn ?? '');
    const endsOn = String(body.endsOn ?? '');
    if (!termId) return bad('no-term', 400);
    if (!PERIOD_KINDS.includes(kind)) {
      return bad('bad-kind', 400, `A window is one of: ${PERIOD_KINDS.join(', ')}.`);
    }
    if (!isDate(startsOn) || !isDate(endsOn)) {
      return bad('bad-dates', 400, 'Both dates are needed, as YYYY-MM-DD.');
    }
    if (endsOn <= startsOn) {
      return bad('backwards', 400, 'A window closes after it opens.');
    }

    // UPSERT ON (term_id, kind). 059 allows one window of each kind per term,
    // because two registration windows in one semester is two answers to "is
    // registration open" — and a caller meeting a unique-constraint error when
    // they meant to CHANGE the dates learns nothing from it.
    const { error } = await admin.from('academic_periods').upsert({
      term_id: termId,
      kind,
      starts_on: startsOn,
      ends_on: endsOn,
      note: body.note ? String(body.note) : null,
    }, { onConflict: 'term_id,kind' });
    if (error) {
      // 066's trigger refuses a window outside its own term, in a sentence
      // naming both sets of dates. It is passed through rather than replaced.
      return bad('period-failed', 409, error.message);
    }

    await audit(admin, {
      action: 'academic-period-set', entityType: 'academic_term', entityId: termId,
      performedBy: caller.id, details: { kind, startsOn, endsOn },
    });
    return NextResponse.json({
      ok: true,
      detail: kind === 'registration'
        ? `Registration for this semester now runs ${startsOn} to ${endsOn}. Outside it a student `
          + 'cannot register themselves; the Registry still can, and those are recorded as late.'
        : `The ${kind} window now runs ${startsOn} to ${endsOn}.`,
    });
  }

  if (action === 'period-clear') {
    const id = String(body.periodId ?? '');
    if (!id) return bad('no-period', 400);
    const { error } = await admin.from('academic_periods').delete().eq('id', id);
    if (error) return bad('period-failed', 500, error.message);
    await audit(admin, {
      action: 'academic-period-cleared', entityType: 'academic_period', entityId: id,
      performedBy: caller.id,
    });
    return NextResponse.json({
      ok: true,
      // REMOVING A REGISTRATION WINDOW OPENS REGISTRATION. Said plainly,
      // because the opposite is the intuitive reading of "clear".
      detail: 'Removed. With no window recorded, nothing is refused on the grounds of a deadline '
        + '— that is what an absent window means, not a closed one.',
    });
  }

  return bad('unknown-action', 400);
}
