# Editing a certificate

There are four separate things people mean by "edit the certificate", they are
changed in four different places, and three of them are governed differently.
Confusing them is how a university ends up with two versions of its own award
in circulation.

| What you want to change | Where | Who | Takes effect |
|---|---|---|---|
| How it **looks** — colours, border, seal, signatures, security artwork | Credentials → **Design** | Superadministrator | On publish, after three offices sign |
| What it **says** for a level — "confers upon" vs "awards to" | `src/lib/awards.ts` | A developer, with a deploy | Next deployment |
| What **fields** a kind of credential carries | Credentials → Register → **Kinds of credential** | The Authority | Immediately |
| A **mistake on somebody's issued certificate** | Credentials → Register → the award → **Amend** | The Authority | New version; the old one is superseded, never overwritten |

Everything is under one menu entry now: **Credentials**. It used to be three —
Credential studio, Credential approvals and Credential authority — and two of
them were the same screen.

---

## 1. Look at the specimen book first

**Credentials → Specimens.** One certificate per level the University confers:
Certificate, Diploma, Bachelor, Master, Doctorate.

Do this before changing anything, because the five levels do not print the same
sentence and a change that reads well on one can be wrong on another. Each
sheet says what it exists to demonstrate.

Every specimen is overprinted SPECIMEN, names an invented holder, and carries
no credential number — and none of them is in the register, so scanning one
returns *no such credential*. They are safe to print, email and put in front of
a committee.

**Fit / Actual size** matters. Some decisions cannot be made at half size:
whether the microtext resolves, whether the seal code can be read, whether the
frame is too busy at 11mm. Those are exactly the ones discovered on paper
otherwise.

---

## 2. How it looks — Credentials → Design

The Superadministrator alone, because somebody who can redesign a certificate
can alter what the University has already attested to.

Ten tabs, and the ones people actually come for:

- **Certificate template** / **Transcript template** — page size, orientation,
  colours, border, margins.
- **Security features** — guilloché, microtext, the watermark device, the
  patterned ground. `credentialArt.ts` is candid about what each layer achieves:
  none of it stops a determined forger. It raises the cost of a casual one. The
  control that actually decides authenticity is the credential number, the QR
  and the register behind `/verify`.
- **Signatures & seal** — who signs, and the area kept clear for the
  hand-affixed wafer.
- **Wording** — the fixed phrases: `senate`, `authority`, `recognition`,
  `confers`, `degreeLead`, `classificationLead`, `privileges`.
- **Version control** — every published design, and which is active.

### Publishing does not overwrite anything

Publishing creates a **new version**. Certificates already issued keep the
design they were issued under, which is why a 2024 certificate can still be
re-rendered as it was in 2024.

### And it needs three signatures

A design cannot go live because one person liked it. The Registrar, the
Academic Office and the Vice-Chancellor each sign, in **Credentials →
Approvals** — the same screen, showing an approver the queue and none of the
design controls. Designing and approving are different people by construction,
not by policy.

---

## 3. What it says for a level — `src/lib/awards.ts`

**Not editable from the portal, deliberately.** This is not the design; it is
what the University *does* when it issues the document, and the five levels are
not interchangeable:

| Level | The verb | The lead-in | Classified? | Names a thesis? |
|---|---|---|---|---|
| Certificate | awards to | the Certificate of | no | no |
| Diploma | awards to | the Diploma of | yes | no |
| Bachelor | confers upon | the Degree of | yes | no |
| Master | confers upon | the Degree of | yes | no |
| Doctorate | **has admitted** | to the Degree of | **no** | **yes** |

A diploma is not a degree and the certificate must not say it is. A doctorate is
neither awarded nor conferred — the candidate is *admitted to* the degree, which
is what the ceremony does. It carries no classification, because a PhD is passed
or passed with corrections and "with Second Class Honours" beneath one is
meaningless. And it names its thesis, because a research degree is conferred on
a piece of work.

These live in `WORDING` in `src/lib/awards.ts`. The level is derived from the
award's own title by `awardKindOf` rather than stored on a separate field — a
separate field drifts, and the first time it does the certificate says one thing
and the record another.

`src/lib/specimens.test.mjs` asserts every one of the rules in that table
against the **rendered** document, so changing one and getting it wrong fails
the build rather than reaching a graduate.

---

## 4. What fields a kind of credential carries

**Credentials → Register → Kinds of credential.** Certificates, diplomas,
transcripts, professional awards, ministry credentials, service and
appreciation awards, honorary awards, and custom types the University defines.

Each type has a template with merge fields — `{{holder_name}}`, `{{award}}`,
`{{issued_on}}` and the rest. `MERGE_FIELDS` in `src/lib/credentialAuthority.ts`
is the list, and `fieldsUsedBy` reports which a given template actually uses, so
a template referencing a field that does not exist is visible before it is used.

Only `academic` types may carry a classification. An appreciation award with an
honours division would be a category error the schema refuses.

---

## 5. A mistake on somebody's issued certificate

**This is the one with rules, and they are not negotiable.**

An issued credential is **never edited**. Not by an administrator, not by the
Registrar, not by the Superadministrator. The database refuses it — migration
013 puts the constraint there, so nothing holding the service-role key can route
around it either.

What happens instead: **Credentials → Register → the award → Amend.** That
writes a **new version**. Version 1 is marked superseded and stays exactly as it
was. Verification resolves the credential number to the **current authoritative
version** and reports that earlier ones exist.

This is why a graduate whose name was misspelt gets a corrected certificate and
the University keeps a complete, ordered account of what it said and when.

### Students may ask; they may not change

A student uses **Request a correction** on their own credential, and attaches
supporting documentation. It arrives in **Credentials → Register → Correction
requests**. A student can never write to `credentials_issued` — the policy does
not permit it, and the request workflow exists precisely so that they do not
need to.

### Revocation is one-way

There is no un-revoke, and no button offering one. Migration 004 refuses it. A
university that can quietly un-revoke a credential cannot be trusted to have
revoked one.

### Every action is recorded

Amendments, reissues, revocations and correction decisions are written to
`credential_audit_events` — append-only, enforced by a trigger. **Credentials →
Register → Audit** reads it: who, what, when, from which version, to which, and
why.

Account changes, role grants and published designs are recorded separately, in
the **System audit log**. Two trails on purpose: one is system custody, the
other is the evidence behind a graduate's document. Each screen names the other
so neither reads as the complete record.

---

## A note on deleting, which is not editing

Nothing in this document destroys a record. If you are looking for that:

- **An issued credential** cannot be deleted by anyone. Amend it, which
  supersedes; or revoke it, which is one-way.
- **An application** can be deleted, by the **Superadministrator alone**, from
  the Registrar desk. It requires a reason and the applicant's own reference
  typed to confirm, the audit entry is written *before* the row is destroyed,
  and an application that has already been admitted is refused outright —
  withdrawal is a status, not a deletion. Migration 018 holds that line in the
  database, service-role callers included.

To refuse an applicant, use **Reject**. That is a decision, it is recorded
against them, and it leaves them a route to reapply.

---

## What cannot be changed from anywhere

- **A sealed credential's content.** Amend it; the original survives.
- **`CREDENTIAL_SECRET`, casually.** It is the key every certificate's QR was
  sealed with. Rotating it makes every certificate already in a graduate's hands
  verify as a forgery. Rotate only in response to a compromise, and be prepared
  to reissue.
- **An audit entry.** Any of them, by anyone.
