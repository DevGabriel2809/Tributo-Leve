import type { Config } from "@netlify/functions"
import { assertBodySize, assertTrustedOrigin, authenticatedUser, db, enforceRateLimit, HttpError, json, safeError } from "./_shared.ts"

const allowedAreas = new Set([
  "simulator", "comparison", "timeline", "scenarios", "portfolio", "report",
  "team", "assistant", "products", "subscription", "technical", "admin"
])

export default async (request: Request) => {
  if (request.method !== "POST") return json({ error: "Método não permitido." }, 405)
  try {
    assertBodySize(request, 8 * 1024)
    assertTrustedOrigin(request)
    const user = await authenticatedUser(request)
    if (!user?.id) throw new HttpError(401, "Sessão inválida.")
    await enforceRateLimit(request, "presence", user.id, 30, 5 * 60)

    const body = await request.json().catch(() => ({})) as { area?: string }
    const requested = String(body.area || "").trim()
    const area = allowedAreas.has(requested) ? requested : "simulator"
    const now = new Date().toISOString()

    await db("user_presence?on_conflict=user_id", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({ user_id: user.id, current_area: area, last_seen_at: now, updated_at: now })
    })
    return json({ ok: true })
  } catch (error) {
    return safeError(error, "Não foi possível atualizar a presença da sessão.")
  }
}

export const config: Config = { path: "/.netlify/functions/presence" }
