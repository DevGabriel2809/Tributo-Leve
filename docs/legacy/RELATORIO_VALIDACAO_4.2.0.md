# Tributo Leve v4.2.0 — Relatório de validação

## Estado da release

O código-fonte da v4.2.0 está completo no pacote, incluindo:

- planos Básico Mensal, Pro Mensal e Pro Trimestral;
- PIX e boleto para renovação manual;
- cartão para módulos via Orders API;
- assinaturas automáticas de planos via Mercado Pago `/preapproval`;
- página Minha Assinatura;
- atualização de cartão;
- cancelamento de recorrência preservando o período já pago;
- `past_due` e tolerância de 3 dias;
- webhooks `subscription_preapproval` e `subscription_authorized_payment`;
- `recurring_contracts`;
- painel administrativo de recorrência/inadimplência/MRR;
- hardening de banco, RLS, grants, rate limiting e idempotência;
- domínio de produção `https://tributoleve.com.br`;
- migrations 007 e 008 e SQL único `APLICAR_4.2.0_COMPLETO.sql`.

## Verificações executadas neste ambiente

### PASSOU

- `node test-engine.js` → **OK: engine scenarios reconciled**.
- `node verify-project.js` → **OK: React app validado com 13 grupos de campos rotulados**.
- revisão de presença dos novos arquivos de frontend/backend/migrations da 4.2.0.
- revisão de que credenciais privadas não estão em arquivos `VITE_*`.
- revisão do fluxo de `/preapproval`, Orders, HMAC de webhook, idempotência e compensação de assinatura órfã.

### NÃO FOI POSSÍVEL CONCLUIR NESTE AMBIENTE

`npm run typecheck` e `npm run build` não chegaram a compilar porque o `node_modules` intermediário disponível estava incompleto: diretórios de `@types/node`, `@types/react` e outros existiam vazios. Foi tentado `npm ci --ignore-scripts`, mas o acesso ao registry npm expirou por timeout neste ambiente.

Isso é uma limitação do ambiente de execução desta conversa, não um erro de TypeScript já identificado no código.

## Validação 100% no Work / máquina local

Na pasta do projeto, execute:

```powershell
npm ci
npm run typecheck
npm run build
node test-engine.js
node verify-project.js
```

Depois, com Netlify CLI:

```powershell
netlify dev
```

Teste cadastro, login, PIX, boleto, cartão de módulo, assinatura recorrente, troca de cartão, cancelamento, webhook e expiração/tolerância.

**Não faça deploy de produção se `npm run typecheck` ou `npm run build` falharem na sua máquina.**
