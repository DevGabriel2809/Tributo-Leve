import * as React from "react"
import { motion } from "framer-motion"
import { Activity, Ban, CheckCircle2, CircleDollarSign, FlaskConical, PackageOpen, RefreshCw, Save, Search, ShieldCheck, TestTube2, Trash2, Users } from "lucide-react"
import { authHeader } from "@/lib/backend"
import { planBranding } from "@/lib/planBranding"

type Profile = { id: string; email: string; full_name: string; role: string; access_status: string; created_at: string }
type Payment = { id: string; user_id: string; method: string; status: string; amount_cents: number; paid_at: string | null; created_at: string }
type Plan = { id: string; slug: string; name: string; description: string; price_cents: number; active: boolean; billing_months?: number; company_limit?: number; included_features?: string[]; badge?: string; recommended?: boolean; sort_order?: number }
type Product = { id: string; slug: string; name: string; description: string; price_cents: number; active: boolean; feature_key: string }
type Recurring = { user_id: string; plan_id: string; status: string; provider_status: string; amount_cents: number; billing_months: number; current_period_end?: string; next_payment_date?: string; grace_until?: string; cancel_at_period_end?: boolean; card_brand?: string; card_last4?: string; last_payment_status?: string }
type Presence = { user_id: string; current_area?: string; last_seen_at: string }
type Overview = { profiles: Profile[]; payments: Payment[]; plans: Plan[]; products: Product[]; recurring: Recurring[]; subscriptions: unknown[]; online?: Presence[]; metrics?: { estimatedMrrCents?: number; effectiveActive?: number; onlineNow?: number }; audit: unknown[]; adminId?: string }
const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })

export function AdminDashboard() {
  const [data, setData] = React.useState<Overview | null>(null)
  const [query, setQuery] = React.useState("")
  const [error, setError] = React.useState("")
  const [loading, setLoading] = React.useState(true)

  async function load() {
    setLoading(true); setError("")
    try {
      const response = await fetch("/.netlify/functions/admin-overview", { headers: await authHeader() })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error)
      setData(result)
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Falha ao carregar o painel.") }
    finally { setLoading(false) }
  }

  React.useEffect(() => { void load() }, [])

  async function post(body: Record<string, unknown>) {
    const response = await fetch("/.netlify/functions/admin-overview", { method: "POST", headers: { "Content-Type": "application/json", ...(await authHeader()) }, body: JSON.stringify(body) })
    const result = await response.json()
    if (!response.ok) throw new Error(result.error || "Ação não concluída.")
    return result
  }

  async function accessAction(user: Profile, action: "grant_test" | "activate" | "block") {
    const labels = { grant_test: "liberar acesso de teste", activate: "ativar manualmente", block: "bloquear" }
    const reason = prompt(`Motivo para ${labels[action]} ${user.email}:`)
    if (!reason?.trim()) return
    try { await post({ userId: user.id, action, reason: reason.trim() }); await load() }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Ação não concluída.") }
  }

  async function deleteUser(user: Profile) {
    if (user.id === data?.adminId) return setError("Você não pode excluir a própria conta administrativa enquanto está logado.")
    const confirmation = prompt(`EXCLUSÃO DEFINITIVA\n\nIsso remove ${user.email} do Supabase Auth e os dados vinculados à conta.\n\nDigite EXCLUIR para confirmar:`)
    if (confirmation?.trim().toUpperCase() !== "EXCLUIR") return
    const reason = prompt("Informe o motivo da exclusão para a auditoria:")
    if (!reason?.trim()) return
    try {
      await post({ userId: user.id, action: "delete_user", reason: reason.trim() })
      setData((current) => current ? { ...current, profiles: current.profiles.filter((item) => item.id !== user.id), payments: current.payments.filter((item) => item.user_id !== user.id) } : current)
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível excluir o usuário.") }
  }

  async function updatePlanPrice(plan: Plan, priceCents: number) {
    setError("")
    await post({ action: "update_plan_price", planId: plan.id, priceCents, reason: "Alteração de preço pelo painel administrativo" })
    setData((current) => current ? { ...current, plans: current.plans.map((item) => item.id === plan.id ? { ...item, price_cents: priceCents } : item) } : current)
  }

  async function updateProductPrice(product: Product, priceCents: number) {
    setError("")
    await post({ action: "update_product_price", productId: product.id, priceCents, reason: "Alteração de preço de módulo pelo painel administrativo" })
    setData((current) => current ? { ...current, products: current.products.map((item) => item.id === product.id ? { ...item, price_cents: priceCents } : item) } : current)
  }

  if (loading) return <div className="admin-loading"><span className="loader" /><strong>Consolidando usuários e pagamentos</strong></div>
  if (error && !data) return <div className="admin-error"><ShieldCheck /><strong>{error}</strong><button onClick={load}>Tentar novamente</button></div>
  const profiles = data?.profiles || []
  const payments = data?.payments || []
  const paid = payments.filter((item) => item.status === "approved" || item.status === "processed")
  const revenue = paid.reduce((sum, item) => sum + item.amount_cents, 0) / 100
  const recurring = data?.recurring || []
  const filtered = profiles.filter((item) => `${item.full_name} ${item.email} ${item.access_status}`.toLowerCase().includes(query.toLowerCase()))

  return <div className="admin-page">
    <section className="workspace-heading"><div><p className="kicker">CONTROLE DO PRODUTO</p><h1>Administração</h1><p>Usuários, acessos, preços, pagamentos e módulos em uma única visão.</p></div><button className="admin-refresh" onClick={load}><RefreshCw size={17} />Atualizar</button></section>
    <div className="admin-metrics">
      {[{ icon: Users, label: "Contas", value: profiles.length }, { icon: Activity, label: "Online agora", value: data?.metrics?.onlineNow ?? 0 }, { icon: CheckCircle2, label: "Acessos vigentes", value: data?.metrics?.effectiveActive ?? profiles.filter((item) => item.access_status === "test_access").length }, { icon: CircleDollarSign, label: "MRR estimado", value: money.format(Number(data?.metrics?.estimatedMrrCents || 0) / 100) }, { icon: ShieldCheck, label: "Recorrências", value: recurring.filter((item) => ["active", "past_due", "pending_activation"].includes(item.status)).length }].map((item, index) => { const Icon = item.icon; return <motion.article key={item.label} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * .05 }}><span><Icon /></span><small>{item.label}</small><strong>{item.value}</strong></motion.article> })}
    </div>


    <section className="admin-table panel admin-online-table">
      <div className="admin-table-head"><div><h2>Contas online agora</h2><p>Considera online a sessão que enviou atividade nos últimos 2 minutos.</p></div></div>
      <div className="table-scroll"><table><thead><tr><th>Conta</th><th>Área atual</th><th>Última atividade</th></tr></thead><tbody>{(data?.online || []).length ? (data?.online || []).map((item) => { const profile = profiles.find((p) => p.id === item.user_id); return <tr key={item.user_id}><td><span className="online-user"><i /> <strong>{profile?.full_name || "Usuário"}</strong></span><small>{profile?.email || item.user_id}</small></td><td>{areaLabel(item.current_area)}</td><td>{new Date(item.last_seen_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</td></tr> }) : <tr><td colSpan={3}>Nenhuma conta ativa nos últimos 2 minutos.</td></tr>}</tbody></table></div>
    </section>

    <section className="admin-pricing panel">
      <div className="admin-pricing-copy"><span><FlaskConical /></span><div><p className="kicker">PREÇO E TESTES</p><h2>Preços dos planos</h2><p>Leve Start, Leve Pro e Leve Prime usam os valores salvos aqui. A tela de cadastro e a próxima renovação consultam o banco em tempo real.</p></div></div>
      <div className="admin-plan-grid">{(data?.plans || []).map((plan) => { const brand = planBranding(plan.slug, plan.name); return <PriceEditor key={plan.id} title={brand.name} description={brand.shortDescription} priceCents={plan.price_cents} ariaLabel={`Preço do plano ${brand.name}`} onSave={(price) => updatePlanPrice(plan, price)} /> })}</div>
    </section>

    <section className="admin-pricing panel admin-module-pricing">
      <div className="admin-pricing-copy"><span><PackageOpen /></span><div><p className="kicker">CATÁLOGO</p><h2>Preços dos módulos</h2><p>Altere os valores cobrados por Carteira de clientes, Relatório executivo, Equipe adicional e futuros módulos. O catálogo usa estes preços em tempo real.</p></div></div>
      <div className="admin-plan-grid admin-product-price-grid">{(data?.products || []).map((product) => <PriceEditor key={product.id} title={product.name} description={product.description} priceCents={product.price_cents} ariaLabel={`Preço do módulo ${product.name}`} onSave={(price) => updateProductPrice(product, price)} />)}</div>
    </section>

    <section className="admin-table panel recurring-admin-table">
      <div className="admin-table-head"><div><h2>Assinaturas automáticas</h2><p>Recorrências, inadimplência, tolerância e próxima cobrança. Nenhum dado completo do cartão é exibido.</p></div></div>
      <div className="table-scroll"><table><thead><tr><th>Cliente</th><th>Status</th><th>Valor</th><th>Próxima cobrança</th><th>Cartão</th></tr></thead><tbody>{recurring.length ? recurring.map((item) => { const profile = profiles.find((p) => p.id === item.user_id); return <tr key={item.user_id}><td><strong>{profile?.full_name || "Cliente"}</strong><small>{profile?.email || item.user_id}</small></td><td><Status value={item.status} />{item.grace_until && <small>Tolerância até {new Date(item.grace_until).toLocaleDateString("pt-BR")}</small>}</td><td><strong>{money.format(item.amount_cents / 100)}</strong><small>a cada {item.billing_months === 3 ? "3 meses" : "mês"}</small></td><td>{item.cancel_at_period_end ? <span>Renovação cancelada</span> : item.next_payment_date ? new Date(item.next_payment_date).toLocaleDateString("pt-BR") : "—"}</td><td>{item.card_brand ? <><strong>{item.card_brand.toUpperCase()}</strong><small>{item.card_last4 ? `•••• ${item.card_last4}` : "dados no Mercado Pago"}</small></> : "—"}</td></tr> }) : <tr><td colSpan={5}>Nenhuma assinatura automática registrada.</td></tr>}</tbody></table></div>
    </section>

    <section className="admin-table panel">
      <div className="admin-table-head"><div><h2>Clientes e permissões</h2><p>Alterações manuais e exclusões são protegidas e registradas em auditoria.</p></div><label className="admin-search"><Search size={17} /><input aria-label="Pesquisar clientes" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Nome, e-mail ou status" /></label></div>
      {error && <p className="admin-inline-error">{error}</p>}
      <div className="table-scroll"><table><thead><tr><th>Cliente</th><th>Acesso</th><th>Cadastro</th><th>Último pagamento</th><th>Ações</th></tr></thead><tbody>{filtered.map((profile) => { const payment = payments.find((item) => item.user_id === profile.id); return <tr key={profile.id}><td><strong>{profile.full_name || "Sem nome"}</strong><small>{profile.email}</small></td><td><Status value={profile.access_status} /></td><td>{new Date(profile.created_at).toLocaleDateString("pt-BR")}</td><td>{payment ? <><strong>{money.format(payment.amount_cents / 100)}</strong><small>{payment.status} · {payment.method}</small></> : <span>Sem cobrança</span>}</td><td><div className="admin-actions"><button title="Liberar acesso de teste" onClick={() => accessAction(profile, "grant_test")}><TestTube2 /></button><button title="Ativar manualmente" onClick={() => accessAction(profile, "activate")}><CheckCircle2 /></button><button title="Bloquear acesso" className="danger" onClick={() => accessAction(profile, "block")}><Ban /></button><button title="Excluir usuário definitivamente" className="danger delete" disabled={profile.id === data?.adminId} onClick={() => deleteUser(profile)}><Trash2 /></button></div></td></tr>})}</tbody></table></div>
    </section>
  </div>
}


function areaLabel(value?: string) {
  const labels: Record<string,string> = { simulator: "Simular", comparison: "Comparar", timeline: "Transição", scenarios: "Cenários", portfolio: "Carteira", report: "Relatório", team: "Equipe", assistant: "Assistente", products: "Planos e módulos", subscription: "Minha assinatura", technical: "Base técnica", admin: "Administração" }
  return labels[value || ""] || "Aplicação"
}

function PriceEditor({ title, description, priceCents, ariaLabel, onSave }: { title: string; description: string; priceCents: number; ariaLabel: string; onSave: (priceCents: number) => Promise<void> }) {
  const [value, setValue] = React.useState((priceCents / 100).toFixed(2).replace(".", ","))
  const [saving, setSaving] = React.useState(false)
  const [message, setMessage] = React.useState("")
  React.useEffect(() => setValue((priceCents / 100).toFixed(2).replace(".", ",")), [priceCents])

  async function save() {
    const raw = value.trim().replace(/\s/g, "")
    const normalized = raw.includes(",") ? raw.replace(/\./g, "").replace(",", ".") : raw
    const amount = Number(normalized); const cents = Math.round(amount * 100)
    if (!Number.isFinite(amount) || cents < 1) return setMessage("Informe um valor a partir de R$ 0,01.")
    setSaving(true); setMessage("")
    try { await onSave(cents); setMessage(`Preço salvo: ${money.format(cents / 100)}`) }
    catch (cause) { setMessage(cause instanceof Error ? cause.message : "Não foi possível salvar.") }
    finally { setSaving(false) }
  }

  return <motion.article layout initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
    <div><strong>{title}</strong><small>{description}</small></div>
    <label><span>Preço em reais</span><div className="admin-price-input"><b>R$</b><input aria-label={ariaLabel} inputMode="decimal" value={value} onChange={(event) => setValue(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void save() }} /></div></label>
    <button onClick={() => void save()} disabled={saving}><Save />{saving ? "Salvando" : "Salvar preço"}</button>
    {message && <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} role="status">{message}</motion.p>}
  </motion.article>
}

function Status({ value }: { value: string }) {
  const labels: Record<string, string> = { pending_payment: "Aguardando pagamento", pending_activation: "Ativando", active: "Ativo", past_due: "Em tolerância", paused: "Pausado", canceled: "Cancelado", expired: "Expirado", error: "Erro", test_access: "Teste liberado", blocked: "Bloqueado" }
  return <span className={`access-status ${value}`}>{labels[value] || value}</span>
}
