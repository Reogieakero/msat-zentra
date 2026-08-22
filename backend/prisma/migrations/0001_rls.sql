-- Zentra RLS policies (O1) — row-level confidentiality tiering.
-- Applied in Supabase after prisma migrate. Confidential tables (PascalCase, matching schema):
--   "AnecdotalRecord", "HealthRecord", "HomeVisitationRecord", "AdmLearnerProfile"
-- Principal sees rows but the APP hides confidential fields (backend strips them).
-- Students/parents are excluded entirely (read risk_level only via dedicated endpoints).

-- Helper functions (renamed to avoid clashing with Postgres reserved current_role)
create or replace function zentra_role() returns text as $$
  select coalesce((auth.jwt() ->> 'role'), 'anon');
$$ language sql stable;

create or replace function zentra_uid() returns text as $$
  select coalesce((auth.jwt() ->> 'sub'), '00000000-0000-0000-0000-000000000000');
$$ language sql stable;

-- "AnecdotalRecord"
alter table "AnecdotalRecord" enable row level security;

create policy anecdotal_visible on "AnecdotalRecord"
  for select to authenticated
  using (
    "observerId" = zentra_uid()
    or exists (select 1 from "Referral" r where r."anecdotalRecordId" = "AnecdotalRecord"."id" and r."referredToRole"::text = zentra_role())
    or zentra_role() = 'principal'
  );

create policy anecdotal_write on "AnecdotalRecord"
  for insert to authenticated
  with check ("observerId" = zentra_uid());

create policy anecdotal_update on "AnecdotalRecord"
  for update to authenticated
  using ("observerId" = zentra_uid());

-- "HealthRecord"
alter table "HealthRecord" enable row level security;

create policy health_visible on "HealthRecord"
  for select to authenticated
  using (
    "recordedBy" = zentra_uid()
    or exists (select 1 from "Referral" r where r."id" = "HealthRecord"."referralId" and r."referredToRole"::text = zentra_role())
    or zentra_role() = 'principal'
  );

create policy health_write on "HealthRecord"
  for all to authenticated
  using ("recordedBy" = zentra_uid())
  with check ("recordedBy" = zentra_uid());

-- "HomeVisitationRecord"
alter table "HomeVisitationRecord" enable row level security;

create policy home_visitation_visible on "HomeVisitationRecord"
  for select to authenticated
  using (
    "certificationBy" = zentra_uid()
    or exists (select 1 from "Referral" r where r."id" = "HomeVisitationRecord"."referralId" and r."referredToRole"::text = zentra_role())
    or zentra_role() = 'principal'
  );

create policy home_visitation_write on "HomeVisitationRecord"
  for all to authenticated
  using ("certificationBy" = zentra_uid())
  with check ("certificationBy" = zentra_uid());

-- "AdmLearnerProfile"
alter table "AdmLearnerProfile" enable row level security;

create policy adm_visible on "AdmLearnerProfile"
  for select to authenticated
  using (
    "preparedBy" = zentra_uid()
    or zentra_role() = 'principal'
  );

create policy adm_write on "AdmLearnerProfile"
  for all to authenticated
  using ("preparedBy" = zentra_uid())
  with check ("preparedBy" = zentra_uid());
