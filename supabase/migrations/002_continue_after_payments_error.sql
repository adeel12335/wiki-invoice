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

create index if not exists clients_owner_name_idx on public.clients(owner_id, name);
create index if not exists invoices_owner_status_idx on public.invoices(owner_id, status);
create index if not exists invoices_owner_due_date_idx on public.invoices(owner_id, due_date);
create index if not exists invoice_items_invoice_idx on public.invoice_items(invoice_id, sort_order);
create index if not exists payments_invoice_idx on public.payments(invoice_id, paid_at desc);

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
for each row execute function public.set_updated_at();

drop trigger if exists companies_set_updated_at on public.companies;
create trigger companies_set_updated_at
before update on public.companies
for each row execute function public.set_updated_at();

drop trigger if exists clients_set_updated_at on public.clients;
create trigger clients_set_updated_at
before update on public.clients
for each row execute function public.set_updated_at();

drop trigger if exists invoices_set_updated_at on public.invoices;
create trigger invoices_set_updated_at
before update on public.invoices
for each row execute function public.set_updated_at();

drop trigger if exists invoice_items_set_updated_at on public.invoice_items;
create trigger invoice_items_set_updated_at
before update on public.invoice_items
for each row execute function public.set_updated_at();

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
for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.companies enable row level security;
alter table public.clients enable row level security;
alter table public.invoices enable row level security;
alter table public.invoice_items enable row level security;
alter table public.payments enable row level security;

drop policy if exists "profiles own select" on public.profiles;
create policy "profiles own select"
on public.profiles for select
to authenticated
using (id = auth.uid());

drop policy if exists "profiles own update" on public.profiles;
create policy "profiles own update"
on public.profiles for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

drop policy if exists "companies own CRUD" on public.companies;
create policy "companies own CRUD"
on public.companies for all
to authenticated
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

drop policy if exists "clients own CRUD" on public.clients;
create policy "clients own CRUD"
on public.clients for all
to authenticated
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

drop policy if exists "invoices own CRUD" on public.invoices;
create policy "invoices own CRUD"
on public.invoices for all
to authenticated
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

drop policy if exists "invoice items own CRUD" on public.invoice_items;
create policy "invoice items own CRUD"
on public.invoice_items for all
to authenticated
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

drop policy if exists "payments own CRUD" on public.payments;
create policy "payments own CRUD"
on public.payments for all
to authenticated
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

drop view if exists public.invoice_summary;
create view public.invoice_summary
with (security_invoker = true)
as
select
  i.id,
  i.owner_id,
  i.invoice_number,
  i.status,
  i.currency,
  i.issue_date,
  i.due_date,
  i.total_amount,
  i.deposit_amount,
  i.remaining_amount,
  c.name as client_name,
  c.email as client_email,
  i.updated_at
from public.invoices i
left join public.clients c on c.id = i.client_id;
