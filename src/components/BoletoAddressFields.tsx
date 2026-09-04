import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { BillingAddress } from "@/lib/payment"

export function BoletoAddressFields({ address, onChange, prefix = "boleto" }: { address: BillingAddress; onChange: (address: BillingAddress) => void; prefix?: string }) {
  const set = (field: keyof BillingAddress, value: string) => onChange({ ...address, [field]: value })
  return <div className="boleto-address" aria-label="Endereço do pagador para boleto">
    <p>Dados exigidos pelo Mercado Pago para emissão do boleto</p>
    <div className="boleto-address-grid">
      <div><Label htmlFor={`${prefix}-zip`}>CEP</Label><Input id={`${prefix}-zip`} inputMode="numeric" autoComplete="postal-code" value={address.zipCode} onChange={(event) => set("zipCode", event.target.value)} placeholder="00000000" /></div>
      <div><Label htmlFor={`${prefix}-state`}>UF</Label><Input id={`${prefix}-state`} autoComplete="address-level1" maxLength={2} value={address.state} onChange={(event) => set("state", event.target.value.toUpperCase())} placeholder="PE" /></div>
      <div className="wide"><Label htmlFor={`${prefix}-street`}>Rua / avenida</Label><Input id={`${prefix}-street`} autoComplete="address-line1" value={address.streetName} onChange={(event) => set("streetName", event.target.value)} placeholder="Nome da rua" /></div>
      <div><Label htmlFor={`${prefix}-number`}>Número</Label><Input id={`${prefix}-number`} value={address.streetNumber} onChange={(event) => set("streetNumber", event.target.value)} placeholder="S/N se não houver" /></div>
      <div><Label htmlFor={`${prefix}-neighborhood`}>Bairro</Label><Input id={`${prefix}-neighborhood`} value={address.neighborhood} onChange={(event) => set("neighborhood", event.target.value)} placeholder="Bairro" /></div>
      <div className="wide"><Label htmlFor={`${prefix}-city`}>Cidade</Label><Input id={`${prefix}-city`} autoComplete="address-level2" value={address.city} onChange={(event) => set("city", event.target.value)} placeholder="Cidade" /></div>
    </div>
  </div>
}
