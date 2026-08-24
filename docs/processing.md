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
  -> OpenRouter structured-output request
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

The current choices are GPT-4.1 Mini, GPT-5.6 Luna/Terra/Sol, Claude Haiku
4.5/Sonnet 4.6/Opus 4.8, and Gemini 3.7 Flash/3.5 Flash/2.5 Pro. They were
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
