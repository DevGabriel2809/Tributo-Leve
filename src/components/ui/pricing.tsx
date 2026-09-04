import * as React from "react"
import { Check, Star } from "lucide-react"
import { cn } from "@/lib/utils"

export type PricingPlan = {
  slug: string
  name: string
  badge?: string
  description: string
  priceCents: number
  billingMonths: number
  features: string[]
  isPopular?: boolean
  current?: boolean
  disabled?: boolean
}

type PricingProps = {
  plans: PricingPlan[]
  selectedSlug?: string
  title?: string
  description?: string
  tone?: "light" | "dark"
  actionLabel?: (plan: PricingPlan) => string
  onSelect?: (plan: PricingPlan) => void
}

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })

export function Pricing({
  plans,
  selectedSlug,
  title = "Escolha seu plano",
  description = "Compare os recursos e escolha a opção que acompanha o seu momento.",
  tone = "light",
  actionLabel,
  onSelect,
}: PricingProps) {
  const proMonthly = plans.find((plan) => plan.slug === "pro-mensal")
  const quarterly = plans.find((plan) => plan.slug === "pro-trimestral")
  const quarterlySaving = proMonthly && quarterly
    ? Math.max(0, proMonthly.priceCents * 3 - quarterly.priceCents)
    : 0

  const displayedPlans = React.useMemo(() => {
    if (plans.length !== 3) return plans
    const popular = plans.find((plan) => plan.isPopular)
    if (!popular) return plans
    const others = plans.filter((plan) => plan.slug !== popular.slug)
    return [others[0], popular, others[1]].filter(Boolean) as PricingPlan[]
  }, [plans])

  const showHeader = Boolean(title?.trim() || description?.trim())

  return <section className={cn("pricing-showcase", tone === "dark" && "pricing-showcase-dark")}> 
    {showHeader && <div className="pricing-showcase-head">
      <div>
        {title?.trim() && <h2>{title}</h2>}
        {description?.trim() && <p>{description}</p>}
      </div>
    </div>}

    <div className="pricing-showcase-grid">
      {displayedPlans.map((plan) => {
        const monthlyEquivalent = plan.priceCents / 100 / Math.max(1, plan.billingMonths)
        const selected = selectedSlug === plan.slug
        const showSaving = plan.slug === "pro-trimestral" && quarterlySaving > 0

        return <article
          key={plan.slug}
          className={cn("pricing-card", plan.isPopular && "is-popular", selected && "is-selected", plan.current && "is-current")}
        >
          {plan.isPopular && <div className="pricing-popular"><Star size={13} fill="currentColor" /> Recomendado</div>}
          {plan.current && <div className="pricing-current-badge">Plano atual</div>}

          <h3>{plan.name}</h3>
          <p className="pricing-card-description">{plan.description}</p>

          <div className="pricing-price">
            <strong>{money.format(plan.priceCents / 100)}</strong>
            <span>/ {plan.billingMonths === 1 ? "mês" : `${plan.billingMonths} meses`}</span>
          </div>
          <small className="pricing-equivalent">{plan.billingMonths > 1 ? `${money.format(monthlyEquivalent)}/mês equivalente` : "cobrança mensal"}</small>
          {showSaving && <p className="pricing-plan-saving">Economize <strong>{money.format(quarterlySaving / 100)}</strong> a cada 3 meses</p>}

          <ul>{plan.features.map((feature) => <li key={feature}><Check size={16} /> <span>{feature}</span></li>)}</ul>
          <button
            type="button"
            disabled={plan.disabled || plan.current}
            onClick={() => onSelect?.(plan)}
            className={cn(plan.isPopular && "primary", selected && "selected")}
          >
            {plan.current ? "Seu plano atual" : selected ? "Plano selecionado" : actionLabel?.(plan) || `Escolher ${plan.name}`}
          </button>
        </article>
      })}
    </div>
  </section>
}
