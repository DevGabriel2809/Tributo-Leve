import * as React from "react"
import { Download } from "lucide-react"
import { canPromptInstall, isMobileDevice, isStandaloneApp, requestPwaInstall } from "@/lib/pwaInstall"

/**
 * Exibe apenas o instalador nativo do navegador.
 * Não há tutorial intermediário: se o browser não disponibilizar
 * `beforeinstallprompt`, o botão simplesmente não é mostrado.
 */
export function InstallAppPrompt() {
  const [ready, setReady] = React.useState(() => canPromptInstall())

  React.useEffect(() => {
    if (!isMobileDevice() || isStandaloneApp()) return
    const sync = () => setReady(canPromptInstall())
    sync()
    window.addEventListener("tributoleve-pwa-ready", sync)
    window.addEventListener("tributoleve-pwa-installed", sync)
    return () => {
      window.removeEventListener("tributoleve-pwa-ready", sync)
      window.removeEventListener("tributoleve-pwa-installed", sync)
    }
  }, [])

  if (!isMobileDevice() || isStandaloneApp() || !ready) return null

  return <button
    className="install-quick-button"
    onClick={async () => {
      const result = await requestPwaInstall()
      setReady(canPromptInstall())
      if (result.outcome === "accepted") setReady(false)
    }}
    aria-label="Instalar Tributo Leve no celular"
    title="Instalar Tributo Leve"
  >
    <Download size={18} /><span>Instalar</span>
  </button>
}
