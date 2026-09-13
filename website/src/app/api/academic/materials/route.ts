// ---------------------------------------------------------------------------
// WHAT IS TAUGHT IN A COURSE — outline, outcomes, and the materials.
//
//   POST /api/academic/materials  { action, ... }
//
//   add     { courseId, offeringId, kind, week, title, body, url, visible }
//   set     { materialId, ...the same fields }
//   remove  { materialId }
//   show    { materialId, visible }        publish it, or take it back
//   course  { courseId, outline, learningOutcomes }
//
// ---------------------------------------------------------------------------
// WHOSE COURSE IS IT?
// ---------------------------------------------------------------------------
//
// A LECTURER MAY WRITE ON THEIR OWN COURSES AND NOBODY ELSE'S, which is a
// narrower rule than any capability expresses — `manage-courses` is about the
// catalogue, and every programme coordinator holds it.
//
// So the check is on the ROW, not on the role: either the caller holds
// `manage-courses` (the offices that run the catalogue), or they are the
// lecturer on the offering, or `courses.lecturer_id` names them. A lecturer
// with no offering yet still owns their catalogue course, for the same reason
// `my_teaching` reads both — until a term is set up, that column is the only
// record of who teaches what.
//
// The alternative — letting anybody with `manage-courses` post on any course —
// would mean a programme coordinator in Business could publish a reading list
// on a Theology course, which is not a permission anybody meant to grant.
// ---------------------------------------------------------------------------

import { NextResponse } from 'next/server';
import { guard, audit } from '@/lib/adminAuth';
import { can, type Capability } from '@/lib/roles';
import type { UserRole } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const bad = (error: string, status: number, detail?: string) =>
  NextResponse.json({ ok: false, error, ...(detail ? { detail } : {}) }, { status });

// NOT EXPORTED — Next.js route files export only handlers and runtime flags.
// EVERY CALLER NEEDS THIS ONE, and ownership is checked separately below. A
// lecturer holds it; so does the catalogue office.
const CAPABILITY: Capability = 'publish-course-material' as Capability;
const KINDS = ['outline', 'reading', 'note', 'slides', 'video', 'link',
  'recording', 'announcement'];
const ACTIONS = ['add', 'set', 'remove', 'show', 'course'];

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
      detail: 'Putting material on a course is done by the lecturer who teaches it, or by the '
        + 'offices that run the catalogue.',
    }, { status: g.status });
  }
  const { caller, admin } = g;

  // -------------------------------------------------------------------------
  // WHICH COURSE IS BEING WRITTEN ON, AND MAY THIS CALLER WRITE ON IT?
  // -------------------------------------------------------------------------
  const runsTheCatalogue = can(caller.role as UserRole, 'manage-courses' as Capability);

  /** The caller's own lecturer row, if they have one. Null for an office. */
  async function myLecturerId(): Promise<string | null> {
    // `auth_user_id`, NOT email. An email match returns nothing — silently —
    // for any lecturer whose sign-in address differs from their staff record,
    // and a refusal nobody can explain is worse than one that names a reason.
    const { data } = await admin.from('lecturers')
      .select('id').eq('auth_user_id', caller.id).maybeSingle();
    return ((data as Record<string, unknown> | null)?.id as string | null) ?? null;
  }

  async function mayWriteOn(courseId: string): Promise<string | null> {
    if (runsTheCatalogue) return null;
    const mine = await myLecturerId();
    if (!mine) {
      return 'Your account is not linked to a lecturer record, so there is no course of yours to '
        + 'write on. If you teach here and this is wrong, the Registry links the two.';
    }
    const [{ data: course }, { count }] = await Promise.all([
      admin.from('courses').select('lecturer_id').eq('id', courseId).maybeSingle(),
      admin.from('course_offerings').select('id', { count: 'exact', head: true })
        .eq('course_id', courseId).eq('lecturer_id', mine),
    ]);
    const owns = ((course as Record<string, unknown> | null)?.lecturer_id ?? null) === mine
      || (count ?? 0) > 0;
    return owns
      ? null
      : 'You are not the lecturer on this course. A lecturer may write on their own courses; '
        + 'changing another lecturer’s is the catalogue office’s.';
  }

  // =========================================================================
  // THE COURSE ITSELF — outline and learning outcomes
  // =========================================================================
  if (action === 'course') {
    const courseId = String(body.courseId ?? '');
    if (!courseId) return bad('no-course', 400);
    const refusal = await mayWriteOn(courseId);
    if (refusal) return bad('not-your-course', 403, refusal);

    const fields: Record<string, unknown> = {};
    if (body.outline !== undefined) {
      fields.outline = body.outline ? String(body.outline) : null;
    }
    if (body.learningOutcomes !== undefined) {
      fields.learning_outcomes = body.learningOutcomes ? String(body.learningOutcomes) : null;
    }
    if (Object.keys(fields).length === 0) {
      return bad('nothing-to-change', 400, 'Nothing was changed.');
    }

    const { error } = await admin.from('courses').update(fields).eq('id', courseId);
    if (error) return bad('course-failed', 500, error.message);
    await audit(admin, {
      action: 'course-outline-set', entityType: 'course', entityId: courseId,
      performedBy: caller.id, details: { changed: Object.keys(fields) },
    });
    return NextResponse.json({
      ok: true,
      detail: 'Saved. It is on the course itself, so it stands for every term the course runs — '
        + 'not only this one.',
    });
  }

  // =========================================================================
  // REMOVE / SHOW — both need the material first
  // =========================================================================
  if (action === 'remove' || action === 'show' || action === 'set') {
    const id = String(body.materialId ?? '');
    if (!id) return bad('no-material', 400);

    const { data: found } = await admin.from('course_materials')
      .select('id, course_id, title').eq('id', id).maybeSingle();
    const m = found as Record<string, unknown> | null;
    if (!m) return bad('material-not-found', 404);

    const refusal = await mayWriteOn(m.course_id as string);
    if (refusal) return bad('not-your-course', 403, refusal);

    if (action === 'remove') {
      const { error } = await admin.from('course_materials').delete().eq('id', id);
      if (error) return bad('remove-failed', 500, error.message);
      await audit(admin, {
        action: 'material-removed', entityType: 'course_material', entityId: id,
        performedBy: caller.id, details: { title: m.title },
      });
      return NextResponse.json({ ok: true, detail: 'Removed.' });
    }

    if (action === 'show') {
      const visible = body.visible !== false;
      const { error } = await admin.from('course_materials')
        .update({ visible, updated_at: new Date().toISOString() }).eq('id', id);
      if (error) return bad('show-failed', 500, error.message);
      await audit(admin, {
        action: visible ? 'material-published' : 'material-withheld',
        entityType: 'course_material', entityId: id, performedBy: caller.id,
      });
      return NextResponse.json({
        ok: true,
        detail: visible
          ? 'Published. Students on this course can see it now.'
          : 'Taken back. Students can no longer see it; nothing is deleted.',
      });
    }

    // ---- SET --------------------------------------------------------------
    const fields = materialFields(body, KINDS);
    if ('error' in fields) return bad('bad-field', 400, fields.error);
    if (Object.keys(fields.values).length === 0) {
      return bad('nothing-to-change', 400, 'Nothing was changed.');
    }
    const { error } = await admin.from('course_materials')
      .update({ ...fields.values, updated_at: new Date().toISOString() }).eq('id', id);
    if (error) return bad('set-failed', 409, error.message);
    await audit(admin, {
      action: 'material-revised', entityType: 'course_material', entityId: id,
      performedBy: caller.id, details: fields.values,
    });
    return NextResponse.json({ ok: true, detail: 'Saved.' });
  }

  // =========================================================================
  // ADD
  // =========================================================================
  const courseId = String(body.courseId ?? '');
  if (!courseId) return bad('no-course', 400);
  const refusal = await mayWriteOn(courseId);
  if (refusal) return bad('not-your-course', 403, refusal);

  const fields = materialFields(body, KINDS);
  if ('error' in fields) return bad('bad-field', 400, fields.error);

  const title = String(body.title ?? '').trim();
  if (!title) return bad('no-title', 400, 'A material needs a title — it is what a student clicks.');
  if (!body.body && !body.url) {
    // 068 refuses this with a constraint; this refuses it with a sentence.
    return bad('nothing-in-it', 400,
      'A material needs either something written in it or a link to open. A title on its own '
      + 'does nothing when clicked, and a student cannot tell it from a broken one.');
  }

  const { data, error } = await admin.from('course_materials').insert({
    course_id: courseId,
    offering_id: body.offeringId ? String(body.offeringId) : null,
    title,
    created_by: caller.id,
    ...fields.values,
  }).select('id').single();
  if (error) {
    // 068's trigger refuses a material whose offering is of another course, in
    // a sentence. It is passed through rather than replaced.
    return bad('add-failed', 409, error.message);
  }

  await audit(admin, {
    action: 'material-added', entityType: 'course_material', entityId: data.id as string,
    performedBy: caller.id, details: { course: courseId, title },
  });
  return NextResponse.json({
    ok: true,
    id: data.id,
    detail: body.offeringId
      ? 'Added to this term’s offering.'
      : 'Added to the course itself, so it stands for every term the course runs.',
  });
}

/**
 * The fields a material carries, validated once for add and for set.
 *
 * NOT EXPORTED — a route file may export only its handlers, so this lives
 * here rather than being shared. It is small enough that the duplication it
 * prevents is worth more than the sharing it forgoes.
 */
function materialFields(
  body: Record<string, unknown>,
  kinds: string[],
): { values: Record<string, unknown> } | { error: string } {
  const values: Record<string, unknown> = {};

  if (body.kind !== undefined) {
    const kind = String(body.kind);
    if (!kinds.includes(kind)) return { error: `A material is one of: ${kinds.join(', ')}.` };
    values.kind = kind;
  }
  if (body.title !== undefined) {
    const title = String(body.title).trim();
    if (!title) return { error: 'A material needs a title.' };
    values.title = title;
  }
  if (body.body !== undefined) values.body = body.body ? String(body.body) : null;
  if (body.url !== undefined) values.url = body.url ? String(body.url) : null;
  if (body.visible !== undefined) values.visible = body.visible !== false;
  if (body.week !== undefined) {
    // BLANK IS NOT WEEK ZERO. A reading list belongs to no week, and storing
    // it as week 0 would file it before the term began.
    const week = body.week === null || body.week === '' ? null : Number(body.week);
    if (week !== null && (!Number.isInteger(week) || week < 1 || week > 52)) {
      return { error: 'A teaching week is 1 to 52, or left blank for something that belongs to '
        + 'no particular week — a reading list, an outline.' };
    }
    values.week = week;
  }
  if (body.sortOrder !== undefined) values.sort_order = Number(body.sortOrder) || 0;

  return { values };
}
