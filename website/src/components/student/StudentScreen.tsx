'use client';

// ---------------------------------------------------------------------------
// THE THREE STATES EVERY STUDENT SCREEN HAS, DRAWN IN ONE PLACE.
//
// Loading, could-not-read, and genuinely-nothing. They had been written out by
// hand on every screen, and the copies had already drifted: some said "no
// results yet" when the read had failed, which is the portal telling a student
// something false about their own record.
//
// So the distinction lives here and cannot be got wrong by a new screen:
// `failed` always wins over `empty`, and `empty` is only ever drawn after a
// read that actually succeeded.
// ---------------------------------------------------------------------------

import React from 'react';
import { Card, EmptyState, PageHeader, SkeletonRows } from '@/components/ui/portal';
import { AlertTriangle } from 'lucide-react';

export default function StudentScreen({
  title, subtitle, loading, failed, empty, emptyTitle, emptyWhy, icon, action, children,
}: {
  title: string;
  subtitle?: string;
  loading: boolean;
  failed: string | null;
  /** True only where the read SUCCEEDED and returned nothing. */
  empty?: boolean;
  emptyTitle?: string;
  emptyWhy?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="space-y-5">
      <PageHeader title={title} subtitle={subtitle} action={action} />

      {/* FAILED FIRST, ALWAYS. If the read did not come back, nothing below is
          known — including whether the student has anything. */}
      {failed ? (
        <Card>
          <EmptyState
            icon={<AlertTriangle size={20} />}
            title="This could not be read"
            description={`${failed} Nothing is wrong with your record — this is the portal `
              + 'failing to reach the University’s database. Try again in a moment.'}
          />
        </Card>
      ) : loading ? (
        <Card className="overflow-hidden"><SkeletonRows rows={5} cols={3} /></Card>
      ) : empty ? (
        <Card>
          <EmptyState
            icon={icon}
            title={emptyTitle ?? 'Nothing here yet'}
            description={emptyWhy}
          />
        </Card>
      ) : children}
    </div>
  );
}
