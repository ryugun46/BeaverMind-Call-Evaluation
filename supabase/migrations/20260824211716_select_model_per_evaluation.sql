-- Model selection is supplied by the server-validated submission payload and
-- persisted on its lifecycle-owning row. The runtime configuration table is no
-- longer consulted by the processor, but is retained for backwards-compatible
-- migration history.
update public.evaluation_runs
set
  model_provider = coalesce(model_provider, 'openrouter'),
  model_name = coalesce(model_name, 'openai/gpt-4.1-mini')
where model_provider is null or model_name is null;

alter table public.evaluation_runs
  alter column model_provider set default 'openrouter',
  alter column model_provider set not null,
  alter column model_name set default 'openai/gpt-4.1-mini',
  alter column model_name set not null,
  add constraint evaluation_runs_model_provider_check
    check (model_provider = 'openrouter'),
  add constraint evaluation_runs_model_name_format_check
    check (model_name ~ '^[a-z0-9._-]+/[a-z0-9._:-]+$');

drop function public.claim_next_evaluation_run(text, text);

-- Claim first, then let the server construct a provider from the model stored
-- on that exact run. This keeps concurrent submissions with different models
-- isolated from one another.
create function public.claim_next_evaluation_run()
returns setof public.evaluation_runs
language sql
volatile
security invoker
set search_path = ''
as $$
  update public.evaluation_runs
  set status = 'processing'
  where id = (
    select candidate.id
    from public.evaluation_runs as candidate
    where candidate.status = 'queued'
    order by candidate.created_at, candidate.id
    limit 1
    for update skip locked
  )
  returning *;
$$;

comment on function public.claim_next_evaluation_run() is
  'Server-only atomic queue claim. Preserves the model selected for the run and returns zero rows when no queued run exists.';

revoke execute on function public.claim_next_evaluation_run()
  from public, anon, authenticated;
grant execute on function public.claim_next_evaluation_run()
  to service_role;
