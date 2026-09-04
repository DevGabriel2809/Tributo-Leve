import * as React from "react"
import { motion } from "framer-motion"
import { ArrowRight, BookOpen, Check, Ghost, LockKeyhole, Scale, ShieldCheck, Sparkles } from "lucide-react"
import { Pricing, type PricingPlan } from "@/components/ui/pricing"
import { planBranding } from "@/lib/planBranding"
import { trackPageView } from "@/lib/analytics"

const APP_URL = "https://tributoleve.com.br"
const publicContact = import.meta.env.VITE_PUBLIC_CONTACT_EMAIL?.trim()
const publicCompanyName = import.meta.env.VITE_PUBLIC_COMPANY_NAME?.trim()
const publicCnpj = import.meta.env.VITE_PUBLIC_CNPJ?.trim()
const publicCity = import.meta.env.VITE_PUBLIC_CITY?.trim()

type MetaConfig = { title: string; description: string; keywords?: string }

const titles: Record<string, MetaConfig> = {
  "/sobre": {
    title: "Sobre o Tributo Leve | Simulação tributária profissional",
    description: "Conheça o Tributo Leve, plataforma brasileira para simular cenários da Reforma Tributária e acompanhar a transição de IBS e CBS.",
    keywords: "Tributo Leve, software tributário, simulação tributária, reforma tributária",
  },
  "/planos": {
    title: "Planos do simulador tributário | Tributo Leve",
    description: "Compare Leve Start, Leve Pro e Leve Prime e escolha a estrutura ideal para simular a Reforma Tributária na sua operação.",
    keywords: "planos simulador tributário, software reforma tributária, IBS CBS",
  },
  "/simulador-reforma-tributaria": {
    title: "Simulador da Reforma Tributária 2027–2033 | Tributo Leve",
    description: "Simule IBS e CBS, compare regimes e acompanhe a transição da Reforma Tributária de 2027 a 2033 com memória de cálculo.",
    keywords: "simulador reforma tributária, simulador IBS CBS, reforma tributária 2027 2033, Simples Nacional regime híbrido",
  },
  "/reforma-tributaria": {
    title: "Reforma Tributária: IBS, CBS e transição | Tributo Leve",
    description: "Entenda como o Tributo Leve organiza a análise da Reforma Tributária, incluindo IBS, CBS, transição e comparação de cenários.",
    keywords: "reforma tributária IBS CBS, transição reforma tributária, planejamento tributário",
  },
  "/faq": {
    title: "Perguntas frequentes sobre o Tributo Leve",
    description: "Tire dúvidas sobre simulações, planos, dados, pagamentos, cancelamento, segurança e LGPD no Tributo Leve.",
    keywords: "Tributo Leve dúvidas, simulador tributário perguntas, reforma tributária software",
  },
  "/privacidade": {
    title: "Política de Privacidade | Tributo Leve",
    description: "Entenda como o Tributo Leve trata dados pessoais, cookies, pagamentos, segurança e direitos de privacidade.",
  },
  "/lgpd": {
    title: "LGPD e proteção de dados | Tributo Leve",
    description: "Conheça as práticas do Tributo Leve para proteção de dados e exercício dos direitos previstos na LGPD.",
  },
  "/termos": {
    title: "Termos de Uso | Tributo Leve",
    description: "Consulte os termos de uso do Tributo Leve, responsabilidades do usuário e condições gerais do serviço.",
  },
  "/seguranca": {
    title: "Segurança e divulgação responsável | Tributo Leve",
    description: "Conheça as práticas de segurança do Tributo Leve e o canal para divulgação responsável de vulnerabilidades.",
  },
}

const publicPathAliases: Record<string, string> = {
  "/simulador": "/simulador-reforma-tributaria",
  "/segurança": "/seguranca",
  "/seguran%C3%A7a": "/seguranca",
  "/seguran%c3%a7a": "/seguranca",
}

function canonicalPublicPath(path: string) {
  return publicPathAliases[path] || path
}

function setMeta(name: string, content: string) {
  let node = document.head.querySelector<HTMLMetaElement>(`meta[name="${name}"]`)
  if (!node) { node = document.createElement("meta"); node.name = name; document.head.appendChild(node) }
  node.content = content
}

function setProperty(property: string, content: string) {
  let node = document.head.querySelector<HTMLMetaElement>(`meta[property="${property}"]`)
  if (!node) { node = document.createElement("meta"); node.setAttribute("property", property); document.head.appendChild(node) }
  node.content = content
}

function usePublicMeta(path: string, notFound = false) {
  React.useEffect(() => {
    const meta = titles[path] || { title: "Página não encontrada | Tributo Leve", description: "A página solicitada não foi encontrada no Tributo Leve." }
    const canonicalUrl = `${APP_URL}${path === "/" ? "/" : path}`
    document.title = meta.title
    setMeta("description", meta.description)
    setMeta("robots", notFound ? "noindex,follow" : "index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1")
    if (meta.keywords) setMeta("keywords", meta.keywords)
    setProperty("og:title", meta.title)
    setProperty("og:description", meta.description)
    setProperty("og:url", canonicalUrl)
    setMeta("twitter:title", meta.title)
    setMeta("twitter:description", meta.description)
    let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')
    if (!canonical) { canonical = document.createElement("link"); canonical.rel = "canonical"; document.head.appendChild(canonical) }
    canonical.href = canonicalUrl
    trackPageView(path)
  }, [path, notFound])
}

function navigate(path: string) {
  if (location.pathname === path) return
  history.pushState({}, "", path)
  window.dispatchEvent(new PopStateEvent("popstate"))
}

export function SiteFooter() {
  const businessLine = [publicCompanyName, publicCnpj ? `CNPJ ${publicCnpj}` : "", publicCity].filter(Boolean).join(" • ")
  return <footer className="site-footer">
    <div><a href="/" className="site-footer-brand"><img src="/tributo-leve-icon.svg" alt="" /><span><strong>Tributo Leve</strong><small>Simulação tributária com clareza.</small></span></a><p>Ferramenta de apoio para simulação e comparação de cenários da Reforma Tributária. Resultados não substituem análise contábil, fiscal ou jurídica individualizada.</p></div>
    <nav aria-label="Informações"><a href="/sobre">Sobre</a><a href="/simulador-reforma-tributaria">Simulador</a><a href="/planos">Planos</a><a href="/faq">FAQ</a><a href="/privacidade">Privacidade</a><a href="/lgpd">LGPD</a><a href="/termos">Termos</a><a href="/seguranca">Segurança</a></nav>
    <div className="site-footer-meta"><span>tributoleve.com.br</span>{businessLine && <span>{businessLine}</span>}{publicContact && <a href={`mailto:${publicContact}`}>{publicContact}</a>}<button type="button" onClick={() => window.dispatchEvent(new Event("tributoleve:open-consent"))}>Gerenciar cookies</button><small>© {new Date().getFullYear()} Tributo Leve. Todos os direitos reservados.</small></div>
  </footer>
}

function PublicHeader() {
  return <header className="public-header"><a href="/" className="public-brand"><img src="/tributo-leve-icon.svg" alt="" /><strong>Tributo Leve</strong></a><nav><a href="/simulador-reforma-tributaria">Simulador</a><a href="/planos">Planos</a><a href="/sobre">Sobre</a><a href="/faq">FAQ</a></nav><a className="public-cta" href="/">Entrar no sistema<ArrowRight size={16} /></a></header>
}

function PublicShell({ path, children }: { path: string; children: React.ReactNode }) {
  usePublicMeta(path)
  return <div className="public-site"><PublicHeader /><main className="public-content">{children}</main><SiteFooter /></div>
}

const publicPlans: PricingPlan[] = [
  { slug: "basico-mensal", ...planBranding("basico-mensal", "Leve Start"), description: planBranding("basico-mensal", "Leve Start").shortDescription, priceCents: 4990, billingMonths: 1, isPopular: false },
  { slug: "pro-mensal", ...planBranding("pro-mensal", "Leve Pro"), description: planBranding("pro-mensal", "Leve Pro").shortDescription, priceCents: 8990, billingMonths: 1, isPopular: false },
  { slug: "pro-trimestral", ...planBranding("pro-trimestral", "Leve Prime"), description: planBranding("pro-trimestral", "Leve Prime").shortDescription, priceCents: 23970, billingMonths: 3, isPopular: true },
].map((plan: any) => ({ ...plan, name: plan.name, badge: plan.badge, features: plan.features }))

const faqItems: [string,string][] = [
  ["O Tributo Leve substitui um contador ou advogado?", "Não. O sistema organiza simulações e comparações para apoiar decisões. A interpretação final deve considerar a realidade da empresa e a revisão profissional adequada."],
  ["Quais formas de pagamento estão disponíveis?", "Planos podem ser pagos por cartão com renovação automática, PIX ou boleto com renovação manual. Módulos avulsos são compras separadas."],
  ["Posso cancelar uma assinatura no cartão?", "Sim. O titular pode cancelar a renovação automática em Minha assinatura. Novas cobranças deixam de ser geradas e o acesso segue até o fim do período já pago."],
  ["Os dados completos do meu cartão ficam no Tributo Leve?", "Não. Os campos de cartão são tokenizados pelo Mercado Pago. O Tributo Leve não armazena número completo nem CVV."],
  ["Como a LGPD é tratada?", "O produto aplica minimização, controle de cookies, políticas públicas, registro de aceite contratual e acesso administrativo restrito. Analytics só é carregado após consentimento."],
]

export function PublicPage({ path }: { path: string }) {
  path = canonicalPublicPath(path)
  if (path === "/sobre") return <PublicShell path={path}><section className="public-hero"><p>TRIBUTO LEVE</p><h1>Reforma Tributária sem transformar análise em adivinhação.</h1><span>O Tributo Leve organiza dados da empresa, simula cenários e ajuda a comparar impactos da transição de IBS e CBS com memória de cálculo.</span></section><section className="public-feature-grid"><article><Sparkles /><h2>Simulação orientada</h2><p>Estruture premissas e compare cenários sem depender de planilhas dispersas.</p></article><article><Scale /><h2>Comparação de regimes</h2><p>Visualize diferenças entre alternativas tributárias com critérios consistentes.</p></article><article><BookOpen /><h2>Base técnica</h2><p>Entenda as premissas utilizadas e preserve rastreabilidade para revisão profissional.</p></article></section></PublicShell>

  if (path === "/simulador-reforma-tributaria") return <PublicShell path={path}><section className="public-hero"><p>SIMULADOR DA REFORMA TRIBUTÁRIA</p><h1>Compare cenários de IBS e CBS de 2027 a 2033.</h1><span>Modele receitas, custos, folha e premissas para visualizar impactos da transição e comparar alternativas com rastreabilidade.</span><div className="public-hero-actions"><a href="/?demo=1">Testar demonstração<ArrowRight size={17} /></a><a href="/planos">Ver planos</a></div></section><section className="public-feature-grid"><article><Check /><h2>Simples e regime híbrido</h2><p>Compare cenários de forma consistente e veja a diferença mensal estimada.</p></article><article><Scale /><h2>IBS e CBS</h2><p>Acompanhe a composição da carga ao longo da transição prevista entre 2027 e 2033.</p></article><article><BookOpen /><h2>Memória de cálculo</h2><p>Preserve as premissas usadas para revisar o cenário com sua equipe técnica.</p></article></section></PublicShell>

  if (path === "/reforma-tributaria") return <PublicShell path={path}><section className="public-hero compact"><p>REFORMA TRIBUTÁRIA</p><h1>IBS, CBS e transição: transforme regras em cenários comparáveis.</h1><span>A mudança tributária exige leitura de premissas, períodos e estrutura operacional. O Tributo Leve organiza essa análise para que a comparação não dependa de cálculos espalhados.</span></section><article className="public-article"><h2>O que o simulador ajuda a organizar</h2><p>Receita, folha, custos, créditos, regime atual e evolução anual podem ser reunidos em um mesmo cenário. O objetivo é tornar mais clara a diferença entre alternativas e permitir revisão posterior.</p><h2>Por que acompanhar ano a ano</h2><p>A transição não acontece de uma vez. Uma visão anual ajuda a observar mudanças de composição e evita tratar 2027, 2028 ou 2033 como se fossem o mesmo ambiente tributário.</p><h2>Use como apoio, não como parecer</h2><p>Simulações dependem das informações inseridas e das premissas adotadas. A decisão definitiva deve considerar legislação aplicável, particularidades da empresa e validação profissional.</p><a className="public-inline-cta" href="/simulador-reforma-tributaria">Conhecer o simulador<ArrowRight size={17} /></a></article></PublicShell>

  if (path === "/planos") return <PublicShell path={path}><section className="public-hero compact"><p>PLANOS</p><h1>Uma estrutura para cada fase da operação.</h1><span>Comece enxuto, ganhe escala conforme a carteira cresce ou escolha o pacote trimestral com melhor custo mensal equivalente.</span></section><Pricing plans={publicPlans} title="Planos Tributo Leve" description="Compare recursos e escolha a estrutura que faz sentido para sua rotina." onSelect={() => { location.href = "/" }} actionLabel={(plan) => `Escolher ${plan.name}`} /></PublicShell>

  if (path === "/faq") return <PublicShell path={path}><section className="public-hero compact"><p>PERGUNTAS FREQUENTES</p><h1>Respostas diretas antes de você começar.</h1><span>Planos, pagamentos, cancelamento, segurança, dados e uso do simulador.</span></section><section className="faq-list">{faqItems.map(([question, answer]) => <details key={question}><summary>{question}</summary><p>{answer}</p></details>)}</section></PublicShell>

  if (path === "/privacidade") return <PublicShell path={path}><LegalPage title="Política de Privacidade" intro="Esta política resume como dados pessoais são tratados no Tributo Leve." sections={[
    ["Dados tratados", "Dados de cadastro, identificação do pagador, informações de empresas e cenários inseridos pelo usuário, registros técnicos de segurança e informações de pagamento retornadas pelo Mercado Pago. O Tributo Leve não armazena número completo de cartão nem CVV."],
    ["Finalidades", "Autenticar usuários, executar o serviço contratado, processar pagamentos, prevenir fraudes, manter segurança, prestar suporte, cumprir obrigações legais e, somente com consentimento, medir uso agregado com Google Analytics."],
    ["Compartilhamento", "O serviço utiliza provedores necessários à operação, como Supabase, Netlify e Mercado Pago. Google Analytics só é carregado quando o visitante autoriza cookies analíticos."],
    ["Retenção e segurança", "Dados são mantidos pelo período necessário à prestação do serviço, obrigações legais e defesa de direitos. O acesso administrativo é restrito e operações sensíveis são executadas no servidor."],
    ["Seus direitos", "Você pode solicitar confirmação, acesso, correção, portabilidade quando aplicável, eliminação de dados tratados com consentimento e outras medidas previstas na LGPD."],
  ]} /></PublicShell>

  if (path === "/lgpd") return <PublicShell path={path}><LegalPage title="LGPD no Tributo Leve" intro="Privacidade é tratada como requisito de produto, não como um aviso isolado." sections={[
    ["Princípios aplicados", "Necessidade, finalidade, transparência, segurança e minimização orientam o desenho do produto. Apenas dados necessários à execução do serviço e à proteção da operação devem ser coletados."],
    ["Bases de tratamento", "A execução do contrato sustenta os dados necessários ao serviço; obrigações legais podem exigir retenção específica; segurança e prevenção a fraude atendem interesses legítimos e deveres de proteção; métricas opcionais dependem de consentimento."],
    ["Cookies e Analytics", "Cookies necessários permanecem ativos para autenticação e segurança. Google Analytics é opcional e segue a escolha registrada no centro de privacidade."],
    ["Direitos do titular", "Solicitações relacionadas aos direitos previstos na LGPD podem ser encaminhadas pelo canal público indicado no rodapé e na área de segurança/privacidade."],
    ["Pagamentos", "Dados sensíveis de cartão são tokenizados pelo Mercado Pago. O Tributo Leve recebe somente informações necessárias para conciliação, como status, bandeira e últimos dígitos quando disponibilizados."],
  ]} /></PublicShell>

  if (path === "/termos") return <PublicShell path={path}><LegalPage title="Termos de Uso" intro="Condições gerais de uso da plataforma Tributo Leve." sections={[
    ["Finalidade", "O Tributo Leve é uma ferramenta de apoio à simulação tributária. Os resultados dependem das informações fornecidas pelo usuário e não constituem parecer contábil, fiscal ou jurídico."],
    ["Conta e credenciais", "A conta é pessoal. O usuário deve manter suas credenciais em sigilo e comunicar qualquer suspeita de uso não autorizado. Senhas são gerenciadas pelo Supabase Auth e não ficam armazenadas em texto puro no banco da aplicação."],
    ["Assinaturas", "Planos pagos liberam recursos conforme vigência e limites contratados. Assinaturas recorrentes podem ser canceladas pelo titular; o cancelamento impede novas cobranças e preserva o período já pago até o vencimento."],
    ["Uso aceitável", "É proibido tentar contornar limites, explorar vulnerabilidades, acessar dados de terceiros, automatizar abuso de endpoints ou utilizar o serviço para finalidade ilícita."],
    ["Disponibilidade", "Manutenções, indisponibilidades de terceiros e mudanças regulatórias podem exigir ajustes. O produto é atualizado para preservar consistência e segurança."],
  ]} /></PublicShell>

  if (path === "/seguranca") return <PublicShell path={path}><LegalPage title="Segurança e divulgação responsável" intro="Encontrou um problema de segurança? Ajude a proteger os usuários reportando de forma responsável." sections={[
    ["Como reportar", publicContact ? `Envie uma descrição objetiva para ${publicContact}. Não inclua senhas, chaves privadas ou dados pessoais de terceiros além do estritamente necessário para reproduzir o problema.` : "Use o canal oficial de contato disponibilizado pelo Tributo Leve. Não publique detalhes exploráveis antes da correção e não inclua dados pessoais de terceiros no relatório."],
    ["Escopo", "Aplicação web, autenticação, APIs próprias e integrações sob controle do Tributo Leve. Sistemas de terceiros devem seguir os canais de divulgação dos respectivos fornecedores."],
    ["Boas práticas", "Não acesse dados de terceiros, não realize engenharia social, não provoque indisponibilidade e não execute testes destrutivos. Forneça passos de reprodução e impacto observado."],
    ["Camadas", "Rotas autenticadas validam o JWT e, em seguida, a autorização de recurso ou papel no servidor. Rotas públicas de cadastro usam rate limit e proteção anti-bot; webhooks usam assinatura HMAC e idempotência."],
    ["security.txt", "O arquivo padronizado está disponível em /.well-known/security.txt e aponta para esta política como canal canônico."],
  ]} /></PublicShell>

  return <NotFoundPage />
}

function LegalPage({ title, intro, sections }: { title: string; intro: string; sections: [string,string][] }) {
  return <article className="legal-page"><header><ShieldCheck /><div><h1>{title}</h1><p>{intro}</p><small>Última atualização: 4 de setembro de 2026</small></div></header>{sections.map(([heading, body]) => <section key={heading}><h2>{heading}</h2><p>{body}</p></section>)}</article>
}

export function NotFoundPage() {
  usePublicMeta(location.pathname, true)
  return <div className="not-found-page"><motion.div className="not-found-card" initial={{ opacity: 0, y: 26 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .55 }}><div className="not-found-code"><motion.span initial={{ x: -32, opacity: 0 }} animate={{ x: 0, opacity: .74 }}>4</motion.span><motion.div animate={{ y: [-6, 6, -6], rotate: [-2, 2, -2] }} transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}><Ghost aria-hidden="true" /></motion.div><motion.span initial={{ x: 32, opacity: 0 }} animate={{ x: 0, opacity: .74 }}>4</motion.span></div><h1>Essa página virou fantasma.</h1><p>O endereço não existe, foi movido ou deixou de estar disponível.</p><div className="not-found-actions"><button type="button" onClick={() => navigate("/")}>Voltar ao início<ArrowRight /></button><a href="/simulador-reforma-tributaria">Conhecer o simulador</a></div><a className="not-found-help" href="https://developer.mozilla.org/pt-BR/docs/Web/HTTP/Reference/Status/404" target="_blank" rel="noreferrer">O que significa erro 404?</a></motion.div></div>
}

export function isPublicContentPath(path: string) {
  return ["/sobre", "/planos", "/simulador-reforma-tributaria", "/reforma-tributaria", "/faq", "/privacidade", "/lgpd", "/termos", "/seguranca"].includes(canonicalPublicPath(path))
}
