(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.TaxEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const YEARS = [2027, 2028, 2029, 2030, 2031, 2032, 2033];
  const IBS_MIGRATION = { 2027: 1, 2028: 1, 2029: .1, 2030: .2, 2031: .3, 2032: .4, 2033: 1 };
  const DEFAULT_COSTS = [
    ['Compra de mercadorias / insumos para revenda ou industrialização', 'Mercadoria/Insumo'],
    ['Energia elétrica', 'Despesa'], ['Água e esgoto', 'Despesa'], ['Aluguel do imóvel comercial', 'Despesa'],
    ['Serviços de contabilidade', 'Despesa'], ['Telefone / internet', 'Despesa'],
    ['Frete e transporte (insumos/mercadorias)', 'Despesa'], ['Combustível / manutenção de veículos', 'Despesa'],
    ['Material de escritório / limpeza', 'Despesa'], ['Outro item 1', 'Despesa'], ['Outro item 2', 'Despesa'], ['Outro item 3', 'Despesa']
  ].map(([description, category]) => ({ description, category, value: 0, specialRegime: 'Regime Normal (alíquota cheia)', generatesCredit: true }));

  function n(value) {
    const parsed = typeof value === 'string' ? Number(value.replace(/\./g, '').replace(',', '.')) : Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  function clamp(value, min, max) { return Math.min(max, Math.max(min, n(value))); }
  function round(value, digits = 2) { const p = 10 ** digits; return Math.round((n(value) + Number.EPSILON) * p) / p; }
  function sum(values) { return values.reduce((total, value) => total + n(value), 0); }
  function byName(list, name) { return list.find(item => item.name === name); }
  function getCnae(data, codeOrLabel) {
    const clean = String(codeOrLabel || '').replace(/\D/g, '');
    return data.cnaes.find(item => item.code === clean) || data.cnaes.find(item => item.label === codeOrLabel) || null;
  }
  function getSpecial(data, name) { return byName(data.specialRegimes, name) || data.specialRegimes[0]; }
  function suggestAnnex(cnae, factorR) {
    if (!cnae) return '';
    return cnae.factorR ? (factorR >= .28 ? cnae.highAnnex : cnae.lowAnnex) : cnae.fixedAnnex;
  }
  function bandFor(rbt12) {
    const value = n(rbt12);
    if (value <= 180000) return 1;
    if (value <= 360000) return 2;
    if (value <= 720000) return 3;
    if (value <= 1800000) return 4;
    if (value <= 3600000) return 5;
    return 6;
  }
  function annexRow(data, year, annex, band) {
    return data.annexes.find(row => row.year === n(year) && row.annex === annex && row.band === band) || null;
  }
  function effectiveRate(rbt12, row) {
    if (!row || n(rbt12) <= 0) return 0;
    return Math.max(0, (n(rbt12) * n(row.nominal) - n(row.deduction)) / n(rbt12));
  }
  function defaultState() {
    return {
      company: { name: '', cnpj: '', profile: '' },
      methodology: 'technical',
      year: 2027,
      b2bShare: 0,
      activities: [
        { cnae: '', revenue: 0, specialRegime: 'Regime Normal (alíquota cheia)', annexOverride: '' },
        { cnae: '', revenue: 0, specialRegime: 'Regime Normal (alíquota cheia)', annexOverride: '' }
      ],
      rbt12: 0, rbt12Auto: true,
      payrollMonth: 0, payroll12: 0, payroll12Auto: true,
      costs: DEFAULT_COSTS.map(item => ({ ...item })),
      retainedIcms: 0, retainedIss: 0,
      cbsStockValue: 0, cbsStockInstallment: 1,
      icmsCreditBalance: 0, icmsCreditStartYear: 2033, icmsCreditInstallment: 1,
      payrollCharges: { cpp: .20, rat: 0, fap: 0, thirdParties: 0, other: 0 },
      dre: {
        yearToDateRevenue: 0,
        activityTypes: ['Serviços em geral não listados acima - 32% IRPJ / 32% CSLL', ''],
        localTaxes: ['auto', 'auto'],
        salesRates: [.05, .205], purchaseRates: [0, .205]
      }
    };
  }

  function normalizeState(state) {
    const base = defaultState();
    const src = state || {};
    const activities = [0, 1].map(i => ({ ...base.activities[i], ...(src.activities?.[i] || {}) }));
    const costs = DEFAULT_COSTS.map((item, i) => ({ ...item, ...(src.costs?.[i] || {}) }));
    return {
      ...base, ...src,
      company: { ...base.company, ...(src.company || {}) },
      activities, costs,
      payrollCharges: { ...base.payrollCharges, ...(src.payrollCharges || {}) },
      dre: { ...base.dre, ...(src.dre || {}) }
    };
  }

  function calculateForYear(data, rawState, chosenYear) {
    const state = normalizeState(rawState);
    const year = n(chosenYear || state.year);
    const totalRevenue = sum(state.activities.map(a => a.revenue));
    const rbt12 = state.rbt12Auto ? totalRevenue * 12 : n(state.rbt12);
    const payroll12 = state.payroll12Auto ? n(state.payrollMonth) * 12 : n(state.payroll12);
    const factorR = rbt12 > 0 ? payroll12 / rbt12 : 0;
    const band = bandFor(rbt12);
    const reference = data.referenceRates[String(year)] || { cbs: 0, ibs: 0 };
    const migration = IBS_MIGRATION[year] ?? 0;
    const activities = state.activities.map((activity, index) => {
      const cnae = getCnae(data, activity.cnae);
      const suggestedAnnex = suggestAnnex(cnae, factorR);
      const annex = activity.annexOverride || suggestedAnnex;
      const row = annexRow(data, year, annex, band);
      const rate = effectiveRate(rbt12, row);
      const revenue = n(activity.revenue);
      const das = revenue * rate;
      const special = getSpecial(data, activity.specialRegime);
      return { index, ...activity, cnaeData: cnae, suggestedAnnex, annex, band, row, effectiveRate: rate, revenue, das, special, reduction: n(special?.reduction) };
    });

    const dasGross = sum(activities.map(a => a.das));
    const distribution = { irpj: 0, csll: 0, cpp: 0, ipi: 0, icms: 0, iss: 0, cbs: 0, ibs: 0 };
    activities.forEach(a => {
      const dist = a.row?.distribution || {};
      distribution.irpj += a.das * n(dist.irpj);
      distribution.csll += a.das * n(dist.csll);
      distribution.cpp += a.das * n(dist.cpp);
      distribution.ipi += a.das * n(dist.ipi);
      distribution.cbs += a.das * n(dist.cbs);
      distribution.ibs += a.das * n(dist.ibs);
      if (['I', 'II'].includes(a.annex)) distribution.icms += a.das * n(dist.icmsIss);
      if (['III', 'IV', 'V'].includes(a.annex)) distribution.iss += a.das * n(dist.icmsIss);
    });
    const icmsDeduction = Math.min(distribution.icms, n(state.retainedIcms));
    const issDeduction = Math.min(distribution.iss, n(state.retainedIss));
    const dasAdjusted = Math.max(0, dasGross - icmsDeduction - issDeduction);

    const costLines = state.costs.map(cost => {
      const special = getSpecial(data, cost.specialRegime);
      const reduction = n(special?.reduction);
      const cbsRate = n(reference.cbs) * (1 - reduction);
      const ibsRate = n(reference.ibs) * (1 - reduction);
      return { ...cost, reduction, cbsRate, ibsRate,
        cbsCredit: cost.generatesCredit ? n(cost.value) * cbsRate : 0,
        ibsCredit: cost.generatesCredit ? n(cost.value) * ibsRate : 0 };
    });
    const totalCosts = sum(costLines.map(c => c.value));
    const merchandiseCosts = sum(costLines.filter(c => c.category === 'Mercadoria/Insumo').map(c => c.value));
    const operatingExpenses = sum(costLines.filter(c => c.category === 'Despesa').map(c => c.value));
    const cbsCostCredit = sum(costLines.map(c => c.cbsCredit));
    const ibsCostCredit = sum(costLines.map(c => c.ibsCredit));
    const cbsStockCredit = year === 2027 && n(state.cbsStockInstallment) >= 1 && n(state.cbsStockInstallment) <= 12 ? n(state.cbsStockValue) * .0925 / 12 : 0;
    const icmsTransitionCredit = year >= n(state.icmsCreditStartYear) && n(state.icmsCreditInstallment) >= 1 && n(state.icmsCreditInstallment) <= 240 ? n(state.icmsCreditBalance) / 240 : 0;

    // The workbook applies the migration percentage a second time to IBS. Technical mode
    // treats the year-specific reference rate as already transitioned and removes all IBS from DAS.
    const spreadsheetCompatible = state.methodology === 'spreadsheet';
    const ibsOutsideFactor = spreadsheetCompatible ? migration : 1;
    const ibsDasRemovalFactor = spreadsheetCompatible ? migration : 1;
    const cbsDebit = sum(activities.map(a => a.revenue * n(reference.cbs) * (1 - a.reduction)));
    const ibsDebit = sum(activities.map(a => a.revenue * n(reference.ibs) * (1 - a.reduction))) * ibsOutsideFactor;
    const cbsCredit = cbsCostCredit + cbsStockCredit;
    const ibsCredit = ibsCostCredit * ibsOutsideFactor + icmsTransitionCredit;
    const cbsOutside = Math.max(0, cbsDebit - cbsCredit);
    const ibsOutside = Math.max(0, ibsDebit - ibsCredit);
    const outsideTotal = cbsOutside + ibsOutside;
    const hybridDas = Math.max(0, dasAdjusted - distribution.cbs - distribution.ibs * ibsDasRemovalFactor);
    const pureTotal = dasAdjusted;
    const hybridTotal = hybridDas + outsideTotal;
    const difference = hybridTotal - pureTotal;
    const differencePct = pureTotal ? difference / pureTotal : 0;
    const winner = hybridTotal < pureTotal ? 'Híbrido' : hybridTotal > pureTotal ? 'Puro' : 'Empate';

    const payrollRate = n(state.payrollCharges.cpp) + n(state.payrollCharges.rat) * n(state.payrollCharges.fap) + n(state.payrollCharges.thirdParties) + n(state.payrollCharges.other);
    const payrollOutside = n(state.payrollMonth) * payrollRate;
    const simplePayrollOutside = activities.some(a => a.annex === 'IV') ? payrollOutside : 0;
    const marginPure = totalRevenue - totalCosts - pureTotal - simplePayrollOutside;
    const marginHybrid = totalRevenue - totalCosts - hybridTotal - simplePayrollOutside;

    const warnings = [];
    if (rbt12 > 4800000) warnings.push({ level: 'danger', code: 'SIMPLES_LIMIT', text: 'RBT12 acima de R$ 4,8 milhões: a empresa excede o limite geral do Simples Nacional.' });
    else if (rbt12 > 3600000) warnings.push({ level: 'warning', code: 'SUBLIMIT', text: 'RBT12 acima do sublimite de R$ 3,6 milhões: IBS/ICMS/ISS exigem tratamento fora do DAS.' });
    if (!activities[0].annex) warnings.push({ level: 'danger', code: 'ANNEX_1', text: 'Não foi possível determinar o Anexo da atividade principal.' });
    if (activities[1].revenue > 0 && !activities[1].annex) warnings.push({ level: 'danger', code: 'ANNEX_2', text: 'Não foi possível determinar o Anexo da atividade secundária.' });
    activities.forEach((a, i) => {
      if (a.annexOverride && a.suggestedAnnex && a.annexOverride !== a.suggestedAnnex) warnings.push({ level: 'warning', code: `OVERRIDE_${i + 1}`, text: `Atividade ${i + 1}: Anexo ${a.annexOverride} foi fixado manualmente; a sugestão atual é ${a.suggestedAnnex}.` });
      if (a.special?.risk === 'ALTO') warnings.push({ level: 'warning', code: `SPECIAL_${i + 1}`, text: `Atividade ${i + 1}: regime especial com alto risco de classificação; valide NCM/NBS e requisitos legais.` });
    });
    if (n(state.payrollCharges.rat) === 0 || n(state.payrollCharges.fap) === 0 || n(state.payrollCharges.thirdParties) === 0) warnings.push({ level: 'info', code: 'PAYROLL_PARAMS', text: 'RAT, FAP ou Terceiros ainda estão zerados; o comparativo dos quatro regimes pode ficar subestimado.' });
    if (spreadsheetCompatible && year >= 2029 && year <= 2032) warnings.push({ level: 'info', code: 'DOUBLE_RAMP', text: 'Modo fiel à planilha: o cronograma do IBS é aplicado sobre uma alíquota anual já escalonada. Use o modo técnico para eliminar essa dupla rampa.' });
    if (spreadsheetCompatible) warnings.push({ level: 'info', code: 'DOUBLE_PAYROLL', text: 'Modo fiel à planilha: o comparativo de quatro regimes soma novamente os encargos que a DRE já inclui. O modo técnico contabiliza a folha uma única vez.' });
    if (spreadsheetCompatible) warnings.push({ level: 'info', code: 'REAL_IBS_BASE', text: 'Modo fiel à planilha: a DRE do Lucro Real deduz CBS da receita operacional, mas não deduz o débito de IBS. O modo técnico trata ambos de forma simétrica.' });

    return { state, year, totalRevenue, rbt12, payroll12, factorR, band, reference, migration, activities,
      distribution, dasGross, icmsDeduction, issDeduction, dasAdjusted,
      costLines, totalCosts, merchandiseCosts, operatingExpenses, cbsCostCredit, ibsCostCredit, cbsStockCredit, icmsTransitionCredit,
      cbsDebit, ibsDebit, cbsCredit, ibsCredit, cbsOutside, ibsOutside, outsideTotal,
      hybridDas, pureTotal, hybridTotal, difference, differencePct, winner,
      payrollRate, payrollOutside, simplePayrollOutside, marginPure, marginHybrid, warnings };
  }

  function dreActivity(data, name, fallbackAnnex) {
    const found = data.dreActivities.find(item => item.name === name);
    if (found) return found;
    if (fallbackAnnex === 'I') return data.dreActivities[0];
    if (fallbackAnnex === 'II') return data.dreActivities[1];
    return data.dreActivities[data.dreActivities.length - 1];
  }

  function calculateDre(data, rawState, main) {
    const state = normalizeState(rawState);
    const acts = main.activities.map((activity, index) => ({ ...activity, dre: dreActivity(data, state.dre.activityTypes?.[index], activity.annex) }));
    const localKinds = acts.map((a, index) => state.dre.localTaxes?.[index] === 'auto' ? a.dre.localTax : state.dre.localTaxes?.[index]);
    const totalIcmsRevenue = sum(acts.filter((a, index) => localKinds[index] === 'ICMS').map(a => a.revenue));
    const local = acts.map((a, index) => {
      const selected = localKinds[index];
      const saleRate = n(state.dre.salesRates?.[index] ?? (selected === 'ISS' ? .05 : .205));
      const purchaseRate = n(state.dre.purchaseRates?.[index] ?? (selected === 'ISS' ? 0 : .205));
      const debit = a.revenue * saleRate;
      const purchaseBase = state.methodology === 'technical' && totalIcmsRevenue > 0 ? main.merchandiseCosts * a.revenue / totalIcmsRevenue : main.merchandiseCosts;
      const credit = selected === 'ICMS' ? purchaseBase * purchaseRate : 0;
      return { tax: selected, saleRate, purchaseRate, debit, credit, due: Math.max(0, debit - credit) };
    });
    const localTotal = sum(local.map(x => x.due));
    const thresholdMonthly = 5000000 / 12;
    const ytd = n(state.dre.yearToDateRevenue);
    const exceededRevenue = Math.max(0, Math.min(main.totalRevenue, ytd - thresholdMonthly));
    const exceededByActivity = acts.map(a => main.totalRevenue ? exceededRevenue * a.revenue / main.totalRevenue : 0);
    const irpjBase = sum(acts.map((a, i) => (a.revenue - exceededByActivity[i]) * a.dre.irpj + exceededByActivity[i] * a.dre.irpj * 1.1));
    const csllBase = sum(acts.map((a, i) => (a.revenue - exceededByActivity[i]) * a.dre.csll + exceededByActivity[i] * a.dre.csll * 1.1));
    const presumedIrpj = irpjBase * .15 + Math.max(0, irpjBase - 20000) * .10;
    const presumedCsll = csllBase * .09;
    const regularCbsDebit = sum(acts.map(a => a.revenue * n(main.reference.cbs) * (1 - a.reduction)));
    const regularIbsDebit = sum(acts.map(a => a.revenue * n(main.reference.ibs) * (1 - a.reduction)));
    const regularOutside = Math.max(0, regularCbsDebit - main.cbsCostCredit) + Math.max(0, regularIbsDebit - main.ibsCostCredit);
    const presumedTax = localTotal + presumedIrpj + presumedCsll + regularOutside;
    const consumptionTaxForRealProfit = regularCbsDebit + (state.methodology === 'technical' ? regularIbsDebit : 0);
    const realProfit = main.totalRevenue - localTotal - consumptionTaxForRealProfit - main.merchandiseCosts - main.operatingExpenses - n(state.payrollMonth);
    const realIrpj = Math.max(0, realProfit) * .15 + Math.max(0, realProfit - 20000) * .10;
    const realCsll = Math.max(0, realProfit) * .09;
    const realTax = localTotal + realIrpj + realCsll + regularOutside;
    return { acts, local, localTotal, thresholdMonthly, ytd, exceededRevenue, irpjBase, csllBase,
      presumedIrpj, presumedCsll, regularCbsDebit, regularIbsDebit, regularOutside, presumedTax,
      realProfit, realIrpj, realCsll, realTax };
  }

  function calculate(data, rawState) {
    const state = normalizeState(rawState);
    const main = calculateForYear(data, state, state.year);
    const dre = calculateDre(data, state, main);
    if (state.methodology === 'spreadsheet' && dre.local.filter(item => item.tax === 'ICMS').length > 1) {
      main.warnings.push({ level: 'warning', code: 'DOUBLE_ICMS_CREDIT', text: 'Modo fiel à planilha: compras de mercadorias são creditadas integralmente em cada atividade sujeita a ICMS. O modo técnico rateia a base e evita crédito duplicado.' });
    }
    const drePayrollMultiplier = state.methodology === 'spreadsheet' ? 2 : 1;
    const regimes = [
      { name: 'Simples Puro', tax: main.pureTotal, payroll: main.simplePayrollOutside },
      { name: 'Simples Híbrido', tax: main.hybridTotal, payroll: main.simplePayrollOutside },
      { name: 'Lucro Presumido', tax: dre.presumedTax, payroll: main.payrollOutside * drePayrollMultiplier },
      { name: 'Lucro Real', tax: dre.realTax, payroll: main.payrollOutside * drePayrollMultiplier }
    ].map(item => ({ ...item, total: item.tax + item.payroll }));
    const bestRegime = regimes.reduce((best, item) => item.total < best.total ? item : best, regimes[0]);
    const evolution = YEARS.map(year => calculateForYear(data, state, year));
    const b2bRevenue = main.totalRevenue * clamp(state.b2bShare, 0, 1);
    const purePotentialCredit = main.totalRevenue ? (main.distribution.cbs + main.distribution.ibs) * b2bRevenue / main.totalRevenue : 0;
    const hybridPotentialCredit = main.totalRevenue ? (main.cbsDebit + main.ibsDebit) * b2bRevenue / main.totalRevenue : 0;
    const b2b = { revenue: b2bRevenue, b2cRevenue: main.totalRevenue - b2bRevenue, purePotentialCredit, hybridPotentialCredit,
      creditDifference: hybridPotentialCredit - purePotentialCredit,
      profile: state.b2bShare > .5 ? 'Predominância B2B' : state.b2bShare < .5 ? 'Predominância B2C' : 'Perfil equilibrado' };
    return { state, main, dre, regimes, bestRegime, evolution, b2b };
  }

  return { YEARS, IBS_MIGRATION, DEFAULT_COSTS, defaultState, normalizeState, calculate, calculateForYear, bandFor, effectiveRate, suggestAnnex, getCnae, round };
});
