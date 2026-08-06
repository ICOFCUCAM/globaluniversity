// ---------------------------------------------------------------------------
// Where the portal modules keep their data.
//
// WHAT THIS REPLACED, AND WHY IT COULD NEVER HAVE WORKED.
//
// Seven modules — LMS, forum, timetable, question bank, assignments,
// announcements and insights — stored their records in the `documents` table.
// That table is declared:
//
//     student_id  uuid NOT NULL references students (id) on delete cascade
//     file_name   text NOT NULL
//     file_url    text NOT NULL
//
// It models a file belonging to a student. A timetable slot does not belong to
// a student, and neither does a forum thread, an exam question or an
// announcement. So the modules put a display label in `file_name` and
// base64-encoded JSON in `file_url`, and never set `student_id` — thirteen of
// the fourteen write sites did not set it at all.
//
// Every one of those inserts was rejected by the NOT NULL constraint. Not by
// row-level security, which would at least have been fixable with a policy:
// the rows were never valid. supabase-js returns errors rather than throwing,
// so the screens showed a spinner, stopped, and looked like they had saved.
//
// The `on delete cascade` is what would have hurt eventually. Had a write ever
// succeeded by borrowing some student's id, removing that student would have
// deleted the university's timetable.
//
// WHY BASE64 JSON IN A URL COLUMN IS GONE TOO. `body` is jsonb. The old
// encoding meant no record in this system could be queried, counted or grouped
// by anything inside it — the insights module had to fetch every row and decode
// it in the browser to count attendance. It also meant a corrupt row was
// invisible: `dec()` threw, the module caught it, and the record silently
// vanished from the list.
//
// migration 010 creates `module_records`.
// ---------------------------------------------------------------------------

import { supabase } from './supabase';

/** Which module owns a row. */
export type ModuleName =
  | 'lms' | 'forum' | 'timetable' | 'exams' | 'assignments' | 'announcements';

export interface ModuleRecord<T = Record<string, unknown>> {
  id: string;
  module: ModuleName;
  kind: string;
  title: string;
  body: T;
  student_id: string | null;
  course_id: string | null;
  parent_id: string | null;
  author_id: string | null;
  author_name: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * The same shape supabase-js returns, on purpose.
 *
 * src/lib/write.ts already wraps a write and reports the failure as a toast,
 * and every call site in these seven modules already uses it. Returning
 * `{ error }` means those call sites change from
 *
 *     write(supabase.from('documents').insert({ … }), 'post to the forum')
 * to
 *     write(saveRecord({ … }), 'post to the forum')
 *
 * and their error handling keeps working. A bespoke result type here would have
 * meant rewriting fourteen call sites to unwrap it, which is fourteen chances
 * to drop the error on the floor — the exact fault write.ts exists to fix.
 */
export interface WriteResult {
  error: { message: string } | null;
  id?: string;
}

/**
 * The one place that turns a Supabase error into something a person can act on.
 *
 * WHY THIS EXISTS. Every one of these modules had its own inline error
 * handling, and most of it amounted to `catch {}`. The specific failure worth
 * naming is the missing table: until migration 010 is run, every call here
 * fails, and "relation module_records does not exist" tells a registrar
 * nothing.
 */
function explain(message: string): string {
  if (/module_records/.test(message) && /does not exist|schema cache/.test(message)) {
    return 'This part of the portal needs docs/migrations/010_writes_the_ui_makes.sql to be run.';
  }
  if (/row-level security|policy/i.test(message)) {
    return `Your role is not permitted to write here. (${message})`;
  }
  return message;
}

/** Everything of one kind, newest first. */
export async function listRecords<T = Record<string, unknown>>(
  module: ModuleName,
  kind?: string | string[],
): Promise<ModuleRecord<T>[]> {
  let q = supabase.from('module_records').select('*').eq('module', module);
  if (Array.isArray(kind)) q = q.in('kind', kind);
  else if (kind) q = q.eq('kind', kind);
  const { data } = await q.order('created_at', { ascending: false });
  return (data ?? []) as ModuleRecord<T>[];
}

/** Everything of a kind across modules — for the dashboard and insights. */
export async function listByKind<T = Record<string, unknown>>(
  kinds: string[],
): Promise<ModuleRecord<T>[]> {
  const { data } = await supabase
    .from('module_records')
    .select('*')
    .in('kind', kinds)
    .order('created_at', { ascending: false });
  return (data ?? []) as ModuleRecord<T>[];
}

export interface NewRecord {
  module: ModuleName;
  kind: string;
  title: string;
  body?: Record<string, unknown>;
  studentId?: string | null;
  courseId?: string | null;
  parentId?: string | null;
}

/**
 * Write a record.
 *
 * The author is stamped from the current session rather than passed in. A
 * caller that supplies its own author id can supply somebody else's, and the
 * RLS policy on this table lets a student insert only where
 * `author_id = auth.uid()` — so a client that guessed would simply be refused,
 * confusingly. Reading it from the session is both correct and the only thing
 * that works.
 */
export async function saveRecord(rec: NewRecord): Promise<WriteResult> {
  const { data: session } = await supabase.auth.getSession();
  const user = session.session?.user;

  const { data, error } = await supabase
    .from('module_records')
    .insert({
      module: rec.module,
      kind: rec.kind,
      title: rec.title,
      body: rec.body ?? {},
      student_id: rec.studentId ?? null,
      course_id: rec.courseId ?? null,
      parent_id: rec.parentId ?? null,
      author_id: user?.id ?? null,
      author_name:
        (user?.user_metadata?.full_name as string | undefined)
        ?? user?.email
        ?? null,
    })
    .select('id')
    .maybeSingle();

  if (error) return { error: { message: explain(error.message) } };
  return { error: null, id: data?.id };
}

export async function updateRecord(
  id: string,
  patch: { title?: string; body?: Record<string, unknown> },
): Promise<WriteResult> {
  const { error } = await supabase.from('module_records').update(patch).eq('id', id);
  if (error) return { error: { message: explain(error.message) } };
  return { error: null, id };
}

export async function deleteRecord(id: string): Promise<WriteResult> {
  const { error } = await supabase.from('module_records').delete().eq('id', id);
  if (error) return { error: { message: explain(error.message) } };
  return { error: null, id };
}
