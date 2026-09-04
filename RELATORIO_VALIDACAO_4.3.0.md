# Relatório de validação — Tributo Leve v4.3.0

Data: 04/09/2026

## Escopo concluído

- cadastro reorganizado para formulário à esquerda e planos à direita no desktop;
- fluxo mobile sem animação de cards vinculada ao viewport;
- campos de cartão reorganizados e labels reduzidos;
- páginas públicas, 404, rodapé, LGPD e centro de cookies estilizados;
- robots, sitemap, llms.txt e security.txt;
- meta description, canonical, Open Graph, Twitter e Schema.org;
- integração GA4 condicionada ao consentimento;
- suporte a Search Console por variável de verificação;
- presença autenticada e métrica “Online agora” no Admin;
- Turnstile + honeypot + rate limit para cadastro e login da aplicação;
- auditoria de endpoints, RLS/grants complementares na migration 010;
- documentação GitHub e CI;
- `.env.example` e política clara entre variáveis públicas e privadas;
- limpeza de referências específicas do projeto Supabase nos scripts históricos;
- preparação do repositório público sem `.env`, `.netlify`, `node_modules` ou `dist`.

## Testes executados neste ambiente

| Teste | Resultado |
|---|---|
| Parser TypeScript/TSX — 47 arquivos | OK |
| Motor tributário (`test-engine.js`) | OK |
| Verificação estrutural React — 13 grupos | OK |
| Varredura de segredos | OK |
| Auditoria de APIs | OK |
| Auditoria SEO | OK |
| Higiene do stage Git | OK |
| Hardcode do antigo project ref do Supabase | Nenhum encontrado |

## TypeScript/build Vite

A reinstalação completa de `node_modules` não terminou no container desta sessão por indisponibilidade/timeout do registry npm. As pastas parciais de `@types` ficaram sem conteúdo, portanto `tsc -b` não poderia produzir um resultado confiável aqui. A tentativa foi interrompida sem mascarar a falha.

A release inclui `11_VALIDAR_RELEASE_4.3.0.bat`, que executa na máquina de publicação:

1. `npm ci`;
2. `npm run quality`;
3. `npm run build`;
4. `npm run perf:budget`.

O próprio `0_PUBLICAR_SITE.bat` também executa o quality gate e cancela o deploy se qualquer validação falhar.

## Segurança de variáveis

### Podem aparecer no navegador

- `VITE_SUPABASE_URL`;
- `VITE_SUPABASE_ANON_KEY` / publishable key;
- `VITE_MERCADO_PAGO_PUBLIC_KEY`;
- `VITE_TURNSTILE_SITE_KEY`;
- IDs públicos de GA/Search Console;
- dados públicos do rodapé.

### Nunca podem aparecer no navegador/GitHub

- `SUPABASE_SECRET_KEY`;
- `MERCADO_PAGO_ACCESS_TOKEN`;
- `MERCADO_PAGO_WEBHOOK_SECRET`;
- `TURNSTILE_SECRET_KEY`.

Não há uso de `NEXT_PUBLIC_*` no código/configuração.

## Pendências externas, não de código

- criar/confirmar propriedade no Google Search Console e enviar o sitemap;
- informar o Measurement ID do GA4 no Netlify se ainda não estiver configurado;
- configurar as chaves do Turnstile em produção;
- Google Business Profile somente se a operação for elegível a atendimento presencial/área de serviço;
- Cloudflare WAF/rate limiting de borda é opcional e depende de conta/DNS Cloudflare; a aplicação já possui rate limit próprio e Turnstile.

## GitHub

A conta conectada é `DevGabriel2809`. Não existe atualmente um repositório `DevGabriel2809/Tributo-Leve`, e o conector disponível nesta sessão não oferece ação para criar um repositório novo. Por segurança, nenhum repositório existente e não relacionado foi sobrescrito.

Foi incluído `13_PUBLICAR_GITHUB_SEGURO.bat`, que valida segredos e usa GitHub CLI para criar/publicar `Tributo-Leve` quando executado em uma máquina autenticada.
