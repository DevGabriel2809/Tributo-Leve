import type { Config } from "@netlify/functions"
import { activeSubscription, addMonthsIso, authenticatedUser, db, enforceRateLimit, HttpError, json, requireEnv, safeError } from "./_shared.ts"
import { getOrder, isSuccessfulOrder, mercadoPagoError, orderPaymentView, type PaymentMethod } from "./_mercado_pago.ts"
import { localContractByUser, syncPreapproval } from "./_subscription.ts"

function legacyPaymentView(payment: any, method: PaymentMethod) {
  return { id: String(payment.id), status: String(payment.status || "pending"), statusDetail: payment.status_detail || undefined, method, qrCode: payment.point_of_interaction?.transaction_data?.qr_code, qrCodeBase64: payment.point_of_interaction?.transaction_data?.qr_code_base64, ticketUrl: payment.point_of_interaction?.transaction_data?.ticket_url || payment.transaction_details?.external_resource_url, expiresAt: payment.date_of_expiration }
}

async function activateManualAccess(userId: string, localPayment: any, providerId: string, confirmedAt?: string) {
  const now = confirmedAt || new Date().toISOString()
  if (!localPayment?.plan_id) return
  const plans = await db(`plans?id=eq.${encodeURIComponent(localPayment.plan_id)}&select=billing_months`)
  const months = Number(plans?.[0]?.billing_months || 1)
  const expiresAt = addMonthsIso(now, months)
  await db(`profiles?id=eq.${encodeURIComponent(userId)}`, { method: "PATCH", body: JSON.stringify({ access_status: "active", updated_at: new Date().toISOString() }) })
  await db("subscriptions?on_conflict=user_id", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=representation" }, body: JSON.stringify({ user_id: userId, plan_id: localPayment.plan_id, status: "active", activated_at: now, expires_at: expiresAt, renewal_mode: "manual", grace_until: null, next_billing_at: null, recurring_contract_id: null, updated_at: new Date().toISOString() }) })
  await db("audit_logs", { method: "POST", body: JSON.stringify({ actor_id: null, target_user_id: userId, action: "manual_plan_payment_confirmed", metadata: { provider: "mercado_pago", provider_id: providerId, expires_at: expiresAt } }) })
}

async function getSubscription(userId: string) {
  const rows = await db(`subscriptions?user_id=eq.${encodeURIComponent(userId)}&select=id,status,expires_at,grace_until,plan_id,renewal_mode,next_billing_at&limit=1`)
  return rows?.[0] || null
}

export default async (request: Request) => {
  if (request.method !== "GET") return json({ error: "Método não permitido" }, 405)
  try {
    const user = await authenticatedUser(request)
    if (!user) throw new HttpError(401, "Sessão inválida.")
    await enforceRateLimit(request, "payment-status", user.id, 45, 60)

    const forcePaymentCheck = new URL(request.url).searchParams.get("force") === "1"
    const profiles = await db(`profiles?id=eq.${encodeURIComponent(user.id)}&select=access_status,role`)
    const profile = profiles?.[0]
    if (!profile) throw new HttpError(404, "Conta não encontrada.")
    if (profile.role === "admin" || profile.access_status === "test_access") return json({ access: "active", payment: null })
    if (profile.access_status === "blocked") return json({ access: "blocked", payment: null })

    let subscription = await getSubscription(user.id)
    if (activeSubscription(subscription) && !forcePaymentCheck) return json({ access: "active", payment: null, subscription })

    // Assinatura recorrente: sincroniza com o provedor para recuperar webhook atrasado.
    let contract = await localContractByUser(user.id)
    if (contract?.provider_subscription_id && (forcePaymentCheck || !activeSubscription(subscription))) {
      await syncPreapproval(String(contract.provider_subscription_id))
      subscription = await getSubscription(user.id)
      contract = await localContractByUser(user.id)
      if (activeSubscription(subscription)) return json({ access: "active", payment: null, subscription })
      if (contract && ["pending_activation", "active", "paused"].includes(String(contract.status))) {
        return json({ access: "pending_payment", payment: { id: String(contract.provider_subscription_id), status: "processing", statusDetail: contract.last_payment_status_detail || undefined, method: "card", cardBrand: contract.card_brand || undefined, cardLast4: contract.card_last4 || undefined }, subscription })
      }
      if (contract?.status === "past_due" && !contract.grace_until) {
        return json({ access: "pending_payment", payment: { id: String(contract.provider_subscription_id), status: "rejected", statusDetail: contract.last_payment_status_detail || "Cobrança recusada", method: "card", cardBrand: contract.card_brand || undefined, cardLast4: contract.card_last4 || undefined }, subscription })
      }
    }

    // Se a vigencia/tolerancia terminou, fecha o acesso antes de consultar cobrancas antigas.
    if (subscription && !activeSubscription(subscription) && ["active", "past_due"].includes(String(subscription.status))) {
      await db(`subscriptions?user_id=eq.${encodeURIComponent(user.id)}`, { method: "PATCH", body: JSON.stringify({ status: "expired", grace_until: null, updated_at: new Date().toISOString() }) })
      await db(`profiles?id=eq.${encodeURIComponent(user.id)}`, { method: "PATCH", body: JSON.stringify({ access_status: "pending_payment", updated_at: new Date().toISOString() }) })
      subscription = { ...subscription, status: "expired", grace_until: null }
    }

    // Renovacoes manuais por PIX/boleto: somente a cobranca mais recente posterior ao vencimento.
    const rows = await db(`payments?user_id=eq.${encodeURIComponent(user.id)}&product_id=is.null&select=id,plan_id,provider_payment_id,provider_order_id,provider_transaction_id,provider_api,method,status,raw_status,amount_cents,created_at,paid_at&order=created_at.desc&limit=1`)
    const local = rows?.[0]
    if (!local) return json({ access: "pending_payment", payment: null, subscription })
    if (subscription?.expires_at && new Date(local.created_at).getTime() <= new Date(subscription.expires_at).getTime()) return json({ access: "pending_payment", payment: null, subscription })

    if (local.provider_order_id || local.provider_api === "orders_v1") {
      const orderId = String(local.provider_order_id || local.provider_payment_id)
      const { response, data: order, requestId } = await getOrder(orderId)
      if (!response.ok) {
        const providerError = mercadoPagoError(order, response.status, requestId)
        console.error("mercado-pago-get-order", { status: response.status, code: providerError.code, requestId })
        return json({ access: "pending_payment", payment: { id: orderId, status: local.status, statusDetail: local.raw_status, method: local.method } })
      }
      const receivedCents = Math.round(Number(order?.total_amount ?? order?.transactions?.payments?.[0]?.amount ?? order?.transactions?.payments?.[0]?.transaction_amount ?? 0) * 100)
      if (receivedCents !== Number(local.amount_cents)) {
        await db(`payments?id=eq.${encodeURIComponent(local.id)}`, { method: "PATCH", body: JSON.stringify({ status: "amount_mismatch", raw_status: `expected_${local.amount_cents}_received_${receivedCents}`, updated_at: new Date().toISOString() }) })
        await db("audit_logs", { method: "POST", body: JSON.stringify({ actor_id: null, target_user_id: user.id, action: "payment_amount_mismatch", metadata: { payment_id: local.id, provider_id: orderId, expected_cents: local.amount_cents, received_cents: receivedCents, source: "payment-status" } }) })
        return json({ access: "pending_payment", payment: { id: orderId, status: "rejected", statusDetail: "Valor da cobrança divergente.", method: local.method }, subscription })
      }
      const view = orderPaymentView(order, local.method)
      const transactionId = view.transactionId || local.provider_transaction_id || null
      await db(`payments?id=eq.${encodeURIComponent(local.id)}`, { method: "PATCH", body: JSON.stringify({ provider_order_id: orderId, provider_transaction_id: transactionId, provider_payment_id: transactionId || orderId, provider_api: "orders_v1", status: view.status, raw_status: view.statusDetail || null, paid_at: isSuccessfulOrder(order) ? new Date().toISOString() : null, updated_at: new Date().toISOString() }) })
      if (isSuccessfulOrder(order)) {
        await activateManualAccess(user.id, local, orderId)
        return json({ access: "active", payment: null })
      }
      return json({ access: "pending_payment", payment: view })
    }

    const response = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(local.provider_payment_id)}`, { headers: { Authorization: `Bearer ${requireEnv("MERCADO_PAGO_ACCESS_TOKEN")}` } })
    if (!response.ok) return json({ access: "pending_payment", payment: { id: local.provider_payment_id, status: local.status, method: local.method } })
    const payment = await response.json() as any
    const receivedCents = Math.round(Number(payment?.transaction_amount ?? 0) * 100)
    if (receivedCents !== Number(local.amount_cents)) {
      await db(`payments?id=eq.${encodeURIComponent(local.id)}`, { method: "PATCH", body: JSON.stringify({ status: "amount_mismatch", raw_status: `expected_${local.amount_cents}_received_${receivedCents}`, updated_at: new Date().toISOString() }) })
      await db("audit_logs", { method: "POST", body: JSON.stringify({ actor_id: null, target_user_id: user.id, action: "payment_amount_mismatch", metadata: { payment_id: local.id, provider_id: local.provider_payment_id, expected_cents: local.amount_cents, received_cents: receivedCents, source: "payment-status-legacy" } }) })
      return json({ access: "pending_payment", payment: { id: local.provider_payment_id, status: "rejected", statusDetail: "Valor da cobrança divergente.", method: local.method }, subscription })
    }
    const status = String(payment.status || local.status)
    await db(`payments?id=eq.${encodeURIComponent(local.id)}`, { method: "PATCH", body: JSON.stringify({ status, raw_status: payment.status_detail || null, paid_at: status === "approved" ? payment.date_approved || new Date().toISOString() : null, updated_at: new Date().toISOString() }) })
    if (status === "approved") {
      await activateManualAccess(user.id, local, String(payment.id), payment.date_approved)
      return json({ access: "active", payment: null })
    }
    return json({ access: "pending_payment", payment: legacyPaymentView(payment, local.method) })
  } catch (error) {
    return safeError(error, "Não foi possível consultar a cobrança.")
  }
}

export const config: Config = { path: "/.netlify/functions/payment-status" }
