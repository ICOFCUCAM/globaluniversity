// ---------------------------------------------------------------------------
// THE CURRICULUM BUILDER'S WRITES.
//
//   POST /api/academic/curriculum  { action, ... }
//
//   place   { versionId, courseId, year, semester, requirement, credits }
//   move    { entryId, year, semester }
//   reprice { entryId, credits }
//   remove  { entryId }
//
//   submit  { versionId }            send a draft for approval
//   approve { versionId }            sign it, as the office you hold
//   publish { versionId }            put an approved curriculum in force
//
// ---------------------------------------------------------------------------
// WHY A ROUTE AND NOT DIRECT WRITES FROM THE SCREEN
// ---------------------------------------------------------------------------
//
// 057 gives `curriculum_entries` no write policy at all. Every change comes
// through here, which checks the capability against the role in the DATABASE
// rather than anything the browser said about itself, and records who acted.
//
// The database still refuses independently. A curriculum freezes the moment it
// is approved, and the trigger that enforces that does not care whether the
// caller is this route or somebody with a connection string. This route is the
// courtesy; the trigger is the rule.
//
// ---------------------------------------------------------------------------
// THE REFUSALS THE SCREEN CANNOT MAKE FOR ITSELF
// ---------------------------------------------------------------------------
//
// A YEAR OR SEMESTER OUTSIDE THE PROGRAMME. A three-year programme with two
// semesters a year has six terms, and a course placed in year 4 is a course no
// student will ever be offered — it sits in the register looking like part of
// the curriculum and is unreachable from every registration screen.
//
// THE SAME COURSE TWICE. 057 refuses it with a unique index; this refuses it
// with a sentence, because "duplicate key value violates unique constraint" is
// not something to show somebody building a curriculum.
// ---------------------------------------------------------------------------

import { NextResponse } from 'next/server';
import { guard, audit } from '@/lib/adminAuth';
import type { Capability } from '@/lib/roles';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const bad = (error: string, status: number, detail?: string) =>
  NextResponse.json({ ok: false, error, ...(detail ? { detail } : {}) }, { status });

// NOT EXPORTED — a Next.js route file may export only its handlers and the
// runtime flags.
const REQUIREMENTS = ['core', 'elective', 'required-elective'];

// 'manage-courses' is what already governs the catalogue. Building a curriculum
// out of that catalogue is the same authority, and inventing a second
// capability would mean two answers to "who may shape what is taught".
const CAPABILITY: Capability = 'manage-courses' as Capability;

// A SINGLE STRING LITERAL. Concatenation makes supabase-js collapse the row
// type to GenericStringError[], silently.
const VERSION = 'id, programme_id, status, duration_years, semesters_per_year, total_credits';

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return bad('bad-json', 400); }

  const action = String(body.action ?? '');
  const BUILDING = ['place', 'move', 'reprice', 'remove'];
  const GOVERNING = ['submit', 'approve', 'publish'];
  if (![...BUILDING, ...GOVERNING].includes(action)) {
    return bad('unknown-action', 400, `They are: ${[...BUILDING, ...GOVERNING].join(', ')}.`);
  }

  // -------------------------------------------------------------------------
  // BUILDING AND GOVERNING ARE NOT THE SAME AUTHORITY.
  //
  // Shaping a curriculum is the course catalogue's authority. APPROVING one is
  // the University's academic standard, and 058 records which office must
  // sign — the Vice-Chancellor. A programme coordinator who may add a course
  // must not thereby be able to put the curriculum into force.
  //
  // This is also where sole authority stops. 055 lets the Vice-Chancellor
  // approve an appointment letter they drafted, because the appointing
  // authority is theirs. A curriculum is signed into a register that records
  // who signed and when, and 057 refuses to let that signature be edited or
  // deleted afterwards.
  // -------------------------------------------------------------------------
  const g = await guard(request,
    GOVERNING.includes(action) ? ('approve-credential-design' as Capability) : CAPABILITY);
  if (!g.ok) {
    return NextResponse.json({
      ok: false,
      error: g.error,
      detail: 'Building a curriculum is held by the offices that manage the course catalogue.',
    }, { status: g.status });
  }
  const { caller, admin } = g;

  // -------------------------------------------------------------------------
  // WHICH VERSION IS BEING EDITED, whichever action this is. `move`, `reprice`
  // and `remove` name an ENTRY, so the version is found through it — otherwise
  // the frozen check below could be skipped by editing an existing row.
  // -------------------------------------------------------------------------
  let versionId = body.versionId ? String(body.versionId) : '';
  let entry: Record<string, unknown> | null = null;

  // ONLY THE ACTIONS THAT NAME AN ENTRY. This read `action !== 'place'`, which
  // was right when the file held four actions and demanded an entryId from
  // submit, approve and publish the moment it held seven.
  if (['move', 'reprice', 'remove'].includes(action)) {
    const id = String(body.entryId ?? '');
    if (!id) return bad('no-entry', 400);
    const { data } = await admin
      .from('curriculum_entries')
      .select('id, programme_version_id, course_id, year, semester, credits')
      .eq('id', id)
      .maybeSingle();
    if (!data) return bad('not-found', 404);
    entry = data as Record<string, unknown>;
    versionId = String(entry.programme_version_id);
  }

  if (!versionId) return bad('no-version', 400);

  const { data: version } = await admin
    .from('programme_versions').select(VERSION).eq('id', versionId).maybeSingle();
  if (!version) return bad('no-such-version', 404);

  // -------------------------------------------------------------------------
  // A CURRICULUM THAT HAS BEEN APPROVED IS NOT EDITED.
  //
  // Said here in words because the trigger says it in an exception, and a
  // person building a curriculum should be told that a revision is a NEW
  // version rather than shown a constraint name.
  // -------------------------------------------------------------------------
  if (BUILDING.includes(action)
      && ['approved', 'published', 'superseded'].includes(String(version.status))) {
    return bad('curriculum-approved', 409,
      'This curriculum has been approved and cannot be changed — students are attached to it as '
      + 'it stands. Create a new version of the programme and revise that.');
  }

  const terms = Number(version.duration_years) * Number(version.semesters_per_year);

  // =========================================================================
  // SUBMIT / APPROVE / PUBLISH
  // =========================================================================
  if (GOVERNING.includes(action)) {
    if (action === 'submit') {
      if (String(version.status) !== 'draft') {
        return bad('not-a-draft', 409, 'Only a draft can be sent for approval.');
      }
      const { error } = await admin.from('programme_versions')
        .update({ status: 'board_review' }).eq('id', versionId);
      if (error) return bad('submit-failed', 500, error.message);
      await audit(admin, {
        action: 'curriculum-submitted',
        entityType: 'programme_version',
        entityId: versionId,
        performedBy: caller.id,
      });
      return NextResponse.json({ ok: true });
    }

    if (action === 'approve') {
      // ---------------------------------------------------------------------
      // THE OFFICE, NOT THE PERSON. 058 records which offices must sign a
      // curriculum; the caller signs as the office they hold and no other. A
      // Registrar signing in good faith must not satisfy a requirement the
      // University placed on the Vice-Chancellor.
      // ---------------------------------------------------------------------
      const { data: required } = await admin
        .from('academic_approval_requirements')
        .select('office')
        .eq('subject', 'curriculum');

      const offices = (required ?? []).map((r) => String(r.office));
      if (offices.length === 0) {
        return bad('no-approving-body', 409,
          'The University has not recorded which offices must approve a curriculum, so this one '
          + 'cannot be approved by anybody. That is set once, in academic_approval_requirements.');
      }
      if (!offices.includes(String(caller.role))) {
        return bad('not-your-signature', 403,
          `A curriculum is approved by ${offices.join(' and ')}. Your office does not sign one.`);
      }

      const { error: signErr } = await admin.from('academic_approvals').insert({
        subject: 'curriculum',
        subject_id: versionId,
        office: caller.role,
        decision: 'approved',
        decided_by: caller.id,
      });
      // A SIGNATURE IS NOT GIVEN TWICE. 057's unique key refuses it; this says so.
      if (signErr && !/duplicate|unique/i.test(signErr.message)) {
        return bad('sign-failed', 500, signErr.message);
      }

      // AND THEN THE QUORUM IS COUNTED BY THE DATABASE, not here. The trigger
      // names whoever has still to sign, so a partial quorum reports itself.
      const { error } = await admin.from('programme_versions')
        .update({ status: 'approved', approved_at: new Date().toISOString() })
        .eq('id', versionId);
      if (error) {
        return NextResponse.json({
          ok: true, signed: true, approved: false, detail: error.message,
        });
      }

      await audit(admin, {
        action: 'curriculum-approved',
        entityType: 'programme_version',
        entityId: versionId,
        performedBy: caller.id,
        details: { office: caller.role },
      });
      return NextResponse.json({ ok: true, signed: true, approved: true });
    }

    // PUBLISH — an approved curriculum comes into force. 057 allows one
    // published version per programme, so this supersedes nothing silently:
    // it is refused while another is in force.
    if (String(version.status) !== 'approved') {
      return bad('not-approved', 409,
        'A curriculum comes into force only after it has been approved.');
    }
    const { error } = await admin.from('programme_versions')
      .update({ status: 'published', published_at: new Date().toISOString() })
      .eq('id', versionId);
    if (error) {
      return bad('publish-failed', 409,
        'Another version of this programme is already in force. Supersede it first — two '
        + 'curricula in force is two answers to what a student must do to graduate.');
    }
    await audit(admin, {
      action: 'curriculum-published',
      entityType: 'programme_version',
      entityId: versionId,
      performedBy: caller.id,
    });
    return NextResponse.json({ ok: true });
  }

  // =========================================================================
  // PLACE — a course into a year and semester
  // =========================================================================
  if (action === 'place') {
    const courseId = String(body.courseId ?? '');
    const year = Number(body.year ?? 0);
    const semester = Number(body.semester ?? 0);
    const requirement = String(body.requirement ?? 'core');
    const credits = body.credits == null ? null : Number(body.credits);

    if (!courseId) return bad('no-course', 400);
    if (!REQUIREMENTS.includes(requirement)) {
      return bad('bad-requirement', 400, `It is one of: ${REQUIREMENTS.join(', ')}.`);
    }

    const out = outsideTheProgramme(year, semester, version, terms);
    if (out) return bad('outside-the-programme', 400, out);

    if (credits !== null && (!Number.isInteger(credits) || credits <= 0)) {
      return bad('bad-credits', 400, 'A credit value is a whole number above zero.');
    }

    // ALREADY THERE — refused with a sentence rather than a constraint name.
    const { data: already } = await admin
      .from('curriculum_entries')
      .select('id, year, semester')
      .eq('programme_version_id', versionId)
      .eq('course_id', courseId)
      .maybeSingle();
    if (already) {
      return bad('already-in-this-curriculum', 409,
        `This course is already in the curriculum, in year ${already.year} semester `
        + `${already.semester}. A course appears once: move it rather than adding it again, or `
        + 'the credits count twice.');
    }

    const { data: made, error } = await admin
      .from('curriculum_entries')
      .insert({
        programme_version_id: versionId,
        course_id: courseId,
        year,
        semester,
        requirement,
        credits,
      })
      .select('id')
      .single();
    if (error) return bad('place-failed', 500, error.message);

    await audit(admin, {
      action: 'curriculum-course-placed',
      entityType: 'programme_version',
      entityId: versionId,
      performedBy: caller.id,
      details: { course: courseId, year, semester, requirement, credits },
    });
    return NextResponse.json({ ok: true, id: made.id });
  }

  // =========================================================================
  // MOVE — the same course, a different term
  // =========================================================================
  if (action === 'move') {
    const year = Number(body.year ?? 0);
    const semester = Number(body.semester ?? 0);
    const out = outsideTheProgramme(year, semester, version, terms);
    if (out) return bad('outside-the-programme', 400, out);

    const { error } = await admin
      .from('curriculum_entries').update({ year, semester }).eq('id', entry!.id as string);
    if (error) return bad('move-failed', 500, error.message);

    await audit(admin, {
      action: 'curriculum-course-moved',
      entityType: 'programme_version',
      entityId: versionId,
      performedBy: caller.id,
      details: { entry: entry!.id, from: { year: entry!.year, semester: entry!.semester },
        to: { year, semester } },
    });
    return NextResponse.json({ ok: true });
  }

  // =========================================================================
  // REPRICE — what this programme counts the course as
  // =========================================================================
  if (action === 'reprice') {
    const credits = body.credits == null ? null : Number(body.credits);
    if (credits !== null && (!Number.isInteger(credits) || credits <= 0)) {
      return bad('bad-credits', 400, 'A credit value is a whole number above zero.');
    }

    const { error } = await admin
      .from('curriculum_entries').update({ credits }).eq('id', entry!.id as string);
    if (error) return bad('reprice-failed', 500, error.message);

    await audit(admin, {
      action: 'curriculum-course-repriced',
      entityType: 'programme_version',
      entityId: versionId,
      performedBy: caller.id,
      details: { entry: entry!.id, from: entry!.credits, to: credits },
    });
    return NextResponse.json({ ok: true });
  }

  // =========================================================================
  // REMOVE
  // =========================================================================
  const { error } = await admin
    .from('curriculum_entries').delete().eq('id', entry!.id as string);
  if (error) return bad('remove-failed', 500, error.message);

  await audit(admin, {
    action: 'curriculum-course-removed',
    entityType: 'programme_version',
    entityId: versionId,
    performedBy: caller.id,
    details: { course: entry!.course_id, year: entry!.year, semester: entry!.semester },
  });
  return NextResponse.json({ ok: true });
}

/**
 * Whether a term exists in this programme at all.
 *
 * Returns the sentence to show, or null when the placement is fine. A course in
 * year 4 of a three-year degree is not a mistake the database catches — year 4
 * is a perfectly valid integer — and it produces a curriculum entry no
 * registration screen will ever offer, because no student reaches year 4.
 */
function outsideTheProgramme(
  year: number,
  semester: number,
  version: Record<string, unknown>,
  terms: number,
): string | null {
  const years = Number(version.duration_years);
  const per = Number(version.semesters_per_year);
  if (!Number.isInteger(year) || year < 1 || year > years) {
    return `This programme runs ${years} year${years === 1 ? '' : 's'}, so there is no year `
      + `${year} to place a course in.`;
  }
  if (!Number.isInteger(semester) || semester < 1 || semester > per) {
    return `This programme has ${per} semester${per === 1 ? '' : 's'} a year, so there is no `
      + `semester ${semester}.`;
  }
  if (terms < 1) return 'This programme has no terms recorded, so nothing can be placed in it.';
  return null;
}
