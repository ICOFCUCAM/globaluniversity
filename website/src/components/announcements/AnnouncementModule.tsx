'use client';

// ---------------------------------------------------------------------------
// COMMUNICATIONS — the University's own noticeboard, and what leaves it.
//
// ---------------------------------------------------------------------------
// WHAT THIS REPLACES
// ---------------------------------------------------------------------------
//
// A noticeboard with no table. A notice was a row on `documents` with its text
// packed into a data-URL, posted by anybody whose role was `admin` or
// `lecturer`, with no clearance, no author on the record and no history — so a
// notice edited after publication simply became a different notice and what the
// University had said on the Tuesday was gone.
//
// ---------------------------------------------------------------------------
// THE TWO THINGS THIS SCREEN KEEPS APART
// ---------------------------------------------------------------------------
//
// AUDIENCE is who the announcement is addressed to. DESTINATION is where it is
// published. They look alike on a form and they are not the same question: a
// notice addressed to Staff can go to the portal alone, and a notice addressed
// to the Public and sent nowhere public is a notice nobody will ever see. The
// form asks both, separately, in that order.
//
// AND THE PORTAL IS NOT A CHOICE. It is drawn ticked and disabled, because it
// is where the announcement IS — the rest are copies sent elsewhere. A tick box
// somebody could clear would allow an announcement published to Facebook and
// nowhere in the University's own system, which is the arrangement this
// replaces: the institution's canonical record living on somebody else's
// server.
// ---------------------------------------------------------------------------

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { can } from '@/lib/roles';
import { BTN_PRIMARY, BTN_SECONDARY, INPUT, LABEL, FOCUS } from '@/lib/portalTheme';
import {
  Megaphone, Plus, Loader2, Check, X, Send, Eye, AlertTriangle, Globe,
} from 'lucide-react';
import {
  CATEGORIES, CATEGORY_LABELS, AUDIENCES, AUDIENCE_LABELS,
  DESTINATIONS, DESTINATION_KEYS, CANONICAL_DESTINATION,
  STATE_LABELS, describeDelivery, objectionsTo, blocks, reachesTheWorld,
  type Category, type DestinationKey, type DeliveryState, type AnnouncementState,
} from '@/lib/announcements';

interface Row {
  id: string;
  title: string;
  body: string;
  category: string;
  audiences: string[];
  status: AnnouncementState;
  author_id: string;
  approved_by: string | null;
  published_at: string | null;
  created_at: string;
  image_alt: string | null;
}

interface DestRow {
  announcement_id: string;
  destination: DestinationKey;
  state: DeliveryState;
  external_url: string | null;
}

// A SINGLE STRING LITERAL. Concatenating or interpolating a column list makes
// supabase-js collapse the inferred type to GenericStringError[], and the
// failure is silent — everything reads as an error object at runtime.
// eslint-disable-next-line max-len
const COLUMNS = 'id, title, body, category, audiences, status, author_id, approved_by, published_at, created_at, image_alt';

const TABS = [
  { key: 'all', label: 'All' },
  { key: 'draft', label: 'Drafts' },
  // NOT IN THE ORIGINAL SKETCH, AND IT IS THE ONE THAT MATTERS. Without a tab
  // for what is waiting on somebody, a clearance is something you have to
  // remember to go and look for — and a notice that nobody clears is a notice
  // that never goes out, silently.
  { key: 'submitted', label: 'Awaiting clearance' },
  { key: 'scheduled', label: 'Scheduled' },
  { key: 'published', label: 'Published' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

export default function AnnouncementModule() {
  const { user } = useAuth();
  const mayCompose = can(user?.role, 'compose-announcement');
  const mayClear = can(user?.role, 'approve-announcement');
  const mayPublish = can(user?.role, 'publish-announcement');
  const mayRelease = mayPublish && can(user?.role, 'publish-social-post');

  const [rows, setRows] = useState<Row[] | null>(null);
  const [dests, setDests] = useState<DestRow[]>([]);
  const [tab, setTab] = useState<TabKey>('all');
  const [composing, setComposing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ tone: 'ok' | 'bad'; text: string } | null>(null);
  const [open, setOpen] = useState<Row | null>(null);
  const [reason, setReason] = useState('');

  const load = useCallback(async () => {
    const [{ data: a }, { data: d }] = await Promise.all([
      supabase.from('announcements').select(COLUMNS)
        .order('created_at', { ascending: false }).limit(200),
      supabase.from('announcement_destinations')
        .select('announcement_id, destination, state, external_url'),
    ]);
    setRows((a ?? []) as unknown as Row[]);
    setDests((d ?? []) as unknown as DestRow[]);
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function act(payload: Record<string, unknown>) {
    setBusy(true);
    setNotice(null);
    const { data: sess } = await supabase.auth.getSession();
    const res = await fetch('/api/announcements', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${sess.session?.access_token ?? ''}`,
      },
      body: JSON.stringify(payload),
    }).catch(() => null);
    const json = await res?.json().catch(() => null);
    setBusy(false);

    if (!json?.ok) {
      // THE SERVER'S OWN SENTENCE. It knows why far better than this component
      // could guess, and "something went wrong" teaches nobody anything.
      setNotice({
        tone: 'bad',
        text: json?.detail
          ?? json?.objections?.map((o: { message: string }) => o.message).join(' ')
          ?? json?.error ?? 'Nothing was recorded.',
      });
      return null;
    }
    setNotice({ tone: 'ok', text: json.detail ?? 'Done.' });
    setReason('');
    await load();
    return json;
  }

  const visible = useMemo(() => {
    const list = rows ?? [];
    if (tab === 'all') return list;
    return list.filter((r) => r.status === tab);
  }, [rows, tab]);

  const destsFor = useCallback(
    (id: string) => dests.filter((d) => d.announcement_id === id),
    [dests],
  );

  if (composing) {
    return (
      <Compose
        onCancel={() => setComposing(false)}
        onDone={async (payload) => {
          const r = await act(payload);
          if (r) setComposing(false);
        }}
        busy={busy}
        notice={notice}
      />
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-bold text-[#422e59] dark:text-[#e9e2f2]">
            Communications
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-[#6b6076] dark:text-[#9c93ad]">
            Publish the University’s announcements from one place. The portal is the record;
            the networks are copies of it.
          </p>
        </div>
        {mayCompose && (
          <button onClick={() => { setComposing(true); setNotice(null); }} className={BTN_PRIMARY}>
            <Plus size={15} /> New announcement
          </button>
        )}
      </header>

      {notice && (
        <p className={`rounded-xl px-4 py-3 text-sm ${notice.tone === 'ok'
          ? 'bg-emerald-50 text-emerald-900' : 'bg-red-50 text-red-900'}`}>
          {notice.text}
        </p>
      )}

      <div className="flex flex-wrap gap-1 border-b border-[#e8e2f0] dark:border-[#332b3d]">
        {TABS.map((t) => {
          const n = t.key === 'all'
            ? (rows ?? []).length
            : (rows ?? []).filter((r) => r.status === t.key).length;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition ${FOCUS} ${
                tab === t.key
                  ? 'border-[#422e59] text-[#422e59] dark:border-[#c9b6e6] dark:text-[#c9b6e6]'
                  : 'border-transparent text-[#6b6076] hover:text-[#422e59]'
              }`}
            >
              {t.label}
              <span className="ml-2 text-xs opacity-60">{n}</span>
            </button>
          );
        })}
      </div>

      {rows === null && <p className="text-sm text-[#6b6076]">Loading…</p>}

      {rows !== null && visible.length === 0 && (
        <div className="rounded-2xl border border-dashed border-[#ded6c8] p-10 text-center
                        dark:border-[#3d3349]">
          <Megaphone size={22} className="mx-auto mb-3 text-[#a49bb0]" />
          <p className="text-sm text-[#6b6076] dark:text-[#9c93ad]">
            {tab === 'all'
              ? 'Nothing has been announced yet.'
              : `Nothing is ${TABS.find((t) => t.key === tab)?.label.toLowerCase()}.`}
          </p>
        </div>
      )}

      <div className="space-y-4">
        {visible.map((r) => (
          <article
            key={r.id}
            className="rounded-2xl border border-[#e8e2f0] bg-white p-5 dark:border-[#332b3d]
                       dark:bg-[#1c1823]"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-heading text-base font-bold text-[#422e59] dark:text-[#e9e2f2]">
                  {r.title}
                </p>
                <p className="mt-1 text-xs text-[#6b6076] dark:text-[#9c93ad]">
                  {CATEGORY_LABELS[r.category as Category] ?? r.category}
                  {' · '}
                  {r.audiences?.map((a) => AUDIENCE_LABELS[a as keyof typeof AUDIENCE_LABELS] ?? a).join(', ')}
                  {r.published_at
                    ? ` · Published ${new Date(r.published_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`
                    : ` · Started ${new Date(r.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`}
                </p>
              </div>
              <span className="shrink-0 rounded-full bg-[#f2eee6] px-3 py-1 text-xs font-medium
                               text-[#4a4155] dark:bg-[#2a2333] dark:text-[#c8c1d4]">
                {STATE_LABELS[r.status] ?? r.status}
              </span>
            </div>

            {/* WHERE IT ACTUALLY REACHED, per destination. One flag saying
                "published" would be true when one network accepted it and five
                refused, and the person who has to fix it needs to know which. */}
            <div className="mt-4 flex flex-wrap gap-2">
              {destsFor(r.id).map((d) => (
                <span
                  key={d.destination}
                  title={DESTINATIONS[d.destination]?.note}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs ${
                    d.state === 'delivered' ? 'bg-emerald-50 text-emerald-800'
                      : d.state === 'failed' ? 'bg-red-50 text-red-800'
                        : d.state === 'retracted' ? 'bg-gray-100 text-gray-600 line-through'
                          : 'bg-[#f2eee6] text-[#6b6076] dark:bg-[#2a2333] dark:text-[#9c93ad]'}`}
                >
                  {d.state === 'delivered' && <Check size={12} />}
                  {d.state === 'failed' && <X size={12} />}
                  {DESTINATIONS[d.destination]?.label ?? d.destination}
                </span>
              ))}
            </div>
            <p className="mt-2 text-xs text-[#6b6076] dark:text-[#9c93ad]">
              {describeDelivery(destsFor(r.id).map((d) => d.state))}
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              <button onClick={() => setOpen(open?.id === r.id ? null : r)} className={BTN_SECONDARY}>
                <Eye size={14} /> {open?.id === r.id ? 'Hide' : 'View'}
              </button>

              {r.status === 'draft' && mayCompose && r.author_id === user?.id && (
                <button disabled={busy} onClick={() => void act({ action: 'submit', id: r.id })}
                  className={BTN_SECONDARY}>
                  <Send size={14} /> Send for clearance
                </button>
              )}

              {r.status === 'submitted' && mayClear && (
                r.author_id === user?.id ? (
                  // SAID RATHER THAN HIDDEN. A button that simply is not there
                  // leaves somebody wondering why; this explains the rule.
                  <p className="flex items-center gap-2 rounded-lg bg-[#faf6ee] px-3 py-2 text-xs
                                text-[#6b5a2f] dark:bg-[#241f2c] dark:text-[#c3b48f]">
                    <AlertTriangle size={13} />
                    You wrote this, so somebody else has to clear it.
                  </p>
                ) : (
                  <>
                    <button disabled={busy}
                      onClick={() => void act({ action: 'decide', id: r.id, decision: 'approve' })}
                      className={BTN_PRIMARY}>
                      <Check size={14} /> Clear it
                    </button>
                    <input value={reason} onChange={(e) => setReason(e.target.value)}
                      placeholder="Why it is not cleared" className={`${INPUT} w-64 text-xs`} />
                    <button disabled={busy || reason.trim().length < 12}
                      onClick={() => void act({ action: 'decide', id: r.id, decision: 'reject', reason })}
                      className={BTN_SECONDARY}>
                      <X size={14} /> Return it
                    </button>
                  </>
                )
              )}

              {(r.status === 'approved' || r.status === 'scheduled') && mayPublish && (
                <button disabled={busy} onClick={() => void act({ action: 'publish', id: r.id })}
                  className={BTN_PRIMARY}>
                  <Megaphone size={14} /> Publish
                </button>
              )}

              {r.status === 'published' && mayRelease
                && destsFor(r.id).some((d) => d.state === 'pending') && (
                <button disabled={busy} onClick={() => void act({ action: 'release', id: r.id })}
                  className={BTN_PRIMARY}>
                  <Globe size={14} /> Send to the networks
                </button>
              )}

              {r.status === 'published' && mayPublish && (
                <>
                  <input value={reason} onChange={(e) => setReason(e.target.value)}
                    placeholder="Why it is coming down" className={`${INPUT} w-64 text-xs`} />
                  <button disabled={busy || reason.trim().length < 12}
                    onClick={() => void act({ action: 'retract', id: r.id, reason })}
                    className={BTN_SECONDARY}>
                    Retract
                  </button>
                </>
              )}
            </div>

            {open?.id === r.id && (
              <p className="mt-4 whitespace-pre-wrap border-t border-[#f0ece4] pt-4 text-sm
                            leading-relaxed text-[#4a4155] dark:border-[#2a2333] dark:text-[#c8c1d4]">
                {r.body}
              </p>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// THE CREATION SCREEN
// ---------------------------------------------------------------------------

function Compose({
  onCancel, onDone, busy, notice,
}: {
  onCancel: () => void;
  onDone: (payload: Record<string, unknown>) => void;
  busy: boolean;
  notice: { tone: 'ok' | 'bad'; text: string } | null;
}) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [category, setCategory] = useState<Category>('general');
  const [audiences, setAudiences] = useState<string[]>(['students']);
  const [destinations, setDestinations] = useState<string[]>([CANONICAL_DESTINATION]);
  const [imagePath, setImagePath] = useState('');
  const [imageAlt, setImageAlt] = useState('');

  const draft = {
    title, body, category, audiences,
    image_path: imagePath || null, image_alt: imageAlt || null,
  };
  // SAID BEFORE THE CLICK, not discovered when a network returns an error hours
  // later and somebody has to work out which of six destinations it was about.
  const objections = objectionsTo(draft, destinations, { hasImage: Boolean(imagePath) });

  const toggle = (list: string[], v: string, set: (x: string[]) => void) =>
    set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  return (
    <div className="max-w-3xl space-y-6">
      <header>
        <h1 className="font-heading text-2xl font-bold text-[#422e59] dark:text-[#e9e2f2]">
          Create announcement
        </h1>
        <p className="mt-1 text-sm text-[#6b6076] dark:text-[#9c93ad]">
          It is saved as a draft. Somebody other than you clears it before it is published.
        </p>
      </header>

      {notice && (
        <p className={`rounded-xl px-4 py-3 text-sm ${notice.tone === 'ok'
          ? 'bg-emerald-50 text-emerald-900' : 'bg-red-50 text-red-900'}`}>{notice.text}</p>
      )}

      <div className="space-y-1.5">
        <label htmlFor="a-title" className={LABEL}>Title</label>
        <input id="a-title" value={title} onChange={(e) => setTitle(e.target.value)}
          className={INPUT} placeholder="e.g. 2026/2027 admissions are open" />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="a-body" className={LABEL}>Announcement</label>
        <textarea id="a-body" value={body} onChange={(e) => setBody(e.target.value)}
          rows={8} className={INPUT}
          placeholder="Say what changed, for whom, and from when." />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="a-img" className={LABEL}>Featured image</label>
        <input id="a-img" value={imagePath} onChange={(e) => setImagePath(e.target.value)}
          className={INPUT} placeholder="Storage path of an uploaded image" />
        {imagePath && (
          <div className="space-y-1.5 pt-2">
            <label htmlFor="a-alt" className={LABEL}>Describe the image</label>
            <input id="a-alt" value={imageAlt} onChange={(e) => setImageAlt(e.target.value)}
              className={INPUT} placeholder="e.g. Graduands on the steps of the main hall" />
            {/* REQUIRED, NOT OPTIONAL, and the reason is said out loud. Every
                network this is published to carries the omission onward. */}
            <p className="text-xs text-[#6b6076] dark:text-[#9c93ad]">
              Without this, a reader using a screen reader gets nothing at all — and every
              network this is published to repeats the omission.
            </p>
          </div>
        )}
      </div>

      <fieldset className="space-y-2">
        <legend className={LABEL}>Category</legend>
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((c) => (
            <button key={c} type="button" onClick={() => setCategory(c)}
              className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${FOCUS} ${
                category === c
                  ? 'border-[#422e59] bg-[#422e59] text-white'
                  : 'border-[#d9cfe4] text-[#422e59] hover:bg-[#f5f0fa] dark:border-[#3d3349] dark:text-[#c9b6e6]'
              }`}>
              {CATEGORY_LABELS[c]}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="space-y-2">
        <legend className={LABEL}>Audience — who this is addressed to</legend>
        <div className="flex flex-wrap gap-3">
          {AUDIENCES.map((a) => (
            <label key={a} className="inline-flex items-center gap-2 text-sm text-[#4a4155]
                                      dark:text-[#c8c1d4]">
              <input type="checkbox" checked={audiences.includes(a)}
                onChange={() => toggle(audiences, a, setAudiences)} />
              {AUDIENCE_LABELS[a]}
            </label>
          ))}
        </div>
        {reachesTheWorld(audiences) && (
          <p className="flex items-start gap-2 rounded-lg bg-[#faf6ee] px-3 py-2 text-xs
                        text-[#6b5a2f] dark:bg-[#241f2c] dark:text-[#c3b48f]">
            <AlertTriangle size={13} className="mt-0.5 shrink-0" />
            Addressed to the public — anybody at all, including people who have never applied.
            Read it once more as a stranger would.
          </p>
        )}
      </fieldset>

      <fieldset className="space-y-2">
        <legend className={LABEL}>Publish to — where it is sent</legend>
        <div className="space-y-2">
          {DESTINATION_KEYS.map((k) => {
            const d = DESTINATIONS[k];
            const fixed = k === CANONICAL_DESTINATION;
            return (
              <label key={k} className="flex items-start gap-2 text-sm text-[#4a4155]
                                        dark:text-[#c8c1d4]">
                <input type="checkbox" className="mt-1"
                  checked={fixed || destinations.includes(k)}
                  disabled={fixed}
                  onChange={() => toggle(destinations, k, setDestinations)} />
                <span>
                  {d.label}
                  {fixed && <span className="ml-2 text-xs opacity-60">always</span>}
                  <span className="block text-xs text-[#6b6076] dark:text-[#9c93ad]">{d.note}</span>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      {objections.length > 0 && (
        <ul className="space-y-2 rounded-xl bg-[#faf6ee] p-4 text-xs text-[#6b5a2f]
                       dark:bg-[#241f2c] dark:text-[#c3b48f]">
          {objections.map((o) => (
            <li key={o.code}>{o.blocking ? '' : 'Worth a second look: '}{o.message}</li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap gap-3">
        <button disabled={busy || blocks(objections)} className={BTN_PRIMARY}
          onClick={() => onDone({
            action: 'draft', title, body, category, audiences, destinations,
            imagePath: imagePath || undefined, imageAlt: imageAlt || undefined,
          })}>
          {busy ? <><Loader2 size={15} className="animate-spin" /> Saving…</> : 'Save as draft'}
        </button>
        <button onClick={onCancel} className={BTN_SECONDARY}>Cancel</button>
      </div>
    </div>
  );
}
