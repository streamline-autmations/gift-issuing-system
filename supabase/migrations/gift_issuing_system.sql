begin;

create extension if not exists "pgcrypto";

create table public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz default now()
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  company_id uuid references public.companies (id),
  role text,
  created_at timestamptz default now(),
  constraint profiles_role_check check (role is null or role in ('superadmin', 'operator')),
  constraint profiles_role_company_check check (
    role is null
    or (role = 'superadmin' and company_id is null)
    or (role = 'operator' and company_id is not null)
  )
);

create table public.issuings (
  id uuid primary key,
  company_id uuid not null references public.companies (id) on delete cascade,
  name text not null,
  mine_name text not null,
  is_active boolean default true,
  created_at timestamptz default now()
);

create table public.gift_slots (
  id uuid primary key,
  issuing_id uuid not null references public.issuings (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  name text not null,
  is_choice boolean default false,
  created_at timestamptz default now()
);

create table public.gift_options (
  id uuid primary key,
  slot_id uuid not null references public.gift_slots (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  item_name text not null,
  created_at timestamptz default now()
);

create table public.employees (
  id uuid primary key,
  company_id uuid not null references public.companies (id) on delete cascade,
  issuing_id uuid not null references public.issuings (id) on delete cascade,
  employee_number text not null,
  first_name text,
  last_name text,
  extra_data jsonb,
  created_at timestamptz default now(),
  constraint employees_issuing_employee_number_unique unique (issuing_id, employee_number)
);

create table public.employee_slots (
  id uuid primary key,
  employee_id uuid not null references public.employees (id) on delete cascade,
  slot_id uuid not null references public.gift_slots (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  constraint employee_slots_employee_slot_unique unique (employee_id, slot_id)
);

create table public.issued_records (
  id uuid primary key,
  company_id uuid not null references public.companies (id) on delete cascade,
  issuing_id uuid not null references public.issuings (id) on delete cascade,
  employee_id uuid not null unique references public.employees (id) on delete cascade,
  issued_at timestamptz default now(),
  notes text
);

create table public.issued_selections (
  id uuid primary key,
  issued_record_id uuid not null references public.issued_records (id) on delete cascade,
  slot_id uuid not null references public.gift_slots (id) on delete cascade,
  gift_option_id uuid not null references public.gift_options (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade
);

create index profiles_company_id_idx on public.profiles (company_id);

create index issuings_company_id_idx on public.issuings (company_id);

create index gift_slots_issuing_id_idx on public.gift_slots (issuing_id);
create index gift_slots_company_id_idx on public.gift_slots (company_id);

create index gift_options_slot_id_idx on public.gift_options (slot_id);
create index gift_options_company_id_idx on public.gift_options (company_id);

create index employees_company_id_idx on public.employees (company_id);
create index employees_issuing_id_idx on public.employees (issuing_id);

create index employee_slots_employee_id_idx on public.employee_slots (employee_id);
create index employee_slots_slot_id_idx on public.employee_slots (slot_id);
create index employee_slots_company_id_idx on public.employee_slots (company_id);

create index issued_records_company_id_idx on public.issued_records (company_id);
create index issued_records_issuing_id_idx on public.issued_records (issuing_id);

create index issued_selections_issued_record_id_idx on public.issued_selections (issued_record_id);
create index issued_selections_slot_id_idx on public.issued_selections (slot_id);
create index issued_selections_gift_option_id_idx on public.issued_selections (gift_option_id);
create index issued_selections_company_id_idx on public.issued_selections (company_id);

create index if not exists employees_issuing_employee_number_idx on public.employees (issuing_id, employee_number);

create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select p.role
  from public.profiles p
  where p.id = auth.uid();
$$;

create or replace function public.current_user_company_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select p.company_id
  from public.profiles p
  where p.id = auth.uid();
$$;

alter table public.companies enable row level security;
alter table public.profiles enable row level security;
alter table public.issuings enable row level security;
alter table public.gift_slots enable row level security;
alter table public.gift_options enable row level security;
alter table public.employees enable row level security;
alter table public.employee_slots enable row level security;
alter table public.issued_records enable row level security;
alter table public.issued_selections enable row level security;

grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;

create policy companies_superadmin_all
on public.companies
for all
to authenticated
using (public.current_user_role() = 'superadmin')
with check (public.current_user_role() = 'superadmin');

create policy companies_operator_select
on public.companies
for select
to authenticated
using (
  public.current_user_role() = 'operator'
  and id = public.current_user_company_id()
);

create policy companies_operator_insert
on public.companies
for insert
to authenticated
with check (
  public.current_user_role() = 'operator'
  and id = public.current_user_company_id()
);

create policy companies_operator_update
on public.companies
for update
to authenticated
using (
  public.current_user_role() = 'operator'
  and id = public.current_user_company_id()
)
with check (
  public.current_user_role() = 'operator'
  and id = public.current_user_company_id()
);

create policy profiles_superadmin_all
on public.profiles
for all
to authenticated
using (public.current_user_role() = 'superadmin')
with check (public.current_user_role() = 'superadmin');

create policy profiles_operator_select
on public.profiles
for select
to authenticated
using (
  public.current_user_role() = 'operator'
  and company_id = public.current_user_company_id()
);

create policy profiles_operator_insert
on public.profiles
for insert
to authenticated
with check (
  public.current_user_role() = 'operator'
  and company_id = public.current_user_company_id()
);

create policy profiles_operator_update
on public.profiles
for update
to authenticated
using (
  public.current_user_role() = 'operator'
  and company_id = public.current_user_company_id()
)
with check (
  public.current_user_role() = 'operator'
  and company_id = public.current_user_company_id()
);

create policy issuings_superadmin_all
on public.issuings
for all
to authenticated
using (public.current_user_role() = 'superadmin')
with check (public.current_user_role() = 'superadmin');

create policy issuings_operator_select
on public.issuings
for select
to authenticated
using (
  public.current_user_role() = 'operator'
  and company_id = public.current_user_company_id()
);

create policy issuings_operator_insert
on public.issuings
for insert
to authenticated
with check (
  public.current_user_role() = 'operator'
  and company_id = public.current_user_company_id()
);

create policy issuings_operator_update
on public.issuings
for update
to authenticated
using (
  public.current_user_role() = 'operator'
  and company_id = public.current_user_company_id()
)
with check (
  public.current_user_role() = 'operator'
  and company_id = public.current_user_company_id()
);

create policy gift_slots_superadmin_all
on public.gift_slots
for all
to authenticated
using (public.current_user_role() = 'superadmin')
with check (public.current_user_role() = 'superadmin');

create policy gift_slots_operator_select
on public.gift_slots
for select
to authenticated
using (
  public.current_user_role() = 'operator'
  and company_id = public.current_user_company_id()
);

create policy gift_slots_operator_insert
on public.gift_slots
for insert
to authenticated
with check (
  public.current_user_role() = 'operator'
  and company_id = public.current_user_company_id()
);

create policy gift_slots_operator_update
on public.gift_slots
for update
to authenticated
using (
  public.current_user_role() = 'operator'
  and company_id = public.current_user_company_id()
)
with check (
  public.current_user_role() = 'operator'
  and company_id = public.current_user_company_id()
);

create policy gift_options_superadmin_all
on public.gift_options
for all
to authenticated
using (public.current_user_role() = 'superadmin')
with check (public.current_user_role() = 'superadmin');

create policy gift_options_operator_select
on public.gift_options
for select
to authenticated
using (
  public.current_user_role() = 'operator'
  and company_id = public.current_user_company_id()
);

create policy gift_options_operator_insert
on public.gift_options
for insert
to authenticated
with check (
  public.current_user_role() = 'operator'
  and company_id = public.current_user_company_id()
);

create policy gift_options_operator_update
on public.gift_options
for update
to authenticated
using (
  public.current_user_role() = 'operator'
  and company_id = public.current_user_company_id()
)
with check (
  public.current_user_role() = 'operator'
  and company_id = public.current_user_company_id()
);

create policy employees_superadmin_all
on public.employees
for all
to authenticated
using (public.current_user_role() = 'superadmin')
with check (public.current_user_role() = 'superadmin');

create policy employees_operator_select
on public.employees
for select
to authenticated
using (
  public.current_user_role() = 'operator'
  and company_id = public.current_user_company_id()
);

create policy employees_operator_insert
on public.employees
for insert
to authenticated
with check (
  public.current_user_role() = 'operator'
  and company_id = public.current_user_company_id()
);

create policy employees_operator_update
on public.employees
for update
to authenticated
using (
  public.current_user_role() = 'operator'
  and company_id = public.current_user_company_id()
)
with check (
  public.current_user_role() = 'operator'
  and company_id = public.current_user_company_id()
);

create policy employee_slots_superadmin_all
on public.employee_slots
for all
to authenticated
using (public.current_user_role() = 'superadmin')
with check (public.current_user_role() = 'superadmin');

create policy employee_slots_operator_select
on public.employee_slots
for select
to authenticated
using (
  public.current_user_role() = 'operator'
  and company_id = public.current_user_company_id()
);

create policy employee_slots_operator_insert
on public.employee_slots
for insert
to authenticated
with check (
  public.current_user_role() = 'operator'
  and company_id = public.current_user_company_id()
);

create policy employee_slots_operator_update
on public.employee_slots
for update
to authenticated
using (
  public.current_user_role() = 'operator'
  and company_id = public.current_user_company_id()
)
with check (
  public.current_user_role() = 'operator'
  and company_id = public.current_user_company_id()
);

create policy issued_records_superadmin_all
on public.issued_records
for all
to authenticated
using (public.current_user_role() = 'superadmin')
with check (public.current_user_role() = 'superadmin');

create policy issued_records_operator_select
on public.issued_records
for select
to authenticated
using (
  public.current_user_role() = 'operator'
  and company_id = public.current_user_company_id()
);

create policy issued_records_operator_insert
on public.issued_records
for insert
to authenticated
with check (
  public.current_user_role() = 'operator'
  and company_id = public.current_user_company_id()
);

create policy issued_records_operator_update
on public.issued_records
for update
to authenticated
using (
  public.current_user_role() = 'operator'
  and company_id = public.current_user_company_id()
)
with check (
  public.current_user_role() = 'operator'
  and company_id = public.current_user_company_id()
);

create policy issued_selections_superadmin_all
on public.issued_selections
for all
to authenticated
using (public.current_user_role() = 'superadmin')
with check (public.current_user_role() = 'superadmin');

create policy issued_selections_operator_select
on public.issued_selections
for select
to authenticated
using (
  public.current_user_role() = 'operator'
  and company_id = public.current_user_company_id()
);

create policy issued_selections_operator_insert
on public.issued_selections
for insert
to authenticated
with check (
  public.current_user_role() = 'operator'
  and company_id = public.current_user_company_id()
);

create policy issued_selections_operator_update
on public.issued_selections
for update
to authenticated
using (
  public.current_user_role() = 'operator'
  and company_id = public.current_user_company_id()
)
with check (
  public.current_user_role() = 'operator'
  and company_id = public.current_user_company_id()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id)
  values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user();

commit;
