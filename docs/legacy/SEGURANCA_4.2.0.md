# Segurança — Tributo Leve v4.2.0

## Princípio de autorização

O frontend solicita; o backend decide. Nenhum `role`, `admin`, `access_status`, preço, plano, módulo, limite de CNPJ ou userId arbitrário enviado pelo navegador concede autoridade.

## Controles implementados

- JWT Supabase validado nas Functions autenticadas.
- `requireAdmin()` server-side para ações administrativas.
- `SUPABASE_SECRET_KEY` apenas no servidor.
- RLS habilitado em tabelas sensíveis.
- Grants de `anon`/`authenticated` reduzidos ao mínimo.
- Policies antigas são removidas durante o hardening e apenas as policies necessárias são recriadas.
- Nenhuma escrita cliente em pagamentos, assinaturas, recorrências, perfis, workspaces, entitlements, webhooks, rate-limit ou consent logs.
- RPCs de CPF, rate limit e `is_admin()` revogadas de `anon`/`authenticated`.
- CPF validado no backend e reivindicação atômica evita duplicação.
- Vigência real (`expires_at`) é obrigatória para acesso normal; `access_status=active` isolado não basta.
- `past_due` só autoriza durante `grace_until` válido.
- Colaboradores herdam a vigência do workspace titular; não conseguem escrever quando ela termina.
- `previewEssential`/preview administrativo é verificado por role no servidor.
- Rate limiting persistido no Supabase.
- Limite de payload em endpoints mutáveis.
- Verificação de origem como defesa adicional; JWT continua sendo a fronteira de autenticação.
- HMAC no webhook Mercado Pago.
- Idempotência para webhook, pagamentos e criação de assinatura.
- Valor aprovado no provedor é comparado ao `amount_cents` salvo no banco antes de liberar acesso.
- Falha de persistência após criar recorrência executa cancelamento compensatório no Mercado Pago.
- Exclusão/bloqueio administrativo cancela recorrência primeiro; se o cancelamento crítico falhar, a exclusão não prossegue.
- Cartão completo/CVV não são enviados ao backend nem armazenados; somente token e metadados mascarados.
- Logs não armazenam Access Token, Secret Key nem payload bruto de cartão.

## Verificações pós-migration

O final de `008_seguranca_hardening.sql` testa explicitamente a ausência de INSERT cliente em pagamentos, UPDATE cliente em assinaturas/perfil, INSERT público em consentimento e EXECUTE cliente da RPC de CPF.
