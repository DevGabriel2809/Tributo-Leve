import * as React from "react"
import { AnimatePresence, motion } from "framer-motion"
import { Building2, FolderOpen, Plus, Search, Trash2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { formatCnpj, validCnpj, type WorkspaceCompany, type WorkspaceContext, type WorkspaceScenario } from "@/lib/workspace"

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })

export function Portfolio({ context, onAddCompany, onDeleteCompany, onOpenScenario, onStartCompany }: {
  context: WorkspaceContext
  onAddCompany: (input: { name: string; cnpj: string; notes: string; tag: string }) => Promise<void>
  onDeleteCompany: (company: WorkspaceCompany) => Promise<void>
  onOpenScenario: (scenario: WorkspaceScenario) => void
  onStartCompany: (company: WorkspaceCompany) => void
}) {
  const [query, setQuery] = React.useState("")
  const [showAdd, setShowAdd] = React.useState(false)
  const [form, setForm] = React.useState({ name: "", cnpj: "", notes: "", tag: "" })
  const [error, setError] = React.useState("")
  const [saving, setSaving] = React.useState(false)

  const latestByClient = React.useMemo(() => {
    const map = new Map<string, WorkspaceScenario>()
    for (const scenario of context.scenarios) if (!map.has(scenario.client_id)) map.set(scenario.client_id, scenario)
    return map
  }, [context.scenarios])

  const filtered = context.companies.filter((company) => `${company.name} ${company.cnpj} ${company.tag}`.toLowerCase().includes(query.toLowerCase()))
  const totalRevenue = context.companies.reduce((sum, company) => {
    const state = latestByClient.get(company.id)?.state
    const revenue = state?.activities?.reduce?.((acc: number, activity: any) => acc + Number(activity.revenue || 0), 0) || 0
    return sum + revenue
  }, 0)

  async function create() {
    setError("")
    if (!form.name.trim()) return setError("Informe o nome da empresa.")
    if (!validCnpj(form.cnpj)) return setError("Informe um CNPJ válido.")
    setSaving(true)
    try {
      await onAddCompany({ ...form, cnpj: form.cnpj.replace(/\D/g, "") })
      setForm({ name: "", cnpj: "", notes: "", tag: "" }); setShowAdd(false)
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível adicionar a empresa.") }
    finally { setSaving(false) }
  }

  return <div className="portfolio-page">
    <section className="workspace-heading"><div><p className="kicker">CARTEIRA DE CLIENTES</p><h1>Todos os CNPJs em uma visão</h1><p>Organize empresas, abra o último cenário e acompanhe sua carteira sem misturar dados.</p></div>{context.canEdit && <Button onClick={() => setShowAdd(true)}><Plus size={17} />Adicionar CNPJ</Button>}</section>
    <div className="portfolio-metrics">
      <article><span>Empresas</span><strong>{context.companies.length}</strong><small>de até {context.limits.companies}</small></article>
      <article><span>Cenários salvos</span><strong>{context.scenarios.length}</strong><small>na nuvem do workspace</small></article>
      <article><span>Receita mensal mapeada</span><strong>{money.format(totalRevenue)}</strong><small>último cenário de cada cliente</small></article>
    </div>
    <label className="portfolio-search"><Search size={18} /><Input aria-label="Pesquisar carteira" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Pesquisar por empresa, CNPJ ou etiqueta" /></label>
    {filtered.length ? <div className="portfolio-grid">{filtered.map((company, index) => {
      const latest = latestByClient.get(company.id)
      const revenue = latest?.state?.activities?.reduce?.((sum: number, activity: any) => sum + Number(activity.revenue || 0), 0) || 0
      return <motion.article key={company.id} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * .04 }}>
        <div className="portfolio-card-head"><span><Building2 /></span><div><p>{company.tag || "CLIENTE"}</p><h2>{company.name}</h2><small>{formatCnpj(company.cnpj)}</small></div></div>
        <dl><dt>Último cenário</dt><dd>{latest ? new Date(latest.saved_at).toLocaleDateString("pt-BR") : "Ainda não salvo"}</dd><dt>Receita mensal</dt><dd>{latest ? money.format(revenue) : "—"}</dd><dt>Observação</dt><dd>{company.notes || "Sem observações"}</dd></dl>
        <div className="portfolio-card-actions">{latest ? <Button onClick={() => onOpenScenario(latest)}><FolderOpen size={16} />Abrir último cenário</Button> : context.canEdit ? <Button onClick={() => onStartCompany(company)}>Criar simulação</Button> : <span className="portfolio-readonly">Sem cenário</span>}{context.canEdit && <><Button variant="ghost" onClick={() => onStartCompany(company)}>Novo cenário</Button><button className="portfolio-delete" onClick={() => onDeleteCompany(company)} aria-label={`Excluir ${company.name}`}><Trash2 size={17} /></button></>}</div>
      </motion.article>
    })}</div> : <div className="empty-page"><Building2 /><h2>Nenhuma empresa encontrada</h2><p>Adicione o primeiro CNPJ da carteira ou ajuste sua pesquisa.</p></div>}

    <AnimatePresence>{showAdd && context.canEdit && <motion.div className="purchase-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={() => setShowAdd(false)}><motion.section className="portfolio-modal" initial={{ opacity: 0, scale: .97, y: 14 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0 }} onMouseDown={(e) => e.stopPropagation()}><button className="purchase-close" onClick={() => setShowAdd(false)} aria-label="Fechar"><X /></button><p className="kicker">NOVO CLIENTE</p><h2>Adicionar CNPJ à carteira</h2><label>Nome da empresa<Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Razão social ou nome de referência" /></label><label>CNPJ<Input inputMode="numeric" value={formatCnpj(form.cnpj)} onChange={(e) => setForm({ ...form, cnpj: e.target.value.replace(/\D/g, "") })} placeholder="00.000.000/0000-00" /></label><label>Etiqueta<Input value={form.tag} onChange={(e) => setForm({ ...form, tag: e.target.value })} placeholder="Ex.: varejo, prioridade, Recife" /></label><label>Observações<textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Anotações rápidas sobre o cliente" /></label>{error && <p className="purchase-message error">{error}</p>}<Button onClick={create} disabled={saving}>{saving ? "Adicionando" : "Adicionar à carteira"}</Button></motion.section></motion.div>}</AnimatePresence>
  </div>
}
