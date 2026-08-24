-- Phase 1 hardening for the lifecycle-owned evaluation run aggregate.
-- public_token is intentionally separate from id so public report links can be
-- permanent without exposing the record's primary identifier.
alter table public.evaluation_runs
  add column public_token uuid not null default gen_random_uuid(),
  add column error_code text,
  add column error_message text,
  add column error_details jsonb;

update public.evaluation_runs
set
  error_code = error ->> 'code',
  error_message = error ->> 'message',
  error_details = error -> 'details'
where error is not null;

-- Stop rather than silently changing legacy records that violate the domain
-- contract. An operator can repair those rows and re-run the migration.
do $$
begin
  if exists (
    select 1
    from public.evaluation_runs
    where (status in ('queued', 'processing') and (structured_result is not null or error is not null))
       or (status = 'completed' and (structured_result is null or error is not null))
       or (status = 'failed' and (structured_result is not null or error_code is null or error_message is null))
  ) then
    raise exception 'evaluation_runs contains rows that violate lifecycle payload constraints';
  end if;
end
$$;

-- Existing processing/terminal rows predate database-owned transition times.
update public.evaluation_runs
set processing_started_at = coalesce(processing_started_at, created_at)
where status in ('processing', 'completed', 'failed');

update public.evaluation_runs
set completed_at = coalesce(completed_at, updated_at)
where status in ('completed', 'failed');

alter table public.evaluation_runs
  drop column error,
  add constraint evaluation_runs_public_token_key unique (public_token),
  add constraint evaluation_runs_transcript_size_check check (
    transcript ~ '[^[:space:]]'
    and octet_length(transcript) <= 5242880
  ),
  add constraint evaluation_runs_error_fields_check check (
    (error_code is null and error_message is null and error_details is null)
    or (
      error_code is not null
      and error_message is not null
      and length(btrim(error_code)) > 0
      and length(btrim(error_message)) > 0
      and (
        error_details is null
        or jsonb_typeof(error_details) = 'object'
        or (
          jsonb_typeof(error_details) = 'string'
          and length(btrim(error_details #>> '{}')) > 0
        )
      )
    )
  ),
  add constraint evaluation_runs_lifecycle_check check (
    (
      status = 'queued'
      and processing_started_at is null
      and completed_at is null
      and structured_result is null
      and error_code is null
      and error_message is null
      and error_details is null
    )
    or (
      status = 'processing'
      and processing_started_at is not null
      and completed_at is null
      and structured_result is null
      and error_code is null
      and error_message is null
      and error_details is null
    )
    or (
      status = 'completed'
      and processing_started_at is not null
      and completed_at is not null
      and structured_result is not null
      and error_code is null
      and error_message is null
      and error_details is null
    )
    or (
      status = 'failed'
      and processing_started_at is not null
      and completed_at is not null
      and structured_result is null
      and error_code is not null
      and error_message is not null
    )
  ),
  add constraint evaluation_runs_lifecycle_order_check check (
    processing_started_at is null or processing_started_at >= created_at
  ),
  add constraint evaluation_runs_completion_order_check check (
    completed_at is null or completed_at >= processing_started_at
  );

comment on column public.evaluation_runs.public_token is
  'Unchanging opaque token used to resolve a permanent public report URL on the server.';
comment on column public.evaluation_runs.error_code is
  'Machine-readable failure code validated against EvaluationErrorSchema.';
comment on column public.evaluation_runs.error_message is
  'Human-readable failure message validated against EvaluationErrorSchema.';
comment on column public.evaluation_runs.error_details is
  'Optional string or object failure detail validated against EvaluationErrorSchema.';

create index evaluation_runs_queued_created_at_idx
  on public.evaluation_runs (created_at)
  where status = 'queued';

create function public.enforce_evaluation_run_lifecycle()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.status <> 'queued' then
      raise exception 'evaluation runs must be created in queued status'
        using errcode = '23514';
    end if;

    new.public_token = gen_random_uuid();
    new.created_at = clock_timestamp();
    new.updated_at = new.created_at;
    new.processing_started_at = null;
    new.completed_at = null;
    return new;
  end if;

  if new.created_at is distinct from old.created_at then
    raise exception 'evaluation run creation timestamps are immutable'
      using errcode = '23514';
  end if;

  if new.public_token is distinct from old.public_token then
    raise exception 'evaluation run public tokens are permanent'
      using errcode = '23514';
  end if;

  if new.status is not distinct from old.status then
    if new.processing_started_at is distinct from old.processing_started_at
       or new.completed_at is distinct from old.completed_at then
      raise exception 'lifecycle timestamps are managed by evaluation_runs status transitions'
        using errcode = '23514';
    end if;
    return new;
  end if;

  if old.status = 'queued' and new.status = 'processing' then
    new.processing_started_at = clock_timestamp();
    new.completed_at = null;
  elsif old.status = 'processing' and new.status in ('completed', 'failed') then
    new.processing_started_at = old.processing_started_at;
    new.completed_at = clock_timestamp();
  else
    raise exception 'invalid evaluation run status transition: % -> %', old.status, new.status
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger enforce_evaluation_run_lifecycle
before insert or update on public.evaluation_runs
for each row
execute function public.enforce_evaluation_run_lifecycle();

-- Browser roles have neither table privileges nor RLS policies. The secret-key
-- server client uses service_role and is the only Data API caller for this table.
alter table public.evaluation_runs enable row level security;
revoke all privileges on table public.evaluation_runs from public, anon, authenticated;
grant select, insert, update, delete on table public.evaluation_runs to service_role;

revoke execute on function public.enforce_evaluation_run_lifecycle() from public, anon, authenticated;
grant execute on function public.enforce_evaluation_run_lifecycle() to service_role;
revoke execute on function public.set_evaluation_runs_updated_at() from public, anon, authenticated;
grant execute on function public.set_evaluation_runs_updated_at() to service_role;
