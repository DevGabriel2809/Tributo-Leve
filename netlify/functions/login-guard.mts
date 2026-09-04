import type { Config } from "@netlify/functions"
import { assertBodySize, assertTrustedOrigin, enforceRateLimit, HttpError, json, safeError } from "./_shared.ts"
import { verifyTurnstile } from "./_turnstile.ts"

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default async (request: Request) => {
  if (request.method !== "POST") return json({ error: "Método não permitido." }, 405)
  try {
    assertBodySize(request, 8 * 1024)
    assertTrustedOrigin(request)
    const body = await request.json() as { email?: string; turnstileToken?: string }
    const email = String(body.email || "").trim().toLowerCase()
    if (!emailPattern.test(email) || email.length > 254) throw new HttpError(400, "Informe um e-mail válido.")

    // O Supabase também possui rate limit de autenticação. Este guarda adiciona
    // uma camada própria na borda da aplicação sem receber a senha do usuário.
    await enforceRateLimit(request, "login-ip", "ip", 40, 15 * 60)
    await enforceRateLimit(request, "login-email", email, 10, 15 * 60)
    await verifyTurnstile(request, String(body.turnstileToken || ""), "login")
    return json({ ok: true })
  } catch (error) {
    return safeError(error, "Não foi possível validar a tentativa de login.")
  }
}

export const config: Config = { path: "/.netlify/functions/login-guard" }
