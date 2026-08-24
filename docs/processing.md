# Evaluation processing

## Runtime flow

```text
Browser POST /api/evaluations
  -> evaluation_runs (queued)
  -> Vercel waitUntil background task
  -> permanent /evaluation/{public_token} URL

Evaluation processor
  -> atomic claim_next_evaluation_run() (processing)
  -> OpenRouter structured-output request
  -> Zod + rubric + evidence validation
  -> evaluation_runs (completed or failed)

Report page
  -> GET /api/evaluations/{public_token} every two seconds while active
  -> existing queued, processing, failed, or report component
```

On Vercel, the POST handler schedules one processor cycle with `waitUntil`, so
the response returns immediately while processing continues within the Vercel
Function lifetime. The route uses a five-minute maximum duration for Hobby-plan
Fluid Compute; the OpenRouter timeout remains below that ceiling. Queue claiming
uses `FOR UPDATE SKIP LOCKED` and commits before the external model request,
allowing concurrent submissions without holding database locks during AI
processing.

The standalone worker remains available for local development or deployment to
a persistent process host.

## Configuration

Copy `.env.example` to `.env.local` and set:

```text
SUPABASE_URL
SUPABASE_SECRET_KEY
OPENROUTER_API_KEY
OPENROUTER_MODEL
```

`OPENROUTER_MODEL` must be a `provider/model` slug whose OpenRouter model entry
supports structured outputs and the requested parameters. Optional timeout,
output-token, attribution, and polling settings are documented in
`.env.example`.

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
