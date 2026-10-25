create table if not exists public.student_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 80),
  roll_number text not null check (char_length(trim(roll_number)) between 1 and 50),
  institution text not null check (char_length(trim(institution)) between 1 and 100),
  apaar_id text not null check (apaar_id ~ '^([0-9]{12}|[0-9]{4}[- ][0-9]{4}[- ][0-9]{4})$'),
  status text not null check (status in ('verified', 'pending', 'flagged')),
  verifier_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists student_records_user_apaar_normalized_unique
  on public.student_records (
    user_id,
    regexp_replace(apaar_id, '[- ]', '', 'g')
  );

create unique index if not exists student_records_user_roll_institution_unique
  on public.student_records (user_id, lower(roll_number), lower(institution));

create table if not exists public.verification_audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  student_id uuid references public.student_records (id) on delete set null,
  student_name text not null,
  action text not null check (char_length(trim(action)) between 1 and 160),
  detail text not null check (char_length(detail) <= 1000),
  occurred_at timestamptz not null default now()
);

alter table public.student_records enable row level security;
alter table public.student_records force row level security;
alter table public.verification_audit_logs enable row level security;
alter table public.verification_audit_logs force row level security;

revoke all on public.student_records from anon, authenticated;
revoke all on public.verification_audit_logs from anon, authenticated;
grant select, insert, update, delete on public.student_records to authenticated;
grant select, insert on public.verification_audit_logs to authenticated;

create policy "student_records_owner_access"
  on public.student_records
  as permissive
  for all
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "student_records_owner_restriction"
  on public.student_records
  as restrictive
  for all
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "audit_logs_owner_read"
  on public.verification_audit_logs
  as permissive
  for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "audit_logs_owner_read_restriction"
  on public.verification_audit_logs
  as restrictive
  for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "audit_logs_owner_insert"
  on public.verification_audit_logs
  as permissive
  for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and (
      student_id is null
      or exists (
        select 1
        from public.student_records student
        where student.id = verification_audit_logs.student_id
          and student.user_id = (select auth.uid())
      )
    )
  );

create policy "audit_logs_owner_insert_restriction"
  on public.verification_audit_logs
  as restrictive
  for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and (
      student_id is null
      or exists (
        select 1
        from public.student_records student
        where student.id = verification_audit_logs.student_id
          and student.user_id = (select auth.uid())
      )
    )
  );
