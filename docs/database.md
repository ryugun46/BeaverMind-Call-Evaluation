# Database foundation

## Design

`public.evaluation_runs` is the lifecycle owner and the single persisted entity
for this intentionally small application. A run owns its opaque public token,
call type, transcript, lifecycle timestamps, optional model metadata, structured
failure fields, and eventual output. Keeping one table avoids
prematurely normalizing the 12 dimensions and their evidence into tables that
would add joins without improving this use case.

`structured_result` is JSONB because `EvaluationResult` is nested and is read as
one report. The authoritative contract remains
`lib/contracts/evaluation.ts` (`EvaluationResultSchema`); the future server must
The server repository validates it with that Zod schema before writing and after
reading.
Failures use `error_code`, `error_message`, and optional `error_details`; the
repository maps them to `EvaluationErrorSchema`. No second handwritten domain
interface is introduced.

The full transcript is retained so an evaluation can be reproduced, audited,
or retried. It is deliberately not part of the public report response contract.
The optional `model_provider` and `model_name` values plus the required
`rubric_version` provide low-cost reproducibility metadata and never contain
credentials.

`public.evaluation_runtime_config` is a separate server-only singleton because
the selected provider model is operational configuration, not part of an
evaluation aggregate. Operators update it through the Supabase dashboard; each
run records the model chosen when it is claimed.

## Lifecycle

```text
queued -> processing -> completed
                     \-> failed
```

The database accepts only `queued -> processing -> completed|failed`. Its
transition trigger owns `processing_started_at` and the terminal `completed_at`;
check constraints require a result only for completed runs and structured error
fields only for failed runs. `updated_at` is maintained by a separate trigger.

The transcript is checked using `octet_length`, so the five MiB maximum is a
byte limit rather than a character limit. The server repository applies the same
UTF-8 byte guard before making a database request.

## Access and RLS

Row Level Security is enabled even though the application has no login system.
There are no `anon` or `authenticated` policies, and both roles have their table
privileges revoked. A holder of `/evaluation/{id}` will eventually access a
safe report through this path:

```text
Browser -> Node API -> exact public-token lookup -> safe report response
```

Only the server uses `SUPABASE_SECRET_KEY`, which bypasses RLS. The key
must not be prefixed with `NEXT_PUBLIC_`, imported by a Client Component, logged,
or committed. Browser code must never query `evaluation_runs` through the
Supabase client directly.

## Apply and verify

The base migration is followed by
`supabase/migrations/20260824085534_harden_evaluation_runs_lifecycle.sql`.
All migrations are deployed to the `beavermind` Supabase project, and its
remote migration history matches the repository filenames.

Phase 2 adds
`supabase/migrations/20260824132414_add_evaluation_run_claim_function.sql`, a
server-only atomic queue claim using `FOR UPDATE SKIP LOCKED`.

For a local Supabase stack (Docker required):

```bash
npx supabase init
npx supabase start
npx supabase db reset
npx supabase db lint --local --schema public
npx supabase test db supabase/tests/database/evaluation_runs_test.sql
```

`supabase/tests/database/evaluation_runs_test.sql` inserts queued Kick-off and
Coaching runs, checks defaults and timestamps, checks rejection of invalid enum
values, verifies the RLS posture, and rolls back all test records.

To apply to a remote project after reviewing the target:

```bash
npx supabase login
npx supabase link --project-ref <project-ref>
npx supabase db push --dry-run
npx supabase db push
```

The future server environment requires:

```text
SUPABASE_URL
SUPABASE_SECRET_KEY
```
