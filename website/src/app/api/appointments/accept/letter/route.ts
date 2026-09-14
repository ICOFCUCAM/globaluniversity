// ---------------------------------------------------------------------------
// THE APPOINTEE'S OWN COPY OF THE LETTER THEY ACCEPTED.
//
//   POST /api/appointments/accept/letter  { reference, code }
//
// ---------------------------------------------------------------------------
// WHY THIS EXISTS
// ---------------------------------------------------------------------------
//
// The University: "an accepted letter must open a door next for the appointee
// to download the pdf a4 version".
//
// Until now the appointee's only copy was the attachment on an email — and
// before today that attachment was an .html file. Somebody who accepted their
// appointment and later needed the letter for a bank, a landlord or an embassy
// had to write to the University and ask for it again.
//
// ---------------------------------------------------------------------------
// THE DOOR OPENS ON ACCEPTANCE, AND NOT BEFORE
// ---------------------------------------------------------------------------
//
// Holding a reference and a code proves you are the person the letter was
// addressed to — that is what the acceptance page already relies on. This asks
// for one thing more: THAT YOU HAVE ACCEPTED. An offer not yet answered is
// still an offer, and a permanent download link to an unanswered one invites
// it to be shown around as though it were settled.
//
// A DECLINED OFFER DOES NOT REOPEN THE DOOR either, and the refusal says so
// rather than pretending the letter is missing.
//
// ---------------------------------------------------------------------------
// NO SESSION, AND THAT IS DELIBERATE
// ---------------------------------------------------------------------------
//
// An appointee has no account — they are not staff until the appointment is
// activated, which is the whole reason the acceptance page works this way.
// Requiring a login to collect your own appointment letter would mean creating
// an account for somebody the University has not finished appointing.
// ---------------------------------------------------------------------------

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseUrl as SUPABASE_URL } from '@/lib/supabase';
import { printedReference } from '@/lib/appointments';
import { letterFor, ACCEPT_REFERENCE, APPOINTEE_WINDOW_DAYS } from '@/lib/acceptanceCheck';
import { renderPdf, pdfFilename } from '@/lib/renderPdf';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Row = Record<string, unknown>;

const bad = (error: string, status: number, detail?: string) =>
  NextResponse.json({ ok: false, error, ...(detail ? { detail } : {}) }, { status });

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return bad('bad-json', 400); }

  const reference = String(body.reference ?? '').trim().toUpperCase();
  const code = String(body.code ?? '');
  if (!ACCEPT_REFERENCE.test(reference)) return bad('not-a-reference', 400);

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) return bad('service-role-key-missing', 500);
  const admin = createClient(SUPABASE_URL, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const found = await letterFor(admin, reference, code);
  if ('error' in found && found.error) {
    // THE SAME WORDS THE ACCEPTANCE PAGE USES, so somebody who mistypes a code
    // is not told two different stories by two parts of one system.
    return bad(found.error, found.error === 'wrong-code' ? 403 : 404,
      found.error === 'superseded'
        ? 'This letter has been replaced by a later version. Please use the link in the most '
          + 'recent letter the University sent you.'
        : found.error === 'wrong-code'
          ? 'That verification code does not match this reference. It is printed on the letter '
            + 'itself, beside the reference.'
          : undefined);
  }

  const letter = found.letter as Row;
  const appointment = found.appointment as Row;

  // -------------------------------------------------------------------------
  // READING IS NOT GATED. KEEPING A COPY IS.
  //
  // The University asked whether the first design made sense, and it did not:
  // the acceptance page said "the full terms are on the letter itself" and
  // offered no way to see the letter. It asked somebody to agree to terms while
  // telling them the terms were somewhere else.
  //
  // NOBODY SHOULD EVER BE ASKED TO ACCEPT A DOCUMENT THEY CANNOT READ. So
  // `purpose: 'read'` is open to anyone holding a valid reference and code —
  // which is to say, to the person the letter was addressed to — and it is
  // open BEFORE the decision, which is the only time reading it is any use.
  //
  // `purpose: 'download'` still waits for acceptance, which is what the
  // University asked for: an unanswered offer should not also be a saved file
  // in circulation. That is a distinction of intent rather than a wall —
  // somebody reading the letter can print it — and it is worth having anyway,
  // because the moment an appointee has a copy on their own machine is a moment
  // the record should be able to name.
  // -------------------------------------------------------------------------
  const purpose = body.purpose === 'read' ? 'read' : 'download';

  const { data: standing } = await admin.from('appointment_acceptances')
    .select('decision, at')
    .eq('appointment_id', appointment.id as string)
    .is('superseded_at', null)
    .maybeSingle();

  const answer = standing as Row | null;

  if (purpose === 'download') {
    if (!answer) {
      return bad('not-accepted-yet', 409,
        'This appointment has not been accepted yet. Read the letter here as often as you need; '
        + 'once you accept, your own copy becomes available to download.');
    }
    if (answer.decision !== 'accepted') {
      return bad('declined', 409,
        'This appointment was declined, so there is no accepted letter to issue you a copy of. '
        + 'Please write to the University if that was not what you intended.');
    }

    // ---- THREE DAYS FROM ACCEPTANCE -------------------------------------
    //
    // The University: "the download link must expire after 3days. after 3
    // days, only the superadmin can extract that same letter."
    //
    // COMPUTED, NOT STORED. Three days after the acceptance already on record.
    // A stored expiry on every row would be a second copy of that fact, and
    // the first time the University changed three days to seven, every row
    // written before the change would disagree with the rule.
    //
    // A SUPERADMINISTRATOR'S GRANT WINS WHERE THERE IS ONE. 080 records it
    // with the name of whoever opened it, which is the point: the door closes
    // by itself and reopening it is an act somebody is answerable for.
    const acceptedAt = new Date(String(answer.at));
    const ordinary = new Date(acceptedAt.getTime() + APPOINTEE_WINDOW_DAYS * 86_400_000);
    const granted = appointment.appointee_download_until
      ? new Date(String(appointment.appointee_download_until))
      : null;
    const openUntil = granted && granted > ordinary ? granted : ordinary;

    if (Number.isFinite(openUntil.getTime()) && Date.now() > openUntil.getTime()) {
      return bad('window-closed', 410,
        `The three days for downloading your own copy ended on ${openUntil.toISOString()
          .slice(0, 10)}. Your appointment and your acceptance are unaffected and remain on the `
        + 'University’s permanent record. To be sent the letter again, write to the University '
        + '— the Superadministrator can release a fresh copy to you.');
    }
  }

  // ---- THE DOCUMENT ------------------------------------------------------
  const name = pdfFilename(printedReference(reference));
  try {
    const pdf = await renderPdf(letter.html as string);

    // RECORDED WITH NO ACTOR, because there is none: the appointee is not a
    // user of this system. What the history needs is that the copy was taken
    // and when, which is exactly what this says.
    // BOTH ARE RECORDED, AND THEY ARE DIFFERENT FACTS. That the appointee read
    // the letter before answering is worth as much to a later question as that
    // they took a copy afterwards — more, if anybody ever says they accepted
    // without having seen the terms.
    await admin.from('appointment_events').insert({
      appointment_id: appointment.id as string,
      event: purpose === 'read' ? 'LETTER_VIEWED' : 'LETTER_DOWNLOADED',
      detail: purpose === 'read'
        ? `The appointee opened ${printedReference(reference)} to read before answering`
        : `The appointee downloaded their accepted copy of ${printedReference(reference)}`,
      metadata: { version: letter.version, format: 'pdf', by: 'appointee', purpose },
    });

    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        'content-type': 'application/pdf',
        // READING OPENS IT; COLLECTING SAVES IT. `inline` puts the letter in
        // front of somebody deciding; `attachment` lands it in Downloads under
        // its own reference for somebody who has decided.
        'content-disposition': `${purpose === 'read' ? 'inline' : 'attachment'}; `
          + `filename="${name}"`,
        'cache-control': 'no-store',
      },
    });
  } catch (e) {
    return bad('pdf-not-rendered', 503,
      'Your letter could not be prepared as a PDF just now: '
      + `${e instanceof Error ? e.message : String(e)}. `
      + 'Nothing is wrong with your appointment — please try again shortly, or write to the '
      + 'University and a copy will be sent to you.');
  }
}
