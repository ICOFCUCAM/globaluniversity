import { notFound } from 'next/navigation';
import { getStore } from '@/academic/lib/data';
import { currentActor } from '@/academic/lib/session';
import { LearningProfile } from '@/academic/components/LearningProfile';
import { translate } from '@/academic/lib/i18n/ui';
import { PageHeader } from '@/academic/components/ui';

export const dynamic = 'force-dynamic';

export default async function Profile() {
  const actor = await currentActor();
  const person = await getStore().person(actor.id);
  if (!person) notFound();

  return (
    <div>
      <PageHeader
        eyebrow={translate(person.workingLanguage, 'profile.title')}
        title={person.name}
        subtitle={translate(person.workingLanguage, 'profile.subtitle')}
        lang={person.workingLanguage ?? 'en'}
      />
      <div className="px-6 py-6 md:px-8">
        <LearningProfile person={person} isStudent={person.role === 'student'} />
      </div>
    </div>
  );
}
