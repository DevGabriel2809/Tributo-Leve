-- TRIBUTO LEVE v4.2.0 - PACOTE SQL COMPLETO PARA QUEM JA ESTA NA v4.1.0
-- Execute este arquivo uma unica vez no Supabase SQL Editor.

-- TRIBUTO LEVE 4.2.0 - CARTAO, RECORRENCIA E TOLERANCIA
-- Execute depois da 006_planos_periodicos_demo.sql.

-- Pagamentos avulsos de modulos passam a aceitar cartao.
do $$
begin
  alter table public.payments drop constraint if exists payments_method_check;
exception when undefined_object then null;
end $$;

alter table public.payments
  add constraint payments_method_check check (method in ('pix','boleto','card'));

alter table public.payments add column if not exists installments integer;
alter table public.payments add column if not exists card_brand text;
alter table public.payments add column if not exists card_last4 text;
alter table public.payments add column if not exists idempotency_key uuid;
create unique index if not exists payments_user_idempotency_unique
  on public.payments(user_id, idempotency_key) where idempotency_key is not null;

-- A assinatura de acesso sempre possui vencimento real. grace_until so e usado
-- quando uma cobranca recorrente falha e a conta entra na tolerancia de 3 dias.
alter table public.subscriptions add column if not exists renewal_mode text not null default 'manual';
alter table public.subscriptions add column if not exists grace_until timestamptz;
alter table public.subscriptions add column if not exists next_billing_at timestamptz;
alter table public.subscriptions add column if not exists recurring_contract_id uuid;

create table if not exists public.recurring_contracts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  plan_id uuid not null references public.plans(id),
  provider text not null default 'mercado_pago',
  provider_subscription_id text not null unique,
  provider_status text not null default 'pending',
  status text not null default 'pending_activation'
    check (status in ('pending_activation','active','past_due','paused','canceled','expired','error')),
  amount_cents integer not null check (amount_cents > 0),
  billing_months integer not null check (billing_months in (1,3)),
  current_period_start timestamptz,
  current_period_end timestamptz,
  next_payment_date timestamptz,
  grace_until timestamptz,
  cancel_at_period_end boolean not null default false,
  canceled_at timestamptz,
  card_brand text,
  card_last4 text,
  last_authorized_payment_id text,
  last_payment_status text,
  last_payment_status_detail text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists recurring_contracts_status_idx on public.recurring_contracts(status, updated_at desc);
create index if not exists recurring_contracts_next_payment_idx on public.recurring_contracts(next_payment_date) where status in ('active','past_due');

-- Vinculo opcional para a assinatura corrente.
do $$ begin
  alter table public.subscriptions
    add constraint subscriptions_recurring_contract_id_fkey
    foreign key (recurring_contract_id) references public.recurring_contracts(id) on delete set null;
exception when duplicate_object then null;
end $$;

-- Eventos processados do provedor. Nao armazenamos payload bruto nem segredo.
create table if not exists public.webhook_events (
  id bigint generated always as identity primary key,
  provider text not null,
  event_key text not null,
  event_type text not null,
  resource_id text not null,
  request_id text,
  payload_hash text,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  result text,
  unique(provider, event_key)
);

create index if not exists webhook_events_received_idx on public.webhook_events(received_at desc);

-- Chaves de idempotencia de operacoes sensiveis iniciadas pelo usuario.
create table if not exists public.request_idempotency (
  id bigint generated always as identity primary key,
  scope text not null,
  user_id uuid references public.profiles(id) on delete cascade,
  idempotency_key uuid not null,
  provider_resource_id text,
  created_at timestamptz not null default now(),
  unique(scope, user_id, idempotency_key)
);

-- Remove registros antigos depois de 7 dias; esta tabela nao contem dados de cartao.
create index if not exists request_idempotency_created_idx on public.request_idempotency(created_at);

notify pgrst, 'reload schema';

select
  to_regclass('public.recurring_contracts') is not null as recorrencia_ok,
  to_regclass('public.webhook_events') is not null as webhook_idempotencia_ok,
  exists(select 1 from information_schema.columns where table_schema='public' and table_name='subscriptions' and column_name='grace_until') as tolerancia_ok,
  exists(select 1 from information_schema.columns where table_schema='public' and table_name='payments' and column_name='installments') as cartao_avulso_ok;

-- ===============================================================
-- HARDENING
-- ===============================================================

-- TRIBUTO LEVE 4.2.0 - HARDENING DE BANCO E ENDPOINTS
-- Objetivo: frontend le somente o estritamente necessario; toda mutacao critica
-- passa pelas Netlify Functions usando a chave secreta do servidor.

create table if not exists public.rate_limits (
  rate_key text primary key,
  window_started_at timestamptz not null default now(),
  request_count integer not null default 0,
  updated_at timestamptz not null default now()
);

-- Consumo atomico de rate limit. A funcao so pode ser executada pela service_role.
create or replace function public.consume_rate_limit(
  p_key text,
  p_limit integer,
  p_window_seconds integer
) returns boolean
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_count integer;
begin
  if p_limit < 1 or p_window_seconds < 1 or length(p_key) < 16 then
    return false;
  end if;

  insert into public.rate_limits(rate_key, window_started_at, request_count, updated_at)
  values (p_key, v_now, 1, v_now)
  on conflict (rate_key) do update set
    window_started_at = case
      when public.rate_limits.window_started_at <= v_now - make_interval(secs => p_window_seconds)
      then v_now else public.rate_limits.window_started_at end,
    request_count = case
      when public.rate_limits.window_started_at <= v_now - make_interval(secs => p_window_seconds)
      then 1 else public.rate_limits.request_count + 1 end,
    updated_at = v_now
  returning request_count into v_count;

  return v_count <= p_limit;
end;
$$;

-- RLS ligado em toda tabela sensivel, inclusive as novas.
alter table public.profiles enable row level security;
alter table public.subscriptions enable row level security;
alter table public.payments enable row level security;
alter table public.entitlements enable row level security;
alter table public.audit_logs enable row level security;
alter table public.consent_events enable row level security;
alter table public.recurring_contracts enable row level security;
alter table public.webhook_events enable row level security;
alter table public.request_idempotency enable row level security;
alter table public.rate_limits enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.workspace_invites enable row level security;
alter table public.client_companies enable row level security;
alter table public.saved_scenarios enable row level security;
alter table public.report_branding enable row level security;

-- Remove grants amplos. service_role/secret continua com privilegios de servidor.
revoke all on public.profiles from anon, authenticated;
revoke all on public.subscriptions from anon, authenticated;
revoke all on public.payments from anon, authenticated;
revoke all on public.entitlements from anon, authenticated;
revoke all on public.audit_logs from anon, authenticated;
revoke all on public.consent_events from anon, authenticated;
revoke all on public.recurring_contracts from anon, authenticated;
revoke all on public.webhook_events from anon, authenticated;
revoke all on public.request_idempotency from anon, authenticated;
revoke all on public.rate_limits from anon, authenticated;
revoke all on public.workspaces from anon, authenticated;
revoke all on public.workspace_members from anon, authenticated;
revoke all on public.workspace_invites from anon, authenticated;
revoke all on public.client_companies from anon, authenticated;
revoke all on public.saved_scenarios from anon, authenticated;
revoke all on public.report_branding from anon, authenticated;

-- Catalogo pode ser lido sem login, mas nunca pode ser alterado pelo navegador.
revoke insert, update, delete, truncate, references, trigger on public.plans from anon, authenticated;
revoke insert, update, delete, truncate, references, trigger on public.products from anon, authenticated;
grant select on public.plans to anon, authenticated;
grant select on public.products to anon, authenticated;

-- Usuario autenticado le apenas sua propria identidade e cobrancas.
grant select on public.profiles to authenticated;
grant select on public.subscriptions to authenticated;
grant select on public.payments to authenticated;
grant select on public.entitlements to authenticated;
grant select on public.workspace_members to authenticated;

-- consent_events fica fechado ao navegador. A UI atual armazena a preferência localmente;
-- qualquer persistência futura deve passar por endpoint autenticado e validado no servidor.

-- Remove TODAS as policies legadas das tabelas protegidas. Isso evita que uma policy
-- antiga sobreviva a uma migration e amplie leitura/escrita sem querer.
do $$
declare r record;
begin
  for r in
    select tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = any(array[
        'profiles','plans','subscriptions','payments','products','entitlements',
        'audit_logs','consent_events','recurring_contracts','webhook_events',
        'request_idempotency','rate_limits','workspaces','workspace_members',
        'workspace_invites','client_companies','saved_scenarios','report_branding'
      ])
  loop
    execute format('drop policy if exists %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

-- Recria SOMENTE as policies necessarias ao navegador. Admin le/muta via backend.
drop policy if exists "profile own read" on public.profiles;
create policy "profile own read" on public.profiles for select to authenticated using (id = auth.uid());

drop policy if exists "plans public read" on public.plans;
create policy "plans public read" on public.plans for select to anon, authenticated using (active = true);

drop policy if exists "products authenticated read" on public.products;
drop policy if exists "products public read" on public.products;
create policy "products public read" on public.products for select to anon, authenticated using (active = true);

drop policy if exists "subscriptions own read" on public.subscriptions;
create policy "subscriptions own read" on public.subscriptions for select to authenticated using (user_id = auth.uid());

drop policy if exists "payments own read" on public.payments;
create policy "payments own read" on public.payments for select to authenticated using (user_id = auth.uid());

drop policy if exists "entitlements own read" on public.entitlements;
create policy "entitlements own read" on public.entitlements for select to authenticated using (user_id = auth.uid());

drop policy if exists "workspace member own read" on public.workspace_members;
create policy "workspace member own read" on public.workspace_members for select to authenticated using (user_id = auth.uid() and active = true);

-- Nao ha policy de leitura publica para contratos recorrentes, webhooks, rate limit ou logs.
drop policy if exists "audit admin read" on public.audit_logs;

-- Nenhuma policy de escrita/leitura cliente em consent_events nesta release.
drop policy if exists "consent own insert" on public.consent_events;

-- SECURITY DEFINER sensiveis nao podem ser chamados pela chave publica.
revoke all on function public.cpf_already_registered(text) from public, anon, authenticated;
revoke all on function public.claim_cpf(uuid, text) from public, anon, authenticated;
revoke all on function public.cpf_belongs_to_user(uuid, text) from public, anon, authenticated;
revoke all on function public.consume_rate_limit(text, integer, integer) from public, anon, authenticated;

grant execute on function public.cpf_already_registered(text) to service_role;
grant execute on function public.claim_cpf(uuid, text) to service_role;
grant execute on function public.cpf_belongs_to_user(uuid, text) to service_role;
grant execute on function public.consume_rate_limit(text, integer, integer) to service_role;

-- A funcao legada is_admin deixa de ser uma superficie publica. Policies nao dependem dela.
do $$ begin
  revoke all on function public.is_admin() from public, anon, authenticated;
  grant execute on function public.is_admin() to service_role;
exception when undefined_function then null;
end $$;

-- Corrige qualquer assinatura ativa legada sem vencimento. Nao existe acesso vitalicio implicito.
update public.subscriptions
set expires_at = now() + interval '1 month', updated_at = now()
where status in ('active','past_due') and expires_at is null;

notify pgrst, 'reload schema';

select
  has_table_privilege('authenticated', 'public.payments', 'INSERT') = false as pagamentos_sem_insert_cliente,
  has_table_privilege('authenticated', 'public.subscriptions', 'UPDATE') = false as assinaturas_sem_update_cliente,
  has_table_privilege('authenticated', 'public.profiles', 'UPDATE') = false as perfil_sem_escalada_cliente,
  has_table_privilege('anon', 'public.consent_events', 'INSERT') = false as consentimento_sem_insert_publico,
  has_function_privilege('authenticated', 'public.claim_cpf(uuid,text)', 'EXECUTE') = false as rpc_cpf_fechada,
  to_regclass('public.rate_limits') is not null as rate_limit_ok;
