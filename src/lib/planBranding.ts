export type PlanBranding = {
  name: string
  badge: string
  shortDescription: string
  features: string[]
  recommended: boolean
}

const BRANDING: Record<string, PlanBranding> = {
  "basico-mensal": {
    name: "Leve Start",
    badge: "IDEAL PARA COMEÇAR",
    shortDescription: "Para quem está começando e quer simular com segurança. Inclui 1 CNPJ, comparação de regimes, transição 2027–2033 e memória de cálculo.",
    features: ["1 CNPJ", "Simulador tributário completo", "Comparação de regimes", "Transição 2027–2033", "Memória de cálculo", "Módulos opcionais à parte"],
    recommended: false,
  },
  "pro-mensal": {
    name: "Leve Pro",
    badge: "PARA QUEM ESTÁ CRESCENDO",
    shortDescription: "Para profissionais e escritórios que atendem mais de uma empresa. Amplia para até 4 CNPJs e organiza clientes e cenários em uma carteira única.",
    features: ["Até 4 CNPJs", "Tudo do Leve Start", "Carteira compacta incluída", "Cenários por empresa", "Módulos opcionais à parte"],
    recommended: false,
  },
  "pro-trimestral": {
    name: "Leve Prime",
    badge: "MELHOR CUSTO-BENEFÍCIO",
    shortDescription: "Tudo do Leve Pro por 3 meses, com Relatório Executivo incluído e melhor custo mensal equivalente. Ideal para quem quer previsibilidade e análises mais profissionais.",
    features: ["3 meses de acesso", "Até 4 CNPJs", "Tudo do Leve Pro", "Relatório Executivo incluído", "Melhor custo mensal equivalente"],
    recommended: true,
  },
}

export function planBranding(slug?: string | null, fallbackName = "Plano") {
  return slug && BRANDING[slug] ? BRANDING[slug] : {
    name: fallbackName,
    badge: "PLANO",
    shortDescription: "Plano de acesso ao Tributo Leve.",
    features: [],
    recommended: false,
  }
}

export function displayPlanName(slug?: string | null, fallbackName = "Plano") {
  return planBranding(slug, fallbackName).name
}
