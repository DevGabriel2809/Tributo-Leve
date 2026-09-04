-- ============================================================
-- TRIBUTO LEVE 4.2.1 — IDENTIDADE COMERCIAL DOS PLANOS (REVISADA)
-- ============================================================
-- Atualiza SOMENTE a apresentação comercial dos planos:
--   • nome exibido;
--   • descrição;
--   • badge;
--   • destaque/recomendação;
--   • ordem de exibição.
--
-- NÃO altera:
--   • slug técnico;
--   • preço;
--   • duração;
--   • limite de CNPJs;
--   • recursos incluídos;
--   • assinaturas existentes;
--   • integrações Mercado Pago;
--   • permissões/RLS.
--
-- É seguro executar mesmo se a migration 009 anterior já tiver sido aplicada,
-- pois os UPDATEs usam os mesmos slugs e apenas sobrescrevem a identidade visual.

begin;

-- ------------------------------------------------------------
-- LEVE START
-- Plano de entrada para profissional/autônomo ou operação com 1 CNPJ.
-- ------------------------------------------------------------
update public.plans
set name = 'Leve Start',
    description = 'Para quem quer começar com controle e sem complicação. O Leve Start libera o núcleo completo do Tributo Leve para 1 CNPJ, com simulações tributárias, comparação entre cenários, análise da transição, memória de cálculo e assistente para apoiar as decisões do dia a dia. Conforme a operação crescer, você pode contratar módulos adicionais sem precisar trocar toda a sua estrutura.',
    badge = 'IDEAL PARA COMEÇAR',
    recommended = false,
    sort_order = 10
where slug = 'basico-mensal';

-- ------------------------------------------------------------
-- LEVE PRO
-- Plano mensal para quem já trabalha com mais de uma empresa.
-- ------------------------------------------------------------
update public.plans
set name = 'Leve Pro',
    description = 'Pensado para profissionais e pequenos escritórios que já precisam atender mais de uma empresa com organização. O Leve Pro reúne tudo do Leve Start, amplia a operação para até 4 CNPJs e libera a carteira integrada para manter clientes, cenários e análises organizados em um único ambiente. É a opção mensal para quem quer ganhar escala sem assumir um período maior de contratação.',
    badge = 'PARA QUEM ESTÁ CRESCENDO',
    recommended = false,
    sort_order = 20
where slug = 'pro-mensal';

-- ------------------------------------------------------------
-- LEVE PRIME
-- Plano trimestral recomendado e com melhor relação custo-benefício.
-- ------------------------------------------------------------
update public.plans
set name = 'Leve Prime',
    description = 'A experiência mais completa e a melhor relação entre recursos e custo dentro do Tributo Leve. O Leve Prime reúne tudo do Leve Pro por 3 meses, permite trabalhar com até 4 CNPJs e já inclui o Relatório Executivo durante toda a vigência do plano, ideal para apresentar análises mais profissionais aos clientes. Além de ter mais recursos incluídos, o valor trimestral é mais vantajoso do que pagar três mensalidades do Leve Pro.',
    badge = 'MELHOR CUSTO-BENEFÍCIO',
    recommended = true,
    sort_order = 30
where slug = 'pro-trimestral';

commit;

-- ============================================================
-- VALIDAÇÃO
-- Todos os campos abaixo devem retornar TRUE.
-- ============================================================
select
  exists(
    select 1
    from public.plans
    where slug = 'basico-mensal'
      and name = 'Leve Start'
      and badge = 'IDEAL PARA COMEÇAR'
      and recommended = false
      and length(description) > 200
  ) as leve_start_ok,

  exists(
    select 1
    from public.plans
    where slug = 'pro-mensal'
      and name = 'Leve Pro'
      and badge = 'PARA QUEM ESTÁ CRESCENDO'
      and recommended = false
      and length(description) > 200
  ) as leve_pro_ok,

  exists(
    select 1
    from public.plans
    where slug = 'pro-trimestral'
      and name = 'Leve Prime'
      and badge = 'MELHOR CUSTO-BENEFÍCIO'
      and recommended = true
      and length(description) > 200
  ) as leve_prime_recomendado_ok;
