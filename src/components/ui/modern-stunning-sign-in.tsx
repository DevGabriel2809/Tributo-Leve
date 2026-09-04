"use client"

import * as React from "react"
import { AnimatePresence, motion } from "framer-motion"
import { ArrowLeft, ArrowRight, Check, Copy, CreditCard, Eye, EyeOff, Landmark, LockKeyhole, PlayCircle, QrCode, RefreshCw, ShieldCheck, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AppUser, backendConfigured, currentUser, supabase } from "@/lib/backend"
import { BoletoAddressFields } from "@/components/BoletoAddressFields"
import { CardCheckout, type CardTokenResult } from "@/components/CardCheckout"
import { createRecurringSubscription } from "@/lib/billing"
import { billingAddressError, emptyBillingAddress, normalizeBillingAddress, onlyDigits, paymentNeedsReplacement, validCpf, type BillingAddress, type Payment, type PaymentMethod } from "@/lib/payment"
import { ensureCpfIdentificationSupported, mercadoPagoClientConfigured } from "@/lib/mercadopago"
import { Pricing, type PricingPlan } from "@/components/ui/pricing"
import { planBranding } from "@/lib/planBranding"
import { cn } from "@/lib/utils"
import { TurnstileWidget, turnstileConfigured } from "@/components/TurnstileWidget"

type Props = { onAuthenticated: (user: AppUser) => void }
const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })
const POLICY_VERSION = "2026-09-04-v1"

type PlanOption = { slug: string; name: string; description: string; price_cents: number; billing_months?: number; company_limit?: number; included_features?: string[]; badge?: string; recommended?: boolean }
const FALLBACK_PLANS: PlanOption[] = [
  { slug: "basico-mensal", name: "Leve Start", description: "Para quem quer começar com controle e sem complicação. O Leve Start libera o núcleo completo do Tributo Leve para 1 CNPJ, com simulações tributárias, comparação entre cenários, análise da transição e memória de cálculo. Conforme a operação crescer, você pode contratar módulos adicionais sem precisar trocar toda a sua estrutura.", price_cents: 4990, billing_months: 1, company_limit: 1, included_features: [], badge: "IDEAL PARA COMEÇAR" },
  { slug: "pro-mensal", name: "Leve Pro", description: "Pensado para profissionais e pequenos escritórios que já precisam atender mais de uma empresa com organização. Reúne tudo do Leve Start, amplia a operação para até 4 CNPJs e libera a carteira integrada para manter clientes, cenários e análises organizados em um único ambiente.", price_cents: 8990, billing_months: 1, company_limit: 4, included_features: ["portfolio"], badge: "PARA QUEM ESTÁ CRESCENDO", recommended: false },
  { slug: "pro-trimestral", name: "Leve Prime", description: "A experiência mais completa e a melhor relação entre recursos e custo. Reúne tudo do Leve Pro por 3 meses, permite trabalhar com até 4 CNPJs e já inclui o Relatório Executivo durante toda a vigência, com valor trimestral mais vantajoso do que três mensalidades do Leve Pro.", price_cents: 23970, billing_months: 3, company_limit: 4, included_features: ["portfolio", "executive_report"], badge: "MELHOR CUSTO-BENEFÍCIO", recommended: true }
]

const SignIn1 = ({ onAuthenticated }: Props) => {
  const [mode, setMode] = React.useState<"signin" | "signup" | "payment">("signin")
  const [name, setName] = React.useState("")
  const [email, setEmail] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [cpf, setCpf] = React.useState("")
  const [method, setMethod] = React.useState<PaymentMethod>("pix")
  const [address, setAddress] = React.useState<BillingAddress>(() => emptyBillingAddress())
  const [payment, setPayment] = React.useState<Payment | null>(null)
  const [showPassword, setShowPassword] = React.useState(false)
  const [acceptedTerms, setAcceptedTerms] = React.useState(false)
  const [turnstileToken, setTurnstileToken] = React.useState("")
  const [error, setError] = React.useState("")
  const [loading, setLoading] = React.useState(false)
  const [checking, setChecking] = React.useState(false)
  const [plans, setPlans] = React.useState<PlanOption[]>(FALLBACK_PLANS)
  const [selectedPlanSlug, setSelectedPlanSlug] = React.useState("pro-trimestral")
  const inviteToken = React.useMemo(() => new URLSearchParams(window.location.search).get("invite") || "", [])
  const invitedSignup = Boolean(inviteToken)
  const validateEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)

  const loadPlans = React.useCallback(async () => {
    if (!supabase) return FALLBACK_PLANS
    const { data, error: priceError } = await supabase
      .from("plans")
      .select("slug,name,description,price_cents,billing_months,company_limit,included_features,badge,recommended")
      .eq("active", true)
      .order("sort_order", { ascending: true })
    if (priceError || !data?.length) {
      console.warn("Não foi possível carregar os metadados dos planos", priceError)
      return FALLBACK_PLANS
    }
    const list = data as PlanOption[]
    setPlans(list)
    if (!list.some((item) => item.slug === selectedPlanSlug)) setSelectedPlanSlug(list[0].slug)
    return list
  }, [selectedPlanSlug])

  React.useEffect(() => {
    if ((mode !== "signup" && mode !== "payment") || invitedSignup) return
    void loadPlans().catch((cause) => console.warn("Planos", cause))
  }, [mode, loadPlans, invitedSignup])

  React.useEffect(() => {
    const refresh = () => { if ((mode === "signup" || mode === "payment") && !invitedSignup) void loadPlans().catch(() => undefined) }
    window.addEventListener("focus", refresh)
    return () => window.removeEventListener("focus", refresh)
  }, [mode, loadPlans])

  React.useEffect(() => {
    if (invitedSignup || !mercadoPagoClientConfigured) return
    void ensureCpfIdentificationSupported().catch((cause) => console.warn("MercadoPago.js", cause))
  }, [])

  async function checkPayment(silent = false) {
    if (!supabase) return
    if (!silent) setChecking(true)
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      if (!sessionData.session) return
      const response = await fetch("/.netlify/functions/payment-status", { headers: { Authorization: `Bearer ${sessionData.session.access_token}` } })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || "Não foi possível consultar o pagamento.")
      if (result.access === "active") {
        const allowed = await currentUser()
        if (allowed) onAuthenticated(allowed)
        return
      }
      if (result.access === "blocked") throw new Error("Este acesso está bloqueado. Fale com o suporte.")
      setPayment(result.payment || null)
      setMode("payment")
      if (!silent) setError(result.payment ? "" : "Nenhuma cobrança ativa. Gere uma cobrança abaixo.")
    } catch (cause) {
      if (!silent) setError(cause instanceof Error ? cause.message : "Não foi possível consultar o pagamento.")
    } finally { if (!silent) setChecking(false) }
  }

  React.useEffect(() => {
    if (mode !== "payment") return
    const interval = window.setInterval(() => { void checkPayment(true) }, 6000)
    return () => window.clearInterval(interval)
  }, [mode])

  async function verifyMercadoPagoClient() {
    if (!mercadoPagoClientConfigured) throw new Error("A Public Key de produção do Mercado Pago ainda não foi publicada.")
    await ensureCpfIdentificationSupported()
  }

  async function handleSignIn() {
    if (!supabase) return setError("Conecte o Supabase antes de publicar. Veja CONFIGURAR_PRODUCAO.md.")
    const normalizedEmail = email.trim().toLowerCase()
    const guard = await fetch("/.netlify/functions/login-guard", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: normalizedEmail, turnstileToken }),
    })
    const guardResult = await guard.json().catch(() => ({}))
    if (!guard.ok) throw new Error(guardResult.error || "A tentativa de login foi bloqueada temporariamente.")
    const { error: signInError } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password })
    if (signInError) throw new Error("E-mail ou senha incorretos.")
    const allowed = await currentUser()
    if (allowed) return onAuthenticated(allowed)
    await checkPayment()
  }

  function validatePaymentFields() {
    if (!validCpf(cpf)) return "Informe um CPF válido para continuar."
    if (method === "boleto") return billingAddressError(address)
    return ""
  }

  async function createPayment(session: { access_token: string; user: { id: string; user_metadata?: Record<string, any> } }, fullName: string) {
    await verifyMercadoPagoClient()
    const paymentError = validatePaymentFields()
    if (paymentError) throw new Error(paymentError)
    const response = await fetch("/.netlify/functions/create-payment", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({
        userId: session.user.id,
        planSlug: selectedPlanSlug,
        method,
        name: fullName,
        cpf: onlyDigits(cpf),
        idempotencyKey: crypto.randomUUID(),
        ...(method === "boleto" ? { address: normalizeBillingAddress(address) } : {})
      })
    })
    const result = await response.json()
    if (!response.ok) throw new Error(result.error || "Não foi possível emitir a cobrança.")
    return result.payment as Payment
  }

  async function handleSignUp() {
    if (!supabase) return setError("Conecte o Supabase antes de publicar. Veja CONFIGURAR_PRODUCAO.md.")
    if (!invitedSignup) {
      const paymentError = validatePaymentFields()
      if (paymentError) throw new Error(paymentError)
      await verifyMercadoPagoClient()
      await loadPlans()
    }

    const normalizedEmail = email.trim().toLowerCase()
    const registration = await fetch("/.netlify/functions/register-user", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), email: normalizedEmail, password, cpf: invitedSignup ? "" : onlyDigits(cpf), inviteToken: invitedSignup ? inviteToken : undefined, website: "", turnstileToken, acceptedTerms, acceptedPrivacy: acceptedTerms, policyVersion: POLICY_VERSION })
    })
    const registrationResult = await registration.json()
    if (!registration.ok) throw new Error(registrationResult.error || "Não foi possível criar a conta.")

    const { data, error: signInError } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password })
    if (signInError || !data.session?.user) throw new Error("Conta criada, mas não foi possível iniciar a sessão.")

    if (invitedSignup) {
      const allowed = await currentUser()
      if (!allowed) throw new Error("Conta criada, mas o convite não pôde ser ativado. Abra novamente o link enviado pelo titular.")
      return onAuthenticated(allowed)
    }

    if (method === "card") {
      setPayment(null)
      setMode("payment")
      setError("Preencha os dados seguros do cartão para ativar a renovação automática.")
      return
    }
    try {
      const generated = await createPayment(data.session as any, name.trim())
      setPayment(generated)
      setMode("payment")
    } catch (cause) {
      setPayment(null); setMode("payment"); throw cause
    }
  }

  async function generatePendingPayment() {
    if (!supabase) return
    setLoading(true); setError("")
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      if (!sessionData.session?.user) throw new Error("Entre novamente para gerar a cobrança.")
      if (method === "card") throw new Error("Use os campos de cartão exibidos abaixo para criar a assinatura automática.")
      const generated = await createPayment(sessionData.session as any, sessionData.session.user.user_metadata?.full_name || name)
      setPayment(generated)
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível emitir a cobrança.") }
    finally { setLoading(false) }
  }

  async function subscribeWithCard(card: CardTokenResult) {
    if (!supabase) throw new Error("Supabase não configurado.")
    if (!validCpf(cpf)) throw new Error("Informe um CPF válido para continuar.")
    const { data: sessionData } = await supabase.auth.getSession()
    if (!sessionData.session?.user) throw new Error("Entre novamente para assinar.")
    const result = await createRecurringSubscription(sessionData.session.user.id, selectedPlanSlug, onlyDigits(cpf), card)
    setPayment({ id: String(result.subscriptionId), status: "processing", statusDetail: "Primeira cobrança em processamento", method: "card", cardBrand: card.paymentMethodId })
    setError("")
    window.setTimeout(() => { void checkPayment(true) }, 2500)
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault(); setError("")
    if (!email || !password || (mode === "signup" && !name.trim())) return setError("Preencha todos os campos visíveis.")
    if (!validateEmail(email)) return setError("Informe um e-mail válido.")
    if (password.length < 8) return setError("A senha precisa ter pelo menos 8 caracteres.")
    if (turnstileConfigured && !turnstileToken) return setError("Conclua a validação anti-bot para continuar.")
    if (mode === "signup" && !acceptedTerms) return setError("Aceite os Termos de Uso e a Política de Privacidade para criar a conta.")
    setLoading(true)
    try { mode === "signin" ? await handleSignIn() : await handleSignUp() }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível concluir.") }
    finally { setLoading(false) }
  }

  async function copyText(value: string | undefined, success: string) {
    if (!value) return
    await navigator.clipboard.writeText(value)
    setError(success)
  }

  const pricingPlans: PricingPlan[] = plans.map((plan) => {
    const brand = planBranding(plan.slug, plan.name)
    return { slug: plan.slug, name: brand.name, badge: brand.badge, description: brand.shortDescription, priceCents: plan.price_cents, billingMonths: Number(plan.billing_months || 1), features: brand.features, isPopular: brand.recommended }
  })

  return <main className={cn("auth-shell", mode === "signup" && !invitedSignup && "auth-shell-signup")}>
    <div className="auth-noise" /><motion.div className="auth-orbit auth-orbit-one" animate={{ rotate: 360 }} transition={{ duration: 22, repeat: Infinity, ease: "linear" }} /><motion.div className="auth-orbit auth-orbit-two" animate={{ rotate: -360 }} transition={{ duration: 32, repeat: Infinity, ease: "linear" }} />
    <section className="auth-context" aria-label="Sobre o Tributo Leve"><motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}><div className="auth-brand"><span><img src="/tributo-leve-icon.svg" alt="" aria-hidden="true" /></span><strong>Tributo Leve</strong></div><p className="auth-kicker">REFORMA TRIBUTÁRIA 2027 A 2033</p><h1>Decisões tributárias com memória de cálculo.</h1><p className="auth-copy">Simule, compare regimes e acompanhe a transição em um ambiente protegido.</p><div className="auth-signals"><span><ShieldCheck size={18} /> Acesso liberado após confirmação</span><span><Check size={18} /> Cartão automático, PIX ou boleto</span></div></motion.div></section>
    <motion.section className={cn("auth-card", mode === "signup" && !invitedSignup && "auth-card-wide")} initial={mode === "signup" && !invitedSignup ? { opacity: 0, y: 12 } : { opacity: 0, scale: .97, x: 24 }} animate={mode === "signup" && !invitedSignup ? { opacity: 1, y: 0 } : { opacity: 1, scale: 1, x: 0 }}>
      {mode === "payment" ? <PaymentState payment={payment} error={error} email={email} cpf={cpf} setCpf={setCpf} method={method} setMethod={setMethod} address={address} setAddress={setAddress} loading={loading} checking={checking} plans={plans} selectedPlanSlug={selectedPlanSlug} setSelectedPlanSlug={setSelectedPlanSlug} onGenerate={generatePendingPayment} onCard={subscribeWithCard} onRefresh={() => checkPayment()} onCopyPix={() => copyText(payment?.qrCode, "Código PIX copiado.")} onCopyBoleto={() => copyText(payment?.digitableLine, "Linha digitável copiada.")} onBack={() => { setMode("signin"); setError("") }} /> : <>
        <div className="auth-card-mark"><LockKeyhole size={22} /></div><p className="auth-kicker">{mode === "signin" ? (invitedSignup ? "CONVITE DE EQUIPE" : "ACESSO AO PROGRAMA") : invitedSignup ? "ENTRADA NA EQUIPE" : "CRIE SUA CONTA"}</p><h2>{mode === "signin" ? "Entre na sua área" : invitedSignup ? "Crie seu acesso de colaborador" : "Comece pelo seu acesso"}</h2>
        {mode === "signup" && invitedSignup && <div className="team-invite-auth"><Users size={20} /><div><strong>Você foi convidado para um workspace</strong><p>Crie a conta usando o mesmo e-mail do convite. Você não precisa comprar o plano nem informar CPF: o acesso será vinculado à licença do titular.</p></div></div>}
        {mode === "signup" && !invitedSignup && <Pricing
          plans={pricingPlans}
          selectedSlug={selectedPlanSlug}
          tone="dark"
          title="Escolha o plano ideal"
          description="Compare os recursos ao lado e selecione o plano que melhor acompanha sua operação."
          onSelect={(plan) => setSelectedPlanSlug(plan.slug)}
          actionLabel={(plan) => `Escolher ${plan.name}`}
        />}
        <form onSubmit={handleSubmit} className="auth-form" noValidate>
          <AnimatePresence initial={false}>{mode === "signup" && <motion.div className="signup-fields" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
            <div><Label htmlFor="auth-name">Nome completo</Label><Input id="auth-name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome do responsável" /></div>
          </motion.div>}</AnimatePresence>
          <div><Label htmlFor="auth-email">E-mail</Label><Input id="auth-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@empresa.com.br" /></div>
          <div><Label htmlFor="auth-password">Senha</Label><div className="password-field"><Input id="auth-password" type={showPassword ? "text" : "password"} autoComplete={mode === "signin" ? "current-password" : "new-password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mínimo de 8 caracteres" /><button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div></div>
          {mode === "signin" && <TurnstileWidget action="login" onToken={setTurnstileToken} />}
          {mode === "signup" && !invitedSignup && <>
            <div><Label htmlFor="auth-cpf">CPF do pagador</Label><Input id="auth-cpf" inputMode="numeric" value={cpf} onChange={(e) => setCpf(e.target.value)} placeholder="Somente números" /></div>
            <PaymentMethodSelector method={method} setMethod={setMethod} />
            <AnimatePresence>{method === "boleto" && <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}><BoletoAddressFields address={address} onChange={setAddress} prefix="signup-boleto" /></motion.div>}</AnimatePresence>
          </>}
          {mode === "signup" && <><label className="auth-consent"><input type="checkbox" checked={acceptedTerms} onChange={(event) => setAcceptedTerms(event.target.checked)} /><span>Li e aceito os <a href="/termos" target="_blank" rel="noreferrer">Termos de Uso</a> e a <a href="/privacidade" target="_blank" rel="noreferrer">Política de Privacidade</a>, incluindo as informações sobre LGPD.</span></label><TurnstileWidget action="register" onToken={setTurnstileToken} /></>}
          <AnimatePresence>{error && <motion.p className="auth-error" role="alert" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}>{error}</motion.p>}</AnimatePresence>
          {!backendConfigured && <p className="auth-error" role="alert">A conexão do cadastro ainda não foi publicada. Execute novamente o publicador do projeto.</p>}
          {mode === "signup" && !invitedSignup && !mercadoPagoClientConfigured && <p className="auth-error" role="alert">A Public Key do Mercado Pago ainda não foi publicada.</p>}
          <Button type="submit" className="w-full" disabled={loading}>{loading ? <span className="loading-dot">Processando</span> : <>{mode === "signin" ? "Entrar" : invitedSignup ? "Criar acesso e entrar na equipe" : method === "card" ? "Criar conta e continuar no cartão" : "Criar conta e gerar cobrança"}<ArrowRight size={18} /></>}</Button>
        </form>
        <button className="auth-mode" onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setError("") }}>{mode === "signin" ? (invitedSignup ? "Primeiro acesso? Aceitar convite" : "Primeiro acesso? Escolher plano") : "Já tenho acesso"}</button>{!invitedSignup && <button type="button" className="demo-entry" onClick={() => { const url = new URL(window.location.href); url.searchParams.set("demo", "1"); window.location.href = url.toString() }}><PlayCircle size={18} />Testar demonstração gratuita</button>}<p className="auth-local-note">O acesso é liberado após confirmação do pagamento. Senhas são gerenciadas pelo Supabase Auth e não são armazenadas em texto puro pelo Tributo Leve.</p>
      </>}
    </motion.section>
  </main>
}

function PaymentMethodSelector({ method, setMethod }: { method: PaymentMethod; setMethod: (method: PaymentMethod) => void }) {
  return <fieldset className="payment-methods"><legend>Como deseja pagar?</legend><button type="button" className={method === "card" ? "selected" : ""} onClick={() => setMethod("card")}><CreditCard /><span><strong>Cartão</strong><small>Renovação automática do plano</small></span></button><button type="button" className={method === "pix" ? "selected" : ""} onClick={() => setMethod("pix")}><QrCode /><span><strong>PIX</strong><small>Renovação manual por período</small></span></button><button type="button" className={method === "boleto" ? "selected" : ""} onClick={() => setMethod("boleto")}><Landmark /><span><strong>Boleto</strong><small>Renovação manual por período</small></span></button></fieldset>
}

function PaymentState({ payment, error, email, cpf, setCpf, method, setMethod, address, setAddress, loading, checking, plans, selectedPlanSlug, setSelectedPlanSlug, onGenerate, onCard, onRefresh, onCopyPix, onCopyBoleto, onBack }: { payment: Payment | null; error: string; email: string; cpf: string; setCpf: (value: string) => void; method: PaymentMethod; setMethod: (value: PaymentMethod) => void; address: BillingAddress; setAddress: (address: BillingAddress) => void; loading: boolean; checking: boolean; plans: PlanOption[]; selectedPlanSlug: string; setSelectedPlanSlug: (value: string) => void; onGenerate: () => void; onCard: (card: CardTokenResult) => Promise<void>; onRefresh: () => void; onCopyPix: () => void; onCopyBoleto: () => void; onBack: () => void }) {
  const needsNewPayment = paymentNeedsReplacement(payment)
  const waitingProvider = Boolean(payment && ["created", "processing"].includes(payment.status))
  const selectedPlan = plans.find((item) => item.slug === selectedPlanSlug) || plans[0]
  const paymentTitle = needsNewPayment ? "Ative seu acesso" : waitingProvider ? (payment?.method === "card" ? "Primeira cobrança em processamento" : "Processando cobrança") : payment?.method === "boleto" ? "Boleto emitido" : payment?.method === "card" ? "Cartão enviado" : "PIX gerado"
  const Icon = payment?.method === "card" ? CreditCard : payment?.method === "boleto" ? Landmark : QrCode
  return <div className="payment-state"><div className="auth-card-mark"><Icon size={22} /></div><p className="auth-kicker">AGUARDANDO CONFIRMAÇÃO</p><h2>{paymentTitle}</h2><p>{needsNewPayment ? "Escolha a forma de pagamento para continuar." : waitingProvider ? "O Mercado Pago está processando a cobrança. A tela será atualizada automaticamente." : "Assim que o Mercado Pago confirmar o pagamento, o acesso é liberado automaticamente."}</p>
    {!needsNewPayment && payment?.qrCodeBase64 && <img className="pix-image" src={`data:image/png;base64,${payment.qrCodeBase64}`} alt="QR Code do PIX" />}
    {!needsNewPayment && payment?.qrCode && <button className="pix-copy" onClick={onCopyPix}><Copy size={18} /><span><strong>PIX copia e cola</strong><small>{payment.qrCode.slice(0, 52)}...</small></span></button>}
    {!needsNewPayment && payment?.digitableLine && <button className="pix-copy" onClick={onCopyBoleto}><Copy size={18} /><span><strong>Linha digitável</strong><small>{payment.digitableLine}</small></span></button>}
    {!needsNewPayment && payment?.ticketUrl && <a className="ticket-link" href={payment.ticketUrl} target="_blank" rel="noreferrer"><Landmark size={18} />Abrir boleto<ArrowRight size={17} /></a>}
    {!needsNewPayment && payment?.method === "card" && <div className="card-processing"><CreditCard /><div><strong>Renovação automática</strong><small>{payment.cardBrand ? payment.cardBrand.toUpperCase() : "Cartão protegido pelo Mercado Pago"}</small></div></div>}
    {needsNewPayment && <div className="pending-payment-form"><div className="renew-plan-picker"><strong>Escolha o plano para renovar</strong>{plans.map((plan) => <button type="button" key={plan.slug} className={selectedPlanSlug === plan.slug ? "selected" : ""} onClick={() => setSelectedPlanSlug(plan.slug)}><span>{planBranding(plan.slug, plan.name).name}</span><b>{currency.format(plan.price_cents / 100)}</b><small>{Number(plan.billing_months || 1) === 3 ? "3 meses" : "1 mês"}</small></button>)}</div><Label htmlFor="pending-cpf">CPF do pagador</Label><Input id="pending-cpf" inputMode="numeric" value={cpf} onChange={(event) => setCpf(event.target.value)} placeholder="Somente números" /><PaymentMethodSelector method={method} setMethod={setMethod} />{method === "boleto" && <BoletoAddressFields address={address} onChange={setAddress} prefix="pending-boleto" />}{method === "card" && selectedPlan ? <CardCheckout amountCents={selectedPlan.price_cents} email={email} cpf={cpf} actionLabel="Assinar com renovação automática" onToken={onCard} /> : <Button className="w-full" onClick={onGenerate} disabled={loading}>{loading ? "Gerando cobrança" : "Gerar cobrança"}<ArrowRight size={18} /></Button>}</div>}
    {error && <p className="auth-error">{error}</p>}
    {!needsNewPayment && <button className="payment-refresh" onClick={onRefresh} disabled={checking}><RefreshCw className={checking ? "is-spinning" : ""} size={17} />{checking ? "Verificando" : "Sincronizar pagamento agora"}</button>}
    <button className="auth-mode" onClick={onBack}><ArrowLeft size={16} />Voltar para entrar</button></div>
}

export { SignIn1 }
