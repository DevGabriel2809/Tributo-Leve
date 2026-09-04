import type { Config } from "@netlify/functions"
import { adminClient, assertBodySize, assertTrustedOrigin, DatabaseRequestError, db, enforceRateLimit, HttpError, json, safeError, validCpf } from "./_shared.ts"
import { verifyTurnstile } from "./_turnstile.ts"

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const CURRENT_POLICY_VERSION = "2026-09-04-v1"

function registrationDatabaseMessage(error: unknown) {
  if (!(error instanceof DatabaseRequestError)) return null
  if (error.code === "23505") return { status: 409, error: "Este CPF já está vinculado a uma conta." }
  if (["PGRST202", "PGRST204"].includes(error.code || "") || error.status === 404) {
    return { status: 503, error: "O cadastro está temporariamente indisponível porque o banco ainda não recebeu a atualização de cadastro." }
  }
  return { status: 503, error: "Não foi possível validar o cadastro no banco de dados. Tente novamente em instantes." }
}

export default async (request: Request) => {
  if (request.method !== "POST") return json({ error: "Método não permitido." }, 405)

  try {
    assertBodySize(request, 32 * 1024)
    assertTrustedOrigin(request)
    const body = await request.json() as { name?: string; email?: string; password?: string; cpf?: string; website?: string; inviteToken?: string; turnstileToken?: string; acceptedTerms?: boolean; acceptedPrivacy?: boolean; policyVersion?: string }
    const name = String(body.name || "").trim().replace(/\s+/g, " ")
    const email = String(body.email || "").trim().toLowerCase()
    const password = String(body.password || "")
    const cpf = String(body.cpf || "").replace(/\D/g, "")
    const inviteToken = String(body.inviteToken || "").trim()
    // Dois limites independentes reduzem abuso por troca de e-mail e por repetição no mesmo cadastro.
    await enforceRateLimit(request, "register-user-ip", "ip", 20, 60 * 60)
    await enforceRateLimit(request, "register-user-email", email || "anonymous", 6, 15 * 60)
    await verifyTurnstile(request, String(body.turnstileToken || ""), "register")
    let validTeamInvite: any = null

    // Campo invisível preenchido apenas por robôs simples.
    if (body.website) return json({ error: "Cadastro não autorizado." }, 400)
    if (name.length < 3 || name.length > 120) return json({ error: "Informe o nome completo." }, 400)
    if (!emailPattern.test(email) || email.length > 254) return json({ error: "Informe um e-mail válido." }, 400)
    if (password.length < 8 || password.length > 128) return json({ error: "A senha deve ter entre 8 e 128 caracteres." }, 400)
    if (body.acceptedTerms !== true || body.acceptedPrivacy !== true) return json({ error: "Aceite os Termos de Uso e a Política de Privacidade para criar a conta." }, 400)
    if (String(body.policyVersion || "") !== CURRENT_POLICY_VERSION) return json({ error: "Os termos exibidos foram atualizados. Recarregue a página e tente novamente." }, 409)

    if (inviteToken) {
      const invites = await db(`workspace_invites?token=eq.${encodeURIComponent(inviteToken)}&accepted_at=is.null&revoked_at=is.null&select=id,workspace_id,invited_email,expires_at&limit=1`)
      validTeamInvite = invites?.[0]
      if (!validTeamInvite) return json({ error: "Convite de equipe inválido ou já utilizado." }, 404)
      if (new Date(validTeamInvite.expires_at).getTime() < Date.now()) return json({ error: "Este convite de equipe expirou." }, 410)
      if (String(validTeamInvite.invited_email).trim().toLowerCase() !== email) return json({ error: "Este convite foi criado para outro e-mail." }, 403)
    } else if (!validCpf(cpf)) return json({ error: "Informe um CPF válido." }, 400)

    const admin = adminClient()
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: validTeamInvite ? { full_name: name, invited_workspace: validTeamInvite.workspace_id } : { full_name: name, cpf_last4: cpf.slice(-4) }
    })

    if (error || !data.user) {
      const message = error?.message || ""
      const duplicate = /already|registered|exists|duplicate/i.test(message)
      console.error("register-user:create-user", { message, status: (error as any)?.status, code: (error as any)?.code })
      return json({ error: duplicate ? "Já existe uma conta com este e-mail." : "Não foi possível criar a conta no serviço de autenticação." }, duplicate ? 409 : 502)
    }

    // Colaboradores convidados não são pagadores do plano e não precisam
    // registrar CPF. O vínculo com o workspace é concluído após o primeiro login.
    if (!validTeamInvite) {
      // A unicidade do CPF é garantida pelo índice UNIQUE no banco. Fazemos a
      // associação depois de criar o usuário e apagamos a conta se ela falhar,
      // evitando cadastros órfãos.
      try {
        await db("rpc/claim_cpf", {
          method: "POST",
          body: JSON.stringify({ p_user_id: data.user.id, p_cpf: cpf })
        })
      } catch (claimError) {
        await admin.auth.admin.deleteUser(data.user.id).catch((cleanupError) => {
          console.error("register-user:cleanup", cleanupError)
        })
        const mapped = registrationDatabaseMessage(claimError)
        if (mapped) return json({ error: mapped.error }, mapped.status)
        throw claimError
      }
    }

    try {
      await db("consent_events", {
        method: "POST",
        body: JSON.stringify({
          user_id: data.user.id,
          necessary: true,
          analytics: false,
          policy_version: CURRENT_POLICY_VERSION,
        }),
      })
    } catch (consentError) {
      // A conta não fica ativa sem registro mínimo da concordância contratual.
      await admin.auth.admin.deleteUser(data.user.id).catch(() => undefined)
      throw consentError
    }

    return json({ ok: true, invited: Boolean(validTeamInvite) }, 201)
  } catch (error) {
    console.error("register-user", error)
    if (error instanceof HttpError) return safeError(error)
    if (error instanceof SyntaxError) return json({ error: "Dados de cadastro inválidos." }, 400)
    if (error instanceof Error && /Configuração ausente:/.test(error.message)) {
      console.error("register-user:missing-config", { message: error.message })
      return json({ error: "O cadastro está temporariamente indisponível por configuração do servidor.", code: "SERVER_CONFIG_MISSING" }, 503)
    }
    return json({ error: "Não foi possível concluir o cadastro." }, 500)
  }
}

export const config: Config = { path: "/.netlify/functions/register-user" }
