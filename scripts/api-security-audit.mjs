import { readdir, readFile } from "node:fs/promises"
import path from "node:path"

const dir = path.join(process.cwd(), "netlify/functions")
const failures = []
const publicRoutes = new Set(["payment-webhook.mts", "register-user.mts", "login-guard.mts"])

for (const file of (await readdir(dir)).filter((f) => /\.(mts|ts)$/.test(f) && !f.startsWith("_"))) {
  const text = await readFile(path.join(dir, file), "utf8")
  const methodGuard = text.match(/request\.method\s*!==\s*["'](GET|POST|PUT|PATCH|DELETE)["']/)
  if (!methodGuard) failures.push(`${file}: sem guarda explícita de método HTTP`)
  if (!publicRoutes.has(file) && !/(authenticatedUser|requireAdmin)\s*\(/.test(text)) failures.push(`${file}: rota não pública sem autenticação explícita`)
  const exposedMethod = methodGuard?.[1]
  if (exposedMethod && exposedMethod !== "GET" && file !== "payment-webhook.mts" && !/assertTrustedOrigin\s*\(/.test(text)) failures.push(`${file}: endpoint mutável sem validação de origem aparente`)
  if (file === "admin-overview.mts" && !/requireAdmin\s*\(/.test(text)) failures.push(`${file}: endpoint administrativo sem requireAdmin()`)
}

if (failures.length) {
  console.error("API security audit falhou:\n" + failures.map((item) => `- ${item}`).join("\n"))
  process.exit(1)
}
console.log("API security audit: OK — métodos, autenticação e autorização crítica revisados.")
