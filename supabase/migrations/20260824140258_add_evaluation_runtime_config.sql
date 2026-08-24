-- A server-only singleton allows operators to change the OpenRouter model
-- without changing Vercel environment variables or redeploying the app.
create table public.evaluation_runtime_config (
  id smallint primary key default 1,
  model_slug text not null,
  updated_at timestamp with time zone not null default now(),

  constraint evaluation_runtime_config_singleton_check check (id = 1),
  constraint evaluation_runtime_config_model_slug_check check (
    model_slug ~ '^[^[:space:]/]+/[^[:space:]/]+$'
  )
);

comment on table public.evaluation_runtime_config is
  'Server-only singleton containing the OpenRouter model selected for new evaluations.';
comment on column public.evaluation_runtime_config.model_slug is
  'OpenRouter provider/model slug resolved immediately before a run is claimed.';

insert into public.evaluation_runtime_config (id, model_slug)
values (1, 'openai/gpt-4.1-mini');

create function public.set_evaluation_runtime_config_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = clock_timestamp();
  return new;
end;
$$;

create trigger set_evaluation_runtime_config_updated_at
before update on public.evaluation_runtime_config
for each row
execute function public.set_evaluation_runtime_config_updated_at();

alter table public.evaluation_runtime_config enable row level security;
revoke all privileges on table public.evaluation_runtime_config
  from public, anon, authenticated, service_role;
grant select on table public.evaluation_runtime_config to service_role;

revoke execute on function public.set_evaluation_runtime_config_updated_at()
  from public, anon, authenticated;
grant execute on function public.set_evaluation_runtime_config_updated_at()
  to service_role;
