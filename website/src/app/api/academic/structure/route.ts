// ---------------------------------------------------------------------------
// THE TOP OF THE TREE — schools, faculties and departments.
//
//   POST /api/academic/structure  { action, ... }
//
//   school-add    { code, name, mission }
//   school-set    { schoolId, name, mission }
//   school-status { schoolId, status }        active|suspended|archived
//   dept-add      { name, code, schoolId, headName }
//   dept-set      { departmentId, name, code, schoolId, headName }
//   dept-status   { departmentId, status }
//
// ---------------------------------------------------------------------------
// WHY THIS EXISTS
// ---------------------------------------------------------------------------
//
// The University drew the tree itself:
//
//   University → School / Faculty → Department → Study Programme →
//   Curriculum → Course → Offering → Class → Registration
//
// Everything from Study Programme down has a screen. The top two did not —
// `schools` was seeded by 060 and written by nothing, and `departments` has
// existed since 001 with no way to create one. So the University could see the
// forty-one programmes and not the five schools they hang from.
//
// ---------------------------------------------------------------------------
// A SCHOOL IS ARCHIVED, NEVER DELETED
// ---------------------------------------------------------------------------
//
// A department is where a lecturer, a course and a programme all hang from,
// and 057's foreign keys are ON DELETE RESTRICT for exactly that reason.
// Deleting one would either fail with a constraint error nobody can read, or —
// worse, if somebody ever loosened it — quietly detach every programme that
// belonged to it.
//
// Archiving says the same thing without destroying the record of what the
// University used to teach, which is a thing a graduate's transcript refers to
// for the rest of their life.
// ---------------------------------------------------------------------------

import { NextResponse } from 'next/server';
import { guard, audit } from '@/lib/adminAuth';
import type { Capability } from '@/lib/roles';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const bad = (error: string, status: number, detail?: string) =>
  NextResponse.json({ ok: false, error, ...(detail ? { detail } : {}) }, { status });

// NOT EXPORTED — Next.js route files export only handlers and runtime flags.
const CAPABILITY: Capability = 'manage-academic-structure' as Capability;
const STATUSES = ['active', 'suspended', 'archived'];
const ACTIONS = [
  'school-add', 'school-set', 'school-status',
  'dept-add', 'dept-set', 'dept-status',
  // THE LEVEL THAT WAS MISSING. Schools and departments could be created and
  // the thing they exist to hold could not — see the note on the handler.
  'programme-add', 'programme-status',
];

/** `programmes.award_level`, which the database constrains to exactly these. */
const AWARD_LEVELS = ['Certificate', 'Diploma', "Bachelor's", 'Postgraduate Diploma',
  "Master's", 'Doctorate'];

/**
 * How long each award runs, and what it is worth, where the University has
 * ruled on it.
 *
 * NOT INVENTED HERE — these are the University's own rulings, already applied
 * by migration 072 to the twelve programmes that had no credit total. They are
 * OFFERED as the starting figures on a new programme and every one of them can
 * be overridden on the form; a Doctorate that runs three years is typed as
 * three.
 */
const SHAPE: Record<string, { years: number; credits: number }> = {
  Certificate: { years: 1, credits: 60 },
  Diploma: { years: 1, credits: 120 },
  "Bachelor's": { years: 3, credits: 180 },
  'Postgraduate Diploma': { years: 1, credits: 120 },
  "Master's": { years: 2, credits: 120 },
  Doctorate: { years: 2, credits: 120 },
};

// 060's own pattern. A school code is a slug because it appears in a URL and
// in a programme code, and 'Faculty of Theology' does not.
const CODE = /^[a-z][a-z0-9-]{1,31}$/;

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
      detail: 'Creating a School or a Department is closer to a constitutional change than to '
        + 'running a term. It is held by the Registry and the Head of Academic Affairs.',
    }, { status: g.status });
  }
  const { caller, admin } = g;

  const status = body.status ? String(body.status) : null;
  if (status && !STATUSES.includes(status)) {
    return bad('bad-status', 400, `It is one of: ${STATUSES.join(', ')}.`);
  }

  // =========================================================================
  // PROGRAMMES
  // =========================================================================
  //
  // ---------------------------------------------------------------------
  // THE LEVEL THAT COULD NOT BE CREATED
  // ---------------------------------------------------------------------
  //
  // An audit found it: this route could create a School and a Department, and
  // nothing anywhere in the portal could create the thing they exist to hold.
  // The University's forty-one programmes were seeded by migration 060, and a
  // forty-second meant writing SQL.
  //
  // It was invisible because no screen READ `programmes` by name — every one
  // went through `programme_in_force` or `curriculum_progress` — so the
  // reachability test, which asks whether anything can write what something
  // reads, had nothing to ask about.
  //
  // ---------------------------------------------------------------------
  // AND IT CREATES THE FIRST VERSION IN THE SAME ACT
  // ---------------------------------------------------------------------
  //
  // A programme with no version cannot be taught, timetabled, registered for
  // or examined. The Academic overview already counts them — "38 programmes
  // with no curriculum at all" — and creating a forty-second of those would be
  // adding to a problem rather than closing one.
  //
  // So one act writes both: the programme, and a DRAFT version carrying the
  // duration and credit total. The curriculum still has to be written, which
  // is the Curriculum Builder's job and cannot be done from here — but the
  // shape is there for it to be written into.
  if (action === 'programme-add') {
    const code = String(body.code ?? '').trim().toLowerCase();
    if (!CODE.test(code)) {
      return bad('bad-code', 400,
        'A programme code is a slug: lower case, digits and hyphens, starting with a letter — '
        + 'like `master-of-divinity`. It appears in the address of the programme’s page.');
    }

    const name = String(body.name ?? '').trim();
    if (name.length < 3) {
      return bad('no-name', 400, 'A programme needs the name it is awarded under.');
    }

    const awardLevel = String(body.awardLevel ?? '');
    if (!AWARD_LEVELS.includes(awardLevel)) {
      return bad('bad-award-level', 400, `It is one of: ${AWARD_LEVELS.join(', ')}.`);
    }

    const shape = SHAPE[awardLevel];
    const durationYears = Number(body.durationYears ?? shape.years);
    const semestersPerYear = Number(body.semestersPerYear ?? 2);
    const totalCredits = body.totalCredits === null || body.totalCredits === ''
      ? null : Number(body.totalCredits ?? shape.credits);

    if (!Number.isInteger(durationYears) || durationYears < 1 || durationYears > 10) {
      return bad('bad-duration', 400, 'A programme runs between one and ten years.');
    }
    if (!Number.isInteger(semestersPerYear) || semestersPerYear < 1 || semestersPerYear > 3) {
      return bad('bad-semesters', 400, 'A year has one, two or three semesters.');
    }
    if (totalCredits !== null && (!Number.isInteger(totalCredits) || totalCredits < 1)) {
      return bad('bad-credits', 400,
        'A credit total is a whole number above zero. Leave it blank if the University has not '
        + 'decided — blank means "not decided", and a zero would mean the award requires '
        + 'nothing.');
    }

    const sessionLabel = String(body.sessionLabel ?? '').trim();
    if (sessionLabel.length < 4) {
      return bad('no-session', 400,
        'Say which session this version takes effect from — "2026/2027".');
    }

    // ---- THE PROGRAMME -------------------------------------------------
    const { data: prog, error: progErr } = await admin.from('programmes').insert({
      code,
      award_level: awardLevel,
      ...(body.awardId ? { award_id: String(body.awardId) } : {}),
      // DRAFT, LIKE EVERYTHING ELSE THE UNIVERSITY CREATES. 023 seeds every
      // programme closed for admission on purpose; a new one opening itself
      // would undo that in the one place nobody would look.
      status: 'draft',
      created_by: caller.id,
    }).select('id').single();

    if (progErr || !prog) {
      return bad('not-created', 409, /duplicate|unique/i.test(progErr?.message ?? '')
        ? `A programme with the code ${code} already exists.`
        : (progErr?.message ?? 'The programme was not created.'));
    }

    // ---- AND ITS FIRST VERSION -----------------------------------------
    const { error: verErr } = await admin.from('programme_versions').insert({
      programme_id: prog.id as string,
      version_label: sessionLabel,
      name,
      duration_years: durationYears,
      semesters_per_year: semestersPerYear,
      total_credits: totalCredits,
      effective_from: new Date().toISOString().slice(0, 10),
      status: 'draft',
      ...(body.schoolId ? { school_id: String(body.schoolId) } : {}),
      ...(body.departmentId ? { department_id: String(body.departmentId) } : {}),
      drafted_by: caller.id,
    });

    if (verErr) {
      // THE PROGRAMME IS LEFT STANDING rather than rolled back by hand. It is
      // a real row the University now has, the register shows it, and a
      // version can be added to it — whereas deleting it here would discard
      // something that succeeded because something after it failed.
      await audit(admin, {
        action: 'programme-created-without-version', entityType: 'programme',
        entityId: prog.id as string, performedBy: caller.id,
        details: { code, error: verErr.message },
      });
      return NextResponse.json({
        ok: true,
        id: prog.id,
        versionFailed: true,
        detail: `The programme ${code} was created, but its first version was not: `
          + `${verErr.message}. Add a version from the Programme register before it can be `
          + 'taught.',
      });
    }

    await audit(admin, {
      action: 'programme-created', entityType: 'programme', entityId: prog.id as string,
      performedBy: caller.id,
      details: { code, name, awardLevel, durationYears, semestersPerYear, totalCredits },
    });
    return NextResponse.json({
      ok: true,
      id: prog.id,
      detail: `${name} was created as a draft, with a ${sessionLabel} version of `
        + `${durationYears} year${durationYears === 1 ? '' : 's'}. Write its curriculum in the `
        + 'Curriculum builder — until there are courses in it, nothing can be registered '
        + 'against it.',
    });
  }

  if (action === 'programme-status') {
    const id = String(body.programmeId ?? '');
    if (!id) return bad('no-programme', 400);
    const to = String(body.status ?? '');
    const PROGRAMME_STATUSES = ['draft', 'under_review', 'approved', 'open_for_admission',
      'active', 'suspended', 'archived'];
    if (!PROGRAMME_STATUSES.includes(to)) {
      return bad('bad-status', 400, `It is one of: ${PROGRAMME_STATUSES.join(', ')}.`);
    }
    const { error } = await admin.from('programmes').update({ status: to }).eq('id', id);
    if (error) return bad('not-changed', 409, error.message);
    await audit(admin, {
      action: 'programme-status-changed', entityType: 'programme', entityId: id,
      performedBy: caller.id, details: { status: to },
    });
    return NextResponse.json({ ok: true });
  }

  // =========================================================================
  // SCHOOLS
  // =========================================================================
  if (action === 'school-add' || action === 'school-set') {
    const name = body.name === undefined ? null : String(body.name).trim();
    if (name !== null && name.length < 4) {
      // 060's own constraint. Said as a sentence here because
      // 'violates check constraint "schools_name_check"' is not one.
      return bad('name-too-short', 400,
        'A school’s name is at least four characters. It is printed on a programme page and on '
        + 'a transcript.');
    }

    const fields: Record<string, unknown> = {};
    if (name !== null) fields.name = name;
    if (body.mission !== undefined) fields.mission = body.mission ? String(body.mission) : null;

    if (action === 'school-set') {
      const id = String(body.schoolId ?? '');
      if (!id) return bad('no-school', 400);
      if (Object.keys(fields).length === 0) {
        return bad('nothing-to-change', 400, 'Nothing was changed.');
      }
      // THE CODE IS NOT EDITABLE, and that is deliberate. Programme codes and
      // URLs are built from it; changing it after a programme has been
      // published breaks every link to that programme and every reference on a
      // document already issued.
      const { error } = await admin.from('schools').update(fields).eq('id', id);
      if (error) return bad('school-failed', 500, error.message);
      await audit(admin, {
        action: 'school-revised', entityType: 'school', entityId: id,
        performedBy: caller.id, details: fields,
      });
      return NextResponse.json({ ok: true, detail: 'Saved.' });
    }

    const code = String(body.code ?? '').trim().toLowerCase();
    if (!CODE.test(code)) {
      return bad('bad-code', 400,
        'A school code is lowercase letters, digits and hyphens, starting with a letter — '
        + '"theology", "global-business". It appears in programme codes and in URLs, which is '
        + 'why it is not the full name.');
    }
    if (!name) return bad('no-name', 400, 'A school needs its full name.');

    const { data, error } = await admin.from('schools')
      .insert({ code, ...fields, status: 'active' }).select('id').single();
    if (error) {
      return bad('school-failed', 409, /duplicate|unique/i.test(error.message)
        ? `A school with the code ${code} already exists.`
        : error.message);
    }
    await audit(admin, {
      action: 'school-created', entityType: 'school', entityId: data.id as string,
      performedBy: caller.id, details: { code, name },
    });
    return NextResponse.json({ ok: true, id: data.id, detail: `${name} created.` });
  }

  if (action === 'school-status') {
    const id = String(body.schoolId ?? '');
    if (!id || !status) return bad('no-school-or-status', 400);

    // ARCHIVING A SCHOOL THAT STILL HAS PROGRAMMES IS NOT REFUSED — a faculty
    // closes and its programmes are taught out over three years — but it is
    // REPORTED with the count, because a school leaving the pickers while
    // eleven programmes still belong to it is how a tree comes to disagree
    // with itself.
    let stillUsed = 0;
    if (status === 'archived') {
      const { count } = await admin
        .from('programme_versions')
        .select('id', { count: 'exact', head: true })
        .eq('school_id', id);
      stillUsed = count ?? 0;
    }

    const { error } = await admin.from('schools').update({ status }).eq('id', id);
    if (error) return bad('school-failed', 500, error.message);
    await audit(admin, {
      action: 'school-status', entityType: 'school', entityId: id,
      performedBy: caller.id, details: { status },
    });
    return NextResponse.json({
      ok: true,
      detail: `The school is now ${status}.`,
      ...(stillUsed > 0 ? {
        warning: `${stillUsed} programme version${stillUsed === 1 ? '' : 's'} still belong${stillUsed === 1 ? 's' : ''} `
          + 'to this school. Archiving it does not move them — they still name it, and students '
          + 'reading them are still reading them.',
      } : {}),
    });
  }

  // =========================================================================
  // DEPARTMENTS
  // =========================================================================
  if (action === 'dept-add' || action === 'dept-set') {
    const name = body.name === undefined ? null : String(body.name).trim();
    if (name !== null && name.length < 3) {
      return bad('no-name', 400, 'A department needs a name.');
    }

    const fields: Record<string, unknown> = {};
    if (name !== null) fields.name = name;
    if (body.code !== undefined) fields.code = String(body.code).trim().toUpperCase();
    if (body.schoolId !== undefined) {
      fields.school_id = body.schoolId ? String(body.schoolId) : null;
    }
    if (body.headName !== undefined) {
      fields.head_name = body.headName ? String(body.headName) : null;
    }

    if (action === 'dept-set') {
      const id = String(body.departmentId ?? '');
      if (!id) return bad('no-department', 400);
      if (Object.keys(fields).length === 0) {
        return bad('nothing-to-change', 400, 'Nothing was changed.');
      }
      const { error } = await admin.from('departments').update(fields).eq('id', id);
      if (error) {
        return bad('dept-failed', 409, /duplicate|unique/i.test(error.message)
          ? 'Another department already has that code.'
          : error.message);
      }
      await audit(admin, {
        action: 'department-revised', entityType: 'department', entityId: id,
        performedBy: caller.id, details: fields,
      });
      return NextResponse.json({ ok: true, detail: 'Saved.' });
    }

    if (!name) return bad('no-name', 400, 'A department needs a name.');
    if (!fields.code) return bad('no-code', 400, 'A department needs a short code.');

    // `faculty` IS STILL NOT NULL ON THIS TABLE. 001 created it as free text
    // and 057 added `school_id` beside it rather than dropping it — live rows
    // carry a faculty name that nothing else can resolve. It is filled from
    // the school so the two cannot disagree, rather than asked for twice.
    let facultyName = 'Unassigned';
    if (fields.school_id) {
      const { data: school } = await admin.from('schools')
        .select('name').eq('id', fields.school_id as string).maybeSingle();
      if (school) facultyName = String((school as Record<string, unknown>).name);
    }

    const { data, error } = await admin.from('departments').insert({
      ...fields,
      faculty: facultyName,
      head_name: fields.head_name ?? '',
      status: 'active',
    }).select('id').single();
    if (error) {
      return bad('dept-failed', 409, /duplicate|unique/i.test(error.message)
        ? `A department with the code ${fields.code} already exists.`
        : error.message);
    }
    await audit(admin, {
      action: 'department-created', entityType: 'department', entityId: data.id as string,
      performedBy: caller.id, details: { name, code: fields.code },
    });
    return NextResponse.json({ ok: true, id: data.id, detail: `${name} created.` });
  }

  if (action === 'dept-status') {
    const id = String(body.departmentId ?? '');
    if (!id || !status) return bad('no-department-or-status', 400);

    // THE SAME REPORT AS A SCHOOL, over the three things that hang off a
    // department: its lecturers, its courses and its students.
    let lecturers = 0;
    let courses = 0;
    let students = 0;
    if (status === 'archived') {
      const [l, c, s] = await Promise.all([
        admin.from('lecturers').select('id', { count: 'exact', head: true })
          .eq('department_id', id),
        admin.from('courses').select('id', { count: 'exact', head: true })
          .eq('department_id', id),
        admin.from('students').select('id', { count: 'exact', head: true })
          .eq('department_id', id),
      ]);
      lecturers = l.count ?? 0;
      courses = c.count ?? 0;
      students = s.count ?? 0;
    }

    const { error } = await admin.from('departments').update({ status }).eq('id', id);
    if (error) return bad('dept-failed', 500, error.message);
    await audit(admin, {
      action: 'department-status', entityType: 'department', entityId: id,
      performedBy: caller.id, details: { status },
    });

    const attached = [
      lecturers > 0 ? `${lecturers} lecturer${lecturers === 1 ? '' : 's'}` : null,
      courses > 0 ? `${courses} course${courses === 1 ? '' : 's'}` : null,
      students > 0 ? `${students} student${students === 1 ? '' : 's'}` : null,
    ].filter(Boolean);

    return NextResponse.json({
      ok: true,
      detail: `The department is now ${status}.`,
      ...(attached.length > 0 ? {
        warning: `${attached.join(', ')} still belong to this department. Archiving it does not `
          + 'move them — it is not deleted, and nothing that names it has changed.',
      } : {}),
    });
  }

  return bad('unknown-action', 400);
}
