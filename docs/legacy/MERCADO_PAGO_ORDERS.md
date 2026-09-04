# Tributo Leve — Mercado Pago Orders API

O Tributo Leve usa Checkout Transparente com criação de cobrança no backend.

## Produção

Aplicação: **Tributo Leve**

Webhook:

`https://tributoleve.com.br/.netlify/functions/payment-webhook`

Evento: **Order (Mercado Pago)** — tópico `orders`.

## Credenciais

- Public Key: frontend/build (`VITE_MERCADO_PAGO_PUBLIC_KEY`)
- Access Token: apenas backend (`MERCADO_PAGO_ACCESS_TOKEN`)
- assinatura Webhook: apenas backend (`MERCADO_PAGO_WEBHOOK_SECRET`)

Nunca grave Access Token ou assinatura secreta no código, `.env.production` ou frontend.

## Orders

As novas cobranças usam:

- `processing_mode: automatic`
- PIX como `pix / bank_transfer`
- boleto como `boleto / ticket`
- `X-Idempotency-Key`
- `external_reference` técnico sem CPF/e-mail
- descrição comercial com a marca **Tributo Leve**

O webhook é configurado no painel da aplicação Mercado Pago; não é injetado no payload da Order.

## Mudança de domínio

Ao alterar o domínio público, atualize o Webhook no painel do Mercado Pago. Se o painel gerar uma nova assinatura secreta, atualize a variável Netlify antes do teste real.
