-- Existing Supabase projects may automatically grant full table privileges to
-- service_role. Runtime application code only needs to read this singleton.
revoke all privileges on table public.evaluation_runtime_config
  from service_role;
grant select on table public.evaluation_runtime_config to service_role;
