'use client';

// ---------------------------------------------------------------------------
// SCHOOLS & DEPARTMENTS — the top of the tree.
//
// ---------------------------------------------------------------------------
// WHAT WAS INVISIBLE
// ---------------------------------------------------------------------------
//
// The University drew the tree itself:
//
//   University → School / Faculty → Department → Study Programme → Curriculum
//   → Course → Offering → Class → Registration → Result → Transcript
//
// Everything from Study Programme down has had a screen since 057 and 063. The
// top two had none. `schools` was seeded by 060 and written by nothing;
// `departments` has existed since migration 001 with no way to create one.
//
// So the portal could show forty-one programmes and not the five schools they
// belong to — which is precisely the objection the University raised about the
// Academic section in the first place: organised around utilities rather than
// around the University's actual structure.
//
// ---------------------------------------------------------------------------
// THE TREE IS DRAWN AS A TREE
// ---------------------------------------------------------------------------
//
// A school, its departments beneath it, and the count of programmes hanging
// from each. A flat table of schools and a second flat table of departments
// would be two lists of the same shape as the screens this replaces — and the
// relationship between them, which is the whole point, would be invisible
// again.
//
// A DEPARTMENT WITH NO SCHOOL IS SHOWN, NOT HIDDEN. 001 created departments
// years before 057 created schools, so live rows have no `school_id`. They are
// gathered at the foot under their own heading, because a department nobody
// can find is a department whose lecturers and courses are attached to nothing
// anyone can see.
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
  AlertTriangle, Plus, X, Pencil, Archive, RotateCcw, Building2, Info,
} from 'lucide-react';
import { within } from './ProgrammeRegister';

// SINGLE STRING LITERALS — concatenation collapses the inferred row type.
const SCHOOLS = 'id, code, name, mission, status';
const DEPTS = 'id, name, code, faculty, head_name, school_id, status';
const VERSIONS = 'id, programme_id, school_id, department_id, name, status';

interface School {
  id: string; code: string; name: string; mission: string | null; status: string;
}
interface Dept {
  id: string; name: string; code: string; faculty: string | null;
  head_name: string | null; school_id: string | null; status: string;
}
interface Version {
  id: string; programme_id: string; school_id: string | null;
  department_id: string | null; name: string | null; status: string;
}

const STATUSES = ['active', 'suspended', 'archived'];
const STATUS_MEANS: Record<string, string> = {
  active: 'Teaching.',
  suspended: 'Not taking students at present. Nothing is detached.',
  archived: 'No longer taught. Kept because a graduate’s transcript names it.',
};

export default function AcademicStructure() {
  const { user } = useAuth();
  const mayEdit = can(user?.role, 'manage-academic-structure');

  const [schools, setSchools] = useState<School[] | null>(null);
  const [depts, setDepts] = useState<Dept[]>([]);
  const [versions, setVersions] = useState<Version[]>([]);
  const [note, setNote] = useState<{ tone: 'ok' | 'bad'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [editSchool, setEditSchool] = useState<School | 'new' | null>(null);
  const [editDept, setEditDept] = useState<Dept | { schoolId: string | null } | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  const load = useCallback(async () => {
    try {
      const [sc, dp, vs] = await within(Promise.all([
        supabase.from('schools').select(SCHOOLS).order('name'),
        supabase.from('departments').select(DEPTS).order('name'),
        supabase.from('programme_versions').select(VERSIONS),
      ]));
      if (sc.error) { setFailed(sc.error.message); setSchools([]); return; }
      setFailed(null);
      setSchools((sc.data ?? []) as unknown as School[]);
      setDepts((dp.data ?? []) as unknown as Dept[]);
      setVersions((vs.data ?? []) as unknown as Version[]);
    } catch (e) {
      setFailed(e instanceof Error ? e.message : 'The academic structure could not be read.');
      setSchools([]);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function act(payload: Record<string, unknown>) {
    setBusy(true);
    setNote(null);
    const out = await authedPost('/api/academic/structure', payload);
    setBusy(false);
    if (!out.ok) {
      setNote({ tone: 'bad', text: String(out.detail ?? out.error ?? 'That did not work.') });
      return false;
    }
    // A WARNING IS NOT A FAILURE. Archiving a school that still has programmes
    // succeeds, and says what it left behind.
    setNote(out.warning
      ? { tone: 'bad', text: `${out.detail ?? 'Saved.'} ${out.warning}` }
      : { tone: 'ok', text: String(out.detail ?? 'Saved.') });
    await load();
    return true;
  }

  // HOW MANY PROGRAMMES HANG OFF EACH. Counted from programme_versions, which
  // is where 057 put school_id and department_id — the programme itself
  // carries neither, because which school teaches a programme can change
  // between versions.
  const bySchool = useMemo(() => {
    const m = new Map<string, number>();
    for (const v of versions) {
      if (!v.school_id) continue;
      m.set(v.school_id, (m.get(v.school_id) ?? 0) + 1);
    }
    return m;
  }, [versions]);
  const byDept = useMemo(() => {
    const m = new Map<string, number>();
    for (const v of versions) {
      if (!v.department_id) continue;
      m.set(v.department_id, (m.get(v.department_id) ?? 0) + 1);
    }
    return m;
  }, [versions]);

  const deptsOf = useMemo(() => {
    const m = new Map<string, Dept[]>();
    for (const d of depts) {
      if (!d.school_id) continue;
      m.set(d.school_id, [...(m.get(d.school_id) ?? []), d]);
    }
    return m;
  }, [depts]);

  // See the header: a department with no school is shown, not hidden.
  const orphans = useMemo(() => depts.filter((d) => !d.school_id), [depts]);

  const visibleSchools = useMemo(
    () => (schools ?? []).filter((s) => showArchived || s.status !== 'archived'),
    [schools, showArchived],
  );
  const archivedCount = (schools ?? []).filter((s) => s.status === 'archived').length;

  if (failed) {
    return (
      <Card>
        <EmptyState
          icon={<AlertTriangle size={20} />}
          title="The academic structure could not be read"
          description={`${failed}. If migration 057 has not been run on this database, the schools `
            + 'table does not exist yet.'}
        />
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Schools & departments"
        subtitle="The top of the academic tree: what the University is organised into, and what hangs from each part."
        action={mayEdit && (
          <button
            onClick={() => setEditSchool('new')}
            className="flex items-center gap-1.5 rounded-xl bg-[#422e59] px-4 py-2 text-sm
                       font-medium text-white hover:bg-[#322244]"
          >
            <Plus size={15} /> Add a school
          </button>
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

      {archivedCount > 0 && (
        <label className="flex items-center gap-2 text-xs text-[#6b6076] dark:text-[#9c93ad]">
          <input type="checkbox" checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)} />
          Show the {archivedCount} archived school{archivedCount === 1 ? '' : 's'}
        </label>
      )}

      {schools === null && <Card className="overflow-hidden"><SkeletonRows rows={5} cols={3} /></Card>}

      {schools !== null && visibleSchools.length === 0 && (
        <Card>
          <EmptyState
            icon={<Building2 size={20} />}
            title="No schools recorded"
            description={mayEdit
              ? 'A school is the top of the academic tree — a programme belongs to a department, '
                + 'and a department to a school. Add one to begin.'
              : 'The University has not recorded its schools yet.'}
          />
        </Card>
      )}

      {/* THE TREE. A school, its departments beneath it. */}
      <div className="space-y-4">
        {visibleSchools.map((s) => {
          const mine = (deptsOf.get(s.id) ?? [])
            .filter((d) => showArchived || d.status !== 'archived');
          return (
            <Card key={s.id} className={`p-5 ${s.status !== 'active' ? 'opacity-70' : ''}`}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <h2 className="font-heading text-base font-bold text-[#33234a] dark:text-[#e4dcf0]">
                    {s.name}
                    <span className="ml-2 text-xs font-normal text-[#a49bb0]">{s.code}</span>
                    {s.status !== 'active' && (
                      <span className="ml-2 rounded-full border border-[#ded6c8] px-2 py-0.5
                                       text-[10px] uppercase tracking-wide text-[#6b6076]
                                       dark:border-[#3d3349] dark:text-[#9c93ad]">
                        {s.status}
                      </span>
                    )}
                  </h2>
                  {s.mission && (
                    <p className="mt-1 max-w-2xl text-xs text-[#6b6076] dark:text-[#9c93ad]">
                      {s.mission}
                    </p>
                  )}
                  <p className="mt-1 text-[11px] text-[#a49bb0] dark:text-[#7b7289]">
                    {mine.length} department{mine.length === 1 ? '' : 's'}
                    {' · '}
                    {bySchool.get(s.id) ?? 0} programme version
                    {(bySchool.get(s.id) ?? 0) === 1 ? '' : 's'}
                  </p>
                </div>

                {mayEdit && (
                  <div className="flex shrink-0 items-center gap-1">
                    <select
                      value={s.status}
                      disabled={busy}
                      aria-label={`Status of ${s.name}`}
                      title={STATUS_MEANS[s.status]}
                      onChange={(e) => act({
                        action: 'school-status', schoolId: s.id, status: e.target.value,
                      })}
                      className="rounded-xl border border-[#ded6c8] bg-white px-2 py-1.5 text-xs
                                 dark:border-[#3d3349] dark:bg-[#241f2c]"
                    >
                      {STATUSES.map((x) => <option key={x} value={x}>{x}</option>)}
                    </select>
                    <button
                      onClick={() => setEditSchool(s)}
                      aria-label={`Edit ${s.name}`}
                      className="rounded-lg p-1.5 text-[#6b6076] hover:bg-[#f2eee6]
                                 dark:text-[#9c93ad] dark:hover:bg-[#2a2333]"
                    >
                      <Pencil size={14} />
                    </button>
                  </div>
                )}
              </div>

              <div className="mt-4 space-y-1.5">
                {mine.length === 0 && (
                  <p className="rounded-lg border border-dashed border-[#ded6c8] p-3 text-center
                                text-xs text-[#a49bb0] dark:border-[#3d3349] dark:text-[#7b7289]">
                    No departments in this school. A programme belongs to a department, so nothing
                    can be taught here until there is one.
                  </p>
                )}
                {mine.map((d) => (
                  <DeptRow
                    key={d.id}
                    dept={d}
                    programmes={byDept.get(d.id) ?? 0}
                    mayEdit={mayEdit}
                    busy={busy}
                    onEdit={() => setEditDept(d)}
                    onStatus={(st) => act({
                      action: 'dept-status', departmentId: d.id, status: st,
                    })}
                  />
                ))}
                {mayEdit && (
                  <button
                    onClick={() => setEditDept({ schoolId: s.id })}
                    className="flex w-full items-center justify-center gap-1.5 rounded-lg border
                               border-dashed border-[#ded6c8] py-2 text-xs font-medium
                               text-[#6b6076] hover:border-[#422e59] hover:text-[#422e59]
                               dark:border-[#3d3349] dark:text-[#9c93ad]"
                  >
                    <Plus size={13} /> Add a department
                  </button>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      {/* ------------------------------------------------------------------
          DEPARTMENTS THAT BELONG TO NO SCHOOL.

          001 created departments years before 057 created schools, so live
          rows have no school_id. Hidden, they would be departments whose
          lecturers and courses hang from something nobody can see.
          ------------------------------------------------------------------ */}
      {orphans.length > 0 && (
        <Card className="p-5">
          <h2 className="flex items-center gap-2 font-heading text-sm font-bold text-amber-800
                         dark:text-amber-200">
            <Info size={15} />
            {orphans.length} department{orphans.length === 1 ? '' : 's'} belong
            {orphans.length === 1 ? 's' : ''} to no school
          </h2>
          <p className="mt-1 text-xs text-[#6b6076] dark:text-[#9c93ad]">
            Departments have existed since the system was built; schools were added later. These
            were created before there was a school to put them in. Edit one to attach it.
          </p>
          <div className="mt-3 space-y-1.5">
            {orphans.map((d) => (
              <DeptRow
                key={d.id}
                dept={d}
                programmes={byDept.get(d.id) ?? 0}
                mayEdit={mayEdit}
                busy={busy}
                onEdit={() => setEditDept(d)}
                onStatus={(st) => act({
                  action: 'dept-status', departmentId: d.id, status: st,
                })}
              />
            ))}
          </div>
        </Card>
      )}

      {editSchool && (
        <SchoolDialog
          school={editSchool === 'new' ? null : editSchool}
          busy={busy}
          onClose={() => setEditSchool(null)}
          onSave={async (fields) => {
            const ok = editSchool === 'new'
              ? await act({ action: 'school-add', ...fields })
              : await act({ action: 'school-set', schoolId: editSchool.id, ...fields });
            if (ok) setEditSchool(null);
          }}
        />
      )}

      {editDept && (
        <DeptDialog
          dept={'id' in editDept ? editDept : null}
          schoolId={'id' in editDept ? editDept.school_id : editDept.schoolId}
          schools={(schools ?? []).filter((s) => s.status !== 'archived')}
          busy={busy}
          onClose={() => setEditDept(null)}
          onSave={async (fields) => {
            const ok = 'id' in editDept
              ? await act({ action: 'dept-set', departmentId: editDept.id, ...fields })
              : await act({ action: 'dept-add', ...fields });
            if (ok) setEditDept(null);
          }}
        />
      )}
    </div>
  );
}

function DeptRow({
  dept: d, programmes, mayEdit, busy, onEdit, onStatus,
}: {
  dept: Dept; programmes: number; mayEdit: boolean; busy: boolean;
  onEdit: () => void; onStatus: (s: string) => void;
}) {
  return (
    <div className={`flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg px-3 py-2 text-xs ${
      d.status === 'active' ? 'bg-[#faf8f4] dark:bg-[#241f2c]' : 'bg-[#f4f1ea] opacity-70 dark:bg-[#1d1926]'
    }`}>
      <span className="w-16 shrink-0 font-semibold text-[#422e59] dark:text-[#c8b6e8]">
        {d.code}
      </span>
      <span className="min-w-0 flex-1 truncate text-[#33234a] dark:text-[#e4dcf0]">{d.name}</span>
      {d.head_name && (
        <span className="text-[#6b6076] dark:text-[#9c93ad]">{d.head_name}</span>
      )}
      <span className="text-[#a49bb0]">
        {programmes} programme{programmes === 1 ? '' : 's'}
      </span>
      {d.status !== 'active' && (
        <span className="text-[10px] uppercase tracking-wide text-[#a49bb0]">{d.status}</span>
      )}
      {mayEdit && (
        <span className="ml-auto flex shrink-0 gap-1">
          <button
            onClick={onEdit}
            aria-label={`Edit ${d.name}`}
            className="rounded p-1 text-[#a49bb0] hover:bg-[#f2eee6] hover:text-[#422e59]
                       dark:hover:bg-[#2a2333]"
          >
            <Pencil size={13} />
          </button>
          <button
            onClick={() => onStatus(d.status === 'archived' ? 'active' : 'archived')}
            disabled={busy}
            aria-label={d.status === 'archived' ? `Restore ${d.name}` : `Archive ${d.name}`}
            title={d.status === 'archived'
              ? 'Bring it back into use'
              : 'Archive — nothing is detached, and a transcript naming it still reads'}
            className="rounded p-1 text-[#a49bb0] hover:bg-[#f2eee6] hover:text-[#422e59]
                       dark:hover:bg-[#2a2333]"
          >
            {d.status === 'archived' ? <RotateCcw size={13} /> : <Archive size={13} />}
          </button>
        </span>
      )}
    </div>
  );
}

function SchoolDialog({
  school, busy, onClose, onSave,
}: {
  school: School | null; busy: boolean;
  onClose: () => void; onSave: (f: Record<string, unknown>) => void;
}) {
  const [code, setCode] = useState(school?.code ?? '');
  const [name, setName] = useState(school?.name ?? '');
  const [mission, setMission] = useState(school?.mission ?? '');
  const badCode = !school && !/^[a-z][a-z0-9-]{1,31}$/.test(code);
  const badName = name.trim().length < 4;

  return (
    <Dialog title={school ? `Edit ${school.name}` : 'Add a school'} onClose={onClose}>
      {!school && (
        <Field label="Code">
          <input value={code} onChange={(e) => setCode(e.target.value.toLowerCase())}
            placeholder="theology" className={INPUT} />
          <p className="mt-1 text-xs text-[#a49bb0]">
            Lowercase letters, digits and hyphens. It appears in programme codes and in URLs,
            which is why it is not the full name — and it cannot be changed afterwards, because
            documents already issued refer to it.
          </p>
          {badCode && code !== '' && (
            <p className="mt-1 text-xs text-red-600 dark:text-red-400">
              Letters, digits and hyphens only, starting with a letter.
            </p>
          )}
        </Field>
      )}

      <Field label="Full name">
        <input value={name} onChange={(e) => setName(e.target.value)}
          placeholder="Faculty of Theology" className={INPUT} />
        <p className="mt-1 text-xs text-[#a49bb0]">
          As it is printed on a programme page and on a transcript.
        </p>
      </Field>

      <Field label="Mission (optional)">
        <textarea value={mission} onChange={(e) => setMission(e.target.value)}
          rows={3} className={INPUT} />
      </Field>

      <button
        onClick={() => onSave(school
          ? { name: name.trim(), mission: mission.trim() || null }
          : { code, name: name.trim(), mission: mission.trim() || null })}
        disabled={busy || badName || (!school && badCode)}
        className="w-full rounded-xl bg-[#422e59] px-4 py-2.5 text-sm font-medium text-white
                   hover:bg-[#322244] disabled:opacity-40"
      >
        {school ? 'Save' : 'Create it'}
      </button>
    </Dialog>
  );
}

function DeptDialog({
  dept, schoolId, schools, busy, onClose, onSave,
}: {
  dept: Dept | null; schoolId: string | null; schools: School[]; busy: boolean;
  onClose: () => void; onSave: (f: Record<string, unknown>) => void;
}) {
  const [name, setName] = useState(dept?.name ?? '');
  const [code, setCode] = useState(dept?.code ?? '');
  const [head, setHead] = useState(dept?.head_name ?? '');
  const [school, setSchool] = useState(schoolId ?? '');

  return (
    <Dialog title={dept ? `Edit ${dept.name}` : 'Add a department'} onClose={onClose}>
      <Field label="Name">
        <input value={name} onChange={(e) => setName(e.target.value)}
          placeholder="Department of Theology" className={INPUT} />
      </Field>

      <Field label="Code">
        <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="THE" className={INPUT} />
      </Field>

      <Field label="School">
        <select value={school} onChange={(e) => setSchool(e.target.value)} className={INPUT}>
          <option value="">No school</option>
          {schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        {!school && (
          <p className="mt-1 text-xs text-[#a49bb0]">
            A department with no school sits outside the tree. It still works, but nobody browsing
            the University&rsquo;s structure will find it.
          </p>
        )}
      </Field>

      <Field label="Head of department (optional)">
        <input value={head} onChange={(e) => setHead(e.target.value)} className={INPUT} />
      </Field>

      <button
        onClick={() => onSave({
          name: name.trim(),
          code: code.trim(),
          schoolId: school || null,
          headName: head.trim() || null,
        })}
        disabled={busy || name.trim().length < 3 || code.trim().length === 0}
        className="w-full rounded-xl bg-[#422e59] px-4 py-2.5 text-sm font-medium text-white
                   hover:bg-[#322244] disabled:opacity-40"
      >
        {dept ? 'Save' : 'Create it'}
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
}: {
  title: string; onClose: () => void; children: React.ReactNode;
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
