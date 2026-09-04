import { authHeader } from "@/lib/backend"
import type { CardTokenResult } from "@/components/CardCheckout"

async function readResult(response: Response) {
  const result = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(result.error || "A operação de cobrança não pôde ser concluída.")
  return result
}

export async function createRecurringSubscription(userId: string, planSlug: string, cpf: string, card: CardTokenResult) {
  const response = await fetch("/.netlify/functions/create-subscription", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await authHeader()) },
    body: JSON.stringify({ userId, planSlug, cpf, cardToken: card.token, paymentMethodId: card.paymentMethodId, deviceId: card.deviceId, idempotencyKey: crypto.randomUUID() })
  })
  return readResult(response)
}

export async function manageSubscription(action: "sync" | "cancel" | "update_card", extra: Record<string, unknown> = {}) {
  const response = await fetch("/.netlify/functions/subscription", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await authHeader()) },
    body: JSON.stringify({ action, ...extra })
  })
  return readResult(response)
}

export async function getSubscription(sync = false) {
  const response = await fetch(`/.netlify/functions/subscription${sync ? "?sync=1" : ""}`, { headers: await authHeader() })
  return readResult(response)
}
