# Tributo Leve

Plataforma web para simulação e comparação de cenários da Reforma Tributária, com foco na transição de IBS/CBS, organização de cenários, memória de cálculo, carteira de clientes e relatórios.

**Site:** https://tributoleve.com.br

## Stack

- React 19 + TypeScript + Vite
- Tailwind CSS e componentes em `src/components/ui`
- Supabase Auth/Postgres com RLS
- Netlify Functions para operações privilegiadas
- Mercado Pago para PIX, boleto, cartão e assinaturas recorrentes
- Cloudflare Turnstile para mitigação de bots
- Google Analytics 4 condicionado ao consentimento LGPD

## Arquitetura resumida

O navegador usa somente chaves públicas. Toda operação que altera permissões, pagamentos, assinaturas, limites ou dados administrativos passa pelas Netlify Functions. O backend valida o JWT do Supabase e, em seguida, aplica autorização de recurso, papel, plano e vigência.

```text
Browser
  ├─ React/Vite
  ├─ Supabase Auth (chave pública)
  ├─ MercadoPago.js (Public Key)
  └─ Turnstile (Site Key)
        │
        ▼
Netlify Functions
  ├─ validação JWT
  ├─ autorização / rate limit
  ├─ Supabase Secret Key
  └─ Mercado Pago Access Token
        │
        ├─ Supabase/Postgres + RLS
        └─ Mercado Pago APIs/Webhooks
```

Mais detalhes: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) e [`SECURITY.md`](SECURITY.md).

## Desenvolvimento

Requisitos: Node.js LTS e npm.

```bash
npm ci
npm run dev
```

Validação completa:

```bash
npm run quality
npm run build
npm run perf:budget
```

## Variáveis de ambiente

Copie `.env.example` apenas para desenvolvimento local. Nunca versionar `.env`.

Variáveis `VITE_*` são públicas por definição porque entram no bundle do navegador. Segredos usam nomes sem `VITE_` e existem apenas no ambiente das Functions.

Consulte [`docs/ENVIRONMENT.md`](docs/ENVIRONMENT.md).

## SEO, indexação e privacidade

O projeto inclui:

- `robots.txt`
- `sitemap.xml`
- `llms.txt`
- `/.well-known/security.txt`
- metadados Open Graph/Twitter/canonical
- Schema.org
- páginas públicas pré-geradas
- Política de Privacidade, LGPD e Termos
- Google Analytics somente após consentimento

Configuração: [`docs/SEO-ANALYTICS.md`](docs/SEO-ANALYTICS.md).

## Segurança

A aplicação não armazena senhas em texto puro. Credenciais de usuário são gerenciadas pelo Supabase Auth. Dados completos de cartão e CVV são tokenizados pelo Mercado Pago e não passam pelo backend do Tributo Leve.

O repositório possui uma verificação automática para impedir publicação de segredos ou variáveis públicas com nomes perigosos:

```bash
npm run security:scan
```

Divulgação responsável: [`SECURITY.md`](SECURITY.md).

## Deploy

Produção usa Netlify + Supabase + Mercado Pago. Para a v4.3.1, a migration `010` só precisa ser aplicada se ainda não tiver sido executada na implantação da v4.3.0.

No Windows:

```text
10_ATUALIZAR_SEGURANCA_PRESENCA_4.3.0.bat
0_PUBLICAR_SITE.bat
```

Depois valide o PageSpeed:

```text
12_TESTAR_PAGESPEED.bat
```

Guia completo: [`docs/DEPLOY.md`](docs/DEPLOY.md).

## Estrutura

```text
src/                 aplicação React
netlify/functions/   backend serverless
supabase/migrations/ banco e hardening
public/              SEO, PWA e arquivos públicos
scripts/             qualidade, SEO e segurança
docs/                documentação técnica
.github/workflows/   CI
```

## Licença e uso

Projeto proprietário. O código publicado serve como portfólio técnico e referência do produto. O uso comercial, redistribuição ou implantação por terceiros depende de autorização do titular.
