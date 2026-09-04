import type { Config } from "@netlify/functions"
import { assertBodySize, assertTrustedOrigin, authenticatedUser, db, enforceRateLimit, HttpError, json, safeError, validCpf } from "./_shared.ts"
import { mercadoPagoError, mercadoPagoRequest } from "./_mercado_pago.ts"

function validUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

export default async (request: Request) => {
  if (request.method !== "POST") return json({ error: "Método não permitido." }, 405)
  try {
    assertBodySize(request, 48 * 1024)
    assertTrustedOrigin(request)
    const signedIn = await authenticatedUser(request)
    if (!signedIn?.id || !signedIn.email) throw new HttpError(401, "Sessão inválida.")
    await enforceRateLimit(request, "create-subscription", signedIn.id, 5, 10 * 60)

    const body = await request.json() as {
      userId?: string
      planSlug?: string
      cardToken?: string
      paymentMethodId?: string
      cpf?: string
      deviceId?: string
      idempotencyKey?: string
    }
    if (body.userId !== signedIn.id) throw new HttpError(403, "Usuário da cobrança não corresponde à sessão.")
    const planSlug = String(body.planSlug || "").trim()
    const cardToken = String(body.cardToken || "").trim()
    const paymentMethodId = String(body.paymentMethodId || "").trim().toLowerCase()
    const cpf = String(body.cpf || "").replace(/\D/g, "")
    const idempotencyKey = String(body.idempotencyKey || "").trim()
    if (!planSlug || !cardToken || cardToken.length > 512 || !/^[a-z0-9_-]{2,40}$/i.test(paymentMethodId)) throw new HttpError(400, "Dados do cartão incompletos.")
    if (!validCpf(cpf)) throw new HttpError(400, "Informe um CPF válido.")
    if (!validUuid(idempotencyKey)) throw new HttpError(400, "Chave de idempotência inválida.")

    const cpfMatches = await db("rpc/cpf_belongs_to_user", { method: "POST", body: JSON.stringify({ p_user_id: signedIn.id, p_cpf: cpf }) })
    if (cpfMatches !== true) throw new HttpError(409, "O CPF informado não corresponde ao cadastro desta conta.")

    const plans = await db(`plans?slug=eq.${encodeURIComponent(planSlug)}&active=eq.true&select=id,slug,name,price_cents,billing_months`)
    const plan = plans?.[0]
    if (!plan) throw new HttpError(409, "Plano indisponível.")
    const months = Number(plan.billing_months || 1)
    if (![1, 3].includes(months)) throw new HttpError(409, "Periodicidade do plano inválida.")

    const existingIdempotency = await db(`request_idempotency?scope=eq.create_subscription&user_id=eq.${encodeURIComponent(signedIn.id)}&idempotency_key=eq.${encodeURIComponent(idempotencyKey)}&select=provider_resource_id&limit=1`)
    if (existingIdempotency?.[0]?.provider_resource_id) {
      return json({ subscriptionId: existingIdempotency[0].provider_resource_id, reused: true }, 200)
    }
    if (existingIdempotency?.length) throw new HttpError(409, "Esta assinatura já está sendo processada.")
    await db("request_idempotency", { method: "POST", body: JSON.stringify({ scope: "create_subscription", user_id: signedIn.id, idempotency_key: idempotencyKey }) })

    const currentRows = await db(`recurring_contracts?user_id=eq.${encodeURIComponent(signedIn.id)}&select=*`)
    const current = currentRows?.[0] || null

    const amount = Number(plan.price_cents) / 100
    const appUrl = process.env.APP_URL?.trim() || "https://tributoleve.com.br"
    const externalReference = `tl_sub_${signedIn.id.replace(/-/g, "")}_${plan.slug}`.slice(0, 64)
    const { response, data, requestId } = await mercadoPagoRequest("/preapproval", {
      method: "POST",
      idempotencyKey,
      deviceId: String(body.deviceId || "").trim(),
      body: JSON.stringify({
        reason: `${plan.name} | Tributo Leve`.slice(0, 120),
        external_reference: externalReference,
        payer_email: signedIn.email,
        card_token_id: cardToken,
        auto_recurring: {
          frequency: months,
          frequency_type: "months",
          transaction_amount: amount,
          currency_id: "BRL"
        },
        back_url: appUrl,
        status: "authorized"
      })
    })
    if (!response.ok) {
      const mapped = mercadoPagoError(data, response.status, requestId)
      await db(`request_idempotency?scope=eq.create_subscription&user_id=eq.${encodeURIComponent(signedIn.id)}&idempotency_key=eq.${encodeURIComponent(idempotencyKey)}`, { method: "DELETE" }).catch(() => undefined)
      throw new HttpError(502, mapped.message, mapped.code)
    }

    const providerSubscriptionId = String(data?.id || "")
    if (!providerSubscriptionId) {
      await db(`request_idempotency?scope=eq.create_subscription&user_id=eq.${encodeURIComponent(signedIn.id)}&idempotency_key=eq.${encodeURIComponent(idempotencyKey)}`, { method: "DELETE" }).catch(() => undefined)
      throw new HttpError(502, "O Mercado Pago não retornou o identificador da assinatura.")
    }

    // A nova recorrência só substitui a antiga depois que o provedor aceitou a criação.
    // Cancelar a recorrência anterior não remove o período que já foi pago.
    if (current?.provider_subscription_id && current.provider_subscription_id !== providerSubscriptionId && !["canceled", "expired"].includes(String(current.status))) {
      const canceled = await mercadoPagoRequest(`/preapproval/${encodeURIComponent(current.provider_subscription_id)}`, { method: "PUT", body: JSON.stringify({ status: "canceled" }) })
      if (!canceled.response.ok) {
        // Evita deixar duas cobranças automáticas. Se a anterior não puder ser cancelada,
        // cancela a recém-criada e não efetiva a troca local.
        await mercadoPagoRequest(`/preapproval/${encodeURIComponent(providerSubscriptionId)}`, { method: "PUT", body: JSON.stringify({ status: "canceled" }) }).catch(() => undefined)
        await db(`request_idempotency?scope=eq.create_subscription&user_id=eq.${encodeURIComponent(signedIn.id)}&idempotency_key=eq.${encodeURIComponent(idempotencyKey)}`, { method: "DELETE" }).catch(() => undefined)
        throw new HttpError(502, "Não foi possível substituir a assinatura anterior com segurança. Tente novamente.")
      }
    }

    const payload = {
      user_id: signedIn.id,
      plan_id: plan.id,
      provider: "mercado_pago",
      provider_subscription_id: providerSubscriptionId,
      provider_status: String(data?.status || "authorized"),
      status: "pending_activation",
      amount_cents: Number(plan.price_cents),
      billing_months: months,
      current_period_start: null,
      current_period_end: null,
      next_payment_date: data?.next_payment_date || null,
      grace_until: null,
      cancel_at_period_end: false,
      canceled_at: null,
      card_brand: paymentMethodId,
      card_last4: null,
      last_authorized_payment_id: null,
      last_payment_status: null,
      last_payment_status_detail: null,
      updated_at: new Date().toISOString()
    }
    try {
      if (current?.id) await db(`recurring_contracts?id=eq.${encodeURIComponent(current.id)}`, { method: "PATCH", body: JSON.stringify(payload) })
      else await db("recurring_contracts", { method: "POST", body: JSON.stringify(payload) })

      await db(`request_idempotency?scope=eq.create_subscription&user_id=eq.${encodeURIComponent(signedIn.id)}&idempotency_key=eq.${encodeURIComponent(idempotencyKey)}`, { method: "PATCH", body: JSON.stringify({ provider_resource_id: providerSubscriptionId }) })
      await db("audit_logs", { method: "POST", body: JSON.stringify({ actor_id: signedIn.id, target_user_id: signedIn.id, action: "recurring_subscription_created", metadata: { provider_subscription_id: providerSubscriptionId, plan_id: plan.id, amount_cents: plan.price_cents, billing_months: months } }) })
    } catch (localError) {
      // Compensação: se o provedor criou a recorrência, mas o banco local não conseguiu
      // persistir o vínculo, cancela a recorrência para não gerar cobrança órfã.
      await mercadoPagoRequest(`/preapproval/${encodeURIComponent(providerSubscriptionId)}`, { method: "PUT", body: JSON.stringify({ status: "canceled" }) }).catch(() => undefined)
      await db(`request_idempotency?scope=eq.create_subscription&user_id=eq.${encodeURIComponent(signedIn.id)}&idempotency_key=eq.${encodeURIComponent(idempotencyKey)}`, { method: "DELETE" }).catch(() => undefined)
      throw localError
    }

    return json({ subscriptionId: providerSubscriptionId, status: String(data?.status || "authorized"), nextPaymentDate: data?.next_payment_date || null }, 201)
  } catch (error) {
    return safeError(error, "Não foi possível criar a assinatura automática.")
  }
}

export const config: Config = { path: "/.netlify/functions/create-subscription" }
