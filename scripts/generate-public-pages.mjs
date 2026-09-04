import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"

const root = process.cwd()
const dist = path.join(root, "dist")
const basePath = path.join(dist, "index.html")
let base = await readFile(basePath, "utf8")

const appUrl = "https://tributoleve.com.br"
const verification = (process.env.VITE_GOOGLE_SITE_VERIFICATION || "").trim()

const routes = {
  "/sobre": ["Sobre o Tributo Leve | Simulação tributária profissional", "Conheça o Tributo Leve, plataforma brasileira para simular cenários da Reforma Tributária e acompanhar a transição de IBS e CBS."],
  "/planos": ["Planos do simulador tributário | Tributo Leve", "Compare Leve Start, Leve Pro e Leve Prime e escolha a estrutura ideal para simular a Reforma Tributária na sua operação."],
  "/simulador-reforma-tributaria": ["Simulador da Reforma Tributária 2027–2033 | Tributo Leve", "Simule IBS e CBS, compare regimes e acompanhe a transição da Reforma Tributária de 2027 a 2033 com memória de cálculo."],
  "/reforma-tributaria": ["Reforma Tributária: IBS, CBS e transição | Tributo Leve", "Entenda como o Tributo Leve organiza a análise da Reforma Tributária, incluindo IBS, CBS, transição e comparação de cenários."],
  "/faq": ["Perguntas frequentes sobre o Tributo Leve", "Tire dúvidas sobre simulações, planos, dados, pagamentos, cancelamento, segurança e LGPD no Tributo Leve."],
  "/privacidade": ["Política de Privacidade | Tributo Leve", "Entenda como o Tributo Leve trata dados pessoais, cookies, pagamentos, segurança e direitos de privacidade."],
  "/lgpd": ["LGPD e proteção de dados | Tributo Leve", "Conheça as práticas do Tributo Leve para proteção de dados e exercício dos direitos previstos na LGPD."],
  "/termos": ["Termos de Uso | Tributo Leve", "Consulte os termos de uso do Tributo Leve, responsabilidades do usuário e condições gerais do serviço."],
  "/seguranca": ["Segurança e divulgação responsável | Tributo Leve", "Conheça as práticas de segurança do Tributo Leve e o canal para divulgação responsável de vulnerabilidades."],
}

function replaceMeta(html, selector, value) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const byName = new RegExp(`<meta\\s+name=["']${escaped}["'][^>]*content=["'][^"']*["'][^>]*>`, "i")
  const byProperty = new RegExp(`<meta\\s+property=["']${escaped}["'][^>]*content=["'][^"']*["'][^>]*>`, "i")
  if (byName.test(html)) return html.replace(byName, `<meta name="${selector}" content="${value}" />`)
  if (byProperty.test(html)) return html.replace(byProperty, `<meta property="${selector}" content="${value}" />`)
  return html.replace("</head>", `    <meta name="${selector}" content="${value}" />\n  </head>`)
}

function routeHtml(template, route, title, description) {
  let html = template
  html = html.replace(/<title>[^<]*<\/title>/i, `<title>${title}</title>`)
  html = replaceMeta(html, "description", description)
  html = replaceMeta(html, "og:title", title)
  html = replaceMeta(html, "og:description", description)
  html = replaceMeta(html, "og:url", `${appUrl}${route}`)
  html = replaceMeta(html, "twitter:title", title)
  html = replaceMeta(html, "twitter:description", description)
  html = html.replace(/<link\s+rel=["']canonical["'][^>]*>/i, `<link rel="canonical" href="${appUrl}${route}" />`)
  return html
}

if (verification) {
  const tag = `<meta name="google-site-verification" content="${verification.replace(/["<>]/g, "")}" />`
  if (!base.includes('name="google-site-verification"')) base = base.replace("</head>", `    ${tag}\n  </head>`)
}
await writeFile(basePath, base)

for (const [route, [title, description]] of Object.entries(routes)) {
  const folder = path.join(dist, route.slice(1))
  await mkdir(folder, { recursive: true })
  await writeFile(path.join(folder, "index.html"), routeHtml(base, route, title, description))
}

// Alias local para /simulador: Netlify redireciona para a URL canônica, mas o arquivo
// mantém a rota funcional também em previews/hosts sem as regras do netlify.toml.
const simulatorAlias = path.join(dist, "simulador")
await mkdir(simulatorAlias, { recursive: true })
await writeFile(path.join(simulatorAlias, "index.html"), routeHtml(base, "/simulador-reforma-tributaria", ...routes["/simulador-reforma-tributaria"]))

console.log(`Páginas públicas pré-geradas: ${Object.keys(routes).length} + alias /simulador`)
if (verification) console.log("Google Search Console: meta de verificação incluída no HTML.")
