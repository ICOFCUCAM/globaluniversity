// ---------------------------------------------------------------------------
// WHERE A PUBLICATION IS READ.
//
//   GET /publications/national-rector              the book
//   GET /publications/national-rector?print=1      …with the print dialogue over it
//   GET /publications/national-rector?download=1   …as a file that saves
//
// ---------------------------------------------------------------------------
// WHY THIS IS NOT UNDER /api/
// ---------------------------------------------------------------------------
//
// Two reasons, and both are load-bearing.
//
// THE ADDRESS IS FORWARDED. It goes into an email to a professor in another
// country, into a WhatsApp message, onto a slide at a conference. `iguc.net/
// publications/national-rector` is an address a person can read out loud;
// `/api/publications/national-rector` is one that looks like a mistake.
//
// AND `reachability.test.mjs` REFUSES A SCREEN THAT NAVIGATES TO `/api/`, for
// the reason it records: a top-level navigation carries no Authorization
// header, so every guarded /api/ address a screen opens in a tab ends in a
// blank page reading no-token. The social connect button did exactly that and
// could never have worked. This route is opened by navigation, so it must not
// be one of those.
//
// ---------------------------------------------------------------------------
// AND WHY IT IS OPEN
// ---------------------------------------------------------------------------
//
// A prospectus that requires an account cannot be forwarded, and forwarding is
// the whole of what the University asked for. Every word in it was written to
// be published; it names no person, no student, no salary and no country.
//
// `src/lib/publications.ts` sets out the line in full: READING is open, SENDING
// under the University's name is `issue-correspondence`.
// ---------------------------------------------------------------------------

import { NextResponse } from 'next/server';
import { publicationBySlug, publicationUrl } from '@/lib/publications';
import { renderBook } from '@/lib/prospectus';

export const runtime = 'nodejs';

// STATIC BY NATURE. The book is compiled into the deployment and does not read
// a database, so the same bytes come back for everybody until somebody commits
// a change — which is exactly the guarantee `publications.ts` argues an archive
// copy has to give. A day is short enough that a corrected typo reaches readers
// the same week and long enough that a link in a conference slide is not a
// request to the origin every time somebody opens it.
export const revalidate = 86_400;

export async function GET(
  request: Request,
  { params }: { params: { slug: string } },
) {
  const publication = publicationBySlug(params.slug);
  if (!publication) {
    return new NextResponse('There is no publication at that address.', {
      status: 404,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    });
  }

  const url = new URL(request.url);
  const print = url.searchParams.get('print') === '1';
  const download = url.searchParams.get('download') === '1';

  const html = renderBook(publication.book, {
    print,
    // NO TOOLBAR ON A COPY THAT IS BEING SAVED OR PRINTED. The saved file is
    // what gets attached to an email and opened on somebody else's machine,
    // and a "Print or save as PDF" bar across the top of it would be furniture
    // from a system the reader has never seen.
    toolbar: !print && !download,
    sourceUrl: publicationUrl(publication.slug, url.origin),
  });

  return new NextResponse(html, {
    status: 200,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      ...(download
        ? { 'content-disposition': `attachment; filename="${publication.filename}"` }
        : {}),
      // A PUBLIC DOCUMENT MAY BE CACHED BY ANYTHING. It is the same for every
      // reader and carries nothing about whoever is reading it.
      'cache-control': 'public, max-age=3600, s-maxage=86400',
    },
  });
}
