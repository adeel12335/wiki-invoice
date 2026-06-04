create extension if not exists pgcrypto;

do $$
begin
  if not exists (
    select 1
    from pg_type
    where typnamespace = 'public'::regnamespace
      and typname = 'invoice_status'
  ) then
    create type public.invoice_status as enum (
      'Draft',
      'Sent',
      'Partially Paid',
      'Paid',
      'Overdue',
      'Cancelled'
    );
  end if;
end
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role text not null default 'admin',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  email text,
  phone text,
  address text,
  logo_url text,
  default_currency char(3) not null default 'USD',
  invoice_prefix text not null default 'WIKI',
  payment_terms text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, name)
);

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  email text not null,
  phone text,
  address text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, email)
);

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  company_id uuid references public.companies(id) on delete set null,
  invoice_number text not null,
  status public.invoice_status not null default 'Draft',
  currency char(3) not null default 'USD',
  issue_date date,
  due_date date,
  payment_link text,
  terms text,
  subtotal numeric(12,2) not null default 0,
  deposit_amount numeric(12,2) not null default 0,
  remaining_amount numeric(12,2) not null default 0,
  total_amount numeric(12,2) not null default 0,
  pdf_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, invoice_number),
  constraint invoices_amounts_non_negative check (
    subtotal >= 0
    and deposit_amount >= 0
    and remaining_amount >= 0
    and total_amount >= 0
  )
);

create table if not exists public.invoice_items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  title text not null,
  description text,
  bullet_details text[] not null default array[]::text[],
  quantity numeric(12,2) not null default 1,
  rate numeric(12,2) not null default 0,
  total numeric(12,2) generated always as (quantity * rate) stored,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint invoice_items_values_non_negative check (
    quantity >= 0
    and rate >= 0
  )
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  amount numeric(12,2) not null,
  currency char(3) not null default 'USD',
  method text,
  reference text,
  paid_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint payments_amount_positive check (amount > 0)
);

create index if not exists clients_owner_name_idx
  on public.clients(owner_id, name);

create index if not exists invoices_owner_status_idx
  on public.invoices(owner_id, status);

create index if not exists invoices_owner_due_date_idx
  on public.invoices(owner_id, due_date);

create index if not exists invoice_items_invoice_idx
  on public.invoice_items(invoice_id, sort_order);

create index if not exists payments_invoice_idx
  on public.payments(invoice_id, paid_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

drop trigger if exists companies_set_updated_at on public.companies;
create trigger companies_set_updated_at
before update on public.companies
for each row
execute function public.set_updated_at();

drop trigger if exists clients_set_updated_at on public.clients;
create trigger clients_set_updated_at
before update on public.clients
for each row
execute function public.set_updated_at();

drop trigger if exists invoices_set_updated_at on public.invoices;
create trigger invoices_set_updated_at
before update on public.invoices
for each row
execute function public.set_updated_at();

drop trigger if exists invoice_items_set_updated_at on public.invoice_items;
create trigger invoice_items_set_updated_at
before update on public.invoice_items
for each row
execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', new.email))
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.companies enable row level security;
alter table public.clients enable row level security;
alter table public.invoices enable row level security;
alter table public.invoice_items enable row level security;
alter table public.payments enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
on public.profiles
for select
to authenticated
using (id = auth.uid());

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles
for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

drop policy if exists "companies_owner_all" on public.companies;
create policy "companies_owner_all"
on public.companies
for all
to authenticated
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

drop policy if exists "clients_owner_all" on public.clients;
create policy "clients_owner_all"
on public.clients
for all
to authenticated
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

drop policy if exists "invoices_owner_all" on public.invoices;
create policy "invoices_owner_all"
on public.invoices
for all
to authenticated
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

drop policy if exists "invoice_items_owner_all" on public.invoice_items;
create policy "invoice_items_owner_all"
on public.invoice_items
for all
to authenticated
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

drop policy if exists "payments_owner_all" on public.payments;
create policy "payments_owner_all"
on public.payments
for all
to authenticated
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

drop view if exists public.invoice_summary;
create view public.invoice_summary
with (security_invoker = true)
as
select
  invoices.id,
  invoices.owner_id,
  invoices.invoice_number,
  invoices.status,
  invoices.currency,
  invoices.issue_date,
  invoices.due_date,
  invoices.total_amount,
  invoices.deposit_amount,
  invoices.remaining_amount,
  clients.name as client_name,
  clients.email as client_email,
  invoices.updated_at
from public.invoices
left join public.clients on clients.id = invoices.client_id;
