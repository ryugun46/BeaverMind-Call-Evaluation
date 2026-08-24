set local lock_timeout = '5s';

alter table public.evaluation_runs
  drop column if exists client_name,
  drop column if exists coach_name;
