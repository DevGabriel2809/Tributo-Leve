-- TRIBUTO LEVE 4.1.0 - PLANOS MENSAIS/TRIMESTRAL
-- Mantem o mesmo Supabase e converte o plano antigo em Basico Mensal.

alter table public.plans add column if not exists billing_months integer not null default 1;
alter table public.plans add column if not exists company_limit integer not null default 1;
alter table public.plans add column if not exists included_features text[] not null default '{}'::text[];
alter table public.plans add column if not exists badge text;
alter table public.plans add column if not exists recommended boolean not null default false;
alter table public.plans add column if not exists sort_order integer not null default 100;

-- Preserva o id do plano anterior para nao quebrar assinaturas existentes.
update public.plans
set slug = 'basico-mensal',
    name = 'Leve Start',
    description = 'Tudo o que voce precisa para comecar a simular com seguranca em 1 CNPJ.',
    price_cents = 4990,
    billing_months = 1,
    company_limit = 1,
    included_features = '{}',
    badge = 'COMECE AQUI',
    recommended = false,
    sort_order = 10,
    active = true
where slug = 'essencial';

insert into public.plans (slug, name, description, price_cents, billing_months, company_limit, included_features, badge, recommended, sort_order, active)
values
  ('basico-mensal', 'Leve Start', 'Tudo o que voce precisa para comecar a simular com seguranca em 1 CNPJ.', 4990, 1, 1, '{}', 'COMECE AQUI', false, 10, true),
  ('pro-mensal', 'Leve Pro', 'Mais espaco para uma operacao compacta, com ate 4 CNPJs e carteira integrada.', 8990, 1, 4, '{portfolio}', 'PARA CRESCER', false, 20, true),
  ('pro-trimestral', 'Leve Prime', 'A experiencia mais completa: 3 meses, ate 4 CNPJs e Relatorio Executivo incluido.', 23970, 3, 4, '{portfolio,executive_report}', 'MELHOR ESCOLHA', true, 30, true)
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  billing_months = excluded.billing_months,
  company_limit = excluded.company_limit,
  included_features = excluded.included_features,
  badge = excluded.badge,
  recommended = excluded.recommended,
  sort_order = excluded.sort_order,
  active = true;


-- Contas ja ativas recebem 30 dias a partir desta migracao caso ainda fossem vitalicias.
update public.subscriptions
set expires_at = now() + interval '1 month', updated_at = now()
where status = 'active' and expires_at is null;

-- Se por algum motivo ainda sobrou um plano legado duplicado, desativa sem apagar historico.
update public.plans set active = false where slug = 'essencial';

select
  exists(select 1 from public.plans where slug='basico-mensal' and active) as basico_ok,
  exists(select 1 from public.plans where slug='pro-mensal' and active) as pro_mensal_ok,
  exists(select 1 from public.plans where slug='pro-trimestral' and active) as pro_trimestral_ok,
  exists(select 1 from information_schema.columns where table_schema='public' and table_name='plans' and column_name='company_limit') as limites_ok;
