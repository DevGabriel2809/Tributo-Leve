import { createHash, createHmac, timingSafeEqual } from "node:crypto"
import type { Config } from "@netlify/functions"
import { addMonthsIso, DatabaseRequestError, db, json, requireEnv } from "./_shared.ts"
import { getOrder, getPayment, isSuccessfulOrder, orderPaymentView } from "./_mercado_pago.ts"
import { processAuthorizedInvoiceById, syncPreapproval } from "./_subscription.ts"

function parseSignature(value: string) {
  const parts: Record<string, string> = {}
  for (const raw of value.split(",")) {
    const index = raw.indexOf("=")
    if (index < 1) continue
    parts[raw.slice(0, index).trim()] = raw.slice(index + 1).trim()
  }
  return parts
}

function safeEqualHex(received: string, expected: string) {
  const a = Buffer.from(received, "utf8")
  const b = Buffer.from(expected, "utf8")
  return a.length === b.length && timingSafeEqual(a, b)
}

function validSignature(request: Request, signedDataId: string) {
  const signature = request.headers.get("x-signature") || ""
  const requestId = request.headers.get("x-request-id") || ""
  const parts = parseSignature(signature)
  if (!parts.ts || !parts.v1 || !requestId || !signedDataId) return false

  // A documentação do Mercado Pago usa data.id + x-request-id + ts no manifesto.
  // Integrações antigas do provedor também documentaram normalização para minúsculas
  // quando o data.id é alfanumérico; aceitamos ambas as formas, sempre com HMAC válido.
  const ids = [signedDataId]
  if (/[A-Z]/.test(signedDataId)) ids.push(signedDataId.toLowerCase())
  return ids.some((id) => {
    const manifest = `id:${id};request-id:${requestId};ts:${parts.ts};`
    const expected = createHmac("sha256", requireEnv("MERCADO_PAGO_WEBHOOK_SECRET")).update(manifest).digest("hex")
    return safeEqualHex(parts.v1, expected)
  })
}

function amountCents(value: unknown) {
  const amount = Number(value)
  return Number.isFinite(amount) ? Math.round(amount * 100) : 0
}

function orderAmount(order: any) {
  const transaction = order?.transactions?.payments?.[0]
  return amountCents(order?.total_amount ?? transaction?.amount ?? transaction?.transaction_amount)
}

async function grant(localPayment: any, userId: string, providerId: string, confirmedAt?: string) {
  if (localPayment?.plan_id) {
    const activatedAt = confirmedAt || new Date().toISOString()
    const plans = await db(`plans?id=eq.${encodeURIComponent(localPayment.plan_id)}&select=billing_months`)
    const months = Number(plans?.[0]?.billing_months || 1)
    const expiresAt = addMonthsIso(activatedAt, months)
    await db(`profiles?id=eq.${encodeURIComponent(userId)}`, { method: "PATCH", body: JSON.stringify({ access_status: "active", updated_at: new Date().toISOString() }) })
    await db("subscriptions?on_conflict=user_id", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify({ user_id: userId, plan_id: localPayment.plan_id, status: "active", activated_at: activatedAt, expires_at: expiresAt, renewal_mode: "manual", grace_until: null, next_billing_at: null, recurring_contract_id: null, updated_at: new Date().toISOString() })
    })
  }
  if (localPayment?.product_id) {
    await db("entitlements?on_conflict=user_id,product_id", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify({ user_id: userId, product_id: localPayment.product_id, active: true })
    })
  }
  await db("audit_logs", { method: "POST", body: JSON.stringify({ actor_id: null, target_user_id: userId, action: "payment_approved", metadata: { provider: "mercado_pago", provider_id: providerId } }) })
}

async function amountMismatch(localPayment: any, receivedCents: number, resourceId: string) {
  await db(`payments?id=eq.${encodeURIComponent(localPayment.id)}`, { method: "PATCH", body: JSON.stringify({ status: "amount_mismatch", raw_status: `expected_${localPayment.amount_cents}_received_${receivedCents}`, updated_at: new Date().toISOString() }) })
  await db("audit_logs", { method: "POST", body: JSON.stringify({ actor_id: null, target_user_id: localPayment.user_id, action: "payment_amount_mismatch", metadata: { payment_id: localPayment.id, provider_id: resourceId, expected_cents: localPayment.amount_cents, received_cents: receivedCents } }) })
}

async function handleOrder(orderId: string) {
  const { response, data: order } = await getOrder(orderId)
  if (!response.ok) throw new Error("Order do webhook não foi encontrada no Mercado Pago.")

  const rows = await db(`payments?provider_order_id=eq.${encodeURIComponent(orderId)}&select=id,user_id,plan_id,product_id,method,provider_transaction_id,amount_cents`)
  const localPayment = rows?.[0]
  if (!localPayment) return "order_without_local_payment"

  const receivedCents = orderAmount(order)
  if (receivedCents !== Number(localPayment.amount_cents)) {
    await amountMismatch(localPayment, receivedCents, orderId)
    return "amount_mismatch"
  }

  const view = orderPaymentView(order, localPayment.method)
  await db(`payments?id=eq.${encodeURIComponent(localPayment.id)}`, {
    method: "PATCH",
    body: JSON.stringify({
      provider_api: "orders_v1",
      provider_transaction_id: view.transactionId || localPayment.provider_transaction_id || null,
      provider_payment_id: view.transactionId || orderId,
      status: view.status,
      raw_status: view.statusDetail || null,
      paid_at: isSuccessfulOrder(order) ? new Date().toISOString() : null,
      card_brand: view.cardBrand || null,
      card_last4: view.cardLast4 || null,
      installments: view.installments || null,
      updated_at: new Date().toISOString()
    })
  })
  if (isSuccessfulOrder(order)) await grant(localPayment, localPayment.user_id, orderId)
  return isSuccessfulOrder(order) ? "approved" : view.status
}

async function handlePayment(paymentId: string) {
  const { response, data: payment } = await getPayment(paymentId)
  if (!response.ok) throw new Error("Pagamento do webhook não foi encontrado no Mercado Pago.")
  const rows = await db(`payments?or=(provider_payment_id.eq.${encodeURIComponent(paymentId)},provider_transaction_id.eq.${encodeURIComponent(paymentId)})&select=id,user_id,plan_id,product_id,amount_cents`)
  const localPayment = rows?.[0]
  if (!localPayment) return "payment_without_local_payment"

  const receivedCents = amountCents(payment?.transaction_amount)
  if (receivedCents !== Number(localPayment.amount_cents)) {
    await amountMismatch(localPayment, receivedCents, paymentId)
    return "amount_mismatch"
  }

  const status = String(payment?.status || "unknown")
  await db(`payments?id=eq.${encodeURIComponent(localPayment.id)}`, {
    method: "PATCH",
    body: JSON.stringify({ status, raw_status: payment?.status_detail || null, paid_at: status === "approved" ? payment?.date_approved || new Date().toISOString() : null, card_brand: payment?.payment_method_id || null, card_last4: payment?.card?.last_four_digits || payment?.card?.last_digits || null, installments: payment?.installments || null, updated_at: new Date().toISOString() })
  })
  if (status === "approved") await grant(localPayment, localPayment.user_id, paymentId, payment?.date_approved)
  return status
}

async function reserveEvent(eventKey: string, eventType: string, resourceId: string, requestId: string, payloadHash: string) {
  try {
    const rows = await db("webhook_events", { method: "POST", body: JSON.stringify({ provider: "mercado_pago", event_key: eventKey, event_type: eventType, resource_id: resourceId, request_id: requestId || null, payload_hash: payloadHash }) })
    return { id: rows?.[0]?.id || null, duplicate: false }
  } catch (error) {
    if (!(error instanceof DatabaseRequestError) || error.code !== "23505") throw error
    const existing = await db(`webhook_events?provider=eq.mercado_pago&event_key=eq.${encodeURIComponent(eventKey)}&select=id,processed_at,payload_hash&limit=1`)
    const row = existing?.[0]
    if (!row) throw error
    // Só é duplicata concluída se a execução anterior chegou até processed_at.
    // Se ela falhou no meio, o retry do Mercado Pago reaproveita a reserva e processa de novo.
    if (row.processed_at) return { id: row.id, duplicate: true }
    if (row.payload_hash && row.payload_hash !== payloadHash) throw new Error("Webhook reutilizou event_key com payload diferente.")
    return { id: row.id, duplicate: false }
  }
}

export default async (request: Request) => {
  if (request.method !== "POST") return json({ received: true })
  try {
    const url = new URL(request.url)
    const rawBody = await request.text()
    let body: any = {}
    try { body = rawBody ? JSON.parse(rawBody) : {} } catch { return json({ error: "Payload inválido" }, 400) }

    const signedDataId = String(url.searchParams.get("data.id") || "")
    const resourceId = signedDataId || String(body?.data?.id || "")
    const eventType = String(url.searchParams.get("type") || body?.type || body?.topic || "").toLowerCase()
    if (!signedDataId || !resourceId || !validSignature(request, signedDataId)) return json({ error: "Assinatura inválida" }, 401)

    const requestId = request.headers.get("x-request-id") || ""
    const payloadHash = createHash("sha256").update(rawBody).digest("hex")
    const notificationId = String(body?.id || requestId || payloadHash.slice(0, 32))
    const eventKey = `${eventType || "unknown"}:${notificationId}`.slice(0, 240)
    const reservation = await reserveEvent(eventKey, eventType || "unknown", resourceId, requestId, payloadHash)
    if (reservation.duplicate) return json({ received: true, duplicate: true })
    const eventId = reservation.id
    if (!eventId) throw new Error("Não foi possível reservar o evento de webhook.")

    let result = "ignored"
    if (eventType === "subscription_authorized_payment") {
      const processed = await processAuthorizedInvoiceById(resourceId)
      result = processed.ok ? String(processed.status || "processed") : String(processed.reason || "not_processed")
    } else if (eventType === "subscription_preapproval") {
      const processed = await syncPreapproval(resourceId)
      result = processed.ok ? "subscription_synced" : String(processed.reason || "not_processed")
    } else if (eventType === "order" || resourceId.startsWith("ORD")) {
      result = await handleOrder(resourceId)
    } else if (eventType === "payment") {
      result = await handlePayment(resourceId)
    }

    await db(`webhook_events?id=eq.${encodeURIComponent(String(eventId))}`, { method: "PATCH", body: JSON.stringify({ processed_at: new Date().toISOString(), result }) })
    return json({ received: true })
  } catch (error) {
    console.error("payment-webhook", error instanceof Error ? { name: error.name, message: error.message } : { error: "unknown" })
    return json({ error: "Falha ao processar notificação" }, 500)
  }
}

export const config: Config = { path: "/.netlify/functions/payment-webhook" }
