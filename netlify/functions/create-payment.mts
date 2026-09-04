import type { Config } from "@netlify/functions"
import { activeSubscription, assertBodySize, assertTrustedOrigin, authenticatedUser, db, enforceRateLimit, HttpError, json, safeError, validCpf } from "./_shared.ts"
import { mercadoPagoError, mercadoPagoRequest, orderPaymentView, type PaymentMethod } from "./_mercado_pago.ts"

type AddressInput = { zipCode?: string; streetName?: string; streetNumber?: string; neighborhood?: string; city?: string; state?: string }
type CreatePaymentBody = {
  userId?: string
  plan?: string
  planSlug?: string
  productSlug?: string
  method?: PaymentMethod
  name?: string
  cpf?: string
  address?: AddressInput
  cardToken?: string
  paymentMethodId?: string
  installments?: number
  deviceId?: string
  idempotencyKey?: string
}

function normalizeAddress(address?: AddressInput) {
  return {
    zip_code: String(address?.zipCode || "").replace(/\D/g, "").slice(0, 8),
    street_name: String(address?.streetName || "").trim(),
    street_number: String(address?.streetNumber || "").trim() || "S/N",
    neighborhood: String(address?.neighborhood || "").trim(),
    city: String(address?.city || "").trim(),
    state: String(address?.state || "").replace(/[^a-zA-Z]/g, "").toUpperCase().slice(0, 2)
  }
}
function validateBoletoAddress(address: ReturnType<typeof normalizeAddress>) {
  if (address.zip_code.length !== 8) return "Informe um CEP válido com 8 dígitos."
  if (!address.street_name || !address.neighborhood || !address.city || address.state.length !== 2) return "Complete o endereço do pagador."
  return ""
}
function splitName(fullName?: string) {
  const parts = String(fullName || "Cliente").trim().split(/\s+/).filter(Boolean)
  if (parts.length <= 1) return { firstName: parts[0] || "Cliente", lastName: parts[0] || "Tributo Leve" }
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") }
}
function validUuid(value: string) { return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value) }

export default async (request: Request) => {
  if (request.method !== "POST") return json({ error: "Método não permitido" }, 405)
  try {
    assertBodySize(request, 64 * 1024)
    assertTrustedOrigin(request)
    const signedIn = await authenticatedUser(request)
    if (!signedIn?.id || !signedIn.email) throw new HttpError(401, "Sessão inválida.")
    await enforceRateLimit(request, "create-payment", signedIn.id, 10, 10 * 60)

    const body = await request.json() as CreatePaymentBody
    if (body.userId !== signedIn.id) throw new HttpError(403, "Usuário da cobrança não corresponde à sessão.")
    const method = body.method
    if (!method || !["pix", "boleto", "card"].includes(method)) throw new HttpError(400, "Meio de pagamento inválido.")
    if (method === "card" && !body.productSlug) throw new HttpError(400, "Planos no cartão usam renovação automática. Use a opção Assinar no cartão.")

    const cpf = String(body.cpf || "").replace(/\D/g, "")
    if (!validCpf(cpf)) throw new HttpError(400, "Informe um CPF válido.")
    const cpfMatches = await db("rpc/cpf_belongs_to_user", { method: "POST", body: JSON.stringify({ p_user_id: signedIn.id, p_cpf: cpf }) })
    if (cpfMatches !== true) throw new HttpError(409, "O CPF informado não corresponde ao cadastro desta conta.")

    const requestedPlan = String(body.planSlug || body.plan || "basico-mensal").trim() || "basico-mensal"
    const items = body.productSlug
      ? await db(`products?slug=eq.${encodeURIComponent(body.productSlug)}&active=eq.true&select=id,slug,name,price_cents,feature_key`)
      : await db(`plans?slug=eq.${encodeURIComponent(requestedPlan)}&active=eq.true&select=id,slug,name,price_cents,billing_months,company_limit,included_features`)
    const item = items?.[0]
    if (!item) throw new HttpError(409, "Produto indisponível.")

    if (body.productSlug) {
      const owned = await db(`entitlements?user_id=eq.${encodeURIComponent(signedIn.id)}&product_id=eq.${encodeURIComponent(item.id)}&active=eq.true&select=id&limit=1`)
      if (owned?.length) throw new HttpError(409, "Este módulo já está ativo na sua conta.")
      const subscriptions = await db(`subscriptions?user_id=eq.${encodeURIComponent(signedIn.id)}&select=plan_id,status,expires_at,grace_until&limit=1`)
      const sub = subscriptions?.[0]
      if (activeSubscription(sub) && sub?.plan_id && item.feature_key !== "portfolio") {
        const plans = await db(`plans?id=eq.${encodeURIComponent(sub.plan_id)}&select=included_features&limit=1`)
        const included = Array.isArray(plans?.[0]?.included_features) ? plans[0].included_features : []
        if (included.includes(item.feature_key)) throw new HttpError(409, "Este módulo já está incluído no seu plano atual.")
      }
    }

    const idempotencyKey = String(body.idempotencyKey || crypto.randomUUID()).trim()
    if (!validUuid(idempotencyKey)) throw new HttpError(400, "Chave de idempotência inválida.")
    const previous = await db(`payments?user_id=eq.${encodeURIComponent(signedIn.id)}&idempotency_key=eq.${encodeURIComponent(idempotencyKey)}&select=id,provider_order_id,provider_transaction_id,method,status,raw_status,card_brand,card_last4,installments&limit=1`)
    if (previous?.[0]) {
      const p = previous[0]
      return json({ payment: { id: p.provider_order_id || p.provider_transaction_id, transactionId: p.provider_transaction_id || undefined, method: p.method, status: p.status, statusDetail: p.raw_status || undefined, cardBrand: p.card_brand || undefined, cardLast4: p.card_last4 || undefined, installments: p.installments || undefined }, reused: true })
    }

    const amount = (Number(item.price_cents) / 100).toFixed(2)
    const address = normalizeAddress(body.address)
    if (method === "boleto") {
      const addressError = validateBoletoAddress(address)
      if (addressError) throw new HttpError(400, addressError)
    }

    const { firstName, lastName } = splitName(body.name)
    let payment: any
    if (method === "card") {
      const token = String(body.cardToken || "").trim()
      const paymentMethodId = String(body.paymentMethodId || "").trim().toLowerCase()
      const installments = Math.max(1, Math.min(12, Math.trunc(Number(body.installments || 1))))
      if (!token || token.length > 512 || !/^[a-z0-9_-]{2,40}$/i.test(paymentMethodId)) throw new HttpError(400, "Dados do cartão incompletos.")
      payment = { amount, payment_method: { id: paymentMethodId, type: "credit_card", token, installments } }
    } else {
      payment = {
        amount,
        payment_method: method === "pix" ? { id: "pix", type: "bank_transfer" } : { id: "boleto", type: "ticket" },
        expiration_time: method === "pix" ? "P1D" : "P3D"
      }
    }

    const payerBase = { email: signedIn.email, first_name: firstName, last_name: lastName, identification: { type: "CPF", number: cpf } }
    const payer = method === "boleto" ? { ...payerBase, address } : payerBase

    const orderBody = {
      type: "online",
      processing_mode: "automatic",
      total_amount: amount,
      external_reference: `tl_${signedIn.id.replace(/-/g, "")}_${String(item.slug || "item").replace(/[^a-zA-Z0-9_-]/g, "_")}`.slice(0, 64),
      description: `${item.name} | Tributo Leve`.slice(0, 150),
      payer,
      transactions: { payments: [payment] }
    }

    const { response, data: order, requestId } = await mercadoPagoRequest("/v1/orders", { method: "POST", idempotencyKey, deviceId: String(body.deviceId || ""), body: JSON.stringify(orderBody) })
    if (!response.ok) {
      const providerError = mercadoPagoError(order, response.status, requestId)
      throw new HttpError(502, providerError.message, providerError.code)
    }

    const view = orderPaymentView(order, method)
    if (!view.id) throw new HttpError(502, "O Mercado Pago não retornou o identificador da order.")
    const transactionId = view.transactionId || null
    await db("payments", {
      method: "POST",
      body: JSON.stringify({
        user_id: signedIn.id,
        plan_id: body.productSlug ? null : item.id,
        product_id: body.productSlug ? item.id : null,
        provider: "mercado_pago",
        provider_api: "orders_v1",
        provider_order_id: view.id,
        provider_transaction_id: transactionId,
        provider_payment_id: transactionId || view.id,
        method,
        status: view.status || "processing",
        amount_cents: item.price_cents,
        expires_at: view.expiresAt || null,
        raw_status: view.statusDetail || null,
        installments: view.installments || (method === "card" ? Math.max(1, Math.trunc(Number(body.installments || 1))) : null),
        card_brand: view.cardBrand || (method === "card" ? String(body.paymentMethodId || "").toLowerCase() : null),
        card_last4: view.cardLast4 || null,
        idempotency_key: idempotencyKey
      })
    })
    return json({ payment: view }, 201)
  } catch (error) {
    return safeError(error, "Não foi possível emitir a cobrança. Verifique a configuração de produção.")
  }
}

export const config: Config = { path: "/.netlify/functions/create-payment" }
