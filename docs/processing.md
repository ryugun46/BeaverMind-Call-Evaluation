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
  -> short call: full transcript retained as scoring evidence
  -> large call: overlapping turn chunks -> mandatory 12-dimension/rule audits
  -> independent global rule audit
  -> 12 independent dimension-scoring requests (bounded concurrency)
  -> report narrative synthesis from authoritative dimension results
  -> deterministic narrative fallback if narrative-only generation fails
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
Fluid Compute. A 270-second pipeline deadline leaves time for terminal status
persistence before that ceiling; every individual OpenRouter timeout and retry
is clipped to the remaining budget. Queue claiming
uses `FOR UPDATE SKIP LOCKED` and commits before the external model request,
allowing concurrent submissions without holding database locks during AI
processing.

Transient network failures and HTTP 408/425/429/5xx responses receive bounded
exponential retries; `Retry-After` is honored when it can safely fit within the
pipeline deadline. Every provider request logs its model, stage, attempt,
elapsed time, request ID, and returned usage without logging the API key or
transcript. A final per-evaluation summary aggregates attempts, successful
requests, retries, prompt/completion/total tokens, provider-reported cost, and
wall time. Terminal
database writes are retried three times. A report poll converts a processing
run older than six minutes to `PROCESSING_TIMEOUT`; this is deliberately above
the five-minute function ceiling so an active worker is not reaped.

The standalone worker remains available for local development or deployment to
a persistent process host.

## Large-transcript quality path

Transcripts that fit in one configured chunk retain the complete transcript in
each independent dimension scorer. Larger transcripts are split on speaker turns, with a small turn overlap
and preference for explicit topic transitions near a boundary. Oversized single
turns are safely split without losing their source offsets.

Each chunk is independently searched against the complete scoring bands and
notes for all 12 dimensions, every applicability condition, and every automatic
rule. A map is rejected unless it returns exactly 12 ordered dimension audits
and one ordered audit for every rule. Evidence findings must include a tagged
exact quote. Malformed stage results receive one targeted correction request.
The resulting compact dossier contains every chunk summary for coverage and a
deduplicated chronological evidence catalog.
Only exact quotes reconciled to the original transcript survive into the
dossier. A separate global pass decides rules. Each rubric dimension is then
scored in its own request using only that dimension's complete authored rubric,
per-chunk audits, rule decisions, and reconciled evidence. Every dimension
scorer must assess all authored bands in order, and its selected band must equal
the highest fully supported assessment. Report prose is
generated only after these scores are fixed. Repairs reuse cached chunk audits.
Narrative synthesis receives one targeted correction request. If narrative-only
generation still fails, deterministic conservative prose is derived from the
already validated dimensions and applied rules, so authoritative scores are not
discarded or regenerated.

Server validation owns arithmetic and rule effects: it recalculates scores and
caps, rejects fabricated evidence, enforces authored score buckets, requires
applied N/A rules to disable their dimensions, and derives the source speaker,
turn index, and timestamp for every accepted quote. Range-valued Kick-off bands
retain valid authored increments, so the rubric's full 100 points are attainable.
When labels cover less than 80% of parsed
words or fewer than two labelled speakers are present, the dossier explicitly
marks speaker attribution as low confidence.

The chunk threshold, chunk size, overlap, map concurrency, dimension
concurrency, request retry count, and whole-pipeline timeout are configurable in
`.env.example`. Defaults favor evidence recall while staying below the current
five-minute web-function ceiling; the direct path avoids lossy compression on
transcripts small enough to fit in one chunk.

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
GPT-5.6 Sol is the default because scoring quality is prioritized over baseline
cost.

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
