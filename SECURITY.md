# Segurança

## Reporte responsável

Encontrou uma vulnerabilidade? Use o canal indicado em https://tributoleve.com.br/seguranca e em `/.well-known/security.txt`.

Não publique detalhes exploráveis antes da correção, não acesse dados de terceiros e não realize testes destrutivos ou de indisponibilidade.

## Controles relevantes

- autenticação Supabase Auth;
- autorização de recurso/papel no servidor;
- RLS e grants mínimos;
- rate limiting persistente para endpoints sensíveis;
- Cloudflare Turnstile no cadastro e login da aplicação;
- limite de body e validação de origem nas operações mutáveis;
- HMAC e idempotência nos webhooks;
- preço/plano relidos do banco pelo backend;
- segredo do Supabase e tokens do Mercado Pago somente no servidor;
- dados de cartão tokenizados pelo Mercado Pago;
- varredura de credenciais antes de build/deploy/CI.

## Senhas

O Tributo Leve não mantém coluna de senha na tabela de perfis. Senhas são processadas e armazenadas pelo Supabase Auth com mecanismo de hash apropriado do provedor; não são registradas em texto puro pela aplicação.

## Arquivos que nunca devem ser versionados

`.env`, `.netlify/`, `node_modules/`, `dist/`, logs, tokens, dumps e credenciais privadas.
