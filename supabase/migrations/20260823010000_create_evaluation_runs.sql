create table public.evaluation_runs (
  id uuid primary key default gen_random_uuid(),
  call_type text not null,
  transcript text not null,
  status text not null default 'queued',
  rubric_version text not null,
  structured_result jsonb,
  error jsonb,
  model_provider text,
  model_name text,
  processing_started_at timestamp with time zone,
  completed_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),

  constraint evaluation_runs_call_type_check
    check (call_type in ('kickoff', 'coaching')),
  constraint evaluation_runs_status_check
    check (status in ('queued', 'processing', 'completed', 'failed'))
);

comment on table public.evaluation_runs is
  'Persisted lifecycle and validated output for one call evaluation.';
comment on column public.evaluation_runs.structured_result is
  'JSON validated against lib/contracts/evaluation.ts EvaluationResultSchema.';
comment on column public.evaluation_runs.error is
  'JSON validated against lib/contracts/evaluation.ts EvaluationErrorSchema.';

create index evaluation_runs_status_idx
  on public.evaluation_runs (status);

create index evaluation_runs_created_at_idx
  on public.evaluation_runs (created_at desc);

create function public.set_evaluation_runs_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_evaluation_runs_updated_at
before update on public.evaluation_runs
for each row
execute function public.set_evaluation_runs_updated_at();

alter table public.evaluation_runs enable row level security;

-- The public URL is served by the future Node API, not PostgREST. RLS has no
-- browser-facing policies, and these explicit revokes provide defense in depth.
revoke all privileges on table public.evaluation_runs from anon, authenticated;
grant select, insert, update, delete on table public.evaluation_runs to service_role;
