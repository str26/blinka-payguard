-- PayGuard MVP. Run once on the intended Supabase project.
-- No existing table is dropped or overwritten. A failure rolls back this migration.
begin;

create schema if not exists payguard_private;
revoke all on schema payguard_private from public, anon, authenticated;

create table public.companies (
 id uuid primary key default gen_random_uuid(),
 name text not null check (length(trim(name)) > 0),
 is_demo boolean not null default true check (is_demo),
 created_at timestamptz not null default now()
);
create table public.company_members (
 company_id uuid not null references public.companies(id),
 user_id uuid not null references auth.users(id),
 role text not null check (role in ('admin','operator','approver')),
 created_at timestamptz not null default now(),
 primary key(company_id,user_id)
);
create index company_members_user_idx on public.company_members(user_id,company_id);

create table public.suppliers (
 id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id),
 code text not null check (length(trim(code))>0), name text not null check(length(trim(name))>0),
 allowed boolean not null default false,
 created_at timestamptz not null default now(),
 unique(id,company_id), unique(company_id,code)
);
create table public.agreements (
 id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id),
 supplier_id uuid not null, reference text not null check(length(trim(reference))>0),
 currency text not null check(currency in ('USD','COP','MXN')),
 amount numeric(20,2) not null check(amount>0 and amount<'Infinity'::numeric),
 description text not null,
 unique(id,company_id,supplier_id,currency), unique(company_id,supplier_id,reference),
 foreign key(supplier_id,company_id) references public.suppliers(id,company_id)
);
create table public.policies (
 id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id),
 currency text not null check(currency in ('USD','COP','MXN')),
 version integer not null check(version>0),
 automatic_limit numeric(20,2) not null check(automatic_limit>=0 and automatic_limit<'Infinity'::numeric),
 absolute_limit numeric(20,2) not null check(absolute_limit>0 and absolute_limit<'Infinity'::numeric),
 active boolean not null default true,
 created_at timestamptz not null default now(),
 check(automatic_limit<=absolute_limit),
 unique(company_id,currency,version), unique(id,company_id,currency)
);
create unique index policies_one_active_idx on public.policies(company_id,currency) where active;

create table public.wallets (
 id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id),
 currency text not null check(currency in ('USD','COP','MXN')),
 balance numeric(20,2) not null default 0 check(balance>=0 and balance<'Infinity'::numeric),
 reserved numeric(20,2) not null default 0 check(reserved>=0 and reserved<'Infinity'::numeric),
 available numeric(20,2) generated always as (balance-reserved) stored,
 check(reserved<=balance),
 unique(company_id,currency), unique(id,company_id,currency)
);
create table public.budgets (
 id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id),
 currency text not null check(currency in ('USD','COP','MXN')),
 period date not null check(extract(day from period)=1),
 total numeric(20,2) not null check(total>=0 and total<'Infinity'::numeric),
 reserved numeric(20,2) not null default 0 check(reserved>=0 and reserved<'Infinity'::numeric),
 spent numeric(20,2) not null default 0 check(spent>=0 and spent<'Infinity'::numeric),
 available numeric(20,2) generated always as (total-reserved-spent) stored,
 check(reserved+spent<=total),
 unique(company_id,currency,period), unique(id,company_id,currency)
);

create table public.documents (
 id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id),
 uploaded_by uuid not null, original_name text not null,
 storage_path text not null unique check(storage_path like company_id::text || '/%'),
 mime_type text not null check(mime_type in ('application/pdf','image/jpeg','image/png')),
 byte_size bigint not null check(byte_size>0 and byte_size<=10485760),
 sha256 text not null check(sha256 ~ '^[a-f0-9]{64}$'),
 created_at timestamptz not null default now(),
 unique(id,company_id), unique(company_id,sha256),
 foreign key(company_id,uploaded_by) references public.company_members(company_id,user_id)
);
create table public.invoices (
 id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id),
 document_id uuid not null, supplier_id uuid, agreement_id uuid,
 invoice_number text check(invoice_number is null or length(trim(invoice_number))>0),
 normalized_number text generated always as (lower(btrim(invoice_number))) stored,
 currency text check(currency in ('USD','COP','MXN')),
 amount numeric(20,2) check(amount is null or (amount>0 and amount<'Infinity'::numeric)),
 issue_date date, due_date date,
 version integer not null default 1 check(version>0),
 status text not null default 'received' check(status in
 ('received','processing','needs_review','pending_approval','authorized','blocked','paid_simulated','cancelled')),
 extracted_data jsonb not null default '{}'::jsonb check(jsonb_typeof(extracted_data)='object'),
 created_at timestamptz not null default now(),
 unique(id,company_id), unique(id,company_id,currency),
 unique(company_id,supplier_id,normalized_number),
 foreign key(document_id,company_id) references public.documents(id,company_id),
 foreign key(supplier_id,company_id) references public.suppliers(id,company_id),
 foreign key(agreement_id,company_id,supplier_id,currency) references public.agreements(id,company_id,supplier_id,currency),
 check(agreement_id is null or (supplier_id is not null and currency is not null)),
 check(status not in ('authorized','paid_simulated') or
   (supplier_id is not null and invoice_number is not null and currency is not null and amount is not null and due_date is not null))
);
create index invoices_company_status_idx on public.invoices(company_id,status,created_at);

create table public.decisions (
 id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id),
 invoice_id uuid not null, invoice_version integer not null check(invoice_version>0),
 policy_id uuid, currency text check(currency in ('USD','COP','MXN')),
 status text not null check(status in ('authorized','blocked','needs_review','pending_approval')),
 input_snapshot jsonb not null check(jsonb_typeof(input_snapshot)='object'),
 checks jsonb not null check(jsonb_typeof(checks)='array'),
 created_at timestamptz not null default now(),
 unique(id,company_id,invoice_id),
 foreign key(invoice_id,company_id) references public.invoices(id,company_id),
 foreign key(invoice_id,company_id,currency) references public.invoices(id,company_id,currency),
 foreign key(policy_id,company_id,currency) references public.policies(id,company_id,currency),
 check(policy_id is null or currency is not null),
 check(status not in ('authorized','pending_approval') or policy_id is not null)
);
create index decisions_invoice_idx on public.decisions(company_id,invoice_id,created_at);
create table public.approvals (
 id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id),
 invoice_id uuid not null, decision_id uuid not null, actor_id uuid not null,
 action text not null check(action in ('approve','reject')),
 reason text not null check(length(trim(reason))>0),
 created_at timestamptz not null default now(),
 unique(decision_id),
 foreign key(decision_id,company_id,invoice_id) references public.decisions(id,company_id,invoice_id),
 foreign key(company_id,actor_id) references public.company_members(company_id,user_id)
);
create table public.reservations (
 id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id),
 invoice_id uuid not null, decision_id uuid not null, wallet_id uuid not null, budget_id uuid not null,
 currency text not null check(currency in ('USD','COP','MXN')),
 amount numeric(20,2) not null check(amount>0 and amount<'Infinity'::numeric),
 status text not null default 'active' check(status in ('active','consumed','released')),
 idempotency_key uuid not null,
 created_at timestamptz not null default now(),
 unique(id,company_id,invoice_id,currency), unique(company_id,idempotency_key),
 foreign key(invoice_id,company_id,currency) references public.invoices(id,company_id,currency),
 foreign key(decision_id,company_id,invoice_id) references public.decisions(id,company_id,invoice_id),
 foreign key(wallet_id,company_id,currency) references public.wallets(id,company_id,currency),
 foreign key(budget_id,company_id,currency) references public.budgets(id,company_id,currency)
);
create unique index reservations_one_commitment_idx on public.reservations(company_id,invoice_id) where status in ('active','consumed');
create table public.wallet_movements (
 id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id),
 wallet_id uuid not null, currency text not null check(currency in ('USD','COP','MXN')),
 invoice_id uuid, reservation_id uuid, original_movement_id uuid,
 kind text not null check(kind in ('opening_credit','payment_simulated','refund_received')),
 amount numeric(20,2) not null check(amount>0 and amount<'Infinity'::numeric),
 idempotency_key uuid not null, description text not null,
 created_at timestamptz not null default now(),
 unique(id,company_id,wallet_id,currency,invoice_id), unique(company_id,idempotency_key),
 foreign key(wallet_id,company_id,currency) references public.wallets(id,company_id,currency),
 foreign key(invoice_id,company_id,currency) references public.invoices(id,company_id,currency),
 foreign key(reservation_id,company_id,invoice_id,currency) references public.reservations(id,company_id,invoice_id,currency),
 foreign key(original_movement_id,company_id,wallet_id,currency,invoice_id) references public.wallet_movements(id,company_id,wallet_id,currency,invoice_id),
 check((kind='opening_credit' and invoice_id is null and reservation_id is null and original_movement_id is null)
 or (kind='payment_simulated' and invoice_id is not null and reservation_id is not null and original_movement_id is null)
 or (kind='refund_received' and invoice_id is not null and original_movement_id is not null))
);
create unique index movements_one_payment_idx on public.wallet_movements(company_id,invoice_id) where kind='payment_simulated';
create table public.audit_events (
 id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id),
 actor_id uuid, event_type text not null, entity_id uuid, details jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now(),
 foreign key(company_id,actor_id) references public.company_members(company_id,user_id)
);

-- Definer avoids recursive membership policies; fixed search_path avoids object substitution.
create function payguard_private.is_member(target_company uuid)
returns boolean language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.company_members m where m.company_id=target_company and m.user_id=(select auth.uid()));
$$;
revoke all on function payguard_private.is_member(uuid) from public,anon;
grant usage on schema payguard_private to authenticated;
grant execute on function payguard_private.is_member(uuid) to authenticated;

-- Browser access is read-only and isolated by company. Writes need trusted backend operations.
alter table public.companies enable row level security;
create policy companies_read on public.companies for select to authenticated using(payguard_private.is_member(id));
grant select on public.companies to authenticated;
revoke all on public.companies from anon;
grant all on public.companies to service_role;
do $$
declare t text;
begin
 foreach t in array array['company_members','suppliers','agreements','policies','wallets','budgets','documents','invoices','decisions','approvals','reservations','wallet_movements','audit_events'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from anon, authenticated',t);
  execute format('grant select on public.%I to authenticated',t);
  execute format('grant all on public.%I to service_role',t);
  execute format('create policy company_read on public.%I for select to authenticated using(payguard_private.is_member(company_id))',t);
 end loop;
end $$;
-- Explicitly revoke potential default grants on the company table too.
revoke insert,update,delete,truncate,references,trigger on public.companies from authenticated;
-- Application log writes are append-only for service_role; administrative SQL can still change them.
revoke update,delete,truncate on public.decisions, public.approvals, public.wallet_movements, public.audit_events from service_role;

-- Private document bucket. No browser upload/read policies yet: backend will issue scoped signed URLs.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('payguard-invoices','payguard-invoices',false,10485760,array['application/pdf','image/jpeg','image/png']);

commit;
