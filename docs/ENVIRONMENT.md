# Variáveis de ambiente

## Públicas

Variáveis `VITE_*` são substituídas no build e podem ser inspecionadas no navegador. Isso é esperado apenas para valores publicáveis:

- `VITE_APP_URL`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY` / publishable key
- `VITE_MERCADO_PAGO_PUBLIC_KEY`
- `VITE_TURNSTILE_SITE_KEY`
- `VITE_GA_MEASUREMENT_ID`
- `VITE_GOOGLE_SITE_VERIFICATION`
- dados públicos de contato/rodapé

Portanto, pesquisar por `KEY` no bundle pode mostrar **Public Key**, **Site Key** e publishable key. Isso não é vazamento de segredo.

## Privadas

Nunca devem aparecer no bundle, HTML, GitHub ou logs:

- `SUPABASE_SECRET_KEY`
- `MERCADO_PAGO_ACCESS_TOKEN`
- `MERCADO_PAGO_WEBHOOK_SECRET`
- `TURNSTILE_SECRET_KEY`

O projeto proíbe `NEXT_PUBLIC_*` e falha a auditoria se encontrar segredo em prefixo `VITE_*`.
