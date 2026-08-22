# Database foundation

## Design

`public.evaluation_runs` is the single persisted entity for this intentionally
small application. A run owns its call type, transcript, lifecycle timestamps,
optional model metadata, and eventual output. Keeping one table avoids
prematurely normalizing the 12 dimensions and their evidence into tables that
would add joins without improving this use case.

`structured_result` is JSONB because `EvaluationResult` is nested and is read as
one report. The authoritative contract remains
`lib/contracts/evaluation.ts` (`EvaluationResultSchema`); the future server must
validate the value with that Zod schema before writing it and after reading it.
The `error` JSONB value follows `EvaluationErrorSchema` in the same file. No
second TypeScript database-result interface should be introduced.

The full transcript is retained so an evaluation can be reproduced, audited,
or retried. It is deliberately not part of the public report response contract.
The optional `model_provider` and `model_name` values plus the required
`rubric_version` provide low-cost reproducibility metadata and never contain
credentials.

## Lifecycle

```text
queued -> processing -> completed
                     \-> failed
```

The database constrains the allowed status and call-type values. Richer state
consistency (for example, requiring a validated result when completing a run)
belongs in the application layer so asynchronous transitions remain simple.
`updated_at` is maintained by a trigger.

## Access and RLS

Row Level Security is enabled even though the application has no login system.
There are no `anon` or `authenticated` policies, and both roles have their table
privileges revoked. A holder of `/evaluation/{id}` will eventually access a
safe report through this path:

```text
Browser -> Node API -> exact UUID lookup -> safe report response
```

Only the server uses `SUPABASE_SERVICE_ROLE_KEY`, which bypasses RLS. The key
must not be prefixed with `NEXT_PUBLIC_`, imported by a Client Component, logged,
or committed. Browser code must never query `evaluation_runs` through the
Supabase client directly.

## Apply and verify

The migration is
`supabase/migrations/20260823010000_create_evaluation_runs.sql`. No remote
project is configured in this repository, so it has not been deployed.

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
SUPABASE_SERVICE_ROLE_KEY
```
