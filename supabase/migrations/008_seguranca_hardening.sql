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
