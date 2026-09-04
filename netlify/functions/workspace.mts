import type { Config } from "@netlify/functions"
import { activeSubscription, assertBodySize, assertTrustedOrigin, authenticatedUser, db, enforceRateLimit, HttpError, json, safeError } from "./_shared.ts"

type Profile = {
  id: string
  email: string
  full_name: string
  role: "user" | "admin"
  access_status: string
  active_workspace_id?: string | null
}

type Workspace = { id: string; owner_id: string; name: string }
type Membership = { id: string; workspace_id: string; user_id: string; role: "owner" | "editor" | "viewer"; active: boolean }

const BASE_COMPANY_LIMIT = 1
const PORTFOLIO_COMPANY_LIMIT = 100
const BASE_MEMBER_LIMIT = 1
const TEAM_MEMBER_LIMIT = 4 // titular + 3 colaboradores
const SCENARIO_LIMIT = 200

function normalizeCnpj(value: string) { return String(value || "").replace(/\D/g, "") }
function validCnpj(value: string) {
  const cnpj = normalizeCnpj(value)
  if (cnpj.length !== 14 || /^(\d)\1{13}$/.test(cnpj)) return false
  const calc = (length: number) => {
    const weights = length === 12 ? [5,4,3,2,9,8,7,6,5,4,3,2] : [6,5,4,3,2,9,8,7,6,5,4,3,2]
    const sum = weights.reduce((acc, weight, index) => acc + Number(cnpj[index]) * weight, 0)
    const remainder = sum % 11
    return remainder < 2 ? 0 : 11 - remainder
  }
  return calc(12) === Number(cnpj[12]) && calc(13) === Number(cnpj[13])
}

async function getProfile(userId: string): Promise<Profile | null> {
  const rows = await db(`profiles?id=eq.${encodeURIComponent(userId)}&select=id,email,full_name,role,access_status,active_workspace_id`)
  return rows?.[0] || null
}

async function ensureOwnWorkspace(profile: Profile): Promise<Workspace> {
  let rows = await db(`workspaces?owner_id=eq.${encodeURIComponent(profile.id)}&select=id,owner_id,name&limit=1`)
  let workspace = rows?.[0] as Workspace | undefined
  if (!workspace) {
    const created = await db("workspaces", { method: "POST", body: JSON.stringify({ owner_id: profile.id, name: profile.full_name || "Meu escritório" }) })
    workspace = created?.[0]
  }
  if (!workspace) throw new Error("Não foi possível preparar o workspace.")
  await db("workspace_members?on_conflict=workspace_id,user_id", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify({ workspace_id: workspace.id, user_id: profile.id, role: "owner", active: true })
  })
  if (!profile.active_workspace_id) {
    await db(`profiles?id=eq.${encodeURIComponent(profile.id)}`, { method: "PATCH", body: JSON.stringify({ active_workspace_id: workspace.id }) })
    profile.active_workspace_id = workspace.id
  }
  return workspace
}

async function resolveWorkspace(profile: Profile): Promise<{ workspace: Workspace; membership: Membership }> {
  const own = await ensureOwnWorkspace(profile)
  const targetId = profile.active_workspace_id || own.id
  const memberships = await db(`workspace_members?workspace_id=eq.${encodeURIComponent(targetId)}&user_id=eq.${encodeURIComponent(profile.id)}&active=eq.true&select=id,workspace_id,user_id,role,active&limit=1`)
  let membership = memberships?.[0] as Membership | undefined
  let workspace: Workspace | undefined
  if (membership) {
    const rows = await db(`workspaces?id=eq.${encodeURIComponent(targetId)}&select=id,owner_id,name&limit=1`)
    workspace = rows?.[0]
  }
  if (!membership || !workspace) {
    workspace = own
    const rows = await db(`workspace_members?workspace_id=eq.${encodeURIComponent(own.id)}&user_id=eq.${encodeURIComponent(profile.id)}&active=eq.true&select=id,workspace_id,user_id,role,active&limit=1`)
    membership = rows?.[0]
    await db(`profiles?id=eq.${encodeURIComponent(profile.id)}`, { method: "PATCH", body: JSON.stringify({ active_workspace_id: own.id }) })
  }
  if (!membership || !workspace) throw new Error("Membership do workspace não encontrado.")
  return { workspace, membership }
}

async function featureContext(workspace: Workspace, currentProfile: Profile, previewEssential = false) {
  const products = await db("products?active=eq.true&select=id,slug,name,description,price_cents,feature_key&order=price_cents.asc")
  const entitlements = await db(`entitlements?user_id=eq.${encodeURIComponent(workspace.owner_id)}&active=eq.true&select=product_id`)
  const ownedIds = new Set((entitlements || []).map((item: any) => item.product_id))
  const moduleFeatures = (products || []).filter((product: any) => ownedIds.has(product.id)).map((product: any) => product.feature_key)
  const adminBypass = currentProfile.role === "admin" && !previewEssential
  const ownerRows = await db(`profiles?id=eq.${encodeURIComponent(workspace.owner_id)}&select=id,role,access_status&limit=1`)
  const owner = ownerRows?.[0]

  let plan: any = { slug: "basico-mensal", name: "Leve Start", company_limit: 1, included_features: [], billing_months: 1 }
  let planActive = adminBypass || Boolean(owner?.access_status === "test_access") || (currentProfile.role === "admin" && previewEssential)
  if (!previewEssential || currentProfile.role !== "admin") {
    const subscriptions = await db(`subscriptions?user_id=eq.${encodeURIComponent(workspace.owner_id)}&select=plan_id,status,expires_at,grace_until&limit=1`)
    const subscription = subscriptions?.[0]
    const valid = activeSubscription(subscription)
    planActive = planActive || valid
    if (subscription?.plan_id && valid) {
      const plans = await db(`plans?id=eq.${encodeURIComponent(subscription.plan_id)}&select=id,slug,name,billing_months,company_limit,included_features&limit=1`)
      if (plans?.[0]) plan = plans[0]
    }
  }

  const planFeatures = Array.isArray(plan.included_features) ? plan.included_features : []
  const features = Array.from(new Set(adminBypass ? ["portfolio", "executive_report", "team"] : [...planFeatures, ...moduleFeatures]))
  const hasFullPortfolio = adminBypass || moduleFeatures.includes("portfolio")
  const planCompanyLimit = Math.max(BASE_COMPANY_LIMIT, Number(plan.company_limit || 1))
  return {
    products,
    features,
    moduleFeatures,
    plan,
    planActive,
    adminBypass,
    limits: {
      companies: hasFullPortfolio ? PORTFOLIO_COMPANY_LIMIT : planCompanyLimit,
      members: features.includes("team") ? TEAM_MEMBER_LIMIT : BASE_MEMBER_LIMIT,
      scenarios: SCENARIO_LIMIT
    }
  }
}

async function buildContext(profile: Profile, previewEssential = false) {
  const { workspace, membership } = await resolveWorkspace(profile)
  const features = await featureContext(workspace, profile, previewEssential)
  const [companies, scenarios, memberRows, invites, branding] = await Promise.all([
    db(`client_companies?workspace_id=eq.${encodeURIComponent(workspace.id)}&active=eq.true&select=id,name,cnpj,notes,tag,created_at,updated_at&order=updated_at.desc&limit=100`),
    db(`saved_scenarios?workspace_id=eq.${encodeURIComponent(workspace.id)}&select=id,client_id,created_by,name,state,saved_at,updated_at&order=saved_at.desc&limit=${SCENARIO_LIMIT}`),
    db(`workspace_members?workspace_id=eq.${encodeURIComponent(workspace.id)}&active=eq.true&select=id,user_id,role,joined_at&order=joined_at.asc`),
    membership.role === "owner" ? db(`workspace_invites?workspace_id=eq.${encodeURIComponent(workspace.id)}&accepted_at=is.null&revoked_at=is.null&select=id,invited_email,role,token,expires_at,created_at&order=created_at.desc&limit=30`) : Promise.resolve([]),
    db(`report_branding?workspace_id=eq.${encodeURIComponent(workspace.id)}&select=office_name,responsible_name,contact_line,footer_text,updated_at&limit=1`)
  ])
  const memberIds = (memberRows || []).map((item: any) => item.user_id)
  const profiles = memberIds.length ? await db(`profiles?id=in.(${memberIds.join(",")})&select=id,email,full_name,access_status`) : []
  const profileMap = new Map((profiles || []).map((item: any) => [item.id, item]))
  const members = (memberRows || []).map((item: any) => ({ ...item, profile: profileMap.get(item.user_id) || null }))
  return {
    workspace,
    membership,
    ownerId: workspace.owner_id,
    isOwner: membership.role === "owner",
    canEdit: membership.role !== "viewer",
    canAccessViaTeam: membership.role !== "owner" && membership.active && features.planActive,
    ...features,
    companies: companies || [],
    scenarios: scenarios || [],
    members,
    invites: invites || [],
    branding: branding?.[0] || { office_name: "", responsible_name: "", contact_line: "", footer_text: "" }
  }
}

async function requireUser(request: Request) {
  const auth = await authenticatedUser(request)
  if (!auth) return null
  const profile = await getProfile(auth.id)
  if (!profile) return null
  return { auth, profile }
}

export default async (request: Request) => {
  try {
    const session = await requireUser(request)
    if (!session) return json({ error: "Sessão inválida." }, 401)
    const { profile, auth } = session

    if (request.method === "GET") {
      await enforceRateLimit(request, "workspace-read", profile.id, 60, 60)
      const url = new URL(request.url)
      const previewEssential = profile.role === "admin" && url.searchParams.get("previewEssential") === "1"
      const context = await buildContext(profile, previewEssential)
      if (!context.isOwner && !context.planActive && !context.adminBypass) return json({ error: "A assinatura do titular está sem vigência." }, 403)
      return json(context)
    }

    if (request.method !== "POST") return json({ error: "Método não permitido." }, 405)
    assertBodySize(request, 128 * 1024)
    assertTrustedOrigin(request)
    await enforceRateLimit(request, "workspace-write", profile.id, 90, 60)
    const body = await request.json() as Record<string, any>
    const action = String(body.action || "")

    if (action === "accept_invite") {
      const token = String(body.token || "").trim()
      if (!token) return json({ error: "Convite inválido." }, 400)
      const rows = await db(`workspace_invites?token=eq.${encodeURIComponent(token)}&accepted_at=is.null&revoked_at=is.null&select=id,workspace_id,invited_email,role,expires_at&limit=1`)
      const invite = rows?.[0]
      if (!invite) return json({ error: "Convite não encontrado ou já utilizado." }, 404)
      if (new Date(invite.expires_at).getTime() < Date.now()) return json({ error: "Este convite expirou. Solicite um novo ao titular." }, 410)
      if (String(invite.invited_email).trim().toLowerCase() !== String(auth.email || profile.email).trim().toLowerCase()) return json({ error: "Este convite foi criado para outro e-mail." }, 403)
      const workspaceRows = await db(`workspaces?id=eq.${encodeURIComponent(invite.workspace_id)}&select=id,owner_id,name&limit=1`)
      const workspace = workspaceRows?.[0] as Workspace | undefined
      if (!workspace) return json({ error: "Workspace do convite não encontrado." }, 404)
      const feature = await featureContext(workspace, profile, false)
      if ((!feature.features.includes("team") || !feature.planActive) && profile.role !== "admin") return json({ error: "O titular não possui uma assinatura vigente com Equipe adicional ativa." }, 403)
      const activeMembers = await db(`workspace_members?workspace_id=eq.${encodeURIComponent(workspace.id)}&active=eq.true&select=id`)
      if ((activeMembers || []).length >= TEAM_MEMBER_LIMIT) return json({ error: "O limite de 3 colaboradores adicionais foi atingido." }, 409)
      await db("workspace_members?on_conflict=workspace_id,user_id", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=representation" }, body: JSON.stringify({ workspace_id: workspace.id, user_id: profile.id, role: invite.role, active: true }) })
      await db(`workspace_invites?id=eq.${encodeURIComponent(invite.id)}`, { method: "PATCH", body: JSON.stringify({ accepted_at: new Date().toISOString() }) })
      await db(`profiles?id=eq.${encodeURIComponent(profile.id)}`, { method: "PATCH", body: JSON.stringify({ active_workspace_id: workspace.id }) })
      return json({ ok: true, workspaceId: workspace.id, workspaceName: workspace.name })
    }

    const previewEssential = profile.role === "admin" && Boolean(body.previewEssential)
    const context = await buildContext(profile, previewEssential)
    const workspaceId = context.workspace.id
    const isOwner = context.isOwner
    const canEdit = context.canEdit

    if (action === "switch_personal_workspace") {
      const own = await ensureOwnWorkspace(profile)
      await db(`profiles?id=eq.${encodeURIComponent(profile.id)}`, { method: "PATCH", body: JSON.stringify({ active_workspace_id: own.id }) })
      return json({ ok: true, workspaceId: own.id })
    }

    if (!context.planActive && !context.adminBypass) return json({ error: "A assinatura do titular está sem vigência. Renove o plano antes de alterar o workspace.", code: "SUBSCRIPTION_REQUIRED" }, 403)

    if (action === "upsert_company") {
      if (!canEdit) return json({ error: "Seu perfil é somente leitura." }, 403)
      const cnpj = normalizeCnpj(body.cnpj)
      const name = String(body.name || "").trim()
      if (!validCnpj(cnpj)) return json({ error: "Informe um CNPJ válido para vincular a empresa." }, 400)
      if (!name) return json({ error: "Informe o nome da empresa." }, 400)
      const existingSame = context.companies.find((item: any) => item.cnpj === cnpj)
      const requestedId = String(body.id || "")
      const existingById = context.companies.find((item: any) => item.id === requestedId)
      if (!existingSame && !existingById && context.companies.length >= context.limits.companies) {
        return json({ error: context.features.includes("portfolio") ? `Sua carteira atingiu o limite de ${context.limits.companies} CNPJs.` : "Seu plano atingiu o limite de CNPJs. Faça upgrade ou adquira Carteira de clientes para ampliar a capacidade.", code: "PORTFOLIO_REQUIRED" }, 409)
      }
      if (!context.features.includes("portfolio") && context.companies.length === 1 && !existingSame && !existingById) {
        return json({ error: "Esta conta já está vinculada a outro CNPJ. O módulo Carteira de clientes libera múltiplos CNPJs.", code: "PORTFOLIO_REQUIRED" }, 409)
      }
      if (existingById && existingById.cnpj !== cnpj && !context.features.includes("portfolio")) {
        return json({ error: "O CNPJ principal fica vinculado ao plano Leve Start. Para administrar outro CNPJ, habilite Carteira de clientes.", code: "PORTFOLIO_REQUIRED" }, 409)
      }
      if (existingById) {
        const updated = await db(`client_companies?id=eq.${encodeURIComponent(existingById.id)}&workspace_id=eq.${encodeURIComponent(workspaceId)}`, { method: "PATCH", body: JSON.stringify({ name, cnpj, notes: String(body.notes || ""), tag: String(body.tag || ""), updated_at: new Date().toISOString() }) })
        return json({ ok: true, company: updated?.[0] })
      }
      if (existingSame) {
        const updated = await db(`client_companies?id=eq.${encodeURIComponent(existingSame.id)}`, { method: "PATCH", body: JSON.stringify({ name, notes: String(body.notes || existingSame.notes || ""), tag: String(body.tag || existingSame.tag || ""), updated_at: new Date().toISOString() }) })
        return json({ ok: true, company: updated?.[0] })
      }
      const created = await db("client_companies", { method: "POST", body: JSON.stringify({ workspace_id: workspaceId, name, cnpj, notes: String(body.notes || ""), tag: String(body.tag || ""), created_by: profile.id }) })
      return json({ ok: true, company: created?.[0] })
    }

    if (action === "delete_company") {
      if (!canEdit) return json({ error: "Seu perfil é somente leitura." }, 403)
      if (!context.features.includes("portfolio")) return json({ error: "A empresa principal do plano Leve Start não pode ser removida por esta tela." }, 403)
      const companyId = String(body.companyId || "")
      await db(`client_companies?id=eq.${encodeURIComponent(companyId)}&workspace_id=eq.${encodeURIComponent(workspaceId)}`, { method: "DELETE" })
      return json({ ok: true })
    }

    if (action === "save_scenario") {
      if (!canEdit) return json({ error: "Seu perfil é somente leitura." }, 403)
      const companyId = String(body.companyId || "")
      const company = context.companies.find((item: any) => item.id === companyId)
      if (!company) return json({ error: "Vincule o cenário a um CNPJ da conta antes de salvar." }, 400)
      if (context.scenarios.length >= context.limits.scenarios) return json({ error: `Limite de ${context.limits.scenarios} cenários atingido.` }, 409)
      const name = String(body.name || company.name || "Cenário").trim()
      const state = body.state
      if (!state || typeof state !== "object") return json({ error: "Estado do cenário inválido." }, 400)
      const created = await db("saved_scenarios", { method: "POST", body: JSON.stringify({ workspace_id: workspaceId, client_id: companyId, created_by: profile.id, name, state }) })
      return json({ ok: true, scenario: created?.[0] })
    }

    if (action === "delete_scenario") {
      if (!canEdit) return json({ error: "Seu perfil é somente leitura." }, 403)
      await db(`saved_scenarios?id=eq.${encodeURIComponent(String(body.scenarioId || ""))}&workspace_id=eq.${encodeURIComponent(workspaceId)}`, { method: "DELETE" })
      return json({ ok: true })
    }

    if (action === "invite_member") {
      if (!isOwner) return json({ error: "Somente o titular pode convidar colaboradores." }, 403)
      if (!context.features.includes("team")) return json({ error: "Adquira o módulo Equipe adicional para convidar colaboradores.", code: "TEAM_REQUIRED" }, 403)
      const email = String(body.email || "").trim().toLowerCase()
      const role = body.role === "viewer" ? "viewer" : "editor"
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: "Informe um e-mail válido." }, 400)
      if (context.members.length >= context.limits.members) return json({ error: "O módulo Equipe adicional inclui até 3 colaboradores além do titular." }, 409)
      if (context.members.some((item: any) => String(item.profile?.email || "").toLowerCase() === email)) return json({ error: "Este usuário já faz parte da equipe." }, 409)
      await db(`workspace_invites?workspace_id=eq.${encodeURIComponent(workspaceId)}&invited_email=eq.${encodeURIComponent(email)}&accepted_at=is.null&revoked_at=is.null`, { method: "PATCH", body: JSON.stringify({ revoked_at: new Date().toISOString() }) })
      const created = await db("workspace_invites", { method: "POST", body: JSON.stringify({ workspace_id: workspaceId, invited_email: email, role, created_by: profile.id }) })
      const invite = created?.[0]
      const base = process.env.APP_URL?.trim() || "https://tributoleve.com.br"
      return json({ ok: true, invite, inviteUrl: `${base}/?invite=${invite.token}` })
    }

    if (action === "remove_member") {
      if (!isOwner) return json({ error: "Somente o titular pode remover colaboradores." }, 403)
      const memberId = String(body.memberId || "")
      const member = context.members.find((item: any) => item.id === memberId)
      if (!member || member.role === "owner") return json({ error: "Colaborador não encontrado." }, 404)
      await db(`workspace_members?id=eq.${encodeURIComponent(memberId)}`, { method: "PATCH", body: JSON.stringify({ active: false }) })
      const memberProfile = await getProfile(member.user_id)
      if (memberProfile) {
        const own = await ensureOwnWorkspace(memberProfile)
        await db(`profiles?id=eq.${encodeURIComponent(member.user_id)}`, { method: "PATCH", body: JSON.stringify({ active_workspace_id: own.id }) })
      }
      return json({ ok: true })
    }

    if (action === "update_member_role") {
      if (!isOwner) return json({ error: "Somente o titular pode alterar permissões." }, 403)
      const role = body.role === "viewer" ? "viewer" : "editor"
      const memberId = String(body.memberId || "")
      const member = context.members.find((item: any) => item.id === memberId)
      if (!member || member.role === "owner") return json({ error: "Colaborador não encontrado." }, 404)
      await db(`workspace_members?id=eq.${encodeURIComponent(memberId)}`, { method: "PATCH", body: JSON.stringify({ role }) })
      return json({ ok: true, role })
    }

    if (action === "revoke_invite") {
      if (!isOwner) return json({ error: "Somente o titular pode revogar convites." }, 403)
      await db(`workspace_invites?id=eq.${encodeURIComponent(String(body.inviteId || ""))}&workspace_id=eq.${encodeURIComponent(workspaceId)}`, { method: "PATCH", body: JSON.stringify({ revoked_at: new Date().toISOString() }) })
      return json({ ok: true })
    }

    if (action === "save_branding") {
      if (!context.features.includes("executive_report")) return json({ error: "O módulo Relatório executivo é necessário para personalizar a apresentação.", code: "REPORT_REQUIRED" }, 403)
      if (!canEdit) return json({ error: "Seu perfil é somente leitura." }, 403)
      const payload = {
        workspace_id: workspaceId,
        office_name: String(body.officeName || "").slice(0, 120),
        responsible_name: String(body.responsibleName || "").slice(0, 120),
        contact_line: String(body.contactLine || "").slice(0, 180),
        footer_text: String(body.footerText || "").slice(0, 240),
        updated_by: profile.id,
        updated_at: new Date().toISOString()
      }
      const saved = await db("report_branding?on_conflict=workspace_id", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=representation" }, body: JSON.stringify(payload) })
      return json({ ok: true, branding: saved?.[0] })
    }

    return json({ error: "Ação não reconhecida." }, 400)
  } catch (error) {
    return safeError(error, "Falha na operação do workspace.")
  }
}

export const config: Config = { path: "/.netlify/functions/workspace" }
