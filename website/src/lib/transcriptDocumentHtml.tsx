// ---------------------------------------------------------------------------
// THE TRANSCRIPT AS A FILE — the same component, rendered on the server.
//
// ---------------------------------------------------------------------------
// WHY THIS IS THE WHOLE POINT
// ---------------------------------------------------------------------------
//
// The delivery route used to hand-write the transcript as an HTML string:
// portrait, five columns, no grade system, no crest, no watermark, no legend.
// It was a different document from the one the Registrar previewed and a
// different document again from the one the Studio approved, and the University
// spent twelve rounds correcting a fourth that nothing rendered at all.
//
// So the emailed and printed copy is now produced by rendering `TranscriptMaster`
// — the corrected one — through `renderToStaticMarkup`. If the sheet changes,
// all four surfaces change together, because there is only one sheet.
//
// ---------------------------------------------------------------------------
// SELF-CONTAINED, AS FAR AS IT CAN HONESTLY BE
// ---------------------------------------------------------------------------
//
// This file is emailed, saved to a desktop and opened years later on a machine
// with no network. The type, the rules, the guilloché and the microtext are all
// inline already — the art is generated as data: URIs and the styles are on the
// elements.
//
// THE CREST AND THE WATERMARK ARE THE EXCEPTION, and they are handled honestly:
// the route inlines the PNG as a data: URI when it can read it off disk, and
// falls back to an absolute URL on the site when it cannot. A document that
// silently loses its watermark offline would be worse than one that fetches it.
// ---------------------------------------------------------------------------

import React from 'react';
import TranscriptMaster from '@/components/transcript/TranscriptMaster';
import type { CredentialDesign } from '@/lib/credentialTemplate';
import type { TranscriptMasterData } from '@/lib/transcriptMaster';
import { UNIVERSITY } from '@/lib/constants';

const escape = (s: unknown) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * IMPORTED AT CALL TIME, NOT AT THE TOP OF THE FILE.
 *
 * Next.js refuses a static `import … from 'react-dom/server'` anywhere under
 * app/ — it cannot tell a route handler that legitimately renders a document to
 * a string from a component that has accidentally pulled the server renderer
 * into a page. The advice it prints ("render it as a Server Component") does
 * not apply here: the output is a FILE, attached to an email and saved to a
 * desktop, not a response body.
 *
 * So it is loaded when the document is actually built. Nothing else changes:
 * the route is `runtime = 'nodejs'`, and this never reaches a browser bundle.
 */
export async function transcriptDocumentHtml({
  design, data, specimen,
}: {
  design: CredentialDesign;
  data: TranscriptMasterData;
  specimen?: boolean;
}): Promise<string> {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const body = renderToStaticMarkup(
    <TranscriptMaster design={design} data={data} specimen={specimen} />,
  );

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escape(data.credentialId ?? 'Academic Transcript')} — ${escape(UNIVERSITY.name)}</title>
<style>
  /* The sheet carries its own page rules; this is only the ground it sits on
     when the file is opened on screen rather than printed. */
  html, body { margin: 0; padding: 0; background: #efece4; }
  body { display: flex; justify-content: center; padding: 18px 12px; }
  @media print { body { background: #fff; padding: 0; display: block; } }
  .icof-sheet { box-shadow: 0 2px 24px rgba(0,0,0,.14); }
  @media print { .icof-sheet { box-shadow: none !important; } }
</style></head>
<body>${body}</body></html>`;
}
