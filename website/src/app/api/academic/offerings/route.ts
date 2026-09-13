// ---------------------------------------------------------------------------
// SETTING UP A TERM — offerings, classes and the rooms they meet in.
//
//   POST /api/academic/offerings  { action, ... }
//
//   offer     { courseId, academicYearId, termSequence, deliveryMode, campus,
//               lecturerId, maxEnrolment }
//   set       { offeringId, ...the same fields }        revise one
//   status    { offeringId, status }                    planned|open|closed|cancelled
//   schedule  { offeringId, code, lecturerId, roomId,
//               dayOfWeek, startsAt, endsAt, capacity }  add a class
//   reschedule{ sectionId, ...the slot }
//   unschedule{ sectionId }
//   room        { code, name, campus, kind, capacity }   record a room
//   room-set    { roomId, ...the same fields }            correct one
//   room-retire { roomId }                                take it out of use
//   room-restore{ roomId }                                bring it back
//
// ---------------------------------------------------------------------------
// WHY THE CLASH IS REPORTED AND NOT REFUSED
// ---------------------------------------------------------------------------
//
// A room double-booking is a mistake. It is not, however, always an error —
// a University rearranging a whole term will pass through states where two
// classes overlap for the ten minutes it takes to move the second one, and a
// system that refuses the first edit makes the second impossible.
//
// So `timetable_clashes` is computed and RETURNED with every scheduling
// change. The screen shows it immediately and loudly; nothing is silently
// accepted; and the person doing the work can still do the work.
//
// The rules that ARE refused are the ones no workflow needs: half a timetable
// slot, a class in a room that does not exist, an offering of a course in a
// term that does not exist. 063 enforces those in the database.
// ---------------------------------------------------------------------------

import { NextResponse } from 'next/server';
import { guard, audit } from '@/lib/adminAuth';
import type { Capability } from '@/lib/roles';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const bad = (error: string, status: number, detail?: string) =>
  NextResponse.json({ ok: false, error, ...(detail ? { detail } : {}) }, { status });

// NOT EXPORTED — Next.js route files export only handlers and runtime flags.
const CAPABILITY: Capability = 'manage-courses' as Capability;
const MODES = ['Campus', 'Online', 'Online / Campus'];
const STATUSES = ['planned', 'open', 'closed', 'cancelled'];
const ROOM_KINDS = ['room', 'lecture-hall', 'laboratory', 'studio', 'online'];
const ACTIONS = [
  'offer', 'set', 'status', 'schedule', 'reschedule', 'unschedule',
  'room', 'room-set', 'room-retire', 'room-restore',
];

/** The clashes a scheduling change caused or left behind, for the screen to show. */
async function clashesFor(
  admin: { from: (t: string) => any },
  sectionIds: string[],
): Promise<{ kind: string; detail: string }[]> {
  if (sectionIds.length === 0) return [];
  const { data } = await admin
    .from('timetable_clashes')
    .select('kind, detail, section_id')
    .in('section_id', sectionIds);
  return (data ?? []).map((c: Record<string, unknown>) => ({
    kind: String(c.kind), detail: String(c.detail),
  }));
}

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
      detail: 'Setting up a term is held by the offices that manage the course catalogue.',
    }, { status: g.status });
  }
  const { caller, admin } = g;

  const mode = body.deliveryMode ? String(body.deliveryMode) : null;
  if (mode && !MODES.includes(mode)) {
    // THE UNIVERSITY'S OWN THREE WORDS, and a fourth is refused rather than
    // stored. "Hybrid" and "Blended" mean the same thing to a reader and
    // nothing to a query that filters on 'Online / Campus'.
    return bad('bad-delivery-mode', 400, `Delivery is one of: ${MODES.join(', ')}.`);
  }

  // =========================================================================
  // ROOMS — recorded, corrected, retired, brought back
  // =========================================================================
  //
  // 064 seeds seventeen rooms and marks every one PROVISIONAL, because the
  // University asked for room numbers to be given and then edited. A seeded
  // room is a placeholder wearing a plausible code, and the one thing that
  // must not happen is for it to be mistaken for a surveyed fact.
  //
  // SO AN EDIT CLEARS THE FLAG, AUTOMATICALLY. A room somebody has opened,
  // looked at and corrected is no longer a placeholder — and nobody has to
  // remember to tick a box saying so. That is the whole mechanism; there is no
  // separate "confirm this room" action to forget.
  //
  // A ROOM IS RETIRED, NEVER DELETED. `class_sections.room_id` is ON DELETE
  // SET NULL, so deleting a room silently empties the room column of every
  // class ever taught in it — including last year's, which is a record of
  // where an examination was actually held. `active = false` takes it out of
  // every picker and leaves the history intact.
  if (action === 'room' || action === 'room-set') {
    const code = body.code === undefined ? null : String(body.code).trim();
    if (action === 'room' && !code) {
      return bad('no-code', 400, 'A room needs the code people call it by.');
    }
    if (code !== null && code.length === 0) {
      return bad('no-code', 400, 'A room cannot be renamed to nothing — a class needs somewhere '
        + 'to be, and a blank code on a timetable tells a student nothing.');
    }

    let capacity: number | null | undefined;
    if (body.capacity !== undefined) {
      capacity = body.capacity === null || body.capacity === '' ? null : Number(body.capacity);
      if (capacity !== null && (!Number.isInteger(capacity) || capacity <= 0)) {
        // BLANK IS NOT ZERO, here as everywhere. A room with no recorded
        // capacity holds an unknown number of people; one with a capacity of
        // zero holds nobody, and is not a room.
        return bad('bad-capacity', 400,
          'A capacity is a whole number above zero. Leave it blank if nobody has measured the '
          + 'room — blank means "not recorded", not "holds nobody".');
      }
    }

    const kind = body.kind === undefined ? undefined : String(body.kind);
    if (kind !== undefined && !ROOM_KINDS.includes(kind)) {
      return bad('bad-kind', 400, `A room is one of: ${ROOM_KINDS.join(', ')}.`);
    }

    const fields: Record<string, unknown> = {};
    if (code !== null) fields.code = code;
    if (body.name !== undefined) fields.name = body.name ? String(body.name) : null;
    if (body.campus !== undefined) fields.campus = body.campus ? String(body.campus) : null;
    if (kind !== undefined) fields.kind = kind;
    if (capacity !== undefined) fields.capacity = capacity;

    if (action === 'room-set') {
      const id = String(body.roomId ?? '');
      if (!id) return bad('no-room', 400);
      if (Object.keys(fields).length === 0) {
        return bad('nothing-to-change', 400, 'Nothing was changed.');
      }
      // THE EDIT IS WHAT CONFIRMS IT. See the note above.
      fields.provisional = false;
      const { error } = await admin.from('rooms').update(fields).eq('id', id);
      if (error) {
        return bad('room-failed', 409, /duplicate|unique/i.test(error.message)
          ? `Another room already has the code ${code}. Two rooms with one code means a `
            + 'timetable cannot say which one a class is in.'
          : error.message);
      }
      await audit(admin, {
        action: 'room-corrected', entityType: 'room', entityId: id,
        performedBy: caller.id, details: fields,
      });
      return NextResponse.json({ ok: true });
    }

    const { data, error } = await admin.from('rooms').insert({
      kind: 'room',
      ...fields,
      // A room somebody typed in is not provisional. Only a seeded one is.
      provisional: false,
    }).select('id').single();
    if (error) {
      return bad('room-failed', 409, /duplicate|unique/i.test(error.message)
        ? `A room with the code ${code} is already recorded.`
        : error.message);
    }
    await audit(admin, {
      action: 'room-recorded', entityType: 'room', entityId: data.id as string,
      performedBy: caller.id, details: { code },
    });
    return NextResponse.json({ ok: true, id: data.id });
  }

  if (action === 'room-retire' || action === 'room-restore') {
    const id = String(body.roomId ?? '');
    if (!id) return bad('no-room', 400);
    const retiring = action === 'room-retire';

    // RETIRING A ROOM THAT CLASSES ARE STILL IN IS NOT REFUSED — a building
    // closes mid-term and the classes have to move — but it is REPORTED, with
    // the count, because a room quietly leaving the picker while eleven
    // classes still meet in it is how a timetable rots.
    let stillUsed = 0;
    if (retiring) {
      const { count } = await admin
        .from('class_sections')
        .select('id', { count: 'exact', head: true })
        .eq('room_id', id);
      stillUsed = count ?? 0;
    }

    const { error } = await admin.from('rooms').update({ active: !retiring }).eq('id', id);
    if (error) return bad('room-failed', 500, error.message);
    await audit(admin, {
      action: retiring ? 'room-retired' : 'room-restored', entityType: 'room', entityId: id,
      performedBy: caller.id,
    });
    return NextResponse.json({
      ok: true,
      ...(stillUsed > 0 ? {
        warning: `${stillUsed} class${stillUsed === 1 ? '' : 'es'} still meet${stillUsed === 1 ? 's' : ''} `
          + 'in this room. It is out of the picker now, but those classes have not moved — they '
          + 'still say they are in here.',
      } : {}),
    });
  }

  // =========================================================================
  // OFFER / SET / STATUS
  // =========================================================================
  if (action === 'offer' || action === 'set') {
    const fields: Record<string, unknown> = {};
    if (mode) fields.delivery_mode = mode;
    if (body.campus !== undefined) fields.campus = body.campus ? String(body.campus) : null;
    if (body.language !== undefined) fields.language = body.language ? String(body.language) : null;
    if (body.lecturerId !== undefined) {
      fields.lecturer_id = body.lecturerId ? String(body.lecturerId) : null;
    }
    if (body.maxEnrolment !== undefined) {
      const max = body.maxEnrolment == null || body.maxEnrolment === ''
        ? null : Number(body.maxEnrolment);
      if (max !== null && (!Number.isInteger(max) || max <= 0)) {
        return bad('bad-capacity', 400,
          'A maximum enrolment is a whole number above zero. Leave it blank for no ceiling — '
          + 'blank is not zero.');
      }
      fields.max_enrolment = max;
    }

    if (action === 'set') {
      const id = String(body.offeringId ?? '');
      if (!id) return bad('no-offering', 400);
      const { error } = await admin.from('course_offerings').update(fields).eq('id', id);
      if (error) return bad('set-failed', 500, error.message);
      await audit(admin, {
        action: 'offering-revised', entityType: 'course_offering', entityId: id,
        performedBy: caller.id, details: fields,
      });
      return NextResponse.json({ ok: true });
    }

    const courseId = String(body.courseId ?? '');
    const yearId = String(body.academicYearId ?? '');
    const term = Number(body.termSequence ?? 0);
    if (!courseId || !yearId) return bad('no-course-or-year', 400);
    if (!Number.isInteger(term) || term < 1) return bad('no-term', 400);

    const { data, error } = await admin.from('course_offerings').insert({
      course_id: courseId,
      academic_year_id: yearId,
      term_sequence: term,
      ...fields,
    }).select('id').single();
    if (error) {
      // 063 allows one offering of a course per term. Said in a sentence here,
      // because "duplicate key value violates unique constraint" is not.
      return bad('offer-failed', 409, /duplicate|unique/i.test(error.message)
        ? 'This course is already offered in that term. Add a second CLASS to the existing '
          + 'offering rather than a second offering — two offerings is two capacities and two '
          + 'answers to "am I registered".'
        : error.message);
    }
    await audit(admin, {
      action: 'course-offered', entityType: 'course_offering', entityId: data.id as string,
      performedBy: caller.id, details: { course: courseId, term },
    });
    return NextResponse.json({ ok: true, id: data.id });
  }

  if (action === 'status') {
    const id = String(body.offeringId ?? '');
    const status = String(body.status ?? '');
    if (!id) return bad('no-offering', 400);
    if (!STATUSES.includes(status)) {
      return bad('bad-status', 400, `It is one of: ${STATUSES.join(', ')}.`);
    }

    // CLOSING AN OFFERING SOMEBODY IS REGISTERED ON IS NOT REFUSED — a term
    // closes with students on it, that is what closing means — but CANCELLING
    // one is different, and a cancellation over registered students leaves
    // them enrolled on something that will not run.
    if (status === 'cancelled') {
      const { count } = await admin
        .from('enrollments')
        .select('id', { count: 'exact', head: true })
        .eq('offering_id', id)
        .eq('status', 'registered');
      if ((count ?? 0) > 0) {
        return bad('students-are-registered', 409,
          `${count} student${count === 1 ? ' is' : 's are'} registered on this offering. `
          + 'Cancelling it would leave them enrolled on something that will not run — move them '
          + 'first.');
      }
    }

    const { error } = await admin.from('course_offerings').update({ status }).eq('id', id);
    if (error) return bad('status-failed', 500, error.message);
    await audit(admin, {
      action: 'offering-status', entityType: 'course_offering', entityId: id,
      performedBy: caller.id, details: { status },
    });
    return NextResponse.json({ ok: true });
  }

  // =========================================================================
  // SCHEDULE / RESCHEDULE / UNSCHEDULE
  // =========================================================================
  if (action === 'unschedule') {
    const id = String(body.sectionId ?? '');
    if (!id) return bad('no-section', 400);
    const { error } = await admin.from('class_sections').delete().eq('id', id);
    if (error) return bad('unschedule-failed', 500, error.message);
    await audit(admin, {
      action: 'class-removed', entityType: 'class_section', entityId: id,
      performedBy: caller.id,
    });
    return NextResponse.json({ ok: true });
  }

  // A SLOT IS A DAY AND TWO TIMES, OR NONE OF THEM. 063 refuses half a slot
  // with a constraint; this refuses it with a sentence.
  const day = body.dayOfWeek == null || body.dayOfWeek === '' ? null : Number(body.dayOfWeek);
  const from = body.startsAt ? String(body.startsAt) : null;
  const to = body.endsAt ? String(body.endsAt) : null;
  const given = [day, from, to].filter((v) => v !== null && v !== '').length;
  if (given !== 0 && given !== 3) {
    return bad('half-a-slot', 400,
      'A class is scheduled with a day AND a start AND an end, or with none of them. Half a slot '
      + 'cannot be drawn on a timetable and cannot be checked for a clash.');
  }
  if (day !== null && (!Number.isInteger(day) || day < 1 || day > 7)) {
    return bad('bad-day', 400, 'A day is 1 (Monday) to 7 (Sunday).');
  }
  if (from && to && to <= from) {
    return bad('backwards', 400, 'A class ends after it begins.');
  }

  const slot = {
    day_of_week: day,
    starts_at: from,
    ends_at: to,
    lecturer_id: body.lecturerId ? String(body.lecturerId) : null,
    room_id: body.roomId ? String(body.roomId) : null,
    capacity: body.capacity == null || body.capacity === '' ? null : Number(body.capacity),
    ...(body.deliveryMode !== undefined ? { delivery_mode: mode } : {}),
    ...(body.onlineLink !== undefined
      ? { online_link: body.onlineLink ? String(body.onlineLink) : null } : {}),
  };

  if (action === 'reschedule') {
    const id = String(body.sectionId ?? '');
    if (!id) return bad('no-section', 400);
    const { error } = await admin.from('class_sections').update(slot).eq('id', id);
    if (error) return bad('reschedule-failed', 500, error.message);
    await audit(admin, {
      action: 'class-rescheduled', entityType: 'class_section', entityId: id,
      performedBy: caller.id, details: slot,
    });
    // THE CLASHES COME BACK WITH THE ANSWER, so the screen can say so at once
    // rather than the reader discovering it on a later refresh.
    return NextResponse.json({ ok: true, clashes: await clashesFor(admin, [id]) });
  }

  const offeringId = String(body.offeringId ?? '');
  if (!offeringId) return bad('no-offering', 400);

  const { data, error } = await admin.from('class_sections').insert({
    offering_id: offeringId,
    code: body.code ? String(body.code) : 'A',
    ...slot,
  }).select('id').single();
  if (error) {
    return bad('schedule-failed', 409, /duplicate|unique/i.test(error.message)
      ? `This offering already has a class called ${String(body.code ?? 'A')}.`
      : error.message);
  }

  await audit(admin, {
    action: 'class-scheduled', entityType: 'class_section', entityId: data.id as string,
    performedBy: caller.id, details: { offering: offeringId, ...slot },
  });
  return NextResponse.json({
    ok: true, id: data.id, clashes: await clashesFor(admin, [data.id as string]),
  });
}
