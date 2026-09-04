-- TRIBUTO LEVE 3.1.0
-- Migra a camada de cobranca para o Checkout Transparente via Orders API.
-- Nao apaga nem altera cobrancas antigas criadas pela Payments API.

alter table public.payments add column if not exists provider_order_id text;
alter table public.payments add column if not exists provider_transaction_id text;
alter table public.payments add column if not exists provider_api text not null default 'payments_v1';

update public.payments
set provider_api = 'payments_v1'
where provider_api is null or btrim(provider_api) = '';

create unique index if not exists payments_provider_order_id_unique
  on public.payments(provider_order_id)
  where provider_order_id is not null;

create index if not exists payments_provider_transaction_id_idx
  on public.payments(provider_transaction_id)
  where provider_transaction_id is not null;

comment on column public.payments.provider_order_id is 'ID ORD... retornado pelo Mercado Pago Orders API.';
comment on column public.payments.provider_transaction_id is 'ID PAY... da transacao dentro da order.';
comment on column public.payments.provider_api is 'orders_v1 para novas cobrancas; payments_v1 para legado.';

notify pgrst, 'reload schema';

select
  exists(select 1 from information_schema.columns where table_schema='public' and table_name='payments' and column_name='provider_order_id') as order_id_ok,
  exists(select 1 from information_schema.columns where table_schema='public' and table_name='payments' and column_name='provider_transaction_id') as transaction_id_ok,
  exists(select 1 from information_schema.columns where table_schema='public' and table_name='payments' and column_name='provider_api') as provider_api_ok;
