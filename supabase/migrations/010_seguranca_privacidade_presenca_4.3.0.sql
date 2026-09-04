-- TRIBUTO LEVE 4.3.0 - PRESENCA, PRIVACIDADE E HARDENING COMPLEMENTAR
-- Esta migration não altera preços, planos ou cobranças. Ela acrescenta apenas
-- estruturas operacionais usadas para presença online e reforça os grants.

create table if not exists public.user_presence (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  current_area text,
  last_seen_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists user_presence_last_seen_idx on public.user_presence(last_seen_at desc);

alter table public.user_presence enable row level security;
revoke all on public.user_presence from anon, authenticated;

-- Presença é escrita apenas pelo backend autenticado. O painel administrativo
-- também lê por backend, então nenhuma policy de cliente é necessária.
do $$
declare r record;
begin
  for r in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'user_presence'
  loop
    execute format('drop policy if exists %I on public.user_presence', r.policyname);
  end loop;
end $$;

-- Reforça que os registros de consentimento continuam fechados ao navegador.
revoke all on public.consent_events from anon, authenticated;
drop policy if exists "consent own insert" on public.consent_events;

-- A tabela de rate limit nunca deve ser consultável pela chave pública.
revoke all on public.rate_limits from anon, authenticated;

notify pgrst, 'reload schema';

select
  to_regclass('public.user_presence') is not null as presenca_ok,
  has_table_privilege('authenticated', 'public.user_presence', 'SELECT') = false as presenca_sem_leitura_cliente,
  has_table_privilege('authenticated', 'public.user_presence', 'INSERT') = false as presenca_sem_escrita_cliente,
  has_table_privilege('anon', 'public.consent_events', 'INSERT') = false as consentimento_fechado_ok;
