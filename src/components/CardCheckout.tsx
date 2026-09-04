import * as React from "react"
import { CreditCard, ShieldCheck } from "lucide-react"
import { mercadoPagoClient, mercadoPagoDeviceId, type CardFormInstance } from "@/lib/mercadopago"
import { onlyDigits } from "@/lib/payment"

export type CardTokenResult = { token: string; paymentMethodId: string; installments: number; deviceId: string }

export function CardCheckout({ amountCents, email, cpf, actionLabel, allowInstallments = false, onToken }: { amountCents: number; email: string; cpf: string; actionLabel: string; allowInstallments?: boolean; onToken: (result: CardTokenResult) => Promise<void> }) {
  const uid = React.useId().replace(/[^a-zA-Z0-9_-]/g, "")
  const [ready, setReady] = React.useState(false)
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState("")
  const formRef = React.useRef<CardFormInstance | null>(null)
  const prefix = `mp-card-${uid}`

  React.useEffect(() => {
    let active = true
    setReady(false); setError("")
    void mercadoPagoClient().then((mp) => {
      if (!active) return
      const cardForm = mp.cardForm({
        amount: (amountCents / 100).toFixed(2),
        iframe: true,
        form: {
          id: `${prefix}-form`,
          cardNumber: { id: `${prefix}-number`, placeholder: "Número do cartão" },
          expirationDate: { id: `${prefix}-expiration`, placeholder: "MM/AA" },
          securityCode: { id: `${prefix}-security`, placeholder: "CVV" },
          cardholderName: { id: `${prefix}-name`, placeholder: "Nome impresso no cartão" },
          issuer: { id: `${prefix}-issuer`, placeholder: "Banco emissor" },
          installments: { id: `${prefix}-installments`, placeholder: "Parcelas" },
          identificationType: { id: `${prefix}-idtype`, placeholder: "Documento" },
          identificationNumber: { id: `${prefix}-idnumber`, placeholder: "CPF" },
          cardholderEmail: { id: `${prefix}-email`, placeholder: "E-mail" }
        },
        callbacks: {
          onFormMounted: (mountError) => {
            if (!active) return
            if (mountError) setError("Não foi possível carregar os campos seguros do cartão.")
            else setReady(true)
          },
          onSubmit: (event) => {
            event.preventDefault()
            if (!active || busy) return
            const data = cardForm.getCardFormData()
            const token = String(data.token || "")
            const paymentMethodId = String(data.paymentMethodId || "").toLowerCase()
            const cardCpf = onlyDigits(String(data.identificationNumber || ""))
            if (!token || !paymentMethodId) return setError("Confira os dados do cartão e tente novamente.")
            if (String(data.identificationType || "").toUpperCase() !== "CPF" || cardCpf !== onlyDigits(cpf)) return setError("O CPF do cartão deve ser o mesmo CPF cadastrado nesta conta.")
            setBusy(true); setError("")
            void onToken({ token, paymentMethodId, installments: allowInstallments ? Math.max(1, Number(data.installments || 1)) : 1, deviceId: mercadoPagoDeviceId() })
              .catch((cause) => setError(cause instanceof Error ? cause.message : "Não foi possível processar o cartão."))
              .finally(() => setBusy(false))
          },
          onFetching: () => { setReady(false); return () => setReady(true) }
        }
      })
      formRef.current = cardForm
    }).catch((cause) => setError(cause instanceof Error ? cause.message : "Não foi possível iniciar o cartão."))
    return () => { active = false; try { formRef.current?.unmount?.() } catch { /* O SDK pode já ter desmontado o iframe ao trocar de tela. */ }; formRef.current = null }
  }, [amountCents, email, cpf, allowInstallments, prefix])

  return <form id={`${prefix}-form`} className="card-checkout" onSubmit={(event) => event.preventDefault()}>
    <div className="card-checkout-security"><ShieldCheck size={17} /><span>Pagamento protegido pelo Mercado Pago. Número completo e CVV não passam pelo servidor do Tributo Leve.</span></div>
    <div className="card-checkout-grid">
      <label className="card-field card-field-wide"><span>Número do cartão</span><div id={`${prefix}-number`} className="mp-secure-field" /></label>
      <label className="card-field"><span>Validade</span><div id={`${prefix}-expiration`} className="mp-secure-field" /></label>
      <label className="card-field"><span>CVV</span><div id={`${prefix}-security`} className="mp-secure-field" /></label>
      <label className="card-field card-field-wide"><span>Nome impresso no cartão</span><input id={`${prefix}-name`} type="text" autoComplete="cc-name" /></label>
      <label className="card-field"><span>Tipo</span><select id={`${prefix}-idtype`} /></label>
      <label className="card-field"><span>CPF do titular</span><input id={`${prefix}-idnumber`} inputMode="numeric" defaultValue={onlyDigits(cpf)} /></label>
      {allowInstallments && <label className="card-field card-field-wide"><span>Parcelas</span><select id={`${prefix}-installments`} /></label>}
      <label className="card-field card-field-wide"><span>E-mail do pagador</span><input id={`${prefix}-email`} type="email" defaultValue={email} /></label>
    </div>
    <select id={`${prefix}-issuer`} className="card-hidden-field" aria-hidden="true" tabIndex={-1} />
    {!allowInstallments && <select id={`${prefix}-installments`} className="card-hidden-field" aria-hidden="true" tabIndex={-1} />}
    {error && <p className="purchase-message card-error" role="alert">{error}</p>}
    <button id={`${prefix}-submit`} className="purchase-submit" type="submit" disabled={!ready || busy}><CreditCard size={18} />{busy ? "Processando cartão" : actionLabel}</button>
  </form>
}
