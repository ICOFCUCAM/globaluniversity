# Connecting the University's social accounts

What the University has to do before the Command Centre can publish anything,
and why none of it can be done from inside this system.

---

## The short version

The Command Centre is built and works. It composes, drafts per network,
resolves destinations, enforces who may post as whom, validates against each
platform's limits, writes the post and its fan-out ledger, and records the
publication.

What it cannot do yet is put a message on Facebook, because **every one of these
platforms requires an application registered by the University in its own name,
reviewed by the platform, and granted specific permissions.** That is a series
of forms filled in by a person with authority to act for the institution. No
software can generate it, and this system will not pretend otherwise.

Until an application exists for a network:

- the Command Centre does not offer it as a destination
- Settings → Connected social accounts shows it as *not set up*
- attempting to connect it returns the exact environment variables that are
  missing, rather than a generic failure

A post published with no provider configured is reported as **queued**, and the
publication log says so. It is never reported as published.

---

## What to register, per network

Each block below lists the application, the permissions it must be granted, the
environment variables to set in Vercel, and the part that takes real time.

### Facebook and Instagram and Threads — one Meta app

**Register:** a Meta app at `developers.facebook.com`, with the Facebook Login
and Pages products added.

**Permissions:**

| Network | Permissions |
|---|---|
| Facebook | `pages_manage_posts`, `pages_read_engagement`, `pages_show_list` |
| Instagram | `instagram_basic`, `instagram_content_publish`, `pages_show_list` |
| Threads | `threads_basic`, `threads_content_publish` |

**Environment variables:** `META_APP_ID`, `META_APP_SECRET`, `META_REDIRECT_URI`

**The part that takes time:** publishing permissions require Meta App Review.
Expect weeks. It needs a public privacy policy at a real address and a screen
recording showing the Command Centre in use.

**The part that catches people out:** the Instagram account must be a Business
or Creator account, and it must be linked to the Facebook Page. A personal
Instagram account cannot be published to by any API, by anyone. If the
University's Instagram is currently a personal account, converting it is the
first step and it is free.

### X

**Register:** an app in the X developer portal, on a tier that permits posting.

**Permissions:** `tweet.write`, `tweet.read`, `users.read`, `offline.access`

**Environment variables:** `X_CLIENT_ID`, `X_CLIENT_SECRET`, `X_REDIRECT_URI`

**The part that catches people out:** the free tier has a low monthly post
allowance. Check it against how often the University expects to publish. A
graduation week that exhausts the allowance leaves the account silent for the
rest of the month.

### LinkedIn

**Register:** a LinkedIn app associated with the University's LinkedIn Page.

**Permissions:** `w_member_social`, `w_organization_social`,
`r_organization_social`

**Environment variables:** `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET`,
`LINKEDIN_REDIRECT_URI`

**The part that takes time:** posting as the organisation rather than as a
person needs the Community Management API, requested separately and granted per
page.

### YouTube

**Register:** a Google Cloud project with the YouTube Data API v3 enabled.

**Permissions:** `https://www.googleapis.com/auth/youtube.upload`

**Environment variables:** `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`,
`GOOGLE_REDIRECT_URI`

**The part that catches people out:** an unverified app can only upload videos
as **private**, which is not what a graduation video is for. Google verification
is required before public uploads work. The default upload quota is also small —
a handful of videos a day.

### TikTok

**Register:** a TikTok for Developers app with the Content Posting API.

**Permissions:** `video.publish`, `user.info.basic`

**Environment variables:** `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET`,
`TIKTOK_REDIRECT_URI`

**The part that takes time:** direct posting requires an audit. Until it passes,
the API can only place a video in the account's drafts for a person to publish
by hand.

---

## Where the tokens go

**Not in the database.** `social_accounts.token_ref` is a pointer into a secret
store; the column that holds it is named `token_ref` rather than `token` so that
nobody adds one by mistake.

An OAuth refresh token is a standing permission to speak as the University. In
an application table, it is exposed by every future `SELECT` bug, every
over-broad RLS policy, and every database export handed to a contractor. In a
secret store it is exposed by none of those.

`VERIFY.sql` check 15 looks for anything token-shaped that has found its way
into `token_ref` and reports it. It expects zero rows.

---

## Who may connect what

Three levels, and the middle one is the one that matters.

**The University's accounts** are connected once by the Superadministrator.
Every administrator may then publish through them **without ever holding their
credentials**. This is the whole point of the Command Centre: six networks, one
set of credentials, held by the office that owns them.

**An administrator's own accounts** are connected by that administrator, in
their own settings, and by nobody else. There is no parameter anywhere in
`/api/social/connect` with which to name another person — adding one would be
the entire vulnerability, in a single line.

**Nobody may publish as a colleague.** The University wrote this in terms that
admit no exception, and it is enforced in three independent places:

1. `resolveTargets` in `src/lib/social.ts`, so the composer never draws the
   control
2. `/api/social/publish`, which resolves destinations from the caller's token
   and never from the request body
3. `social_target_consent_trg` in migration 013, in the database, where nothing
   holding the service-role key can route around it

Remove any one and the other two still hold. `src/lib/social.test.mjs` asserts
the rule for every combination of scope, owner and choice, including that the
Superadministrator gets no exception.

**Consent is per post, not per connection.** An administrator who linked their
account in March has not agreed that every announcement for the rest of their
employment goes out under their name. `include_personal` is set on each post,
and the database refuses a personal target when it is false.

---

## Disconnecting

The row survives. `status` becomes `revoked` and `token_ref` is cleared, but the
record stays, because every past publication points at it — and a
communications record with holes in it is worse than one that says an account
was disconnected in August.

An administrator may disconnect their own. The Superadministrator may disconnect
the University's. **Nobody may disconnect somebody else's personal account**,
including the Superadministrator: governing the institution's accounts is not
authority over a member of staff's own.

---

## The writing assistant

Optional. Set `ANTHROPIC_API_KEY` (and optionally `ANTHROPIC_MODEL`) to have
each network's version drafted rather than merely shortened to fit.

Without it the Command Centre still works: the text is fitted to each platform's
limit **on a sentence boundary**, never mid-word, and the response says plainly
that it was fitted rather than rewritten.

The assistant's brief forbids inventing accreditation, rankings, student
numbers, employment rates, partnerships, awards and campus locations. This is
not a style preference. A generated sentence becomes a statement **by the
University** the moment it is published under its name, and a model asked to
make a graduation announcement more impressive will reach for exactly those
figures.

Everything it produces is marked `source: 'assistant'` in the database, so the
question "who wrote this" has an answer years later. Nothing it writes is
published without an administrator reading it and pressing Publish.
