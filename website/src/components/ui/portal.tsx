'use client';

// ---------------------------------------------------------------------------
// The portal's shared parts.
//
// Every screen was building its own card, its own heading, its own "Loading…"
// and its own empty state, so no two agreed. Twelve slightly different greys is
// not a design; it is twelve people not talking to each other. These are the
// pieces each screen should reach for instead.
//
// Three of them exist because of things the portal was doing badly rather than
// inconsistently:
//
//   Skeleton — every screen rendered the word "Loading…" centred in grey. A
//   skeleton in the shape of the thing being loaded stops the layout jumping
//   when data lands, and tells the reader what is coming.
//
//   EmptyState — a table with no rows rendered as a header and nothing. Empty
//   is not an error, but it is not nothing either: it needs to say what would
//   be here and what to do about it.
//
//   Figure — statistics were rendered in proportional digits, so a column of
//   them did not line up. Anything a reader compares down a column is tabular.
// ---------------------------------------------------------------------------

import React from 'react';
import {
  CARD, CARD_INTERACTIVE, EYEBROW, SECTION_TITLE, SECTION_SUB, NUMERIC, SURFACE,
} from '@/lib/portalTheme';

/* ------------------------------------------------------------------ */
/* Layout                                                              */
/* ------------------------------------------------------------------ */

export function Card({
  className = '', interactive = false, children, ...rest
}: React.HTMLAttributes<HTMLDivElement> & { interactive?: boolean }) {
  return (
    <div className={`${interactive ? CARD_INTERACTIVE : CARD} ${className}`} {...rest}>
      {children}
    </div>
  );
}

/** Card header with a rule under it. Optional action sits at the right. */
export function CardHeader({
  title, subtitle, action, icon,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#f0ece4] px-5 py-4 dark:border-[#2a2333]">
      <div className="flex min-w-0 items-start gap-2.5">
        {icon && <span className="mt-0.5 text-[#8a8194] dark:text-[#8f869e]">{icon}</span>}
        <div className="min-w-0">
          <h3 className="truncate font-heading text-sm font-bold text-[#422e59] dark:text-[#e4dcf0]">{title}</h3>
          {subtitle && <p className="mt-0.5 text-xs text-[#8a8194] dark:text-[#8f869e]">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

/** The heading block at the top of a screen. */
export function PageHeader({
  title, subtitle, action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className={SECTION_TITLE.replace('text-base', 'text-xl')}>{title}</h1>
        {subtitle && <p className={`mt-1 ${SECTION_SUB}`}>{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Data                                                                */
/* ------------------------------------------------------------------ */

/**
 * A number the reader is meant to take in at a glance.
 *
 * `hint` exists so a figure can say where it came from. A dashboard tile
 * reading 2,847 with no provenance is indistinguishable from a tile reading
 * 2,847 because someone typed it, and the portal shipped with several of the
 * latter.
 */
export function Figure({
  label, value, hint, icon, tone = 'neutral',
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  icon?: React.ReactNode;
  tone?: 'neutral' | 'brand' | 'muted';
}) {
  const valueTone =
    tone === 'brand' ? 'text-[#422e59] dark:text-[#c9b6e6]' : tone === 'muted' ? 'text-[#a49bb0] dark:text-[#7b7289]' : 'text-[#241a30] dark:text-[#ece9f0]';
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <p className={EYEBROW}>{label}</p>
        {icon && <span className="text-[#c5a55a]">{icon}</span>}
      </div>
      <p className={`mt-2 font-heading text-2xl font-bold ${NUMERIC} ${valueTone}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-[#8a8194] dark:text-[#8f869e]">{hint}</p>}
    </Card>
  );
}

/** Definition row — label left, value right, used in every detail panel. */
export function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[minmax(0,8rem)_1fr] gap-4 px-5 py-2.5">
      <dt className="text-xs text-[#8a8194] dark:text-[#8f869e]">{label}</dt>
      <dd className="break-words text-sm text-[#33234a] dark:text-[#d8d2e2]">{children}</dd>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* States                                                              */
/* ------------------------------------------------------------------ */

/** A grey block in the shape of the thing that is coming. */
export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-[#ece7de] dark:bg-[#2a2333] ${className}`} aria-hidden="true" />;
}

/** Several rows of skeleton, for a table that has not arrived. */
export function SkeletonRows({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-2 p-5" role="status" aria-label="Loading">
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} className="flex gap-4">
          {Array.from({ length: cols }, (_, c) => (
            <Skeleton key={c} className={`h-4 ${c === 0 ? 'w-1/3' : 'flex-1'}`} />
          ))}
        </div>
      ))}
    </div>
  );
}

/**
 * Nothing here yet — said properly.
 *
 * `reason` distinguishes the two cases that look identical and are not: there
 * is genuinely nothing, or a filter is hiding everything. A user who has
 * searched and sees "No students" reasonably concludes the database is empty.
 */
export function EmptyState({
  title, description, action, icon,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      {icon && (
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#faf6ee] text-[#c5a55a] dark:bg-[#2a2333]">
          {icon}
        </div>
      )}
      <p className="font-heading text-sm font-bold text-[#422e59] dark:text-[#e4dcf0]">{title}</p>
      {description && (
        <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-[#8a8194] dark:text-[#8f869e]">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/**
 * Something the reader should not act on as if it were fact.
 *
 * Used where a screen shows illustrative figures rather than the university's
 * own. Shipping sample data unlabelled is how an administrator ends up quoting
 * 2,847 students to a ministry inspector.
 */
export function SampleDataNotice({ what = 'figures' }: { what?: string }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
      <span aria-hidden="true">⚠</span>
      <p>
        These {what} are illustrative sample data, not the university&apos;s records. They will be
        replaced by live figures once the database is populated.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Tables                                                              */
/* ------------------------------------------------------------------ */

export function TableShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">{children}</table>
    </div>
  );
}

export function Th({
  children, align = 'left', className = '',
}: {
  children?: React.ReactNode;
  align?: 'left' | 'right' | 'center';
  className?: string;
}) {
  return (
    <th
      scope="col"
      className={`${EYEBROW} whitespace-nowrap px-4 py-2.5 text-${align} ${className}`}
    >
      {children}
    </th>
  );
}

export function Td({
  children, align = 'left', numeric = false, className = '',
}: {
  children?: React.ReactNode;
  align?: 'left' | 'right' | 'center';
  numeric?: boolean;
  className?: string;
}) {
  return (
    <td className={`px-4 py-2.5 text-${align} ${numeric ? NUMERIC : ''} ${className}`}>
      {children}
    </td>
  );
}

/** Zebra-free body — a hairline divider reads more calmly at density. */
export function TBody({ children }: { children: React.ReactNode }) {
  return <tbody className={`divide-y ${SURFACE.divider}`}>{children}</tbody>;
}

export function THead({ children }: { children: React.ReactNode }) {
  return <thead className={`${SURFACE.inset} border-b border-[#ece7de] dark:border-[#2e2637]`}>{children}</thead>;
}
