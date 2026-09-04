const CONSENT_KEY = "tributoleve-cookie-consent-v2"
const GA_ID = import.meta.env.VITE_GA_MEASUREMENT_ID?.trim()

type ConsentState = {
  necessary: true
  analytics: boolean
  savedAt: string
  version: number
}

declare global {
  interface Window {
    dataLayer?: unknown[]
    gtag?: (...args: unknown[]) => void
  }
}

let initialized = false
let scriptLoaded = false

function readConsent(): ConsentState | null {
  try {
    const raw = localStorage.getItem(CONSENT_KEY)
    return raw ? JSON.parse(raw) as ConsentState : null
  } catch {
    return null
  }
}

function ensureGtag() {
  window.dataLayer = window.dataLayer || []
  window.gtag = window.gtag || function (...args: unknown[]) { window.dataLayer?.push(args) }
}

function loadGoogleAnalytics() {
  if (!GA_ID || scriptLoaded) return
  scriptLoaded = true
  ensureGtag()
  const script = document.createElement("script")
  script.async = true
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA_ID)}`
  script.dataset.tributoLeveAnalytics = "true"
  document.head.appendChild(script)
  window.gtag?.("js", new Date())
  window.gtag?.("config", GA_ID, {
    anonymize_ip: true,
    send_page_view: false,
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
  })
}

function applyConsent(analytics: boolean) {
  ensureGtag()
  window.gtag?.("consent", "update", {
    analytics_storage: analytics ? "granted" : "denied",
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
  })
  if (analytics) {
    loadGoogleAnalytics()
    trackPageView()
  }
}

export function initAnalytics() {
  if (initialized || !GA_ID) return
  initialized = true
  ensureGtag()
  window.gtag?.("consent", "default", {
    analytics_storage: "denied",
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
    wait_for_update: 500,
  })

  const saved = readConsent()
  if (saved?.analytics) applyConsent(true)
  window.addEventListener("tributoleve:consent", ((event: CustomEvent<ConsentState>) => {
    applyConsent(Boolean(event.detail?.analytics))
  }) as EventListener)
}

export function trackPageView(path = `${location.pathname}${location.search}`) {
  if (!GA_ID || !readConsent()?.analytics) return
  loadGoogleAnalytics()
  window.gtag?.("event", "page_view", {
    page_location: location.href,
    page_path: path,
    page_title: document.title,
  })
}

export function trackEvent(name: string, params: Record<string, string | number | boolean> = {}) {
  if (!GA_ID || !readConsent()?.analytics) return
  loadGoogleAnalytics()
  window.gtag?.("event", name, params)
}

export { CONSENT_KEY }
