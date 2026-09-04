import { authHeader } from "@/lib/backend"

export type FeatureKey = "portfolio" | "executive_report" | "team"
export type WorkspaceCompany = { id: string; name: string; cnpj: string; notes: string; tag: string; created_at: string; updated_at: string }
export type WorkspaceScenario = { id: string; client_id: string; created_by: string | null; name: string; state: any; saved_at: string; updated_at: string }
export type WorkspaceMember = { id: string; user_id: string; role: "owner" | "editor" | "viewer"; joined_at: string; profile: { id: string; email: string; full_name: string; access_status: string } | null }
export type WorkspaceInvite = { id: string; invited_email: string; role: "editor" | "viewer"; token: string; expires_at: string; created_at: string }
export type ReportBranding = { office_name: string; responsible_name: string; contact_line: string; footer_text: string; updated_at?: string }
export type WorkspaceProduct = { id: string; slug: string; name: string; description: string; price_cents: number; feature_key: FeatureKey }

export type WorkspaceContext = {
  workspace: { id: string; owner_id: string; name: string }
  membership: { id: string; workspace_id: string; user_id: string; role: "owner" | "editor" | "viewer"; active: boolean }
  ownerId: string
  isOwner: boolean
  canEdit: boolean
  canAccessViaTeam: boolean
  products: WorkspaceProduct[]
  features: FeatureKey[]
  moduleFeatures: FeatureKey[]
  plan: { id?: string; slug: string; name: string; billing_months?: number; company_limit?: number; included_features?: FeatureKey[] }
  planActive?: boolean
  adminBypass: boolean
  limits: { companies: number; members: number; scenarios: number }
  companies: WorkspaceCompany[]
  scenarios: WorkspaceScenario[]
  members: WorkspaceMember[]
  invites: WorkspaceInvite[]
  branding: ReportBranding
}

export function hasFeature(context: WorkspaceContext | null, key: FeatureKey) {
  return Boolean(context?.features.includes(key))
}

async function readJson(response: Response) {
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.error || "Não foi possível concluir a operação.")
  return data
}

export async function loadWorkspace(previewEssential = false): Promise<WorkspaceContext> {
  const response = await fetch(`/.netlify/functions/workspace${previewEssential ? "?previewEssential=1" : ""}`, { headers: await authHeader() })
  return readJson(response)
}

export async function workspaceAction<T = any>(action: string, payload: Record<string, unknown> = {}, previewEssential = false): Promise<T> {
  const response = await fetch("/.netlify/functions/workspace", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await authHeader()) },
    body: JSON.stringify({ action, ...payload, previewEssential })
  })
  return readJson(response)
}

export function formatCnpj(value: string) {
  const digits = String(value || "").replace(/\D/g, "").slice(0, 14)
  return digits.replace(/^(\d{2})(\d)/, "$1.$2").replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3").replace(/\.(\d{3})(\d)/, ".$1/$2").replace(/(\/\d{4})(\d)/, "$1-$2")
}

export function validCnpj(value: string) {
  const cnpj = String(value || "").replace(/\D/g, "")
  if (cnpj.length !== 14 || /^(\d)\1{13}$/.test(cnpj)) return false
  const digit = (length: number) => {
    const weights = length === 12 ? [5,4,3,2,9,8,7,6,5,4,3,2] : [6,5,4,3,2,9,8,7,6,5,4,3,2]
    const sum = weights.reduce((acc, weight, index) => acc + Number(cnpj[index]) * weight, 0)
    const remainder = sum % 11
    return remainder < 2 ? 0 : 11 - remainder
  }
  return digit(12) === Number(cnpj[12]) && digit(13) === Number(cnpj[13])
}
