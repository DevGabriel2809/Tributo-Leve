import type { Config } from "@netlify/functions"
import { assertBodySize, assertTrustedOrigin, authenticatedUser, db, enforceRateLimit, HttpError, json, safeError, validCpf } from "./_shared.ts"
import { mercadoPagoError, mercadoPagoRequest } from "./_mercado_pago.ts"
import { localContractByUser, syncPreapproval } from "./_subscription.ts"

function publicView(contract: any, subscription: any, plan: any) {
  if (!contract) return { recurring: false, subscription, plan }
  return {
    recurring: true,
    contract: {
      status: contract.status,
      providerStatus: contract.provider_status,
      amountCents: contract.amount_cents,
      billingMonths: contract.billing_months,
      currentPeriodStart: contract.current_period_start,
      currentPeriodEnd: contract.current_period_end,
      nextPaymentDate: contract.next_payment_date,
      graceUntil: contract.grace_until,
      cancelAtPeriodEnd: contract.cancel_at_period_end,
      canceledAt: contract.canceled_at,
      cardBrand: contract.card_brand,
      cardLast4: contract.card_last4,
      lastPaymentStatus: contract.last_payment_status,
      lastPaymentStatusDetail: contract.last_payment_status_detail
    },
    subscription,
    plan
  }
}

async function load(userId: string) {
  const contract = await localContractByUser(userId)
  const subscriptions = await db(`subscriptions?user_id=eq.${encodeURIComponent(userId)}&select=id,plan_id,status,activated_at,expires_at,renewal_mode,grace_until,next_billing_at&limit=1`)
  const subscription = subscriptions?.[0] || null
  const planId = contract?.plan_id || subscription?.plan_id
  const plans = planId ? await db(`plans?id=eq.${encodeURIComponent(planId)}&select=id,slug,name,description,price_cents,billing_months,company_limit,included_features&limit=1`) : []
  return { contract, subscription, plan: plans?.[0] || null }
}

export default async (request: Request) => {
  try {
    const user = await authenticatedUser(request)
    if (!user) throw new HttpError(401, "Sessão inválida.")

    if (request.method === "GET") {
      const shouldSync = new URL(request.url).searchParams.get("sync") === "1"
      await enforceRateLimit(request, "subscription-read", user.id, 30, 60)
      let data = await load(user.id)
      if (shouldSync && data.contract?.provider_subscription_id) {
        await syncPreapproval(String(data.contract.provider_subscription_id))
        data = await load(user.id)
      }
      return json(publicView(data.contract, data.subscription, data.plan))
    }

    if (request.method !== "POST") return json({ error: "Método não permitido." }, 405)
    assertBodySize(request, 32 * 1024)
    assertTrustedOrigin(request)
    await enforceRateLimit(request, "subscription-write", user.id, 10, 10 * 60)
    const body = await request.json() as { action?: string; cardToken?: string; paymentMethodId?: string; deviceId?: string; cpf?: string }
    const action = String(body.action || "")
    let data = await load(user.id)
    const contract = data.contract
    if (!contract?.provider_subscription_id) throw new HttpError(404, "Nenhuma assinatura automática encontrada.")

    if (action === "sync") {
      await syncPreapproval(String(contract.provider_subscription_id))
      data = await load(user.id)
      return json(publicView(data.contract, data.subscription, data.plan))
    }

    if (action === "cancel") {
      if (["canceled", "expired"].includes(String(contract.status))) return json(publicView(contract, data.subscription, data.plan))
      const provider = await mercadoPagoRequest(`/preapproval/${encodeURIComponent(contract.provider_subscription_id)}`, { method: "PUT", body: JSON.stringify({ status: "canceled" }) })
      if (!provider.response.ok) {
        const mapped = mercadoPagoError(provider.data, provider.response.status, provider.requestId)
        throw new HttpError(502, mapped.message, mapped.code)
      }
      await db(`recurring_contracts?id=eq.${encodeURIComponent(contract.id)}`, { method: "PATCH", body: JSON.stringify({ provider_status: "canceled", status: "canceled", cancel_at_period_end: true, canceled_at: new Date().toISOString(), updated_at: new Date().toISOString() }) })
      await db("audit_logs", { method: "POST", body: JSON.stringify({ actor_id: user.id, target_user_id: user.id, action: "recurring_subscription_canceled", metadata: { provider_subscription_id: contract.provider_subscription_id, access_until: data.subscription?.expires_at || null } }) })
      data = await load(user.id)
      return json(publicView(data.contract, data.subscription, data.plan))
    }

    if (action === "update_card") {
      const cardToken = String(body.cardToken || "").trim()
      const methodId = String(body.paymentMethodId || "").trim().toLowerCase()
      const cpf = String(body.cpf || "").replace(/\D/g, "")
      if (!cardToken || cardToken.length > 512 || !/^[a-z0-9_-]{2,40}$/i.test(methodId)) throw new HttpError(400, "Dados do novo cartão incompletos.")
      if (!validCpf(cpf)) throw new HttpError(400, "Informe um CPF válido.")
      const cpfMatches = await db("rpc/cpf_belongs_to_user", { method: "POST", body: JSON.stringify({ p_user_id: user.id, p_cpf: cpf }) })
      if (cpfMatches !== true) throw new HttpError(409, "O CPF informado não corresponde ao cadastro desta conta.")
      if (["canceled", "expired"].includes(String(contract.status))) throw new HttpError(409, "A assinatura está cancelada. Crie uma nova assinatura para voltar à renovação automática.")
      const provider = await mercadoPagoRequest(`/preapproval/${encodeURIComponent(contract.provider_subscription_id)}`, { method: "PUT", deviceId: String(body.deviceId || ""), body: JSON.stringify({ card_token_id: cardToken }) })
      if (!provider.response.ok) {
        const mapped = mercadoPagoError(provider.data, provider.response.status, provider.requestId)
        throw new HttpError(502, mapped.message, mapped.code)
      }
      await db(`recurring_contracts?id=eq.${encodeURIComponent(contract.id)}`, { method: "PATCH", body: JSON.stringify({ card_brand: methodId, card_last4: null, updated_at: new Date().toISOString() }) })
      await db("audit_logs", { method: "POST", body: JSON.stringify({ actor_id: user.id, target_user_id: user.id, action: "recurring_card_updated", metadata: { provider_subscription_id: contract.provider_subscription_id, card_brand: methodId } }) })
      data = await load(user.id)
      return json(publicView(data.contract, data.subscription, data.plan))
    }

    throw new HttpError(400, "Ação não reconhecida.")
  } catch (error) {
    return safeError(error, "Não foi possível gerenciar sua assinatura.")
  }
}

export const config: Config = { path: "/.netlify/functions/subscription" }
