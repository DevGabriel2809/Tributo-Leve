import type { Config } from "@netlify/functions"
import { activeSubscription, addMonthsIso, adminClient, assertBodySize, assertTrustedOrigin, db, enforceRateLimit, HttpError, json, requireAdmin, safeError } from "./_shared.ts"
import { mercadoPagoError, mercadoPagoRequest } from "./_mercado_pago.ts"

async function cancelRecurringSafely(userId: string, actorId: string, reason: string) {
  const rows = await db(`recurring_contracts?user_id=eq.${encodeURIComponent(userId)}&select=id,provider_subscription_id,status,provider_status`)
  const contract = rows?.[0]
  if (!contract?.provider_subscription_id || ["canceled", "expired"].includes(String(contract.status))) return
  const provider = await mercadoPagoRequest(`/preapproval/${encodeURIComponent(contract.provider_subscription_id)}`, { method: "PUT", body: JSON.stringify({ status: "canceled" }) })
  if (!provider.response.ok) {
    const mapped = mercadoPagoError(provider.data, provider.response.status, provider.requestId)
    throw new HttpError(502, `A recorrência não pôde ser cancelada com segurança: ${mapped.message}`)
  }
  await db(`recurring_contracts?id=eq.${encodeURIComponent(contract.id)}`, { method: "PATCH", body: JSON.stringify({ provider_status: "canceled", status: "canceled", cancel_at_period_end: true, canceled_at: new Date().toISOString(), updated_at: new Date().toISOString() }) })
  await db("audit_logs", { method: "POST", body: JSON.stringify({ actor_id: actorId, target_user_id: userId, action: "admin_recurring_canceled", reason, metadata: { provider_subscription_id: contract.provider_subscription_id } }) })
}

export default async (request: Request) => {
  try {
    const admin = await requireAdmin(request)
    if (!admin) throw new HttpError(403, "Acesso administrativo necessário.")

    if (request.method === "GET") {
      await enforceRateLimit(request, "admin-overview-read", admin.id, 60, 60)
      const [profiles, payments, plans, products, audit, recurring, subscriptions, presence] = await Promise.all([
        db("profiles?select=id,email,full_name,role,access_status,created_at,updated_at&order=created_at.desc&limit=300"),
        db("payments?select=id,user_id,provider_payment_id,provider_order_id,provider_transaction_id,provider_api,method,status,raw_status,amount_cents,paid_at,created_at&order=created_at.desc&limit=300"),
        db("plans?select=id,slug,name,description,price_cents,active,billing_months,company_limit,included_features,badge,recommended,sort_order&order=sort_order.asc"),
        db("products?select=id,slug,name,description,price_cents,active,feature_key&order=price_cents.asc"),
        db("audit_logs?select=id,actor_id,target_user_id,action,reason,metadata,created_at&order=created_at.desc&limit=150"),
        db("recurring_contracts?select=user_id,plan_id,status,provider_status,amount_cents,billing_months,current_period_end,next_payment_date,grace_until,cancel_at_period_end,card_brand,card_last4,last_payment_status,updated_at&order=updated_at.desc&limit=300"),
        db("subscriptions?select=user_id,plan_id,status,expires_at,grace_until,renewal_mode,next_billing_at&limit=300"),
        db("user_presence?select=user_id,current_area,last_seen_at&order=last_seen_at.desc&limit=300")
      ])
      const estimatedMrrCents = (recurring || []).filter((item: any) => ["active", "past_due", "pending_activation"].includes(String(item.status)) && !item.cancel_at_period_end).reduce((sum: number, item: any) => sum + Math.round(Number(item.amount_cents || 0) / Math.max(1, Number(item.billing_months || 1))), 0)
      const effectiveActive = (subscriptions || []).filter((item: any) => activeSubscription(item)).length
      const onlineCutoff = Date.now() - 2 * 60 * 1000
      const online = (presence || []).filter((item: any) => new Date(item.last_seen_at).getTime() >= onlineCutoff)
      return json({ profiles, payments, plans, products, audit, recurring, subscriptions, online, metrics: { estimatedMrrCents, effectiveActive, onlineNow: online.length }, adminId: admin.id })
    }

    if (request.method !== "POST") return json({ error: "Método não permitido" }, 405)
    assertBodySize(request, 32 * 1024)
    assertTrustedOrigin(request)
    await enforceRateLimit(request, "admin-overview-write", admin.id, 30, 10 * 60)
    const body = await request.json() as { action?: string; userId?: string; reason?: string; productId?: string; planId?: string; priceCents?: number }

    if (body.action === "update_plan_price") {
      if (!body.planId || !Number.isInteger(body.priceCents) || Number(body.priceCents) < 1 || Number(body.priceCents) > 100000000) throw new HttpError(400, "Informe um preço entre R$ 0,01 e R$ 1.000.000,00.")
      const plans = await db(`plans?id=eq.${encodeURIComponent(body.planId)}&select=id,name,price_cents`)
      const plan = plans?.[0]; if (!plan) throw new HttpError(404, "Plano não encontrado.")
      await db(`plans?id=eq.${encodeURIComponent(body.planId)}`, { method: "PATCH", body: JSON.stringify({ price_cents: body.priceCents }) })
      await db("audit_logs", { method: "POST", body: JSON.stringify({ actor_id: admin.id, target_user_id: null, action: "plan_price_updated", reason: body.reason || "Preço alterado no painel administrativo", metadata: { plan_id: plan.id, previous_price_cents: plan.price_cents, new_price_cents: body.priceCents } }) })
      return json({ ok: true, priceCents: body.priceCents })
    }

    if (body.action === "update_product_price") {
      if (!body.productId || !Number.isInteger(body.priceCents) || Number(body.priceCents) < 1 || Number(body.priceCents) > 100000000) throw new HttpError(400, "Informe um preço entre R$ 0,01 e R$ 1.000.000,00.")
      const products = await db(`products?id=eq.${encodeURIComponent(body.productId)}&select=id,name,price_cents`)
      const product = products?.[0]; if (!product) throw new HttpError(404, "Módulo não encontrado.")
      await db(`products?id=eq.${encodeURIComponent(body.productId)}`, { method: "PATCH", body: JSON.stringify({ price_cents: body.priceCents }) })
      await db("audit_logs", { method: "POST", body: JSON.stringify({ actor_id: admin.id, target_user_id: null, action: "product_price_updated", reason: body.reason || "Preço do módulo alterado", metadata: { product_id: product.id, previous_price_cents: product.price_cents, new_price_cents: body.priceCents } }) })
      return json({ ok: true, priceCents: body.priceCents })
    }

    if (!body.userId || !body.action) throw new HttpError(400, "Ação inválida.")
    if (!/^[0-9a-f-]{36}$/i.test(body.userId)) throw new HttpError(400, "Usuário inválido.")

    if (body.action === "delete_user") {
      if (body.userId === admin.id) throw new HttpError(400, "Você não pode excluir a própria conta administrativa enquanto está logado.")
      if (!body.reason?.trim()) throw new HttpError(400, "Informe o motivo da exclusão.")
      const profiles = await db(`profiles?id=eq.${encodeURIComponent(body.userId)}&select=id,email,full_name,role`)
      const target = profiles?.[0]
      if (!target) throw new HttpError(404, "Usuário não encontrado.")

      // Primeiro cancela qualquer renovação automática. Se o provedor falhar, a conta NÃO é apagada.
      await cancelRecurringSafely(body.userId, admin.id, "Cancelamento automático antes da exclusão da conta")
      await Promise.all([
        db(`audit_logs?actor_id=eq.${encodeURIComponent(body.userId)}`, { method: "PATCH", body: JSON.stringify({ actor_id: null }) }),
        db(`audit_logs?target_user_id=eq.${encodeURIComponent(body.userId)}`, { method: "PATCH", body: JSON.stringify({ target_user_id: null }) }),
        db(`consent_events?user_id=eq.${encodeURIComponent(body.userId)}`, { method: "PATCH", body: JSON.stringify({ user_id: null }) }),
        db(`entitlements?granted_by=eq.${encodeURIComponent(body.userId)}`, { method: "PATCH", body: JSON.stringify({ granted_by: null }) })
      ])
      const client = adminClient()
      const { error } = await client.auth.admin.deleteUser(body.userId)
      if (error) throw new Error(`Supabase Auth recusou a exclusão: ${error.message}`)
      await db("audit_logs", { method: "POST", body: JSON.stringify({ actor_id: admin.id, target_user_id: null, action: "user_deleted", reason: body.reason.trim(), metadata: { deleted_user_id: body.userId, deleted_email: target.email, deleted_name: target.full_name, deleted_role: target.role } }) })
      return json({ ok: true, deletedUserId: body.userId })
    }

    if (body.action === "block") {
      if (!body.reason?.trim()) throw new HttpError(400, "Informe o motivo do bloqueio.")
      await cancelRecurringSafely(body.userId, admin.id, "Cancelamento automático antes do bloqueio administrativo")
      await db(`profiles?id=eq.${encodeURIComponent(body.userId)}`, { method: "PATCH", body: JSON.stringify({ access_status: "blocked", updated_at: new Date().toISOString() }) })
      await db("audit_logs", { method: "POST", body: JSON.stringify({ actor_id: admin.id, target_user_id: body.userId, action: "block", reason: body.reason }) })
      return json({ ok: true, status: "blocked" })
    }

    if (body.action === "grant_test") {
      await db(`profiles?id=eq.${encodeURIComponent(body.userId)}`, { method: "PATCH", body: JSON.stringify({ access_status: "test_access", updated_at: new Date().toISOString() }) })
      await db("audit_logs", { method: "POST", body: JSON.stringify({ actor_id: admin.id, target_user_id: body.userId, action: "grant_test", reason: body.reason || "Acesso de teste administrativo" }) })
      return json({ ok: true, status: "test_access" })
    }

    if (body.action === "activate") {
      // Ativação manual substitui a renovação automática existente para evitar cobrança órfã/duplicada.
      await cancelRecurringSafely(body.userId, admin.id, "Cancelamento automático antes da ativação manual")
      const existing = await db(`subscriptions?user_id=eq.${encodeURIComponent(body.userId)}&select=plan_id&limit=1`)
      let planId = existing?.[0]?.plan_id || null
      let plan: any = null
      if (planId) plan = (await db(`plans?id=eq.${encodeURIComponent(planId)}&select=id,billing_months&limit=1`))?.[0]
      if (!plan) plan = (await db("plans?slug=eq.basico-mensal&active=eq.true&select=id,billing_months&limit=1"))?.[0]
      if (!plan) throw new HttpError(409, "Nenhum plano ativo foi encontrado para a ativação manual.")
      planId = plan.id
      const now = new Date().toISOString()
      const expiresAt = addMonthsIso(now, Number(plan.billing_months || 1))
      await db(`profiles?id=eq.${encodeURIComponent(body.userId)}`, { method: "PATCH", body: JSON.stringify({ access_status: "active", updated_at: now }) })
      await db("subscriptions?on_conflict=user_id", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=representation" }, body: JSON.stringify({ user_id: body.userId, plan_id: planId, status: "active", activated_at: now, expires_at: expiresAt, renewal_mode: "manual", grace_until: null, next_billing_at: null, recurring_contract_id: null, updated_at: now }) })
      await db("audit_logs", { method: "POST", body: JSON.stringify({ actor_id: admin.id, target_user_id: body.userId, action: "activate", reason: body.reason || "Ativação manual", metadata: { expires_at: expiresAt, plan_id: planId } }) })
      return json({ ok: true, status: "active", expiresAt })
    }

    throw new HttpError(400, "Ação não reconhecida.")
  } catch (error) {
    return safeError(error, "Não foi possível concluir a operação administrativa.")
  }
}

export const config: Config = { path: "/.netlify/functions/admin-overview" }
