// ---------------------------------------------------------------------------
// COURSE REGISTRATION.
//
//   POST /api/enrolment  { action, ... }
//
//   register { studentId, courseIds[], academicYear, semester, sections{} }
//   drop     { enrollmentId, reason }
//   offer    { studentId, academicYear, semester }  what they may take, and why not
//
// ---------------------------------------------------------------------------
// A REGISTRATION IS AGAINST AN OFFERING, NOT AGAINST A COURSE
// ---------------------------------------------------------------------------
//
// The University drew the distinction itself: a COURSE is what the catalogue
// describes, an OFFERING is that course running in a named term, a CLASS is a
// group inside it meeting at an hour in a room, and a REGISTRATION is a
// student attached to one of those.
//
// Until 063 there was only the first and the last, so "register for BIS 220"
// meant registering for the idea of the course. There was no lecturer to teach
// it, no hour to attend, and no ceiling — a course with twenty seats could take
// two hundred registrations and nothing anywhere would notice.
//
// So this route now asks a second question after eligibility: IS IT ON OFFER?
// Five answers that had nowhere to live before: not offered this term, not open
// yet, closed, cancelled, and full.
//
// ---------------------------------------------------------------------------
// AND IF NOTHING HAS BEEN SET UP, IT DOES NOT BLOCK THE DOOR
// ---------------------------------------------------------------------------
//
// 063 seeded no offerings, on purpose — which term runs which course is the
// University's to say, not a migration's to invent. A term with no offerings
// at all therefore falls back to the whole catalogue, and says so
// (`offeringsConfigured: false`) so the screen can tell the reader WHY the
// lecturer column is empty rather than leaving them to guess.
//
// ---------------------------------------------------------------------------
// THE ACT NOTHING COULD PERFORM
// ---------------------------------------------------------------------------
//
// `enrollments` has existed since migration 001. The results pipeline reads it
// to build a mark sheet, the GPA engine reads it to weight a transcript, and
// the graduation audit reads it to decide whether somebody may be awarded a
// degree. No screen and no route had ever written a row into it.
//
// ---------------------------------------------------------------------------
// THE RULE WAS ALREADY WRITTEN, AND THAT IS THE POINT
// ---------------------------------------------------------------------------
//
// `src/lib/prerequisites.ts` holds it, tested, and says so in its own header:
// "NOTHING CALLS IT FROM A SCREEN YET, AND THAT IS SAID PLAINLY… When that
// screen is built, this is the check it makes."
//
// This is that screen's route. It does not restate the rule — a registration
// screen with the rule inlined, a graduation audit with it inlined again, and
// an advising screen with a third copy is how a student's eligibility comes to
// depend on which door they came in by.
//
// ---------------------------------------------------------------------------
// EVERY REFUSAL SAYS WHAT TO DO ABOUT IT
// ---------------------------------------------------------------------------
//
// `checkEligibility` reports EVERY failing condition rather than the first,
// with a sentence per reason naming the course. That is carried through here:
// a student registering for five courses gets one answer covering all five,
// not five round trips. A screen that cannot say what is missing generates a
// support ticket for every refusal.
// ---------------------------------------------------------------------------

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { guard } from '@/lib/adminAuth';
import { supabaseUrl as SUPABASE_URL } from '@/lib/supabase';
import { can, type Capability } from '@/lib/roles';
import type { UserRole } from '@/lib/types';
import { checkEligibility, type CourseRequirement } from '@/lib/prerequisites';
// THE RULE LIVES IN A LIBRARY BECAUSE A ROUTE FILE CANNOT EXPORT ONE. Next.js
// rejects any export from a route beyond its handlers and runtime flags, so a
// rule written here could never be imported by a test — and a rule nobody has
// watched refuse anything is a rule nobody has tested.
import { whyNot, sectionFor, type OfferingFacts } from '@/lib/courseOffering';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const bad = (error: string, status: number, detail?: string) =>
  NextResponse.json({ ok: false, error, ...(detail ? { detail } : {}) }, { status });

type Row = Record<string, unknown>;

const MIN_DROP_REASON = 8;

// A SINGLE STRING LITERAL. Concatenation collapses the supabase-js row type to
// GenericStringError[], silently and with no error at the call site.
// eslint-disable-next-line max-len
const COURSE = 'id, code, title, credit_unit, prerequisites, requires_mode, requires_ects, semester, year';
const OFFERING = 'id, course_id, status, delivery_mode, campus, max_enrolment, lecturer_id';
// eslint-disable-next-line max-len
const ROLL = 'offering_id, course_code, lecturer, registered, places_left, max_enrolment, starts_in, term_sequence';
const SECTION = 'id, offering_id, code, day_of_week, starts_at, ends_at';
// eslint-disable-next-line max-len
const WINDOW = 'term_id, term_sequence, starts_in, registration_opens, registration_closes, window_recorded, is_open, add_drop_open';

/**
 * Whether registration is open for a term — 066's view, in one shape.
 *
 * `window_recorded` AND `is_open` ARE TWO DIFFERENT FACTS and are kept as two
 * fields for that reason. A term nobody has dated is OPEN, not closed: 059
 * left `academic_periods` empty deliberately, and a caller that collapsed the
 * two would lock every student in the University out of registration.
 */
interface RegistrationWindow {
  window_recorded: boolean;
  is_open: boolean;
  add_drop_open: boolean;
  registration_opens: string | null;
  registration_closes: string | null;
}

// EVERY ACTION NEEDS `register-courses`, and the difference between a student
// and the Registry is WHOSE record may be touched, checked below. Splitting it
// into two capabilities would mean a student holding one that lets them
// register somebody else the day a role gained it by accident.
const CAPABILITY = 'register-courses' as Capability;

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return bad('bad-json', 400); }

  const action = String(body.action ?? '');
  if (!['register', 'drop', 'offer'].includes(action)) {
    return bad('unknown-action', 400, 'They are: register, drop, offer.');
  }

  const g = await guard(request, CAPABILITY);
  if (!g.ok) return NextResponse.json({ ok: false, error: g.error }, { status: g.status });
  const { caller } = g;

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) return bad('service-role-key-missing', 500);
  const admin = createClient(SUPABASE_URL, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // -------------------------------------------------------------------------
  // WHOSE RECORD MAY THIS CALLER TOUCH?
  //
  // A STUDENT REGISTERS THEMSELVES AND NOBODY ELSE. The capability is the same
  // one the Registry holds, so without this check any student could register
  // any other student for anything — and the id arrives in the request body,
  // which is to say from the browser.
  //
  // The student's own row is found from their user id rather than trusted from
  // the payload, because a `studentId` in a body is a number somebody chose.
  // -------------------------------------------------------------------------
  const isRegistry = can(caller.role as UserRole, 'view-registered-students' as Capability);

  let ownStudentId: string | null = null;
  if (!isRegistry) {
    // `auth_user_id`, NOT `user_id`. 001 names it that and indexes it that
    // way, and the RLS policy that lets a student read their own row joins on
    // it. Getting the column name wrong here does not error — the query simply
    // finds nothing, and every student is told their account is not linked to
    // a student record.
    const { data: me } = await admin.from('students')
      .select('id').eq('auth_user_id', caller.id).maybeSingle();
    ownStudentId = ((me as Row | null)?.id as string | null) ?? null;
  }

  const studentId = String(body.studentId ?? ownStudentId ?? '');

  if (!isRegistry) {
    if (!ownStudentId) {
      return bad('no-student-record', 403,
        'Your account is not linked to a student record, so there is nobody to register. If '
        + 'you have been admitted and this is wrong, write to the Registry.');
    }
    if (studentId && studentId !== ownStudentId) {
      return bad('not-your-record', 403,
        'You may register yourself for courses. Registering another student is the Registry’s.');
    }
  }

  // =========================================================================
  // OFFER — what may this student take, and what is missing where they cannot
  // =========================================================================
  //
  // THE SCREEN ASKS THIS BEFORE IT OFFERS ANYTHING. A list that shows every
  // course and refuses half of them on submission is a list that teaches
  // students to submit and see. Every course comes back with its verdict
  // attached, so the reason is on the screen beside the course.
  if (action === 'offer' || action === 'register') {
    if (!studentId) return bad('no-student', 400);

    const { data: courseRows } = await admin.from('courses').select(COURSE).order('code');
    const courses = (courseRows ?? []) as unknown as Row[];

    // ---- WHAT IS ACTUALLY ON OFFER THIS TERM ------------------------------
    //
    // Read flat and joined here rather than through one embedded select. The
    // two reads are small and the join is a Map; an embedded select that
    // resolves the wrong foreign key returns rows with a null child and no
    // error, which is the failure nobody sees.
    //
    // THE TERM IS OPTIONAL, because `offer` is also asked with no term at all
    // by a screen that has not chosen one yet. Without one there are no
    // offerings to find and the catalogue answer stands.
    const termYear = Number(body.academicYear ?? 0) || null;
    const termSeq = Number(body.semester ?? 0) || null;

    const offerings = new Map<string, OfferingFacts>();
    if (termYear && termSeq) {
      const { data: yearRow } = await admin.from('academic_years')
        .select('id, label').eq('starts_in', termYear).maybeSingle();
      const yearId = ((yearRow as Row | null)?.id as string | null) ?? null;

      if (yearId) {
        const [{ data: offRows }, { data: rollRows }] = await Promise.all([
          admin.from('course_offerings').select(OFFERING)
            .eq('academic_year_id', yearId).eq('term_sequence', termSeq),
          admin.from('course_offering_roll').select(ROLL)
            .eq('starts_in', termYear).eq('term_sequence', termSeq),
        ]);

        const roll = new Map(
          ((rollRows ?? []) as Row[]).map((r) => [String(r.offering_id), r]),
        );
        // The classes, so a student can be told WHEN as well as WHETHER.
        const offIds = ((offRows ?? []) as Row[]).map((o) => String(o.id));
        const { data: sectionRows } = offIds.length === 0
          ? { data: [] as Row[] }
          : await admin.from('class_sections').select(SECTION).in('offering_id', offIds);

        for (const o of (offRows ?? []) as Row[]) {
          const r = roll.get(String(o.id));
          offerings.set(String(o.course_id), {
            offeringId: String(o.id),
            status: String(o.status),
            deliveryMode: String(o.delivery_mode ?? ''),
            campus: (o.campus as string | null) ?? null,
            lecturer: (r?.lecturer as string | null) ?? null,
            maxEnrolment: (o.max_enrolment as number | null) ?? null,
            registered: Number(r?.registered ?? 0),
            // NULL IS NOT ZERO. An offering with no ceiling has no places left
            // to count, and a screen reading that as zero closes a course
            // nobody limited.
            placesLeft: r?.places_left == null ? null : Number(r.places_left),
            classes: ((sectionRows ?? []) as Row[])
              .filter((s) => String(s.offering_id) === String(o.id))
              .map((s) => ({
                id: String(s.id),
                code: String(s.code),
                dayOfWeek: s.day_of_week == null ? null : Number(s.day_of_week),
                startsAt: (s.starts_at as string | null) ?? null,
                endsAt: (s.ends_at as string | null) ?? null,
              })),
          });
        }
      }
    }

    // A TERM NOBODY HAS SET UP YET is not a term in which everything is
    // refused. See the header.
    const offeringsConfigured = offerings.size > 0;

    // ---- IS REGISTRATION EVEN OPEN? ---------------------------------------
    //
    // 066 answers this in ONE view, `registration_window`, read by this route,
    // by the registration screen and by the calendar screen. A screen that
    // thinks registration is open while the route thinks it is closed produces
    // a form that submits and is refused — a support ticket for every user.
    //
    // AND A TERM WITH NO WINDOW RECORDED IS OPEN. 059 left academic_periods
    // empty on purpose; reading an absent window as a closed one would lock
    // every student out of registration. `window_recorded` and `is_open` are
    // separate columns precisely so nothing can collapse them by accident.
    let regWindow: RegistrationWindow | null = null;
    if (termYear && termSeq) {
      const { data: win } = await admin.from('registration_window').select(WINDOW)
        .eq('starts_in', termYear).eq('term_sequence', termSeq).maybeSingle();
      regWindow = (win ?? null) as unknown as RegistrationWindow | null;
    }
    // A DATABASE WITHOUT 066 HAS NO VIEW TO READ, and must behave exactly as it
    // did before — open, with no window recorded.
    const windowOpen = regWindow ? regWindow.is_open : true;
    const windowRecorded = regWindow ? regWindow.window_recorded : false;

    // ---- WHAT THE STUDENT HAS ACTUALLY PASSED ----------------------------
    //
    // APPROVED RESULTS ONLY. A mark that has been entered but not approved is
    // not a pass — it is a proposal, and treating it as a pass would let a
    // student register for the sequel to a course whose result a board may yet
    // send back.
    const { data: resultRows } = await admin.from('results')
      .select('course_id, grade, grade_point, status')
      .eq('student_id', studentId)
      .eq('status', 'approved');

    const byId = new Map(courses.map((c) => [String(c.id), c]));
    const passed: string[] = [];
    let creditsEarned = 0;

    for (const r of (resultRows ?? []) as Row[]) {
      // A PASS IS A GRADE POINT ABOVE ZERO. The published scale gives a fail
      // 0.00, so this needs no second table of pass marks that could disagree
      // with the scale.
      if (Number(r.grade_point ?? 0) <= 0) continue;
      const c = byId.get(String(r.course_id));
      if (!c) continue;
      passed.push(String(c.code));
      creditsEarned += Number(c.credit_unit ?? 0);
    }

    // ---- WHAT THEY ARE ALREADY ON -----------------------------------------
    const { data: already } = await admin.from('course_roll')
      .select('enrollment_id, course_id, academic_year, semester, status')
      .eq('student_id', studentId);
    const enrolled = new Map(
      ((already ?? []) as Row[]).map((e) => [String(e.course_id), e]),
    );

    const wanted = Array.isArray(body.courseIds)
      ? (body.courseIds as unknown[]).map(String) : [];

    // REGISTERING FOR TWO COURSES AT ONCE, where one is the other's
    // prerequisite, is a single request the rule can already answer: it takes
    // `registeringFor` and treats a co-requisite as satisfied by the same
    // term's registration.
    const registeringFor = wanted
      .map((id) => byId.get(id))
      .filter(Boolean)
      .map((c) => String((c as Row).code));

    const verdicts = courses.map((c) => {
      const requirement: CourseRequirement = {
        code: String(c.code),
        requires: (c.prerequisites as string[] | null) ?? [],
        requiresMode: (c.requires_mode as 'all' | 'any' | null) ?? 'all',
        requiresEcts: (c.requires_ects as number | null) ?? undefined,
      };
      const verdict = checkEligibility(requirement, {
        passed, creditsEarned, registeringFor,
      });
      const on = enrolled.get(String(c.id));

      // ELIGIBILITY AND AVAILABILITY ARE TWO DIFFERENT QUESTIONS, and both
      // answers are kept. A student refused because a class is full has met
      // every academic condition, and telling them "you are not eligible"
      // sends them to the wrong office.
      const offering = offerings.get(String(c.id));
      const unavailable = whyNot(offering, offeringsConfigured);

      return {
        id: c.id,
        code: c.code,
        title: c.title,
        creditUnit: c.credit_unit,
        semester: c.semester,
        year: c.year,
        eligible: verdict.eligible && unavailable === null,
        meetsPrerequisites: verdict.eligible,
        reasons: unavailable ? [...verdict.reasons, unavailable] : verdict.reasons,
        missing: verdict.missing,
        unavailable,
        offering: offering ?? null,
        alreadyRegistered: Boolean(on),
        enrollmentId: on?.enrollment_id ?? null,
      };
    });

    if (action === 'offer') {
      return NextResponse.json({
        ok: true,
        studentId,
        passed,
        creditsEarned,
        offeringsConfigured,
        registration: {
          open: windowOpen,
          recorded: windowRecorded,
          opens: regWindow?.registration_opens ?? null,
          closes: regWindow?.registration_closes ?? null,
          // THE REGISTRY IS NOT STOPPED BY A CLOSED WINDOW, and the screen
          // needs to know which of the two readers it is drawing for.
          mayRegisterAnyway: isRegistry,
        },
        courses: verdicts,
      });
    }

    // =======================================================================
    // REGISTER
    // =======================================================================
    if (wanted.length === 0) return bad('nothing-chosen', 400, 'Choose at least one course.');

    const year = termYear;
    const semester = termSeq;
    if (!year || !semester) {
      return bad('no-term', 400,
        'A registration belongs to a term. Without the year and the semester it cannot be '
        + 'placed on a transcript or counted towards anything.');
    }

    // ---- THE DEADLINE --------------------------------------------------
    //
    // A STUDENT IS REFUSED. THE REGISTRY IS NOT, AND IS RECORDED.
    //
    // Late registration is a real act a University performs. A system that
    // cannot perform it is one the Registry performs on paper instead, where
    // nothing counts it — so the question was never whether it should be
    // possible, but whether it should be INVISIBLE. It is recorded on the row.
    if (!windowOpen && !isRegistry) {
      return bad('registration-closed', 409,
        regWindow?.registration_closes
          ? `Registration for this semester closed on ${regWindow.registration_closes}. The `
            + 'Registry can still register you — write to them, and it will be recorded as a late '
            + 'registration.'
          : 'Registration for this semester is not open. The Registry can still register you.');
    }
    const late = !windowOpen;

    const chosen = verdicts.filter((v) => wanted.includes(String(v.id)));
    const unknown = wanted.filter((id) => !byId.has(id));
    if (unknown.length > 0) {
      return bad('unknown-course', 400, 'One of the courses chosen is not in the catalogue.');
    }

    // ---- REFUSED ALL AT ONCE, WITH EVERY REASON --------------------------
    const refused = chosen.filter((c) => !c.eligible);
    if (refused.length > 0) {
      return NextResponse.json({
        ok: false,
        error: 'not-eligible',
        refused: refused.map((c) => ({ code: c.code, title: c.title, reasons: c.reasons })),
        detail: refused.length === 1
          ? `${refused[0].code} cannot be registered: ${refused[0].reasons.join(' ')}`
          : `${refused.length} of the courses chosen cannot be registered. Every reason is `
            + 'listed so nothing else comes back on a second attempt.',
      }, { status: 409 });
    }

    // ---- WRITE THEM -------------------------------------------------------
    //
    // UPSERT ON THE TERM KEY. 001's unique constraint is
    // (student_id, course_id, academic_year, semester), so a student who
    // dropped a course and is registering again in the same term must revive
    // that row rather than meet a conflict.
    //
    // THE DROP FIELDS ARE CLEARED IN THE SAME STATEMENT. 054 refuses a row
    // that is registered and dropped at once, which is precisely the mistake
    // an upsert that only set the status would make.
    //
    // AND THE OFFERING IS RECORDED WITH THE REGISTRATION. That is the link
    // 063 added and nothing wrote: without it a registration names a course
    // but not the class, so no mark sheet can be produced from a lecturer's
    // own list and no room can be sized from its roll.
    //
    // `sections` is optional. A student may choose a class where the offering
    // has more than one; where it has exactly one, this picks it for them
    // rather than leaving the link half made.
    const askedSections = (body.sections ?? {}) as Record<string, unknown>;

    const now = new Date().toISOString();
    const rows = chosen.map((c) => {
      const o = offerings.get(String(c.id));
      const asked = askedSections[String(c.id)] ? String(askedSections[String(c.id)]) : null;
      const section = sectionFor(o, asked);
      return {
        student_id: studentId,
        course_id: c.id as string,
        academic_year: year,
        semester,
        status: 'registered',
        enrolled_at: now,
        registered_by: caller.id,
        registered_via: isRegistry ? 'registry' : 'self',
        registered_late: late,
        offering_id: o?.offeringId ?? null,
        section_id: section,
        dropped_at: null,
        dropped_by: null,
        drop_reason: null,
      };
    });

    const { error } = await admin.from('enrollments')
      .upsert(rows, { onConflict: 'student_id,course_id,academic_year,semester' });
    if (error) return bad(`not-registered: ${error.message}`, 500);

    return NextResponse.json({
      ok: true,
      registered: chosen.map((c) => c.code),
      late,
      detail: `Registered for ${chosen.length} course${chosen.length === 1 ? '' : 's'}: `
        + `${chosen.map((c) => c.code).join(', ')}. They now appear on the mark sheet for each, `
        + 'and on the transcript once results are approved.'
        + (late
          ? ' This was outside the registration window and is recorded as a late registration.'
          : ''),
    });
  }

  // =========================================================================
  // DROP
  // =========================================================================
  if (action === 'drop') {
    const enrollmentId = String(body.enrollmentId ?? '');
    const reason = String(body.reason ?? '').trim();
    if (!enrollmentId) return bad('no-enrolment', 400);
    if (reason.length < MIN_DROP_REASON) {
      return bad('no-reason', 400,
        'Say why the course is being dropped. It stays on the record beside the registration '
        + 'it undoes, and it is the first thing asked at an appeal.');
    }

    const { data: found } = await admin.from('enrollments')
      .select('id, student_id, course_id, status').eq('id', enrollmentId).maybeSingle();
    const e = found as Row | null;
    if (!e) return bad('enrolment-not-found', 404);

    // THE SAME OWNERSHIP RULE AS REGISTERING. A student may drop their own
    // course and nobody else's.
    if (!isRegistry && e.student_id !== ownStudentId) {
      return bad('not-your-record', 403, 'You may drop your own courses.');
    }
    if (e.status === 'dropped') {
      return bad('already-dropped', 409, 'That course has already been dropped.');
    }

    // ---- A RESULT ALREADY APPROVED IS NOT DROPPED -------------------------
    //
    // THE GUARD THAT MATTERS HERE. Dropping a course a student has already
    // been examined in and passed would take a completed module off their
    // transcript — and the GPA engine reads the roll, so the degree would
    // quietly change classification.
    const { data: result } = await admin.from('results')
      .select('id, status, grade').eq('student_id', e.student_id as string)
      .eq('course_id', e.course_id as string).eq('status', 'approved').maybeSingle();

    if (result) {
      return bad('already-examined', 409,
        'This course has an approved result, so it cannot be dropped — the student has been '
        + 'examined in it and it is part of their academic record. A result that should not '
        + 'stand is corrected through the results process, not by removing the registration.');
    }

    const { error } = await admin.from('enrollments').update({
      status: 'dropped',
      dropped_at: new Date().toISOString(),
      dropped_by: caller.id,
      drop_reason: reason,
    }).eq('id', enrollmentId);
    if (error) return bad(`not-dropped: ${error.message}`, 500);

    return NextResponse.json({
      ok: true,
      detail: 'Dropped. The registration stays on the record with the date and the reason — it '
        + 'is not deleted, because a student who sat an assessment and then vanished from the '
        + 'register is the shape of a real dispute.',
    });
  }

  return bad('unknown-action', 400);
}
