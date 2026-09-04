import { access, readFile } from "node:fs/promises"
import path from "node:path"

const root = process.cwd()
const failures = []
const required = ["public/robots.txt", "public/sitemap.xml", "public/llms.txt", "public/.well-known/security.txt"]
for (const file of required) {
  try { await access(path.join(root, file)) } catch { failures.push(`Arquivo ausente: ${file}`) }
}

const index = await readFile(path.join(root, "index.html"), "utf8")
for (const marker of ['name="description"', 'rel="canonical"', 'property="og:title"', 'application/ld+json']) {
  if (!index.includes(marker)) failures.push(`index.html sem ${marker}`)
}
const robots = await readFile(path.join(root, "public/robots.txt"), "utf8").catch(() => "")
if (!/Sitemap:\s*https:\/\/tributoleve\.com\.br\/sitemap\.xml/i.test(robots)) failures.push("robots.txt sem sitemap canônico")
const sitemap = await readFile(path.join(root, "public/sitemap.xml"), "utf8").catch(() => "")
for (const route of ["/planos", "/simulador-reforma-tributaria", "/reforma-tributaria", "/faq", "/lgpd", "/seguranca"]) {
  if (!sitemap.includes(`https://tributoleve.com.br${route}`)) failures.push(`sitemap.xml sem ${route}`)
}

if (failures.length) {
  console.error("SEO check falhou:\n" + failures.map((item) => `- ${item}`).join("\n"))
  process.exit(1)
}
console.log("SEO check: OK — metadados e arquivos públicos essenciais presentes.")
