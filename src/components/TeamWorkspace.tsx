import * as React from "react"
import { Copy, Eye, Pencil, Plus, ShieldCheck, Trash2, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { WorkspaceContext } from "@/lib/workspace"

export function TeamWorkspace({ context, onInvite, onRemove, onRole, onRevoke, onRefresh }: {
  context: WorkspaceContext
  onInvite: (email: string, role: "editor" | "viewer") => Promise<{ inviteUrl: string }>
  onRemove: (memberId: string) => Promise<void>
  onRole: (memberId: string, role: "editor" | "viewer") => Promise<void>
  onRevoke: (inviteId: string) => Promise<void>
  onRefresh: () => Promise<void>
}) {
  const [email, setEmail] = React.useState("")
  const [role, setRole] = React.useState<"editor" | "viewer">("editor")
  const [message, setMessage] = React.useState("")
  const [inviteUrl, setInviteUrl] = React.useState("")
  const [busy, setBusy] = React.useState(false)

  async function invite() {
    setMessage(""); setInviteUrl(""); setBusy(true)
    try { const result = await onInvite(email, role); setInviteUrl(result.inviteUrl); setEmail(""); setMessage("Convite criado. Copie o link e envie ao colaborador.") }
    catch (cause) { setMessage(cause instanceof Error ? cause.message : "Não foi possível criar o convite.") }
    finally { setBusy(false) }
  }

  async function copyInvite() { if (!inviteUrl) return; await navigator.clipboard.writeText(inviteUrl); setMessage("Link de convite copiado.") }

  return <div className="team-page">
    <section className="workspace-heading"><div><p className="kicker">EQUIPE ADICIONAL</p><h1>Compartilhe a operação</h1><p>O módulo inclui o titular e até 3 colaboradores. Editor altera cenários; consulta apenas visualiza.</p></div><span className="count-chip">{context.members.length}/{context.limits.members} acessos</span></section>
    {!context.isOwner && <div className="team-info panel"><ShieldCheck /><div><strong>Você é colaborador deste workspace</strong><p>O titular administra convites e permissões. Seus acessos aos módulos acompanham a licença do workspace.</p></div></div>}
    {context.isOwner && <section className="team-invite panel"><div><p className="kicker">NOVO COLABORADOR</p><h2>Gerar link de convite</h2><p>Não precisa de serviço de e-mail: gere o link e envie por WhatsApp, e-mail ou outro canal.</p></div><div className="team-invite-form"><Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="colaborador@empresa.com" aria-label="E-mail do colaborador" /><select value={role} onChange={(e) => setRole(e.target.value as any)} aria-label="Permissão"><option value="editor">Editor</option><option value="viewer">Somente consulta</option></select><Button onClick={invite} disabled={busy || context.members.length >= context.limits.members}><Plus size={17} />{busy ? "Gerando" : "Gerar convite"}</Button></div>{inviteUrl && <div className="invite-link"><code>{inviteUrl}</code><button onClick={copyInvite}><Copy size={17} />Copiar link</button></div>}{message && <p className="team-message">{message}</p>}</section>}
    <section className="panel admin-table"><div className="admin-table-head"><div><h2>Membros do workspace</h2><p>A licença e os dados operacionais são compartilhados dentro desta equipe.</p></div><Button variant="ghost" onClick={onRefresh}>Atualizar</Button></div><div className="table-scroll"><table><thead><tr><th>Pessoa</th><th>Perfil</th><th>Entrada</th><th>Ações</th></tr></thead><tbody>{context.members.map((member) => <tr key={member.id}><td><strong>{member.profile?.full_name || "Sem nome"}</strong><small>{member.profile?.email || member.user_id}</small></td><td>{member.role === "owner" ? "Titular" : member.role === "editor" ? "Editor" : "Consulta"}</td><td>{new Date(member.joined_at).toLocaleDateString("pt-BR")}</td><td>{context.isOwner && member.role !== "owner" ? <div className="admin-actions"><button title="Permitir edição" onClick={() => onRole(member.id, "editor")}><Pencil /></button><button title="Somente consulta" onClick={() => onRole(member.id, "viewer")}><Eye /></button><button className="danger" title="Remover colaborador" onClick={() => onRemove(member.id)}><Trash2 /></button></div> : <span><Users size={16} /></span>}</td></tr>)}</tbody></table></div></section>
    {context.isOwner && context.invites.length > 0 && <section className="panel team-pending"><h2>Convites pendentes</h2>{context.invites.map((invite) => <div key={invite.id}><span><strong>{invite.invited_email}</strong><small>{invite.role === "editor" ? "Editor" : "Consulta"} · expira {new Date(invite.expires_at).toLocaleDateString("pt-BR")}</small></span><button onClick={() => onRevoke(invite.id)}>Revogar</button></div>)}</section>}
  </div>
}
