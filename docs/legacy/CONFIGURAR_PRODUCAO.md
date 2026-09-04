# Configuração de produção — Tributo Leve v4.2.0

Use o arquivo `GUIA_DEPLOY_TRIBUTOLEVE_4.2.0.md` como fonte principal. Este arquivo é o resumo operacional.

## Variáveis Netlify — Production

Públicas/build:
- `APP_URL=https://tributoleve.com.br`
- `VITE_APP_URL=https://tributoleve.com.br`
- `SUPABASE_URL=https://SEU_PROJETO.supabase.co`
- `VITE_SUPABASE_URL=https://SEU_PROJETO.supabase.co`
- `VITE_SUPABASE_ANON_KEY=sb_publishable_...`
- `VITE_MERCADO_PAGO_PUBLIC_KEY=...`

Privadas, somente servidor:
- `SUPABASE_SECRET_KEY=sb_secret_...`
- `MERCADO_PAGO_ACCESS_TOKEN=...`
- `MERCADO_PAGO_WEBHOOK_SECRET=...`

Nunca crie `VITE_SUPABASE_SECRET_KEY`, `VITE_MERCADO_PAGO_ACCESS_TOKEN` ou equivalente.

## Supabase

- Upgrade v4.1 -> v4.2: execute `supabase/APLICAR_4.2.0_COMPLETO.sql`.
- Auth Site URL: `https://tributoleve.com.br`.
- RLS deve permanecer habilitado.
- O navegador só recebe leitura própria/mínima; mutações sensíveis passam pelas Functions.

## Mercado Pago

Webhook de produção:
`https://tributoleve.com.br/.netlify/functions/payment-webhook`

Habilite notificações de pagamentos/orders e de assinaturas, incluindo `subscription_preapproval` e `subscription_authorized_payment`.

## Publicação

No Windows, execute `0_PUBLICAR_SITE.bat`. Ele usa `npm ci`, compila a aplicação e publica site + Functions no Netlify.
