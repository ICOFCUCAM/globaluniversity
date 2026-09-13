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
];

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
