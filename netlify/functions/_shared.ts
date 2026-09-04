import { createHash } from "node:crypto"
import { createClient } from "@supabase/supabase-js"

const SUPABASE_URL = () => requireEnv("SUPABASE_URL")
const SERVER_KEY = () => {
  const key = process.env.SUPABASE_SECRET_KEY?.trim() || process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!key) throw new Error("Configuração ausente: SUPABASE_SECRET_KEY")
  return key
}

export function requireEnv(name: string) {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`Configuração ausente: ${name}`)
  return value
}

export function json(data: unknown, status = 200, extraHeaders: Record<string, string> = {}) {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
      ...extraHeaders
    }
  })
}

export class DatabaseRequestError extends Error {
  status: number
  code?: string
  details?: string
  hint?: string

  constructor(message: string, status: number, payload?: any) {
    super(message)
    this.name = "DatabaseRequestError"
    this.status = status
    this.code = typeof payload?.code === "string" ? payload.code : undefined
    this.details = typeof payload?.details === "string" ? payload.details : undefined
    this.hint = typeof payload?.hint === "string" ? payload.hint : undefined
  }
}

function serverHeaders() {
  const key = SERVER_KEY()
  if (key.startsWith("sb_secret_")) return { apikey: key }
  return { apikey: key, Authorization: `Bearer ${key}` }
}

export function adminClient() {
  return createClient(SUPABASE_URL(), SERVER_KEY(), {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
  })
}

export function validCpf(value: string) {
  const cpf = String(value || "").replace(/\D/g, "")
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false
  const digit = (length: number) => {
    let sum = 0
    for (let index = 0; index < length; index += 1) sum += Number(cpf[index]) * (length + 1 - index)
    const remainder = (sum * 10) % 11
    return remainder === 10 ? 0 : remainder
  }
  return digit(9) === Number(cpf[9]) && digit(10) === Number(cpf[10])
}

export async function authenticatedUser(request: Request) {
  const authorization = request.headers.get("authorization") || ""
  if (!authorization.startsWith("Bearer ")) return null
  const response = await fetch(`${SUPABASE_URL()}/auth/v1/user`, {
    headers: { apikey: SERVER_KEY(), Authorization: authorization }
  })
  if (!response.ok) return null
  return response.json() as Promise<{ id: string; email?: string }>
}

export async function db(path: string, init: RequestInit = {}) {
  const response = await fetch(`${SUPABASE_URL()}/rest/v1/${path}`, {
    ...init,
    headers: { ...serverHeaders(), "Content-Type": "application/json", Prefer: "return=representation", ...(init.headers || {}) }
  })

  if (!response.ok) {
    const raw = await response.text()
    let payload: any = null
    try { payload = raw ? JSON.parse(raw) : null } catch { payload = null }
    console.error("supabase-db", {
      path: path.split("?")[0],
      status: response.status,
      code: payload?.code,
      message: payload?.message,
      details: payload?.details,
      hint: payload?.hint
    })
    throw new DatabaseRequestError(payload?.message || `Banco de dados recusou a operação (${response.status})`, response.status, payload)
  }

  if (response.status === 204) return null
  const text = await response.text()
  return text ? JSON.parse(text) : null
}

export async function requireAdmin(request: Request) {
  const user = await authenticatedUser(request)
  if (!user) return null
  const rows = await db(`profiles?id=eq.${encodeURIComponent(user.id)}&role=eq.admin&select=id,email,full_name,role`)
  return rows?.[0] || null
}

export function requestIp(request: Request) {
  return (request.headers.get("x-nf-client-connection-ip") || request.headers.get("x-forwarded-for")?.split(",")[0] || "unknown").trim().slice(0, 80)
}

export function requestFingerprint(request: Request, scope: string, subject = "anonymous") {
  const raw = `${scope}|${subject}|${requestIp(request)}`
  return createHash("sha256").update(raw).digest("hex")
}

export async function enforceRateLimit(request: Request, scope: string, subject: string, limit: number, windowSeconds: number) {
  const key = requestFingerprint(request, scope, subject)
  const allowed = await db("rpc/consume_rate_limit", {
    method: "POST",
    body: JSON.stringify({ p_key: key, p_limit: limit, p_window_seconds: windowSeconds })
  })
  if (allowed !== true) throw new HttpError(429, "Muitas solicitações. Aguarde um pouco e tente novamente.")
}

export function assertBodySize(request: Request, maxBytes = 64 * 1024) {
  const declared = Number(request.headers.get("content-length") || "0")
  if (Number.isFinite(declared) && declared > maxBytes) throw new HttpError(413, "Solicitação muito grande.")
}

function allowedOrigins(request: Request) {
  const result = new Set<string>()
  const appUrl = process.env.APP_URL?.trim()
  const deployUrl = process.env.DEPLOY_PRIME_URL?.trim()
  const url = new URL(request.url)
  result.add(url.origin)
  for (const candidate of [appUrl, deployUrl]) {
    if (!candidate) continue
    try { result.add(new URL(candidate).origin) } catch { /* ignore */ }
  }
  if (process.env.CONTEXT !== "production") {
    result.add("http://localhost:5173")
    result.add("http://localhost:8888")
  }
  return result
}

export function assertTrustedOrigin(request: Request) {
  const origin = request.headers.get("origin")
  // Chamadas autenticadas de navegador sempre trazem Origin. Ausencia e aceita
  // para compatibilidade com clientes nativos; JWT + autorizacao servidor continuam obrigatorios.
  if (!origin) return
  if (!allowedOrigins(request).has(origin)) throw new HttpError(403, "Origem não autorizada.")
}

export class HttpError extends Error {
  status: number
  code?: string
  constructor(status: number, message: string, code?: string) {
    super(message)
    this.name = "HttpError"
    this.status = status
    this.code = code
  }
}

export function safeError(error: unknown, fallback = "Não foi possível concluir a operação.") {
  if (error instanceof HttpError) return json({ error: error.message, code: error.code }, error.status)
  if (error instanceof SyntaxError) return json({ error: "Dados inválidos." }, 400)
  if (error instanceof Error && /Configuração ausente:/.test(error.message)) {
    console.error("server-config", { message: error.message })
    return json({ error: "Serviço temporariamente indisponível por configuração do servidor." }, 503)
  }
  console.error("unhandled-function-error", error)
  return json({ error: fallback }, 500)
}

export function addMonthsIso(startIso: string, months: number) {
  const date = new Date(startIso)
  if (Number.isNaN(date.getTime())) throw new Error("Data inválida")
  const day = date.getUTCDate()
  date.setUTCDate(1)
  date.setUTCMonth(date.getUTCMonth() + Math.max(1, months || 1))
  const last = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate()
  date.setUTCDate(Math.min(day, last))
  return date.toISOString()
}

export function activeSubscription(subscription: any, now = Date.now()) {
  if (!subscription) return false
  const expiresAt = subscription.expires_at ? new Date(subscription.expires_at).getTime() : NaN
  if (Number.isFinite(expiresAt) && expiresAt > now && subscription.status === "active") return true
  const grace = subscription.grace_until ? new Date(subscription.grace_until).getTime() : NaN
  return subscription.status === "past_due" && Number.isFinite(grace) && grace > now
}
