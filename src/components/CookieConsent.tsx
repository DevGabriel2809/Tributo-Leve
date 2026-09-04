import * as React from "react"
import { AnimatePresence, motion } from "framer-motion"
import { Cookie, Settings2, X } from "lucide-react"
import { CONSENT_KEY } from "@/lib/analytics"

const CONSENT_VERSION = 2

type ConsentState = {
  necessary: true
  analytics: boolean
  savedAt: string
  version: number
}

function readConsent() {
  try {
    const raw = localStorage.getItem(CONSENT_KEY)
    return raw ? JSON.parse(raw) as ConsentState : null
  } catch {
    return null
  }
}

export function CookieConsent() {
  const [open, setOpen] = React.useState(() => !readConsent())
  const [details, setDetails] = React.useState(false)

  React.useEffect(() => {
    const show = () => { setDetails(true); setOpen(true) }
    window.addEventListener("tributoleve:open-consent", show)
    return () => window.removeEventListener("tributoleve:open-consent", show)
  }, [])

  function save(analytics: boolean) {
    const consent: ConsentState = { necessary: true, analytics, savedAt: new Date().toISOString(), version: CONSENT_VERSION }
    localStorage.setItem(CONSENT_KEY, JSON.stringify(consent))
    window.dispatchEvent(new CustomEvent("tributoleve:consent", { detail: consent }))
    setOpen(false)
  }

  return <AnimatePresence>{open && (
    <motion.aside className="cookie-panel" role="dialog" aria-modal="false" aria-label="Preferências de cookies" initial={{ opacity: 0, y: 28 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 18 }}>
      <button className="cookie-close" onClick={() => save(false)} aria-label="Usar apenas cookies necessários"><X size={18} /></button>
      <div className="cookie-icon"><Cookie size={21} /></div>
      <div>
        <strong>Privacidade sob seu controle</strong>
        <p>Cookies necessários mantêm sessão e segurança. Google Analytics só é carregado se você autorizar métricas opcionais.</p>
        <AnimatePresence>{details && <motion.div className="cookie-details" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
          <span><b>Necessários</b> autenticação, segurança, preferências e funcionamento do serviço.</span>
          <span><b>Analytics</b> acessos, páginas visitadas e origem de tráfego em formato de medição do Google Analytics, sem ativação antes do consentimento.</span>
          <span>Você pode mudar essa escolha a qualquer momento pelo rodapé.</span>
        </motion.div>}</AnimatePresence>
      </div>
      <div className="cookie-actions">
        <button onClick={() => setDetails((value) => !value)}><Settings2 size={16} />{details ? "Ocultar detalhes" : "Detalhes"}</button>
        <button onClick={() => save(false)}>Somente necessários</button>
        <button className="cookie-accept" onClick={() => save(true)}>Aceitar Analytics</button>
      </div>
    </motion.aside>
  )}</AnimatePresence>
}
