-- Zentra RLS policies (O1) — row-level confidentiality tiering.
-- Applied in Supabase after prisma migrate. Confidential tables:
--   anecdotal_records, health_records, home_visitation_records, adm_learner_profiles
-- Principal sees rows but APP hides confidential fields (backend strips them).
-- Students/parents are excluded entirely (read risk_level only via dedicated endpoints).

-- Helper: current user role from JWT
create or replace function current_role() returns text as $$
  select coalesce((auth.jwt() ->> 'role'), 'anon');
$$ language sql stable;

create or replace function current_uid() returns uuid as $$
  select coalesce((auth.jwt() ->> 'sub')::uuid, '00000000-0000-0000-0000-000000000000');
$$ language sql stable;

-- anecdotal_records
alter table anecdotal_records enable row level security;

create policy anecdotal_visible on anecdotal_records
  for select to authenticated
  using (
    observer_id = current_uid()
    or exists (select 1 from referrals r where r.anecdotal_record_id = anecdotal_records.id and r.referred_to_role::text = current_role())
    or current_role() = 'principal'
  );

create policy anecdotal_write on anecdotal_records
  for insert to authenticated
  with check (observer_id = current_uid());

create policy anecdotal_update on anecdotal_records
  for update to authenticated
  using (observer_id = current_uid());

-- health_records
alter table health_records enable row level security;

create policy health_visible on health_records
  for select to authenticated
  using (
    recorded_by = current_uid()
    or exists (select 1 from referrals r where r.id = health_records.referral_id and r.referred_to_role::text = current_role())
    or current_role() = 'principal'
  );

create policy health_write on health_records
  for all to authenticated
  using (recorded_by = current_uid())
  with check (recorded_by = current_uid());

-- home_visitation_records
alter table home_visitation_records enable row level security;

create policy home_visitation_visible on home_visitation_records
  for select to authenticated
  using (
    certification_by = current_uid()
    or exists (select 1 from referrals r where r.id = home_visitation_records.referral_id and r.referred_to_role::text = current_role())
    or current_role() = 'principal'
  );

create policy home_visitation_write on home_visitation_records
  for all to authenticated
  using (certification_by = current_uid())
  with check (certification_by = current_uid());

-- adm_learner_profiles
alter table adm_learner_profiles enable row level security;

create policy adm_visible on adm_learner_profiles
  for select to authenticated
  using (
    prepared_by = current_uid()
    or current_role() = 'principal'
  );

create policy adm_write on adm_learner_profiles
  for all to authenticated
  using (prepared_by = current_uid())
  with check (prepared_by = current_uid());
