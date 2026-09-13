'use client';

// ---------------------------------------------------------------------------
// ROOMS — where the University teaches.
//
// ---------------------------------------------------------------------------
// THESE ROOM NUMBERS WERE MADE UP, AND THE SCREEN SAYS SO
// ---------------------------------------------------------------------------
//
// The University asked: "Room numbers should be given by you and allow to be
// edited." So 064 seeds seventeen — BU-101, DL-LH1, ONLINE-1 — and marks every
// one PROVISIONAL.
//
// A plausible room code is a dangerous thing. It looks exactly like a checked
// one, and the first person to discover the difference is a student standing
// outside a door that is not there. So the difference is not left implicit: a
// seeded room carries the word "Placeholder" beside it, on the page, in every
// list, until somebody edits it.
//
// EDITING IT IS WHAT CONFIRMS IT. There is no separate "yes, this room is
// real" button, because a button like that is one more thing to forget. Open a
// room, correct anything about it, save — the label goes. A room the
// University typed in itself never had the label at all.
//
// ---------------------------------------------------------------------------
// CAPACITY IS BLANK ON PURPOSE, AND BLANK IS NOT ZERO
// ---------------------------------------------------------------------------
//
// Not one of the seeded rooms claims a capacity, because nobody has measured
// them. A wrong capacity is worse than none: a class capped at forty in a room
// that holds twenty puts twenty students in a corridor on the first morning of
// term. The column reads "Not measured" rather than "0".
//
// ---------------------------------------------------------------------------
// AND A ROOM IS RETIRED, NEVER DELETED
// ---------------------------------------------------------------------------
//
// `class_sections.room_id` is ON DELETE SET NULL. Deleting a room empties the
// room column of every class ever held in it — including last year's, which is
// the record of where an examination actually took place. Retiring takes it out
// of the pickers and leaves the history standing.
// ---------------------------------------------------------------------------

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { authedPost } from '@/lib/authedFetch';
import { can } from '@/lib/roles';
import { useAuth } from '@/contexts/AuthContext';
import {
  Card, EmptyState, PageHeader, SkeletonRows, TableShell, THead, TBody, Th, Td,
} from '@/components/ui/portal';
import {
  Plus, X, AlertTriangle, MapPin, Pencil, Archive, RotateCcw, Info,
} from 'lucide-react';
import { within } from './ProgrammeRegister';

// A SINGLE STRING LITERAL — concatenation collapses the inferred row type.
const ROOMS = 'id, code, name, campus, kind, capacity, active, provisional';
const SECTION = 'id, room_id';

const KINDS = ['room', 'lecture-hall', 'laboratory', 'studio', 'online'];
const KIND_LABEL: Record<string, string> = {
  room: 'Teaching room',
  'lecture-hall': 'Lecture hall',
  laboratory: 'Laboratory',
  studio: 'Studio',
  online: 'Online',
};

interface Room {
  id: string;
  code: string;
  name: string | null;
  campus: string | null;
  kind: string;
  capacity: number | null;
  active: boolean;
  provisional: boolean;
}

export default function Rooms() {
  const { user } = useAuth();
  const mayEdit = can(user?.role, 'manage-courses');

  const [rooms, setRooms] = useState<Room[] | null>(null);
  const [inUse, setInUse] = useState<Map<string, number>>(new Map());
  const [editing, setEditing] = useState<Room | 'new' | null>(null);
  const [showRetired, setShowRetired] = useState(false);
  const [note, setNote] = useState<{ tone: 'ok' | 'bad'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [rms, secs] = await within(Promise.all([
        supabase.from('rooms').select(ROOMS).order('campus').order('code'),
        supabase.from('class_sections').select(SECTION),
      ]));
      if (rms.error) { setFailed(rms.error.message); setRooms([]); return; }
      setFailed(null);
      setRooms((rms.data ?? []) as unknown as Room[]);

      // HOW MANY CLASSES ARE IN EACH, so retiring one can say what it leaves
      // behind rather than quietly removing it from the pickers.
      const counts = new Map<string, number>();
      const secRows = (secs.data ?? []) as unknown as { room_id: string | null }[];
      for (const s of secRows) {
        if (!s.room_id) continue;
        counts.set(s.room_id, (counts.get(s.room_id) ?? 0) + 1);
      }
      setInUse(counts);
    } catch (e) {
      setFailed(e instanceof Error ? e.message : 'The rooms could not be read.');
      setRooms([]);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function act(payload: Record<string, unknown>, said: string) {
    setBusy(true);
    setNote(null);
    const out = await authedPost('/api/academic/offerings', payload);
    setBusy(false);
    if (!out.ok) {
      setNote({ tone: 'bad', text: String(out.detail ?? out.error ?? 'That did not work.') });
      return false;
    }
    // A WARNING IS NOT A FAILURE, and is not shown as one — retiring a room
    // eleven classes still meet in succeeds, and says what it left behind.
    setNote(out.warning
      ? { tone: 'bad', text: String(out.warning) }
      : { tone: 'ok', text: said });
    await load();
    return true;
  }

  const shown = useMemo(
    () => (rooms ?? []).filter((r) => showRetired || r.active),
    [rooms, showRetired],
  );
  const byCampus = useMemo(() => {
    const m = new Map<string, Room[]>();
    for (const r of shown) {
      const key = r.campus ?? 'No campus recorded';
      m.set(key, [...(m.get(key) ?? []), r]);
    }
    return Array.from(m.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [shown]);

  const placeholders = (rooms ?? []).filter((r) => r.provisional && r.active).length;
  const retired = (rooms ?? []).filter((r) => !r.active).length;

  if (failed) {
    return (
      <Card>
        <EmptyState
          icon={<AlertTriangle size={20} />}
          title="The rooms could not be read"
          description={`${failed}. If migrations 063 and 064 have not been run on this database, `
            + 'the rooms table does not exist yet.'}
        />
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Rooms"
        subtitle="Where the University teaches. A class can only be checked for a room clash if it is in a room."
        action={mayEdit && (
          <button
            onClick={() => setEditing('new')}
            className="flex items-center gap-1.5 rounded-xl bg-[#422e59] px-4 py-2 text-sm
                       font-medium text-white hover:bg-[#322244]"
          >
            <Plus size={15} /> Add a room
          </button>
        )}
      />

      {/* ------------------------------------------------------------------
          THE STANDING NOTICE. It stays until the last placeholder is gone,
          and then it stops appearing on its own.
          ------------------------------------------------------------------ */}
      {placeholders > 0 && (
        <Card className="flex items-start gap-3 border-amber-200 bg-amber-50 p-4
                         dark:border-amber-900 dark:bg-amber-950/30">
          <Info size={16} className="mt-0.5 shrink-0 text-amber-700 dark:text-amber-300" />
          <div className="text-xs text-amber-800 dark:text-amber-200">
            <p className="font-semibold">
              {placeholders} of these room{placeholders === 1 ? ' is a placeholder' : 's are placeholders'}.
            </p>
            <p className="mt-1">
              The codes were made up so that classes could be given somewhere to be. They are on the
              campuses the University states — Buea, Douala and Online — but the numbers themselves
              are not real, and none of them claims a capacity, because nobody has measured them.
              Edit a room and the label goes: an edit is what marks it as checked.
            </p>
          </div>
        </Card>
      )}

      {note && (
        <div className={`rounded-xl border p-3 text-sm ${
          note.tone === 'ok'
            ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200'
            : 'border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200'
        }`}>
          {note.text}
        </div>
      )}

      {retired > 0 && (
        <label className="flex items-center gap-2 text-xs text-[#6b6076] dark:text-[#9c93ad]">
          <input
            type="checkbox"
            checked={showRetired}
            onChange={(e) => setShowRetired(e.target.checked)}
          />
          Show the {retired} retired room{retired === 1 ? '' : 's'}
        </label>
      )}

      {rooms === null && <Card className="overflow-hidden"><SkeletonRows rows={6} cols={5} /></Card>}

      {rooms !== null && shown.length === 0 && (
        <Card>
          <EmptyState
            icon={<MapPin size={20} />}
            title="No rooms are recorded"
            description={mayEdit
              ? 'Until a room exists, a class can be scheduled but not placed — and a room '
                + 'double-booking cannot be detected, because no class is in a room. '
                + 'Migration 064 seeds seventeen to start from.'
              : 'The University has not recorded its rooms yet.'}
          />
        </Card>
      )}

      {byCampus.map(([campus, list]) => (
        <div key={campus} className="space-y-3">
          <h2 className="flex items-center gap-1.5 font-heading text-sm font-bold uppercase
                         tracking-wide text-[#422e59] dark:text-[#c8b6e8]">
            <MapPin size={14} /> {campus}
            <span className="font-normal normal-case text-[#a49bb0]">
              · {list.length} room{list.length === 1 ? '' : 's'}
            </span>
          </h2>
          <Card className="overflow-hidden p-0">
            <TableShell>
              <THead>
                <tr>
                  <Th>Code</Th>
                  <Th>Name</Th>
                  <Th>Kind</Th>
                  <Th>Capacity</Th>
                  <Th>Classes</Th>
                  {mayEdit && <Th>{' '}</Th>}
                </tr>
              </THead>
              <TBody>
                {list.map((r) => (
                  <tr key={r.id} className={r.active ? '' : 'opacity-50'}>
                    <Td>
                      <span className="font-semibold text-[#422e59] dark:text-[#c8b6e8]">
                        {r.code}
                      </span>
                      {r.provisional && (
                        <span className="ml-2 rounded-full border border-amber-300 bg-amber-50 px-2
                                         py-0.5 text-[10px] font-medium text-amber-800
                                         dark:border-amber-800 dark:bg-amber-950/40
                                         dark:text-amber-200">
                          Placeholder
                        </span>
                      )}
                      {!r.active && (
                        <span className="ml-2 text-[10px] uppercase tracking-wide text-[#a49bb0]">
                          Retired
                        </span>
                      )}
                    </Td>
                    <Td>{r.name ?? '—'}</Td>
                    <Td>{KIND_LABEL[r.kind] ?? r.kind}</Td>
                    <Td>
                      {/* BLANK IS NOT ZERO, and is not printed as one. */}
                      {r.capacity === null
                        ? <span className="text-[#a49bb0]">Not measured</span>
                        : <span className="tabular-nums">{r.capacity}</span>}
                    </Td>
                    <Td>
                      <span className="tabular-nums">{inUse.get(r.id) ?? 0}</span>
                    </Td>
                    {mayEdit && (
                      <Td>
                        <div className="flex justify-end gap-1">
                          <button
                            onClick={() => setEditing(r)}
                            disabled={busy}
                            aria-label={`Edit ${r.code}`}
                            title="Edit — and editing is what marks a placeholder as checked"
                            className="rounded-lg p-1.5 text-[#6b6076] hover:bg-[#f2eee6]
                                       dark:text-[#9c93ad] dark:hover:bg-[#2a2333]"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={() => act(
                              { action: r.active ? 'room-retire' : 'room-restore', roomId: r.id },
                              r.active ? `${r.code} retired.` : `${r.code} is back in use.`,
                            )}
                            disabled={busy}
                            aria-label={r.active ? `Retire ${r.code}` : `Restore ${r.code}`}
                            title={r.active
                              ? 'Retire — it leaves the pickers, and every class ever held in it '
                                + 'keeps its record'
                              : 'Bring it back into use'}
                            className="rounded-lg p-1.5 text-[#6b6076] hover:bg-[#f2eee6]
                                       dark:text-[#9c93ad] dark:hover:bg-[#2a2333]"
                          >
                            {r.active ? <Archive size={14} /> : <RotateCcw size={14} />}
                          </button>
                        </div>
                      </Td>
                    )}
                  </tr>
                ))}
              </TBody>
            </TableShell>
          </Card>
        </div>
      ))}

      {editing && (
        <RoomDialog
          room={editing === 'new' ? null : editing}
          busy={busy}
          onClose={() => setEditing(null)}
          onSave={async (fields) => {
            const ok = editing === 'new'
              ? await act({ action: 'room', ...fields }, `${fields.code} recorded.`)
              : await act(
                { action: 'room-set', roomId: editing.id, ...fields },
                `${fields.code} saved. It is no longer marked as a placeholder.`,
              );
            if (ok) setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function RoomDialog({
  room, busy, onClose, onSave,
}: {
  room: Room | null;
  busy: boolean;
  onClose: () => void;
  onSave: (fields: Record<string, unknown>) => void;
}) {
  const [code, setCode] = useState(room?.code ?? '');
  const [name, setName] = useState(room?.name ?? '');
  const [campus, setCampus] = useState(room?.campus ?? '');
  const [kind, setKind] = useState(room?.kind ?? 'room');
  const [capacity, setCapacity] = useState(
    room?.capacity === null || room?.capacity === undefined ? '' : String(room.capacity),
  );

  const badCapacity = capacity !== '' && (!/^\d+$/.test(capacity) || Number(capacity) <= 0);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={room ? `Edit ${room.code}` : 'Add a room'}
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
              {room ? `Edit ${room.code}` : 'Add a room'}
            </h3>
            {room?.provisional && (
              <p className="text-xs text-amber-700 dark:text-amber-300">
                This one is a placeholder. Saving marks it as checked.
              </p>
            )}
          </div>
          <button onClick={onClose} aria-label="Close"
            className="rounded-lg p-1 hover:bg-[#f2eee6] dark:hover:bg-[#2a2333]">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          <Field label="Code">
            <input value={code} onChange={(e) => setCode(e.target.value)}
              placeholder="BU-101" className={INPUT} />
            <p className="mt-1 text-xs text-[#a49bb0]">
              What people call it. It goes on the timetable, so it is what a student reads when
              they are looking for the door.
            </p>
          </Field>

          <Field label="Name (optional)">
            <input value={name} onChange={(e) => setName(e.target.value)}
              placeholder="Teaching Room 101" className={INPUT} />
          </Field>

          <Field label="Campus">
            {/* THE CAMPUSES THE UNIVERSITY STATES, offered as a list — but the
                field stays free text, because a new campus is the University's
                to announce and a dropdown that refuses one would be this
                screen overruling it. */}
            <input value={campus} onChange={(e) => setCampus(e.target.value)}
              list="iguc-campuses" placeholder="Buea" className={INPUT} />
            <datalist id="iguc-campuses">
              <option value="Buea" />
              <option value="Douala" />
              <option value="Online" />
            </datalist>
          </Field>

          <Field label="Kind">
            <select value={kind} onChange={(e) => setKind(e.target.value)} className={INPUT}>
              {KINDS.map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
            </select>
          </Field>

          <Field label="Capacity">
            <input type="number" min={1} value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
              placeholder="Leave blank if nobody has measured it" className={INPUT} />
            <p className="mt-1 text-xs text-[#a49bb0]">
              Blank means not recorded, not zero. A wrong capacity is worse than none — a class
              capped at forty in a room that holds twenty puts twenty students in a corridor.
            </p>
            {badCapacity && (
              <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                A capacity is a whole number above zero, or blank.
              </p>
            )}
          </Field>

          <button
            onClick={() => onSave({
              code: code.trim(),
              name: name.trim() || null,
              campus: campus.trim() || null,
              kind,
              capacity: capacity === '' ? null : Number(capacity),
            })}
            disabled={busy || !code.trim() || badCapacity}
            className="w-full rounded-xl bg-[#422e59] px-4 py-2.5 text-sm font-medium text-white
                       hover:bg-[#322244] disabled:opacity-40"
          >
            {room ? 'Save' : 'Record it'}
          </button>
        </div>
      </div>
    </div>
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
