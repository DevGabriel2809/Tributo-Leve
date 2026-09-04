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
