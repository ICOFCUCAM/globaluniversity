'use client';

// ---------------------------------------------------------------------------
// COURSE OFFERINGS — setting up a term.
//
// ---------------------------------------------------------------------------
// THE DISTINCTION THE UNIVERSITY DREW
// ---------------------------------------------------------------------------
//
// "Separate Course from Course Offering from Class from Student Registration."
//
// A COURSE is what the catalogue describes — BIS 220, three credits, these
// prerequisites. It is true in every year and belongs to no term.
//
// An OFFERING is that course actually running: in 2026/2027, semester 1, on
// campus, taught by a named lecturer, with a ceiling on how many may take it.
//
// A CLASS is a group inside the offering meeting at an hour in a room. One
// offering may have three; a small one has one.
//
// A REGISTRATION is a student attached to an offering, and — where there is a
// choice — to a class.
//
// Before 063 the middle two did not exist, so all four questions collapsed
// into the first: "who teaches BIS 220" had no answer that could differ
// between years, and "how many places are left" had no place to be asked. This
// screen is where the middle two are filled in.
//
// ---------------------------------------------------------------------------
// A CLASH IS SHOWN, NOT REFUSED
// ---------------------------------------------------------------------------
//
// See the route's header. A University rearranging a whole term passes through
// states where two classes overlap for the ten minutes it takes to move the
// second one. Refusing the first edit makes the second impossible. So every
// scheduling change comes back with `timetable_clashes` attached and the
// screen says so at once, loudly, beside the class that caused it.
// ---------------------------------------------------------------------------

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { authedPost } from '@/lib/authedFetch';
import { can } from '@/lib/roles';
import { useAuth } from '@/contexts/AuthContext';
import {
  Card, EmptyState, PageHeader, SkeletonRows,
} from '@/components/ui/portal';
import {
  Plus, X, AlertTriangle, CalendarClock, MapPin, Users, Clock,
} from 'lucide-react';
import { within } from './ProgrammeRegister';

// SINGLE STRING LITERALS. Concatenation collapses the supabase-js row type to
// GenericStringError[] — silently, with no error at the call site.
// eslint-disable-next-line max-len
const ROLL = 'offering_id, course_code, course_title, credit_unit, year_label, starts_in, term_sequence, delivery_mode, campus, status, max_enrolment, lecturer, classes, registered, places_left';
const OFFERING = 'id, course_id, academic_year_id, term_sequence, status, delivery_mode, campus, max_enrolment, lecturer_id';
const SECTION = 'id, offering_id, code, lecturer_id, room_id, day_of_week, starts_at, ends_at, delivery_mode, online_link, capacity';
const CLASH = 'kind, section_id, clashes_with, detail, day_of_week, starts_at, ends_at';
const YEAR = 'id, label, starts_in, status';
const COURSE = 'id, code, title, credit_unit';
const ROOM = 'id, code, name, campus, kind, capacity, active';
const LECTURER = 'id, first_name, last_name, staff_id';

const DAYS = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const MODES = ['Campus', 'Online', 'Online / Campus'];
const STATUSES = ['planned', 'open', 'closed', 'cancelled'];

// WHAT EACH STATUS MEANS TO A STUDENT, which is the only reason it is set.
const STATUS_MEANS: Record<string, string> = {
  planned: 'Being set up. Nobody can register.',
  open: 'Registration is open.',
  closed: 'Registration has closed. Those already on it stay on it.',
  cancelled: 'Not running.',
};

interface Roll {
  offering_id: string; course_code: string; course_title: string; credit_unit: number;
  year_label: string; starts_in: number; term_sequence: number;
  delivery_mode: string; campus: string | null; status: string;
  max_enrolment: number | null; lecturer: string | null;
  classes: number; registered: number; places_left: number | null;
}
interface Offering {
  id: string; course_id: string; academic_year_id: string; term_sequence: number;
  status: string; delivery_mode: string; campus: string | null;
  max_enrolment: number | null; lecturer_id: string | null;
}
interface Section {
  id: string; offering_id: string; code: string;
  lecturer_id: string | null; room_id: string | null;
  day_of_week: number | null; starts_at: string | null; ends_at: string | null;
  delivery_mode: string | null; online_link: string | null; capacity: number | null;
}
interface Clash {
  kind: string; section_id: string; clashes_with: string; detail: string;
  day_of_week: number; starts_at: string; ends_at: string;
}
interface Year { id: string; label: string; starts_in: number; status: string; }
interface Course { id: string; code: string; title: string; credit_unit: number; }
interface Room {
  id: string; code: string; name: string | null; campus: string | null;
  kind: string; capacity: number | null; active: boolean;
}
interface Lecturer { id: string; first_name: string; last_name: string; staff_id: string; }

/** '09:00:00' as the University writes it. */
const hhmm = (t: string | null) => (t ? t.slice(0, 5) : '');

export default function CourseOfferings() {
  const { user } = useAuth();
  // THE CANONICAL ALLOCATION PERMISSION, and this screen is where it is spent.
  //
  // This read `manage-courses` — the CATALOGUE permission, which is what BIS
  // 220 *is*. The University drew the distinction itself: "separate Course from
  // Course Offering from Class from Student Registration." Who teaches it this
  // year is a different act from what it is, and until 16 September 2026 the
  // four names for that act — `assign-lecturers`,
  // `assign-lecturers-to-courses`, `approve-course-allocation` and
  // `manage-course-offerings` — were held by four sets of offices and consulted
  // by nothing at all. Three were retired and the fourth was declared.
  //
  // Everyone who could edit here before still can: the Programme Coordinator
  // and the Academic Office were granted the survivor for that reason.
  const mayEdit = can(user?.role, 'manage-course-offerings');

  const [years, setYears] = useState<Year[]>([]);
  // Whether the calendar has ANSWERED, as against being empty. See the
  // year picker below: the two look identical and mean opposite things.
  const [calendarRead, setCalendarRead] = useState(false);
  // The year the DATES say it is — see the note where it is read.
  const [currentYearId, setCurrentYearId] = useState<string | null>(null);
  const [yearId, setYearId] = useState<string>('');
  const [term, setTerm] = useState(1);

  const [roll, setRoll] = useState<Roll[]>([]);
  const [offerings, setOfferings] = useState<Offering[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [clashes, setClashes] = useState<Clash[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [lecturers, setLecturers] = useState<Lecturer[]>([]);

  const [offering, setOffering] = useState(false);
  const [scheduling, setScheduling] = useState<string | null>(null);
  const [note, setNote] = useState<{ tone: 'ok' | 'bad'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // THE CALENDAR IS READ FIRST AND THE CURRENT YEAR CHOSEN, because a screen
  // that opens on no term shows nothing and looks broken. 059 marks one year
  // `current`; where none is, the earliest stands in.
  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const { data, error } = await within(
          supabase.from('academic_years').select(YEAR).order('starts_in'),
        );
        if (!live) return;
        setCalendarRead(true);
        if (error) { setFailed(error.message); setLoading(false); return; }
        const ys = (data ?? []) as unknown as Year[];
        setYears(ys);
        // WHICH YEAR IS IT? ASKED OF THE DATES, NOT OF A STORED COLUMN.
        //
        // This read `status === 'current'`. 059 set that column ONCE, with
        // current_date, on the day the migration ran — under a comment saying
        // the date decides it. It decided it once. On 15 August 2027 the
        // column would still have said 2026/2027, and this screen would have
        // opened on last year's data and said nothing at all.
        //
        // 065's `academic_year_now` derives it from the dates every time it is
        // asked, so it cannot go stale. The stored status is the fallback and
        // the first year is the fallback's fallback — both only reached if 065
        // has not been run.
        const { data: nowRow } = await within(
          supabase.from('academic_year_now').select(YEAR).maybeSingle(),
        ).catch(() => ({ data: null }));
        const derived = (nowRow ?? null) as unknown as Year | null;
        const current = (derived && ys.find((y) => y.id === derived.id))
          ?? ys.find((y) => y.status === 'current')
          ?? ys[0];
        setCurrentYearId(current?.id ?? null);
        if (current) setYearId(current.id);
        else setLoading(false);
      } catch (e) {
        if (live) {
          setCalendarRead(true);
          setFailed(e instanceof Error ? e.message : 'The calendar could not be read.');
          setLoading(false);
        }
      }
    })();
    return () => { live = false; };
  }, []);

  const load = useCallback(async () => {
    if (!yearId) return;
    setLoading(true);
    try {
      const year = years.find((y) => y.id === yearId);
      const [offs, crs, rms, lects] = await within(Promise.all([
        supabase.from('course_offerings').select(OFFERING)
          .eq('academic_year_id', yearId).eq('term_sequence', term),
        supabase.from('courses').select(COURSE).order('code').limit(1000),
        supabase.from('rooms').select(ROOM).order('code'),
        supabase.from('lecturers').select(LECTURER).order('last_name'),
      ]));
      if (offs.error) { setFailed(offs.error.message); setLoading(false); return; }

      const offRows = (offs.data ?? []) as unknown as Offering[];
      const ids = offRows.map((o) => o.id);

      // THE ROLL AND THE CLASSES ARE READ SEPARATELY AND JOINED HERE. An
      // embedded select that resolves the wrong foreign key returns rows with
      // a null child and no error at all — the failure nobody sees.
      const [rl, secs] = await within(Promise.all([
        year
          ? supabase.from('course_offering_roll').select(ROLL)
            .eq('starts_in', year.starts_in).eq('term_sequence', term)
          : Promise.resolve({ data: [], error: null }),
        ids.length === 0
          ? Promise.resolve({ data: [], error: null })
          : supabase.from('class_sections').select(SECTION).in('offering_id', ids),
      ]));

      const sectionRows = (secs.data ?? []) as unknown as Section[];
      const { data: clashRows } = sectionRows.length === 0
        ? { data: [] }
        : await within(
          supabase.from('timetable_clashes').select(CLASH)
            .in('section_id', sectionRows.map((s) => s.id)),
        );

      setFailed(null);
      setOfferings(offRows);
      setRoll((rl.data ?? []) as unknown as Roll[]);
      setSections(sectionRows);
      setClashes((clashRows ?? []) as unknown as Clash[]);
      setCourses((crs.data ?? []) as unknown as Course[]);
      setRooms((rms.data ?? []) as unknown as Room[]);
      setLecturers((lects.data ?? []) as unknown as Lecturer[]);
    } catch (e) {
      setFailed(e instanceof Error ? e.message : 'This term could not be read.');
    }
    setLoading(false);
  }, [yearId, term, years]);

  useEffect(() => { void load(); }, [load]);

  const rollById = useMemo(
    () => new Map(roll.map((r) => [r.offering_id, r])),
    [roll],
  );
  const roomById = useMemo(() => new Map(rooms.map((r) => [r.id, r])), [rooms]);
  const lecturerById = useMemo(() => new Map(lecturers.map((l) => [l.id, l])), [lecturers]);
  const courseById = useMemo(() => new Map(courses.map((c) => [c.id, c])), [courses]);
  const clashesBySection = useMemo(() => {
    const m = new Map<string, Clash[]>();
    for (const c of clashes) {
      const list = m.get(c.section_id) ?? [];
      list.push(c);
      m.set(c.section_id, list);
    }
    return m;
  }, [clashes]);

  const alreadyOffered = useMemo(
    () => new Set(offerings.map((o) => o.course_id)),
    [offerings],
  );

  async function act(payload: Record<string, unknown>) {
    setBusy(true);
    setNote(null);
    const out = await authedPost('/api/academic/offerings', payload);
    setBusy(false);
    if (!out.ok) {
      setNote({ tone: 'bad', text: String(out.detail ?? out.error ?? 'That did not work.') });
      return false;
    }
    // THE CLASHES COME BACK WITH THE ANSWER rather than on a later refresh.
    const back = (out.clashes ?? []) as { kind: string; detail: string }[];
    if (back.length > 0) {
      setNote({
        tone: 'bad',
        text: `Saved — but it clashes: ${back
          .map((c) => `${c.kind === 'room' ? 'the room' : c.kind === 'lecturer' ? 'the lecturer' : 'the cohort'} ${c.detail}`)
          .join('; ')}. Nothing was refused; move one of them.`,
      });
    } else {
      setNote({ tone: 'ok', text: 'Saved.' });
    }
    await load();
    return true;
  }

  if (failed) {
    return (
      <Card>
        <EmptyState
          icon={<AlertTriangle size={20} />}
          title="This term could not be read"
          description={`${failed}. If migrations 059 and 063 have not been run on this database, `
            + 'the academic calendar and the offerings tables do not exist yet.'}
        />
      </Card>
    );
  }

  const year = years.find((y) => y.id === yearId);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Course offerings"
        subtitle="What actually runs this term — the lecturer, the classes, the room and how full it is."
        action={mayEdit && (
          <button
            onClick={() => setOffering(true)}
            disabled={!yearId}
            className="flex items-center gap-1.5 rounded-xl bg-[#422e59] px-4 py-2 text-sm
                       font-medium text-white hover:bg-[#322244] disabled:opacity-40"
          >
            <Plus size={15} /> Offer a course
          </button>
        )}
      />

      {/* THE TERM PICKER. Everything below is one term — an offerings list of
          all years at once answers no question anybody asks. */}
      <Card className="flex flex-wrap items-end gap-4 p-4">
        <label className="text-sm">
          <span className="mb-1 block text-xs uppercase tracking-wide text-[#a49bb0]">
            Academic year
          </span>
          <select
            value={yearId}
            onChange={(e) => setYearId(e.target.value)}
            className="rounded-xl border border-[#ded6c8] bg-white px-3 py-2 text-sm
                       dark:border-[#3d3349] dark:bg-[#241f2c]"
          >
            {/* "NO ACADEMIC YEARS RECORDED" IS A FINDING, NOT A LOADING
                STATE — and this said it before the calendar had answered,
                which is a screen stating as fact something it has not yet
                asked. Rendered and read at 1440x950: the sentence was on the
                page while the skeleton below it was still drawing. */}
            {years.length === 0 && (
              <option value="">
                {calendarRead ? 'No academic years recorded' : 'Reading the calendar…'}
              </option>
            )}
            {years.map((y) => (
              <option key={y.id} value={y.id}>
                {y.label}{y.id === currentYearId ? ' — current' : ''}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs uppercase tracking-wide text-[#a49bb0]">
            Semester
          </span>
          <select
            value={term}
            onChange={(e) => setTerm(Number(e.target.value))}
            className="rounded-xl border border-[#ded6c8] bg-white px-3 py-2 text-sm
                       dark:border-[#3d3349] dark:bg-[#241f2c]"
          >
            <option value={1}>Semester 1</option>
            <option value={2}>Semester 2</option>
          </select>
        </label>
        <p className="flex-1 text-xs text-[#6b6076] dark:text-[#9c93ad]">
          {offerings.length} course{offerings.length === 1 ? '' : 's'} offered
          {clashes.length > 0 && (
            <span className="ml-1 font-semibold text-red-600 dark:text-red-400">
              · {clashes.length} timetable clash{clashes.length === 1 ? '' : 'es'}
            </span>
          )}
        </p>
      </Card>

      {note && (
        <div className={`rounded-xl border p-3 text-sm ${
          note.tone === 'ok'
            ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200'
            : 'border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200'
        }`}>
          {note.text}
        </div>
      )}

      {loading && <Card className="overflow-hidden"><SkeletonRows rows={5} cols={4} /></Card>}

      {!loading && offerings.length === 0 && (
        <Card>
          <EmptyState
            icon={<CalendarClock size={20} />}
            title={`Nothing is offered in ${year?.label ?? 'this year'}, semester ${term}`}
            description={mayEdit
              ? 'Offer a course to start setting the term up. Until something is offered, nobody '
                + 'can register: the registration screen falls back to the whole catalogue and '
                + 'says so.'
              : 'The term has not been set up yet.'}
          />
        </Card>
      )}

      {/* ONE CARD PER OFFERING, with its classes inside it. The classes belong
          to the offering and nowhere else — a flat list of every class in the
          University is a timetable, and that is a different screen. */}
      <div className="space-y-4">
        {offerings.map((o) => {
          const r = rollById.get(o.id);
          const c = courseById.get(o.course_id);
          const mine = sections.filter((s) => s.offering_id === o.id);
          const full = r?.places_left !== null && r?.places_left !== undefined && r.places_left <= 0;
          return (
            <Card key={o.id} className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <h3 className="font-heading text-base font-bold text-[#33234a] dark:text-[#e4dcf0]">
                    <span className="text-[#422e59] dark:text-[#c8b6e8]">
                      {r?.course_code ?? c?.code ?? '—'}
                    </span>
                    {' '}
                    {r?.course_title ?? c?.title ?? 'A course no longer in the catalogue'}
                  </h3>
                  <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs
                                text-[#6b6076] dark:text-[#9c93ad]">
                    <span>{o.delivery_mode}</span>
                    {o.campus && <span className="flex items-center gap-1"><MapPin size={11} />{o.campus}</span>}
                    <span className="flex items-center gap-1">
                      <Users size={11} />
                      {r?.registered ?? 0} registered
                      {o.max_enrolment === null
                        ? ' · no ceiling'
                        : ` of ${o.max_enrolment}`}
                    </span>
                    <span>
                      {r?.lecturer ?? (
                        <span className="text-amber-700 dark:text-amber-400">No lecturer assigned</span>
                      )}
                    </span>
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {full && (
                    <span className="rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-[11px]
                                     text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                      Full
                    </span>
                  )}
                  {mayEdit ? (
                    <select
                      value={o.status}
                      disabled={busy}
                      onChange={(e) => act({ action: 'status', offeringId: o.id, status: e.target.value })}
                      title={STATUS_MEANS[o.status]}
                      className="rounded-xl border border-[#ded6c8] bg-white px-2 py-1.5 text-xs
                                 dark:border-[#3d3349] dark:bg-[#241f2c]"
                    >
                      {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  ) : (
                    <span className="text-xs text-[#6b6076]">{o.status}</span>
                  )}
                </div>
              </div>

              <p className="mt-2 text-[11px] text-[#a49bb0] dark:text-[#7b7289]">
                {STATUS_MEANS[o.status]}
              </p>

              {/* ---- THE CLASSES ---- */}
              <div className="mt-4 space-y-2">
                {mine.length === 0 && (
                  <p className="rounded-lg border border-dashed border-[#ded6c8] p-3 text-center
                                text-xs text-[#a49bb0] dark:border-[#3d3349] dark:text-[#7b7289]">
                    No classes scheduled. The course is offered but meets at no hour, so it appears
                    on no timetable.
                  </p>
                )}
                {mine.map((s) => {
                  const mess = clashesBySection.get(s.id) ?? [];
                  return (
                    <div
                      key={s.id}
                      className={`flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg px-3 py-2 text-xs ${
                        mess.length > 0
                          ? 'border border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30'
                          : 'bg-[#faf8f4] dark:bg-[#241f2c]'
                      }`}
                    >
                      <span className="w-8 shrink-0 font-semibold text-[#422e59] dark:text-[#c8b6e8]">
                        {s.code}
                      </span>
                      <span className="flex items-center gap-1 text-[#33234a] dark:text-[#e4dcf0]">
                        <Clock size={11} />
                        {s.day_of_week
                          ? `${DAYS[s.day_of_week]} ${hhmm(s.starts_at)}–${hhmm(s.ends_at)}`
                          : 'Not yet timetabled'}
                      </span>
                      <span className="text-[#6b6076] dark:text-[#9c93ad]">
                        {s.room_id ? (roomById.get(s.room_id)?.code ?? 'a room') : 'No room'}
                      </span>
                      <span className="text-[#6b6076] dark:text-[#9c93ad]">
                        {s.lecturer_id
                          ? `${lecturerById.get(s.lecturer_id)?.first_name ?? ''} ${lecturerById.get(s.lecturer_id)?.last_name ?? ''}`.trim()
                          : '—'}
                      </span>
                      {mess.length > 0 && (
                        <span className="flex-1 font-medium text-red-700 dark:text-red-300">
                          <AlertTriangle size={11} className="mr-1 inline" />
                          {mess.map((m) => (
                            m.kind === 'room' ? `Room ${m.detail} is double-booked`
                              : m.kind === 'lecturer' ? `${m.detail} is teaching elsewhere`
                                : `${m.detail} must attend both`
                          )).join('; ')}
                        </span>
                      )}
                      {mayEdit && (
                        <button
                          onClick={() => act({ action: 'unschedule', sectionId: s.id })}
                          disabled={busy}
                          aria-label={`Remove class ${s.code}`}
                          className="ml-auto rounded p-1 text-[#a49bb0] hover:bg-red-100 hover:text-red-600
                                     dark:hover:bg-red-950/40"
                        >
                          <X size={13} />
                        </button>
                      )}
                    </div>
                  );
                })}

                {mayEdit && (
                  <button
                    onClick={() => setScheduling(o.id)}
                    className="flex w-full items-center justify-center gap-1.5 rounded-lg border
                               border-dashed border-[#ded6c8] py-2 text-xs font-medium text-[#6b6076]
                               hover:border-[#422e59] hover:text-[#422e59]
                               dark:border-[#3d3349] dark:text-[#9c93ad]"
                  >
                    <Plus size={13} /> Add a class
                  </button>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      {offering && (
        <OfferDialog
          courses={courses.filter((c) => !alreadyOffered.has(c.id))}
          lecturers={lecturers}
          busy={busy}
          termLabel={`${year?.label ?? ''} semester ${term}`}
          onClose={() => setOffering(false)}
          onOffer={async (fields) => {
            const ok = await act({
              action: 'offer', academicYearId: yearId, termSequence: term, ...fields,
            });
            if (ok) setOffering(false);
          }}
        />
      )}

      {scheduling && (
        <ClassDialog
          rooms={rooms.filter((r) => r.active)}
          lecturers={lecturers}
          taken={sections.filter((s) => s.offering_id === scheduling).map((s) => s.code)}
          busy={busy}
          onClose={() => setScheduling(null)}
          onSchedule={async (fields) => {
            const ok = await act({ action: 'schedule', offeringId: scheduling, ...fields });
            if (ok) setScheduling(null);
          }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// OFFERING A COURSE. A SELECTOR, NOT A CREATE FORM — the same objection the
// University raised about the Curriculum Builder applies here: a course
// invented while setting up a term belongs to no programme and appears in no
// curriculum. Courses already offered this term are not in the list, because
// 063 allows one offering of a course per term and a second is a second
// capacity and a second answer to "am I registered".
// ---------------------------------------------------------------------------
function OfferDialog({
  courses, lecturers, busy, termLabel, onClose, onOffer,
}: {
  courses: Course[];
  lecturers: Lecturer[];
  busy: boolean;
  termLabel: string;
  onClose: () => void;
  onOffer: (fields: Record<string, unknown>) => void;
}) {
  const [courseId, setCourseId] = useState('');
  const [deliveryMode, setDeliveryMode] = useState('Campus');
  const [campus, setCampus] = useState('');
  const [lecturerId, setLecturerId] = useState('');
  const [maxEnrolment, setMaxEnrolment] = useState('');

  return (
    <Dialog title="Offer a course" subtitle={termLabel} onClose={onClose}>
      <Field label="Course">
        <select
          value={courseId}
          onChange={(e) => setCourseId(e.target.value)}
          className={SELECT}
        >
          <option value="">Choose a course…</option>
          {courses.map((c) => (
            <option key={c.id} value={c.id}>{c.code} — {c.title}</option>
          ))}
        </select>
        {courses.length === 0 && (
          <p className="mt-1 text-xs text-[#a49bb0]">
            Every course in the catalogue is already offered this term.
          </p>
        )}
      </Field>

      <Field label="Delivery">
        {/* THE UNIVERSITY'S OWN THREE WORDS. A fourth is refused by the route
            and by the database — 'Hybrid' means the same thing to a reader and
            nothing to a query filtering on 'Online / Campus'. */}
        <select value={deliveryMode} onChange={(e) => setDeliveryMode(e.target.value)} className={SELECT}>
          {MODES.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
      </Field>

      <Field label="Campus (optional)">
        <input value={campus} onChange={(e) => setCampus(e.target.value)} className={SELECT} />
      </Field>

      <Field label="Lecturer">
        <select value={lecturerId} onChange={(e) => setLecturerId(e.target.value)} className={SELECT}>
          <option value="">Not assigned yet</option>
          {lecturers.map((l) => (
            <option key={l.id} value={l.id}>{l.first_name} {l.last_name} · {l.staff_id}</option>
          ))}
        </select>
      </Field>

      <Field label="Maximum enrolment">
        <input
          type="number" min={1} value={maxEnrolment}
          onChange={(e) => setMaxEnrolment(e.target.value)}
          placeholder="Leave blank for no ceiling"
          className={SELECT}
        />
        <p className="mt-1 text-xs text-[#a49bb0]">
          Blank is not zero. A blank ceiling means the course takes everyone who is eligible.
        </p>
      </Field>

      <button
        onClick={() => onOffer({
          courseId, deliveryMode, campus: campus || null,
          lecturerId: lecturerId || null, maxEnrolment: maxEnrolment || null,
        })}
        disabled={busy || !courseId}
        className="w-full rounded-xl bg-[#422e59] px-4 py-2.5 text-sm font-medium text-white
                   hover:bg-[#322244] disabled:opacity-40"
      >
        Offer it
      </button>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// SCHEDULING A CLASS. A slot is a day AND a start AND an end, or none of them —
// half a slot cannot be drawn on a timetable and cannot be checked for a clash,
// which is why the three inputs are offered together and the form will not let
// two of them be filled.
// ---------------------------------------------------------------------------
function ClassDialog({
  rooms, lecturers, taken, busy, onClose, onSchedule,
}: {
  rooms: Room[];
  lecturers: Lecturer[];
  taken: string[];
  busy: boolean;
  onClose: () => void;
  onSchedule: (fields: Record<string, unknown>) => void;
}) {
  // 'A', then 'B', then 'C' — the next letter this offering has not used.
  const next = useMemo(() => {
    for (let i = 0; i < 26; i += 1) {
      const letter = String.fromCharCode(65 + i);
      if (!taken.includes(letter)) return letter;
    }
    return `${taken.length + 1}`;
  }, [taken]);

  const [code, setCode] = useState(next);
  const [dayOfWeek, setDayOfWeek] = useState('1');
  const [startsAt, setStartsAt] = useState('09:00');
  const [endsAt, setEndsAt] = useState('11:00');
  const [roomId, setRoomId] = useState('');
  const [lecturerId, setLecturerId] = useState('');
  const [capacity, setCapacity] = useState('');

  const backwards = Boolean(startsAt && endsAt && endsAt <= startsAt);

  return (
    <Dialog title="Add a class" subtitle="One group, one hour, one room" onClose={onClose}>
      <Field label="Class">
        <input value={code} onChange={(e) => setCode(e.target.value)} className={SELECT} />
      </Field>

      <div className="grid grid-cols-3 gap-3">
        <Field label="Day">
          <select value={dayOfWeek} onChange={(e) => setDayOfWeek(e.target.value)} className={SELECT}>
            {[1, 2, 3, 4, 5, 6, 7].map((d) => <option key={d} value={d}>{DAYS[d]}</option>)}
          </select>
        </Field>
        <Field label="From">
          <input type="time" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} className={SELECT} />
        </Field>
        <Field label="To">
          <input type="time" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} className={SELECT} />
        </Field>
      </div>
      {backwards && (
        <p className="text-xs text-red-600 dark:text-red-400">A class ends after it begins.</p>
      )}

      <Field label="Room">
        <select value={roomId} onChange={(e) => setRoomId(e.target.value)} className={SELECT}>
          <option value="">No room</option>
          {rooms.map((r) => (
            <option key={r.id} value={r.id}>
              {r.code}{r.name ? ` — ${r.name}` : ''}{r.capacity ? ` (${r.capacity})` : ''}
            </option>
          ))}
        </select>
        {rooms.length === 0 && (
          <p className="mt-1 text-xs text-[#a49bb0]">
            No rooms are recorded. A class can still be scheduled without one — but a room clash
            cannot be detected for a class that is in no room.
          </p>
        )}
      </Field>

      <Field label="Lecturer">
        <select value={lecturerId} onChange={(e) => setLecturerId(e.target.value)} className={SELECT}>
          <option value="">Take the offering’s lecturer</option>
          {lecturers.map((l) => (
            <option key={l.id} value={l.id}>{l.first_name} {l.last_name} · {l.staff_id}</option>
          ))}
        </select>
      </Field>

      <Field label="Class size (optional)">
        <input type="number" min={1} value={capacity}
          onChange={(e) => setCapacity(e.target.value)} className={SELECT} />
      </Field>

      <button
        onClick={() => onSchedule({
          code, dayOfWeek, startsAt, endsAt,
          roomId: roomId || null, lecturerId: lecturerId || null,
          capacity: capacity || null,
        })}
        disabled={busy || backwards || !code.trim()}
        className="w-full rounded-xl bg-[#422e59] px-4 py-2.5 text-sm font-medium text-white
                   hover:bg-[#322244] disabled:opacity-40"
      >
        Schedule it
      </button>
      <p className="text-xs text-[#a49bb0]">
        A clash is reported, not refused — you will be told at once if the room, the lecturer or
        the cohort is already busy at that hour.
      </p>
    </Dialog>
  );
}

const SELECT = 'w-full rounded-xl border border-[#ded6c8] bg-white px-3 py-2 text-sm '
  + 'dark:border-[#3d3349] dark:bg-[#241f2c]';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-xs uppercase tracking-wide text-[#a49bb0]">{label}</span>
      {children}
    </label>
  );
}

function Dialog({
  title, subtitle, onClose, children,
}: {
  title: string; subtitle?: string; onClose: () => void; children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[85vh] w-full max-w-md flex-col overflow-y-auto rounded-2xl bg-white
                   dark:bg-[#1f1a27]"
      >
        <div className="flex items-center justify-between border-b border-[#f0ece4] px-5 py-4
                        dark:border-[#2a2333]">
          <div>
            <h3 className="font-heading text-lg font-bold text-[#422e59] dark:text-[#e4dcf0]">
              {title}
            </h3>
            {subtitle && (
              <p className="text-xs text-[#6b6076] dark:text-[#9c93ad]">{subtitle}</p>
            )}
          </div>
          <button onClick={onClose} aria-label="Close"
            className="rounded-lg p-1 hover:bg-[#f2eee6] dark:hover:bg-[#2a2333]">
            <X size={18} />
          </button>
        </div>
        <div className="space-y-4 px-5 py-4">{children}</div>
      </div>
    </div>
  );
}
