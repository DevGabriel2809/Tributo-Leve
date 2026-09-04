-- TRIBUTO LEVE - CORRECAO ISOLADA DO CADASTRO/CPF
-- Pode ser executada sobre um banco ja criado sem alterar precos, pagamentos ou usuarios.

create extension if not exists pgcrypto;

alter table public.profiles add column if not exists cpf_hash text;
alter table public.profiles add column if not exists cpf_last4 text;
create unique index if not exists profiles_cpf_hash_unique
  on public.profiles(cpf_hash)
  where cpf_hash is not null;

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

create or replace function public.claim_cpf(p_user_id uuid, p_cpf text) returns void
language plpgsql security definer
set search_path = public, private, pg_catalog
as $$
begin
  if p_cpf !~ '^[0-9]{11}$' then
    raise exception using errcode = '22023', message = 'invalid cpf';
  end if;

  begin
    update public.profiles
    set cpf_hash = private.hash_cpf(p_cpf),
        cpf_last4 = right(p_cpf, 4),
        updated_at = now()
    where id = p_user_id and cpf_hash is null;
  exception when unique_violation then
    raise exception using errcode = '23505', message = 'cpf already registered';
  end;

  if not found then
    raise exception using errcode = 'P0002', message = 'profile unavailable';
  end if;
end;
$$;

create or replace function public.cpf_belongs_to_user(p_user_id uuid, p_cpf text) returns boolean
language sql stable security definer
set search_path = public, private, pg_catalog
as $$
  select exists (
    select 1
    from public.profiles
    where id = p_user_id
      and cpf_hash = private.hash_cpf(p_cpf)
  );
$$;

-- Mantemos a funcao de consulta apenas para compatibilidade com builds anteriores.
create or replace function public.cpf_already_registered(p_cpf text) returns boolean
language sql stable security definer
set search_path = public, private, pg_catalog
as $$
  select exists (
    select 1
    from public.profiles
    where cpf_hash = private.hash_cpf(p_cpf)
  );
$$;

revoke all on function public.claim_cpf(uuid, text) from public, anon, authenticated;
revoke all on function public.cpf_belongs_to_user(uuid, text) from public, anon, authenticated;
revoke all on function public.cpf_already_registered(text) from public, anon, authenticated;

grant execute on function public.claim_cpf(uuid, text) to service_role;
grant execute on function public.cpf_belongs_to_user(uuid, text) to service_role;
grant execute on function public.cpf_already_registered(text) to service_role;

-- Forca o PostgREST a atualizar o cache de schema para reconhecer as RPCs agora.
notify pgrst, 'reload schema';

select
  to_regprocedure('public.claim_cpf(uuid,text)') is not null as claim_cpf_ok,
  to_regprocedure('public.cpf_belongs_to_user(uuid,text)') is not null as cpf_belongs_ok,
  to_regprocedure('public.cpf_already_registered(text)') is not null as cpf_check_ok;
