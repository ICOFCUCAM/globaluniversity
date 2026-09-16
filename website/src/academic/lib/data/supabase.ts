// ---------------------------------------------------------------------------
// THE STORE, AGAINST POSTGRES.
//
// Reads the HOST's courses, lecturers, students and enrolment — whatever the
// university already has — and keeps this platform's own objects in the
// `ls_*` tables that `docs/integration/001_lecture_studio.sql` creates.
//
// NOT VERIFIED AGAINST A DATABASE. This environment cannot reach one, so every
// query below is written from the schema in that migration and has never
// returned a row. `data/conformance.mjs` is the suite it must pass before
// anybody points a university at it — run it against a real project with
// `node src/lib/data/supabase.conformance.mjs`, and until that passes this
// adapter is a draft.
//
// RLS DOES THE REAL WORK. These queries are written as the signed-in person:
// no service key, no `bypass`. If a query returns nothing where it should
// return something, the policy is what to read — not this file.
// ---------------------------------------------------------------------------

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type {
  Artefact, ArtefactVersion, Assignment, Course, Department, Enrolment, Faculty,
  Lecture, Person, QuizAttempt, Reading, StudyAid, Submission, TutorConversation,
  TutorMessage, University,
} from '../domain/types';
import type { LectureExtract } from '../knowledge/types';
import type { ProgressRecord } from '../study/progress';
import type { Voice } from '../voice/voices';
import type { AuditEntry } from '../audit/audit';
import type { CarriedSegment, LiveSegment, LiveSession } from '../live/types';
import type { Recall } from '../study/repetition';
import type { RunCost, UsageRecord } from '../billing/usage';
import type { Notification } from '../notify/notifications';
import type { Certificate } from '../credential/certificate';
import type { Store } from './store';
import { TABLES, notYetMapped } from './tables';
import { platformRole } from './roleMap';

type Row = Record<string, unknown>;

/** One row of `institutional_settings`, which is a key/value table. */
const STANDARD_VOICE_KEY = 'academic.standard_voice';

/** snake_case in, camelCase out. One place, so a column rename is one edit. */
const camel = (row: Row): Row => Object.fromEntries(
  Object.entries(row).map(([key, value]) => [key.replace(/_([a-z])/g, (_, c) => c.toUpperCase()), value]),
);
const snake = (object: Row): Row => Object.fromEntries(
  Object.entries(object)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => [key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`), value]),
);

export interface SupabaseStoreOptions {
  url: string;
  /** The PUBLISHABLE key, and the caller's own access token. Never a service key. */
  key: string;
  accessToken?: string;
  /** The institution, which this platform does not own. */
  university: University;
}


/**
 * A `profiles` row as this platform's Person, or null when the University's
 * role has no place in a lecture's material.
 *
 * NULL IS A REAL ANSWER. An Invigilator and an Applicant are people the
 * University knows; they are not people the Lecture Studio opens for, and
 * `session.ts` turns that into "signed in, but not a person this university
 * knows" rather than a half-working screen.
 */
function toPerson(row: Row): Person | null {
  const role = platformRole(row.role as string | undefined);
  if (!role) return null;
  const name = [row.fullName, row.firstName && row.lastName
    ? `${String(row.firstName)} ${String(row.lastName)}` : null, row.email]
    .find((candidate) => typeof candidate === 'string' && candidate.trim().length > 0);
  return {
    id: String(row.id),
    name: String(name ?? ''),
    email: row.email as string | undefined,
    role,
    workingLanguage: row.workingLanguage as string | undefined,
    voicePreference: row.voicePreference as string | undefined,
    audioSpeed: row.audioSpeed === null || row.audioSpeed === undefined
      ? undefined : Number(row.audioSpeed),
    voiceConsent: row.voiceConsent as Person['voiceConsent'],
    accessibility: row.accessibility as Person['accessibility'],
    workingLanguageHistory: (row.workingLanguageHistory ?? []) as Person['workingLanguageHistory'],
  } as Person;
}

export function createSupabaseStore(options: SupabaseStoreOptions): Store {
  const client: SupabaseClient = createClient(options.url, options.key, {
    global: options.accessToken
      ? { headers: { Authorization: `Bearer ${options.accessToken}` } }
      : undefined,
    auth: { persistSession: false },
  });

  // The builder's type is deliberately loose here: these are the only lines in
  // the platform that speak SQL-by-proxy, and a typed row map for forty tables
  // would be a second schema to keep in step with the migration.
  type Query = { eq(column: string, value: unknown): Query; is(column: string, value: unknown): Query;
    order(column: string, options?: { ascending?: boolean }): Query;
    then: PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>['then'] };

  const rows = async (table: string, build?: (q: Query) => Query) => {
    const query = client.from(table).select('*') as unknown as Query;
    const result = await (build ? build(query) : query);
    if (result.error) throw new Error(`${table}: ${result.error.message}`);
    return (result.data ?? []).map((row) => camel(row as Row));
  };

  const one = async (table: string, id: string) => {
    const { data, error } = await client.from(table).select('*').eq('id', id).maybeSingle();
    if (error) throw new Error(`${table}: ${error.message}`);
    return data ? camel(data as Row) : null;
  };

  const upsert = async (table: string, object: Row) => {
    const { error } = await client.from(table).upsert(snake(object));
    if (error) throw new Error(`${table}: ${error.message}`);
  };

  return {
    id: 'icof',

    // THE HOST'S UNIVERSITY, PLUS WHAT IS THIS PLATFORM'S OWN. The name and
    // the identity come from the deployment's configuration and are never
    // written back — mounted inside somebody else's system, this platform does
    // not edit their institution. The standard voice is ours, so it lives in
    // our own settings row.
    async university() {
      // ---- A KEY/VALUE TABLE, NOT A ROW PER THING ------------------------
      //
      // This read `one(settings, 'university')` and wrote `{ id, standardVoice }`,
      // which is the shape the Studio's own `ls_settings` had. The University's
      // `institutional_settings` is key/value — `key`, `value`, `description`,
      // `allowed`, `updated_by`, `updated_at` — with no `id` column and no
      // `standard_voice` column, so BOTH CALLS WOULD HAVE THROWN on the first
      // page load. Found by schemaAgreement.test.mjs, which is the entire
      // reason that file exists.
      const { data } = await client.from(TABLES.settings)
        .select('value').eq('key', STANDARD_VOICE_KEY).maybeSingle();
      const raw = (data as { value?: string } | null)?.value;
      if (!raw) return options.university;
      try {
        return { ...options.university, standardVoice: JSON.parse(raw) as Voice };
      } catch {
        // A SETTING NOBODY CAN PARSE IS NOT A REASON TO LOSE THE UNIVERSITY.
        // The voice is a preference; the institution is not.
        return options.university;
      }
    },
    async saveUniversity(university) {
      const { error } = await client.from(TABLES.settings).upsert({
        key: STANDARD_VOICE_KEY,
        value: JSON.stringify(university.standardVoice ?? null),
        description: 'The voice the Lecture Studio reads translated audio in by default.',
      }, { onConflict: 'key' });
      if (error) throw new Error(`${TABLES.settings}: ${error.message}`);
      return university;
    },

    // ---- THE HOST'S OWN TABLES -----------------------------------------
    async faculties() {
      return (await rows(TABLES.schools)).map((row) => ({
        id: String(row.id), universityId: options.university.id,
        name: String(row.name ?? ''), code: row.code as string | undefined,
      })) as Faculty[];
    },
    async departments() {
      return (await rows(TABLES.departments)).map((row) => ({
        id: String(row.id), facultyId: String(row.schoolId ?? row.facultyId ?? ''),
        name: String(row.name ?? ''), code: row.code as string | undefined,
      })) as Department[];
    },

    async courses() {
      const [courses, offerings] = await Promise.all([rows(TABLES.courses), rows(TABLES.courseOfferings)]);
      return courses.map((row) => {
        // WHO TEACHES IT THIS TERM, falling back to the catalogue — which is
        // exactly what the host's own `my_teaching` view does, and for the
        // same reason: until a term is set up, the catalogue is the only
        // record of who teaches what.
        const thisTerm = offerings
          .filter((o) => o.courseId === row.id && o.lecturerId)
          .map((o) => String(o.lecturerId));
        const lecturerIds = thisTerm.length ? thisTerm
          : row.lecturerId ? [String(row.lecturerId)] : [];
        return {
          id: String(row.id),
          departmentId: row.departmentId as string | undefined,
          code: String(row.code ?? ''),
          title: String(row.title ?? ''),
          creditUnit: row.creditUnit as number | undefined,
          description: row.description as string | undefined,
          lecturerIds,
          status: 'running',
          originalLanguage: (row.language as string) ?? 'en',
        } as Course;
      });
    },
    async course(id) { return (await this.courses()).find((c) => c.id === id) ?? null; },
    async coursesFor(personId) {
      const all = await this.courses();
      const taught = all.filter((c) => c.lecturerIds.includes(personId));
      if (taught.length) return taught;
      const mine = await this.enrolmentsOf(personId);
      return all.filter((c) => mine.some((e) => e.courseId === c.id && e.status !== 'withdrawn'));
    },
    async saveCourse(course) {
      // THE COURSE IS THE HOST'S. This platform does not create or retire one;
      // it writes back only what belongs to it, and there is nothing of its
      // own on a course row.
      return course;
    },

    // ---- WHO THESE PEOPLE ARE ------------------------------------------
    //
    // THREE THINGS WERE WRONG HERE AND ALL THREE MATTERED.
    //
    // 1. THE ROLE CAME FROM THE TABLE, NOT THE PERSON. Everybody in
    //    `lecturers` was called a lecturer and everybody in `students` a
    //    student. The University's answer to "what is this person" lives in
    //    `profiles.role`, and it has twenty-three answers — a Registrar, a
    //    Dean, a Head of Department. Read from the table, a Registrar who is
    //    also on the staff list would have owned lecture material.
    //
    // 2. THE NAME WAS ALWAYS BLANK. It read `row.name ?? row.fullName`, and
    //    this University's `lecturers` and `students` carry `first_name` and
    //    `last_name`. Neither of those two columns exists, so every person on
    //    every screen would have been the empty string.
    //
    // 3. `person(id)` FETCHED EVERY PERSON IN THE UNIVERSITY to find one.
    //    Every request, to answer "who am I". And after 088 closed
    //    `lecturers` to non-staff, a student asking would get nothing back at
    //    all — the sign-in would fail for exactly the people it is for.
    //
    // So identity is read from `profiles`, by id, one row.
    async people() {
      const everyone = await rows(TABLES.profiles);
      return everyone
        .map((row) => toPerson(row))
        .filter((p): p is Person => p !== null);
    },
    async person(id) {
      const row = await one(TABLES.profiles, id);
      return row ? toPerson(row) : null;
    },
    async savePerson(person) {
      // ---- ONLY WHAT IS THE PERSON'S OWN --------------------------------
      //
      // This wrote `personId` into `profiles`, whose key is `id`, so nothing
      // it saved would ever have been found again. And it wrote
      // `working_language` and `working_language_history`, which 093 revokes
      // from every browser session at the column level — so on the University's
      // database this threw, and on a database where somebody had loosened the
      // grant it would have let a student change the language they are
      // examined in.
      //
      // The four below are the ones the migration grants to `authenticated`,
      // and the agreement is not a coincidence: the store may write exactly
      // what the database will accept, so a save either works or says why
      // rather than half-succeeding.
      if (person.workingLanguage !== undefined) {
        throw new Error(
          'The working language is the Registry\u2019s to set, not the account holder\u2019s: a '
          + 'mid-term switch means being examined on material you have not been reading. It is '
          + 'changed through a server route that records who changed it and why.',
        );
      }
      if (person.plan !== undefined) {
        throw new Error(
          '`plan` has no column on this University\u2019s `profiles`. Billing was not part of the '
          + 'integration and no migration adds it \u2014 refusing rather than dropping it and '
          + 'returning as though it saved.',
        );
      }
      await upsert(TABLES.profiles, {
        id: person.id,
        voicePreference: person.voicePreference,
        audioSpeed: person.audioSpeed,
        voiceConsent: person.voiceConsent,
        accessibility: person.accessibility,
      });
      return person;
    },

    async enrolments(courseId) {
      return (await rows(TABLES.courseRoll, (q) => q.eq('course_id', courseId))).map((row) => ({
        id: String(row.enrollmentId ?? row.id), courseId: String(row.courseId),
        studentId: String(row.studentId), status: (row.status ?? 'registered') as Enrolment['status'],
      }));
    },
    async enrolmentFor(courseId, studentId) {
      return (await this.enrolments(courseId)).find((e) => e.studentId === studentId) ?? null;
    },
    async enrolmentsOf(studentId) {
      return (await rows(TABLES.courseRoll, (q) => q.eq('student_id', studentId))).map((row) => ({
        id: String(row.enrollmentId ?? row.id), courseId: String(row.courseId),
        studentId: String(row.studentId), status: (row.status ?? 'registered') as Enrolment['status'],
      }));
    },
    async saveEnrolment(enrolment) {
      // Enrolment is the registry's, in the host's own tables and its own
      // screens. This platform reads it and never writes it.
      return enrolment;
    },

    // ---- THIS PLATFORM'S OWN TABLES ------------------------------------
    async lectures(courseId) {
      return (await rows(TABLES.lectures, (q) => q.eq('course_id', courseId).order('sequence'))) as unknown as Lecture[];
    },
    async lecture(id) { return (await one(TABLES.lectures, id)) as unknown as Lecture | null; },
    async saveLecture(lecture) { await upsert(TABLES.lectures, lecture as unknown as Row); return lecture; },

    async artefacts(lectureId) {
      return (await rows(TABLES.artefacts, (q) => q.eq('lecture_id', lectureId))) as unknown as Artefact[];
    },
    async artefactsForCourse(courseId) {
      return (await rows(TABLES.artefacts, (q) => q.eq('course_id', courseId))) as unknown as Artefact[];
    },
    async artefact(id) { return (await one(TABLES.artefacts, id)) as unknown as Artefact | null; },
    async artefactsByMediaKey(key) {
      return (await rows(TABLES.artefacts, (q) => q.eq('media_path', key))) as unknown as Artefact[];
    },
    async saveArtefact(artefact) { await upsert(TABLES.artefacts, artefact as unknown as Row); return artefact; },
    async deleteArtefact(id) {
      const { error } = await client.from(TABLES.artefacts).delete().eq('id', id);
      if (error) throw new Error(error.message);
    },

    async versions(artefactId) {
      return (await rows(TABLES.artefactVersions,
        (q) => q.eq('artefact_id', artefactId).order('version'))) as unknown as ArtefactVersion[];
    },
    async addVersion(version) { await upsert(TABLES.artefactVersions, version as unknown as Row); return version; },

    async extracts(courseId) {
      const found = await rows(TABLES.lectureKnowledge, (q) => q.eq('course_id', courseId));
      const lectures = await this.lectures(courseId);
      return found.map((row) => {
        const lecture = lectures.find((l) => l.id === row.lectureId);
        return {
          lectureId: String(row.lectureId),
          lectureSequence: lecture?.sequence ?? 0,
          lectureTitle: lecture?.title ?? '',
          nodes: (row.nodes ?? []) as LectureExtract['nodes'],
        };
      });
    },
    async saveExtract(courseId, extract) {
      await upsert(TABLES.lectureKnowledge, {
        lectureId: extract.lectureId, courseId, nodes: extract.nodes,
      });
    },

    async studyAids(courseId) {
      return (await rows(TABLES.studyAids, (q) => q.eq('course_id', courseId))) as unknown as StudyAid[];
    },
    async studyAidById(id) { return (await one(TABLES.studyAids, id)) as unknown as StudyAid | null; },
    async saveStudyAid(aid) { await upsert(TABLES.studyAids, aid as unknown as Row); return aid; },

    async progress() { return notYetMapped('progress'); },
    async recordProgress() { return notYetMapped('progress'); },

    async attempts(studyAidId, personId) {
      return (await rows(TABLES.quizAttempts, (q) => personId
        ? q.eq('study_aid_id', studyAidId).eq('person_id', personId)
        : q.eq('study_aid_id', studyAidId))) as unknown as QuizAttempt[];
    },
    async saveAttempt(attempt) { await upsert(TABLES.quizAttempts, attempt as unknown as Row); return attempt; },

    async liveSessions(courseId) {
      return (await rows(TABLES.liveSessions, (q) => courseId
        ? q.eq('course_id', courseId) : q)) as unknown as LiveSession[];
    },
    async liveSession(id) { return (await one(TABLES.liveSessions, id)) as unknown as LiveSession | null; },
    async saveLiveSession(session) { await upsert(TABLES.liveSessions, session as unknown as Row); return session; },
    async liveSegments(sessionId) {
      const found = (await rows(TABLES.liveSegments, (q) => q.eq('session_id', sessionId))) as unknown as LiveSegment[];
      return found.sort((a, b) => a.sequence - b.sequence);
    },
    async saveLiveSegment(segment) { await upsert(TABLES.liveSegments, segment as unknown as Row); return segment; },
    async carriedSegments(sessionId, language) {
      const found = (await rows(TABLES.liveCarried, (q) => language
        ? q.eq('session_id', sessionId).eq('language', language)
        : q.eq('session_id', sessionId))) as unknown as CarriedSegment[];
      return found.sort((a, b) => a.sequence - b.sequence);
    },
    async saveCarried(carried) { await upsert(TABLES.liveCarried, carried as unknown as Row); return carried; },

    async auditEntries() { return notYetMapped('audit'); },
    async appendAudit() { return notYetMapped('audit'); },

    async recalls(personId, studyAidId) {
      return (await rows(TABLES.recalls, (q) => studyAidId
        ? q.eq('person_id', personId).eq('study_aid_id', studyAidId)
        : q.eq('person_id', personId))) as unknown as Recall[];
    },
    async saveRecall(recall) { await upsert(TABLES.recalls, recall as unknown as Row); return recall; },

    async costs(courseId) {
      return (await rows(TABLES.runCosts, (q) => q.eq('course_id', courseId))) as unknown as RunCost[];
    },
    async recordCost(cost) { await upsert(TABLES.runCosts, cost as unknown as Row); },
    async usage(personId) {
      return (await rows(TABLES.usage, (q) => q.eq('person_id', personId))) as unknown as UsageRecord[];
    },
    async recordUsage(record) { await upsert(TABLES.usage, record as unknown as Row); },

    async notifications(personId) {
      return (await rows(TABLES.notifications,
        (q) => q.eq('person_id', personId).order('at', { ascending: false }))) as unknown as Notification[];
    },
    async notify(notification) { await upsert(TABLES.notifications, notification as unknown as Row); },
    async markNotificationsRead(personId) {
      const { error } = await client.from(TABLES.notifications)
        .update({ read_at: new Date().toISOString() })
        .eq('person_id', personId).is('read_at', null);
      if (error) throw new Error(error.message);
    },

    async certificates() { return notYetMapped('certificates'); },
    async certificateByCode() { return notYetMapped('certificates'); },
    async saveCertificate() { return notYetMapped('certificates'); },

    // ---- THE COURSE LIBRARY ---------------------------------------------
    //
    // READ THROUGH THE VIEW, NOT THE TABLE. `my_course_library` withholds
    // `file_path` from a reader who may not download — the row still comes
    // back, because they may read it online, and only the path is missing.
    // Reading `course_resources` directly here would hand the storage path of
    // a licensed book to every enrolled student.
    async readings(courseId) {
      return (await rows(TABLES.library, (q) => q.eq('course_id', courseId)
        .order('requirement').order('title'))) as unknown as Reading[];
    },
    async saveReading(reading) {
      // THE TWO RIGHTS ARE NOT WRITTEN FROM HERE. 096 refuses anybody but the
      // Superadministrator and the System Administrator, and sending them on
      // every save would make an ordinary edit fail for a librarian who
      // changed a description. They are set on their own, through their own
      // route, by the office that carries the licence.
      await upsert(TABLES.resources, {
        id: reading.id,
        courseId: reading.courseId,
        moduleId: reading.moduleId,
        kind: reading.kind,
        title: reading.title,
        author: reading.author,
        description: reading.description,
        publisher: reading.publisher,
        publishedYear: reading.publishedYear,
        isbn: reading.isbn,
        doi: reading.doi,
        coverUrl: reading.coverUrl,
        url: reading.url,
        requirement: reading.requirement,
        licence: reading.licence,
        visible: reading.visible,
        addedBy: reading.addedBy,
      });
      return reading;
    },

    async assignments() { return notYetMapped('assignments'); },
    async assignment() { return notYetMapped('assignments'); },
    async saveAssignment() { return notYetMapped('assignments'); },
    async submissions() { return notYetMapped('submissions'); },
    async submissionById() { return notYetMapped('submissions'); },
    async saveSubmission() { return notYetMapped('submissions'); },

    // ---- THE COURSE AI'S CONVERSATIONS, in the host's own tables --------
    async conversations(courseId, studentId) {
      return (await rows(TABLES.tutorConversations,
        (q) => q.eq('course_id', courseId).eq('student_id', studentId))) as unknown as TutorConversation[];
    },
    async saveConversation(conversation) {
      await upsert(TABLES.tutorConversations, conversation as unknown as Row);
      return conversation;
    },
    async messages(conversationId) {
      return (await rows(TABLES.tutorMessages,
        (q) => q.eq('conversation_id', conversationId))) as unknown as TutorMessage[];
    },
    async saveMessage(message) { await upsert(TABLES.tutorMessages, message as unknown as Row); return message; },
  };
}
