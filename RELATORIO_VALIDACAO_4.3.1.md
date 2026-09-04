# Relatório de validação — Tributo Leve v4.3.1

Patch sobre a v4.3.0, sem alteração de banco de dados.

## Alterações verificadas

- descrições comerciais dos planos reduzidas e centralizadas em `planBranding.ts`;
- cadastro desktop com maior largura útil para os três cards;
- layout mobile limitado ao viewport e sem overflow horizontal;
- hover/transform desativado em dispositivos touch;
- PWA usa apenas `beforeinstallprompt`, sem tutorial intermediário;
- captura do evento de instalação inicializada antes do React;
- regras explícitas do Netlify para todas as páginas públicas;
- alias `/simulador` com redirecionamento 301 para a URL canônica;
- geração de HTML público mantida para SEO;
- fallback 404 permanece com status HTTP 404 para URLs realmente inexistentes.

## Validações executadas no ambiente de revisão

- sintaxe TypeScript/TSX por transpile isolado: OK;
- `test-engine.js`: OK;
- `verify-project.js`: OK;
- scanner de segredos: OK;
- auditoria de APIs: OK;
- SEO check: OK;
- geração das páginas públicas: OK;
- `netlify.toml` parseado como TOML válido: OK.

O `npm ci` do ambiente de revisão não concluiu por indisponibilidade/timeout do registry. O publicador do projeto executa a instalação, o typecheck e o build definitivo na máquina de publicação antes do deploy.
