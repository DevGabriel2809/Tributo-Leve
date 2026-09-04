import * as React from "react"
import { FileDown, Save, ShieldCheck, TrendingDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { ReportBranding } from "@/lib/workspace"

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })
const percent = new Intl.NumberFormat("pt-BR", { style: "percent", minimumFractionDigits: 2, maximumFractionDigits: 2 })
const money = (value: number) => currency.format(Number(value) || 0)
const pct = (value: number) => percent.format(Number(value) || 0)

export function ExecutiveReport({ state, results, branding, canEdit = true, onSaveBranding }: { state: any; results: any; branding: ReportBranding; canEdit?: boolean; onSaveBranding: (value: ReportBranding) => Promise<void> }) {
  const [form, setForm] = React.useState<ReportBranding>(branding)
  const [message, setMessage] = React.useState("")
  React.useEffect(() => setForm(branding), [branding])
  const best = results.bestRegime
  const date = new Date().toLocaleDateString("pt-BR")

  async function save() { try { await onSaveBranding(form); setMessage("Identidade do relatório salva.") } catch (cause) { setMessage(cause instanceof Error ? cause.message : "Não foi possível salvar.") } }
  function print() { document.body.classList.add("printing-executive-report"); window.setTimeout(() => { window.print(); window.setTimeout(() => document.body.classList.remove("printing-executive-report"), 800) }, 60) }

  return <div className="executive-report-page">
    <section className="workspace-heading report-controls"><div><p className="kicker">RELATÓRIO EXECUTIVO</p><h1>Documento pronto para apresentar</h1><p>Personalize a assinatura e gere um PDF organizado, com diagnóstico, comparativos, transição e memória técnica.</p></div><Button onClick={print}><FileDown size={17} />Gerar PDF / Imprimir</Button></section>
    <section className="report-branding panel no-print"><div><h2>Identidade do escritório</h2><p>Esses dados aparecem na capa e no rodapé.</p></div><div className="fields-grid two"><label>Escritório / marca<Input disabled={!canEdit} value={form.office_name} onChange={(e) => setForm({ ...form, office_name: e.target.value })} placeholder="Ex.: Andrade Consultoria Tributária" /></label><label>Responsável<Input disabled={!canEdit} value={form.responsible_name} onChange={(e) => setForm({ ...form, responsible_name: e.target.value })} placeholder="Nome do consultor" /></label><label>Contato<Input disabled={!canEdit} value={form.contact_line} onChange={(e) => setForm({ ...form, contact_line: e.target.value })} placeholder="E-mail · telefone · site" /></label><label>Rodapé<Input disabled={!canEdit} value={form.footer_text} onChange={(e) => setForm({ ...form, footer_text: e.target.value })} placeholder="Mensagem ou observação institucional" /></label></div>{canEdit ? <Button onClick={save}><Save size={17} />Salvar identidade</Button> : <p className="readonly-note">Somente o titular ou um Editor pode alterar a identidade do relatório.</p>}{message && <p>{message}</p>}</section>

    <article className="executive-document">
      <section className="report-cover">
        <img src="/tributo-leve-logo-dark.png" alt="Tributo Leve" />
        <div><p>DIAGNÓSTICO TRIBUTÁRIO · {state.year}</p><h1>{state.company.name || "Empresa analisada"}</h1><span>{state.company.cnpj || "CNPJ não informado"}</span></div>
        <footer><strong>{form.office_name || "Tributo Leve"}</strong><span>{form.responsible_name || "Relatório técnico"}</span><small>Emitido em {date}</small></footer>
      </section>
      <section className="report-sheet report-summary"><header><p>01 · RESUMO EXECUTIVO</p><h2>Leitura principal do cenário</h2></header><div className="report-highlight"><span>Regime com menor custo estimado</span><strong>{best?.name || "Aguardando dados"}</strong><em>{best ? money(best.total) + " / mês" : "—"}</em></div><div className="report-summary-grid"><div><span>Receita mensal</span><strong>{money(results.main.totalRevenue)}</strong></div><div><span>RBT12</span><strong>{money(results.main.rbt12)}</strong></div><div><span>Fator R</span><strong>{pct(results.main.factorR)}</strong></div><div><span>Créditos IBS + CBS</span><strong>{money(results.main.ibsCredit + results.main.cbsCredit)}</strong></div></div><div className="report-insight"><TrendingDown /><p>{results.main.difference < 0 ? `No recorte Simples, o modelo híbrido reduz a carga estimada em ${money(Math.abs(results.main.difference))} por mês frente ao Simples Puro.` : results.main.difference > 0 ? `No recorte Simples, o modelo puro reduz a carga estimada em ${money(results.main.difference)} por mês frente ao híbrido.` : "No recorte Simples, os dois modelos apresentam a mesma carga estimada neste cenário."}</p></div></section>
      <section className="report-sheet"><header><p>02 · COMPARAÇÃO</p><h2>Regimes lado a lado</h2></header><table className="report-table"><thead><tr><th>Regime</th><th>Tributos</th><th>Encargos</th><th>Total mensal</th><th>% da receita</th></tr></thead><tbody>{results.regimes.map((item: any) => <tr key={item.name} className={best?.name === item.name ? "best" : ""}><td>{item.name}{best?.name === item.name && <small> MENOR CUSTO</small>}</td><td>{money(item.tax)}</td><td>{money(item.payroll)}</td><td>{money(item.total)}</td><td>{pct(results.main.totalRevenue ? item.total / results.main.totalRevenue : 0)}</td></tr>)}</tbody></table></section>
      <section className="report-sheet"><header><p>03 · TRANSIÇÃO</p><h2>2027 a 2033</h2></header><table className="report-table"><thead><tr><th>Ano</th><th>Simples Puro</th><th>DAS híbrido</th><th>IBS/CBS fora</th><th>Total híbrido</th></tr></thead><tbody>{results.evolution.map((item: any) => <tr key={item.year}><td>{item.year}</td><td>{money(item.pureTotal)}</td><td>{money(item.hybridDas)}</td><td>{money(item.outsideTotal)}</td><td>{money(item.hybridTotal)}</td></tr>)}</tbody></table></section>
      <section className="report-sheet"><header><p>04 · MEMÓRIA TÉCNICA</p><h2>Parâmetros e rastreabilidade</h2></header><div className="report-memory"><div><span>Regime atual</span><strong>{state.company.profile || "Não informado"}</strong></div><div><span>Anexo(s)</span><strong>{results.main.activities.map((a: any) => a.annex).filter(Boolean).join(" + ") || "Pendente"}</strong></div><div><span>DAS bruto</span><strong>{money(results.main.dasGross)}</strong></div><div><span>DAS híbrido</span><strong>{money(results.main.hybridDas)}</strong></div><div><span>Crédito CBS</span><strong>{money(results.main.cbsCredit)}</strong></div><div><span>Crédito IBS</span><strong>{money(results.main.ibsCredit)}</strong></div></div>{results.main.warnings?.length ? <div className="report-warnings"><h3>Pontos de atenção</h3>{results.main.warnings.map((warning: any) => <p key={warning.code}>• {warning.text}</p>)}</div> : <p className="report-ok"><ShieldCheck /> Nenhum alerta crítico foi identificado no preenchimento atual.</p>}</section>
      <footer className="report-footer"><strong>{form.office_name || "Tributo Leve"}</strong><span>{form.contact_line}</span><small>{form.footer_text || "Simulação orientativa baseada nos parâmetros informados. Valide decisões tributárias com profissional habilitado."}</small></footer>
    </article>
  </div>
}
