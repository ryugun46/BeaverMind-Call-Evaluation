begin;

create extension if not exists pgtap with schema extensions;

select plan(33);

insert into public.evaluation_runs (
  report_name,
  call_type,
  rubric_version,
  transcript
)
values (
  'David August Kick-off',
  'kickoff',
  'kickoff-v1',
  'Kick-off verification transcript.'
);

insert into public.evaluation_runs (call_type, rubric_version, transcript)
values ('coaching', 'coaching-v2', 'Coaching verification transcript.');

select ok(
  (select id is not null
   from public.evaluation_runs
   where transcript = 'Kick-off verification transcript.'),
  'kick-off insert generates a UUID'
);

select is(
  (select status
   from public.evaluation_runs
   where transcript = 'Kick-off verification transcript.'),
  'queued',
  'status defaults to queued'
);

select is(
  (select transcript
   from public.evaluation_runs
   where transcript = 'Kick-off verification transcript.'),
  'Kick-off verification transcript.',
  'transcript persists unchanged'
);

select is(
  (select report_name
   from public.evaluation_runs
   where transcript = 'Kick-off verification transcript.'),
  'David August Kick-off',
  'report name persists unchanged'
);

select ok(
  (select model_provider = 'openrouter'
      and model_name = 'openai/gpt-4.1-mini'
   from public.evaluation_runs
   where transcript = 'Kick-off verification transcript.'),
  'model metadata has a safe server default'
);

select throws_ok(
  $$insert into public.evaluation_runs
      (call_type, rubric_version, transcript, model_provider, model_name)
    values
      ('kickoff', 'kickoff-v1', 'Invalid provider.', 'direct', 'openai/gpt-4.1-mini');$$,
  '23514',
  null,
  'non-OpenRouter providers are rejected'
);

select throws_ok(
  $$insert into public.evaluation_runs
      (call_type, rubric_version, transcript, model_name)
    values
      ('kickoff', 'kickoff-v1', 'Invalid model.', 'not a slug');$$,
  '23514',
  null,
  'invalid OpenRouter model slugs are rejected'
);

select ok(
  (select created_at is not null
      and updated_at is not null
   from public.evaluation_runs
   where transcript = 'Kick-off verification transcript.'),
  'created_at and updated_at are populated'
);

select ok(
  (select id is not null
   from public.evaluation_runs
   where transcript = 'Coaching verification transcript.'),
  'coaching insert generates a UUID'
);

select is(
  (select call_type
   from public.evaluation_runs
   where transcript = 'Coaching verification transcript.'),
  'coaching',
  'coaching call type persists'
);

select throws_ok(
  $$insert into public.evaluation_runs (call_type, rubric_version, transcript)
    values ('discovery', 'discovery-v1', 'Invalid call type.');$$,
  '23514',
  null,
  'invalid call type is rejected'
);

select throws_ok(
  $$insert into public.evaluation_runs (call_type, rubric_version, transcript, status)
    values ('kickoff', 'kickoff-v1', 'Invalid status.', 'unknown');$$,
  '23514',
  null,
  'invalid status is rejected'
);

select throws_ok(
  $$insert into public.evaluation_runs (call_type, transcript)
    values ('kickoff', 'Missing rubric version.');$$,
  '23502',
  null,
  'rubric version is required'
);

select ok(
  (select public_token is not null
   from public.evaluation_runs
   where transcript = 'Kick-off verification transcript.'),
  'public token is generated'
);

select throws_ok(
  $$insert into public.evaluation_runs (call_type, rubric_version, transcript)
    values ('kickoff', 'kickoff-v1', repeat('a', 5242881));$$,
  '23514',
  null,
  'transcripts larger than five MiB are rejected'
);

select throws_ok(
  $$insert into public.evaluation_runs (call_type, rubric_version, transcript)
    values ('kickoff', 'kickoff-v1', E'  \n\t  ');$$,
  '23514',
  null,
  'blank transcripts are rejected'
);

update public.evaluation_runs
set status = 'processing'
where transcript = 'Kick-off verification transcript.';

select ok(
  (select processing_started_at is not null and completed_at is null
   from public.evaluation_runs
   where transcript = 'Kick-off verification transcript.'),
  'queued to processing transition owns its start timestamp'
);

select throws_ok(
  $$insert into public.evaluation_runs (call_type, rubric_version, transcript, status, structured_result)
    values ('kickoff', 'kickoff-v1', 'Skipped processing.', 'completed', '{}'::jsonb);$$,
  '23514',
  null,
  'runs cannot be inserted directly as completed'
);

select throws_ok(
  $$update public.evaluation_runs
    set status = 'completed'
    where transcript = 'Kick-off verification transcript.';$$,
  '23514',
  null,
  'completed status requires a structured result'
);

update public.evaluation_runs
set status = 'completed', structured_result = '{}'::jsonb
where transcript = 'Kick-off verification transcript.';

select ok(
  (select completed_at is not null and structured_result = '{}'::jsonb
   from public.evaluation_runs
   where transcript = 'Kick-off verification transcript.'),
  'processing to completed stores its result and terminal timestamp'
);

select throws_ok(
  $$update public.evaluation_runs
    set status = 'failed', structured_result = null,
        error_code = 'TOO_LATE', error_message = 'Terminal runs are immutable.'
    where transcript = 'Kick-off verification transcript.';$$,
  '23514',
  null,
  'terminal status cannot transition again'
);

update public.evaluation_runs
set status = 'processing'
where transcript = 'Coaching verification transcript.';

update public.evaluation_runs
set status = 'failed',
    error_code = 'WORKER_ERROR',
    error_message = 'Evaluation worker failed.',
    error_details = '{"retryable": true}'::jsonb
where transcript = 'Coaching verification transcript.';

select ok(
  (select completed_at is not null
      and error_code = 'WORKER_ERROR'
      and error_message = 'Evaluation worker failed.'
      and error_details = '{"retryable": true}'::jsonb
   from public.evaluation_runs
   where transcript = 'Coaching verification transcript.'),
  'failed status stores structured failure fields and terminal timestamp'
);

select throws_ok(
  $$update public.evaluation_runs
    set public_token = gen_random_uuid()
    where transcript = 'Coaching verification transcript.';$$,
  '23514',
  null,
  'public report tokens cannot change'
);

insert into public.evaluation_runs (call_type, rubric_version, transcript, model_name)
values
  ('kickoff', 'kickoff-v1', 'Queue claim verification one.', 'anthropic/claude-sonnet-4.6'),
  ('coaching', 'coaching-v2', 'Queue claim verification two.', 'google/gemini-2.5-pro');

create temporary table claimed_evaluation_run as
select *
from public.claim_next_evaluation_run();

select is(
  (select count(*)::integer from claimed_evaluation_run),
  1,
  'queue claim returns exactly one run'
);

select is(
  (select status from claimed_evaluation_run),
  'processing',
  'queue claim transitions the run to processing'
);

select ok(
  (select processing_started_at is not null
      and model_provider = 'openrouter'
      and model_name = 'anthropic/claude-sonnet-4.6'
   from claimed_evaluation_run),
  'queue claim preserves the selected model metadata'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.claim_next_evaluation_run()',
    'execute'
  )
    and not has_function_privilege(
      'authenticated',
      'public.claim_next_evaluation_run()',
      'execute'
    ),
  'browser roles cannot claim queued runs'
);

select ok(
  (select relrowsecurity
   from pg_catalog.pg_class
   where oid = 'public.evaluation_runs'::regclass),
  'row level security is enabled'
);

select is(
  (select count(*)::integer
   from pg_catalog.pg_policies
   where schemaname = 'public'
     and tablename = 'evaluation_runs'),
  0,
  'no browser-facing RLS policy exists'
);

select ok(
  not has_table_privilege('anon', 'public.evaluation_runs', 'select')
    and not has_table_privilege('authenticated', 'public.evaluation_runs', 'select'),
  'anonymous and authenticated roles cannot select transcripts'
);

insert into public.evaluation_runs (call_type, rubric_version, transcript)
values ('kickoff', 'kickoff-v1', 'Stale processing verification.');

update public.evaluation_runs
set status = 'processing'
where transcript = 'Stale processing verification.';

select is(
  (select count(*)::integer
   from public.fail_stale_evaluation_runs(interval '0 seconds')),
  2,
  'stale recovery terminates every abandoned processing run'
);

select ok(
  (select status = 'failed'
      and error_code = 'PROCESSING_TIMEOUT'
      and completed_at is not null
   from public.evaluation_runs
   where transcript = 'Stale processing verification.'),
  'stale recovery records a structured terminal timeout'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.fail_stale_evaluation_runs(interval)',
    'execute'
  )
    and not has_function_privilege(
      'authenticated',
      'public.fail_stale_evaluation_runs(interval)',
      'execute'
    ),
  'browser roles cannot recover stale evaluation runs'
);

select * from finish();

rollback;
