# Checklist — domínio e integrações — v4.2.0

## Supabase
- [ ] Backup feito antes da migration.
- [ ] 007 aplicado.
- [ ] 008 hardening aplicado.
- [ ] Testes finais do SQL retornaram `true`.
- [ ] Site URL = `https://tributoleve.com.br`.
- [ ] Redirect URLs de produção cadastradas.
- [ ] `SUPABASE_SECRET_KEY` existe apenas no backend/Netlify.

## Mercado Pago
- [ ] Public Key de produção cadastrada em `VITE_MERCADO_PAGO_PUBLIC_KEY`.
- [ ] Access Token de produção cadastrado em `MERCADO_PAGO_ACCESS_TOKEN`.
- [ ] Webhook = `https://tributoleve.com.br/.netlify/functions/payment-webhook`.
- [ ] Chave HMAC cadastrada em `MERCADO_PAGO_WEBHOOK_SECRET`.
- [ ] Order/Payments habilitados.
- [ ] `subscription_preapproval` habilitado.
- [ ] `subscription_authorized_payment` habilitado.
- [ ] Teste de cartão realizado com ambiente/usuários de teste antes de cobrança real.

## Netlify
- [ ] Site correto vinculado em `.netlify/state.json`.
- [ ] Variáveis Production configuradas.
- [ ] Build concluído sem erro.
- [ ] Functions publicadas.
- [ ] `tributoleve.com.br` adicionado a Domain management.
- [ ] `www.tributoleve.com.br` adicionado/alias.
- [ ] HTTPS/SSL provisionado.

## GoDaddy
- [ ] Nenhum registro conflitante para `@` ou `www`.
- [ ] Apex `@` aponta para o destino indicado pelo Netlify (fallback padrão A `75.2.60.5` se aplicável).
- [ ] `www` CNAME aponta para o `.netlify.app` real do projeto.
- [ ] MX/TXT de e-mail preservados.

## Smoke test final
- [ ] Home e demo abrem.
- [ ] Cadastro aceita CPF válido e rejeita CPF inválido/repetido.
- [ ] Login funciona sem redirect para localhost.
- [ ] PIX é criado e só ativa após aprovação real.
- [ ] Boleto é criado e só ativa após aprovação real.
- [ ] Cartão de plano cria recorrência.
- [ ] Cartão de módulo não cria recorrência.
- [ ] Minha assinatura mostra cartão apenas mascarado.
- [ ] Troca de cartão funciona.
- [ ] Cancelar renovação mantém o período já pago.
- [ ] Conta vencida perde acesso quando não há tolerância válida.
- [ ] Colaborador não consegue escrever com plano do titular vencido.
- [ ] Usuário normal não acessa ações Admin chamando Function diretamente.
