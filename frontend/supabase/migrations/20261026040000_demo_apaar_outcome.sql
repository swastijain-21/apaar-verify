alter table public.student_records
  add column if not exists demo_apaar_outcome text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'student_records_demo_apaar_outcome_check'
      and conrelid = 'public.student_records'::regclass
  ) then
    alter table public.student_records
      add constraint student_records_demo_apaar_outcome_check
      check (
        demo_apaar_outcome is null
        or demo_apaar_outcome in (
          'Demo match',
          'No demo match',
          'Needs manual review'
        )
      );
  end if;
end;
$$;
