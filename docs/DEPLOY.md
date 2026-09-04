# Deploy v4.3.0

## 1. Banco

Se ainda não aplicada, execute `10_ATUALIZAR_SEGURANCA_PRESENCA_4.3.0.bat`, copie a migration 010 para o SQL Editor do Supabase e confirme as verificações finais.

## 2. Netlify

Execute `0_PUBLICAR_SITE.bat`. O publicador instala dependências, executa `npm run quality`, compila e só então publica.

Configure as variáveis usando o script interativo. Segredos não são gravados no repositório.

## 3. Search Console / GA / Turnstile

Preencha as variáveis públicas opcionais e publique novamente. Analytics respeita o consentimento LGPD.

## 4. Pós-deploy

- teste cadastro/login;
- teste plano recorrente, PIX/boleto e cancelamento;
- confira Functions sem 500;
- confira `/robots.txt`, `/sitemap.xml`, `/llms.txt` e `/.well-known/security.txt`;
- teste uma URL inexistente e confirme página 404 + HTTP 404;
- execute `12_TESTAR_PAGESPEED.bat`.
