-- A Vercel background task is bounded by the function's maximum duration. If
-- the runtime is terminated after a run is claimed, the database otherwise
-- has no way to distinguish that abandoned row from active work.
create function public.fail_stale_evaluation_runs(
  p_timeout interval default interval '6 minutes'
)
returns setof public.evaluation_runs
language sql
volatile
security invoker
set search_path = ''
as $$
  update public.evaluation_runs
  set
    status = 'failed',
    error_code = 'PROCESSING_TIMEOUT',
    error_message = 'The evaluation worker stopped before this run could finish.',
    error_details = pg_catalog.jsonb_build_object(
      'timeoutSeconds', 360,
      'retryable', true
    )
  where status = 'processing'
    and processing_started_at < pg_catalog.clock_timestamp() - p_timeout
  returning *;
$$;

comment on function public.fail_stale_evaluation_runs(interval) is
  'Fails processing runs older than the maximum worker window so public reports cannot poll forever.';

revoke execute on function public.fail_stale_evaluation_runs(interval)
  from public, anon, authenticated;
grant execute on function public.fail_stale_evaluation_runs(interval)
  to service_role;
