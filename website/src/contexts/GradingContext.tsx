'use client';

// ---------------------------------------------------------------------------
// THE GRADING SCALE THE UNIVERSITY HAS PUBLISHED, LOADED ONCE.
//
// ---------------------------------------------------------------------------
// THE MISSING PIECE, AND IT WAS THE ONLY ONE MISSING
// ---------------------------------------------------------------------------
//
// Everything else already existed. `grading_scales` has held the University's
// scale since migration 020 — bands, a pass mark, a maximum point, per-award
// variants, an `is_active` flag, a publication record, and a
// `grading_scale_restatements` table holding the approval trail for changing
// it. 035 restated it to the American scale and made version 2 active.
// `gradingScale.ts` was written to turn a stored row into something the system
// can compute on, complete with a fallback for a row that will not parse.
// `grade_under_active_scale()` exists in SQL and is granted to `authenticated`.
//
// Not one thing read any of it. Every grade in the portal was computed from a
// TypeScript copy, so the University could restate its scale, approve it,
// publish it — and nothing would change.
//
// This is the read. It is the whole fix.
//
// ---------------------------------------------------------------------------
// ONCE, AT THE TOP, AND NEVER AGAIN
// ---------------------------------------------------------------------------
//
// A grading scale changes about as often as a University changes its
// regulations. Reading it per screen would be a round trip on every mark
// sheet; reading it per mark would be one per row. It is read when the portal
// starts and adopted into `grading.ts`, where the fifteen files that compute a
// grade already look.
//
// ---------------------------------------------------------------------------
// AND A FAILED READ CHANGES NOTHING
// ---------------------------------------------------------------------------
//
// The published bands stand until the stored scale lands, and stand for ever
// if it cannot be read. That is deliberate: a registry that cannot grade
// because a table is unreachable is worse than one grading on a constant that
// matches the published regulations — and a scale that parsed to nothing would
// grade every mark in the University as F, silently.
//
// What the portal must never do is compute on one scale while telling anybody
// it used another, so `source` says which is in force and the Settings screen
// prints it.
// ---------------------------------------------------------------------------

import React, {
  createContext, useCallback, useContext, useEffect, useMemo, useState,
} from 'react';
import { supabase } from '@/lib/supabase';
import { adoptScale } from '@/lib/grading';
import {
  PUBLISHED_SCALE, scaleFromRow, divergesFromPublished, type Scale,
} from '@/lib/gradingScale';

interface GradingState {
  /** The scale every grade in the portal is computed on. */
  scale: Scale;
  /** True while the first read is in flight. */
  loading: boolean;
  /**
   * Where the scale came from.
   *
   * 'university'  a published row in `grading_scales`
   * 'published'   the regulations in the repository, because there was no
   *               active row, or it could not be read, or it would not parse
   */
  source: 'university' | 'published';
  /** Why the stored scale was not used, where it was not. */
  why: string | null;
  /**
   * Where the stored scale and the published regulations disagree.
   *
   * NAMED, NEVER RESOLVED SILENTLY. The website publishes one thing and the
   * registry computes another is a real institutional problem, and picking a
   * winner without saying so is how a student is told two different things
   * about the same mark.
   */
  divergence: string[];
  refresh: () => Promise<void>;
}

const Ctx = createContext<GradingState>({
  scale: PUBLISHED_SCALE,
  loading: false,
  source: 'published',
  why: null,
  divergence: [],
  refresh: async () => {},
});

// eslint-disable-next-line max-len
const COLUMNS = 'id, name, version, award_kind, pass_mark, max_point, bands, is_active, published_at';

export function GradingProvider({ children }: { children: React.ReactNode }) {
  const [scale, setScale] = useState<Scale>(PUBLISHED_SCALE);
  const [loading, setLoading] = useState(true);
  const [why, setWhy] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      // THE GLOBAL SCALE, not a per-award one. `award_kind is null` is the
      // University's scale for everything; a row naming an award is a variant
      // for that award alone, and applying one of those to every student
      // would grade a Bachelor's on the Doctorate's bands.
      //
      // Per-award variants are a real feature of this table and nothing uses
      // them yet. When something does, it reads the variant for the student's
      // award and falls back to this.
      const { data, error } = await supabase
        .from('grading_scales')
        .select(COLUMNS)
        .eq('is_active', true)
        .is('award_kind', null)
        .maybeSingle();

      if (error) {
        setWhy(`The University's grading scale could not be read (${error.message}).`);
        adoptScale(null);
        setScale(PUBLISHED_SCALE);
        return;
      }
      if (!data) {
        setWhy('No grading scale is marked active in the database.');
        adoptScale(null);
        setScale(PUBLISHED_SCALE);
        return;
      }

      const parsed = scaleFromRow(data as Record<string, unknown>);
      if (parsed.isFallback) {
        // `scaleFromRow` returns the published scale rather than throwing when
        // a row will not parse — so this is how that is noticed rather than
        // quietly accepted.
        setWhy('The stored grading scale could not be read as bands, so the published '
          + 'regulations are standing in for it.');
        adoptScale(null);
        setScale(PUBLISHED_SCALE);
        return;
      }

      setWhy(null);
      adoptScale({
        bands: parsed.bands,
        passMark: parsed.passMark,
        maxPoint: parsed.maxPoint,
        name: parsed.name,
      });
      setScale(parsed);
    } catch (e) {
      setWhy(e instanceof Error
        ? `The University's grading scale could not be read (${e.message}).`
        : 'The University’s grading scale could not be read.');
      adoptScale(null);
      setScale(PUBLISHED_SCALE);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const value = useMemo<GradingState>(() => ({
    scale,
    loading,
    source: scale.isFallback ? 'published' : 'university',
    why,
    divergence: scale.isFallback ? [] : divergesFromPublished(scale),
    refresh,
  }), [scale, loading, why, refresh]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useGrading(): GradingState {
  return useContext(Ctx);
}
