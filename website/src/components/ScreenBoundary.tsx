'use client';

// ---------------------------------------------------------------------------
// A crash in one screen should not take the whole portal down.
//
// Every screen in this system reads from the database and renders whatever
// comes back. A row with a null where the code expects a string, a malformed
// JSON blob in `details`, a date that will not parse — any of these throws
// during render, and React's default behaviour on an uncaught render error is
// to unmount the entire tree. The Registrar loses the sidebar, the top bar and
// their place in the queue, and is left looking at a white page with nothing to
// click, because one applicant's phone number was null.
//
// This catches it at the screen. The navigation survives, so the user can go
// somewhere else and carry on working, and they are told which screen failed
// rather than being left to guess.
//
// It deliberately does NOT retry automatically. A render error is usually
// deterministic — the same row will throw again — and a component that
// re-renders itself into the same crash in a loop is worse than one that stops
// and says so.
// ---------------------------------------------------------------------------

import React from 'react';

interface Props {
  /** Named in the message, so the user knows what to avoid and what to report. */
  screen: string;
  children: React.ReactNode;
}

interface State {
  error: Error | null;
}

export default class ScreenBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Kept to the console rather than sent anywhere. There is no error-reporting
    // service configured for this deployment, and inventing one silently would
    // mean shipping every applicant's data in a stack trace to a third party.
    console.error(`[portal] ${this.props.screen} failed to render`, error, info.componentStack);
  }

  // Moving to another screen must clear the error, or the boundary keeps
  // showing the failure of a screen the user has already left.
  componentDidUpdate(prev: Props) {
    if (prev.screen !== this.props.screen && this.state.error) {
      this.setState({ error: null });
    }
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 dark:border-red-900/50 dark:bg-red-950/30">
        <h2 className="font-heading text-base font-bold text-red-900 dark:text-red-200">
          {this.props.screen} could not be displayed
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-red-800 dark:text-red-300">
          Something in this screen failed while drawing. The rest of the portal is unaffected —
          use the navigation to go elsewhere. Nothing has been changed or lost; this is a display
          fault, not a data one.
        </p>
        <p className="mt-3 rounded-lg bg-white/60 px-3 py-2 font-mono text-xs text-red-900 dark:bg-black/20 dark:text-red-200">
          {this.state.error.message || 'No message was given.'}
        </p>
        <button
          onClick={() => this.setState({ error: null })}
          className="mt-4 rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-semibold text-red-800 transition-colors hover:bg-red-50 dark:border-red-800 dark:bg-transparent dark:text-red-200"
        >
          Try this screen again
        </button>
      </div>
    );
  }
}
