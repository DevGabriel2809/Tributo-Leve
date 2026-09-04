# Arquitetura

## Fronteiras de confiança

O frontend nunca concede autoridade. Ele solicita uma operação; a Function autentica, consulta o estado real no banco e decide se a ação é permitida.

### Frontend

Pode conhecer URL/chave pública do Supabase, Public Key do Mercado Pago, Site Key do Turnstile e IDs públicos de Analytics/Search Console. Não pode conhecer `SUPABASE_SECRET_KEY`, Access Token do Mercado Pago, segredo HMAC de webhook ou Secret Key do Turnstile.

### Backend

As Netlify Functions concentram operações privilegiadas. Rotas autenticadas validam o bearer token no Supabase Auth e depois validam titularidade, papel, vigência da assinatura, limites e permissões.

### Banco

RLS permanece habilitado. Tabelas sensíveis não concedem escrita direta ao papel `authenticated`; as mutações privilegiadas usam o cliente de servidor.

### Pagamentos

- Planos recorrentes: Mercado Pago `/preapproval`.
- PIX/boleto: renovação por período.
- Módulos: compra única.
- Webhook: HMAC, idempotência e conferência de valor antes de liberar acesso.

### Presença

O frontend autenticado envia heartbeat para a Function `presence`. A tabela `user_presence` não é gravável pelo navegador. O Admin lê usuários ativos pelo backend.
