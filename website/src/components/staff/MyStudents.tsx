'use client';

// ---------------------------------------------------------------------------
// MY STUDENTS — the roll for the courses somebody teaches.
//
// ---------------------------------------------------------------------------
// A CAPABILITY WITH NO DOOR
// ---------------------------------------------------------------------------
//
// Every lecturer holds `view-registered-students`, and NO SCREEN THEY CAN OPEN
// was gated on it. The three that test it — Course registration, Academic
// records, Student management — all leave `lecturer` out of their role lists.
//
// So a lecturer could see their roll only incidentally: per course, inside the
// grade book, on the way to entering a mark. "Who is registered on my course"
// had no answer anywhere in the portal for the person teaching it.
//
// This is that answer. It reads nothing a lecturer was not already entitled to
// read — `my_teaching` and `course_roll` are the same views the grade book and
// the learning space use, both scoped in SQL to the caller.
//
// ---------------------------------------------------------------------------
// AND IT IS A ROLL, NOT A RECORD
// ---------------------------------------------------------------------------
//
// Names and matriculation numbers for the courses they teach, and nothing
// else. `view-registered-students` is what it says: a lecturer is entitled to
// know who is in front of them, not to read a student's admission file, their
// fees or their results in other people's courses. Those are other
// capabilities, held by other offices, and a screen that quietly widened this
// one would be granting them.
// ---------------------------------------------------------------------------

import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import {
  Card, CardHeader, PageHeader, EmptyState, Skeleton,
  TableShell, THead, TBody, Th, Td,
} from '@/components/ui/portal';
import { Users, BookOpen } from 'lucide-react';

interface Teaching {
  course_id: string;
  code: string | null;
  title: string | null;
}

interface Student {
  id: string;
  matric_no: string | null;
  first_name: string | null;
  last_name: string | null;
}

export default function MyStudents() {
  const [courses, setCourses] = useState<Teaching[] | null>(null);
  const [chosen, setChosen] = useState<string | null>(null);
  const [roll, setRoll] = useState<Student[] | null>(null);

  const load = useCallback(async () => {
    // `my_teaching` FILTERS ON auth.uid() IN SQL, exactly as the learning space
    // uses it. Nothing is filtered here, so a screen cannot disagree with the
    // view about which courses are somebody's.
    const { data } = await supabase.from('my_teaching')
      .select('course_id, code, title').order('code');
    const list = (data ?? []) as Teaching[];
    setCourses(list);
    if (list.length > 0) setChosen((c) => c ?? list[0].course_id);
  }, []);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!chosen) return;
    setRoll(null);
    void (async () => {
      const { data } = await supabase.from('course_roll')
        .select('student_id, students(id, matric_no, first_name, last_name)')
        .eq('course_id', chosen);
      const rows = (data ?? []) as { students: Student | Student[] | null }[];
      setRoll(rows
        .map((r) => (Array.isArray(r.students) ? r.students[0] : r.students))
        .filter((s): s is Student => Boolean(s)));
    })();
  }, [chosen]);

  if (courses === null) {
    return <Card className="p-5"><Skeleton className="h-4 w-48" /><Skeleton className="mt-3 h-24 w-full" /></Card>;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="My students"
        subtitle="Who is registered on the courses you teach"
      />

      {courses.length === 0 ? (
        <Card>
          <EmptyState
            icon={<BookOpen size={20} />}
            title="No courses are allocated to you"
            description="A course is allocated to a lecturer on the Courses screen. Until one is, there is no roll to show."
          />
        </Card>
      ) : (
        <Card>
          <CardHeader
            title={courses.find((c) => c.course_id === chosen)?.title ?? 'Roll'}
            subtitle={roll === null ? 'Reading the roll…'
              : `${roll.length} registered`}
          />
          <div className="p-5 pb-0">
            <label className="block text-xs uppercase tracking-wide text-[#a49bb0]" htmlFor="my-course">
              Course
            </label>
            <select id="my-course" value={chosen ?? ''}
              onChange={(e) => setChosen(e.target.value)}
              className="mt-1 w-full max-w-md rounded-lg border border-[#ded6c8] px-3 py-2 text-sm dark:border-[#3d3349] dark:bg-[#1f1a27]">
              {courses.map((c) => (
                <option key={c.course_id} value={c.course_id}>
                  {[c.code, c.title].filter(Boolean).join(' — ')}
                </option>
              ))}
            </select>
          </div>

          {roll !== null && roll.length === 0 ? (
            <EmptyState
              icon={<Users size={20} />}
              title="Nobody has registered for this course yet"
              description="Students appear here once they register for the course, not when they are admitted."
            />
          ) : (
            <TableShell>
              <THead>
                <tr><Th>Student</Th><Th>Matriculation number</Th></tr>
              </THead>
              <TBody>
                {(roll ?? []).map((s) => (
                  <tr key={s.id}>
                    <Td>
                      <span className="font-medium">
                        {[s.first_name, s.last_name].filter(Boolean).join(' ') || '—'}
                      </span>
                    </Td>
                    <Td>{s.matric_no ?? '—'}</Td>
                  </tr>
                ))}
              </TBody>
            </TableShell>
          )}
        </Card>
      )}
    </div>
  );
}
