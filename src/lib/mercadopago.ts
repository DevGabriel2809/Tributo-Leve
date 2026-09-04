type CardFormData = {
  paymentMethodId?: string
  issuerId?: string
  cardholderEmail?: string
  amount?: string
  token?: string
  installments?: string | number
  identificationNumber?: string
  identificationType?: string
}

type CardFormInstance = {
  getCardFormData: () => CardFormData
  unmount?: () => void
}

type CardFormConfig = {
  amount: string
  iframe: boolean
  form: Record<string, any>
  callbacks: {
    onFormMounted?: (error?: unknown) => void
    onSubmit: (event: Event) => void
    onFetching?: (resource: string) => (() => void) | void
  }
}

type MercadoPagoInstance = {
  getIdentificationTypes: () => Promise<Array<{ id: string; name: string }>>
  cardForm: (config: CardFormConfig) => CardFormInstance
}

declare global {
  interface Window {
    MercadoPago?: new (publicKey: string, options?: { locale?: string }) => MercadoPagoInstance
    MP_DEVICE_SESSION_ID?: string
  }
}

const publicKey = import.meta.env.VITE_MERCADO_PAGO_PUBLIC_KEY?.trim()
let instancePromise: Promise<MercadoPagoInstance> | null = null

function loadSdk() {
  return new Promise<void>((resolve, reject) => {
    if (window.MercadoPago) return resolve()
    const existing = document.querySelector<HTMLScriptElement>('script[data-mercado-pago-sdk="true"]')
    if (existing) {
      if (window.MercadoPago) return resolve()
      existing.addEventListener("load", () => resolve(), { once: true })
      existing.addEventListener("error", () => reject(new Error("Falha ao carregar MercadoPago.js.")), { once: true })
      return
    }
    const script = document.createElement("script")
    script.src = "https://sdk.mercadopago.com/js/v2"
    script.async = true
    script.dataset.mercadoPagoSdk = "true"
    script.onload = () => resolve()
    script.onerror = () => reject(new Error("Falha ao carregar MercadoPago.js."))
    document.head.appendChild(script)
  })
}

export const mercadoPagoClientConfigured = Boolean(publicKey)

export async function mercadoPagoClient() {
  if (!publicKey) throw new Error("A Public Key de produção do Mercado Pago não foi configurada.")
  if (!instancePromise) {
    instancePromise = loadSdk().then(() => {
      if (!window.MercadoPago) throw new Error("MercadoPago.js não ficou disponível no navegador.")
      return new window.MercadoPago(publicKey, { locale: "pt-BR" })
    })
  }
  return instancePromise
}

export function mercadoPagoDeviceId() {
  return String(window.MP_DEVICE_SESSION_ID || "").slice(0, 256)
}

export async function ensureCpfIdentificationSupported() {
  const mp = await mercadoPagoClient()
  const types = await mp.getIdentificationTypes()
  if (!types.some((item) => String(item.id).toUpperCase() === "CPF")) throw new Error("O Mercado Pago não informou CPF como documento disponível para esta integração.")
}

export type { CardFormData, CardFormInstance }
