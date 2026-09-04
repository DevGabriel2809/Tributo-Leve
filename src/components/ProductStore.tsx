import * as React from "react"
import { AnimatePresence, motion } from "framer-motion"
import { ArrowRight, Check, Copy, CreditCard, Layers3, LockKeyhole, QrCode, ReceiptText, Users, X } from "lucide-react"
import { AppUser, authHeader, supabase } from "@/lib/backend"
import { BoletoAddressFields } from "@/components/BoletoAddressFields"
import { CardCheckout, type CardTokenResult } from "@/components/CardCheckout"
import { createRecurringSubscription } from "@/lib/billing"
import { billingAddressError, emptyBillingAddress, normalizeBillingAddress, onlyDigits, validCpf, type BillingAddress, type Payment, type PaymentMethod } from "@/lib/payment"
import { ensureCpfIdentificationSupported, mercadoPagoClientConfigured } from "@/lib/mercadopago"
import { Pricing, type PricingPlan } from "@/components/ui/pricing"
import { planBranding } from "@/lib/planBranding"

type Product = { id: string; slug: string; name: string; description: string; price_cents: number; feature_key: string }
type Plan = { id: string; slug: string; name: string; description: string; price_cents: number; billing_months: number; company_limit: number; included_features: string[]; badge?: string; recommended?: boolean }
const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })
const icons = { portfolio: Layers3, executive_report: ReceiptText, team: Users }
const featureBullets: Record<string, string[]> = {
  portfolio: ["Até 100 CNPJs", "Carteira organizada por cliente", "Cenários separados por empresa"],
  executive_report: ["Capa e identidade do escritório", "Comparativo + transição 2027–2033", "PDF profissional com memória técnica"],
  team: ["Até 3 colaboradores", "Editor ou somente consulta", "Workspace e licença compartilhados"]
}

export function ProductStore({ user, ownedFeatures = [], includedPlanFeatures = [], canPurchase = true, currentPlanSlug = "", onOpenFeature }: { user: AppUser; ownedFeatures?: string[]; includedPlanFeatures?: string[]; canPurchase?: boolean; currentPlanSlug?: string; onOpenFeature?: (featureKey: string) => void }) {
  const [products, setProducts] = React.useState<Product[]>([])
  const [plans, setPlans] = React.useState<Plan[]>([])
  const [owned, setOwned] = React.useState<string[]>([])
  const [selected, setSelected] = React.useState<Product | null>(null)
  const [selectedPlan, setSelectedPlan] = React.useState<Plan | null>(null)
  const [method, setMethod] = React.useState<PaymentMethod>("pix")
  const [cpf, setCpf] = React.useState("")
  const [address, setAddress] = React.useState<BillingAddress>(() => emptyBillingAddress())
  const [payment, setPayment] = React.useState<Payment | null>(null)
  const [message, setMessage] = React.useState("")
  const [loading, setLoading] = React.useState(false)

  React.useEffect(() => {
    if (!supabase) return
    void supabase.from("products").select("id,slug,name,description,price_cents,feature_key").eq("active", true).then((catalog) => {
      const list = (catalog.data || []) as Product[]; setProducts(list); setOwned(list.filter((item) => ownedFeatures.includes(item.feature_key)).map((item) => item.id))
    })
    void supabase.from("plans").select("id,slug,name,description,price_cents,billing_months,company_limit,included_features,badge,recommended").eq("active", true).order("sort_order", { ascending: true }).then((catalog) => setPlans((catalog.data || []) as Plan[]))
  }, [ownedFeatures.join("|")])

  function resetPurchase() { setPayment(null); setMessage(""); setMethod("pix"); setAddress(emptyBillingAddress()) }
  function openProduct(product: Product) { setSelectedPlan(null); setSelected(product); resetPurchase() }
  function openPlan(plan: Plan) { setSelected(null); setSelectedPlan(plan); resetPurchase() }

  async function createManualPayment(kind: "product" | "plan") {
    const item = kind === "product" ? selected : selectedPlan
    if (!item) return
    if (!validCpf(cpf)) return setMessage("Informe um CPF válido.")
    if (method === "boleto") { const error = billingAddressError(address); if (error) return setMessage(error) }
    if (method === "card") return
    if (!mercadoPagoClientConfigured) return setMessage("A Public Key de produção do Mercado Pago ainda não foi publicada.")
    setLoading(true); setMessage("")
    try {
      await ensureCpfIdentificationSupported()
      const response = await fetch("/.netlify/functions/create-payment", {
        method: "POST", headers: { "Content-Type": "application/json", ...(await authHeader()) },
        body: JSON.stringify({ userId: user.id, ...(kind === "product" ? { productSlug: (item as Product).slug } : { planSlug: (item as Plan).slug }), method, name: user.name, cpf: onlyDigits(cpf), idempotencyKey: crypto.randomUUID(), ...(method === "boleto" ? { address: normalizeBillingAddress(address) } : {}) })
      })
      const result = await response.json(); if (!response.ok) throw new Error(result.error || "Não foi possível gerar a cobrança.")
      setPayment(result.payment)
      setMessage(kind === "plan" ? "Cobrança gerada. O novo plano começa quando o Mercado Pago confirmar o pagamento." : "Cobrança gerada. O módulo será liberado automaticamente após a confirmação do Mercado Pago.")
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : "Não foi possível gerar a cobrança.") }
    finally { setLoading(false) }
  }

  async function buyProductCard(card: CardTokenResult) {
    if (!selected) return
    if (!validCpf(cpf)) throw new Error("Informe um CPF válido.")
    const response = await fetch("/.netlify/functions/create-payment", {
      method: "POST", headers: { "Content-Type": "application/json", ...(await authHeader()) },
      body: JSON.stringify({ userId: user.id, productSlug: selected.slug, method: "card", name: user.name, cpf: onlyDigits(cpf), cardToken: card.token, paymentMethodId: card.paymentMethodId, installments: card.installments, deviceId: card.deviceId, idempotencyKey: crypto.randomUUID() })
    })
    const result = await response.json(); if (!response.ok) throw new Error(result.error || "O cartão não pôde ser processado.")
    setPayment(result.payment); setMessage("Pagamento enviado ao Mercado Pago. O módulo é liberado automaticamente após a confirmação.")
  }

  async function subscribeCard(card: CardTokenResult) {
    if (!selectedPlan) return
    if (!validCpf(cpf)) throw new Error("Informe um CPF válido.")
    const result = await createRecurringSubscription(user.id, selectedPlan.slug, onlyDigits(cpf), card)
    setPayment({ id: String(result.subscriptionId), status: "processing", statusDetail: "Primeira cobrança em processamento", method: "card", cardBrand: card.paymentMethodId })
    setMessage("Assinatura automática criada. A primeira cobrança está sendo processada pelo Mercado Pago; o acesso será atualizado após a confirmação.")
  }

  async function verifyPlanPayment() {
    setLoading(true); setMessage("")
    try {
      const response = await fetch("/.netlify/functions/payment-status?force=1", { headers: await authHeader() }); const result = await response.json()
      if (!response.ok) throw new Error(result.error || "Não foi possível verificar o pagamento.")
      if (result.access === "active") { setMessage("Plano confirmado. Atualizando sua conta..."); window.setTimeout(() => window.location.reload(), 650) }
      else { setPayment(result.payment || payment); setMessage("A cobrança ainda não foi confirmada pelo Mercado Pago.") }
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : "Não foi possível verificar o pagamento.") }
    finally { setLoading(false) }
  }

  async function copy(value?: string, label = "Código copiado.") { if (!value) return; await navigator.clipboard.writeText(value); setMessage(label) }
  const methodButtons = <div className="purchase-methods"><button className={method === "pix" ? "selected" : ""} onClick={() => setMethod("pix")}><QrCode />PIX</button><button className={method === "boleto" ? "selected" : ""} onClick={() => setMethod("boleto")}><ReceiptText />Boleto</button><button className={method === "card" ? "selected" : ""} onClick={() => setMethod("card")}><CreditCard />Cartão</button></div>

  function PaymentResult({ plan = false }: { plan?: boolean }) {
    if (!payment) return null
    return <div className="purchase-payment-result">{payment.qrCodeBase64 && <img className="pix-image" src={`data:image/png;base64,${payment.qrCodeBase64}`} alt="QR Code PIX" />}{payment.qrCode && <button className="purchase-copy" onClick={() => copy(payment.qrCode, "PIX copia e cola copiado.")}><Copy />Copiar PIX</button>}{payment.digitableLine && <button className="purchase-copy" onClick={() => copy(payment.digitableLine, "Linha digitável copiada.")}><Copy />Copiar linha digitável</button>}{payment.ticketUrl && <a className="purchase-submit" href={payment.ticketUrl} target="_blank" rel="noreferrer">Abrir boleto<ArrowRight /></a>}{payment.method === "card" && <div className="card-processing"><CreditCard /><div><strong>{payment.status === "processing" ? "Cartão em processamento" : "Pagamento no cartão enviado"}</strong><small>{payment.cardBrand ? payment.cardBrand.toUpperCase() : "Mercado Pago"}{payment.installments ? ` · ${payment.installments}x` : ""}</small></div></div>}{plan ? <button className="purchase-copy" onClick={verifyPlanPayment} disabled={loading}>{loading ? "Sincronizando" : "Sincronizar plano agora"}</button> : <button className="purchase-copy" onClick={() => window.location.reload()}>Atualizar módulos</button>}</div>
  }

  const pricingPlans: PricingPlan[] = plans.map((plan) => {
    const brand = planBranding(plan.slug, plan.name)
    return {
      slug: plan.slug,
      name: brand.name,
      badge: brand.badge,
      description: brand.shortDescription,
      priceCents: plan.price_cents,
      billingMonths: Number(plan.billing_months || 1),
      features: brand.features,
      isPopular: brand.recommended,
      current: plan.slug === currentPlanSlug,
      disabled: !canPurchase,
    }
  })
  const currentPlan = plans.find((plan) => plan.slug === currentPlanSlug)
  const currentBrand = planBranding(currentPlanSlug, currentPlan?.name || "Seu plano")

  return <div className="store-page store-page-premium">
    <section className="store-hero">
      <div className="store-hero-copy"><h1>Planos que acompanham sua operação</h1><p>Compare os recursos, escolha o seu ritmo e mude de plano quando precisar. No cartão a renovação é automática; PIX e boleto renovam por período.</p></div>
      <div className="store-current-plan"><small>SEU PLANO ATUAL</small><strong>{currentBrand.name}</strong><span>{currentPlan ? `${currentPlan.company_limit} CNPJ${currentPlan.company_limit > 1 ? "s" : ""} · ${currentPlan.billing_months === 3 ? "vigência trimestral" : "vigência mensal"}` : "Consulte sua assinatura"}</span></div>
    </section>

    <Pricing
      plans={pricingPlans}
      title=""
      description=""
      actionLabel={(plan) => !canPurchase ? "Gerenciado pelo titular" : `Mudar para ${plan.name}`}
      onSelect={(pricingPlan) => {
        const plan = plans.find((item) => item.slug === pricingPlan.slug)
        if (plan) openPlan(plan)
      }}
    />

    <section className="modules-showcase">
      <div className="plan-store-heading modules-heading"><div><p className="kicker">MÓDULOS OPCIONAIS</p><h2>Personalize sem pagar pelo que não usa</h2><p>Expanda o Tributo Leve quando a sua operação pedir mais.</p></div><small>Pagamento único · cartão pode ser parcelado</small></div>
      <div className="product-grid">{products.map((product, index) => { const Icon = icons[product.feature_key as keyof typeof icons] || Layers3; const includedByPlan = product.feature_key !== "portfolio" && includedPlanFeatures.includes(product.feature_key); const has = owned.includes(product.id) || includedByPlan; return <motion.article key={product.id} initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * .07 }}><span className="product-icon"><Icon /></span><div><small>MÓDULO OPCIONAL</small><h2>{product.name}</h2><p>{product.description}</p><ul className="product-feature-list">{(featureBullets[product.feature_key] || []).map((item) => <li key={item}><Check size={14} />{item}</li>)}</ul></div><div className="product-price"><strong>{currency.format(product.price_cents / 100)}</strong><small>pagamento único</small></div><button disabled={!has && !canPurchase} onClick={() => has ? onOpenFeature?.(product.feature_key) : openProduct(product)}>{includedByPlan ? <>Incluído no plano<ArrowRight /></> : has ? <>Abrir módulo<ArrowRight /></> : !canPurchase ? <><LockKeyhole />Gerenciado pelo titular</> : <>Comprar módulo<ArrowRight /></>}</button></motion.article> })}</div>
    </section>

    <AnimatePresence>{selectedPlan && <motion.div className="purchase-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={() => setSelectedPlan(null)}><motion.section className="purchase-modal" initial={{ opacity: 0, scale: .96, y: 15 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: .97 }} onMouseDown={(e) => e.stopPropagation()}><button className="purchase-close" onClick={() => setSelectedPlan(null)}><X /></button><p className="kicker">MUDAR PLANO</p><h2>{planBranding(selectedPlan.slug, selectedPlan.name).name}</h2><strong className="purchase-total">{currency.format(selectedPlan.price_cents / 100)}</strong><p>{selectedPlan.billing_months === 3 ? "Cobrança trimestral; no cartão, renovação automática a cada 3 meses." : "Cobrança mensal; no cartão, renovação automática todo mês."}</p>
      {payment ? <PaymentResult plan /> : <><label>CPF do pagador<input inputMode="numeric" value={cpf} onChange={(e) => setCpf(e.target.value)} placeholder="Somente números" /></label>{methodButtons}{method === "boleto" && <BoletoAddressFields address={address} onChange={setAddress} prefix="plan-boleto" />}{method === "card" ? <CardCheckout amountCents={selectedPlan.price_cents} email={user.email} cpf={cpf} actionLabel="Assinar com renovação automática" onToken={subscribeCard} /> : <button className="purchase-submit" onClick={() => createManualPayment("plan")} disabled={loading}>{loading ? "Gerando cobrança" : "Gerar cobrança do plano"}<ArrowRight /></button>}</>}{message && <p className="purchase-message">{message}</p>}</motion.section></motion.div>}</AnimatePresence>

    <AnimatePresence>{selected && <motion.div className="purchase-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={() => setSelected(null)}><motion.section className="purchase-modal" initial={{ opacity: 0, scale: .96, y: 15 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: .97 }} onMouseDown={(e) => e.stopPropagation()}><button className="purchase-close" onClick={() => setSelected(null)}><X /></button><p className="kicker">FINALIZAR COMPRA</p><h2>{selected.name}</h2><strong className="purchase-total">{currency.format(selected.price_cents / 100)}</strong>
      {payment ? <PaymentResult /> : <><label>CPF do pagador<input inputMode="numeric" value={cpf} onChange={(e) => setCpf(e.target.value)} placeholder="Somente números" /></label>{methodButtons}{method === "boleto" && <BoletoAddressFields address={address} onChange={setAddress} prefix="product-boleto" />}{method === "card" ? <CardCheckout amountCents={selected.price_cents} email={user.email} cpf={cpf} actionLabel="Pagar módulo no cartão" allowInstallments onToken={buyProductCard} /> : <button className="purchase-submit" onClick={() => createManualPayment("product")} disabled={loading}>{loading ? "Gerando cobrança" : "Gerar cobrança"}<ArrowRight /></button>}</>}{message && <p className="purchase-message">{message}</p>}</motion.section></motion.div>}</AnimatePresence>
  </div>
}
