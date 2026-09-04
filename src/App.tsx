import * as React from "react"
import { AnimatePresence, motion } from "framer-motion"
import {
  Activity, ArrowLeft, ArrowRight, BarChart3, BookOpen, Bot, Building2, Calculator,
  Check, ChevronDown, CircleAlert, Clock3, FileDown, FolderClock, Gauge,
  Layers3, LogOut, Menu, PanelLeftClose, PanelLeftOpen, Plus, ReceiptText, RotateCcw, Save, Search, ShieldCheck,
  Sparkles, Trash2, TrendingDown, UserRound, WalletCards, X
} from "lucide-react"
import { SignIn1 } from "@/components/ui/modern-stunning-sign-in"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { AppUser, authHeader, currentUser, signOut } from "@/lib/backend"
import { CookieConsent } from "@/components/CookieConsent"
import { PublicPage, SiteFooter, isPublicContentPath } from "@/components/PublicPages"
import { trackEvent } from "@/lib/analytics"
import { InstallAppPrompt } from "@/components/InstallAppPrompt"
import { FiscalAssistant } from "@/components/FiscalAssistant"
import { FloatingAssistant } from "@/components/FloatingAssistant"
import { AdminDashboard } from "@/components/AdminDashboard"
import { ProductStore } from "@/components/ProductStore"
import { SubscriptionPage } from "@/components/SubscriptionPage"
import { Portfolio } from "@/components/Portfolio"
import { ExecutiveReport } from "@/components/ExecutiveReport"
import { TeamWorkspace } from "@/components/TeamWorkspace"
import { LockedModule } from "@/components/LockedModule"
import { type AssistantAction } from "@/lib/assistantKnowledge"
import { requestPwaInstall } from "@/lib/pwaInstall"
import { formatCnpj, hasFeature, loadWorkspace, validCnpj, workspaceAction, type ReportBranding, type WorkspaceCompany, type WorkspaceContext, type WorkspaceScenario } from "@/lib/workspace"

type Page = "simulator" | "comparison" | "timeline" | "scenarios" | "portfolio" | "report" | "team" | "assistant" | "products" | "subscription" | "technical" | "admin"
type SavedScenario = { id: string; name: string; savedAt: string; state: any }

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })
const percent = new Intl.NumberFormat("pt-BR", { style: "percent", minimumFractionDigits: 2, maximumFractionDigits: 2 })
const money = (value: number) => currency.format(Number(value) || 0)
const pct = (value: number) => percent.format(Number(value) || 0)

export function App() {
  const [user, setUser] = React.useState<AppUser | null | undefined>(undefined)
  const [data, setData] = React.useState<any>(null)
  const [loadError, setLoadError] = React.useState("")
  const [engineReady, setEngineReady] = React.useState(() => Boolean(window.TaxEngine))
  const [path, setPath] = React.useState(() => window.location.pathname)
  const demoMode = React.useMemo(() => path === "/" && new URLSearchParams(window.location.search).get("demo") === "1", [path])

  React.useEffect(() => {
    const syncPath = () => setPath(window.location.pathname)
    window.addEventListener("popstate", syncPath)
    return () => window.removeEventListener("popstate", syncPath)
  }, [])

  React.useEffect(() => {
    if (path !== "/") return
    let active = true
    const loadEngine = async () => {
      if (window.TaxEngine) return
      await new Promise<void>((resolve, reject) => {
        const existing = document.querySelector<HTMLScriptElement>('script[data-tax-engine="true"]')
        if (existing) {
          existing.addEventListener("load", () => resolve(), { once: true })
          existing.addEventListener("error", () => reject(new Error("Falha ao carregar o motor tributário")), { once: true })
          return
        }
        const script = document.createElement("script")
        script.src = "/tax-engine.js"
        script.defer = true
        script.dataset.taxEngine = "true"
        script.onload = () => resolve()
        script.onerror = () => reject(new Error("Falha ao carregar o motor tributário"))
        document.head.appendChild(script)
      })
    }
    Promise.all([
      fetch("/data.json").then((response) => { if (!response.ok) throw new Error("Falha ao carregar a base tributária"); return response.json() }),
      loadEngine(),
    ]).then(([payload]) => { if (!active) return; setData(payload); setEngineReady(Boolean(window.TaxEngine)) })
      .catch(() => { if (active) setLoadError("Não foi possível carregar a base tributária. Atualize a página.") })
    return () => { active = false }
  }, [path])

  React.useEffect(() => {
    if (path !== "/") return
    currentUser().then(setUser).catch(() => setUser(null))
  }, [path])

  function authenticate(next: AppUser) { setUser(next); trackEvent("login_success") }
  async function logout() { await signOut(); setUser(null) }

  // Páginas institucionais e URLs inexistentes não dependem de autenticação.
  // Isso mantém SEO, páginas legais e 404 acessíveis mesmo se o Supabase estiver indisponível.
  if (isPublicContentPath(path)) return <><PublicPage path={path} /><CookieConsent /></>
  if (path !== "/") return <><PublicPage path={path} /><CookieConsent /></>

  if (user === undefined) return <div className="load-state"><span className="loader" /><strong>Verificando acesso</strong></div>
  if (!user && demoMode && data && engineReady && window.TaxEngine) {
    const demoUser: AppUser = { id: "demo", email: "demo@tributoleve.com.br", name: "Demonstração", role: "user", accessStatus: "test_access" }
    return <><FiscalWorkspace user={demoUser} data={data} demoMode onLogout={() => { const url = new URL(window.location.href); url.searchParams.delete("demo"); window.location.href = url.toString() }} /><CookieConsent /><InstallAppPrompt /></>
  }
  if (!user) return <><SignIn1 onAuthenticated={authenticate} /><SiteFooter /><CookieConsent /><InstallAppPrompt /></>
  if (loadError) return <div className="load-state"><CircleAlert /><strong>{loadError}</strong><Button onClick={() => location.reload()}>Tentar novamente</Button></div>
  if (!data || !engineReady || !window.TaxEngine) return <div className="load-state"><span className="loader" /><strong>Carregando a base tributária</strong></div>
  return <><FiscalWorkspace user={user} data={data} onLogout={logout} /><CookieConsent /><InstallAppPrompt /></>
}

function FiscalWorkspace({ user, data, onLogout, demoMode = false }: { user: AppUser; data: any; onLogout: () => void; demoMode?: boolean }) {
  const engine = window.TaxEngine
  const stateKey = demoMode ? "tributo-leve-demo-v4" : `tributo-leve-current-v4:${user.email}`
  const [page, setPage] = React.useState<Page>("simulator")
  const [step, setStep] = React.useState(1)
  const [menuOpen, setMenuOpen] = React.useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(() => localStorage.getItem("tributoleve-sidebar-collapsed") === "1")
  const [notice, setNotice] = React.useState("")
  const demoWorkspace = React.useMemo<WorkspaceContext>(() => ({
    workspace: { id: "demo", owner_id: "demo", name: "Demonstração Tributo Leve" },
    membership: { id: "demo", workspace_id: "demo", user_id: "demo", role: "owner", active: true },
    ownerId: "demo", isOwner: true, canEdit: true, canAccessViaTeam: false,
    products: [], features: [], moduleFeatures: [], adminBypass: false,
    plan: { slug: "demo", name: "Demonstração", billing_months: 0, company_limit: 1, included_features: [] }, planActive: true,
    limits: { companies: 1, members: 1, scenarios: 0 }, companies: [], scenarios: [], members: [], invites: [],
    branding: { office_name: "", responsible_name: "", contact_line: "", footer_text: "" }
  }), [])
  const [workspace, setWorkspace] = React.useState<WorkspaceContext | null>(demoMode ? demoWorkspace : null)
  const [workspaceError, setWorkspaceError] = React.useState("")
  const [workspaceLoading, setWorkspaceLoading] = React.useState(!demoMode)
  const [previewEssential, setPreviewEssential] = React.useState(() => user.role === "admin" && localStorage.getItem("tributoleve-admin-preview-essential") === "1")
  const [state, setState] = React.useState<any>(() => {
    if (demoMode) {
      const demo = engine.defaultState()
      demo.company.name = "Empresa Demonstração"
      demo.company.profile = "simples"
      demo.activities[0].cnae = data.cnaes?.[0]?.code || ""
      demo.activities[0].revenue = 50000
      demo.payrollMonth = 12000
      return engine.normalizeState(demo)
    }
    try { return engine.normalizeState(JSON.parse(localStorage.getItem(stateKey) || "null") || engine.defaultState()) }
    catch { return engine.defaultState() }
  })
  const results = React.useMemo(() => engine.calculate(data, state), [data, engine, state])

  React.useEffect(() => { if (!demoMode) localStorage.setItem(stateKey, JSON.stringify(state)) }, [state, stateKey, demoMode])

  async function reloadWorkspace() {
    if (demoMode) { setWorkspace(demoWorkspace); setWorkspaceLoading(false); return }
    setWorkspaceLoading(true); setWorkspaceError("")
    try { setWorkspace(await loadWorkspace(previewEssential)) }
    catch (cause) { setWorkspaceError(cause instanceof Error ? cause.message : "Não foi possível carregar os módulos da conta.") }
    finally { setWorkspaceLoading(false) }
  }

  React.useEffect(() => { void reloadWorkspace() }, [previewEssential, demoMode])

  React.useEffect(() => {
    if (demoMode) return
    let stopped = false
    const send = async () => {
      try {
        const headers = { "Content-Type": "application/json", ...(await authHeader()) }
        if (stopped) return
        await fetch("/.netlify/functions/presence", { method: "POST", headers, body: JSON.stringify({ area: page }), keepalive: true })
      } catch { /* presença é informativa e não deve interromper o uso */ }
    }
    void send()
    const timer = window.setInterval(() => { void send() }, 60_000)
    const onVisibility = () => { if (document.visibilityState === "visible") void send() }
    document.addEventListener("visibilitychange", onVisibility)
    return () => { stopped = true; window.clearInterval(timer); document.removeEventListener("visibilitychange", onVisibility) }
  }, [page, demoMode])

  const portfolioUnlocked = hasFeature(workspace, "portfolio")
  const reportUnlocked = hasFeature(workspace, "executive_report")
  const teamUnlocked = hasFeature(workspace, "team")

  // No Leve Start, a conta fica vinculada a um único CNPJ. Isso impede trocar de
  // empresa usando apenas cenários locais e dá valor real ao módulo Carteira.
  React.useEffect(() => {
    if (!workspace || portfolioUnlocked || !workspace.companies.length) return
    const company = workspace.companies[0]
    const current = String(state.company?.cnpj || "").replace(/\D/g, "")
    if (current === company.cnpj && state.company?.name === company.name) return
    setState((previous: any) => {
      const next = engine.normalizeState(previous)
      next.company.cnpj = formatCnpj(company.cnpj)
      next.company.name = company.name
      return next
    })
  }, [workspace?.workspace.id, workspace?.companies?.[0]?.id, portfolioUnlocked])

  function update(mutator: (draft: any) => void) {
    if (workspace && !workspace.canEdit) { toast("Seu perfil é somente consulta"); return }
    setState((current: any) => {
      const draft = structuredClone(current)
      mutator(draft)
      return engine.normalizeState(draft)
    })
  }
  function toast(message: string) { setNotice(message); window.setTimeout(() => setNotice(""), 3600) }

  async function bindCurrentCompany() {
    if (demoMode) return { id: "demo-company", name: state.company?.name || "Empresa Demonstração", cnpj: String(state.company?.cnpj || "").replace(/\D/g, "") } as WorkspaceCompany
    if (!workspace) throw new Error("Aguarde o carregamento da sua conta.")
    const cnpj = String(state.company?.cnpj || "").replace(/\D/g, "")
    const name = String(state.company?.name || "").trim()
    if (!name) throw new Error("Informe o nome da empresa antes de continuar.")
    if (!validCnpj(cnpj)) throw new Error("Informe um CNPJ válido antes de continuar.")
    const currentCompany = workspace.companies.find((item) => item.cnpj === cnpj)
    const result = await workspaceAction<{ company: WorkspaceCompany }>("upsert_company", { id: currentCompany?.id, name, cnpj }, previewEssential)
    await reloadWorkspace()
    return result.company
  }

  async function saveScenario() {
    if (demoMode) { toast("Na demonstração os dados não são salvos. Assine um plano para guardar seus cenários."); return }
    try {
      const company = await bindCurrentCompany()
      await workspaceAction("save_scenario", { companyId: company.id, name: state.company.name || company.name, state: structuredClone(state) }, previewEssential)
      await reloadWorkspace(); toast("Cenário salvo na nuvem")
    } catch (cause) { toast(cause instanceof Error ? cause.message : "Não foi possível salvar o cenário.") }
  }

  function resetScenario() {
    if (workspace && !workspace.canEdit) { toast("Seu perfil é somente consulta"); return }
    if (!confirm("Limpar os dados do cenário atual?")) return
    const next = engine.defaultState()
    if (workspace && !portfolioUnlocked && workspace.companies[0]) {
      next.company.name = workspace.companies[0].name
      next.company.cnpj = formatCnpj(workspace.companies[0].cnpj)
    }
    setState(next); setStep(1); setPage("simulator"); toast("Novo cenário iniciado")
  }
  function go(next: Page) {
    const demoAllowed: Page[] = ["simulator", "comparison", "products"]
    if (demoMode && !demoAllowed.includes(next)) {
      toast("Esse recurso faz parte da experiência completa. Escolha um plano para liberar o acesso.")
      setPage("products")
      setMenuOpen(false)
      window.scrollTo({ top: 0, behavior: "smooth" })
      return
    }
    setPage(next); setMenuOpen(false); window.scrollTo({ top: 0, behavior: "smooth" })
  }
  function toggleSidebar() {
    setSidebarCollapsed((current) => {
      const next = !current
      localStorage.setItem("tributoleve-sidebar-collapsed", next ? "1" : "0")
      return next
    })
  }
  function openScenario(item: WorkspaceScenario) { setState(engine.normalizeState(item.state)); setStep(1); go("simulator"); toast("Cenário carregado") }
  function startCompany(company: WorkspaceCompany) {
    if (workspace && !workspace.canEdit) { toast("Seu perfil é somente consulta"); return }
    const next = engine.defaultState(); next.company.name = company.name; next.company.cnpj = formatCnpj(company.cnpj)
    setState(engine.normalizeState(next)); setStep(1); go("simulator"); toast(`Novo cenário para ${company.name}`)
  }

  async function handleAssistantAction(action: AssistantAction) {
    if (action.type === "install_app") {
      const result = await requestPwaInstall()
      if (result.outcome === "unavailable") toast("O instalador nativo ainda não está disponível neste navegador.")
      return
    }
    const allowed: Page[] = ["simulator", "comparison", "timeline", "scenarios", "portfolio", "report", "team", "assistant", "products", "subscription", "technical", "admin"]
    if (!allowed.includes(action.page as Page)) return
    if (demoMode && !["simulator", "comparison", "products"].includes(action.page)) { go("products"); return }
    if (action.page === "admin" && user.role !== "admin") { toast("Esta área é exclusiva para administradores"); return }
    if (action.page === "simulator" && action.step) setStep(Math.max(1, Math.min(4, action.step)))
    go(action.page as Page)
  }

  async function togglePreview() {
    const next = !previewEssential
    setPreviewEssential(next)
    localStorage.setItem("tributoleve-admin-preview-essential", next ? "1" : "0")
    setPage("simulator")
    toast(next ? "Modo cliente Leve Start ativado" : "Modo administrador completo ativado")
  }

  const fullNav = [
    ["simulator", Calculator, "Simular"], ["comparison", BarChart3, "Comparar"],
    ["timeline", Clock3, "Transição"], ["scenarios", FolderClock, "Cenários"],
    ["portfolio", Building2, "Carteira"], ["report", ReceiptText, "Relatório executivo"], ["team", UserRound, "Equipe"],
    ["assistant", Bot, "Assistente"], ["products", Layers3, "Planos e módulos"],
    ...(workspace?.isOwner && !demoMode ? [["subscription", WalletCards, "Minha assinatura"]] as const : []),
    ["technical", BookOpen, "Base técnica"],
    ...(user.role === "admin" ? [["admin", ShieldCheck, "Administração"]] as const : [])
  ] as const
  const nav = demoMode
    ? fullNav.filter(([id]) => id === "simulator" || id === "comparison" || id === "products")
    : fullNav

  const assistantContext = React.useMemo(() => ({
    page, step, year: state.year, companyName: state.company?.name, totalRevenue: results.main?.totalRevenue,
    pureTotal: results.main?.pureTotal, hybridTotal: results.main?.hybridTotal, hybridDas: results.main?.hybridDas,
    outsideTotal: results.main?.outsideTotal, cbsCredit: results.main?.cbsCredit, ibsCredit: results.main?.ibsCredit,
    factorR: results.main?.factorR, bestRegime: results.bestRegime?.name, bestRegimeTotal: results.bestRegime?.total,
    warnings: (results.main?.warnings || []).map((item: any) => item.text),
    portfolioUnlocked, reportUnlocked, teamUnlocked, companyLimit: workspace?.limits.companies, memberLimit: workspace?.limits.members
  }), [page, step, state.year, state.company?.name, results, portfolioUnlocked, reportUnlocked, teamUnlocked, workspace?.limits.companies, workspace?.limits.members])

  if (workspaceLoading && !workspace) return <div className="load-state"><span className="loader" /><strong>Preparando sua licença e módulos</strong></div>
  if (workspaceError && !workspace) return <div className="load-state"><CircleAlert /><strong>Atualização do banco necessária</strong><p>{workspaceError}</p><p>Execute <b>4_ATUALIZAR_MODULOS_FUNCIONAIS.bat</b>, rode o SQL no Supabase e publique novamente.</p><Button onClick={reloadWorkspace}>Tentar novamente</Button></div>
  if (!workspace) return null

  const cloudScenarios: SavedScenario[] = workspace.scenarios.map((item) => ({ id: item.id, name: item.name, savedAt: item.saved_at, state: item.state }))

  return (
    <div className={cn("app-shell", sidebarCollapsed && "sidebar-collapsed")}>
      {demoMode && <div className="demo-banner"><div><strong>DEMONSTRAÇÃO GRATUITA</strong><span>Experimente Simular e Comparar com dados de exemplo. Recursos avançados ficam disponíveis após a assinatura.</span></div><button onClick={() => go("products")}>Ver planos <ArrowRight size={16} /></button></div>}
      <aside className={cn("sidebar", menuOpen && "is-open", sidebarCollapsed && "is-collapsed")}>
        <button className="sidebar-close" onClick={() => setMenuOpen(false)} aria-label="Fechar menu"><X /></button>
        <button className="sidebar-collapse" onClick={toggleSidebar} aria-label={sidebarCollapsed ? "Expandir menu lateral" : "Recolher menu lateral"} title={sidebarCollapsed ? "Expandir menu" : "Recolher menu"}>{sidebarCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}</button>
        <button className="brand" onClick={() => go("simulator")}><span className="brand-mark"><img src="/tributo-leve-icon.svg" alt="" aria-hidden="true" /></span><span><strong>Tributo</strong><small>Leve</small></span></button>
        <nav aria-label="Navegação principal">
          {nav.map(([id, Icon, label]) => <button key={id} className={page === id ? "active" : ""} onClick={() => go(id as Page)} title={sidebarCollapsed ? label : undefined} aria-label={label}><Icon size={19} /><span>{label}</span>{page === id && <motion.i layoutId="nav-indicator" />}</button>)}
        </nav>
        {user.role === "admin" && <button className={cn("admin-preview-toggle", previewEssential && "active")} onClick={togglePreview}><ShieldCheck size={17} /><span><strong>{previewEssential ? "Visualizando Leve Start" : "Admin: módulos liberados"}</strong><small>{previewEssential ? "Clique para voltar ao acesso completo" : "Clique para testar limites do cliente"}</small></span></button>}
        <div className="sidebar-user"><span><UserRound size={18} /></span><div><strong>{user.name}</strong><small>{workspace.membership.role === "owner" ? user.email : `${user.email} · colaborador`}</small></div><button onClick={onLogout} aria-label="Sair"><LogOut size={18} /></button></div>
      </aside>
      {menuOpen && <button className="menu-scrim" onClick={() => setMenuOpen(false)} aria-label="Fechar menu" />}

      <div className="app-main">
        <header className="topbar">
          <button className="mobile-menu" onClick={() => setMenuOpen(true)} aria-label="Abrir menu"><Menu /></button>
          <div className="topbar-context"><span>{page === "simulator" ? `Etapa ${step} de 4` : nav.find(([id]) => id === page)?.[2]}</span><strong>{state.company.name || "Novo cenário"}</strong></div>
          <div className="topbar-actions">
            <label className="year-control"><span>Ano</span><select aria-label="Ano da simulação" value={state.year} disabled={!workspace.canEdit} onChange={(e) => update((draft) => { draft.year = Number(e.target.value) })}>{engine.YEARS.map((year) => <option key={year}>{year}</option>)}</select></label>
            <Button variant="secondary" onClick={() => void saveScenario()} disabled={!workspace.canEdit}><Save size={17} /><span className="button-label">Salvar</span></Button>
            <Button variant="ghost" onClick={resetScenario} disabled={!workspace.canEdit} aria-label="Iniciar novo cenário"><RotateCcw size={18} /></Button>
            <Button onClick={() => demoMode ? go("products") : reportUnlocked ? go("report") : window.print()}><FileDown size={17} /><span className="button-label">{demoMode ? "Ver planos" : "Relatório"}</span></Button>
          </div>
        </header>
        <main className="content">
          <AnimatePresence mode="wait">
            <motion.div key={page} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: .28 }}>
              {page === "simulator" && <Simulator state={state} update={update} data={data} results={results} step={step} setStep={setStep} go={go} bindCompany={bindCurrentCompany} canEdit={workspace.canEdit} baseCompany={!portfolioUnlocked ? workspace.companies[0] : null} demoMode={demoMode} />}
              {page === "comparison" && <Comparison results={results} state={state} demoMode={demoMode} onUpgrade={() => go("products")} />}
              {page === "timeline" && <Timeline results={results} />}
              {page === "scenarios" && <Scenarios scenarios={cloudScenarios} canEdit={workspace.canEdit} onLoad={(item: SavedScenario) => { const source = workspace.scenarios.find((scenario) => scenario.id === item.id); if (source) openScenario(source) }} onDelete={async (id: string) => { await workspaceAction("delete_scenario", { scenarioId: id }, previewEssential); await reloadWorkspace(); toast("Cenário excluído") }} />}
              {page === "portfolio" && (portfolioUnlocked ? <Portfolio context={workspace} onAddCompany={async (input) => { await workspaceAction("upsert_company", input, previewEssential); await reloadWorkspace(); toast("CNPJ adicionado à carteira") }} onDeleteCompany={async (company) => { if (!confirm(`Excluir ${company.name} e todos os cenários vinculados?`)) return; await workspaceAction("delete_company", { companyId: company.id }, previewEssential); await reloadWorkspace(); toast("Empresa removida") }} onOpenScenario={openScenario} onStartCompany={startCompany} /> : <LockedModule title="Carteira de clientes" description="O Leve Start trabalha com 1 CNPJ e o Leve Pro/Prime com até 4. Este módulo expande a carteira para até 100 empresas, com cenários separados por CNPJ." onOpenStore={() => go("products")} />)}
              {page === "report" && (reportUnlocked ? <ExecutiveReport state={state} results={results} branding={workspace.branding} canEdit={workspace.canEdit} onSaveBranding={async (branding: ReportBranding) => { await workspaceAction("save_branding", { officeName: branding.office_name, responsibleName: branding.responsible_name, contactLine: branding.contact_line, footerText: branding.footer_text }, previewEssential); await reloadWorkspace() }} /> : <LockedModule title="Relatório executivo" description="O Leve Start e o Leve Pro mantêm a impressão simples. Este módulo cria um documento profissional com capa, comparativos, transição, memória técnica e identidade do escritório." onOpenStore={() => go("products")} />)}
              {page === "team" && (teamUnlocked ? <TeamWorkspace context={workspace} onInvite={(email, role) => workspaceAction("invite_member", { email, role }, previewEssential)} onRemove={async (memberId) => { if (!confirm("Remover este colaborador do workspace?")) return; await workspaceAction("remove_member", { memberId }, previewEssential); await reloadWorkspace() }} onRole={async (memberId, role) => { await workspaceAction("update_member_role", { memberId, role }, previewEssential); await reloadWorkspace() }} onRevoke={async (inviteId) => { await workspaceAction("revoke_invite", { inviteId }, previewEssential); await reloadWorkspace() }} onRefresh={reloadWorkspace} /> : <LockedModule title="Equipe adicional" description="Libera até 3 colaboradores além do titular, com perfil Editor ou Somente consulta e acesso compartilhado à operação do workspace." onOpenStore={() => go("products")} />)}
              {page === "assistant" && <FiscalAssistant context={assistantContext} onAction={handleAssistantAction} />}
              {page === "products" && (demoMode ? <DemoUpgrade onExit={onLogout} /> : <ProductStore user={user} ownedFeatures={workspace.moduleFeatures || []} includedPlanFeatures={workspace.plan?.included_features || []} currentPlanSlug={workspace.plan?.slug || ""} canPurchase={workspace.isOwner} onOpenFeature={(featureKey) => go(featureKey === "portfolio" ? "portfolio" : featureKey === "executive_report" ? "report" : featureKey === "team" ? "team" : "products")} />)}
              {page === "subscription" && !demoMode && workspace.isOwner && <SubscriptionPage user={user} canManage={workspace.isOwner} onOpenPlans={() => go("products")} />}
              {page === "technical" && <Technical data={data} results={results} />}
              {page === "admin" && user.role === "admin" && <AdminDashboard />}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
      {!demoMode && <FloatingAssistant hidden={page === "assistant" || page === "report"} onOpenFull={() => go("assistant")} context={assistantContext} onAction={handleAssistantAction} />}
      <AnimatePresence>{notice && <motion.div className="toast" initial={{ opacity: 0, y: 22, scale: .96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 12 }}><Check size={18} />{notice}</motion.div>}</AnimatePresence>
    </div>
  )
}

function DemoUpgrade({ onExit }: { onExit: () => void }) {
  return <section className="demo-upgrade panel"><p className="kicker">FIM DA DEMONSTRAÇÃO</p><h1>Gostou do resultado?</h1><p>A conta paga libera salvamento em nuvem, histórico, módulos, carteira de CNPJs e suporte ao seu plano.</p><div className="demo-upgrade-grid"><article><strong>Leve Start</strong><span>1 CNPJ + simulador completo</span></article><article><strong>Leve Pro</strong><span>Até 4 CNPJs</span></article><article><strong>Leve Prime</strong><span>3 meses + 4 CNPJs + Relatório Executivo</span></article></div><Button onClick={onExit}>Ver preços e criar conta<ArrowRight /></Button></section>
}

const steps = [
  { title: "Perfil", caption: "Empresa e atividade", icon: Building2 },
  { title: "Apuração", caption: "Receita e folha", icon: ReceiptText },
  { title: "Créditos", caption: "Custos elegíveis", icon: WalletCards },
  { title: "Ajustes", caption: "Parâmetros finais", icon: Gauge }
]

function Simulator({ state, update, data, results, step, setStep, go, bindCompany, canEdit, baseCompany, demoMode = false }: any) {
  const main = results.main
  const visibleSteps = demoMode ? steps.slice(0, 2) : steps
  const maxStep = visibleSteps.length
  const [stepError, setStepError] = React.useState("")
  React.useEffect(() => { if (demoMode && step > maxStep) setStep(maxStep) }, [demoMode, step, maxStep, setStep])
  const goStep = async (next: number) => {
    setStepError("")
    if (demoMode && next > maxStep) { go("comparison"); return }
    if (step === 1 && next > 1) {
      try { await bindCompany() }
      catch (cause) { setStepError(cause instanceof Error ? cause.message : "Não foi possível vincular o CNPJ."); return }
    }
    setStep(Math.max(1, Math.min(maxStep, next))); window.scrollTo({ top: 0, behavior: "smooth" })
  }
  return (
    <>
      <section className="workspace-heading"><div><p className="kicker">SIMULAÇÃO ATIVA</p><h1>Monte o cenário da empresa</h1></div><div className="calculation-pulse"><span /><strong>Cálculo em tempo real</strong></div></section>
      <div className={cn("step-rail", demoMode && "demo-step-rail")} style={{ "--progress": `${Math.min(100, step / maxStep * 100)}%`, "--step-count": maxStep } as React.CSSProperties}>
        {visibleSteps.map((item, index) => { const Icon = item.icon; const active = index + 1 === step; const done = index + 1 < step; return <button key={item.title} className={cn(active && "active", done && "done")} onClick={() => void goStep(index + 1)}><span>{done ? <Check size={16} /> : <Icon size={17} />}</span><div><strong>{item.title}</strong><small>{item.caption}</small></div></button> })}
      </div>
      <div className="simulation-layout">
        <section className="form-surface">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={step} initial={{ opacity: 0, x: 22 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: .3 }}>
              {step === 1 && <ProfileStep state={state} update={update} data={data} main={main} baseCompany={baseCompany} />}
              {step === 2 && <RevenueStep state={state} update={update} main={main} />}
              {step === 3 && <CreditsStep state={state} update={update} data={data} main={main} />}
              {step === 4 && <AdjustmentsStep state={state} update={update} main={main} />}
            </motion.div>
          </AnimatePresence>
          {stepError && <p className="form-step-error"><CircleAlert size={17} />{stepError}</p>}
          {!canEdit && <p className="form-step-error"><ShieldCheck size={17} />Você está em modo somente consulta. O titular pode alterar sua permissão em Equipe.</p>}
          <div className="form-navigation"><Button variant="secondary" disabled={step === 1} onClick={() => void goStep(step - 1)}><ArrowLeft size={17} />Voltar</Button><span>{demoMode ? "Demonstração: os dados são temporários" : "Alterações salvas automaticamente"}</span><Button onClick={() => step < maxStep ? void goStep(step + 1) : go("comparison")}>{step === maxStep ? "Ver comparação" : "Continuar"}<ArrowRight size={17} /></Button></div>
        </section>
        <LiveSummary state={state} main={main} go={go} />
      </div>
    </>
  )
}

function Field({ id, label, helper, children, className }: { id: string; label: string; helper?: string; children: React.ReactNode; className?: string }) {
  return <div className={cn("field", className)}><Label htmlFor={id}>{label}</Label>{children}{helper && <p className="field-helper">{helper}</p>}</div>
}
function Select({ id, value, onChange, children, disabled }: any) {
  return <div className="select-wrap"><select id={id} value={value} onChange={onChange} disabled={disabled}>{children}</select><ChevronDown size={17} /></div>
}
function MoneyInput({ id, value, onChange, placeholder = "0,00" }: any) {
  return <div className="money-field"><span>R$</span><Input id={id} type="number" min="0" step="100" value={value || ""} onChange={onChange} placeholder={placeholder} /></div>
}

function ProfileStep({ state, update, data, main, baseCompany }: any) {
  return <div>
    <SectionTitle number="01" title="Perfil da empresa" subtitle="Identifique o enquadramento e a atividade principal." />
    <div className="fields-grid three">
      <Field id="profile" label="Regime tributário atual" helper="Use 'Ainda não sei' para seguir sem definir."><Select id="profile" value={state.company.profile} onChange={(e: any) => update((d: any) => { d.company.profile = e.target.value })}><option value="">Selecione o regime</option><option value="mei">MEI</option><option value="simples">Simples Nacional</option><option value="presumido">Lucro Presumido</option><option value="real">Lucro Real</option><option value="unknown">Ainda não sei</option></Select></Field>
      <Field id="company-name" label="Nome da empresa ou cenário"><Input id="company-name" value={state.company.name} onChange={(e) => update((d: any) => { d.company.name = e.target.value })} placeholder="Exemplo: Matriz Recife" /></Field>
      <Field id="company-cnpj" label="CNPJ" helper={baseCompany ? `Seu plano está vinculado a ${formatCnpj(baseCompany.cnpj)}. Para trabalhar com mais CNPJs, faça upgrade ou use Carteira de clientes.` : "O primeiro CNPJ válido fica vinculado à conta quando o plano tiver limite de 1 empresa."}><Input id="company-cnpj" inputMode="numeric" disabled={Boolean(baseCompany)} value={state.company.cnpj} onChange={(e) => update((d: any) => { d.company.cnpj = formatCnpj(e.target.value) })} placeholder="00.000.000/0000-00" /></Field>
    </div>
    <ActivityEditor index={0} state={state} update={update} data={data} activityResult={main.activities[0]} />
    <details className="expand-block"><summary><Plus size={17} />Adicionar atividade secundária</summary><ActivityEditor index={1} state={state} update={update} data={data} activityResult={main.activities[1]} /></details>
  </div>
}

function ActivityEditor({ index, state, update, data, activityResult }: any) {
  const activity = state.activities[index]
  const listId = `cnaes-${index}`
  return <section className="activity-editor">
    <div className="activity-head"><span>{String(index + 1).padStart(2, "0")}</span><div><strong>{index === 0 ? "Atividade principal" : "Atividade secundária"}</strong><small>{activityResult.annex ? `Anexo ${activityResult.annex} identificado` : "Aguardando CNAE"}</small></div></div>
    <div className="fields-grid two">
      <Field id={`cnae-${index}`} label="CNAE ou descrição da atividade" helper="Pesquise pelo código ou por parte da descrição."><Input id={`cnae-${index}`} list={listId} value={window.TaxEngine.getCnae(data, activity.cnae)?.label || activity.cnae} onChange={(e) => { const found = window.TaxEngine.getCnae(data, e.target.value); update((d: any) => { d.activities[index].cnae = found?.code || e.target.value }) }} placeholder="Digite para pesquisar" /><datalist id={listId}>{data.cnaes.map((item: any) => <option key={item.code} value={item.label} />)}</datalist></Field>
      <Field id={`special-${index}`} label="Tratamento da receita"><Select id={`special-${index}`} value={activity.specialRegime} onChange={(e: any) => update((d: any) => { d.activities[index].specialRegime = e.target.value })}>{data.specialRegimes.map((item: any) => <option key={item.name}>{item.name}</option>)}</Select></Field>
      <Field id={`annex-${index}`} label="Anexo manual, opcional" helper="Só altere quando o enquadramento tiver sido validado."><Select id={`annex-${index}`} value={activity.annexOverride} onChange={(e: any) => update((d: any) => { d.activities[index].annexOverride = e.target.value })}><option value="">Determinar automaticamente</option>{["I","II","III","IV","V"].map((annex) => <option key={annex}>{annex}</option>)}</Select></Field>
    </div>
  </section>
}

function RevenueStep({ state, update, main }: any) {
  return <div><SectionTitle number="02" title="Receita e folha" subtitle="Informe os valores mensais usados na apuração." />
    <div className="fields-grid three">
      <Field id="revenue-1" label="Receita mensal da atividade principal"><MoneyInput id="revenue-1" value={state.activities[0].revenue} onChange={(e: any) => update((d: any) => { d.activities[0].revenue = Number(e.target.value) })} /></Field>
      <Field id="revenue-2" label="Receita mensal da atividade secundária"><MoneyInput id="revenue-2" value={state.activities[1].revenue} onChange={(e: any) => update((d: any) => { d.activities[1].revenue = Number(e.target.value) })} /></Field>
      <Field id="payroll-month" label="Folha salarial do mês"><MoneyInput id="payroll-month" value={state.payrollMonth} onChange={(e: any) => update((d: any) => { d.payrollMonth = Number(e.target.value) })} /></Field>
    </div>
    <div className="estimate-grid">
      <EstimateCard title="Receita acumulada em 12 meses" id="rbt12" checked={state.rbt12Auto} onCheck={(checked: boolean) => update((d: any) => { d.rbt12Auto = checked })}><MoneyInput id="rbt12" value={state.rbt12Auto ? main.rbt12 : state.rbt12} onChange={(e: any) => update((d: any) => { d.rbt12 = Number(e.target.value) })} /></EstimateCard>
      <EstimateCard title="Folha acumulada em 12 meses" id="payroll12" checked={state.payroll12Auto} onCheck={(checked: boolean) => update((d: any) => { d.payroll12Auto = checked })}><MoneyInput id="payroll12" value={state.payroll12Auto ? main.payroll12 : state.payroll12} onChange={(e: any) => update((d: any) => { d.payroll12 = Number(e.target.value) })} /></EstimateCard>
    </div>
    <div className="factor-card"><div><span>Fator R calculado</span><motion.strong key={main.factorR}>{pct(main.factorR)}</motion.strong></div><div className="factor-track"><motion.i animate={{ width: `${Math.min(main.factorR / .4 * 100, 100)}%` }} /><b style={{ left: "70%" }} /></div><p>{main.rbt12 <= 0 ? "Preencha receita e folha para calcular." : main.factorR >= .28 ? "A folha alcança a referência de 28%." : "A folha está abaixo da referência de 28%."}</p></div>
    <Field id="b2b" label={`Participação de vendas para empresas: ${Math.round(state.b2bShare * 100)}%`} helper={`Vendas para consumidor final: ${Math.round((1 - state.b2bShare) * 100)}%`}><input id="b2b" className="range" type="range" min="0" max="100" value={state.b2bShare * 100} onChange={(e) => update((d: any) => { d.b2bShare = Number(e.target.value) / 100 })} /></Field>
  </div>
}

function EstimateCard({ title, id, checked, onCheck, children }: any) {
  return <div className="estimate-card"><div><strong>{title}</strong><label className="switch-label" htmlFor={`${id}-auto`}><input id={`${id}-auto`} type="checkbox" checked={checked} onChange={(e) => onCheck(e.target.checked)} /><span /><b>Estimar automaticamente</b></label></div><div className={checked ? "disabled-control" : ""}>{children}</div></div>
}

function CreditsStep({ state, update, data, main }: any) {
  const highestCostWithValue = state.costs.reduce((last: number, cost: any, index: number) => Number(cost.value) > 0 ? index + 1 : last, 0)
  const [visibleCosts, setVisibleCosts] = React.useState(() => Math.max(3, highestCostWithValue))
  React.useEffect(() => { setVisibleCosts((current) => Math.max(current, 3, highestCostWithValue)) }, [highestCostWithValue])
  const shownCosts = state.costs.slice(0, visibleCosts)

  return <div><SectionTitle number="03" title="Créditos de IBS e CBS" subtitle="Classifique os custos do período. Comece pelos três principais e adicione outros somente quando precisar." />
    <div className="credit-totals"><ValueBlock label="Crédito CBS" value={money(main.cbsCostCredit)} /><ValueBlock label="Crédito IBS" value={money(main.ibsCostCredit)} /><ValueBlock accent label="Total potencial" value={money(main.cbsCostCredit + main.ibsCostCredit)} /></div>
    <div className="cost-list">{shownCosts.map((cost: any, index: number) => <motion.article layout className="cost-row" key={index}>
      <span className="cost-index">{String(index + 1).padStart(2, "0")}</span>
      <Field id={`cost-description-${index}`} label="Item de custo"><Input id={`cost-description-${index}`} value={cost.description} onChange={(e) => update((d: any) => { d.costs[index].description = e.target.value })} /></Field>
      <Field id={`cost-category-${index}`} label="Categoria"><Select id={`cost-category-${index}`} value={cost.category} onChange={(e: any) => update((d: any) => { d.costs[index].category = e.target.value })}><option>Mercadoria/Insumo</option><option>Despesa</option></Select></Field>
      <Field id={`cost-value-${index}`} label="Valor mensal"><MoneyInput id={`cost-value-${index}`} value={cost.value} onChange={(e: any) => update((d: any) => { d.costs[index].value = Number(e.target.value) })} /></Field>
      <Field id={`cost-special-${index}`} label="Tratamento"><Select id={`cost-special-${index}`} value={cost.specialRegime} onChange={(e: any) => update((d: any) => { d.costs[index].specialRegime = e.target.value })}>{data.specialRegimes.map((item: any) => <option key={item.name}>{item.name}</option>)}</Select></Field>
      <Field id={`cost-credit-${index}`} label="Gera crédito"><Select id={`cost-credit-${index}`} value={String(cost.generatesCredit)} onChange={(e: any) => update((d: any) => { d.costs[index].generatesCredit = e.target.value === "true" })}><option value="true">Sim</option><option value="false">Não</option></Select></Field>
      <div className="calculated-credit"><span>Crédito estimado</span><strong>{money(main.costLines[index]?.cbsCredit + main.costLines[index]?.ibsCredit)}</strong></div>
    </motion.article>)}</div>
    {visibleCosts < state.costs.length && <div className="cost-list-actions"><button type="button" className="add-cost-button" onClick={() => setVisibleCosts((current) => Math.min(state.costs.length, current + 1))}><Plus size={17} /><span>Adicionar outro custo</span><small>{visibleCosts} de {state.costs.length} exibidos</small></button><button type="button" className="show-all-costs" onClick={() => setVisibleCosts(state.costs.length)}>Mostrar todos</button></div>}
  </div>
}

function AdjustmentsStep({ state, update, main }: any) {
  return <div><SectionTitle number="04" title="Ajustes da apuração" subtitle="Abra apenas os grupos necessários para o cenário." />
    <div className="accordion-list">
      <AdjustmentGroup title="Retenções do mês" open><div className="fields-grid two"><Field id="retained-icms" label="ICMS retido"><MoneyInput id="retained-icms" value={state.retainedIcms} onChange={(e: any) => update((d: any) => { d.retainedIcms = Number(e.target.value) })} /></Field><Field id="retained-iss" label="ISS retido"><MoneyInput id="retained-iss" value={state.retainedIss} onChange={(e: any) => update((d: any) => { d.retainedIss = Number(e.target.value) })} /></Field></div></AdjustmentGroup>
      <AdjustmentGroup title="Créditos da transição"><div className="fields-grid three"><Field id="cbs-stock" label="Estoque em 31/12/2026"><MoneyInput id="cbs-stock" value={state.cbsStockValue} onChange={(e: any) => update((d: any) => { d.cbsStockValue = Number(e.target.value) })} /></Field><Field id="cbs-installment" label="Parcela CBS, de 1 a 12"><Input id="cbs-installment" type="number" min="1" max="12" value={state.cbsStockInstallment} onChange={(e) => update((d: any) => { d.cbsStockInstallment = Number(e.target.value) })} /></Field><Field id="icms-credit" label="Saldo credor de ICMS"><MoneyInput id="icms-credit" value={state.icmsCreditBalance} onChange={(e: any) => update((d: any) => { d.icmsCreditBalance = Number(e.target.value) })} /></Field></div></AdjustmentGroup>
      <AdjustmentGroup title="Encargos patronais"><div className="fields-grid five"><PercentField id="cpp" label="CPP" value={state.payrollCharges.cpp * 100} onChange={(v: number) => update((d: any) => { d.payrollCharges.cpp = v / 100 })} /><PercentField id="rat" label="RAT" value={state.payrollCharges.rat * 100} onChange={(v: number) => update((d: any) => { d.payrollCharges.rat = v / 100 })} /><PercentField id="fap" label="FAP" value={state.payrollCharges.fap} onChange={(v: number) => update((d: any) => { d.payrollCharges.fap = v })} /><PercentField id="third" label="Terceiros" value={state.payrollCharges.thirdParties * 100} onChange={(v: number) => update((d: any) => { d.payrollCharges.thirdParties = v / 100 })} /><PercentField id="other" label="Outros" value={state.payrollCharges.other * 100} onChange={(v: number) => update((d: any) => { d.payrollCharges.other = v / 100 })} /></div><div className="formula-result"><span>Alíquota efetiva</span><strong>{pct(main.payrollRate)}</strong><span>Encargo mensal</span><strong>{money(main.payrollOutside)}</strong></div></AdjustmentGroup>
      <AdjustmentGroup title="Critério de leitura"><div className="method-grid"><label><input type="radio" name="method" checked={state.methodology === "technical"} onChange={() => update((d: any) => { d.methodology = "technical" })} /><span><strong>Análise técnica</strong><small>Aplica as correções identificadas na auditoria.</small></span></label><label><input type="radio" name="method" checked={state.methodology === "spreadsheet"} onChange={() => update((d: any) => { d.methodology = "spreadsheet" })} /><span><strong>Reprodução da planilha</strong><small>Mantém a lógica original para conferência.</small></span></label></div></AdjustmentGroup>
    </div>
  </div>
}

function PercentField({ id, label, value, onChange }: any) { return <Field id={id} label={`${label}, %`}><Input id={id} type="number" min="0" step="0.1" value={value || ""} onChange={(e) => onChange(Number(e.target.value))} /></Field> }
function AdjustmentGroup({ title, children, open = false }: any) { return <details className="adjustment-group" open={open}><summary><strong>{title}</strong><ChevronDown size={19} /></summary><motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>{children}</motion.div></details> }
function SectionTitle({ number, title, subtitle }: any) { return <header className="section-title"><span>{number}</span><div><h2>{title}</h2><p>{subtitle}</p></div></header> }

function LiveSummary({ state, main, go }: any) {
  const ready = main.totalRevenue > 0 && main.activities[0].annex
  return <aside className="live-summary"><div className="summary-orbit"><Sparkles size={18} /></div><p className="kicker">PRÉVIA DO CENÁRIO</p><h2>{state.company.name || "Seu negócio"}</h2><span className="annex-chip">{main.activities.map((item: any) => item.annex).filter(Boolean).length ? `Anexo ${main.activities.map((item: any) => item.annex).filter(Boolean).join(" + ")}` : "Anexo pendente"}</span>
    {!ready ? <div className="summary-empty"><Activity /><strong>Aguardando dados</strong><p>Informe a atividade principal e a receita mensal.</p></div> : <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}><ValueBlock dark label="Simples Puro" value={money(main.pureTotal)} /><ValueBlock dark accent label="Simples Híbrido" value={money(main.hybridTotal)} /><div className="summary-difference"><span>Diferença mensal</span><motion.strong key={main.difference}>{main.difference > 0 ? "+" : ""}{money(main.difference)}</motion.strong></div><dl><dt>DAS híbrido</dt><dd>{money(main.hybridDas)}</dd><dt>IBS e CBS fora</dt><dd>{money(main.outsideTotal)}</dd><dt>Créditos usados</dt><dd>{money(main.cbsCredit + main.ibsCredit)}</dd></dl></motion.div>}
    <Button className="w-full" variant="secondary" onClick={() => go("comparison")}>Abrir comparação<ArrowRight size={17} /></Button>
  </aside>
}

function ValueBlock({ label, value, accent, dark }: any) { return <div className={cn("value-block", accent && "accent", dark && "dark")}><span>{label}</span><motion.strong key={value} initial={{ opacity: .4, y: 6 }} animate={{ opacity: 1, y: 0 }}>{value}</motion.strong></div> }

function Comparison({ results, state, demoMode = false, onUpgrade }: any) {
  const [selected, setSelected] = React.useState("Simples Híbrido")
  const current = results.regimes.find((item: any) => item.name === selected) || results.regimes[0]
  const ready = results.main.totalRevenue > 0 && results.main.activities[0].annex
  return <>
    <section className="workspace-heading"><div><p className="kicker">COMPARAÇÃO MENSAL</p><h1>Quatro regimes, uma leitura</h1><p>Valores para {state.year} com receita mensal de {money(results.main.totalRevenue)}.</p></div><span className="method-chip">{state.methodology === "technical" ? "Análise técnica" : "Reprodução da planilha"}</span></section>
    <div className="regime-grid">{results.regimes.map((item: any, index: number) => <motion.button key={item.name} onClick={() => setSelected(item.name)} className={cn("regime-card", selected === item.name && "selected", ready && results.bestRegime.name === item.name && "best")} initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * .07 }}><span className="regime-tag">{ready && results.bestRegime.name === item.name ? "MENOR CUSTO" : "SELECIONAR"}</span><h3>{item.name}</h3><strong>{ready ? money(item.total) : "Aguardando dados"}</strong><dl><dt>Tributos</dt><dd>{money(item.tax)}</dd><dt>Encargos</dt><dd>{money(item.payroll)}</dd><dt>Receita</dt><dd>{pct(results.main.totalRevenue ? item.total / results.main.totalRevenue : 0)}</dd></dl></motion.button>)}</div>
    <AnimatePresence mode="wait"><motion.section key={current.name} className="selected-regime" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}><div><p className="kicker">REGIME SELECIONADO</p><h2>{current.name}</h2><p>Composição mensal estimada para o cenário atual.</p></div><ValueBlock label="Tributos" value={money(current.tax)} /><ValueBlock label="Encargos" value={money(current.payroll)} /><ValueBlock accent label="Total mensal" value={money(current.total)} /></motion.section></AnimatePresence>
    {demoMode ? <section className="demo-comparison-gate panel"><div><p className="kicker">PRÉVIA CONCLUÍDA</p><h2>Quer abrir a análise completa?</h2><p>A demonstração mostra a comparação principal. Assinantes também acessam composição detalhada, margem estimada, memória de cálculo, transição 2027 a 2033, histórico e demais recursos do Tributo Leve.</p></div><Button onClick={onUpgrade}>Ver planos e liberar recursos<ArrowRight size={17} /></Button></section> : <><div className="comparison-panels"><article className="panel"><SectionTitle number="A" title="Composição do custo" subtitle="Compare o peso de tributos e encargos." />{results.regimes.map((item: any) => <div className="bar-row" key={item.name}><span>{item.name}</span><div><motion.i initial={{ width: 0 }} animate={{ width: `${Math.min(100, results.main.totalRevenue ? item.total / results.main.totalRevenue * 200 : 0)}%` }} /></div><strong>{money(item.total)}</strong></div>)}</article><article className="panel"><SectionTitle number="B" title="Margem estimada" subtitle="Receita menos custos e carga calculada." /><ValueBlock label="Simples Puro" value={money(results.main.marginPure)} /><ValueBlock accent label="Simples Híbrido" value={money(results.main.marginHybrid)} /><div className="insight"><TrendingDown /><p>{results.main.difference < 0 ? `O híbrido reduz a carga em ${money(Math.abs(results.main.difference))} por mês.` : results.main.difference > 0 ? `O puro reduz a carga em ${money(results.main.difference)} por mês.` : "Os modelos estão empatados neste cenário."}</p></div></article></div><Memory results={results} /></>}
  </>
}

function Memory({ results }: any) {
  const [open, setOpen] = React.useState(false); const main = results.main; const dre = results.dre
  const groups = [
    ["Enquadramento", [["RBT12", money(main.rbt12)], ["Faixa", main.band], ["Fator R", pct(main.factorR)], ["Anexo", main.activities.map((a: any) => a.annex).filter(Boolean).join(" + ") || "Pendente"]]],
    ["Simples", [["DAS bruto", money(main.dasGross)], ["DAS ajustado", money(main.dasAdjusted)], ["DAS híbrido", money(main.hybridDas)], ["Fora do DAS", money(main.outsideTotal)]]],
    ["Regime regular", [["Débito CBS", money(main.cbsDebit)], ["Crédito CBS", money(main.cbsCredit)], ["Débito IBS", money(main.ibsDebit)], ["Crédito IBS", money(main.ibsCredit)]]],
    ["Lucro Presumido", [["ICMS ou ISS", money(dre.localTotal)], ["IRPJ", money(dre.presumedIrpj)], ["CSLL", money(dre.presumedCsll)], ["IBS e CBS", money(dre.regularOutside)]]]
  ]
  return <section className="panel memory"><button className="memory-head" onClick={() => setOpen(!open)}><div><p className="kicker">RASTREABILIDADE</p><h2>Memória de cálculo</h2></div><span>{open ? "Recolher" : "Expandir"}<ChevronDown className={open ? "rotate" : ""} /></span></button><AnimatePresence>{open && <motion.div className="memory-grid" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>{groups.map(([title, rows]: any) => <div key={title}><h3>{title}</h3><dl>{rows.map(([label, value]: any) => <React.Fragment key={label}><dt>{label}</dt><dd>{value}</dd></React.Fragment>)}</dl></div>)}</motion.div>}</AnimatePresence></section>
}

function Timeline({ results }: any) {
  const [year, setYear] = React.useState(results.main.year)
  const current = results.evolution.find((item: any) => item.year === year) || results.evolution[0]
  return <><section className="workspace-heading"><div><p className="kicker">TRANSIÇÃO TRIBUTÁRIA</p><h1>2027 a 2033</h1><p>Acompanhe como a composição muda ano a ano.</p></div><div className="year-hero"><span>Ano em foco</span><strong>{year}</strong></div></section>
    <div className="year-tabs">{results.evolution.map((item: any) => <button className={year === item.year ? "active" : ""} key={item.year} onClick={() => setYear(item.year)}>{item.year}</button>)}</div>
    <div className="timeline-layout"><article className="panel"><SectionTitle number="A" title="Evolução da carga mensal" subtitle="Simples Puro e Simples Híbrido." /><LineChart evolution={results.evolution} selected={year} onSelect={setYear} /></article><motion.article key={year} className="year-detail" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }}><p className="kicker">ANO SELECIONADO</p><strong className="big-year">{year}</strong><dl><dt>Alíquota CBS de referência</dt><dd>{pct(current.reference.cbs)}</dd><dt>Alíquota IBS de referência</dt><dd>{pct(current.reference.ibs)}</dd><dt>DAS híbrido</dt><dd>{money(current.hybridDas)}</dd><dt>IBS e CBS fora</dt><dd>{money(current.outsideTotal)}</dd><dt>Carga total híbrida</dt><dd>{money(current.hybridTotal)}</dd></dl><div className="verdict">{current.winner === "Híbrido" ? "O híbrido tem menor carga neste ano." : current.winner === "Puro" ? "O puro tem menor carga neste ano." : "Os modelos estão empatados."}</div></motion.article></div>
    <section className="panel table-panel"><SectionTitle number="B" title="Matriz anual" subtitle="Valores mensais comparáveis." /><div className="table-scroll"><table><thead><tr><th>Ano</th><th>Simples Puro</th><th>DAS híbrido</th><th>Fora do DAS</th><th>Total híbrido</th><th>Diferença</th></tr></thead><tbody>{results.evolution.map((item: any) => <tr key={item.year} onClick={() => setYear(item.year)}><td><strong>{item.year}</strong></td><td>{money(item.pureTotal)}</td><td>{money(item.hybridDas)}</td><td>{money(item.outsideTotal)}</td><td><strong>{money(item.hybridTotal)}</strong></td><td>{money(item.difference)}</td></tr>)}</tbody></table></div></section>
  </>
}

function LineChart({ evolution, selected, onSelect }: any) {
  const width = 720, height = 280, pad = 42; const values = evolution.flatMap((item: any) => [item.pureTotal, item.hybridTotal]); const max = Math.max(...values, 1) * 1.12
  const x = (i: number) => pad + i * ((width - pad * 2) / (evolution.length - 1)); const y = (v: number) => height - pad - v / max * (height - pad * 2)
  const path = (key: string) => evolution.map((item: any, i: number) => `${i ? "L" : "M"}${x(i)} ${y(item[key])}`).join(" ")
  return <div className="chart"><svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Evolução da carga tributária de 2027 a 2033">{[0,.25,.5,.75,1].map((p) => <line key={p} x1={pad} x2={width-pad} y1={pad+p*(height-pad*2)} y2={pad+p*(height-pad*2)} />)}<motion.path className="pure-line" d={path("pureTotal")} initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1 }} /><motion.path className="hybrid-line" d={path("hybridTotal")} initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1, delay: .15 }} />{evolution.map((item: any, i: number) => <g key={item.year} onClick={() => onSelect(item.year)} className={selected === item.year ? "selected" : ""}><circle cx={x(i)} cy={y(item.hybridTotal)} r={selected === item.year ? 7 : 4} /><text x={x(i)} y={height-10} textAnchor="middle">{item.year}</text></g>)}</svg><div className="chart-legend"><span><i className="pure" />Simples Puro</span><span><i className="hybrid" />Simples Híbrido</span></div></div>
}

function Scenarios({ scenarios, onLoad, onDelete, canEdit = true }: any) {
  return <><section className="workspace-heading"><div><p className="kicker">SEUS CENÁRIOS</p><h1>Histórico de simulações</h1><p>Retome uma análise salva no workspace e vinculada ao CNPJ correspondente.</p></div><span className="count-chip">{scenarios.length} salvos</span></section>{scenarios.length ? <div className="scenario-grid">{scenarios.map((item: SavedScenario, index: number) => <motion.article key={item.id} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * .05 }}><div className="scenario-icon"><FolderClock /></div><p className="kicker">{new Date(item.savedAt).toLocaleDateString("pt-BR")}</p><h2>{item.name}</h2><dl><dt>Ano</dt><dd>{item.state.year}</dd><dt>Receita mensal</dt><dd>{money(item.state.activities.reduce((sum: number, activity: any) => sum + Number(activity.revenue || 0), 0))}</dd></dl><div><Button onClick={() => onLoad(item)}>Abrir cenário</Button>{canEdit && <Button variant="ghost" onClick={() => onDelete(item.id)} aria-label={`Excluir ${item.name}`}><Trash2 /></Button>}</div></motion.article>)}</div> : <div className="empty-page"><FolderClock /><h2>Nenhum cenário salvo</h2><p>{canEdit ? "Use o botão Salvar durante a simulação para criar o primeiro." : "O titular ou um Editor pode criar cenários para este workspace."}</p></div>}</>
}

function Technical({ data, results }: any) {
  const [query, setQuery] = React.useState(""); const normalized = query.toLowerCase().replace(/\D/g, ""); const cnaes = data.cnaes.filter((item: any) => !query || item.label.toLowerCase().includes(query.toLowerCase()) || item.code.includes(normalized)).slice(0, 100)
  return <><section className="workspace-heading"><div><p className="kicker">BASE AUDITÁVEL</p><h1>Referências técnicas</h1><p>Consulte os parâmetros usados pelo simulador.</p></div><span className="method-chip"><ShieldCheck size={17} />Planilha analisada</span></section>
    <div className="audit-grid"><ValueBlock label="Fórmulas auditadas" value="1.025" /><ValueBlock label="CNAEs classificados" value={String(data.meta.cnaeRows)} /><ValueBlock label="Linhas dos Anexos" value={String(data.meta.annexRows)} /><ValueBlock accent label="Regimes especiais" value={String(data.meta.specialRegimes)} /></div>
    <section className="panel warnings-panel"><SectionTitle number="A" title="Pontos de atenção" subtitle="Alertas gerados pelo cenário atual." />{results.main.warnings.length ? results.main.warnings.map((item: any) => <div className={`warning ${item.level}`} key={item.code}><CircleAlert /><div><strong>{item.code.replaceAll("_", " ")}</strong><p>{item.text}</p></div></div>) : <div className="warning success"><Check /><div><strong>Sem alertas críticos</strong><p>Os dados essenciais do cenário estão preenchidos.</p></div></div>}</section>
    <section className="panel table-panel"><SectionTitle number="B" title="Consulta de CNAE" subtitle="Até 100 resultados por pesquisa." /><Field id="cnae-search" label="Código ou descrição do CNAE"><div className="search-field"><Search /><Input id="cnae-search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Exemplo: advocacia ou 6911701" /></div></Field><div className="table-scroll"><table><thead><tr><th>CNAE</th><th>Descrição</th><th>Fator R</th><th>Anexo fixo</th><th>Acima de 28%</th><th>Abaixo de 28%</th></tr></thead><tbody>{cnaes.map((item: any) => <tr key={item.code}><td><strong>{item.code}</strong></td><td>{item.description}</td><td>{item.factorR ? "Sim" : "Não"}</td><td>{item.fixedAnnex || "Não se aplica"}</td><td>{item.highAnnex || "Não se aplica"}</td><td>{item.lowAnnex || "Não se aplica"}</td></tr>)}</tbody></table></div></section>
  </>
}
