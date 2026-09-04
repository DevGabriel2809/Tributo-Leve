import * as React from "react"

const SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY?.trim()
export const turnstileConfigured = Boolean(SITE_KEY)

declare global {
  interface Window {
    turnstile?: {
      render: (element: HTMLElement, options: Record<string, unknown>) => string
      reset: (widgetId?: string) => void
      remove: (widgetId: string) => void
    }
  }
}

let loader: Promise<void> | null = null

function loadTurnstile() {
  if (window.turnstile) return Promise.resolve()
  if (loader) return loader
  loader = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-turnstile-sdk="true"]')
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true })
      existing.addEventListener("error", () => reject(new Error("Falha ao carregar a proteção anti-bot.")), { once: true })
      return
    }
    const script = document.createElement("script")
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
    script.async = true
    script.defer = true
    script.dataset.turnstileSdk = "true"
    script.onload = () => resolve()
    script.onerror = () => reject(new Error("Falha ao carregar a proteção anti-bot."))
    document.head.appendChild(script)
  })
  return loader
}

export function TurnstileWidget({ onToken, action }: { onToken: (token: string) => void; action: "login" | "register" }) {
  const host = React.useRef<HTMLDivElement>(null)
  const widgetId = React.useRef<string | null>(null)
  const [error, setError] = React.useState("")

  React.useEffect(() => {
    if (!SITE_KEY || !host.current) return
    let active = true
    void loadTurnstile().then(() => {
      if (!active || !host.current || !window.turnstile) return
      widgetId.current = window.turnstile.render(host.current, {
        sitekey: SITE_KEY,
        theme: "auto",
        size: "flexible",
        action,
        callback: (token: string) => { setError(""); onToken(token) },
        "expired-callback": () => onToken(""),
        "error-callback": () => { onToken(""); setError("Não foi possível validar a proteção anti-bot.") },
      })
    }).catch((cause) => setError(cause instanceof Error ? cause.message : "Proteção anti-bot indisponível."))
    return () => {
      active = false
      if (widgetId.current && window.turnstile) {
        try { window.turnstile.remove(widgetId.current) } catch { /* widget já removido */ }
      }
    }
  }, [action, onToken])

  if (!SITE_KEY) return null
  return <div className="turnstile-field"><div ref={host} />{error && <small role="alert">{error}</small>}</div>
}
