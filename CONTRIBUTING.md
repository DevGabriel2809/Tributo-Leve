# Contribuindo

Este repositório representa um produto em produção. Mudanças devem preservar compatibilidade com o banco e as integrações externas.

## Antes de abrir uma mudança

1. crie uma branch curta;
2. não inclua credenciais ou `.env`;
3. rode `npm ci`;
4. rode `npm run quality`;
5. rode `npm run build` e `npm run perf:budget`;
6. descreva alterações de banco e variáveis de ambiente no PR.

## Código

Comentários devem explicar decisões, invariantes e integrações não óbvias. Evite comentários que apenas repetem a linha seguinte.

## Banco

Migrations são incrementais e não devem apagar usuários ou recriar produção sem necessidade. Mudanças de autorização precisam revisar RLS e grants.
