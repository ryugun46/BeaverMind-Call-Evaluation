begin;

create extension if not exists pgtap with schema extensions;

select plan(12);

insert into public.evaluation_runs (call_type, rubric_version, transcript)
values ('kickoff', 'kickoff-v1', 'Kick-off verification transcript.');

insert into public.evaluation_runs (call_type, rubric_version, transcript)
values ('coaching', 'coaching-v1', 'Coaching verification transcript.');

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

select * from finish();

rollback;
