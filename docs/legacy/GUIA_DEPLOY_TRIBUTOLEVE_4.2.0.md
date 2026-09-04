# Guia de deploy completo — Tributo Leve v4.2.0

Domínio oficial: **https://tributoleve.com.br**

Este guia assume que você já possui: projeto Supabase, conta/aplicação Mercado Pago, projeto Netlify e o domínio `tributoleve.com.br` comprado na GoDaddy.

---

## 0. Antes de qualquer alteração

1. Faça backup do banco Supabase.
2. Não apague registros MX/TXT de e-mail na GoDaddy.
3. Não coloque chaves privadas em arquivos `VITE_*`.
4. Não publique a v4.1.0 depois de aplicar as migrations 4.2.0.

---

## 1. Atualizar o Supabase

### Caso A — seu banco já está na v4.1.0

1. Na pasta do projeto, execute:
   `8_ATUALIZAR_ASSINATURAS_CARTAO_4.2.0.bat`
2. O arquivo `supabase/APLICAR_4.2.0_COMPLETO.sql` será aberto.
3. Entre no Supabase > **SQL Editor** > **New query**.
4. Copie TODO o conteúdo do arquivo.
5. Cole no SQL Editor e clique em **Run**.
6. No resultado final, confirme `true` nas verificações de segurança.

Esse pacote executa, na ordem:
- `007_assinaturas_cartao_4.2.0.sql`
- `008_seguranca_hardening.sql`

### Caso B — banco novo

Execute sequencialmente:
1. `001_tributo_leve_saas.sql`
2. `002_corrigir_cadastro_cpf.sql`
3. `003_mercado_pago_orders.sql`
4. `004_modulos_funcionais.sql`
5. `005_rebrand_tributo_leve.sql`
6. `006_planos_periodicos_demo.sql`
7. `007_assinaturas_cartao_4.2.0.sql`
8. `008_seguranca_hardening.sql`

Não pule o 008.

### O que a 4.2 adiciona

- `recurring_contracts`
- campos de recorrência em `subscriptions`
- cartão/parcelas/metadados mascarados em `payments`
- `webhook_events`
- `request_idempotency`
- `rate_limits`
- RLS/grants/policies endurecidos
- revogação de RPCs sensíveis para chaves públicas

---

## 2. Supabase Auth — remover localhost e usar o domínio real

No Supabase:

1. Abra **Authentication > URL Configuration**.
2. Em **Site URL**, coloque exatamente:
   `https://tributoleve.com.br`
3. Em **Redirect URLs**, mantenha somente URLs que você realmente usa. Para produção, inclua as rotas necessárias em:
   - `https://tributoleve.com.br/**`
   - `https://www.tributoleve.com.br/**` se você aceitar o alias www
4. Se usar previews do Netlify durante desenvolvimento, adicione separadamente o padrão do seu projeto Netlify.
5. Remova `localhost` das URLs de produção se você não precisa dele em produção. Pode manter localhost apenas como redirect adicional de desenvolvimento.

A criação normal de conta desta release usa confirmação server-side, portanto o fluxo não deve depender de link de confirmação apontando para localhost.

---

## 3. Chaves Supabase

No Supabase > Project Settings/API Keys, identifique:

### Pode ir para o navegador
- Project URL
- Publishable key (`sb_publishable_...`)

### Somente Netlify Functions
- Secret key (`sb_secret_...`)

Configure no Netlify:

- `SUPABASE_URL=https://SEU_PROJETO.supabase.co`
- `VITE_SUPABASE_URL=https://SEU_PROJETO.supabase.co`
- `VITE_SUPABASE_ANON_KEY=sb_publishable_...`
- `SUPABASE_SECRET_KEY=sb_secret_...`

Nunca crie `VITE_SUPABASE_SECRET_KEY`.

---

## 4. Mercado Pago — credenciais de produção

Abra Mercado Pago Developers > **Suas integrações** > sua aplicação.

Use as credenciais de **produção** para o site final:

- Public Key -> `VITE_MERCADO_PAGO_PUBLIC_KEY`
- Access Token -> `MERCADO_PAGO_ACCESS_TOKEN`

O Access Token nunca deve aparecer no frontend.

### Como cada cobrança funciona

- Plano + cartão: `/preapproval` -> recorrência automática.
- Plano + PIX: Orders -> período manual.
- Plano + boleto: Orders -> período manual.
- Módulo + cartão: Orders -> compra única.
- Módulo + PIX/boleto: Orders -> compra única.

O preço não vem confiável do navegador: a Function consulta o preço atual no banco antes de criar a cobrança.

---

## 5. Mercado Pago — webhook

Na aplicação Mercado Pago, abra **Webhooks / Notificações**.

URL de produção:

`https://tributoleve.com.br/.netlify/functions/payment-webhook`

Habilite os eventos disponíveis equivalentes a:

- Orders
- Payments
- `subscription_preapproval`
- `subscription_authorized_payment`

Copie a **assinatura/chave secreta** do Webhook e configure no Netlify:

`MERCADO_PAGO_WEBHOOK_SECRET=...`

Não use uma URL antiga `.netlify.app` como webhook final depois de migrar o domínio, salvo temporariamente para testes.

O endpoint valida `x-signature`, `x-request-id` e o `data.id`, usa idempotência e consulta o recurso novamente no Mercado Pago.

---

## 6. Variáveis obrigatórias no Netlify

No painel Netlify > Site configuration > Environment variables > Production, confira:

```text
APP_URL=https://tributoleve.com.br
VITE_APP_URL=https://tributoleve.com.br
SUPABASE_URL=https://SEU_PROJETO.supabase.co
VITE_SUPABASE_URL=https://SEU_PROJETO.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_...
SUPABASE_SECRET_KEY=sb_secret_...
VITE_MERCADO_PAGO_PUBLIC_KEY=...
MERCADO_PAGO_ACCESS_TOKEN=...
MERCADO_PAGO_WEBHOOK_SECRET=...
```

O script `0_PUBLICAR_SITE.bat` chama `CONFIGURAR_CREDENCIAIS_NETLIFY.ps1` e ajuda a configurar/verificar essas variáveis.

---

## 7. Primeiro deploy da v4.2.0

No Windows:

1. Extraia o ZIP em uma pasta normal, por exemplo:
   `C:\Tributo-Leve-v4.2.0`
2. Abra a pasta.
3. Dê duplo clique em:
   `0_PUBLICAR_SITE.bat`
4. O script:
   - verifica Node/npm;
   - executa `npm ci` usando o `package-lock.json`;
   - valida login Netlify;
   - mantém/vincula o site;
   - configura variáveis Production;
   - executa o build;
   - publica `dist` + Netlify Functions em produção.
5. Se o build falhar, NÃO prossiga manualmente com um `dist` antigo. Corrija o erro apresentado.

O ZIP contém `.netlify/state.json` do projeto que já estava vinculado durante o desenvolvimento. Confira no `netlify status` se ele corresponde à sua conta/site antes do primeiro deploy.

---

## 8. Adicionar `tributoleve.com.br` no Netlify

Depois de ter um deploy válido:

### Opção automática
Execute:
`6_CONFIGURAR_DOMINIO_NETLIFY.bat`

### Opção manual
1. Netlify > seu site > **Domain management**.
2. Adicione `tributoleve.com.br` como domínio de produção.
3. Adicione/aceite `www.tributoleve.com.br` como alias.
4. Abra **Pending DNS verification**.
5. Use os valores EXATOS mostrados ali para configurar a GoDaddy.

---

## 9. GoDaddy DNS

Só faça isso depois de adicionar o domínio no Netlify.

Abra GoDaddy > `tributoleve.com.br` > **DNS**.

### Domínio raiz (`tributoleve.com.br`)

Para a rede padrão Netlify, quando o provedor não oferece ALIAS/ANAME/flattened CNAME no apex, o fallback documentado é:

```text
Tipo: A
Nome: @
Valor: 75.2.60.5
TTL: padrão/1 hora
```

Porém, se o Netlify mostrar um alvo diferente em **Pending DNS verification** (por exemplo, High-Performance Edge), use o valor mostrado pelo Netlify, não o fallback acima.

### `www.tributoleve.com.br`

Crie/edite:

```text
Tipo: CNAME
Nome: www
Valor: SEU-SITE-REAL.netlify.app
TTL: padrão/1 hora
```

Use o `.netlify.app` REAL do seu projeto, exatamente como o Netlify informar.

### Antes de salvar

- Remova apenas registros A/AAAA/CNAME conflitantes de `@` e `www`.
- Não remova MX/TXT usados por e-mail, SPF, DKIM ou verificações sem saber a finalidade.

DNS pode levar horas e, em alguns casos, até 48 horas para propagar globalmente.

---

## 10. HTTPS / certificado

Depois que o DNS estiver correto:

1. Volte ao Netlify > Domain management.
2. Aguarde a verificação DNS.
3. Confirme que o certificado HTTPS foi provisionado.
4. Teste:
   - `https://tributoleve.com.br`
   - `https://www.tributoleve.com.br`
5. Escolha `tributoleve.com.br` como domínio principal/canônico.

Não faça testes de cartão real antes de HTTPS estar válido.

---

## 11. Smoke test obrigatório antes de divulgar

### Conta/autenticação
1. Abra janela anônima.
2. Crie conta com CPF válido.
3. Confirme que CPF inválido é recusado.
4. Tente cadastrar o mesmo CPF em outra conta e confirme bloqueio.
5. Confirme que nenhum fluxo manda para localhost.

### PIX
1. Gere PIX para um plano.
2. Confirme que a conta não ativa apenas por gerar a cobrança.
3. Em ambiente de teste, aprove o pagamento.
4. Confirme ativação e `expires_at` real.

### Boleto
Repita o fluxo e confirme ativação somente após status aprovado.

### Cartão recorrente
1. Use credenciais/usuários de teste primeiro.
2. Assine Básico Mensal.
3. Confira `recurring_contracts` no Supabase.
4. Confira o contrato no Mercado Pago.
5. Abra **Minha assinatura**.
6. Confira próxima cobrança e cartão mascarado.
7. Troque o cartão com token de teste.
8. Cancele a renovação.
9. Confirme que o período já pago continua ativo até `expires_at`.

### Módulo no cartão
1. Compre um módulo.
2. Confirme que é uma Order de compra única, não `/preapproval`.
3. Confirme entitlement somente após pagamento aprovado.

### Segurança
1. Usuário comum chamando `admin-overview` deve receber 403.
2. Chamar Function com outro `userId` deve falhar.
3. Alterar preço no DevTools não muda o valor cobrado pelo backend.
4. Assinatura vencida não deve acessar só porque `profile.access_status=active` ficou antigo.
5. Colaborador deve perder capacidade de escrita quando o titular estiver vencido e sem tolerância.
6. Webhook com HMAC inválido deve ser rejeitado.
7. Reenvio do mesmo webhook não deve duplicar acesso/período.

---

## 12. Depois da publicação

- Mantenha backups do Supabase.
- Não compartilhe Access Token/Secret Key em prints ou repositórios.
- Ao trocar credenciais Mercado Pago, atualize Netlify Production e faça novo deploy se a Public Key mudar.
- Se trocar a Secret do webhook, atualize `MERCADO_PAGO_WEBHOOK_SECRET` imediatamente.
- Consulte logs de Functions para falhas de webhook, mas nunca adicione logs de token/cartão bruto.

---

## Arquivos importantes desta release

- `0_PUBLICAR_SITE.bat`
- `6_CONFIGURAR_DOMINIO_NETLIFY.bat`
- `8_ATUALIZAR_ASSINATURAS_CARTAO_4.2.0.bat`
- `supabase/APLICAR_4.2.0_COMPLETO.sql`
- `supabase/migrations/007_assinaturas_cartao_4.2.0.sql`
- `supabase/migrations/008_seguranca_hardening.sql`
- `SEGURANCA_4.2.0.md`
- `MERCADO_PAGO_ASSINATURAS.md`
- `CHECKLIST_DOMINIO_E_INTEGRACOES.md`
