import { assistantKnowledgeCatalog } from "@/lib/assistantKnowledgeCatalog"
export type AssistantSource = { title: string; url: string }
export type AssistantContext = {
  page?: string
  step?: number
  year?: number
  companyName?: string
  totalRevenue?: number
  pureTotal?: number
  hybridTotal?: number
  hybridDas?: number
  outsideTotal?: number
  cbsCredit?: number
  ibsCredit?: number
  factorR?: number
  bestRegime?: string
  bestRegimeTotal?: number
  warnings?: string[]
}
export type AssistantArticle = {
  keys: string[]
  title: string
  answer: string
  sourceIds?: string[]
  priority?: number
}
export type AssistantAction =
  | { type: "install_app"; label: string }
  | { type: "navigate"; label: string; page: string; step?: number }
export type AssistantAnswer = { title: string; answer: string; sources: AssistantSource[]; action?: AssistantAction; suggestions?: string[] }

export const assistantSources: Record<string, AssistantSource> = {
  rfbEntenda: { title: "Receita Federal — Entenda a Reforma Tributária do Consumo", url: "https://www.gov.br/receitafederal/pt-br/acesso-a-informacao/acoes-e-programas/programas-e-atividades/reforma-tributaria-do-consumo/entenda" },
  rfb2026: { title: "Receita Federal — Orientações da Reforma Tributária para 2026", url: "https://www.gov.br/receitafederal/pt-br/acesso-a-informacao/acoes-e-programas/programas-e-atividades/reforma-tributaria-do-consumo/orientacoes-2026" },
  rfbLeg: { title: "Receita Federal — Legislação da Reforma Tributária do Consumo", url: "https://www.gov.br/receitafederal/pt-br/acesso-a-informacao/acoes-e-programas/programas-e-atividades/reforma-tributaria-do-consumo/legislacao/legislacao-da-reforma-tributaria-do-consumo" },
  simples2027: { title: "Receita Federal — Opção do Simples e IBS/CBS para 2027", url: "https://www.gov.br/receitafederal/pt-br/assuntos/noticias/2026/setembro/receita-federal-alerta-comeca-hoje-o-prazo-para-opcao-pelo-simples-nacional-e-para-a-escolha-do-modelo-de-recolhimento-do-ibs-e-da-cbs-em-2027/" },
  cgsn: { title: "Ministério da Fazenda — CGSN adapta o Simples Nacional à Reforma", url: "https://www.gov.br/fazenda/pt-br/assuntos/noticias/2026/agosto/cgsn-atualiza-regras-do-simples-nacional-para-adequacao-a-reforma-tributaria-do-consumo" },
  dfe: { title: "Ministério da Fazenda — Cronograma dos documentos fiscais eletrônicos", url: "https://www.gov.br/fazenda/pt-br/assuntos/noticias/2026/julho/receita-federal-e-comite-gestor-do-ibs-publicam-o-cronograma-de-implementacao-dos-documentos-fiscais-eletronicos-da-reforma-tributaria-do-consumo" },
  conformidade: { title: "Receita Federal/CGIBS — Programa Nacional de Conformidade 2026", url: "https://www.gov.br/receitafederal/pt-br/assuntos/noticias/2026/agosto/receita-federal-e-cgibs-regulamentam-programa-nacional-de-conformidade-tributaria-para-apoiar-adaptacao-a-reforma-tributaria-no-ano-de-2026" },
  credito: { title: "Receita Federal — Crédito integral e pagamentos mais seguros", url: "https://www.gov.br/receitafederal/pt-br/acesso-a-informacao/acoes-e-programas/programas-e-atividades/reforma-tributaria-do-consumo/video-rtc-credito" },
  rtcPortal: { title: "Receita Federal — Programa da Reforma Tributária do Consumo", url: "https://www.gov.br/receitafederal/pt-br/acesso-a-informacao/acoes-e-programas/programas-e-atividades/reforma-tributaria-do-consumo/rtc2026" },
  nfse: { title: "Receita Federal — NFS-e Nacional no Simples", url: "https://www.gov.br/receitafederal/pt-br/assuntos/noticias/2026/agosto/simples-nacional-nfs-e-nacional-sera-obrigatoria-para-me-e-epp-a-partir-de-1o-de-novembro-de-2026" },
  rfbPortal: { title: "Receita Federal — Portal da Reforma Tributária do Consumo", url: "https://www.gov.br/receitafederal/pt-br/acesso-a-informacao/acoes-e-programas/programas-e-atividades/reforma-tributaria-do-consumo/rtc2026" },
  rfbPresentations: { title: "Receita Federal — Apresentações da Reforma Tributária do Consumo", url: "https://www.gov.br/receitafederal/pt-br/centrais-de-conteudo/publicacoes/apresentacoes/reforma-tributaria-do-consumo" },
  rfbQuestions: { title: "Receita Federal — Perguntas e Respostas", url: "https://www.gov.br/receitafederal/pt-br/centrais-de-conteudo/publicacoes/perguntas-e-respostas" },
  rfbCourse: { title: "Receita Federal — Curso Reforma Tributária do Consumo", url: "https://www.gov.br/receitafederal/pt-br/acesso-a-informacao/acoes-e-programas/programas-e-atividades/reforma-tributaria-do-consumo/curso/curso-reforma-tributaria-do-consumo" }
}

const A = (keys: string[], title: string, answer: string, sourceIds: string[] = [], priority = 0): AssistantArticle => ({ keys, title, answer, sourceIds, priority })

export const assistantArticles: AssistantArticle[] = [
  // COMO USAR O TRIBUTO LEVE

  A(["plano basico", "básico mensal", "basico mensal", "leve start"], "Leve Start", "O Leve Start libera o simulador completo para 1 CNPJ. Os módulos Carteira de clientes, Relatório Executivo e Equipe podem ser adquiridos separadamente."),
  A(["leve pro", "plano leve pro"], "Leve Pro", "O Leve Pro libera o simulador completo e uma carteira compacta para até 4 CNPJs. O módulo Carteira de clientes continua disponível para expandir a operação até 100 CNPJs."),
  A(["leve prime", "plano trimestral", "trimestral"], "Leve Prime", "O Leve Prime libera 3 meses de acesso, até 4 CNPJs e inclui o Relatório Executivo durante a vigência do plano."),
  A(["demo", "demonstração", "demonstracao", "testar antes", "teste gratis", "teste grátis"], "Demonstração gratuita", "Na tela de entrada, use 'Testar demonstração gratuita'. Você pode testar Simular e Comparar sem criar conta. A demonstração não salva dados e mantém Transição, Cenários, Carteira, Relatório, Equipe, Assistente e Base técnica reservados para contas assinantes."),
  A(["renovar", "renovação", "renovacao", "vence plano", "expira plano"], "Renovação do acesso", "Os planos têm vigência definida: 1 mês no Leve Start e Leve Pro, e 3 meses no Leve Prime. Ao fim do período, o Tributo Leve solicita uma nova cobrança por PIX ou boleto para renovar."),
  A(["cnpj", "onde cnpj", "informar cnpj", "colocar cnpj"], "Onde informar o CNPJ", "No simulador, abra Simular > etapa Perfil. O campo CNPJ é opcional e fica junto dos dados da empresa. Você pode concluir a simulação sem CNPJ; ele serve para identificar o cenário e relatórios."),
  A(["nome empresa", "nome do cenário", "nome do cenario"], "Nome da empresa ou do cenário", "Na etapa Perfil, use o campo Nome da empresa ou cenário. Esse nome aparece no topo, nos cenários salvos e ajuda a organizar relatórios."),
  A(["cnae", "atividade principal", "atividade secundaria", "atividade secundária"], "CNAE e atividades", "Na etapa Perfil, informe o CNAE ou pesquise pela descrição. O Tributo Leve usa a classificação cadastrada para sugerir Anexo, avaliar Fator R e aplicar regras do cenário. A atividade secundária pode ser preenchida separadamente quando houver duas receitas."),
  A(["anexo manual", "trocar anexo", "anexo opcional"], "Anexo automático e ajuste manual", "O Tributo Leve tenta identificar o Anexo a partir do CNAE e do Fator R. Se você precisar reproduzir uma situação específica, use o campo de Anexo manual na etapa Perfil; deixe vazio para manter a classificação automática."),
  A(["receita mensal", "faturamento", "receita atividade"], "Onde informar a receita", "Abra Simular > Apuração. Informe a receita mensal da atividade principal e, se houver, da secundária. Esses valores alimentam o DAS, IBS/CBS, comparativos e margens."),
  A(["folha", "folha salarial", "fs12"], "Folha salarial", "A folha é informada na etapa Apuração e influencia o Fator R e os encargos. Para atividades sujeitas ao Fator R, confira se a folha usada representa corretamente o período exigido pela regra aplicável."),
  A(["fator r", "28%", "anexo iii", "anexo v"], "Fator R", "O Fator R relaciona folha e receita acumuladas. Em atividades sujeitas a essa regra, atingir o patamar aplicável pode alterar o enquadramento entre Anexo III e Anexo V. O Tributo Leve mostra o percentual calculado e o Anexo usado no cenário."),
  A(["créditos", "creditos", "custos", "item de custo", "adicionar custo"], "Créditos de IBS e CBS no Tributo Leve", "Na etapa Créditos, cadastre os custos relevantes do período. Começamos com poucos itens para deixar a tela limpa; use Adicionar outro custo para incluir quantos precisar dentro do limite da simulação. Em cada linha você define categoria, valor, tratamento e se gera crédito."),
  A(["tratamento", "regime especial", "redução", "reducao"], "Tratamento tributário de receitas e custos", "Os seletores Tratamento permitem aplicar os regimes diferenciados/específicos cadastrados na base técnica. Escolha apenas quando a operação realmente se enquadrar; o programa recalcula a carga e os créditos conforme o parâmetro selecionado."),
  A(["gera crédito", "gera credito", "credito estimado"], "Campo 'Gera crédito'", "Use Sim quando a entrada puder gerar crédito no cenário modelado. O valor estimado considera a incidência e o tratamento do item. Marcar Sim não substitui a validação documental e jurídica da apropriação do crédito."),
  A(["ajustes", "rat", "fap", "terceiros", "cpp", "encargos"], "Ajustes e encargos", "A etapa Ajustes concentra parâmetros finais como RAT, FAP, Terceiros, CPP e retenções. Esses campos são especialmente importantes na comparação entre Simples, Lucro Presumido e Lucro Real, porque alteram o custo total de folha e tributos."),
  A(["icms retido", "iss retido", "retenção", "retencao"], "Retenções", "Na etapa Ajustes você pode informar ICMS e ISS retidos quando fizer sentido para o cenário. O objetivo é evitar comparar regimes usando uma carga que ignora valores já retidos ou tratados de forma específica."),
  A(["estoque 31/12/2026", "estoque transição", "credito transição", "crédito transição"], "Créditos de transição", "O Tributo Leve possui campos para estoque em 31/12/2026, parcela de CBS e saldo credor de ICMS. Eles servem para modelar efeitos de transição previstos na metodologia do simulador; confira a documentação e o tratamento legal aplicável antes de usar em decisão definitiva."),
  A(["simples puro", "o que é puro", "simples normal"], "Simples Puro", "No Tributo Leve, Simples Puro representa o cenário em que a empresa permanece no Simples com os tributos tratados dentro do regime conforme a parametrização do ano. Ele é comparado diretamente com o cenário híbrido."),
  A(["simples híbrido", "simples hibrido", "híbrido", "hibrido"], "Simples Nacional com IBS/CBS no regime regular", "O cenário híbrido mantém a empresa no Simples, mas recolhe IBS e CBS pelo regime regular, fora do DAS, quando a opção for juridicamente aplicável. O Tributo Leve separa DAS híbrido, IBS/CBS fora do DAS e créditos para permitir a comparação." , ["cgsn","simples2027"]),
  A(["comparar", "comparação", "comparacao", "quatro regimes"], "Comparação dos quatro regimes", "Abra Comparar para ver Simples Puro, Simples Híbrido, Lucro Presumido e Lucro Real lado a lado. Os cards mostram custo total, tributos, encargos e percentual da receita. O menor valor do cenário é destacado, mas a decisão deve considerar requisitos e efeitos que não são apenas numéricos."),
  A(["lucro presumido", "presumido"], "Lucro Presumido no comparativo", "O Tributo Leve estima a carga do Lucro Presumido usando as premissas parametrizadas de IRPJ, CSLL, tributos locais, IBS/CBS e encargos. Use a memória de cálculo para conferir a composição antes de comparar com o Simples."),
  A(["lucro real", "real"], "Lucro Real no comparativo", "O Lucro Real aparece como um dos quatro regimes comparáveis. Como ele depende fortemente de custos, despesas, créditos e resultado efetivo, preencha os dados do cenário com cuidado e trate a saída como simulação, não como apuração fiscal oficial."),
  A(["melhor regime", "qual compensa", "qual é melhor", "menor custo"], "Como interpretar o melhor regime", "O Tributo Leve destaca o regime de menor custo dentro das premissas informadas. Isso é um resultado matemático do cenário, não uma recomendação automática: elegibilidade, obrigações acessórias, riscos, créditos, perfil B2B/B2C e estratégia comercial podem mudar a decisão."),
  A(["memória", "memoria", "memória de cálculo", "rastreabilidade"], "Memória de cálculo", "Na tela de comparação, expanda Memória de cálculo. Ela mostra RBT12, faixa, Fator R, Anexo, DAS, débitos e créditos de IBS/CBS e componentes do Lucro Presumido. É a área indicada para auditar de onde veio cada total."),
  A(["salvar", "cenário salvo", "cenario salvo", "histórico"], "Salvar e retomar cenários", "Use Salvar no topo. O cenário é salvo no workspace da sua conta e pode ser reaberto em Cenários também em outro dispositivo. Na demonstração gratuita, os dados não são persistidos."),
  A(["relatório", "relatorio", "pdf", "imprimir"], "Relatório", "Use Relatório no topo para abrir a impressão do navegador e salvar em PDF. Antes, confira o nome do cenário, ano, receitas e parâmetros para que a memória de cálculo represente exatamente a simulação desejada."),
  A(["base técnica", "base tecnica", "cnae pesquisar", "referências técnicas"], "Base técnica", "Abra Base técnica para consultar CNAEs, Anexo, Fator R, regimes especiais e alertas do cenário. A tela também mostra indicadores da auditoria da planilha que originou a parametrização."),
  A(["alerta", "avisos", "warning", "ponto de atenção"], "Alertas do cenário", "Os avisos em Base técnica apontam dados ausentes ou premissas que podem subestimar o comparativo, como parâmetros de folha zerados. Resolva os alertas relevantes antes de usar o resultado como suporte de decisão."),
  A(["módulos", "modulos", "comprar módulo", "comprar modulo"], "Módulos adicionais", "Abra Módulos no menu para ver o catálogo. Os preços são carregados do banco e a compra pode ser feita por PIX ou boleto. Após a confirmação do Mercado Pago, o direito ao módulo é liberado automaticamente."),
  A(["carteira de clientes", "carteira clientes"], "Módulo Carteira de clientes", "No Leve Start a conta fica vinculada a 1 CNPJ; os Leve Pro e Leve Prime permitem até 4. Carteira de clientes libera até 100 CNPJs, uma página própria de carteira, organização por cliente e cenários separados por empresa, com dados salvos no workspace."),
  A(["relatório executivo", "relatorio executivo"], "Módulo Relatório executivo", "Relatório executivo libera um documento próprio com capa, resumo executivo, comparação dos regimes, transição 2027–2033, memória técnica, alertas e identidade do escritório. Ele pode ser impresso ou salvo em PDF."),
  A(["equipe adicional", "colaboradores", "equipe"], "Módulo Equipe adicional", "Equipe adicional libera até 3 colaboradores além do titular. O titular gera um link de convite e escolhe Editor ou Somente consulta. Os colaboradores entram no mesmo workspace e usam a licença e os dados compartilhados da operação."),
  A(["admin", "administração", "administracao", "painel administrador"], "Painel administrativo", "Usuários administradores veem Administração no menu. O painel reúne contas, acessos, receita, pagamentos, preço do plano, preços dos módulos, liberações de teste, bloqueios e exclusão de usuários."),
  A(["ativar usuário", "ativar usuario", "liberar acesso"], "Ativação manual", "No painel Administração, use Ativar manualmente para liberar uma conta sem criar um pagamento. A ação pede justificativa e fica registrada na auditoria."),
  A(["teste", "acesso de teste", "liberar teste"], "Acesso de teste", "Administradores podem liberar acesso de teste pelo painel. O status test_access permite entrar no sistema sem pagamento e deve ser usado para demonstração ou homologação."),
  A(["bloquear", "bloqueio", "bloquear usuário"], "Bloqueio de conta", "Use Bloquear no painel Administração. A conta permanece registrada, mas perde o acesso ao produto até nova liberação administrativa."),
  A(["excluir usuário", "deletar usuário", "apagar usuário", "remover conta"], "Excluir usuário", "No painel Administração, use o ícone de lixeira. A exclusão remove a conta do Supabase Auth e, por cascata, o perfil e dados dependentes do usuário. O sistema preserva a rastreabilidade administrativa sem permitir que você apague a própria conta logada."),
  A(["preço plano", "preco plano", "189,97", "0,01"], "Preço do plano principal", "Em Administração > Valor do plano, altere o valor e salve. O cadastro e a próxima cobrança consultam o preço do banco; assim, mudar para R$ 0,01 também muda a oferta exibida e o valor enviado ao Mercado Pago."),
  A(["preço módulo", "preco modulo", "preços módulos", "precos modulos"], "Preços dos módulos", "Em Administração > Preços dos módulos, cada item do catálogo possui um editor próprio. O novo valor é salvo em products.price_cents e aparece no catálogo de Módulos e na próxima cobrança."),
  A(["pix", "qr code", "copia e cola"], "Pagamento por PIX", "O Tributo Leve cria a cobrança no backend e exibe QR Code e PIX copia e cola quando retornados pelo Mercado Pago. O acesso é liberado apenas quando a confirmação do pagamento chegar e for validada."),
  A(["boleto", "linha digitável", "linha digitavel"], "Pagamento por boleto", "Ao selecionar boleto, o Tributo Leve solicita os dados adicionais exigidos para emissão. Depois da criação, pode exibir linha digitável e link do boleto. A confirmação bancária não é instantânea como o PIX."),
  A(["pagamento pendente", "aguardando pagamento"], "Conta aguardando pagamento", "Se a conta foi criada mas ainda não há pagamento aprovado, o Tributo Leve mantém o acesso como pendente e reapresenta a tela de cobrança no próximo login. Você não precisa criar outra conta."),
  A(["instalar", "app", "pwa", "tela inicial", "smartphone", "celular"], "Instalar Tributo Leve no celular", "No celular, use o botão Instalar que fica sempre disponível enquanto o Tributo Leve não estiver instalado. No Android/Chrome, quando o navegador autoriza, ele abre diretamente o instalador nativo. No iPhone, o sistema orienta Compartilhar > Adicionar à Tela de Início."),
  A(["offline", "sem internet"], "Uso instalado e conexão", "O Tributo Leve é instalável como PWA e mantém recursos estáticos em cache, mas autenticação, pagamentos, administração e dados remotos dependem de conexão. Não trate o modo instalado como garantia de operação integral offline."),

  // FUNDAMENTOS DA REFORMA
  A(["ibs", "o que é ibs", "imposto sobre bens e serviços"], "IBS", "O IBS é o Imposto sobre Bens e Serviços de competência compartilhada entre estados e municípios, criado pela Reforma Tributária do Consumo. Ele integra o modelo de IVA dual com a CBS." , ["rfbEntenda"]),
  A(["cbs", "o que é cbs", "contribuição sobre bens e serviços"], "CBS", "A CBS é a Contribuição sobre Bens e Serviços de competência federal. Ela substitui gradualmente a tributação federal sobre consumo prevista no modelo anterior e integra o IVA dual ao lado do IBS." , ["rfbEntenda"]),
  A(["imposto seletivo", "is", "seletivo"], "Imposto Seletivo", "O Imposto Seletivo é federal e foi criado para desestimular o consumo de bens e serviços prejudiciais à saúde ou ao meio ambiente, conforme os itens definidos em lei. Sua entrada em vigor ocorre no cronograma da reforma a partir de 2027." , ["rfbEntenda"]),
  A(["iva dual", "iva"], "IVA dual", "O novo modelo brasileiro separa a tributação ampla do consumo em CBS federal e IBS estadual/municipal. A lógica busca não cumulatividade, base ampla e tributação no destino." , ["rfbEntenda"]),
  A(["destino", "princípio do destino", "principio do destino"], "Princípio do destino", "No novo IVA, a arrecadação tende a acompanhar o local de consumo, reduzindo a lógica de tributação concentrada na origem. Isso altera a distribuição federativa e a forma como operações interestaduais são tratadas." , ["rfbEntenda"]),
  A(["não cumulatividade", "nao cumulatividade", "cascata"], "Não cumulatividade", "A reforma adota uma lógica ampla de crédito para reduzir tributação em cascata. Em termos práticos, débitos das saídas são confrontados com créditos admitidos nas entradas, observadas as regras legais de apropriação e pagamento." , ["rfbEntenda","credito"]),
  A(["crédito financeiro", "credito financeiro", "crédito integral", "credito integral"], "Crédito financeiro", "A não cumulatividade do novo sistema é estruturada para permitir crédito de IBS/CBS nas aquisições que atendam às condições legais, reduzindo o efeito cascata. A existência econômica do gasto, por si só, não dispensa requisitos fiscais e hipóteses de vedação." , ["rfbEntenda","credito"]),
  A(["pis", "cofins", "pis/cofins"], "PIS/Cofins na transição", "PIS e Cofins são substituídos pela CBS conforme o cronograma legal. Em 2026 há fase de teste/calibragem; a transição avança nos anos seguintes até a consolidação do novo modelo." , ["rfbEntenda","rfb2026"]),
  A(["icms", "iss", "substituição icms iss"], "ICMS e ISS na transição", "ICMS e ISS são gradualmente substituídos pelo IBS durante a transição. Entre 2029 e 2032 ocorre redução progressiva dos tributos atuais enquanto cresce a participação do IBS; em 2033 o novo modelo chega à etapa plena prevista." , ["rfbEntenda"]),
  A(["ipi", "zona franca", "zfm"], "IPI e Zona Franca de Manaus", "O cronograma prevê redução do IPI, com preservação de tratamento relacionado à Zona Franca de Manaus conforme a legislação. Para operações específicas, a análise deve considerar o produto e o regime aplicável." , ["rfbEntenda"]),
  A(["2026", "ano teste", "alíquota teste", "aliquota teste"], "2026: fase de adaptação", "2026 é um ano de implantação e adaptação da CBS e do IBS, com obrigações e documentos fiscais sendo ajustados e mecanismos de conformidade para facilitar a transição. As regras operacionais foram sendo detalhadas por atos da RFB e do CGIBS." , ["rfb2026","conformidade","dfe"]),
  A(["2027", "o que muda 2027"], "2027", "Em 2027 avançam a CBS, o Imposto Seletivo e a integração de IBS/CBS ao Simples Nacional. Para o Simples, a forma de recolhimento dos novos tributos passa a ter efeitos a partir de 1º de janeiro de 2027 conforme a regulamentação atual." , ["rfbEntenda","cgsn","nfse"]),
  A(["2028", "o que muda 2028"], "2028", "2028 ainda integra a fase inicial de transição. O Tributo Leve mantém o ano separado porque a composição das alíquotas e dos tributos substituídos muda ao longo do cronograma." , ["rfbEntenda"]),
  A(["2029", "o que muda 2029"], "2029", "A partir de 2029 começa uma etapa mais visível de substituição gradual de ICMS e ISS pelo IBS. Por isso, comparações entre regimes podem mudar significativamente a partir desse ponto." , ["rfbEntenda"]),
  A(["2030", "o que muda 2030"], "2030", "2030 faz parte da redução progressiva de ICMS/ISS e aumento da participação do IBS. Use a matriz anual do Tributo Leve para não projetar um resultado de 2027 como se fosse constante até o fim da transição." , ["rfbEntenda"]),
  A(["2031", "o que muda 2031"], "2031", "2031 continua a substituição gradual dos tributos atuais pelo IBS. A carga efetiva depende das alíquotas de referência e do perfil de créditos de cada empresa." , ["rfbEntenda"]),
  A(["2032", "o que muda 2032"], "2032", "2032 é o último ano antes da etapa plena de 2033 no cronograma geral. ICMS e ISS já estão em fase avançada de redução enquanto o IBS assume maior participação." , ["rfbEntenda"]),
  A(["2033", "fim transição", "fim da transição"], "2033: etapa plena", "2033 é o marco de conclusão da transição geral para o novo modelo de tributação do consumo, com o IBS/CBS plenamente inseridos no sistema conforme o desenho constitucional e legal." , ["rfbEntenda"]),
  A(["transição", "transicao", "cronograma"], "Transição 2026 a 2033", "A implementação é gradual. 2026 concentra adaptação e testes; 2027 traz mudanças federais e no Simples; de 2029 a 2032 ocorre substituição progressiva de ICMS/ISS pelo IBS; 2033 é a etapa plena. O Tributo Leve detalha 2027 a 2033 ano a ano." , ["rfbEntenda","rfb2026"]),

  // SIMPLES NACIONAL
  A(["opção setembro", "opcao setembro", "setembro 2026", "30 setembro"], "Janela de setembro de 2026", "Para 2027, a regulamentação criou uma janela de 1º a 30 de setembro de 2026 tanto para determinadas opções do Simples quanto para a escolha de recolher IBS/CBS pelo regime regular. A decisão sobre IBS/CBS produz efeitos no primeiro semestre de 2027." , ["simples2027","cgsn"]),
  A(["março 2027", "marco 2027", "segundo semestre", "opção março"], "Opção para o segundo semestre", "Quem não optou pelo regime regular de IBS/CBS para o primeiro semestre pode ter nova janela de opção em março, com efeitos de julho a dezembro, conforme a regulamentação do Simples." , ["cgsn"]),
  A(["cancelar opção", "cancelar opcao", "desistir híbrido", "desistir hibrido"], "Cancelamento da opção", "A regulamentação prevê prazos de cancelamento da opção. Para a janela de setembro referente ao primeiro semestre de 2027, a regra divulgada permite cancelamento até 30 de novembro, observadas eventuais atualizações normativas." , ["simples2027","cgsn"]),
  A(["continuar híbrido", "continuar hibrido", "renúncia", "renuncia"], "Continuidade do regime regular IBS/CBS", "Quem opta por recolher IBS/CBS pelo regime regular tende a permanecer nessa forma nos períodos seguintes enquanto não houver renúncia expressa nos prazos regulamentares." , ["cgsn"]),
  A(["sublimite", "3,6 milhões", "3.6 milhões"], "Sublimite no Simples", "A regulamentação atualizada do Simples passa a considerar o sublimite de R$ 3,6 milhões também para o IBS, ao lado das regras relacionadas a ICMS e ISS. Situações de exportação possuem regras próprias." , ["cgsn"]),
  A(["rbt12", "receita bruta acumulada"], "RBT12", "RBT12 é a receita bruta acumulada nos 12 meses anteriores usada em cálculos do Simples. A regulamentação foi ajustada para a Reforma e o Tributo Leve usa esse conceito para faixa e alíquota efetiva." , ["cgsn"]),
  A(["receita bruta", "base simples", "ibs cbs receita bruta"], "Receita bruta e IBS/CBS no Simples", "A regulamentação atualizada esclarece conceitos de receita bruta e base de cálculo e prevê que valores de CBS e IBS recolhidos pelo regime regular não integrem a receita bruta considerada para fins do Simples Nacional." , ["cgsn"]),
  A(["nota fiscal simples", "nfs-e simples", "nfse nacional"], "NFS-e Nacional para o Simples", "A Receita Federal informou obrigatoriedade da NFS-e de padrão nacional para ME e EPP optantes pelo Simples a partir de 1º de novembro de 2026. As regras de CBS/IBS para optantes do Simples produzem efeitos a partir de 1º de janeiro de 2027." , ["nfse"]),

  // CRÉDITOS, DOCUMENTOS E OPERAÇÃO
  A(["documento fiscal", "nf-e", "nfe", "nfce", "ct-e", "cte"], "Documentos fiscais e IBS/CBS", "A implantação exige adaptação dos documentos fiscais eletrônicos para campos de CBS e IBS conforme notas técnicas e cronogramas específicos. A Receita Federal e o CGIBS publicam atos e leiautes para orientar contribuintes e desenvolvedores." , ["rfb2026","dfe"]),
  A(["apuração assistida", "apuracao assistida"], "Apuração assistida", "A Receita Federal vem implantando serviços de apuração assistida para operacionalizar débitos, créditos e pagamentos da CBS. O desenho busca automatizar parte da escrituração e da apropriação ao longo do período." , ["rtcPortal"]),
  A(["split payment", "pagamento segregado"], "Split Payment", "O Split Payment é uma infraestrutura prevista para separar a parcela tributária no fluxo de pagamento. A RFB e o CGIBS publicam documentação técnica da plataforma e sua implementação deve ser acompanhada pelos atos oficiais." , ["rfbLeg"]),
  A(["cashback", "devolução", "devolucao"], "Cashback tributário", "A reforma prevê mecanismos de devolução de tributos para famílias elegíveis, com regras definidas em lei e regulamentação. O Tributo Leve é voltado à simulação empresarial e não calcula benefício pessoal de cashback." , ["rfbEntenda"]),
  A(["cesta básica", "cesta basica", "alíquota zero", "aliquota zero"], "Cesta básica e alíquota zero", "A reforma estabelece tratamento favorecido para itens definidos em lei, incluindo hipóteses de alíquota zero. A classificação concreta depende do produto e das listas legais, por isso não aplique redução apenas pela descrição genérica do item." , ["rfbEntenda","rfbLeg"]),
  A(["saúde", "saude", "educação", "educacao", "medicamentos"], "Saúde, educação e medicamentos", "A legislação da reforma prevê tratamentos diferenciados para grupos como saúde, educação, medicamentos e determinados dispositivos. A redução exata depende do enquadramento legal do bem ou serviço e das listas aplicáveis." , ["rfbLeg"]),
  A(["profissional liberal", "advogado", "contador", "engenheiro", "serviços intelectuais", "servicos intelectuais"], "Serviços profissionais e intelectuais", "Determinados serviços profissionais possuem tratamento diferenciado previsto na legislação da reforma. No Tributo Leve, selecione o tratamento correspondente apenas quando a atividade e a operação cumprirem os requisitos legais." , ["rfbLeg"]),
  A(["restaurante", "bar", "hotel", "hotelaria", "parque"], "Restaurantes, bares, hotelaria e parques", "Esses setores possuem regimes específicos no desenho da Reforma Tributária do Consumo. A forma de cálculo pode diferir da regra geral; o Tributo Leve oferece tratamentos próprios na lista de regimes especiais." , ["rfbLeg"]),
  A(["imóvel", "imovel", "locação", "locacao", "construção civil", "construcao civil"], "Operações com imóveis", "Operações imobiliárias possuem regime específico e regras próprias de base, redutores e incidência. Use o tratamento de imóveis do Tributo Leve apenas como modelagem e valide venda, locação ou construção conforme a operação real." , ["rfbLeg"]),
  A(["agro", "agropecuário", "agropecuario", "insumo agro"], "Agropecuário e insumos", "Produtos agropecuários e determinados insumos podem ter tratamentos diferenciados previstos em lei. A classificação exata do item é essencial para aplicar redução ou alíquota específica." , ["rfbLeg"]),
  A(["transporte público", "transporte publico", "transporte coletivo"], "Transporte coletivo", "Serviços de transporte coletivo contemplados pela legislação podem ter tratamento favorecido. O tipo de transporte, alcance e enquadramento da operação precisam ser confirmados antes da aplicação." , ["rfbLeg"]),
  A(["zona franca manaus", "manaus"], "Zona Franca de Manaus", "A Reforma preserva mecanismos específicos relacionados à Zona Franca de Manaus. Operações envolvendo a ZFM exigem análise própria e não devem ser reduzidas a uma alíquota genérica do simulador." , ["rfbEntenda","rfbLeg"]),
  A(["plataforma digital", "marketplace"], "Plataformas digitais", "A Reforma Tributária do Consumo traz obrigações e regras específicas para plataformas digitais em determinadas operações. A Receita Federal publica leiautes e orientações próprias; o Tributo Leve não substitui a escrituração da plataforma." , ["rfb2026"]),
  A(["pessoa física", "pessoa fisica", "cnpj pessoa física", "cnpj pessoa fisica"], "Pessoa física contribuinte", "A regulamentação vem disciplinando situações em que pessoas físicas contribuintes de CBS/IBS precisam de identificação cadastral e documentos fiscais. Houve ajustes de cronograma em 2026, por isso consulte sempre a orientação oficial mais recente." , ["rfbLeg"]),
  A(["conformidade", "multa 2026", "adaptação 2026", "adaptacao 2026"], "Conformidade em 2026", "RFB e CGIBS criaram programa de conformidade para apoiar a adaptação às novas obrigações documentais em 2026, com foco inicial em orientação e correção de inconsistências durante a implantação." , ["conformidade"]),
  A(["alíquota referência", "aliquota referencia", "alíquota de referência", "aliquota de referencia"], "Alíquotas de referência", "As alíquotas de referência são parâmetros centrais do novo sistema e podem ser ajustadas conforme o processo de calibragem e legislação. O Tributo Leve guarda parâmetros por ano; antes de decisões definitivas, confirme se a base está na versão normativa mais recente." , ["rfbEntenda","rfbLeg"]),
  A(["b2b", "cliente empresa", "crédito cliente", "credito cliente"], "Impacto B2B", "Em operações B2B, a capacidade do adquirente de aproveitar créditos pode alterar a percepção comercial do regime. O híbrido pode gerar mais transparência de IBS/CBS e créditos em certas situações, mas a vantagem depende da cadeia e do preço final." , ["credito"]),
  A(["b2c", "consumidor final"], "Impacto B2C", "Em vendas ao consumidor final, o crédito do adquirente normalmente não é o principal fator comercial. A comparação tende a depender mais da carga efetiva, preço, margem e tratamento da operação."),
  A(["fonte", "fontes", "legislação", "legislacao", "de onde veio"], "Fontes da base do Assistente", "O Assistente usa uma base local curada a partir de fontes oficiais, principalmente Receita Federal, Ministério da Fazenda, legislação da Reforma Tributária do Consumo e a própria documentação do Tributo Leve. Quando uma resposta tem fonte externa, o link oficial aparece abaixo dela." , ["rfbLeg","rtcPortal"]),
  A(["atualizado", "data da base", "última atualização", "ultima atualizacao"], "Atualização da base", "Esta base local foi ampliada em setembro de 2026 com regras e orientações oficiais disponíveis até então. Como a implementação da reforma é dinâmica, o Tributo Leve deve receber atualizações quando atos, alíquotas, leiautes ou prazos forem alterados." , ["rfbLeg","rtcPortal"]),
  A(["é ia", "e ia", "inteligência artificial", "inteligencia artificial", "tokens", "api"], "Como funciona o Assistente Fiscal", "O Assistente Fiscal desta versão não envia perguntas para uma API de IA. Ele usa busca semântica leve por termos, sinônimos, contexto da tela e uma base local extensa de respostas sobre o Tributo Leve e a Reforma. Isso reduz custo e mantém as perguntas no dispositivo, mas não substitui uma IA generativa nem aconselhamento tributário profissional."),
  A(["privacidade", "pergunta enviada", "dados assistente"], "Privacidade do Assistente", "As perguntas do Assistente Fiscal são processadas localmente no navegador e o histórico rápido é mantido no armazenamento local do dispositivo. A base não precisa enviar o conteúdo da pergunta para serviços externos."),
  A(["erro", "não funciona", "nao funciona", "suporte"], "Quando algo não funciona", "Primeiro identifique em qual área ocorreu: cadastro/pagamento, simulador, módulo ou administração. Para cálculos, confira os alertas da Base técnica. Para pagamentos, preserve o ID da cobrança. Para erros administrativos, atualize o painel e verifique se a sessão ainda é de administrador."),
  A(["cadastro", "criar conta", "primeiro acesso"], "Criar uma conta", "Na tela inicial, escolha Primeiro acesso? Escolher plano. Informe nome, e-mail, senha e CPF válido, escolha PIX ou boleto e conclua a criação. A conta fica vinculada à cobrança e o acesso é liberado após confirmação ou liberação administrativa."),
  A(["cpf inválido", "cpf invalido", "validar cpf"], "Validação do CPF", "O cadastro valida matematicamente os dígitos verificadores do CPF, rejeita sequências inválidas e repete a validação no backend. O CPF é usado para vincular a identidade do pagador sem armazenar o número completo em texto no perfil."),
  A(["cpf repetido", "cpf duplicado", "mesmo cpf"], "CPF já utilizado", "O banco impede que o mesmo CPF seja associado a duas contas. Se você já criou uma conta com esse CPF, use o e-mail correspondente em Já tenho acesso ou peça ao administrador para tratar a conta antiga."),
  A(["confirmar email", "confirmação email", "confirmacao email", "localhost"], "Confirmação de e-mail", "O fluxo atual do Tributo Leve cria a conta pelo backend já confirmada para evitar o antigo redirecionamento de confirmação por e-mail. O login normal usa e-mail e senha após o cadastro."),
  A(["senha", "mínimo senha", "minimo senha"], "Senha de acesso", "A senha de cadastro precisa ter pelo menos 8 caracteres. Use uma senha exclusiva para o Tributo Leve e não compartilhe credenciais administrativas."),
  A(["login", "entrar", "já tenho acesso", "ja tenho acesso"], "Entrar no Tributo Leve", "Use Já tenho acesso e informe e-mail e senha. Se a conta estiver ativa ou em teste, o simulador abre. Se estiver aguardando pagamento, a cobrança pendente será mostrada novamente."),
  A(["verificar pagamento", "já paguei", "ja paguei", "confirmar pix"], "Verificar pagamento", "Na tela de cobrança, o Tributo Leve consulta periodicamente o status no backend. Quando houver opção de verificar agora, você pode forçar uma nova consulta. A liberação só acontece após status de pagamento aceito pelo fluxo do Mercado Pago."),
  A(["mercado pago", "orders api", "checkout transparente"], "Integração Mercado Pago", "O Tributo Leve usa Checkout Transparente com a Orders API no backend. A Public Key fica no frontend para recursos públicos do SDK e o Access Token permanece protegido nas Functions da Netlify. PIX e boleto são criados no servidor."),
  A(["webhook", "notificação pagamento", "notificacao pagamento"], "Webhook de pagamento", "O webhook recebe notificações do Mercado Pago e valida a assinatura antes de atualizar a cobrança e liberar acesso. Se um pagamento foi feito mas não liberou a conta, verifique o status da Order e os logs da Function payment-webhook."),
  A(["onde meus dados", "dados salvos", "cenários navegador", "cenarios navegador"], "Onde os dados do cenário ficam", "Os cenários salvos da conta ficam no workspace no Supabase e podem acompanhar o usuário entre dispositivos. O histórico rápido do Assistente continua local no navegador. A demonstração gratuita não persiste cenários."),
  ...assistantKnowledgeCatalog,
]

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9%]+/g, " ").trim()
}

const STOP_WORDS = new Set(["a","o","as","os","um","uma","uns","umas","de","da","do","das","dos","e","em","no","na","nos","nas","para","pra","por","com","que","eu","me","meu","minha","isso","isto","esse","essa","como","onde","qual","quais","tem","ter","ser","esta","está","estou","fica","ficar"])
const SYNONYMS: Record<string, string> = {
  "baixo":"instalar", "baixar":"instalar", "download":"instalar", "aplicativo":"app", "smartphone":"celular",
  "boto":"informar", "botar":"informar", "coloco":"informar", "colocar":"informar", "ponho":"informar", "por":"informar", "digito":"informar", "preencho":"informar",
  "faturamento":"receita", "venda":"receita", "vendas":"receita", "folha":"folha", "credito":"credito", "creditos":"credito",
  "hibrida":"hibrido", "hibrido":"hibrido", "simulacao":"simular", "simulador":"simular", "comparacao":"comparar",
  "administrador":"admin", "administracao":"admin", "modulo":"modulos", "modulos":"modulos",
  "relatorio":"relatorio", "cenarios":"cenario", "cenario":"cenario", "retencoes":"retencao", "retido":"retencao",
  "precos":"preco", "valores":"valor", "pagamentos":"pagamento", "usuarios":"usuario", "clientes":"cliente"
}

function stemToken(token: string) {
  let t = SYNONYMS[token] || token
  if (t.length > 6) t = t.replace(/(mente|acoes|acao|icoes|icao|amentos|amento|imentos|imento)$/,"" )
  if (t.length > 5) t = t.replace(/(ando|endo|indo|ados|adas|idos|idas|oes|ais)$/,"" )
  if (t.length > 4) t = t.replace(/(es|s)$/,"" )
  return t
}

function tokens(value: string) {
  return normalize(value).split(/\s+/).filter(Boolean).map(stemToken).filter((word) => word.length > 1 && !STOP_WORDS.has(word))
}

function editDistance(a: string, b: string) {
  if (a === b) return 0
  if (!a.length) return b.length
  if (!b.length) return a.length
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    let diagonal = prev[0]
    prev[0] = i
    for (let j = 1; j <= b.length; j++) {
      const old = prev[j]
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diagonal + (a[i - 1] === b[j - 1] ? 0 : 1))
      diagonal = old
    }
  }
  return prev[b.length]
}

function tokenSimilarity(a: string, b: string) {
  if (a === b) return 1
  if (a.length >= 4 && (a.startsWith(b) || b.startsWith(a))) return .84
  const max = Math.max(a.length, b.length)
  if (max < 4) return 0
  const d = editDistance(a, b)
  if (d === 1) return .82
  if (d === 2 && max >= 7) return .66
  return 0
}

function money(value?: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value || 0))
}

function pct(value?: number) {
  return `${(Number(value || 0) * 100).toFixed(2).replace(".", ",")}%`
}

function hasAny(q: string, values: string[]) { return values.some((value) => q.includes(normalize(value))) }

function actionForQuestion(question: string): AssistantAction | undefined {
  const q = normalize(question)
  const qTokens = tokens(question)
  const isHow = hasAny(q, ["onde", "como", "abrir", "ir para", "achar", "informar", "colocar", "botar", "boto", "preencher", "digitar", "mudar", "alterar"])
  if ((qTokens.includes("instalar") && (qTokens.includes("app") || qTokens.includes("celular"))) || hasAny(q, ["instalar app", "baixar app", "baixo o app", "baixar aplicativo", "instalar aplicativo", "adicionar tela inicial", "app no celular", "aplicativo no celular"])) return { type: "install_app", label: "Instalar Tributo Leve" }
  if (hasAny(q, ["cnpj", "cnae", "nome empresa", "regime atual", "anexo manual", "atividade principal", "atividade secundaria"]) && isHow) return { type: "navigate", label: "Abrir Perfil", page: "simulator", step: 1 }
  if (hasAny(q, ["receita", "faturamento", "folha", "b2b", "consumidor final"]) && isHow) return { type: "navigate", label: "Abrir Apuração", page: "simulator", step: 2 }
  if (hasAny(q, ["credito", "creditos", "custo", "custos", "gera credito"]) && isHow) return { type: "navigate", label: "Abrir Créditos", page: "simulator", step: 3 }
  if (hasAny(q, ["rat", "fap", "cpp", "terceiros", "retencao", "estoque", "saldo credor", "ajustes"]) && isHow) return { type: "navigate", label: "Abrir Ajustes", page: "simulator", step: 4 }
  if (hasAny(q, ["comparar", "comparacao", "melhor regime", "memoria de calculo"])) return { type: "navigate", label: "Abrir Comparar", page: "comparison" }
  if (hasAny(q, ["transicao", "2027 a 2033", "grafico transicao"]) && isHow) return { type: "navigate", label: "Abrir Transição", page: "timeline" }
  if (hasAny(q, ["cenario salvo", "cenarios salvos", "historico simulacoes"]) && isHow) return { type: "navigate", label: "Abrir Cenários", page: "scenarios" }
  if (hasAny(q, ["modulo", "modulos", "carteira de clientes", "relatorio executivo", "equipe adicional"]) && isHow) return { type: "navigate", label: "Abrir Módulos", page: "products" }
  if (hasAny(q, ["base tecnica", "consultar cnae", "alerta tecnico"]) && isHow) return { type: "navigate", label: "Abrir Base técnica", page: "technical" }
  if (hasAny(q, ["admin", "administracao", "preco plano", "preco modulo", "ativar usuario", "bloquear usuario", "excluir usuario"]) && isHow) return { type: "navigate", label: "Abrir Administração", page: "admin" }
  return undefined
}

function contextualAnswer(question: string, context?: AssistantContext): AssistantAnswer | null {
  if (!context) return null
  const q = normalize(question)
  if ((q.includes("qual") || q.includes("melhor") || q.includes("compensa")) && q.includes("regime") && context.bestRegime) {
    return { title: "Melhor resultado do cenário atual", answer: `Com os dados preenchidos agora, o menor custo calculado é ${context.bestRegime}${context.bestRegimeTotal != null ? `, em ${money(context.bestRegimeTotal)} por mês` : ""}. Isso é o menor resultado matemático entre os regimes simulados e não substitui a validação de elegibilidade e das premissas.`, sources: [], action: { type: "navigate", label: "Ver comparação completa", page: "comparison" } }
  }
  if ((q.includes("quanto") || q.includes("valor") || q.includes("carga")) && (q.includes("hibr") || q.includes("simples")) && context.hybridTotal != null) {
    return { title: "Carga do cenário atual", answer: `No ano ${context.year || "selecionado"}, o Tributo Leve calcula Simples Puro em ${money(context.pureTotal)} e Simples Híbrido em ${money(context.hybridTotal)} por mês. No híbrido, ${money(context.hybridDas)} ficam no DAS e ${money(context.outsideTotal)} correspondem a IBS/CBS fora do DAS.`, sources: [], action: { type: "navigate", label: "Abrir Comparar", page: "comparison" } }
  }
  if ((q.includes("credito") || q.includes("creditos")) && (q.includes("meu") || q.includes("atual") || q.includes("quanto")) && context.cbsCredit != null) {
    return { title: "Créditos do cenário atual", answer: `Neste cenário, o crédito estimado é ${money(context.cbsCredit)} de CBS e ${money(context.ibsCredit)} de IBS, totalizando ${money(Number(context.cbsCredit || 0) + Number(context.ibsCredit || 0))}. Confira a elegibilidade e os documentos de cada item antes de tratar o valor como crédito efetivamente apropriável.`, sources: [], action: { type: "navigate", label: "Abrir Créditos", page: "simulator", step: 3 } }
  }
  if (q.includes("fator r") && context.factorR != null) {
    return { title: "Fator R do cenário atual", answer: `O Fator R calculado no cenário atual é ${pct(context.factorR)}. A interpretação do Anexo depende da atividade e das regras do Simples aplicáveis ao CNAE informado.`, sources: [], action: { type: "navigate", label: "Abrir Perfil", page: "simulator", step: 1 } }
  }
  if ((q.includes("onde") || q.includes("qual etapa") || q.includes("qual tela")) && q.includes("estou")) {
    const pages: Record<string, string> = { simulator: `Simular, etapa ${context.step || 1} de 4`, comparison: "Comparar", timeline: "Transição", scenarios: "Cenários", products: "Módulos", technical: "Base técnica", admin: "Administração", assistant: "Assistente" }
    return { title: "Tela atual", answer: `Você está em ${pages[context.page || ""] || "uma área do Tributo Leve"}.`, sources: [] }
  }
  return null
}

function rankArticle(article: AssistantArticle, question: string) {
  const q = normalize(question)
  const qTokens = tokens(question)
  let score = article.priority || 0
  for (const rawKey of article.keys) {
    const key = normalize(rawKey)
    if (!key) continue
    if (q === key) score += 28
    else if (q.includes(key)) score += key.includes(" ") ? 18 : 9
    else if (key.includes(q) && q.length >= 4) score += 10
    const kTokens = tokens(rawKey)
    let matched = 0
    for (const kt of kTokens) {
      let best = 0
      for (const qt of qTokens) best = Math.max(best, tokenSimilarity(kt, qt))
      if (best >= .65) { matched += best; score += best * (kt.length >= 6 ? 4.5 : 2.8) }
    }
    if (kTokens.length && matched / kTokens.length >= .75) score += 5
  }
  return score
}

export function answerForAssistant(question: string, context?: AssistantContext): AssistantAnswer | null {
  const contextual = contextualAnswer(question, context)
  if (contextual) return contextual
  const q = normalize(question)
  if (!q) return null

  const ranked = assistantArticles
    .map((article) => ({ article, score: rankArticle(article, question) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)

  const best = ranked[0]
  if (!best || best.score < 4.2) {
    const action = actionForQuestion(question)
    if (action?.type === "install_app") return {
      title: "Instalar o Tributo Leve",
      answer: "No Android/Chrome, toque no botão abaixo para abrir o instalador. Se o Chrome ainda não liberar o prompt, use ⋮ > Instalar app ou Adicionar à tela inicial. No iPhone/iPad, use Safari > Compartilhar > Adicionar à Tela de Início.",
      sources: [], action
    }
    return null
  }

  const close = ranked.filter((item, index) => index > 0 && item.score >= Math.max(8, best.score * .78) && item.article.title !== best.article.title).slice(0, 1)
  const articles = [best.article, ...close.map((item) => item.article)]
  const sources = Array.from(new Set(articles.flatMap((article) => article.sourceIds || []))).map((id) => assistantSources[id]).filter(Boolean).slice(0, 4)
  const suggestions = ranked.filter((item) => item.article.title !== best.article.title).slice(0, 3).map((item) => item.article.keys[0]).filter(Boolean)
  return {
    title: best.article.title,
    answer: articles.map((article) => article.answer).join(close.length ? "\n\nTambém vale considerar: " : ""),
    sources,
    action: actionForQuestion(question),
    suggestions
  }
}
