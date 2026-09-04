export type PaymentMethod = "pix" | "boleto" | "card"
export type BillingAddress = {
  zipCode: string
  streetName: string
  streetNumber: string
  neighborhood: string
  city: string
  state: string
}

export type Payment = {
  id: string
  transactionId?: string
  status: string
  statusDetail?: string
  method: PaymentMethod
  qrCode?: string
  qrCodeBase64?: string
  ticketUrl?: string
  digitableLine?: string
  barcodeContent?: string
  financialInstitution?: string
  expiresAt?: string
  cardBrand?: string
  cardLast4?: string
  installments?: number
}

export const emptyBillingAddress = (): BillingAddress => ({ zipCode: "", streetName: "", streetNumber: "", neighborhood: "", city: "", state: "" })
export const onlyDigits = (value: string) => String(value || "").replace(/\D/g, "")

export function validCpf(value: string) {
  const cpf = onlyDigits(value)
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false
  const digit = (length: number) => {
    let sum = 0
    for (let index = 0; index < length; index += 1) sum += Number(cpf[index]) * (length + 1 - index)
    const remainder = (sum * 10) % 11
    return remainder === 10 ? 0 : remainder
  }
  return digit(9) === Number(cpf[9]) && digit(10) === Number(cpf[10])
}

export function normalizeBillingAddress(address: BillingAddress): BillingAddress {
  return { zipCode: onlyDigits(address.zipCode).slice(0, 8), streetName: address.streetName.trim(), streetNumber: address.streetNumber.trim() || "S/N", neighborhood: address.neighborhood.trim(), city: address.city.trim(), state: address.state.replace(/[^a-zA-Z]/g, "").toUpperCase().slice(0, 2) }
}

export function billingAddressError(address: BillingAddress) {
  const normalized = normalizeBillingAddress(address)
  if (normalized.zipCode.length !== 8) return "Informe um CEP válido com 8 dígitos."
  if (!normalized.streetName) return "Informe a rua do pagador."
  if (!normalized.streetNumber) return "Informe o número do endereço ou S/N."
  if (!normalized.neighborhood) return "Informe o bairro do pagador."
  if (!normalized.city) return "Informe a cidade do pagador."
  if (normalized.state.length !== 2) return "Informe a UF com 2 letras, por exemplo PE."
  return ""
}

export function paymentNeedsReplacement(payment: Payment | null) {
  if (!payment) return true
  return ["canceled", "cancelled", "expired", "failed", "refunded", "charged_back", "rejected", "amount_mismatch"].includes(payment.status)
}
