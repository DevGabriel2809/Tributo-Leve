import { requireEnv } from "./_shared.ts"

export type PaymentMethod = "pix" | "boleto" | "card"

export type MercadoPagoPaymentView = {
  id: string
  transactionId?: string
  status: string
  statusDetail?: string
  method: PaymentMethod
  qrCode?: string
  qrCodeBase64?: string
  ticketUrl?: string
  digitableLine?: string
  barcodeContent?: string
  financialInstitution?: string
  expiresAt?: string
  cardBrand?: string
  cardLast4?: string
  installments?: number
}

export function isSuccessfulOrder(order: any) {
  return String(order?.status || "") === "processed" && String(order?.status_detail || "") === "accredited"
}

export function orderPaymentView(order: any, method: PaymentMethod): MercadoPagoPaymentView {
  const transaction = order?.transactions?.payments?.[0] || null
  const paymentMethod = transaction?.payment_method || {}
  const card = transaction?.card || {}
  return {
    id: String(order?.id || ""),
    transactionId: transaction?.id ? String(transaction.id) : undefined,
    status: String(order?.status || transaction?.status || "processing"),
    statusDetail: String(order?.status_detail || transaction?.status_detail || "") || undefined,
    method,
    qrCode: paymentMethod.qr_code || undefined,
    qrCodeBase64: paymentMethod.qr_code_base64 || undefined,
    ticketUrl: paymentMethod.ticket_url || undefined,
    digitableLine: paymentMethod.digitable_line || undefined,
    barcodeContent: paymentMethod.barcode_content || undefined,
    financialInstitution: paymentMethod.financial_institution || undefined,
    expiresAt: transaction?.expiration_date || order?.expiration_date || undefined,
    cardBrand: paymentMethod?.id || undefined,
    cardLast4: card?.last_digits || undefined,
    installments: Number(paymentMethod?.installments || 0) || undefined
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function apiHeaders(idempotencyKey?: string, deviceId?: string) {
  return {
    accept: "application/json",
    Authorization: `Bearer ${requireEnv("MERCADO_PAGO_ACCESS_TOKEN")}`,
    "Content-Type": "application/json",
    ...(idempotencyKey ? { "X-Idempotency-Key": idempotencyKey } : {}),
    ...(deviceId ? { "X-meli-session-id": deviceId.slice(0, 256) } : {})
  }
}

async function parseJson(response: Response) {
  const raw = await response.text()
  if (!raw) return null
  try { return JSON.parse(raw) }
  catch { return { message: raw.slice(0, 500) } }
}

export async function mercadoPagoRequest(path: string, init: RequestInit & { idempotencyKey?: string; deviceId?: string } = {}) {
  const { idempotencyKey, deviceId, ...requestInit } = init
  let attempt = 0
  let response: Response
  while (true) {
    response = await fetch(`https://api.mercadopago.com${path}`, {
      ...requestInit,
      headers: { ...apiHeaders(idempotencyKey, deviceId), ...(requestInit.headers || {}) }
    })
    if (response.status !== 429 || attempt >= 2) break
    const retryAfter = Number(response.headers.get("retry-after") || "0")
    const base = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 600 * (2 ** attempt)
    const jitter = Math.floor(Math.random() * 250)
    await sleep(Math.min(base + jitter, 6000))
    attempt += 1
  }
  const data = await parseJson(response)
  return { response, data, requestId: response.headers.get("x-request-id") || undefined }
}

function detailMessages(payload: any) {
  const values: string[] = []
  const candidates = [payload?.errors, payload?.cause, payload?.details]
  for (const candidate of candidates) {
    if (!Array.isArray(candidate)) continue
    for (const item of candidate) {
      if (typeof item === "string") values.push(item)
      else if (item && typeof item === "object") {
        const text = item.message || item.description || item.detail || item.code
        if (text) values.push(String(text))
      }
    }
  }
  return [...new Set(values)].slice(0, 3)
}

export function mercadoPagoError(payload: any, status: number, requestId?: string) {
  const code = String(payload?.code || payload?.error || payload?.status || "")
  const details = detailMessages(payload)
  const original = String(payload?.message || payload?.error_description || "").trim()
  let message = original || details.join(" · ") || "O Mercado Pago recusou a solicitação."

  if (status === 401 || code === "unauthorized" || code === "invalid_credentials") {
    message = "O Access Token do Mercado Pago não foi aceito. Confira as credenciais de produção da aplicação."
  } else if (status === 403 || code === "forbidden") {
    message = "A aplicação do Mercado Pago não possui permissão para criar esta cobrança. Confira a aplicação e as credenciais de produção."
  } else if (status === 429) {
    message = "O Mercado Pago limitou temporariamente as solicitações. Aguarde alguns segundos e tente novamente."
  } else if (code === "required_properties" || code === "invalid_properties" || code === "unsupported_properties") {
    message = details.length ? `O Mercado Pago recusou os dados da cobrança: ${details.join(" · ")}` : "O Mercado Pago recusou um ou mais dados obrigatórios da cobrança."
  } else if (code === "invalid_email_for_sandbox") {
    message = "A credencial está em modo de teste e exige um usuário de teste do Mercado Pago. Para o site publicado, use as credenciais de produção."
  }

  return { message, code: code || undefined, requestId }
}

export async function getOrder(orderId: string) {
  return mercadoPagoRequest(`/v1/orders/${encodeURIComponent(orderId)}`, { method: "GET" })
}

export async function getPreapproval(subscriptionId: string) {
  return mercadoPagoRequest(`/preapproval/${encodeURIComponent(subscriptionId)}`, { method: "GET" })
}

export async function getAuthorizedPayment(invoiceId: string) {
  return mercadoPagoRequest(`/authorized_payments/${encodeURIComponent(invoiceId)}`, { method: "GET" })
}

export async function searchAuthorizedPayments(subscriptionId: string) {
  return mercadoPagoRequest(`/authorized_payments/search?preapproval_id=${encodeURIComponent(subscriptionId)}&sort=date_created&criteria=desc&limit=20`, { method: "GET" })
}

export async function getPayment(paymentId: string) {
  return mercadoPagoRequest(`/v1/payments/${encodeURIComponent(paymentId)}`, { method: "GET" })
}
