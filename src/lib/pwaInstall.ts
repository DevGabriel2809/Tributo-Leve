export type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>
}

let deferredPrompt: BeforeInstallPromptEvent | null = null
let initialized = false

export function isStandaloneApp() {
  if (typeof window === "undefined") return false
  return window.matchMedia("(display-mode: standalone)").matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
}

export function isMobileDevice() {
  if (typeof window === "undefined") return false
  return window.matchMedia("(max-width: 760px)").matches || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
}

export function isIOSDevice() {
  return typeof navigator !== "undefined" && /iPhone|iPad|iPod/i.test(navigator.userAgent)
}

export function initPwaInstallCapture() {
  if (initialized || typeof window === "undefined") return
  initialized = true
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault()
    deferredPrompt = event as BeforeInstallPromptEvent
    window.dispatchEvent(new CustomEvent("tributoleve-pwa-ready"))
  })
  window.addEventListener("appinstalled", () => {
    deferredPrompt = null
    window.dispatchEvent(new CustomEvent("tributoleve-pwa-installed"))
  })
}

export function canPromptInstall() {
  return Boolean(deferredPrompt)
}

export async function requestPwaInstall() {
  if (!deferredPrompt) return { outcome: "unavailable" as const }
  const prompt = deferredPrompt
  await prompt.prompt()
  const choice = await prompt.userChoice
  if (choice.outcome === "accepted") deferredPrompt = null
  return choice
}
