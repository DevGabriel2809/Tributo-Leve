import { createClient } from "@supabase/supabase-js"

export type AccessStatus = "pending_payment" | "active" | "test_access" | "blocked"
export type AppUser = {
  id: string
  email: string
  name: string
  role: "user" | "admin"
  accessStatus: AccessStatus
  teamAccess?: boolean
}

const url = import.meta.env.VITE_SUPABASE_URL?.trim()
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()

export const backendConfigured = Boolean(url && anonKey)
export const supabase = url && anonKey
  ? createClient(url, anonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    })
  : null

export async function currentUser(): Promise<AppUser | null> {
  if (!supabase) return null
  const { data: sessionData } = await supabase.auth.getSession()
  const session = sessionData.session
  const authUser = session?.user
  if (!authUser || !session) return null
  const { data: profile, error } = await supabase.from("profiles").select("id,email,full_name,role,access_status").eq("id", authUser.id).single()
  if (error || !profile || profile.access_status === "blocked") return null

  const authorization = `Bearer ${session.access_token}`
  const inviteToken = new URLSearchParams(window.location.search).get("invite")
  if (inviteToken) {
    try {
      const response = await fetch("/.netlify/functions/workspace", { method: "POST", headers: { "Content-Type": "application/json", Authorization: authorization }, body: JSON.stringify({ action: "accept_invite", token: inviteToken }) })
      if (response.ok) {
        const clean = new URL(window.location.href); clean.searchParams.delete("invite")
        window.history.replaceState({}, "", `${clean.pathname}${clean.search}${clean.hash}`)
      }
    } catch { /* login continua */ }
  }

  let teamAccess = false
  if (profile.role !== "admin" && profile.access_status !== "test_access") {
    try {
      const statusResponse = await fetch("/.netlify/functions/payment-status", { headers: { Authorization: authorization } })
      const status = await statusResponse.json()
      if (!statusResponse.ok || status.access !== "active") {
        const workspaceResponse = await fetch("/.netlify/functions/workspace", { headers: { Authorization: authorization } })
        if (workspaceResponse.ok) teamAccess = Boolean((await workspaceResponse.json()).canAccessViaTeam)
        if (!teamAccess) return null
      }
    } catch { return null }
  }

  return { id: profile.id, email: profile.email || authUser.email || "", name: profile.full_name || authUser.user_metadata?.full_name || "Cliente", role: profile.role, accessStatus: profile.access_status, teamAccess }
}

export async function authHeader(): Promise<Record<string, string>> {
  if (!supabase) return {}
  const { data } = await supabase.auth.getSession()
  return data.session ? { Authorization: `Bearer ${data.session.access_token}` } : {}
}

export async function signOut() {
  await supabase?.auth.signOut()
}
