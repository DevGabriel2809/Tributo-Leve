# Cloudflare gratuito e antiabuso

A aplicação já usa Cloudflare Turnstile sem exigir que o DNS seja migrado para Cloudflare.

## Camadas já ativas

- rate limit no backend para cadastro, login-guard e operações sensíveis;
- Turnstile no cadastro e login da interface;
- limites próprios do Supabase Auth;
- validação JWT + autorização local nas APIs.

## Proxy/WAF opcional

Caso o domínio seja futuramente transferido para DNS/proxy Cloudflare, faça a mudança de forma planejada para não quebrar Netlify/SSL. Depois, crie regras de rate limiting para `/.netlify/functions/login-guard`, `register-user`, `create-payment` e `create-subscription`, com limites conservadores e ação Managed Challenge/Block.

Não use uma regra agressiva global em todas as Functions: webhooks do Mercado Pago e tráfego legítimo precisam continuar funcionando.
