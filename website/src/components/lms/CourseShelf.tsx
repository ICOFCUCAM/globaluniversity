'use client';

// ---------------------------------------------------------------------------
// LEARNING — my courses, and what is in them.
//
// ---------------------------------------------------------------------------
// THE UNIVERSITY'S OBJECTION, IN FULL
// ---------------------------------------------------------------------------
//
// "The LMS should NOT be called a Learning Management System if it isn't
// actually an LMS. The current LMS looks like a file repository containing:
// Introduction to AI, SQL Tutorial, React Framework, Neural Networks. Those
// examples don't even appear connected to the University's actual academic
// programmes. Instead, make it academic-contextual: My Programmes → My Courses
// → inside BIS 220: course overview, lecturer, outline, learning outcomes,
// weekly materials, reading list…"
//
// The invented rows went months ago. The SHAPE did not, and the shape was the
// real fault: materials lived in a JSON blob store keyed on a course code
// typed in as free text. A string is not a foreign key, so nothing could list
// the materials OF a course — only search for a word. And no material knew
// which offering it belonged to, so "my courses" had no answer.
//
// 068 gives a material a `course_id` and an optional `offering_id`, and this
// screen is built on the two views that follow from it.
//
// ---------------------------------------------------------------------------
// WHOSE SHELF IS IT? THE DATABASE DECIDES, NOT THIS FILE
// ---------------------------------------------------------------------------
//
// `my_courses` filters on `auth.uid()` in SQL. `my_teaching` does the same for
// a lecturer. Neither is filtered here, because a screen that filters is a
// screen that can forget to — and forgetting shows one student another's
// courses.
//
// A STUDENT'S SHELF IS THEIR REGISTRATIONS, not the catalogue. That question
// could not be asked before 063 linked a registration to an offering.
//
// ---------------------------------------------------------------------------
// AND A COURSE'S OWN MATERIAL IS SHOWN ALONGSIDE THE TERM'S
// ---------------------------------------------------------------------------
//
// An outline and a reading list belong to the COURSE — true in 2026 and in
// 2029. A recording and a week's slides belong to the OFFERING. Both appear;
// the term's are marked, because a student looking for last week's lecture and
// a student looking for the reading list are looking for different things.
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
  AlertTriangle, BookOpen, FileText, Video, Link2, Megaphone, ListChecks,
  Plus, X, ArrowLeft, Eye, EyeOff, Trash2, Pencil, GraduationCap, User,
} from 'lucide-react';
import { within } from '@/components/academic/ProgrammeRegister';

// SINGLE STRING LITERALS — concatenation collapses the inferred row type.
// eslint-disable-next-line max-len
const MINE = 'student_id, course_id, course_code, course_title, credit_unit, description, outline, learning_outcomes, offering_id, term_sequence, delivery_mode, campus, offering_status, year_label, starts_in, lecturer_id, lecturer, enrollment_id, academic_year, semester, registration_status, materials';
// eslint-disable-next-line max-len
const TEACHING = 'lecturer_id, course_id, course_code, course_title, credit_unit, offering_id, term_sequence, offering_status, delivery_mode, year_label, starts_in, attached_by, materials, registered';
// eslint-disable-next-line max-len
const MATERIALS = 'id, course_id, offering_id, kind, week, title, body, url, visible, sort_order, created_at';

interface Shelf {
  course_id: string; course_code: string; course_title: string; credit_unit: number;
  description: string | null; outline: string | null; learning_outcomes: string | null;
  offering_id: string | null; term_sequence: number | null;
  delivery_mode: string | null; campus: string | null; offering_status: string | null;
  year_label: string | null; starts_in: number | null;
  lecturer: string | null; materials: number;
  /** Only on a lecturer's shelf. 'offering' or 'catalogue' — see 068. */
  attached_by?: string;
  registered?: number;
}
interface Material {
  id: string; course_id: string; offering_id: string | null;
  kind: string; week: number | null; title: string; body: string | null;
  url: string | null; visible: boolean; sort_order: number; created_at: string;
}

const KINDS = ['outline', 'reading', 'note', 'slides', 'video', 'link',
  'recording', 'announcement'];
const KIND_LABEL: Record<string, string> = {
  outline: 'Outline',
  reading: 'Reading',
  note: 'Notes',
  slides: 'Slides',
  video: 'Video',
  link: 'Link',
  recording: 'Recording',
  announcement: 'Announcement',
};

function kindIcon(kind: string) {
  if (kind === 'video' || kind === 'recording') return <Video size={13} />;
  if (kind === 'link') return <Link2 size={13} />;
  if (kind === 'announcement') return <Megaphone size={13} />;
  if (kind === 'reading' || kind === 'outline') return <ListChecks size={13} />;
  return <FileText size={13} />;
}

export default function CourseShelf() {
  const { user } = useAuth();
  const mayPublish = can(user?.role, 'publish-course-material');

  const [shelf, setShelf] = useState<Shelf[] | null>(null);
  const [teaching, setTeaching] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [failed, setFailed] = useState<string | null>(null);
  const [note, setNote] = useState<{ tone: 'ok' | 'bad'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<Material | 'new' | null>(null);
  const [editingCourse, setEditingCourse] = useState(false);

  const load = useCallback(async () => {
    try {
      // BOTH SHELVES ARE ASKED FOR. A person can be both — a lecturer reading
      // for a doctorate is ordinary — and asking only the one their role
      // suggests would hide half their courses from them.
      const [mine, teach] = await within(Promise.all([
        supabase.from('my_courses').select(MINE),
        supabase.from('my_teaching').select(TEACHING),
      ]));

      const asStudent = (mine.data ?? []) as unknown as Shelf[];
      const asLecturer = (teach.data ?? []) as unknown as Shelf[];

      if (mine.error && teach.error) {
        setFailed(mine.error.message);
        setShelf([]);
        return;
      }
      setFailed(null);
      // WHICHEVER HAS COURSES IN IT opens first, rather than a tab the reader
      // has to find. A student's shelf is the common case; a lecturer with no
      // registrations sees theirs immediately.
      if (asStudent.length === 0 && asLecturer.length > 0) setTeaching(true);
      setShelf(teaching || (asStudent.length === 0 && asLecturer.length > 0)
        ? asLecturer : asStudent);
    } catch (e) {
      setFailed(e instanceof Error ? e.message : 'Your courses could not be read.');
      setShelf([]);
    }
  }, [teaching]);

  useEffect(() => { void load(); }, [load]);

  const openOne = useCallback(async (courseId: string, offeringId: string | null) => {
    try {
      // THE COURSE'S OWN MATERIAL AND THIS TERM'S, IN ONE READ. `offering_id
      // is null` is the course's; the rest belong to this offering. A material
      // of ANOTHER term is not shown — it is last year's lecture.
      const q = supabase.from('course_materials').select(MATERIALS).eq('course_id', courseId);
      const { data } = await within(
        offeringId ? q.or(`offering_id.is.null,offering_id.eq.${offeringId}`) : q,
      );
      const rows = ((data ?? []) as unknown as Material[])
        .filter((m) => m.offering_id === null || m.offering_id === offeringId);
      setMaterials(rows);
    } catch {
      setMaterials([]);
    }
  }, []);

  const open = (shelf ?? []).find((s) => s.course_id === openId) ?? null;

  useEffect(() => {
    if (open) void openOne(open.course_id, open.offering_id);
  }, [open, openOne]);

  async function act(payload: Record<string, unknown>) {
    setBusy(true);
    setNote(null);
    const out = await authedPost('/api/academic/materials', payload);
    setBusy(false);
    if (!out.ok) {
      setNote({ tone: 'bad', text: String(out.detail ?? out.error ?? 'That did not work.') });
      return false;
    }
    setNote({ tone: 'ok', text: String(out.detail ?? 'Saved.') });
    if (open) await openOne(open.course_id, open.offering_id);
    await load();
    return true;
  }

  if (failed) {
    return (
      <Card>
        <EmptyState
          icon={<AlertTriangle size={20} />}
          title="Your courses could not be read"
          description={`${failed}. If migration 068 has not been run on this database, the views `
            + 'this screen reads do not exist yet.'}
        />
      </Card>
    );
  }

  // =========================================================================
  // ONE COURSE
  // =========================================================================
  if (open) {
    return (
      <OneCourse
        course={open}
        materials={materials}
        mayPublish={mayPublish && (!!open.attached_by || teaching)}
        busy={busy}
        note={note}
        onBack={() => { setOpenId(null); setMaterials([]); setNote(null); }}
        onAdd={() => setEditing('new')}
        onEdit={(m) => setEditing(m)}
        onEditCourse={() => setEditingCourse(true)}
        onAct={act}
        editing={editing}
        onCloseEditor={() => setEditing(null)}
        editingCourse={editingCourse}
        onCloseCourseEditor={() => setEditingCourse(false)}
      />
    );
  }

  // =========================================================================
  // THE SHELF
  // =========================================================================
  return (
    <div className="space-y-6">
      <PageHeader
        title="Learning"
        subtitle="Your courses, and what is taught in each of them."
      />

      {/* THE TWO SHELVES. Shown only when the person has both — a student with
          no teaching load should not be offered a tab that is always empty. */}
      <ShelfSwitch teaching={teaching} onSwitch={(t) => { setTeaching(t); setShelf(null); }} />

      {shelf === null && <Card className="overflow-hidden"><SkeletonRows rows={5} cols={3} /></Card>}

      {shelf !== null && shelf.length === 0 && (
        <Card>
          <EmptyState
            icon={<GraduationCap size={20} />}
            title={teaching ? 'You are not teaching any courses' : 'You are not registered on any courses'}
            description={teaching
              ? 'A course appears here once you are named as the lecturer on one — either on an '
                + 'offering for this term, or on the course in the catalogue.'
              : 'Your courses are the ones you are registered on. Register on the Course '
                + 'registration screen and they will appear here, with everything your lecturer '
                + 'has put on them.'}
          />
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {(shelf ?? []).map((s) => (
          <button
            key={`${s.course_id}-${s.offering_id ?? 'none'}`}
            onClick={() => setOpenId(s.course_id)}
            className="rounded-2xl border border-[#ece7de] bg-white p-5 text-left
                       hover:border-[#422e59] dark:border-[#2e2637] dark:bg-[#1f1a27]"
          >
            <p className="font-heading text-sm font-bold text-[#422e59] dark:text-[#c8b6e8]">
              {s.course_code}
            </p>
            <p className="mt-0.5 text-sm font-medium text-[#33234a] dark:text-[#e4dcf0]">
              {s.course_title}
            </p>
            <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs
                          text-[#6b6076] dark:text-[#9c93ad]">
              <span>{s.credit_unit} credits</span>
              {s.year_label && <span>{s.year_label} · Semester {s.term_sequence}</span>}
              {!teaching && (
                <span className="flex items-center gap-1">
                  <User size={11} />
                  {s.lecturer ?? 'No lecturer assigned'}
                </span>
              )}
              {teaching && s.registered !== undefined && (
                <span>{s.registered} registered</span>
              )}
            </p>
            <p className="mt-2 text-xs">
              {s.materials === 0 ? (
                <span className="text-[#a49bb0]">
                  {teaching ? 'Nothing on it yet' : 'Your lecturer has not put anything on it yet'}
                </span>
              ) : (
                <span className="font-medium text-[#422e59] dark:text-[#c8b6e8]">
                  {s.materials} item{s.materials === 1 ? '' : 's'}
                </span>
              )}
              {/* 068: a course reached through the catalogue rather than an
                  offering, because no term has been set up. Saying which
                  stops a lecturer wondering why it has no students. */}
              {teaching && s.attached_by === 'catalogue' && (
                <span className="ml-2 text-[10px] text-[#a07c12]">
                  from the catalogue — no term set up
                </span>
              )}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}

function ShelfSwitch({
  teaching, onSwitch,
}: { teaching: boolean; onSwitch: (t: boolean) => void }) {
  return (
    <div className="flex gap-1 rounded-xl border border-[#ded6c8] p-1 dark:border-[#3d3349]">
      {[false, true].map((t) => (
        <button
          key={String(t)}
          onClick={() => onSwitch(t)}
          className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-medium ${
            teaching === t
              ? 'bg-[#422e59] text-white'
              : 'text-[#6b6076] hover:bg-[#faf8f4] dark:text-[#9c93ad] dark:hover:bg-[#241f2c]'
          }`}
        >
          {t ? 'Courses I teach' : 'Courses I am taking'}
        </button>
      ))}
    </div>
  );
}

function OneCourse({
  course: c, materials, mayPublish, busy, note, onBack, onAdd, onEdit, onEditCourse, onAct,
  editing, onCloseEditor, editingCourse, onCloseCourseEditor,
}: {
  course: Shelf;
  materials: Material[];
  mayPublish: boolean;
  busy: boolean;
  note: { tone: 'ok' | 'bad'; text: string } | null;
  onBack: () => void;
  onAdd: () => void;
  onEdit: (m: Material) => void;
  onEditCourse: () => void;
  onAct: (p: Record<string, unknown>) => Promise<boolean>;
  editing: Material | 'new' | null;
  onCloseEditor: () => void;
  editingCourse: boolean;
  onCloseCourseEditor: () => void;
}) {
  // BY WEEK, with everything that belongs to no week first. A reading list and
  // an outline are not week 1; filing them there puts them below the first
  // lecture, which is the last place anybody looks for them.
  const weeks = useMemo(() => {
    const m = new Map<number | null, Material[]>();
    for (const x of materials) {
      const key = x.week ?? null;
      m.set(key, [...(m.get(key) ?? []), x]);
    }
    return Array.from(m.entries()).sort((a, b) => {
      if (a[0] === null) return -1;
      if (b[0] === null) return 1;
      return a[0] - b[0];
    });
  }, [materials]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${c.course_code} — ${c.course_title}`}
        subtitle={[
          `${c.credit_unit} credits`,
          c.year_label ? `${c.year_label} · Semester ${c.term_sequence}` : null,
          c.lecturer,
          c.delivery_mode,
        ].filter(Boolean).join(' · ')}
        action={(
          <div className="flex gap-2">
            {mayPublish && (
              <button
                onClick={onAdd}
                className="flex items-center gap-1.5 rounded-xl bg-[#422e59] px-3 py-2 text-sm
                           font-medium text-white hover:bg-[#322244]"
              >
                <Plus size={14} /> Add material
              </button>
            )}
            <button
              onClick={onBack}
              className="flex items-center gap-1.5 rounded-xl border border-[#ded6c8] px-3 py-2
                         text-sm text-[#6b6076] hover:bg-[#faf8f4]
                         dark:border-[#3d3349] dark:text-[#9c93ad] dark:hover:bg-[#241f2c]"
            >
              <ArrowLeft size={14} /> All courses
            </button>
          </div>
        )}
      />

      {note && (
        <div className={`rounded-xl border p-3 text-sm ${
          note.tone === 'ok'
            ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200'
            : 'border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200'
        }`}>
          {note.text}
        </div>
      )}

      {/* ---- WHAT THE COURSE IS ---- */}
      <Card className="p-5">
        <div className="flex items-start justify-between gap-4">
          <h2 className="font-heading text-sm font-bold uppercase tracking-wide text-[#422e59]
                         dark:text-[#c8b6e8]">
            About this course
          </h2>
          {mayPublish && (
            <button
              onClick={onEditCourse}
              className="flex items-center gap-1 text-xs text-[#422e59] underline
                         dark:text-[#c8b6e8]"
            >
              <Pencil size={12} /> Edit the outline
            </button>
          )}
        </div>

        {c.description && (
          <p className="mt-3 text-sm text-[#33234a] dark:text-[#e4dcf0]">{c.description}</p>
        )}

        {c.outline ? (
          <div className="mt-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#a49bb0]">
              Outline
            </p>
            <p className="mt-1 whitespace-pre-wrap text-sm text-[#33234a] dark:text-[#e4dcf0]">
              {c.outline}
            </p>
          </div>
        ) : (
          <p className="mt-3 text-xs text-[#a49bb0]">
            {/* NOT INVENTED. An outline nobody wrote is an invented course. */}
            No outline has been written for this course yet.
          </p>
        )}

        {c.learning_outcomes && (
          <div className="mt-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#a49bb0]">
              Learning outcomes
            </p>
            <p className="mt-1 whitespace-pre-wrap text-sm text-[#33234a] dark:text-[#e4dcf0]">
              {c.learning_outcomes}
            </p>
          </div>
        )}
      </Card>

      {/* ---- THE MATERIALS ---- */}
      {materials.length === 0 ? (
        <Card>
          <EmptyState
            icon={<BookOpen size={20} />}
            title="Nothing on this course yet"
            description={mayPublish
              ? 'Add the outline, a reading list, or the first week’s notes. Anything you add '
                + 'without a term belongs to the course itself and stands for every year it runs.'
              : 'Your lecturer has not put any material on this course yet.'}
          />
        </Card>
      ) : (
        <div className="space-y-4">
          {weeks.map(([week, items]) => (
            <Card key={String(week)} className="p-5">
              <h3 className="font-heading text-sm font-bold text-[#33234a] dark:text-[#e4dcf0]">
                {week === null ? 'The course itself' : `Week ${week}`}
              </h3>
              {week === null && (
                <p className="mb-2 text-[11px] text-[#a49bb0]">
                  Belongs to no particular week — the outline, the reading list.
                </p>
              )}
              <ul className="mt-2 space-y-1.5">
                {items.sort((a, b) => a.sort_order - b.sort_order).map((m) => (
                  <li key={m.id}
                    className={`flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg px-3 py-2
                                text-xs ${m.visible
                      ? 'bg-[#faf8f4] dark:bg-[#241f2c]'
                      : 'border border-dashed border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/20'}`}>
                    <span className="shrink-0 text-[#422e59] dark:text-[#c8b6e8]">
                      {kindIcon(m.kind)}
                    </span>
                    <span className="w-20 shrink-0 text-[10px] uppercase tracking-wide
                                     text-[#a49bb0]">
                      {KIND_LABEL[m.kind] ?? m.kind}
                    </span>
                    <span className="min-w-0 flex-1">
                      {m.url ? (
                        <a href={m.url} target="_blank" rel="noopener noreferrer"
                          className="font-medium text-[#422e59] underline dark:text-[#c8b6e8]">
                          {m.title}
                        </a>
                      ) : (
                        <span className="font-medium text-[#33234a] dark:text-[#e4dcf0]">
                          {m.title}
                        </span>
                      )}
                      {m.body && (
                        <span className="mt-0.5 block whitespace-pre-wrap text-[#6b6076]
                                         dark:text-[#9c93ad]">
                          {m.body}
                        </span>
                      )}
                    </span>
                    {/* THIS TERM'S, OR THE COURSE'S. Marked, because a student
                        looking for last week's lecture and one looking for the
                        reading list are looking for different things. */}
                    {m.offering_id === null && (
                      <span className="shrink-0 text-[10px] text-[#a49bb0]">every term</span>
                    )}
                    {!m.visible && (
                      <span className="shrink-0 text-[10px] font-medium text-amber-700
                                       dark:text-amber-300">
                        not published
                      </span>
                    )}
                    {mayPublish && (
                      <span className="flex shrink-0 gap-1">
                        <button
                          onClick={() => onAct({
                            action: 'show', materialId: m.id, visible: !m.visible,
                          })}
                          disabled={busy}
                          aria-label={m.visible ? `Take back ${m.title}` : `Publish ${m.title}`}
                          title={m.visible
                            ? 'Take it back — students stop seeing it, nothing is deleted'
                            : 'Publish it to the students on this course'}
                          className="rounded p-1 text-[#a49bb0] hover:bg-[#f2eee6]
                                     hover:text-[#422e59] dark:hover:bg-[#2a2333]"
                        >
                          {m.visible ? <Eye size={13} /> : <EyeOff size={13} />}
                        </button>
                        <button
                          onClick={() => onEdit(m)}
                          aria-label={`Edit ${m.title}`}
                          className="rounded p-1 text-[#a49bb0] hover:bg-[#f2eee6]
                                     hover:text-[#422e59] dark:hover:bg-[#2a2333]"
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          onClick={() => onAct({ action: 'remove', materialId: m.id })}
                          disabled={busy}
                          aria-label={`Remove ${m.title}`}
                          className="rounded p-1 text-[#a49bb0] hover:bg-red-50 hover:text-red-600
                                     dark:hover:bg-red-950/40"
                        >
                          <Trash2 size={13} />
                        </button>
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      )}

      {editing && (
        <MaterialDialog
          material={editing === 'new' ? null : editing}
          offeringId={c.offering_id}
          busy={busy}
          onClose={onCloseEditor}
          onSave={async (fields) => {
            const ok = editing === 'new'
              ? await onAct({ action: 'add', courseId: c.course_id, ...fields })
              : await onAct({ action: 'set', materialId: editing.id, ...fields });
            if (ok) onCloseEditor();
          }}
        />
      )}

      {editingCourse && (
        <OutlineDialog
          course={c}
          busy={busy}
          onClose={onCloseCourseEditor}
          onSave={async (fields) => {
            const ok = await onAct({ action: 'course', courseId: c.course_id, ...fields });
            if (ok) onCloseCourseEditor();
          }}
        />
      )}
    </div>
  );
}

function MaterialDialog({
  material, offeringId, busy, onClose, onSave,
}: {
  material: Material | null;
  offeringId: string | null;
  busy: boolean;
  onClose: () => void;
  onSave: (f: Record<string, unknown>) => void;
}) {
  const [kind, setKind] = useState(material?.kind ?? 'note');
  const [title, setTitle] = useState(material?.title ?? '');
  const [week, setWeek] = useState(material?.week === null || material?.week === undefined
    ? '' : String(material.week));
  const [body, setBody] = useState(material?.body ?? '');
  const [url, setUrl] = useState(material?.url ?? '');
  // THIS TERM'S, OR EVERY TERM'S. Defaults to this term for a new material
  // where there IS a term, because that is the common case — a week's notes.
  const [thisTerm, setThisTerm] = useState(
    material ? material.offering_id !== null : offeringId !== null,
  );
  const empty = !body.trim() && !url.trim();

  return (
    <Dialog title={material ? 'Edit material' : 'Add material'} onClose={onClose}>
      <Field label="What is it">
        <select value={kind} onChange={(e) => setKind(e.target.value)} className={INPUT}>
          {KINDS.map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
        </select>
      </Field>

      <Field label="Title">
        <input value={title} onChange={(e) => setTitle(e.target.value)}
          placeholder="Week 3 — the Synoptic Problem" className={INPUT} />
        <p className="mt-1 text-xs text-[#a49bb0]">It is what a student clicks.</p>
      </Field>

      <Field label="Teaching week">
        <input type="number" min={1} max={52} value={week}
          onChange={(e) => setWeek(e.target.value)}
          placeholder="Leave blank for the reading list, the outline" className={INPUT} />
        <p className="mt-1 text-xs text-[#a49bb0]">
          Blank is not week zero. Anything with no week is shown first, above week 1, because
          that is where a reading list is looked for.
        </p>
      </Field>

      <Field label="Text (optional)">
        <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4}
          className={INPUT} />
      </Field>

      <Field label="Link (optional)">
        <input value={url} onChange={(e) => setUrl(e.target.value)}
          placeholder="https://…" className={INPUT} />
      </Field>

      {empty && (
        <p className="text-xs text-red-600 dark:text-red-400">
          A material needs either text or a link. A title on its own does nothing when clicked,
          and a student cannot tell it from a broken one.
        </p>
      )}

      {offeringId && (
        <label className="flex items-start gap-2 text-xs text-[#6b6076] dark:text-[#9c93ad]">
          <input type="checkbox" checked={thisTerm} className="mt-0.5"
            onChange={(e) => setThisTerm(e.target.checked)} />
          <span>
            <span className="font-medium text-[#33234a] dark:text-[#e4dcf0]">
              This term only
            </span>
            <span className="block">
              A recording or a week&rsquo;s slides belong to this term. An outline or a reading
              list belongs to the course and stands every year it runs — untick this for those,
              and it will not need re-uploading next August.
            </span>
          </span>
        </label>
      )}

      <button
        onClick={() => onSave({
          kind,
          title: title.trim(),
          week: week === '' ? null : Number(week),
          body: body.trim() || null,
          url: url.trim() || null,
          ...(material ? {} : { offeringId: thisTerm ? offeringId : null }),
        })}
        disabled={busy || !title.trim() || empty}
        className="w-full rounded-xl bg-[#422e59] px-4 py-2.5 text-sm font-medium text-white
                   hover:bg-[#322244] disabled:opacity-40"
      >
        {material ? 'Save' : 'Add it'}
      </button>
    </Dialog>
  );
}

function OutlineDialog({
  course: c, busy, onClose, onSave,
}: {
  course: Shelf; busy: boolean; onClose: () => void;
  onSave: (f: Record<string, unknown>) => void;
}) {
  const [outline, setOutline] = useState(c.outline ?? '');
  const [outcomes, setOutcomes] = useState(c.learning_outcomes ?? '');

  return (
    <Dialog title={`${c.course_code} — outline and outcomes`} onClose={onClose}>
      <p className="rounded-lg bg-[#faf8f4] p-3 text-xs text-[#6b6076] dark:bg-[#241f2c]
                    dark:text-[#9c93ad]">
        Both of these belong to the COURSE, not to this term — they stand for every year it runs,
        and do not need rewriting next August.
      </p>

      <Field label="Outline">
        <textarea value={outline} onChange={(e) => setOutline(e.target.value)} rows={6}
          placeholder="What the course covers, week by week." className={INPUT} />
      </Field>

      <Field label="Learning outcomes">
        <textarea value={outcomes} onChange={(e) => setOutcomes(e.target.value)} rows={5}
          placeholder="What a student can do after passing it." className={INPUT} />
        <p className="mt-1 text-xs text-[#a49bb0]">
          What an examiner writes a paper against, and what an accreditor asks to see.
        </p>
      </Field>

      <button
        onClick={() => onSave({
          outline: outline.trim() || null,
          learningOutcomes: outcomes.trim() || null,
        })}
        disabled={busy}
        className="w-full rounded-xl bg-[#422e59] px-4 py-2.5 text-sm font-medium text-white
                   hover:bg-[#322244] disabled:opacity-40"
      >
        Save
      </button>
    </Dialog>
  );
}

const INPUT = 'w-full rounded-xl border border-[#ded6c8] bg-white px-3 py-2 text-sm '
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
  title, onClose, children,
}: { title: string; onClose: () => void; children: React.ReactNode }) {
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
          <h3 className="font-heading text-lg font-bold text-[#422e59] dark:text-[#e4dcf0]">
            {title}
          </h3>
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
