// ---------------------------------------------------------------------------
// A SUPABASE QUERY THAT NEVER LEAVES A SCREEN SPINNING.
//
// ---------------------------------------------------------------------------
// WHY THIS EXISTS
// ---------------------------------------------------------------------------
//
// supabase-js returns `{ data, error }` for anything the database refuses — a
// missing table, a policy violation, a constraint. Every screen in this system
// is written against that, and every screen handles it.
//
// It does NOT return `{ data, error }` when the request never reaches the
// database. A wrong URL, a DNS failure, a proxy refusing the tunnel, a dropped
// connection: those REJECT. An `await` with no catch then abandons the loader,
// the `rows === null` that means "still loading" is never replaced, and the
// screen spins for ever.
//
// This was not theoretical. Running the portal against an unreachable database
// left the Credential Authority register and the Examiner console spinning
// permanently — no error, no message, no way for the person looking at them to
// learn anything. The examiner console is the worse of the two: a proctor
// watching a spinner has no idea whether there are candidates sitting.
//
// So: wrap the query. It resolves either way, and a network failure becomes an
// error the screen already knows how to show.
//
// NAMED runQuery, NOT query. `query` is what a search box calls its state, and the
// collision is silent until TypeScript reports that a string is not callable.
//
// USE IT FOR EVERY QUERY A SCREEN DEPENDS ON TO STOP LOADING. Not for
// fire-and-forget writes, where a rejection is genuinely nothing to act on.
// ---------------------------------------------------------------------------

export interface QueryResult<T> {
  data: T | null;
  error: { message: string } | null;
}

/**
 * What a browser says when it cannot reach the host at all.
 *
 * These reach the screen as an ordinary `error` — supabase-js catches the fetch
 * rejection itself — so wrapping the promise is not enough. A registrar shown
 * "TypeError: Failed to fetch" learns nothing and telephones a developer; the
 * same fact said as a connection problem sends them to look at whether the site
 * is configured.
 */
const CONNECTION_FAILURES = /failed to fetch|networkerror|network request failed|fetch failed|load failed/i;

const CONNECTION_MESSAGE =
  'The database could not be reached. This is a connection problem rather than anything wrong '
  + 'with the records — check that the site is configured with its database address and key.';

export async function runQuery<T>(
  builder: PromiseLike<QueryResult<T>>,
): Promise<QueryResult<T>> {
  try {
    const result = await builder;
    if (result.error && CONNECTION_FAILURES.test(result.error.message)) {
      return { data: result.data, error: { message: CONNECTION_MESSAGE } };
    }
    return result;
  } catch (e) {
    return {
      data: null,
      error: {
        // NAMES THE CAUSE AS A CONNECTION PROBLEM. "TypeError: Failed to fetch"
        // sends a registrar to a developer; "the database could not be reached"
        // sends them to look at whether the site is configured.
        message: CONNECTION_MESSAGE,
      },
    };
  }
}
