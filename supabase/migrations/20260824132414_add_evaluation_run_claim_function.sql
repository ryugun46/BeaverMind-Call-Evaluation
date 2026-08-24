-- Atomically claim one queued run without holding a database lock while the
-- external evaluator is running. Concurrent workers skip rows already claimed
-- by another transaction.
create function public.claim_next_evaluation_run(
  p_model_provider text,
  p_model_name text
)
returns setof public.evaluation_runs
language sql
volatile
security invoker
set search_path = ''
as $$
  update public.evaluation_runs
  set
    status = 'processing',
    model_provider = p_model_provider,
    model_name = p_model_name
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

comment on function public.claim_next_evaluation_run(text, text) is
  'Server-only atomic queue claim. Returns zero rows when no queued run exists.';

revoke execute on function public.claim_next_evaluation_run(text, text)
  from public, anon, authenticated;
grant execute on function public.claim_next_evaluation_run(text, text)
  to service_role;
