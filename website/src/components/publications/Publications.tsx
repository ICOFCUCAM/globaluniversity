'use client';

// ---------------------------------------------------------------------------
// PUBLICATIONS — the Vice-Chancellor's shelf, and the four ways off it.
//
// ---------------------------------------------------------------------------
// WHAT THE UNIVERSITY ASKED FOR
// ---------------------------------------------------------------------------
//
//     "it should be stored in the VC archive ready to be forwarded by email,
//      whatsap or any method."
//
// "Ready to be forwarded" is the whole specification. A book that has to be
// found, exported, renamed and attached by hand is not ready; it is a file
// somebody has to remember how to send. So the shelf holds the book and the
// four ways off it in one place: read it, print it, save it, send it.
//
// ---------------------------------------------------------------------------
// AND IT SAYS WHAT THE UNIVERSITY WILL AND WILL NOT KNOW AFTERWARDS
// ---------------------------------------------------------------------------
//
// This is the part a screen usually leaves out and this one must not. Email
// goes through the University's own mail server, which reports back. WhatsApp
// opens the officer's own WhatsApp and the University cannot see what happens
// next — 079 ruled that a record asserting a delivery nobody observed is
// evidence against the University that was never true.
//
// An officer who believes both buttons confirm delivery will tell a candidate
// the prospectus was delivered. So each one says, beside itself, exactly what
// will be true once it is pressed.
// ---------------------------------------------------------------------------

import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { authedPost } from '@/lib/authedFetch';
import { can, type Capability } from '@/lib/roles';
import { BTN_PRIMARY, BTN_SECONDARY, INPUT, LABEL } from '@/lib/portalTheme';
import { whatsappNumber, whyNotWhatsApp } from '@/lib/whatsapp';
import {
  PUBLICATIONS, CHANNEL_CERTAINTY, chapterCount, type Publication,
} from '@/lib/publications';
import {
  AlertTriangle, BookOpen, Check, Copy, Download, Loader2, Mail, MessageCircle, Printer, Send,
} from 'lucide-react';

type Note = { kind: 'ok' | 'bad'; text: string } | null;

export default function Publications() {
  const { user } = useAuth();
  const maySend = can(user?.role, 'issue-correspondence' as Capability);

  return (
    <div className="space-y-6 p-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-wide text-[#57549a]">
          Office of the Vice-Chancellor
        </p>
        <h1 className="text-2xl font-semibold text-[#322244]">Publications</h1>
        <p className="mt-1 max-w-3xl text-sm text-slate-600">
          The books the University sends out under its own name. Each one can be read on screen,
          printed, saved as a file, or sent to a named person from this office.
        </p>
      </header>

      {!maySend && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          <AlertTriangle size={16} className="mr-2 inline" />
          You can read, print and save anything on this shelf. Sending one under the University’s
          name belongs to the offices that issue its correspondence.
        </div>
      )}

      <ul className="space-y-5">
        {PUBLICATIONS.map((publication) => (
          <li key={publication.slug}>
            <Shelf publication={publication} maySend={maySend} />
          </li>
        ))}
      </ul>
    </div>
  );
}


function Shelf({ publication, maySend }: { publication: Publication; maySend: boolean }) {
  const [open, setOpen] = useState<'email' | 'whatsapp' | null>(null);
  const [note, setNote] = useState<Note>(null);
  const [busy, setBusy] = useState(false);

  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [number, setNumber] = useState('');

  // A RELATIVE ADDRESS ON SCREEN AND AN ABSOLUTE ONE ON THE CLIPBOARD.
  //
  // The link opens in this browser, where a path is enough. What gets COPIED is
  // pasted into somebody else's mail client, where a path reaches nobody — so
  // the copy is built against this deployment's own origin. The server builds
  // the same address for the email and the WhatsApp message; it is derived from
  // the request there rather than typed in two places.
  const path = `/publications/${publication.slug}`;
  const absolute = typeof window === 'undefined' ? path : `${window.location.origin}${path}`;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(absolute);
      setNote({ kind: 'ok', text: `The address is on your clipboard: ${absolute}` });
    } catch {
      // A CLIPBOARD CAN REFUSE — an insecure origin, a permission, an older
      // browser. Showing the address is what the officer needed anyway.
      setNote({ kind: 'bad', text: `Your browser would not take it. The address is ${absolute}` });
    }
  };

  const sendEmail = async () => {
    setBusy(true); setNote(null);
    const result = await authedPost('/api/publications/forward', {
      slug: publication.slug, channel: 'email', to: address.trim(), name: name.trim(),
    });
    setBusy(false);
    if (!result.ok) {
      setNote({ kind: 'bad', text: result.detail ?? result.error ?? 'It was not sent.' });
      return;
    }
    setNote({
      kind: 'ok',
      text: `Sent to ${address.trim()}, with ${publication.title} attached and a link to it. `
        + 'The mail server accepted it.',
    });
    setOpen(null); setAddress(''); setName('');
  };

  const sendWhatsApp = async () => {
    const why = whyNotWhatsApp(number);
    if (why) { setNote({ kind: 'bad', text: why }); return; }

    setBusy(true); setNote(null);
    // THE RECORD IS WRITTEN FIRST, and it records a handover rather than a
    // delivery. If WhatsApp never opens, the University's register says an
    // officer tried — which is true and is the useful thing to have kept.
    const result = await authedPost('/api/publications/forward', {
      slug: publication.slug, channel: 'whatsapp', number, name: name.trim(),
    });
    setBusy(false);
    if (!result.ok) {
      setNote({ kind: 'bad', text: result.detail ?? result.error ?? 'It was not recorded.' });
      return;
    }

    const message = `${publication.title} — ${publication.subtitle}\n\n${absolute}`;
    window.open(
      `https://wa.me/${whatsappNumber(number)}?text=${encodeURIComponent(message)}`,
      '_blank', 'noopener',
    );
    setNote({
      kind: 'ok',
      text: 'WhatsApp has been opened with the message ready. The University has recorded that '
        + 'you handed it over — it cannot see whether you press send.',
    });
    setOpen(null); setNumber(''); setName('');
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 max-w-2xl">
          <p className="text-xs uppercase tracking-wide text-slate-500">
            {publication.kind} · {chapterCount(publication)} chapters
          </p>
          <h2 className="mt-0.5 text-lg font-semibold text-[#322244]">{publication.title}</h2>
          <p className="text-sm italic text-slate-600">{publication.subtitle}</p>
          <p className="mt-2 text-sm text-slate-600">{publication.summary}</p>
          <p className="mt-2 text-xs text-slate-500">
            <span className="font-medium">Written for: </span>{publication.audience}
          </p>
        </div>

        {/* THE FOUR WAYS OFF THE SHELF. Links rather than buttons for the three
            that open a page, because a link can be middle-clicked, bookmarked
            and copied — and because the reading address is public, so nothing
            here needs a token. */}
        <div className="flex shrink-0 flex-col gap-2">
          <a href={path} target="_blank" rel="noopener noreferrer" className={BTN_PRIMARY}>
            <BookOpen size={14} className="mr-1.5 inline" />Read it
          </a>
          <a href={`${path}?print=1`} target="_blank" rel="noopener noreferrer"
            className={BTN_SECONDARY}>
            <Printer size={14} className="mr-1.5 inline" />Print or save as PDF
          </a>
          <a href={`${path}?download=1`} className={BTN_SECONDARY}>
            <Download size={14} className="mr-1.5 inline" />Download the file
          </a>
          <button type="button" onClick={() => void copyLink()} className={BTN_SECONDARY}>
            <Copy size={14} className="mr-1.5 inline" />Copy the link
          </button>
        </div>
      </div>

      {note && (
        <div className={`mt-4 rounded-lg border p-3 text-sm ${note.kind === 'ok'
          ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
          : 'border-rose-300 bg-rose-50 text-rose-900'}`}>
          {note.kind === 'ok' ? <Check size={16} className="mr-2 inline" />
            : <AlertTriangle size={16} className="mr-2 inline" />}
          {note.text}
        </div>
      )}

      {maySend && (
        <div className="mt-4 border-t border-slate-200 pt-4">
          <p className={LABEL}>Send it to somebody</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" className={BTN_SECONDARY}
              onClick={() => { setOpen(open === 'email' ? null : 'email'); setNote(null); }}>
              <Mail size={14} className="mr-1.5 inline" />By email
            </button>
            <button type="button" className={BTN_SECONDARY}
              onClick={() => { setOpen(open === 'whatsapp' ? null : 'whatsapp'); setNote(null); }}>
              <MessageCircle size={14} className="mr-1.5 inline" />By WhatsApp
            </button>
          </div>

          {open === 'email' && (
            <div className="mt-3 rounded-lg border border-[#57549a] bg-[#f8f7fc] p-3">
              <p className="mb-2 text-xs text-slate-600">{CHANNEL_CERTAINTY.email}</p>
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className={LABEL} htmlFor={`name-${publication.slug}`}>
                    Their name (optional — it becomes the greeting)
                  </label>
                  <input id={`name-${publication.slug}`} className={`${INPUT} mt-1`}
                    value={name} onChange={(e) => setName(e.target.value)}
                    placeholder="Prof Adaeze Okonkwo" />
                </div>
                <div>
                  <label className={LABEL} htmlFor={`to-${publication.slug}`}>
                    Their email address
                  </label>
                  <input id={`to-${publication.slug}`} type="email" className={`${INPUT} mt-1`}
                    value={address} onChange={(e) => setAddress(e.target.value)} />
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <button type="button" className={BTN_PRIMARY} disabled={busy || !address.trim()}
                  onClick={() => void sendEmail()}>
                  {busy ? <Loader2 size={14} className="mr-1.5 inline animate-spin" />
                    : <Send size={14} className="mr-1.5 inline" />}
                  Send it
                </button>
                <button type="button" className={BTN_SECONDARY} onClick={() => setOpen(null)}>
                  Cancel
                </button>
              </div>
            </div>
          )}

          {open === 'whatsapp' && (
            <div className="mt-3 rounded-lg border border-[#57549a] bg-[#f8f7fc] p-3">
              <p className="mb-2 text-xs text-slate-600">{CHANNEL_CERTAINTY.whatsapp}</p>
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className={LABEL} htmlFor={`wname-${publication.slug}`}>
                    Their name (optional — for the record, not the message)
                  </label>
                  <input id={`wname-${publication.slug}`} className={`${INPUT} mt-1`}
                    value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div>
                  <label className={LABEL} htmlFor={`num-${publication.slug}`}>
                    Their number, with the country code
                  </label>
                  <input id={`num-${publication.slug}`} className={`${INPUT} mt-1`}
                    value={number} onChange={(e) => setNumber(e.target.value)}
                    placeholder="+237 675 133 426" />
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <button type="button" className={BTN_PRIMARY} disabled={busy || !number.trim()}
                  onClick={() => void sendWhatsApp()}>
                  {busy ? <Loader2 size={14} className="mr-1.5 inline animate-spin" />
                    : <MessageCircle size={14} className="mr-1.5 inline" />}
                  Open WhatsApp
                </button>
                <button type="button" className={BTN_SECONDARY} onClick={() => setOpen(null)}>
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
