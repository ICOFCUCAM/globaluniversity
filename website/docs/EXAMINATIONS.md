# The Digital Examination & Proctoring System

What is built, what the University must supply, and the decisions that are
deliberate rather than incidental.

---

## What works today

Everything except live video.

| | |
|---|---|
| Setting a paper | Five modes — written, oral, practical, defence, take-home |
| Question approval | A moderator approves; **not** the person who set the paper |
| Publication | The Examination Office releases an approved paper |
| Eligibility | Checked against the register when a sitting is created |
| Identity, device and connection checks | Recorded as evidence before the start |
| The clock | Central. Paused time is returned; extensions are recorded |
| Autosave | Every save a new revision, never an overwrite |
| Events | Window focus, full screen, paste, screen share, connection |
| Incidents | Any proctor may record an observation |
| Findings | Only a moderator, only with reasoning, never their own incident |
| Marking and moderation | Second-marker rule enforced by the database |
| Audit | Who → what → when → before → after → reason, append-only |

**Live camera, microphone and screen sharing do not work**, because no media
provider is configured. See below.

---

## What the University must supply

### A media provider

Three live streams per candidate, carried to an examiner who may be on another
continent, recorded, and stored. That is WebRTC infrastructure — TURN servers,
a selective forwarding unit, recording egress — and it is a service the
University subscribes to rather than something this repository can contain.

| Provider | Environment variables | Note |
|---|---|---|
| **LiveKit** | `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` | Self-hostable — the only option that keeps recordings of students' homes on infrastructure the University controls. Needs someone who can run it. |
| **Daily** | `DAILY_API_KEY`, `DAILY_DOMAIN` | Hosted. Fastest to stand up; recordings live on their infrastructure. |
| **Twilio Video** | `TWILIO_ACCOUNT_SID`, `TWILIO_API_KEY`, `TWILIO_API_SECRET` | Hosted, wide network reach — useful where candidates are on poor connections. |

Until one is set, the examiner console **says so** rather than drawing camera
panels with nothing behind them. A dead video tile is worse than an honest
message: the examiner believes they are watching, the candidate believes they
are being watched, and nobody finds out for weeks.

`src/lib/proctoringProvider.ts` defines the adapter the provider must satisfy —
including `destroyRecording`, which is not optional. A provider that cannot be
told to delete makes the retention obligation below impossible to meet.

### A retention period

`exam_recordings.retention_until` is set at the moment of recording, so a later
change of policy cannot retroactively extend how long a past candidate's home
video is kept. **The University has to choose a period.** "We keep it for ever
because deleting is hard" is not a lawful answer anywhere this institution
teaches, and `VERIFY.sql` check 23 lists any recording nobody has decided the
fate of.

### People in the four examination roles

`exam-officer`, `examiner`, `invigilator`, `moderator`. The separations below
only work if the roles are held by different people.

---

## Decisions that are deliberate

### Evidence and decisions are separate, and the database enforces it

Evidence — events, answers, recordings, identity and device checks — is
**append-only**. No UPDATE, no DELETE, for any caller including the
Superadministrator and anything holding the service-role key.

Decisions — incidents, findings, marks, moderation, session control — are
attributable and revisable, each carrying who, what, when, before, after and
why.

An appeal asks two questions: what actually happened, and was the judgement
about it sound. A system holding both in one editable table can answer neither,
because the evidence may have been revised to fit the finding and there is no
way to tell.

### An automated event cannot express a verdict

`exam_events` has no `is_cheating`, no `verdict`, no `outcome`. There is nowhere
to put one. A finding can only exist in `exam_findings`, whose `decided_by` is
NOT NULL.

A schema in which the automated layer **cannot** convict is a stronger guarantee
than a policy saying it should not. `VERIFY.sql` check 22 fails if the column
ever appears.

### Three levels, never two

**Alert** — a detector saw a signal. **Incident** — a person observed something
and wrote it down. **Finding** — a person determined it was misconduct.

Collapsing any two would let a camera glitch end a degree. A camera mistakes
reflections, posters, and a sibling walking through a shared room.

### Nobody judges their own observation

The person who raised an incident cannot determine it. A mark cannot be
moderated by whoever awarded it. A paper's questions cannot be approved by
whoever set it. All three are enforced by database triggers, not by convention.

Someone who has spent forty minutes watching a candidate and suspecting them is
the worst available judge of whether the suspicion was justified.

### The invigilator is the narrowest role in the system

They watch, and they write down what they saw. They cannot mark, moderate,
terminate a sitting, or decide that what they saw was cheating. Their
observation is evidence; somebody else weighs it.

### A take-home paper requires no camera

Demanding one for seventy-two hours is not an integrity control. It is a rule
nobody can comply with, and rules nobody can comply with are how a proctoring
system loses the confidence of the people it supervises — after which they stop
reporting the genuine faults too.

Its controls are different in kind: the submission deadline, the work itself,
and the University's academic-conduct regulations.

**This is a judgement, not a requirement.** If the University wants it
stricter, the defaults are in `MODE_PROFILES` in `src/lib/examinations.ts` and
are per-paper overridable.

### The clock is served, never trusted

A countdown in the candidate's browser is a countdown the candidate can edit.
`remainingMs` derives the answer from the server-recorded start; the browser
displays what it is told and counts down only between polls. Every save
recomputes it, so a save arriving after zero is refused whatever the screen
showed — **and the refusal is recorded**, because a candidate who kept typing
past the end has done nothing wrong and the register must be able to explain
why their last paragraph is missing.

### Every save is a new row

"The system crashed and lost my essay" is the commonest examination dispute
there is, and it is unanswerable if the table holds only the final state. With
a revision per save the University can say what the candidate had at 10:42 and
that nothing arrived after 10:47.

---

## Integration

The examination mark is **not** a parallel record. It flows into `results` and
travels the four-office approval chain migration 009 already built — lecturer
submits, Head of Department moderates, Dean approves, Registrar publishes — and
from there into the GPA, the transcript and the credential register.

A marks table that stopped at the examination would be the most expensive kind
of wrong: the GPA would not move, the transcript would not show it, no
certificate could be issued against it, and everything would appear to work.
