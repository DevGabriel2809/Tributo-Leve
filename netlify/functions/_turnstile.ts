import { HttpError, requestIp } from "./_shared.ts"

type TurnstileResponse = {
  success?: boolean
  action?: string
  hostname?: string
  "error-codes"?: string[]
}

function isRequired() {
  return /^(1|true|yes)$/i.test(process.env.TURNSTILE_REQUIRED?.trim() || "")
}

export async function verifyTurnstile(request: Request, token: string, expectedAction: string) {
  const secret = process.env.TURNSTILE_SECRET_KEY?.trim()
  const normalizedToken = String(token || "").trim()

  if (!secret) {
    if (isRequired()) throw new HttpError(503, "A proteção anti-bot ainda não foi configurada no servidor.")
    return false
  }
  if (!normalizedToken) {
    if (isRequired()) throw new HttpError(400, "Conclua a validação anti-bot para continuar.")
    return false
  }
  if (normalizedToken.length > 4096) throw new HttpError(400, "Validação anti-bot inválida.")

  const body = new URLSearchParams({ secret, response: normalizedToken })
  const ip = requestIp(request)
  if (ip && ip !== "unknown") body.set("remoteip", ip)

  const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  })
  const result = await response.json().catch(() => ({})) as TurnstileResponse
  if (!response.ok || !result.success) throw new HttpError(400, "A validação anti-bot expirou ou foi recusada. Tente novamente.")
  if (result.action && result.action !== expectedAction) throw new HttpError(400, "A validação anti-bot não corresponde a esta operação.")

  const appUrl = process.env.APP_URL?.trim()
  if (process.env.CONTEXT === "production" && appUrl && result.hostname) {
    try {
      const expectedHost = new URL(appUrl).hostname
      if (result.hostname !== expectedHost && result.hostname !== `www.${expectedHost}`) {
        throw new HttpError(400, "A validação anti-bot foi emitida para outro domínio.")
      }
    } catch (error) {
      if (error instanceof HttpError) throw error
    }
  }
  return true
}
