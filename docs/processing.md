# Evaluation processing

## Runtime flow

```text
Browser POST /api/evaluations
  -> validated model allowlist
  -> evaluation_runs (queued with selected model)
  -> Vercel waitUntil background task
  -> permanent /evaluation/{public_token} URL

Evaluation processor
  -> atomic claim_next_evaluation_run() (processing)
  -> parse labelled turns + deterministic speaker metrics
  -> short call: one structured scoring request
  -> large call: overlapping turn chunks -> rubric evidence maps -> compact dossier
  -> independent rubric-dimension scoring request
  -> Zod + rubric + evidence validation
  -> evaluation_runs (completed or failed)

Report page
  -> GET /api/evaluations/{public_token} every two seconds while active
  -> server-side Supabase reads explicitly bypass the Next.js data cache
  -> processing runs older than six minutes are failed as abandoned
  -> existing queued, processing, failed, or report component
```

On Vercel, the POST handler schedules one processor cycle with `waitUntil`, so
the response returns immediately while processing continues within the Vercel
Function lifetime. The route uses a five-minute maximum duration for Hobby-plan
Fluid Compute; the OpenRouter timeout remains below that ceiling. Queue claiming
uses `FOR UPDATE SKIP LOCKED` and commits before the external model request,
allowing concurrent submissions without holding database locks during AI
processing.

Every provider request logs its model, elapsed time, response status, request
ID, and returned usage without logging the API key or transcript. Terminal
database writes are retried three times. A report poll converts a processing
run older than six minutes to `PROCESSING_TIMEOUT`; this is deliberately above
the five-minute function ceiling so an active worker is not reaped.

The standalone worker remains available for local development or deployment to
a persistent process host.

## Large-transcript quality path

Transcripts under `EVALUATION_LARGE_TRANSCRIPT_WORDS` keep the direct one-call
path. Larger transcripts are split on speaker turns, with a small turn overlap
and preference for explicit topic transitions near a boundary. Oversized single
turns are safely split without losing their source offsets.

Each chunk is independently searched against all 12 dimensions, applicability
conditions, and automatic rules. The resulting compact dossier contains every
chunk summary for coverage and a deduplicated chronological evidence catalog.
Only exact quotes reconciled to the original transcript survive into the
dossier. The final evaluator receives the rubric once, audits every criterion
independently, and may cite only catalog quotes. Repairs reuse the cached dossier
instead of repeating map calls.

Server validation remains authoritative: it recalculates scores and caps,
rejects fabricated evidence, and derives the source speaker, turn index, and
timestamp for every accepted quote. When labels cover less than 80% of parsed
words or fewer than two labelled speakers are present, the dossier explicitly
marks speaker attribution as low confidence.

The chunk threshold, chunk size, overlap, and bounded map concurrency are
configurable in `.env.example`. Defaults favor evidence recall; the direct path
avoids extra requests on transcripts small enough to score without context
dilution.

## Configuration

Copy `.env.example` to `.env.local` and set:

```text
SUPABASE_URL
SUPABASE_SECRET_KEY
OPENROUTER_API_KEY
```

The user selects a model for each submission in the frontend. The shared
allowlist in `lib/evaluation-models.ts` is also enforced by the POST contract,
so changing request JSON cannot select an unreviewed or unexpectedly expensive
model. The selected OpenRouter slug is persisted on `evaluation_runs` before
the job is queued; the processor constructs its provider from that run after an
atomic claim. Concurrent runs can therefore use different models safely.

The current choices are GPT-4.1 Mini and GPT-5.6 Luna/Terra/Sol. They were
verified against OpenRouter's model catalog for strict structured-output support
on 2026-08-25. Availability can change, so review the catalog before adding or
removing an allowlisted slug. Optional timeout, output-token, attribution, and
polling settings are documented in `.env.example`.

## Run locally

Run the web application and worker in separate terminals:

```bash
npm run dev
npm run worker:evaluations
```

The worker validates model output beyond JSON shape: dimension identity and
weights, authored scoring buckets, disabled-dimension applicability, score
normalization, caps, performance band, and exact transcript evidence.

## HTTP surface

- `POST /api/evaluations` creates a queued run and returns its permanent URL.
- `GET /api/evaluations/{public_token}` returns the transcript-free public
  lifecycle/report contract.

The database table and queue-claim function remain unavailable to browser
Supabase roles. These HTTP endpoints are intentionally unauthenticated for the
current MVP. Authentication, rate limiting, and abuse controls are required
before an unrestricted production launch because submissions consume model
credits.
