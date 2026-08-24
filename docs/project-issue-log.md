# Project issue log

This document records production issues encountered while building and deploying
the evaluation system. Keep it updated with symptoms, confirmed causes, fixes,
and verification status so the project can be reviewed retrospectively.

## 2026-08-25 — Evaluation lifecycle and OpenRouter integration

### 1. Evaluation remained in `processing`

- **Symptom:** The report page displayed “Evaluating call” indefinitely.
- **Cause:** Provider/configuration failures could occur before a terminal
  lifecycle update was safely persisted. A failed terminal database write could
  also leave a claimed run in `processing`.
- **Fix:** Provider construction failures are converted into structured failed
  states, provider diagnostics are logged, and terminal lifecycle writes are
  retried three times.
- **Status:** Resolved and observed in production: subsequent provider failures
  are preserved as `failed` rather than remaining active.

### 2. Report page displayed stale lifecycle data

- **Symptom:** Supabase contained a failed run while the deployed page continued
  showing it as processing.
- **Cause:** Next.js server-side `fetch` caching was applied to Supabase REST
  reads, so client polling repeatedly received stale server data.
- **Fix:** Server-side Supabase requests explicitly use `cache: "no-store"`.
- **Status:** Resolved and observed in production.

### 3. Previously abandoned runs needed recovery

- **Symptom:** Runs left in `processing` by interrupted or failed background work
  had no automatic terminal transition.
- **Cause:** There was no server-side stale-run recovery mechanism.
- **Fix:** Added the `fail_stale_evaluation_runs` database function and a report
  polling safeguard that marks processing runs older than six minutes as
  `PROCESSING_TIMEOUT`.
- **Status:** Supabase migration `20260824215639` applied.

### 4. OpenRouter configuration initially prevented provider requests

- **Symptom:** Evaluations failed without OpenRouter usage or credit spend.
- **Cause:** The deployed evaluation worker did not have a valid
  `OPENROUTER_API_KEY` available.
- **Fix:** Configured the OpenRouter key in the deployment environment and
  redeployed.
- **Status:** Resolved; a later run reached OpenRouter and received an HTTP 400
  provider response.

### 5. OpenRouter rejected the strict structured-output schema

- **Symptom:** Evaluation `af9e9fd2-7d76-4175-9fae-202a3e53f3f3` failed quickly
  with `OPENROUTER_ERROR`, HTTP 400, and “Provider returned error.” OpenRouter
  credits did not appear to be consumed.
- **Cause:** Several nested fields were optional in the JSON Schema. OpenAI
  strict structured outputs require every object property to appear in
  `required`; optional values must instead be represented as nullable.
- **Fix:** Transform the domain schema into a provider schema whose fields are
  all required, represent domain-optional fields as nullable, and remove those
  nulls before authoritative Zod and rubric validation.
- **Verification:** 57 tests, type checking, and the production Next.js build
  pass locally.
- **Status:** Fixed locally; requires deployment and a fresh evaluation to
  verify against OpenRouter.

## Review notes

- A zero-credit or zero-usage symptom does not necessarily indicate that the API
  call was never made. Authentication, routing, or schema rejection can happen
  before token generation and therefore before meaningful billable usage.
- Persist the provider failure first and expose it through the lifecycle API;
  otherwise a backend error can be mistaken for an indefinitely running job.
- Fresh lifecycle reads and stale-job recovery are separate safeguards and both
  are necessary for reliable background processing.
