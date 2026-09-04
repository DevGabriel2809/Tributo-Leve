import { addMonthsIso, db } from "./_shared.ts"
import { getAuthorizedPayment, getPayment, getPreapproval, searchAuthorizedPayments } from "./_mercado_pago.ts"

export function cents(value: unknown) {
  const n = Number(value)
  return Number.isFinite(n) ? Math.round(n * 100) : 0
}

function future(iso?: string | null) {
  if (!iso) return false
  const time = new Date(iso).getTime()
  return Number.isFinite(time) && time > Date.now()
}

async function cardDetails(paymentId?: string | number | null) {
  if (!paymentId) return { brand: null, last4: null }
  const { response, data } = await getPayment(String(paymentId))
  if (!response.ok) return { brand: null, last4: null }
  return {
    brand: data?.payment_method_id ? String(data.payment_method_id) : null,
    last4: data?.card?.last_four_digits ? String(data.card.last_four_digits) : data?.card?.last_digits ? String(data.card.last_digits) : null
  }
}

export async function localContractByProvider(providerSubscriptionId: string) {
  const rows = await db(`recurring_contracts?provider_subscription_id=eq.${encodeURIComponent(providerSubscriptionId)}&select=*`)
  return rows?.[0] || null
}

export async function localContractByUser(userId: string) {
  const rows = await db(`recurring_contracts?user_id=eq.${encodeURIComponent(userId)}&select=*`)
  return rows?.[0] || null
}

export async function processAuthorizedInvoice(invoice: any, contract: any) {
  if (!invoice || !contract) return { ok: false, reason: "missing" }
  if (String(invoice.preapproval_id || "") !== String(contract.provider_subscription_id || "")) return { ok: false, reason: "subscription_mismatch" }

  const invoiceAmount = cents(invoice.transaction_amount ?? invoice.payment?.transaction_amount)
  if (invoiceAmount !== Number(contract.amount_cents)) {
    await db(`recurring_contracts?id=eq.${encodeURIComponent(contract.id)}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "error", last_payment_status: "amount_mismatch", updated_at: new Date().toISOString() })
    })
    await db("audit_logs", {
      method: "POST",
      body: JSON.stringify({ actor_id: null, target_user_id: contract.user_id, action: "recurring_amount_mismatch", metadata: { contract_id: contract.id, expected_cents: contract.amount_cents, received_cents: invoiceAmount, invoice_id: String(invoice.id || "") } })
    })
    return { ok: false, reason: "amount_mismatch" }
  }

  const paymentStatus = String(invoice?.payment?.status || invoice?.status || "").toLowerCase()
  const statusDetail = String(invoice?.payment?.status_detail || invoice?.summarized || "")
  const invoiceId = String(invoice.id || "")
  const paymentId = invoice?.payment?.id ? String(invoice.payment.id) : null

  // Sincronizações manuais e retries de webhook podem reenviar a mesma fatura.
  // Não reabre período nem estende tolerância se nada mudou no provedor.
  if (invoiceId && String(contract.last_authorized_payment_id || "") === invoiceId && String(contract.last_payment_status || "").toLowerCase() === paymentStatus) {
    return { ok: true, status: String(contract.status || "already_processed"), alreadyProcessed: true }
  }

  if (paymentStatus === "approved" || statusDetail === "accredited") {
    const startCandidate = invoice.debit_date || invoice.date_created || new Date().toISOString()
    const start = new Date(startCandidate).toISOString()
    const end = addMonthsIso(start, Number(contract.billing_months || 1))
    const card = await cardDetails(paymentId)

    await db(`recurring_contracts?id=eq.${encodeURIComponent(contract.id)}`, {
      method: "PATCH",
      body: JSON.stringify({
        provider_status: "authorized",
        status: "active",
        current_period_start: start,
        current_period_end: end,
        next_payment_date: end,
        grace_until: null,
        last_authorized_payment_id: invoiceId || null,
        last_payment_status: paymentStatus || "approved",
        last_payment_status_detail: statusDetail || null,
        ...(card.brand ? { card_brand: card.brand } : {}),
        ...(card.last4 ? { card_last4: card.last4 } : {}),
        updated_at: new Date().toISOString()
      })
    })

    await db("subscriptions?on_conflict=user_id", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify({
        user_id: contract.user_id,
        plan_id: contract.plan_id,
        status: "active",
        activated_at: start,
        expires_at: end,
        renewal_mode: "automatic",
        grace_until: null,
        next_billing_at: end,
        recurring_contract_id: contract.id,
        updated_at: new Date().toISOString()
      })
    })
    await db(`profiles?id=eq.${encodeURIComponent(contract.user_id)}`, { method: "PATCH", body: JSON.stringify({ access_status: "active", updated_at: new Date().toISOString() }) })
    await db("audit_logs", { method: "POST", body: JSON.stringify({ actor_id: null, target_user_id: contract.user_id, action: "recurring_payment_approved", metadata: { invoice_id: invoiceId, payment_id: paymentId, contract_id: contract.id, period_end: end } }) })
    return { ok: true, status: "active", periodEnd: end }
  }

  const failed = ["rejected", "cancelled", "canceled", "failed", "refunded", "charged_back"].includes(paymentStatus) || ["rejected", "failed"].includes(String(invoice?.summarized || "").toLowerCase())
  if (failed) {
    const subscriptions = await db(`subscriptions?user_id=eq.${encodeURIComponent(contract.user_id)}&select=id,status,expires_at,grace_until&limit=1`)
    const current = subscriptions?.[0]
    const hasPaidPeriod = Boolean(current?.expires_at)
    let graceUntil: string | null = null
    if (hasPaidPeriod) {
      const base = Math.max(Date.now(), new Date(current.expires_at).getTime())
      graceUntil = new Date(base + 3 * 24 * 60 * 60 * 1000).toISOString()
      await db(`subscriptions?user_id=eq.${encodeURIComponent(contract.user_id)}`, { method: "PATCH", body: JSON.stringify({ status: "past_due", grace_until: graceUntil, updated_at: new Date().toISOString() }) })
      await db(`profiles?id=eq.${encodeURIComponent(contract.user_id)}`, { method: "PATCH", body: JSON.stringify({ access_status: "active", updated_at: new Date().toISOString() }) })
    }
    await db(`recurring_contracts?id=eq.${encodeURIComponent(contract.id)}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "past_due", grace_until: graceUntil, last_authorized_payment_id: invoiceId || null, last_payment_status: paymentStatus || "failed", last_payment_status_detail: statusDetail || null, updated_at: new Date().toISOString() })
    })
    await db("audit_logs", { method: "POST", body: JSON.stringify({ actor_id: null, target_user_id: contract.user_id, action: "recurring_payment_failed", metadata: { invoice_id: invoiceId, contract_id: contract.id, grace_until: graceUntil } }) })
    return { ok: true, status: "past_due", graceUntil }
  }

  await db(`recurring_contracts?id=eq.${encodeURIComponent(contract.id)}`, { method: "PATCH", body: JSON.stringify({ last_authorized_payment_id: invoiceId || null, last_payment_status: paymentStatus || String(invoice?.status || "pending"), last_payment_status_detail: statusDetail || null, updated_at: new Date().toISOString() }) })
  return { ok: true, status: "pending" }
}

export async function processAuthorizedInvoiceById(invoiceId: string) {
  const { response, data: invoice } = await getAuthorizedPayment(invoiceId)
  if (!response.ok || !invoice) return { ok: false, reason: "invoice_not_found" }
  const contract = await localContractByProvider(String(invoice.preapproval_id || ""))
  if (!contract) return { ok: false, reason: "contract_not_found" }
  return processAuthorizedInvoice(invoice, contract)
}

export async function syncPreapproval(providerSubscriptionId: string) {
  const contract = await localContractByProvider(providerSubscriptionId)
  if (!contract) return { ok: false, reason: "contract_not_found" }
  const { response, data: provider } = await getPreapproval(providerSubscriptionId)
  if (!response.ok || !provider) return { ok: false, reason: "provider_not_found" }

  const providerStatus = String(provider.status || "unknown").toLowerCase()
  const nextPaymentDate = provider.next_payment_date || provider.auto_recurring?.next_payment_date || null
  const mapped = providerStatus === "authorized" ? contract.status : providerStatus === "paused" ? "paused" : providerStatus === "cancelled" || providerStatus === "canceled" ? "canceled" : contract.status
  await db(`recurring_contracts?id=eq.${encodeURIComponent(contract.id)}`, {
    method: "PATCH",
    body: JSON.stringify({ provider_status: providerStatus, status: mapped, next_payment_date: nextPaymentDate, updated_at: new Date().toISOString() })
  })

  if (["cancelled", "canceled"].includes(providerStatus)) {
    const subscriptions = await db(`subscriptions?user_id=eq.${encodeURIComponent(contract.user_id)}&select=expires_at&limit=1`)
    const current = subscriptions?.[0]
    const stillPaid = future(current?.expires_at)
    await db(`recurring_contracts?id=eq.${encodeURIComponent(contract.id)}`, { method: "PATCH", body: JSON.stringify({ status: "canceled", cancel_at_period_end: true, canceled_at: contract.canceled_at || new Date().toISOString(), updated_at: new Date().toISOString() }) })
    if (!stillPaid) {
      await db(`subscriptions?user_id=eq.${encodeURIComponent(contract.user_id)}`, { method: "PATCH", body: JSON.stringify({ status: "expired", grace_until: null, updated_at: new Date().toISOString() }) })
      await db(`profiles?id=eq.${encodeURIComponent(contract.user_id)}`, { method: "PATCH", body: JSON.stringify({ access_status: "pending_payment", updated_at: new Date().toISOString() }) })
    }
  }

  const invoices = await searchAuthorizedPayments(providerSubscriptionId)
  const results = Array.isArray(invoices.data?.results) ? invoices.data.results : []
  const newest = results
    .slice()
    .sort((a: any, b: any) => new Date(b.date_created || b.debit_date || 0).getTime() - new Date(a.date_created || a.debit_date || 0).getTime())[0]
  if (newest) await processAuthorizedInvoice(newest, contract)

  // Uma fatura antiga aprovada não pode reativar a renovação se o contrato no
  // provedor está pausado ou cancelado. O acesso ao período já pago continua
  // sendo controlado separadamente por subscriptions.expires_at.
  if (providerStatus === "paused") {
    await db(`recurring_contracts?id=eq.${encodeURIComponent(contract.id)}`, { method: "PATCH", body: JSON.stringify({ provider_status: providerStatus, status: "paused", updated_at: new Date().toISOString() }) })
  } else if (["cancelled", "canceled"].includes(providerStatus)) {
    await db(`recurring_contracts?id=eq.${encodeURIComponent(contract.id)}`, { method: "PATCH", body: JSON.stringify({ provider_status: providerStatus, status: "canceled", cancel_at_period_end: true, canceled_at: contract.canceled_at || new Date().toISOString(), updated_at: new Date().toISOString() }) })
  }
  return { ok: true, providerStatus }
}
