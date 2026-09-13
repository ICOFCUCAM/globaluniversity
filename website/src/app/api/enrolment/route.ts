// ---------------------------------------------------------------------------
// COURSE REGISTRATION.
//
//   POST /api/enrolment  { action, ... }
//
//   register { studentId, courseIds[], academicYear, semester }
//   drop     { enrollmentId, reason }
//   offer    { studentId, academicYear, semester }  what they may take, and why not
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
      return {
        id: c.id,
        code: c.code,
        title: c.title,
        creditUnit: c.credit_unit,
        semester: c.semester,
        year: c.year,
        eligible: verdict.eligible,
        reasons: verdict.reasons,
        missing: verdict.missing,
        alreadyRegistered: Boolean(on),
        enrollmentId: on?.enrollment_id ?? null,
      };
    });

    if (action === 'offer') {
      return NextResponse.json({
        ok: true, studentId, passed, creditsEarned, courses: verdicts,
      });
    }

    // =======================================================================
    // REGISTER
    // =======================================================================
    if (wanted.length === 0) return bad('nothing-chosen', 400, 'Choose at least one course.');

    const year = Number(body.academicYear ?? 0) || null;
    const semester = Number(body.semester ?? 0) || null;
    if (!year || !semester) {
      return bad('no-term', 400,
        'A registration belongs to a term. Without the year and the semester it cannot be '
        + 'placed on a transcript or counted towards anything.');
    }

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
    const now = new Date().toISOString();
    const rows = chosen.map((c) => ({
      student_id: studentId,
      course_id: c.id as string,
      academic_year: year,
      semester,
      status: 'registered',
      enrolled_at: now,
      registered_by: caller.id,
      registered_via: isRegistry ? 'registry' : 'self',
      dropped_at: null,
      dropped_by: null,
      drop_reason: null,
    }));

    const { error } = await admin.from('enrollments')
      .upsert(rows, { onConflict: 'student_id,course_id,academic_year,semester' });
    if (error) return bad(`not-registered: ${error.message}`, 500);

    return NextResponse.json({
      ok: true,
      registered: chosen.map((c) => c.code),
      detail: `Registered for ${chosen.length} course${chosen.length === 1 ? '' : 's'}: `
        + `${chosen.map((c) => c.code).join(', ')}. They now appear on the mark sheet for each, `
        + 'and on the transcript once results are approved.',
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
