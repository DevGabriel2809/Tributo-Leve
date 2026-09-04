-- TRIBUTO LEVE 4.0.0
-- MODULOS FUNCIONAIS: CARTEIRA, RELATORIO EXECUTIVO E EQUIPE

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references public.profiles(id) on delete cascade,
  name text not null default 'Meu escritório',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'editor' check (role in ('owner','editor','viewer')),
  active boolean not null default true,
  joined_at timestamptz not null default now(),
  unique (workspace_id, user_id)
);

create index if not exists workspace_members_user_idx on public.workspace_members(user_id) where active = true;

create table if not exists public.workspace_invites (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  invited_email text not null,
  role text not null default 'editor' check (role in ('editor','viewer')),
  token uuid not null unique default gen_random_uuid(),
  created_by uuid references public.profiles(id) on delete set null,
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists workspace_invites_workspace_idx on public.workspace_invites(workspace_id, created_at desc);
create index if not exists workspace_invites_email_idx on public.workspace_invites(lower(invited_email));

create table if not exists public.client_companies (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  cnpj text not null,
  notes text not null default '',
  tag text not null default '',
  active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, cnpj)
);

create index if not exists client_companies_workspace_idx on public.client_companies(workspace_id, updated_at desc);

create table if not exists public.saved_scenarios (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  client_id uuid not null references public.client_companies(id) on delete cascade,
  created_by uuid references public.profiles(id) on delete set null,
  name text not null,
  state jsonb not null,
  saved_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists saved_scenarios_workspace_idx on public.saved_scenarios(workspace_id, saved_at desc);
create index if not exists saved_scenarios_client_idx on public.saved_scenarios(client_id, saved_at desc);

create table if not exists public.report_branding (
  workspace_id uuid primary key references public.workspaces(id) on delete cascade,
  office_name text not null default '',
  responsible_name text not null default '',
  contact_line text not null default '',
  footer_text text not null default '',
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

-- Cria um workspace para contas existentes. O modulo de equipe passa a compartilhar
-- a licença e os dados do titular deste workspace.
insert into public.workspaces (owner_id, name)
select p.id, coalesce(nullif(p.full_name, ''), 'Meu escritório')
from public.profiles p
on conflict (owner_id) do nothing;

insert into public.workspace_members (workspace_id, user_id, role, active)
select w.id, w.owner_id, 'owner', true
from public.workspaces w
on conflict (workspace_id, user_id) do update set role = 'owner', active = true;

alter table public.profiles add column if not exists active_workspace_id uuid references public.workspaces(id) on delete set null;

update public.profiles p
set active_workspace_id = w.id
from public.workspaces w
where w.owner_id = p.id and p.active_workspace_id is null;

-- Atualiza as descrições para deixar claro o valor funcional de cada módulo.
update public.products
set description = 'Gerencie até 100 CNPJs, organize clientes e mantenha cenários separados por empresa.'
where slug = 'carteira-clientes';

update public.products
set description = 'Gere um relatório executivo profissional, com capa, comparativos, transição, memória técnica e marca do escritório.'
where slug = 'relatorio-executivo';

update public.products
set description = 'Adicione até 3 colaboradores ao workspace, com perfis de edição ou consulta e acesso compartilhado à operação.'
where slug = 'colaboradores';

-- As tabelas são manipuladas pelas Netlify Functions com chave secreta.
-- O cliente autenticado não recebe escrita direta nessas tabelas.
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.workspace_invites enable row level security;
alter table public.client_companies enable row level security;
alter table public.saved_scenarios enable row level security;
alter table public.report_branding enable row level security;

-- Leitura mínima de membership é necessária para a sessão do colaborador.
drop policy if exists "workspace member own read" on public.workspace_members;
create policy "workspace member own read" on public.workspace_members
  for select to authenticated using (user_id = auth.uid() and active = true);

-- O restante fica somente no backend privilegiado.
revoke all on public.workspaces from anon, authenticated;
revoke all on public.workspace_members from anon, authenticated;
revoke all on public.workspace_invites from anon, authenticated;
revoke all on public.client_companies from anon, authenticated;
revoke all on public.saved_scenarios from anon, authenticated;
revoke all on public.report_branding from anon, authenticated;

grant select on public.workspace_members to authenticated;

notify pgrst, 'reload schema';

-- TESTES RAPIDOS. AO FINAL, AS COLUNAS DEVEM RETORNAR TRUE.
select
  to_regclass('public.workspaces') is not null as workspaces_ok,
  to_regclass('public.client_companies') is not null as carteira_ok,
  to_regclass('public.saved_scenarios') is not null as cenarios_ok,
  to_regclass('public.workspace_members') is not null as equipe_ok,
  to_regclass('public.report_branding') is not null as relatorio_ok;

-- ============================================================
-- REBRAND TRIBUTO LEVE 4.0.0
-- Esta secao e segura para bancos que ja executaram a migration 004.
-- ============================================================

update public.plans
set active = true
where slug in ('basico-mensal','pro-mensal','pro-trimestral','essencial');

update public.products
set
  name = case slug
    when 'carteira-clientes' then 'Carteira de clientes'
    when 'relatorio-executivo' then 'Relatorio executivo'
    when 'colaboradores' then 'Equipe adicional'
    else name
  end,
  description = case slug
    when 'carteira-clientes' then 'Amplia o Tributo Leve para multiplos CNPJs, cenarios separados e visao consolidada da carteira.'
    when 'relatorio-executivo' then 'Gera relatorio profissional do Tributo Leve com marca, resumo executivo, comparativos, graficos e memoria tecnica.'
    when 'colaboradores' then 'Libera colaboradores no workspace do Tributo Leve, com permissoes de edicao ou consulta.'
    else description
  end,
  active = true
where slug in ('carteira-clientes', 'relatorio-executivo', 'colaboradores');

-- Nomes personalizados nunca sao sobrescritos. Apenas branding vazio recebe a nova marca.
update public.report_branding
set
  office_name = 'Tributo Leve',
  updated_at = now()
where trim(office_name) = '';

notify pgrst, 'reload schema';

-- TESTE FINAL DA MIGRACAO 4.0.0. AS COLUNAS DEVEM RETORNAR TRUE.
select
  exists (
    select 1 from public.plans
    where slug in ('basico-mensal','essencial')
  ) as plano_tributo_leve_ok,
  not exists (
    select 1 from public.products
    where slug in ('carteira-clientes', 'relatorio-executivo', 'colaboradores')
      and description not ilike '%Tributo Leve%'
  ) as modulos_tributo_leve_ok,
  to_regclass('public.report_branding') is not null as branding_relatorio_ok;
