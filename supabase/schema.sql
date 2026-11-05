-- Aesthetic Revenue OS — Production PostgreSQL Schema & Strict Multi-Tenant RLS
-- Deploy in Supabase SQL Editor when moving from local/synthetic demo to production Postgres.
-- NON-CLINICAL BOUNDARY: Schema stores operational inquiry, booking, visit-recency,
-- non-clinical spend, membership counts, and workflow attribution ONLY. Never add PHI/chart columns.

create extension if not exists pgcrypto;

create table if not exists public.organizations (
  id text primary key,
  name text not null,
  slug text unique not null,
  is_synthetic boolean not null default false,
  baseline_period_label text default '',
  baseline jsonb not null default '{}'::jsonb,
  settings jsonb not null default '{"sla_target_minutes":15,"inactivity_threshold_days":110,"attribution_window_days":30,"require_human_approval":true}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.org_memberships (
  id uuid primary key default gen_random_uuid(),
  org_id text not null references public.organizations(id) on delete cascade,
  auth_user_id uuid not null, -- Maps to Supabase auth.uid()
  email text not null,
  full_name text not null,
  role text not null check (role in ('owner', 'operator', 'viewer')),
  created_at timestamptz not null default now(),
  unique (org_id, auth_user_id)
);

create table if not exists public.locations (
  id text primary key,
  org_id text not null references public.organizations(id) on delete cascade,
  code text not null,
  name text not null,
  state text not null,
  pos_system text not null default 'CSV Export',
  monthly_revenue_target integer not null default 140000,
  active_providers integer not null default 4,
  is_synthetic boolean not null default false,
  created_at timestamptz not null default now(),
  unique (org_id, code)
);

create table if not exists public.leads (
  id text primary key,
  org_id text not null references public.organizations(id) on delete cascade,
  location_id text not null references public.locations(id) on delete cascade,
  external_id text not null,
  contact_name text not null,
  email text default '',
  phone text default '',
  channel text not null default 'CSV Upload',
  first_response_minutes integer,
  followup_touches integer not null default 0,
  stage text not null check (stage in ('new','contacted','consultation_booked','consultation_attended','converted','lost')),
  estimated_value numeric(12,2) not null default 650,
  collected_amount numeric(12,2) default 0,
  marketing_consent boolean not null default false,
  opted_out boolean not null default false,
  is_synthetic boolean not null default false,
  data_source text not null default 'csv_import',
  created_at timestamptz not null default now()
);

create table if not exists public.customers (
  id text primary key,
  org_id text not null references public.organizations(id) on delete cascade,
  location_id text not null references public.locations(id) on delete cascade,
  external_id text not null,
  customer_name text not null,
  email text default '',
  phone text default '',
  visit_count integer not null default 1,
  last_visit_date date not null,
  lifetime_spend numeric(12,2) not null default 0,
  is_member boolean not null default false,
  marketing_consent boolean not null default false,
  opted_out boolean not null default false,
  is_synthetic boolean not null default false,
  data_source text not null default 'csv_import',
  created_at timestamptz not null default now()
);

create table if not exists public.memberships (
  id text primary key,
  org_id text not null references public.organizations(id) on delete cascade,
  location_id text not null references public.locations(id) on delete cascade,
  plan_name text not null,
  monthly_price numeric(10,2) not null,
  active_members integer not null default 0,
  new_enrollments_30d integer not null default 0,
  cancellations_30d integer not null default 0,
  eligible_non_members integer not null default 0,
  is_synthetic boolean not null default false,
  data_source text not null default 'csv_import',
  created_at timestamptz not null default now()
);

create table if not exists public.workflow_tasks (
  id text primary key,
  org_id text not null references public.organizations(id) on delete cascade,
  location_id text not null references public.locations(id) on delete cascade,
  category text not null,
  title text not null,
  target_record_id text not null,
  recipient_name text not null,
  marketing_consent boolean not null default false,
  opted_out boolean not null default false,
  owner_name text not null,
  approval_status text not null check (approval_status in ('pending_approval','approved','rejected')),
  approved_by text,
  approved_at timestamptz,
  action_initiated_at timestamptz,
  lifecycle_stage text not null check (lifecycle_stage in ('identified','estimated','action_initiated','appointment_booked','sale_completed','revenue_collected')),
  estimated_value numeric(12,2) not null default 0,
  collected_revenue numeric(12,2) not null default 0,
  receipt_reference text,
  draft_message text not null,
  is_synthetic boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.csv_imports (
  id text primary key,
  org_id text not null references public.organizations(id) on delete cascade,
  entity_type text not null,
  filename text not null,
  imported_by text not null,
  total_rows integer not null,
  committed_rows integer not null,
  duplicate_rows integer not null,
  invalid_rows integer not null,
  created_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id text primary key,
  org_id text not null,
  actor_email text not null,
  actor_role text not null,
  action text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Helper function enforcing strict tenant isolation via Supabase Auth
create or replace function public.user_has_org_role(target_org text, allowed_roles text[])
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1
    from public.org_memberships m
    where m.org_id = target_org
      and m.auth_user_id = auth.uid()
      and m.role = any(allowed_roles)
  );
$$;

alter table public.organizations enable row level security;
alter table public.org_memberships enable row level security;
alter table public.locations enable row level security;
alter table public.leads enable row level security;
alter table public.customers enable row level security;
alter table public.memberships enable row level security;
alter table public.workflow_tasks enable row level security;
alter table public.csv_imports enable row level security;
alter table public.audit_logs enable row level security;

-- Tenant-isolated read policies
create policy "tenant_read_orgs" on public.organizations for select
  using (public.user_has_org_role(id, array['owner','operator','viewer']));

create policy "tenant_read_locations" on public.locations for select
  using (public.user_has_org_role(org_id, array['owner','operator','viewer']));

create policy "tenant_write_locations" on public.locations for all
  using (public.user_has_org_role(org_id, array['owner','operator']))
  with check (public.user_has_org_role(org_id, array['owner','operator']));

create policy "tenant_read_leads" on public.leads for select
  using (public.user_has_org_role(org_id, array['owner','operator','viewer']));

create policy "tenant_write_leads" on public.leads for all
  using (public.user_has_org_role(org_id, array['owner','operator']))
  with check (public.user_has_org_role(org_id, array['owner','operator']));

create policy "tenant_read_customers" on public.customers for select
  using (public.user_has_org_role(org_id, array['owner','operator','viewer']));

create policy "tenant_write_customers" on public.customers for all
  using (public.user_has_org_role(org_id, array['owner','operator']))
  with check (public.user_has_org_role(org_id, array['owner','operator']));

create policy "tenant_read_memberships" on public.memberships for select
  using (public.user_has_org_role(org_id, array['owner','operator','viewer']));

create policy "tenant_write_memberships" on public.memberships for all
  using (public.user_has_org_role(org_id, array['owner','operator']))
  with check (public.user_has_org_role(org_id, array['owner','operator']));

create policy "tenant_read_workflows" on public.workflow_tasks for select
  using (public.user_has_org_role(org_id, array['owner','operator','viewer']));

create policy "tenant_write_workflows" on public.workflow_tasks for all
  using (public.user_has_org_role(org_id, array['owner','operator']))
  with check (public.user_has_org_role(org_id, array['owner','operator']));

create policy "tenant_read_imports" on public.csv_imports for select
  using (public.user_has_org_role(org_id, array['owner','operator','viewer']));

create policy "tenant_write_imports" on public.csv_imports for insert
  with check (public.user_has_org_role(org_id, array['owner','operator']));

create policy "tenant_read_audit" on public.audit_logs for select
  using (public.user_has_org_role(org_id, array['owner','operator']));
