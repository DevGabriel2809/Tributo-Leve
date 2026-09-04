create extension if not exists pgcrypto;

do $$ begin
  create type public.access_status as enum ('pending_payment', 'active', 'test_access', 'blocked');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.app_role as enum ('user', 'admin');
exception when duplicate_object then null;
end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text not null default '',
  role public.app_role not null default 'user',
  access_status public.access_status not null default 'pending_payment',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles add column if not exists cpf_hash text;
alter table public.profiles add column if not exists cpf_last4 text;
create unique index if not exists profiles_cpf_hash_unique on public.profiles(cpf_hash) where cpf_hash is not null;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.app_secrets (
  key text primary key,
  secret_value bytea not null,
  created_at timestamptz not null default now()
);

revoke all on private.app_secrets from public, anon, authenticated;

insert into private.app_secrets (key, secret_value)
values ('cpf_hmac', extensions.gen_random_bytes(32))
on conflict (key) do nothing;

create or replace function private.hash_cpf(p_cpf text) returns text
language sql stable security definer
set search_path = private, extensions, pg_catalog
as $$
  select encode(extensions.hmac(convert_to(p_cpf, 'UTF8'), secret_value, 'sha256'), 'hex')
  from private.app_secrets
  where key = 'cpf_hmac';
$$;

create or replace function public.cpf_already_registered(p_cpf text) returns boolean
language sql stable security definer
set search_path = public, private, pg_catalog
as $$
  select exists (
    select 1 from public.profiles
    where cpf_hash = private.hash_cpf(p_cpf)
  );
$$;

create or replace function public.claim_cpf(p_user_id uuid, p_cpf text) returns void
language plpgsql security definer
set search_path = public, private, pg_catalog
as $$
begin
  if p_cpf !~ '^[0-9]{11}$' then
    raise exception 'invalid cpf';
  end if;

  update public.profiles
  set cpf_hash = private.hash_cpf(p_cpf),
      cpf_last4 = right(p_cpf, 4),
      updated_at = now()
  where id = p_user_id and cpf_hash is null;

  if not found then
    raise exception 'profile unavailable';
  end if;
end;
$$;

create or replace function public.cpf_belongs_to_user(p_user_id uuid, p_cpf text) returns boolean
language sql stable security definer
set search_path = public, private, pg_catalog
as $$
  select exists (
    select 1 from public.profiles
    where id = p_user_id and cpf_hash = private.hash_cpf(p_cpf)
  );
$$;

revoke all on function public.cpf_already_registered(text) from public, anon, authenticated;
revoke all on function public.claim_cpf(uuid, text) from public, anon, authenticated;
revoke all on function public.cpf_belongs_to_user(uuid, text) from public, anon, authenticated;
grant execute on function public.cpf_already_registered(text) to service_role;
grant execute on function public.claim_cpf(uuid, text) to service_role;
grant execute on function public.cpf_belongs_to_user(uuid, text) to service_role;

create table if not exists public.plans (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text not null,
  price_cents integer not null check (price_cents >= 0),
  billing_months integer not null default 1,
  company_limit integer not null default 1,
  included_features text[] not null default '{}'::text[],
  badge text,
  recommended boolean not null default false,
  sort_order integer not null default 100,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text not null,
  price_cents integer not null check (price_cents >= 0),
  feature_key text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  plan_id uuid references public.plans(id),
  status text not null default 'pending_payment',
  activated_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  plan_id uuid references public.plans(id),
  product_id uuid references public.products(id),
  provider text not null,
  provider_payment_id text not null unique,
  provider_order_id text,
  provider_transaction_id text,
  provider_api text not null default 'payments_v1',
  method text not null check (method in ('pix', 'boleto')),
  status text not null,
  raw_status text,
  amount_cents integer not null check (amount_cents >= 0),
  expires_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payments_item_required check (plan_id is not null or product_id is not null)
);

-- Recupera com seguranca uma tentativa anterior que tenha parado no meio.
alter table public.payments add column if not exists product_id uuid;
alter table public.payments alter column plan_id drop not null;
alter table public.payments add column if not exists provider_order_id text;
alter table public.payments add column if not exists provider_transaction_id text;
alter table public.payments add column if not exists provider_api text not null default 'payments_v1';

do $$ begin
  alter table public.payments
    add constraint payments_product_id_fkey foreign key (product_id) references public.products(id);
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table public.payments
    add constraint payments_item_required check (plan_id is not null or product_id is not null);
exception when duplicate_object then null;
end $$;

create table if not exists public.entitlements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  active boolean not null default true,
  granted_by uuid references public.profiles(id),
  granted_at timestamptz not null default now(),
  expires_at timestamptz,
  unique (user_id, product_id)
);

create table if not exists public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles(id),
  target_user_id uuid references public.profiles(id),
  action text not null,
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.consent_events (
  id bigint generated always as identity primary key,
  user_id uuid references public.profiles(id),
  anonymous_id uuid,
  necessary boolean not null default true,
  analytics boolean not null default false,
  policy_version text not null,
  created_at timestamptz not null default now()
);

create index if not exists payments_user_created_idx on public.payments(user_id, created_at desc);
create unique index if not exists payments_provider_order_id_unique on public.payments(provider_order_id) where provider_order_id is not null;
create index if not exists payments_provider_transaction_id_idx on public.payments(provider_transaction_id) where provider_transaction_id is not null;
create index if not exists audit_target_created_idx on public.audit_logs(target_user_id, created_at desc);

insert into public.plans (slug, name, description, price_cents, billing_months, company_limit, included_features, badge, recommended, sort_order) values
  ('basico-mensal', 'Leve Start', 'Tudo o que você precisa para começar a simular com segurança em 1 CNPJ.', 4990, 1, 1, '{}', 'COMECE AQUI', false, 10),
  ('pro-mensal', 'Leve Pro', 'Mais espaço para uma operação compacta, com até 4 CNPJs e carteira integrada.', 8990, 1, 4, '{portfolio}', 'PARA CRESCER', false, 20),
  ('pro-trimestral', 'Leve Prime', 'A experiência mais completa: 3 meses, até 4 CNPJs e Relatório Executivo incluído.', 23970, 3, 4, '{portfolio,executive_report}', 'MELHOR ESCOLHA', true, 30)
on conflict (slug) do update set name = excluded.name, description = excluded.description, active = true;

insert into public.products (slug, name, description, price_cents, feature_key) values
  ('carteira-clientes', 'Carteira de clientes', 'Organização de múltiplos CNPJs e visão consolidada.', 8990, 'portfolio'),
  ('relatorio-executivo', 'Relatório executivo', 'Relatório avançado com personalização de marca.', 4990, 'executive_report'),
  ('colaboradores', 'Equipe adicional', 'Libera acessos adicionais para o escritório.', 6990, 'team')
on conflict (slug) do update set name = excluded.name, description = excluded.description, feature_key = excluded.feature_key, active = true;

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, coalesce(new.email, ''), coalesce(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do update set email = excluded.email, full_name = excluded.full_name, updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

insert into public.profiles (id, email, full_name)
select id, coalesce(email, ''), coalesce(raw_user_meta_data ->> 'full_name', '')
from auth.users
on conflict (id) do nothing;

create or replace function public.is_admin() returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

alter table public.profiles enable row level security;
alter table public.plans enable row level security;
alter table public.subscriptions enable row level security;
alter table public.payments enable row level security;
alter table public.products enable row level security;
alter table public.entitlements enable row level security;
alter table public.audit_logs enable row level security;
alter table public.consent_events enable row level security;

drop policy if exists "profile own read" on public.profiles;
drop policy if exists "plans public read" on public.plans;
drop policy if exists "subscriptions own read" on public.subscriptions;
drop policy if exists "payments own read" on public.payments;
drop policy if exists "products authenticated read" on public.products;
drop policy if exists "entitlements own read" on public.entitlements;
drop policy if exists "audit admin read" on public.audit_logs;
drop policy if exists "consent own insert" on public.consent_events;

create policy "profile own read" on public.profiles for select using (id = auth.uid() or public.is_admin());
create policy "plans public read" on public.plans for select using (active = true or public.is_admin());
create policy "subscriptions own read" on public.subscriptions for select using (user_id = auth.uid() or public.is_admin());
create policy "payments own read" on public.payments for select using (user_id = auth.uid() or public.is_admin());
create policy "products authenticated read" on public.products for select to authenticated using (active = true or public.is_admin());
create policy "entitlements own read" on public.entitlements for select using (user_id = auth.uid() or public.is_admin());
create policy "audit admin read" on public.audit_logs for select using (public.is_admin());
create policy "consent own insert" on public.consent_events for insert with check (user_id = auth.uid() or user_id is null);

revoke all on public.audit_logs from anon, authenticated;
grant select on public.audit_logs to authenticated;

-- Depois de criar sua conta, defina o administrador principal uma unica vez:
-- update public.profiles set role = 'admin', access_status = 'active' where email = 'SEU_EMAIL@DOMINIO.COM';

-- Garante que as RPCs recém-criadas sejam reconhecidas imediatamente pela Data API.
notify pgrst, 'reload schema';
