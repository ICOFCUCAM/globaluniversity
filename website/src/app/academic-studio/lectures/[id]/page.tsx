import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getStore } from '@/academic/lib/data';
import { currentActor } from '@/academic/lib/session';
import { CAPABILITY_FOR_STAGE, studioActsFor } from '@/academic/lib/studioPermissions';
import { STAGES } from '@/academic/lib/pipeline/stages';
import { mayAct } from '@/academic/lib/domain/ownership';
import { can } from '@/academic/lib/capabilities';
import { voicesFor } from '@/academic/lib/voice/voices';
import { settingsOf } from '@/academic/lib/access/accessibility';
import { LectureWorkspace } from '@/academic/components/LectureWorkspace';
import { SubmissionBanner } from '@/academic/components/SubmissionBanner';
import { LectureCompanion } from '@/academic/components/LectureCompanion';
import { Empty, PageHeader } from '@/academic/components/ui';

export const dynamic = 'force-dynamic';

export default async function LecturePage({ params }: { params: { id: string } }) {
  const actor = await currentActor();
  const store = getStore();
  const lecture = await store.lecture(params.id);
  if (!lecture) notFound();

  const course = await store.course(lecture.courseId);
  if (!course) notFound();
  const enrolment = await store.enrolmentFor(course.id, actor.id);
  const scene = { course, enrolment, personal: lecture.context === 'personal' };
  const me = await store.person(actor.id);

  const all = await store.artefacts(lecture.id);
  // ONE RULE, ASKED PER ARTEFACT. The page does not decide what a student may
  // see; it asks the same function the API asks.
  const visible = all.filter((a) => mayAct(actor, 'read', a, scene).allowed);
  if (!visible.length && actor.role === 'student') {
  
  return (
      <div className="px-6 py-10 md:px-8">
        <Empty
          title="Nothing published from this lecture yet"
          body="Your lecturer reviews everything the AI produces before you receive it. When they publish, it appears here."
        />
      </div>
    );
  }

  const canEdit = all.some((a) => mayAct(actor, 'edit', a, scene).allowed)
    || lecture.ownerId === actor.id;
  const student = actor.role === 'student';

  // ---- WHAT THIS ACCOUNT MAY ASK A MODEL FOR ----------------------------
  //
  // Computed HERE and handed down, because resolving a grant reads the service
  // key and a client component must never hold one.
  //
  // A STUDENT IS NOT ASKED ABOUT. They see no generate buttons at all, so
  // querying grants for them would be a database round trip to decide the
  // colour of something that is not drawn.
  const acts = student ? [] : await studioActsFor(actor.id);
  const byCapability = new Map(acts.map((a) => [a.capability, a]));
  const permitted: Record<string, { allowed: boolean; label: string }> = {};
  for (const [kind, capability] of Object.entries(CAPABILITY_FOR_STAGE)) {
    const act = byCapability.get(capability);
    if (act) permitted[kind] = { allowed: act.allowed, label: act.label };
  }

  // ---- WHAT THIS LECTURE MAY BE SPOKEN IN --------------------------------
  //
  // Computed here, from the lecturer's own consent record, so that a voice
  // nobody authorised is never even sent to the browser as an option.
  const lecturer = await store.person(lecture.ownerId);
  const listeningLanguage = student ? actor.workingLanguage ?? course.originalLanguage ?? 'en' : course.originalLanguage ?? 'en';
  const university = await store.university();
  const voices = voicesFor({
    lecturerName: lecturer?.name ?? 'The lecturer',
    lecturerConsent: lecturer?.voiceConsent,
    use: listeningLanguage === (course.originalLanguage ?? 'en') ? 'original-audio' : 'translated-audio',
    universityVoice: university.standardVoice,
    allowed: course.allowedVoices,
  }).map((offer) => ({
    id: offer.voice.id,
    label: offer.voice.label,
    blurb: offer.voice.blurb,
    kind: offer.voice.kind,
    available: offer.available,
    unavailableBecause: offer.unavailableBecause,
  }));

  return (
    <div>
      <PageHeader
        lang={course.originalLanguage ?? 'en'}
        eyebrow={(
          <>
            <Link href={`/academic-studio/courses/${course.id}`} className="hover:text-studio-brand">{course.code}</Link>
            {` · Lecture ${String(lecture.sequence).padStart(2, '0')}`}
            {lecture.sourceMinutes ? ` · ${lecture.sourceMinutes} min recording` : ''}
          </>
        ) as unknown as string}
        title={lecture.title}
        subtitle={lecture.abstract}
      />

      {/* WHERE IT HAS GOT TO. Above the workspace because it governs the
          workspace: while this says "draft", every Generate button below will
          refuse, and a person needs to read the reason before they press the
          thing that gives it.

          NOT SHOWN TO A STUDENT. A student never submits and never waits for
          this decision; the course material simply is not there yet, which the
          empty state above already says in their words. */}
      {!student && (
        <SubmissionBanner
          lectureId={lecture.id}
          state={lecture.reviewState}
          submittedAt={lecture.submittedAt}
          reviewNote={lecture.reviewNote}
          isOwner={lecture.ownerId === actor.id}
          personal={lecture.context === 'personal'}
        />
      )}

      <LectureWorkspace
        lecture={lecture}
        permitted={permitted}
        stages={STAGES.map((s) => ({
          kind: s.kind, label: s.label, purpose: s.purpose, from: s.from,
          requiresApprovedSource: s.requiresApprovedSource, studentFacing: s.studentFacing,
        }))}
        artefacts={student ? visible : all}
        canEdit={canEdit}
        student={student}
        originalLanguage={course.originalLanguage ?? 'en'}
        offeredLanguages={course.offeredLanguages ?? []}
        canTranslate={can(actor.role, 'request-translation') && course.lecturerIds.includes(actor.id)}
        canApproveTranslation={can(actor.role, 'approve-translation')}
        workingLanguage={actor.workingLanguage}
        voices={voices}
        voicePreference={actor.voicePreference}
        audioSpeed={actor.audioSpeed}
        captions={settingsOf(me?.accessibility).captions}
      />

      {/* THE LECTURE COMPANION. "Ask about this lecture" means this lecture —
          the question is answered from here first, and only widens to the rest
          of the course when this lecture does not cover it. */}
      <div className="px-6 pb-10 md:px-8">
        <LectureCompanion courseId={course.id} lectureSequence={lecture.sequence} lectureTitle={lecture.title} />
      </div>
    </div>
  );
}
