import * as React from "react"
import { AnimatePresence, motion } from "framer-motion"
import { BookOpenCheck, Bot, Download, ExternalLink, Navigation, Search, Send, Sparkles } from "lucide-react"
import { answerForAssistant, assistantArticles, type AssistantAction, type AssistantContext, type AssistantSource } from "@/lib/assistantKnowledge"

const fallback = "Não encontrei uma resposta segura para essa formulação. Tente perguntar por uma função do programa ou citar o tema fiscal: CNPJ, CNAE, Fator R, Simples, IBS, CBS, créditos, transição, relatório, pagamentos, módulos ou administração."

export function FiscalAssistant({ context, onAction }: { context?: AssistantContext; onAction?: (action: AssistantAction) => void }) {
  const [query, setQuery] = React.useState("")
  const [history, setHistory] = React.useState<{ question: string; title: string; answer: string; sources?: AssistantSource[]; action?: AssistantAction; suggestions?: string[] }[]>([])
  const [thinking, setThinking] = React.useState(false)

  function ask(value = query) {
    const question = value.trim(); if (!question) return
    setQuery(""); setThinking(true)
    window.setTimeout(() => {
      const found = answerForAssistant(question, context)
      setHistory((items) => [...items, { question, title: found?.title || "Não encontrei com segurança", answer: found?.answer || fallback, sources: found?.sources || [], action: found?.action, suggestions: found?.suggestions }])
      setThinking(false)
    }, 240)
  }

  return <section className="assistant-layout"><div className="assistant-main panel">
    <div className="assistant-title"><span><Bot /></span><div><p className="kicker">ASSISTENTE FISCAL LOCAL</p><h1>Dúvidas com resposta imediata</h1><p>Base local com {assistantArticles.length} tópicos, busca por intenção, sinônimos, tolerância a erros de digitação, atalhos de navegação e contexto do cenário atual.</p></div></div>
    <div className="assistant-suggestions">{["Onde informo o CNPJ?", "Qual regime está melhor agora?", "Como funciona o Simples híbrido?", "O que muda em 2027?", "Como instalo no celular?"].map((item) => <button key={item} onClick={() => ask(item)}><Sparkles size={15} />{item}</button>)}</div>
    <div className="assistant-conversation" aria-live="polite">
      {!history.length && <div className="assistant-empty"><BookOpenCheck /><strong>Base ampliada e pronta para consulta</strong><span>Pergunte tanto sobre o uso do programa quanto sobre conceitos, prazos e transição da Reforma.</span></div>}
      {history.map((item, index) => <motion.article key={`${item.question}-${index}`} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}><p className="assistant-question">{item.question}</p><div className="assistant-answer"><strong>{item.title}</strong>{item.answer.split("\n\n").map((part) => <p key={part}>{part}</p>)}{!!item.action && <button className="assistant-inline-action" onClick={() => onAction?.(item.action!)}>{item.action.type === "install_app" ? <Download size={15} /> : <Navigation size={15} />}{item.action.label}</button>}{!!item.sources?.length && <div className="assistant-source-links">{item.sources.map((source) => <a key={source.url} href={source.url} target="_blank" rel="noreferrer"><ExternalLink size={12} />{source.title}</a>)}</div>}{!!item.suggestions?.length && <div className="assistant-followups">{item.suggestions.map((suggestion) => <button key={suggestion} onClick={() => ask(suggestion)}>{suggestion}</button>)}</div>}</div></motion.article>)}
      <AnimatePresence>{thinking && <motion.div className="assistant-thinking" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><i /><i /><i />Consultando a base</motion.div>}</AnimatePresence>
    </div>
    <form className="assistant-form" onSubmit={(event) => { event.preventDefault(); ask() }}><Search size={19} /><input aria-label="Pergunta para o assistente fiscal" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Ex.: onde fica o CNPJ? O que muda em 2027?" /><button aria-label="Enviar pergunta"><Send size={19} /></button></form>
    <p className="assistant-disclaimer">Base local atualizada em setembro de 2026. Conteúdo informativo; alterações normativas posteriores exigem atualização do Tributo Leve e validação profissional.</p>
  </div></section>
}
