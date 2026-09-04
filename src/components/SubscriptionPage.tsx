import * as React from "react"
import { CalendarClock, CreditCard, RefreshCw, ShieldCheck, XCircle } from "lucide-react"
import type { AppUser } from "@/lib/backend"
import { CardCheckout, type CardTokenResult } from "@/components/CardCheckout"
import { getSubscription, manageSubscription } from "@/lib/billing"
import { onlyDigits, validCpf } from "@/lib/payment"
import { displayPlanName } from "@/lib/planBranding"

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })
const date = (value?: string | null) => value ? new Date(value).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—"

type SubscriptionData = {
  recurring: boolean
  contract?: { status: string; providerStatus: string; amountCents: number; billingMonths: number; currentPeriodStart?: string; currentPeriodEnd?: string; nextPaymentDate?: string; graceUntil?: string; cancelAtPeriodEnd?: boolean; canceledAt?: string; cardBrand?: string; cardLast4?: string; lastPaymentStatus?: string; lastPaymentStatusDetail?: string }
  subscription?: { status?: string; expires_at?: string; grace_until?: string; renewal_mode?: string; next_billing_at?: string }
  plan?: { slug?: string; name?: string; price_cents?: number; billing_months?: number; company_limit?: number }
}

export function SubscriptionPage({ user, canManage = true, onOpenPlans }: { user: AppUser; canManage?: boolean; onOpenPlans: () => void }) {
  const [data, setData] = React.useState<SubscriptionData | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [message, setMessage] = React.useState("")
  const [cpf, setCpf] = React.useState("")
  const [showCard, setShowCard] = React.useState(false)
  const [showCancelConfirm, setShowCancelConfirm] = React.useState(false)

  const load = React.useCallback(async (sync = false) => {
    setLoading(true); setMessage("")
    try { setData(await getSubscription(sync)) }
    catch (cause) { setMessage(cause instanceof Error ? cause.message : "Não foi possível carregar sua assinatura.") }
    finally { setLoading(false) }
  }, [])
  React.useEffect(() => { void load(false) }, [load])

  async function cancel() {
    setLoading(true); setMessage("")
    try {
      setData(await manageSubscription("cancel"))
      setShowCancelConfirm(false)
      setMessage("Assinatura cancelada. Não haverá novas cobranças automáticas e seu acesso continua até o fim do período já pago.")
    }
    catch (cause) { setMessage(cause instanceof Error ? cause.message : "Não foi possível cancelar a assinatura.") }
    finally { setLoading(false) }
  }

  async function updateCard(card: CardTokenResult) {
    if (!validCpf(cpf)) throw new Error("Informe seu CPF válido antes de atualizar o cartão.")
    const next = await manageSubscription("update_card", { cardToken: card.token, paymentMethodId: card.paymentMethodId, deviceId: card.deviceId, cpf: onlyDigits(cpf) })
    setData(next); setShowCard(false); setMessage("Cartão atualizado no Mercado Pago. A próxima cobrança usará o novo cartão.")
  }

  if (loading && !data) return <div className="admin-loading"><span className="loader" /><strong>Carregando sua assinatura</strong></div>
  const contract = data?.contract
  const subscription = data?.subscription
  const plan = data?.plan
  const recurringActive = Boolean(data?.recurring && contract && !["canceled", "expired"].includes(contract.status))

  return <div className="subscription-page">
    <section className="workspace-heading"><div><p className="kicker">MINHA ASSINATURA</p><h1>Plano, cobrança e renovação</h1><p>Consulte a vigência, sincronize o Mercado Pago, troque o cartão ou encerre somente a renovação automática.</p></div><button className="admin-refresh" onClick={() => void load(true)} disabled={loading}><RefreshCw size={17} className={loading ? "is-spinning" : ""} />Sincronizar</button></section>
    {message && <p className="subscription-message">{message}</p>}
    <div className="subscription-summary-grid">
      <article className="panel subscription-main"><span className="subscription-icon"><ShieldCheck /></span><small>PLANO ATUAL</small><h2>{plan?.slug ? displayPlanName(plan.slug, plan.name || "Plano") : "Sem plano ativo"}</h2><strong>{plan?.price_cents ? money.format(plan.price_cents / 100) : "—"}</strong><p>{subscription?.renewal_mode === "automatic" ? "Renovação automática pelo cartão" : "Renovação manual por PIX ou boleto"}</p><dl><dt>Status</dt><dd>{subscription?.status || contract?.status || "—"}</dd><dt>Período pago até</dt><dd>{date(subscription?.expires_at || contract?.currentPeriodEnd)}</dd><dt>Próxima cobrança</dt><dd>{recurringActive && !contract?.cancelAtPeriodEnd ? date(contract?.nextPaymentDate || subscription?.next_billing_at) : "Sem nova cobrança automática"}</dd>{subscription?.grace_until && <><dt>Tolerância até</dt><dd>{date(subscription.grace_until)}</dd></>}</dl></article>
      <article className="panel subscription-card"><span className="subscription-icon"><CreditCard /></span><small>FORMA DE PAGAMENTO</small><h2>{data?.recurring ? "Cartão automático" : "Renovação manual"}</h2>{contract?.cardBrand && <strong>{contract.cardBrand.toUpperCase()} {contract.cardLast4 ? `•••• ${contract.cardLast4}` : ""}</strong>}<p>{contract?.cancelAtPeriodEnd ? "A renovação foi cancelada; não haverá nova cobrança automática." : data?.recurring ? "O Mercado Pago mantém os dados do cartão; o Tributo Leve guarda somente marca e últimos dígitos quando disponíveis." : "Você pode migrar para cartão automático na tela de planos."}</p><div className="subscription-actions">{canManage && recurringActive && !contract?.cancelAtPeriodEnd && <button onClick={() => setShowCard((value) => !value)}><CreditCard />Trocar cartão</button>}{canManage && recurringActive && !contract?.cancelAtPeriodEnd && <button className="danger" onClick={() => setShowCancelConfirm(true)}><XCircle />Cancelar assinatura</button>}{canManage && (!data?.recurring || contract?.cancelAtPeriodEnd) && <button onClick={onOpenPlans}><CalendarClock />Ver planos e renovar</button>}</div></article>
    </div>
    {showCancelConfirm && recurringActive && !contract?.cancelAtPeriodEnd && <section className="panel subscription-cancel-confirm" role="dialog" aria-modal="true" aria-labelledby="cancel-subscription-title">
      <div>
        <p className="kicker">CANCELAMENTO</p>
        <h2 id="cancel-subscription-title">Cancelar sua assinatura?</h2>
        <p>Isso encerra a renovação automática no Mercado Pago. <strong>Não haverá novas cobranças.</strong> Seu acesso continua normalmente até {date(subscription?.expires_at || contract?.currentPeriodEnd)}.</p>
      </div>
      <div className="subscription-cancel-actions">
        <button type="button" onClick={() => setShowCancelConfirm(false)} disabled={loading}>Manter assinatura</button>
        <button type="button" className="danger" onClick={() => void cancel()} disabled={loading}>{loading ? "Cancelando..." : "Confirmar cancelamento"}</button>
      </div>
    </section>}
    {showCard && plan?.price_cents && <section className="panel subscription-update-card"><p className="kicker">ATUALIZAR CARTÃO</p><h2>Novo cartão da assinatura</h2><p>O token é gerado nos campos seguros do Mercado Pago e utilizado uma única vez para substituir o cartão da recorrência.</p><label>CPF cadastrado<input inputMode="numeric" value={cpf} onChange={(event) => setCpf(event.target.value)} placeholder="Somente números" /></label><CardCheckout amountCents={plan.price_cents} email={user.email} cpf={cpf} actionLabel="Atualizar cartão da assinatura" onToken={updateCard} /></section>}
  </div>
}
