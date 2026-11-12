-- Zentra RLS policies (O1) — row-level confidentiality tiering.
-- Applied in Supabase after prisma migrate. Confidential tables (PascalCase, matching schema):
--   "AnecdotalRecord", "HealthRecord", "HomeVisitationRecord", "AdmLearnerProfile"
-- Principal sees rows but the APP hides confidential fields (backend strips them).
-- Students/parents are excluded entirely (read risk_level only via dedicated endpoints).

-- Helper functions (renamed to avoid clashing with Postgres reserved current_role)
-- `app_role` is set on the short-lived realtime token (see signRealtimeToken)
-- because that token's `role` claim must be "authenticated" for Supabase
-- Realtime. Regular Supabase Auth tokens have no `app_role`, so they keep the
-- old behaviour.
create or replace function zentra_role() returns text as $$
  select coalesce(
    nullif(auth.jwt() ->> 'app_role', ''),
    nullif(auth.jwt() ->> 'role', ''),
    'anon'
  );
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

-- "Notification" — realtime privacy: each user may only receive their own rows.
-- The browser must present a Supabase-compatible token (role=authenticated,
-- sub=<userId>) minted by GET /api/auth/realtime-token, which requires the
-- Supabase project JWT secret to match the backend JWT_ACCESS_SECRET and the
-- frontend flag NEXT_PUBLIC_SUPABASE_REALTIME_AUTH=true. Applied manually via
-- apply-rls.ts (NOT via prisma migrate) so activation is deliberate.
alter table "Notification" enable row level security;

create policy notification_own on "Notification"
  for select to authenticated
  using ("userId" = zentra_uid());

-- "Section" — realtime invalidation for the principal's assignment desk.
-- Section rows are structural metadata (name, grade level, adviser label) and
-- are already readable by every desk through the API, so a read-all policy is
-- enough; writes go through the backend, which owns the table.
alter table "Section" enable row level security;

create policy section_visible on "Section"
  for select to authenticated
  using (true);

-- Realtime access grants.
--
-- Supabase's browser clients evaluate RLS as `authenticated` (the `role` claim
-- on the realtime token from GET /api/auth/realtime-token). This project's
-- `public` schema is owned by `postgres` with no default grants, so without
-- these the Realtime server cannot read a single published row and every
-- channel silently delivers nothing. Access stays table-scoped: only the
-- published tables are readable, and RLS above decides which rows.
grant usage on schema public to authenticated;
grant select on "Notification" to authenticated;
grant select on "Section" to authenticated;
grant select on "Intervention" to authenticated;
grant select on "CounselingSession" to authenticated;
grant select on "RiskSnapshot" to authenticated;
-- The guidance desk also subscribes to Referral and AdmLearnerProfile for
-- realtime invalidation; without these grants those channels deliver nothing.
grant select on "Referral" to authenticated;
grant select on "AdmLearnerProfile" to authenticated;

-- Adviser-of-the-learner helpers. SECURITY DEFINER so the policy can look at
-- StudentProfile / StudentRoster / Section without granting `authenticated`
-- read access to those (non-RLS) tables. `set search_path` keeps the definer
-- function from being hijacked.
create or replace function zentra_advises_learner(p_student_id text, p_roster_id text)
returns boolean as $$
  select exists (
    select 1 from "StudentProfile" p
    join "Section" s on s."id" = p."sectionId"
    where p."userId" = p_student_id
      and s."adviserId" = zentra_uid()
  ) or exists (
    select 1 from "StudentRoster" r
    join "Section" s on s."id" = r."sectionId"
    where r."id" = p_roster_id
      and s."adviserId" = zentra_uid()
  );
$$ language sql stable security definer set search_path = public;

create or replace function zentra_advises_intervention(p_intervention_id text)
returns boolean as $$
  select exists (
    select 1 from "Intervention" i
    where i."id" = p_intervention_id
      and zentra_advises_learner(i."studentId", i."rosterId")
  );
$$ language sql stable security definer set search_path = public;

revoke execute on function zentra_advises_learner(text, text) from public;
revoke execute on function zentra_advises_intervention(text) from public;
grant execute on function zentra_advises_learner(text, text) to authenticated;
grant execute on function zentra_advises_intervention(text) to authenticated;

-- "Intervention" — at-risk follow-ups. Realtime needs to reach the desks that
-- read them through the API (guidance, principal, admin), the counsellor the
-- case is assigned to, and (since the adviser monitoring desk subscribes to
-- this table) the adviser of the learner's section.
alter table "Intervention" enable row level security;

create policy intervention_visible on "Intervention"
  for select to authenticated
  using (
    zentra_role() in ('guidance_counselor', 'principal', 'admin')
    or "assignedTo" = zentra_uid()
    or zentra_advises_learner("Intervention"."studentId", "Intervention"."rosterId")
  );

-- "CounselingSession" — same audience as the intervention it belongs to
-- (including that learner's section adviser), plus whoever booked the session.
alter table "CounselingSession" enable row level security;

create policy counseling_session_visible on "CounselingSession"
  for select to authenticated
  using (
    zentra_role() in ('guidance_counselor', 'principal', 'admin')
    or "createdBy" = zentra_uid()
    or zentra_advises_intervention("CounselingSession"."interventionId")
  );

-- "Referral" — the guidance alerts board and ADM/counseling queues live-update
-- from referral writes, so the desks that read them through the API may receive
-- the row over realtime. The filing teacher, the picked consult reviewer and the
-- nurse's own referrals are included; students/parents never are.
alter table "Referral" enable row level security;

create policy referral_visible on "Referral"
  for select to authenticated
  using (
    zentra_role() in ('guidance_counselor', 'principal', 'admin')
    or "referredBy" = zentra_uid()
    or "consultReviewer" = zentra_uid()
    or ("referredToRole" = 'nurse' and zentra_role() = 'nurse')
    or zentra_advises_learner("Referral"."studentId", "Referral"."rosterId")
  );

-- "RiskSnapshot" — the adviser's intervention board mirrors the selected term's
-- snapshots (level + flags), so the adviser of the learner's section may receive
-- those rows over realtime, alongside the staff desks that already read risk
-- through the API. Students/parents are still excluded: their risk level is
-- served only by dedicated backend endpoints.
alter table "RiskSnapshot" enable row level security;

create policy risk_snapshot_visible on "RiskSnapshot"
  for select to authenticated
  using (
    zentra_role() in ('guidance_counselor', 'principal', 'admin')
    or zentra_advises_learner("RiskSnapshot"."studentId", "RiskSnapshot"."rosterId")
  );
