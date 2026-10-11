'use client';

// ---------------------------------------------------------------------------
// TRANSFER CREDITS — what another institution taught, and whether it counts.
//
// ---------------------------------------------------------------------------
// THE UNIVERSITY'S DECISION OF 16 SEPTEMBER 2026
// ---------------------------------------------------------------------------
//
//   "Credit transfer: YES. ICOF accepts transfer credits from other
//    institutions, and `transfer_credits` becomes a real workflow rather than
//    being retired. Approved credits join the authoritative academic record
//    and must reach programme progress, credit totals, graduation eligibility
//    and the transcript. They stay distinguishable from courses completed at
//    ICOF — that distinction is the point, not a detail."
//
// 019 built the table in 2025 and nothing opened it. This is the door.
//
// ---------------------------------------------------------------------------
// WHAT THE SCREEN HAS TO MAKE OBVIOUS
// ---------------------------------------------------------------------------
//
// 1. WHICH CREDITS ARE OURS AND WHICH ARE NOT. Every total on this screen is
//    shown as two numbers and a sum, never as one figure. That is the
//    University's ruling drawn rather than described.
//
// 2. THAT NOTHING COUNTS UNTIL SOMEBODY DECIDES. A recorded claim is a
//    student's assertion about another institution; it reaches the award at
//    the moment an officer accepts it and not before.
//
// 3. WHO MAY DO WHICH HALF. The Registry records; the Faculty Dean and the
//    Academic Office decide. Neither is offered the other's buttons — absent,
//    not greyed — and the route refuses them regardless.
// ---------------------------------------------------------------------------

import React from 'react';
import {
  ArrowLeftRight, Plus, Check, X, Undo2, Search, Eye, AlertTriangle, Building2, RefreshCw,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { can } from '@/lib/roles';
import { authedPost } from '@/lib/authedFetch';
import {
  Card, CardHeader, PageHeader, EmptyState, Skeleton,
} from '@/components/ui/portal';
import { BTN_PRIMARY, BTN_SECONDARY, INPUT, LABEL } from '@/lib/portalTheme';
import { TRANSFER_STATUS, transferStatusLabel } from '@/lib/transferCredit';

interface Claim {
  id: string;
  student_id: string;
  institution: string;
  course_code: string | null;
  course_title: string;
  credits: number;
  credits_accepted: number | null;
  status: string;
  source_grade: string | null;
  equivalent_course_id: string | null;
  decision_reason: string | null;
  decided_on: string | null;
  created_at: string;
}

interface Student {
  student_id: string;
  matric_no: string | null;
  full_name: string | null;
  programme_name: string | null;
  credits_required: number | null;
  credits_earned: number;
  credits_transferred: number;
  credits_total: number;
}

interface Course { id: string; code: string; title: string }

// eslint-disable-next-line max-len
const CLAIM_COLUMNS = 'id, student_id, institution, course_code, course_title, credits, credits_accepted, status, source_grade, equivalent_course_id, decision_reason, decided_on, created_at';
// eslint-disable-next-line max-len
const STUDENT_COLUMNS = 'student_id, matric_no, full_name, programme_name, credits_required, credits_earned, credits_transferred, credits_total';

const when = (iso: string | null) => (iso
  ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  : '—');

export default function TransferCredits() {
  const { user } = useAuth();
  const mayRecord = can(user?.role, 'record-transfer-credit');
  const mayDecide = can(user?.role, 'approve-transfers');

  const [claims, setClaims] = React.useState<Claim[] | null>(null);
  const [students, setStudents] = React.useState<Student[]>([]);
  const [courses, setCourses] = React.useState<Course[]>([]);
  const [q, setQ] = React.useState('');
  const [busy, setBusy] = React.useState<string | null>(null);
  const [note, setNote] = React.useState<{ tone: 'ok' | 'bad'; text: string } | null>(null);
  const [reason, setReason] = React.useState<Record<string, string>>({});
  const [taking, setTaking] = React.useState<Record<string, string>>({});
  const [adding, setAdding] = React.useState(false);
  const [form, setForm] = React.useState({
    studentId: '', institution: '', courseCode: '', courseTitle: '',
    credits: '', sourceGrade: '', courseId: '',
  });

  const load = React.useCallback(async () => {
    setClaims(null);
    const [c, s, co] = await Promise.all([
      supabase.from('transfer_credits').select(CLAIM_COLUMNS)
        .order('created_at', { ascending: false }).limit(1000),
      supabase.from('student_academic_record').select(STUDENT_COLUMNS)
        .order('full_name').limit(2000),
      supabase.from('courses').select('id, code, title').order('code').limit(2000),
    ]);
    if (c.error) setNote({ tone: 'bad', text: c.error.message });
    setClaims((c.data ?? []) as unknown as Claim[]);
    setStudents((s.data ?? []) as unknown as Student[]);
    setCourses((co.data ?? []) as unknown as Course[]);
  }, []);

  React.useEffect(() => { void load(); }, [load]);

  async function act(body: Record<string, unknown>, key: string) {
    setBusy(key); setNote(null);
    const out = await authedPost('/api/academic/transfer-credit', body);
    setBusy(null);
    setNote({
      tone: out.ok ? 'ok' : 'bad',
      text: String(out.detail ?? out.error ?? 'Nothing happened.'),
    });
    if (out.ok) { setAdding(false); setForm({ ...form, courseTitle: '', credits: '', courseCode: '' }); }
    await load();
  }

  const byId = new Map(students.map((s) => [s.student_id, s]));
  const courseById = new Map(courses.map((c) => [c.id, c]));

  const needle = q.trim().toLowerCase();
  const visible = (claims ?? []).filter((c) => {
    if (!needle) return true;
    const s = byId.get(c.student_id);
    return [c.institution, c.course_title, c.course_code, s?.full_name, s?.matric_no]
      .some((f) => (f ?? '').toLowerCase().includes(needle));
  });

  const waiting = visible.filter((c) => c.status === 'submitted' || c.status === 'under_review');
  const settled = visible.filter((c) => !['submitted', 'under_review'].includes(c.status));

  if (!mayRecord && !mayDecide) {
    return (
      <Card className="p-5">
        <p className="flex items-start gap-2 text-sm text-[#6b6076] dark:text-[#9c93ad]">
          <AlertTriangle size={16} className="mt-0.5 flex-shrink-0 text-[#a3283f]" />
          <span>
            Recording a transfer credit is the Office of the Registrar&rsquo;s, and deciding one
            is the Faculty Dean&rsquo;s and the Academic Office&rsquo;s.
          </span>
        </p>
      </Card>
    );
  }

  // THE STUDENT'S CREDIT, SHOWN AS TWO NUMBERS AND A SUM. Never one figure:
  // the University's ruling is that the two stay distinguishable, and a
  // single total would lose exactly the thing they said was the point.
  const split = (s: Student | undefined) => {
    if (!s) return null;
    return (
      <span className="text-xs text-[#6b6076] dark:text-[#9c93ad]">
        {s.credits_earned} at ICOF + {s.credits_transferred} transferred ={' '}
        <strong className="text-[#422e59] dark:text-[#e4dcf0]">{s.credits_total}</strong>
        {s.credits_required ? ` of ${s.credits_required}` : ''}
      </span>
    );
  };

  const row = (c: Claim) => {
    const s = byId.get(c.student_id);
    const course = c.equivalent_course_id ? courseById.get(c.equivalent_course_id) : undefined;
    const meta = TRANSFER_STATUS[c.status];
    return (
      <li key={c.id} className="space-y-2 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-medium text-[#422e59] dark:text-[#e4dcf0]">
              {s?.full_name || 'Unknown student'}
              <span className="ml-2 text-xs font-normal text-[#6b6076] dark:text-[#9c93ad]">
                {s?.matric_no}
                {s?.programme_name ? ` · ${s.programme_name}` : ''}
              </span>
            </p>
            <p className="flex flex-wrap items-center gap-1.5 text-sm text-[#6b6076] dark:text-[#9c93ad]">
              <Building2 size={13} className="flex-shrink-0" />
              {c.institution}
              {' · '}
              {c.course_code ? `${c.course_code} ` : ''}{c.course_title}
              {' · '}
              {c.credits} credits offered
              {c.source_grade ? ` · graded ${c.source_grade} there` : ''}
            </p>
            <p className="text-xs text-[#6b6076] dark:text-[#9c93ad]">
              {/* WHAT IT STANDS FOR. An unmapped credit is general credit
                  toward the award and counts just the same; it simply cannot
                  fill a particular hole in the curriculum. */}
              {course
                ? `Stands for ${course.code} ${course.title}`
                : 'General credit toward the award — not against a particular course'}
              {' · recorded '}{when(c.created_at)}
              {c.decided_on ? ` · decided ${when(c.decided_on)}` : ''}
            </p>
            {c.decision_reason && (
              <p className="mt-1 text-xs italic text-[#6b6076] dark:text-[#9c93ad]">
                &ldquo;{c.decision_reason}&rdquo;
              </p>
            )}
            {s && <p className="mt-1">{split(s)}</p>}
          </div>
          <span className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${meta?.className ?? 'bg-gray-100 text-[#6b6076]'}`}>
            {transferStatusLabel(c.status)}
            {c.credits_accepted !== null ? ` · ${c.credits_accepted} counted` : ''}
          </span>
        </div>

        {/* ---- WHAT THIS OFFICE MAY DO WITH IT ------------------------- */}
        {c.status === 'submitted' && mayRecord && (
          <div className="flex flex-wrap gap-2">
            <button type="button" className={BTN_SECONDARY} disabled={busy === c.id}
              onClick={() => void act({ action: 'review', id: c.id }, c.id)}>
              <Eye size={14} /> Send to the Dean
            </button>
            <button type="button" className={BTN_SECONDARY} disabled={busy === c.id}
              onClick={() => void act({ action: 'withdraw', id: c.id }, c.id)}>
              <Undo2 size={14} /> Withdraw
            </button>
          </div>
        )}

        {c.status === 'under_review' && mayDecide && (
          <div className="space-y-2 rounded-lg bg-[#faf8fd] p-3 dark:bg-[#231d2b]">
            <div className="flex flex-wrap items-end gap-2">
              <label className="block">
                <span className={LABEL}>Credits to accept</span>
                <input
                  className={`${INPUT} w-32`} inputMode="decimal"
                  placeholder={String(c.credits)}
                  value={taking[c.id] ?? ''}
                  onChange={(e) => setTaking({ ...taking, [c.id]: e.target.value })}
                />
              </label>
              <p className="pb-2 text-xs text-[#6b6076] dark:text-[#9c93ad]">
                Leave it blank to accept all {c.credits}. The University may accept fewer
                credits than another institution gave, and never more.
              </p>
            </div>
            <label className="block">
              <span className={LABEL}>
                Reason — required to refuse, kept either way
              </span>
              <input className={INPUT} value={reason[c.id] ?? ''}
                onChange={(e) => setReason({ ...reason, [c.id]: e.target.value })} />
            </label>
            <div className="flex flex-wrap gap-2">
              <button type="button" className={BTN_PRIMARY} disabled={busy === c.id}
                onClick={() => void act({
                  action: 'accept',
                  id: c.id,
                  reason: reason[c.id] ?? '',
                  ...(taking[c.id] ? { creditsAccepted: Number(taking[c.id]) } : {}),
                }, c.id)}>
                <Check size={14} /> Accept — counts toward the award at once
              </button>
              <button type="button" className={BTN_SECONDARY} disabled={busy === c.id}
                onClick={() => void act(
                  { action: 'refuse', id: c.id, reason: reason[c.id] ?? '' }, c.id,
                )}>
                <X size={14} /> Refuse
              </button>
            </div>
          </div>
        )}

        {c.status === 'under_review' && !mayDecide && (
          <p className="text-xs text-[#6b6076] dark:text-[#9c93ad]">
            The Faculty Dean or the Academic Office decides this one.
          </p>
        )}

        {/* RESCINDING AN ACCEPTED CREDIT. Rare, and the reason this screen
            offers it at all is that the alternative to a recorded rescission
            is somebody editing the row quietly. */}
        {c.status === 'accepted' && mayDecide && (
          <div className="flex flex-wrap items-end gap-2">
            <label className="block flex-1">
              <span className={LABEL}>
                To take this credit back out of the record, say why
              </span>
              <input className={INPUT} value={reason[c.id] ?? ''}
                onChange={(e) => setReason({ ...reason, [c.id]: e.target.value })} />
            </label>
            <button type="button" className={BTN_SECONDARY} disabled={busy === c.id}
              onClick={() => void act(
                { action: 'rescind', id: c.id, reason: reason[c.id] ?? '' }, c.id,
              )}>
              <Undo2 size={14} /> Rescind
            </button>
          </div>
        )}
      </li>
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Transfer credits"
        subtitle="What another institution taught, and whether it counts toward an ICOF award"
      />

      {note && (
        <Card className={`p-4 text-sm ${note.tone === 'ok'
          ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
          : 'border-red-200 bg-red-50 text-red-800'}`}
        >
          <p>{note.text}</p>
        </Card>
      )}

      <Card className="p-5">
        <p className="text-sm text-[#6b6076] dark:text-[#9c93ad]">
          <strong className="text-[#422e59] dark:text-[#e4dcf0]">
            An accepted transfer credit counts toward the award and never toward the GPA.
          </strong>{' '}
          ICOF&rsquo;s cumulative GPA is a measure of ICOF&rsquo;s own teaching, computed against
          the scale the Senate published; another institution&rsquo;s grade is recorded on the
          file and scored by nothing. Every total on this screen is shown as two numbers and a
          sum, because keeping the two apart is the University&rsquo;s ruling and not a detail
          of it.
        </p>
      </Card>

      {/* ==================================================================
          RECORDING ONE
          ================================================================== */}
      {mayRecord && (
        <Card>
          <CardHeader
            title="Record a claim"
            subtitle="What the student presented. Nothing counts until an officer accepts it"
            action={(
              <button type="button" className={BTN_SECONDARY} onClick={() => setAdding(!adding)}>
                <Plus size={14} /> {adding ? 'Close' : 'New claim'}
              </button>
            )}
          />
          {adding && (
            <div className="grid gap-3 p-5 md:grid-cols-2 lg:grid-cols-3">
              <label className="block">
                <span className={LABEL}>Student</span>
                <select className={INPUT} value={form.studentId}
                  onChange={(e) => setForm({ ...form, studentId: e.target.value })}>
                  <option value="">Choose…</option>
                  {students.map((s) => (
                    <option key={s.student_id} value={s.student_id}>
                      {s.full_name} {s.matric_no ? `· ${s.matric_no}` : ''}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className={LABEL}>Institution that taught it</span>
                <input className={INPUT} value={form.institution}
                  onChange={(e) => setForm({ ...form, institution: e.target.value })} />
              </label>
              <label className="block">
                <span className={LABEL}>Their course code</span>
                <input className={INPUT} value={form.courseCode}
                  onChange={(e) => setForm({ ...form, courseCode: e.target.value })} />
              </label>
              <label className="block">
                <span className={LABEL}>Course title</span>
                <input className={INPUT} value={form.courseTitle}
                  onChange={(e) => setForm({ ...form, courseTitle: e.target.value })} />
              </label>
              <label className="block">
                <span className={LABEL}>Credits they gave</span>
                <input className={INPUT} inputMode="decimal" value={form.credits}
                  onChange={(e) => setForm({ ...form, credits: e.target.value })} />
              </label>
              <label className="block">
                <span className={LABEL}>Their grade — recorded, never scored</span>
                <input className={INPUT} value={form.sourceGrade}
                  onChange={(e) => setForm({ ...form, sourceGrade: e.target.value })} />
              </label>
              <label className="block md:col-span-2">
                <span className={LABEL}>
                  Stands for which ICOF course? Leave blank for general credit
                </span>
                <select className={INPUT} value={form.courseId}
                  onChange={(e) => setForm({ ...form, courseId: e.target.value })}>
                  <option value="">General credit toward the award</option>
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>{c.code} · {c.title}</option>
                  ))}
                </select>
              </label>
              <div className="flex items-end">
                <button type="button" className={BTN_PRIMARY} disabled={busy === 'record'}
                  onClick={() => void act({
                    action: 'record',
                    studentId: form.studentId,
                    institution: form.institution,
                    courseCode: form.courseCode,
                    courseTitle: form.courseTitle,
                    credits: Number(form.credits),
                    sourceGrade: form.sourceGrade,
                    courseId: form.courseId,
                  }, 'record')}>
                  <Plus size={14} /> Record it
                </button>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* ==================================================================
          WAITING ON A DECISION
          ================================================================== */}
      <Card>
        <CardHeader
          title="Waiting on a decision"
          subtitle={claims ? `${waiting.length} claim${waiting.length === 1 ? '' : 's'} counting for nothing until somebody decides` : 'Reading…'}
          action={(
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#9c93ad]" />
                <input className={`${INPUT} pl-9`} placeholder="Student, institution or course"
                  aria-label="Search the claims"
                  value={q} onChange={(e) => setQ(e.target.value)} />
              </div>
              <button type="button" className={BTN_SECONDARY} onClick={() => void load()}>
                <RefreshCw size={14} />
              </button>
            </div>
          )}
        />
        {claims === null && <div className="p-5"><Skeleton className="h-4 w-2/3" /></div>}
        {claims !== null && waiting.length === 0 && (
          <EmptyState
            icon={<ArrowLeftRight size={20} />}
            title="Nothing is waiting"
            description="A claim is recorded here by the Office of the Registrar and decided by the Faculty Dean or the Academic Office."
          />
        )}
        {waiting.length > 0 && (
          <ul className="divide-y divide-[#ece7f3] dark:divide-[#332b3d]">{waiting.map(row)}</ul>
        )}
      </Card>

      {/* ==================================================================
          AND WHAT HAS BEEN DECIDED
          ================================================================== */}
      {settled.length > 0 && (
        <Card>
          <CardHeader
            title="Decided"
            subtitle="Accepted credit counts toward the award; refused, withdrawn and rescinded claims stay on the file saying so"
          />
          <ul className="divide-y divide-[#ece7f3] dark:divide-[#332b3d]">{settled.map(row)}</ul>
        </Card>
      )}
    </div>
  );
}
