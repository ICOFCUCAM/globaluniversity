'use client';

// ---------------------------------------------------------------------------
// WHERE THE STUDENT STANDS, READ ONCE.
//
// ---------------------------------------------------------------------------
// WHY THIS IS A CONTEXT AND NOT A HOOK EACH SCREEN CALLS
// ---------------------------------------------------------------------------
//
// The stage decides three separate things: which entries the sidebar offers,
// what the dashboard says at the top, and what each screen does when it has
// nothing to show. If each of them read the database for itself they would
// eventually read it at different moments and come to different answers — and
// the first time that happened, a student would see "Time to register" on the
// dashboard beside a sidebar with no Course registration in it.
//
// So it is read once, here, and everything below reads the same row.
//
// ---------------------------------------------------------------------------
// A FAILED READ DOES NOT HIDE THE PORTAL
// ---------------------------------------------------------------------------
//
// `stage` is null while the read is in flight and after a read that failed, and
// every consumer treats null as "do not narrow anything". Narrowing on a failed
// read would strand a student with a sidebar of four entries and no way to tell
// that the cause was the network — which is exactly the failure this codebase
// has already shipped twice, on the calendar and on registration.
// ---------------------------------------------------------------------------

import React, {
  createContext, useCallback, useContext, useEffect, useMemo, useState,
} from 'react';
import { useAuth } from './AuthContext';
import { readJourney, type Journey } from '@/components/student/MyProgramme';

interface JourneyState {
  journey: Journey | null;
  /** The stage, or null while unread / unreadable. Null means "do not narrow". */
  stage: string | null;
  loading: boolean;
  failed: string | null;
  /** Re-read after an action that could move the student — registering, mainly. */
  refresh: () => Promise<void>;
}

const Ctx = createContext<JourneyState>({
  journey: null, stage: null, loading: false, failed: null,
  refresh: async () => {},
});

export function JourneyProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const isStudent = user?.role === 'student';
  const [journey, setJourney] = useState<Journey | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    // ONLY STUDENTS HAVE A JOURNEY. `my_journey` filters on auth.uid() and
    // returns nothing at all for a lecturer, so reading it for one would be a
    // round trip whose only possible answer is "no rows" — and would then be
    // indistinguishable from a student whose record is missing.
    if (!isStudent) { setJourney(null); setFailed(null); return; }
    setLoading(true);
    const { journey: j, failed: f } = await readJourney();
    setJourney(j);
    setFailed(f);
    setLoading(false);
  }, [isStudent]);

  useEffect(() => { void refresh(); }, [refresh]);

  const value = useMemo<JourneyState>(() => ({
    journey,
    stage: journey?.stage ?? null,
    loading,
    failed,
    refresh,
  }), [journey, loading, failed, refresh]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useJourney(): JourneyState {
  return useContext(Ctx);
}
