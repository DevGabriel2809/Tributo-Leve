# Mercado Pago — assinaturas automáticas — Tributo Leve v4.2.0

## Arquitetura

Os preços continuam administrados no banco/Admin do Tributo Leve. A criação do contrato recorrente usa `/preapproval` com `auto_recurring` e cartão tokenizado, sem confiar em preço enviado pelo navegador.

- Básico Mensal: frequência 1 mês.
- Pro Mensal: frequência 1 mês.
- Pro Trimestral: frequência 3 meses.

A Public Key é usada no navegador para tokenização. O Access Token fica somente nas Netlify Functions.

## Webhooks

URL:
`https://tributoleve.com.br/.netlify/functions/payment-webhook`

Eventos esperados:
- `subscription_preapproval`
- `subscription_authorized_payment`
- eventos de Order/Payment usados pelas compras avulsas

A Function valida a assinatura HMAC, aplica idempotência e consulta o recurso novamente no Mercado Pago antes de conceder acesso.

## Cobrança recusada

Uma parcela recusada move o contrato para `past_due`. Quando existe período anteriormente pago, o sistema concede até 3 dias de tolerância. A tolerância não transforma uma primeira cobrança nunca aprovada em acesso grátis.

## Cancelamento

Cancelar a renovação atualiza o contrato do Mercado Pago para `canceled`, mas não remove o período já pago no Tributo Leve. O acesso termina na data vigente.

## Troca de cartão

O navegador gera um novo token com MercadoPago.js/CardForm. A Function envia apenas o token ao `/preapproval/{id}`. Número completo e CVV não são persistidos no banco do Tributo Leve.
