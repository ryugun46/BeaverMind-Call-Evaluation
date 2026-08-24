alter table public.evaluation_runs
  add column report_name text,
  add column client_name text,
  add column coach_name text;

alter table public.evaluation_runs
  add constraint evaluation_runs_report_name_check
    check (
      report_name is null
      or (char_length(btrim(report_name)) between 1 and 120)
    ),
  add constraint evaluation_runs_client_name_check
    check (
      client_name is null
      or (char_length(btrim(client_name)) between 1 and 120)
    ),
  add constraint evaluation_runs_coach_name_check
    check (
      coach_name is null
      or (char_length(btrim(coach_name)) between 1 and 120)
    );

comment on column public.evaluation_runs.report_name is
  'User-supplied label used to distinguish the report in the UI and history.';
comment on column public.evaluation_runs.client_name is
  'Client displayed in the report context line.';
comment on column public.evaluation_runs.coach_name is
  'Coach displayed in the report context line.';
