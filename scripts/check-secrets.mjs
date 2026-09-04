import { readdir, readFile, stat } from "node:fs/promises"
import path from "node:path"

const root = process.cwd()
const ignored = new Set(["node_modules", "dist", ".git", ".netlify"])
const textExt = new Set([".ts", ".tsx", ".js", ".mjs", ".cjs", ".json", ".md", ".txt", ".html", ".toml", ".yml", ".yaml", ".ps1", ".bat", ".sql"])
const violations = []

// Nomes públicos podem aparecer na documentação. A falha é disparada quando o
// prefixo perigoso é usado como variável/configuração, não quando é apenas citado.
const dangerousAssignment = /(?:^|[\s"'`])(?:NEXT_PUBLIC_[A-Z0-9_]+|VITE_[A-Z0-9_]*(?:SECRET|ACCESS_TOKEN|PRIVATE_KEY|SERVICE_ROLE|PASSWORD))\s*(?:=|:)/gim
const secretValuePatterns = [
  /sb_secret_[A-Za-z0-9._-]{18,}/g,
  /APP_USR-[A-Za-z0-9_-]{24,}/g,
  /github_pat_[A-Za-z0-9_]{20,}/g,
  /ghp_[A-Za-z0-9]{30,}/g,
  /(?:NETLIFY_AUTH_TOKEN|SUPABASE_SECRET_KEY|MERCADO_PAGO_ACCESS_TOKEN|TURNSTILE_SECRET_KEY)\s*=\s*(?!SEU_|SUA_|sb_secret_SUA|APP_USR_SEU)[^\s#]{16,}/gi,
]

async function walk(dir) {
  for (const entry of await readdir(dir)) {
    if (ignored.has(entry)) continue
    const full = path.join(dir, entry)
    const info = await stat(full)
    if (info.isDirectory()) { await walk(full); continue }
    const rel = path.relative(root, full)
    if (/^\.env(?!\.example$)/.test(entry)) { violations.push(`${rel}: arquivo de ambiente privado presente no repositório`); continue }
    if (!textExt.has(path.extname(entry)) && entry !== ".env.example") continue
    const text = await readFile(full, "utf8").catch(() => "")
    if (dangerousAssignment.test(text)) violations.push(`${rel}: segredo configurado com prefixo público`)
    dangerousAssignment.lastIndex = 0
    if (entry !== ".env.example") {
      for (const pattern of secretValuePatterns) {
        if (pattern.test(text)) violations.push(`${rel}: possível valor secreto hardcoded`)
        pattern.lastIndex = 0
      }
    }
  }
}
await walk(root)
if (violations.length) {
  console.error("\nFalha na auditoria de segredos:\n" + violations.map((item) => `- ${item}`).join("\n"))
  process.exit(1)
}
console.log("Auditoria de segredos: OK — nenhum valor privado ou prefixo público perigoso encontrado.")
