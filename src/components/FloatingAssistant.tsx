import * as React from "react"
import { AnimatePresence, motion } from "framer-motion"
import { ArrowUpRight, Bot, Download, ExternalLink, Maximize2, Navigation, Search, Send, Sparkles, X } from "lucide-react"
import { answerForAssistant, type AssistantAction, type AssistantContext, type AssistantSource } from "@/lib/assistantKnowledge"

type HistoryItem = { question: string; title: string; answer: string; sources?: AssistantSource[]; action?: AssistantAction; suggestions?: string[] }

type FloatingAssistantProps = {
  hidden?: boolean
  onOpenFull: () => void
  context?: AssistantContext
  onAction?: (action: AssistantAction) => void
}

const STORAGE_KEY = "tributo-leve-assistant-floating-v2"
const shortcuts = ["Onde informo o CNPJ?", "Como instalo no celular?", "Qual regime está melhor?", "O que muda em 2027?"]
const fallback = "Não encontrei uma resposta segura para essa formulação. Tente dizer o que você quer fazer no Tributo Leve ou mencionar o assunto fiscal: CNPJ, CNAE, receita, Fator R, Simples, IBS, CBS, créditos, transição, relatório, pagamento, módulos ou administração."

export function FloatingAssistant({ hidden = false, onOpenFull, context, onAction }: FloatingAssistantProps) {
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState("")
  const [thinking, setThinking] = React.useState(false)
  const [history, setHistory] = React.useState<HistoryItem[]>(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]").slice(-16) }
    catch { return [] }
  })
  const conversationRef = React.useRef<HTMLDivElement>(null)
  const inputRef = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(history.slice(-16))) }, [history])
  React.useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false) }
    window.addEventListener("keydown", onKey)
    window.setTimeout(() => inputRef.current?.focus(), 120)
    return () => window.removeEventListener("keydown", onKey)
  }, [open])
  React.useEffect(() => { conversationRef.current?.scrollTo({ top: conversationRef.current.scrollHeight, behavior: "smooth" }) }, [history, thinking, open])
  React.useEffect(() => { if (hidden) setOpen(false) }, [hidden])

  function ask(value = query) {
    const question = value.trim()
    if (!question || thinking) return
    setQuery(""); setThinking(true)
    window.setTimeout(() => {
      const found = answerForAssistant(question, context)
      setHistory((items) => [...items, { question, title: found?.title || "Não encontrei com segurança", answer: found?.answer || fallback, sources: found?.sources || [], action: found?.action, suggestions: found?.suggestions }].slice(-16))
      setThinking(false)
    }, 220)
  }

  if (hidden) return null
  return <div className="floating-assistant-root">
    <AnimatePresence>{open && <motion.section className="floating-assistant-panel" role="dialog" aria-modal="false" aria-label="Assistente Fiscal" initial={{ opacity: 0, y: 18, scale: .97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 12, scale: .98 }} transition={{ duration: .2 }}>
      <header className="floating-assistant-head"><span className="floating-assistant-avatar"><Bot size={20} /></span><div><strong>Assistente Fiscal</strong><small><i />Base local ampliada</small></div><button onClick={onOpenFull} aria-label="Abrir assistente completo" title="Abrir assistente completo"><Maximize2 size={17} /></button><button onClick={() => setOpen(false)} aria-label="Fechar assistente"><X size={18} /></button></header>
      <div className="floating-assistant-shortcuts" aria-label="Perguntas rápidas">{shortcuts.map((item) => <button key={item} onClick={() => ask(item)}><Sparkles size={13} />{item}</button>)}</div>
      <div className="floating-assistant-conversation" ref={conversationRef} aria-live="polite">
        {!history.length && <div className="floating-assistant-welcome"><Bot /><strong>Pergunte sobre o Tributo Leve ou a Reforma.</strong><span>Conheço navegação, cálculos, pagamentos, administração e uma base fiscal oficial curada.</span></div>}
        {history.map((item, index) => <article key={`${item.question}-${index}`}><p className="floating-assistant-question">{item.question}</p><div className="floating-assistant-answer"><strong>{item.title}</strong>{item.answer.split("\n\n").map((part) => <p key={part}>{part}</p>)}{!!item.action && <button className="assistant-inline-action" onClick={() => onAction?.(item.action!)}>{item.action.type === "install_app" ? <Download size={15} /> : <Navigation size={15} />}{item.action.label}</button>}{!!item.sources?.length && <div className="assistant-source-links">{item.sources.map((source) => <a key={source.url} href={source.url} target="_blank" rel="noreferrer"><ExternalLink size={12} />{source.title}</a>)}</div>}{!!item.suggestions?.length && <div className="assistant-followups">{item.suggestions.slice(0,2).map((suggestion) => <button key={suggestion} onClick={() => ask(suggestion)}>{suggestion}</button>)}</div>}</div></article>)}
        {thinking && <div className="floating-assistant-thinking"><i /><i /><i />Consultando a base</div>}
      </div>
      <form className="floating-assistant-form" onSubmit={(event) => { event.preventDefault(); ask() }}><Search size={17} /><input ref={inputRef} aria-label="Pergunta rápida para o assistente" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Ex.: onde informo o CNPJ?" /><button aria-label="Enviar pergunta" disabled={!query.trim() || thinking}><Send size={17} /></button></form>
      <button className="floating-assistant-full" onClick={onOpenFull}>Abrir assistente completo <ArrowUpRight size={15} /></button>
    </motion.section>}</AnimatePresence>
    <motion.button className="floating-assistant-fab" onClick={() => setOpen((value) => !value)} aria-label={open ? "Fechar Assistente Fiscal" : "Abrir Assistente Fiscal"} aria-expanded={open} whileTap={{ scale: .96 }}><span><Bot size={21} /></span><div><strong>Assistente</strong><small>Tire uma dúvida</small></div><i /></motion.button>
  </div>
}
