'use client';

import { useEffect, useState } from 'react';

/**
 * Premium page chrome: a gold reading-progress bar under the header and a
 * back-to-top control that appears after meaningful scroll.
 */
export default function PageChrome() {
  const [progress, setProgress] = useState(0);
  const [showTop, setShowTop] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      const doc = document.documentElement;
      const max = doc.scrollHeight - doc.clientHeight;
      setProgress(max > 0 ? (doc.scrollTop / max) * 100 : 0);
      setShowTop(doc.scrollTop > 900);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <>
      <div
        aria-hidden="true"
        className="fixed inset-x-0 top-0 z-[70] h-[3px] bg-gradient-to-r from-brand-gold to-brand-gold-deep transition-[width] duration-150"
        style={{ width: `${progress}%` }}
      />
      {showTop && (
        <button
          aria-label="Back to top"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="fixed bottom-24 right-6 z-50 flex h-11 w-11 items-center justify-center rounded-full bg-brand-purple text-brand-gold shadow-xl transition hover:scale-110 print:hidden"
        >
          ↑
        </button>
      )}
    </>
  );
}
