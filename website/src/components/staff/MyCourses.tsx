'use client';

// ---------------------------------------------------------------------------
// MY COURSES — what the catalogue says about the courses somebody teaches.
//
// ---------------------------------------------------------------------------
// TEACHING A COURSE IS NOT DEFINING ONE
// ---------------------------------------------------------------------------
//
// The University, ruling on what a lecturer's account may do:
//
//   "A lecturer should be able to teach a course, but should not be able to
//    define the University's course catalogue. A lecturer teaching BLT 501 can
//    manage their teaching content for BLT 501, but should not be able to
//    change BLT 501 → 5 credits → Core → Semester 1, because that is
//    curriculum governance."
//
// Before that ruling there was one course capability — `manage-courses` — and
// the Courses screen was offered to every academic role by role alone. So the
// choice on offer was a lecturer who could rewrite BLT 501 from five credits to
// three, or a lecturer who could not see BLT 501 at all. Neither is what the
// University wanted.
//
// This is the other half: the same entries, READ ONLY, and only the ones they
// teach. The credit value, the term, the delivery mode and how many students
// have registered — everything a lecturer needs to know about the course they
// are standing in front of, and no control that changes any of it.
//
// ---------------------------------------------------------------------------
// WHICH COURSES ARE THEIRS IS DECIDED IN SQL
// ---------------------------------------------------------------------------
//
// `my_teaching` filters on `auth.uid()` and 068 explains why it does it through
// `lecturers.auth_user_id` rather than by matching an email. Nothing is
// filtered here: a screen that decided for itself which courses were somebody's
// would be a second answer to the question, and the two would differ the first
// time a lecturer's sign-in address stopped matching their staff record.
// ---------------------------------------------------------------------------

import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import {
  Card, CardHeader, PageHeader, EmptyState, Skeleton,
  TableShell, THead, TBody, Th, Td,
} from '@/components/ui/portal';
import { BookOpen, Info } from 'lucide-react';

interface Teaching {
  course_id: string;
  course_code: string | null;
  course_title: string | null;
  credit_unit: number | null;
  term_sequence: number | null;
  offering_status: string | null;
  delivery_mode: string | null;
  year_label: string | null;
  registered: number | null;
}

// One literal — supabase-js reads the row type from it, and a concatenation
// collapses it to GenericStringError[] with no error at the call site.
// eslint-disable-next-line max-len
const TEACHING = 'course_id, course_code, course_title, credit_unit, term_sequence, offering_status, delivery_mode, year_label, registered';

export default function MyCourses() {
  const [rows, setRows] = useState<Teaching[] | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase.from('my_teaching')
      .select(TEACHING).order('course_code');
    setRows((data ?? []) as Teaching[]);
  }, []);

  useEffect(() => { void load(); }, [load]);

  if (rows === null) {
    return <Card className="p-5"><Skeleton className="h-4 w-48" /><Skeleton className="mt-3 h-24 w-full" /></Card>;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="My courses"
        subtitle="What the catalogue says about the courses you teach"
      />

      {rows.length === 0 ? (
        <Card>
          <EmptyState
            icon={<BookOpen size={20} />}
            title="No courses are allocated to you"
            description="A course is allocated to a lecturer by the office that keeps the catalogue. Until one is, there is nothing here."
          />
        </Card>
      ) : (
        <Card>
          <CardHeader
            title="Allocated to you"
            subtitle={`${rows.length} course${rows.length === 1 ? '' : 's'}`}
          />
          <TableShell>
            <THead>
              <tr>
                <Th>Course</Th><Th>Credits</Th><Th>Term</Th>
                <Th>Delivery</Th><Th>Registered</Th>
              </tr>
            </THead>
            <TBody>
              {rows.map((r) => (
                <tr key={`${r.course_id}-${r.term_sequence ?? 'x'}`}>
                  <Td>
                    <span className="font-medium">{r.course_code ?? '—'}</span>
                    <span className="block text-[11px] text-[#a49bb0]">{r.course_title ?? ''}</span>
                  </Td>
                  <Td>{r.credit_unit ?? '—'}</Td>
                  <Td>
                    {r.year_label ?? '—'}
                    {r.term_sequence ? <span className="block text-[11px] text-[#a49bb0]">{`Semester ${r.term_sequence}`}</span> : null}
                  </Td>
                  <Td>{r.delivery_mode ?? '—'}</Td>
                  <Td>{r.registered ?? 0}</Td>
                </tr>
              ))}
            </TBody>
          </TableShell>

          {/* SAID, RATHER THAN LEFT TO BE DISCOVERED. A lecturer looking for
              the button to correct a credit value should be told where it is,
              not left to conclude the screen is broken. */}
          <p className="flex items-start gap-2 border-t border-[#ece7de] px-5 py-4 text-sm text-[#6b6076] dark:border-[#2e2637] dark:text-[#9c93ad]">
            <Info size={15} className="mt-0.5 flex-shrink-0" />
            <span>
              These are the catalogue&rsquo;s own particulars and cannot be edited here. The credit
              value, the level and the semester of a course are curriculum governance and belong
              to the office that keeps the catalogue — ask them if one is wrong. Your teaching
              content, your materials and your assessments for these courses are yours.
            </span>
          </p>
        </Card>
      )}
    </div>
  );
}
