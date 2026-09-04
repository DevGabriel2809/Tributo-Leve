# Auditoria funcional da planilha-base

## Escopo inspecionado

A análise percorreu as nove abas, células utilizadas, fórmulas, valores armazenados, validações, comentários, proteção, hiperlinks, gráficos e dependências internas do arquivo OOXML.

| Aba | Dimensão | Fórmulas no arquivo | Papel no modelo |
|---|---:|---:|---|
| Menu | A1:L30 | 11 | Navegação e instruções |
| Análise-Puro-Híbrido-Regular | A1:K139 | 169 | Motor principal e entradas |
| Comparativo Puro x Híbrido | A1:M65 | 81 | Cenário atual e evolução anual |
| DRE Real x Presumido | A1:K86 | 76 | IRPJ/CSLL e DRE simplificada |
| Comparativo 4 Regimes | A1:N42 | 25 | Consolidação com encargos |
| Impacto B2B-B2C | A1:H147 | 59 | Leitura comercial, sem alterar tributos |
| Anexos I a V (2027-2033) | A1:S238 | 211 | 210 combinações ano/anexo/faixa |
| CNAE x Anexo (consulta) | A1:H396 | 392 | 391 CNAEs e regra do Fator R |
| Regimes Especiais (consulta) | A1:I36 | 1 | Reduções e requisitos setoriais |
| **Total** |  | **1.025** |  |

Também foram identificados seis gráficos, seis validações de dados, 13 comentários explicativos e oito abas protegidas. O arquivo é `.xlsx`, sem VBA ou macros. A busca por erros de fórmula não encontrou `#REF!`, `#DIV/0!`, `#VALUE!`, `#NAME?`, `#N/A`, `#NUM!` ou `#NULL!` armazenados.

## Fluxo do cálculo

1. CNAE e folha/RBT12 determinam o Anexo sugerido; atividades sujeitas ao Fator R usam III quando o índice é ≥ 28% e V quando é inferior.
2. O RBT12 determina a faixa de 1 a 6 e a chave `ano-anexo-faixa` recupera alíquota nominal, parcela a deduzir e repartição interna.
3. A alíquota efetiva é `(RBT12 × nominal − dedução) ÷ RBT12` e incide sobre o faturamento mensal de cada atividade.
4. O DAS é repartido em IRPJ, CSLL, CPP, IPI, ICMS/ISS, CBS e IBS; retenções de ICMS/ISS reduzem o DAS até o limite do respectivo componente.
5. No híbrido, componentes de CBS/IBS deixam o DAS e são comparados ao regime regular, com débito sobre receita e crédito sobre custos elegíveis e estoque.
6. A DRE calcula ICMS/ISS, bases presumidas, IRPJ/CSLL e uma demonstração simplificada do Lucro Real.
7. Os resultados alimentam os comparativos Puro/Híbrido, quatro regimes, transição anual e B2B/B2C.

## Inconsistências encontradas

### 1. Rampa do IBS aplicada duas vezes

As alíquotas de referência de IBS das linhas 230-236 já são escalonadas (1,77% em 2029, 3,54% em 2030, 5,31% em 2031 e 7,08% em 2032). Mesmo assim, a fórmula `F82` e o quadro anual voltam a multiplicar esses valores por 10%, 20%, 30% e 40%. O mesmo ocorre ao retirar o componente de IBS do DAS. Isso reduz artificialmente o IBS do híbrido nesses quatro anos.

### 2. Encargos patronais duplicados no comparativo de quatro regimes

`DRE Real x Presumido!C77/E77` já somam os encargos patronais de `G138`. Depois, `Comparativo 4 Regimes!G8/J8` somam `G138` novamente. No cenário demonstrativo, isso transforma R$ 7.106,00 em R$ 8.806,00 no Presumido e R$ 9.221,84 em R$ 10.921,84 no Real.

### 3. IBS omitido na formação da base simplificada do Lucro Real

Na DRE, `G57` deduz apenas `C49` (débito de CBS) da receita. O débito de IBS, armazenado em `F49`, não é deduzido antes da formação de `G63`, criando tratamento assimétrico entre os dois tributos.

### 4. Crédito de ICMS pode ser duplicado entre duas atividades

`DRE Real x Presumido!G20` e `G27` usam a mesma base total de compras de mercadorias (`C14`). Se as duas atividades forem tributadas pelo ICMS, cada uma aproveita integralmente a mesma compra e o crédito é contado duas vezes. O motor técnico rateia a base de compras pela participação das receitas sujeitas ao ICMS; o modo fiel mantém a fórmula original.

O sistema oferece:

- **Análise técnica (padrão):** elimina as quatro inconsistências;
- **Fiel à planilha:** preserva o comportamento original para reconciliação.

## Limitações já declaradas na própria planilha

- redistribuição do excedente de ISS acima de 5% nos Anexos III, IV e V não foi implementada célula a célula;
- DRE é mensal, consolidada e simplificada, sem adições/exclusões fiscais, depreciação, provisões ou compensação de prejuízos;
- lista de CNAEs e regimes diferenciados não é exaustiva;
- crédito B2B é potencial e informativo, não crédito usado pela própria empresa;
- alíquotas cheias futuras de IBS/CBS são estimativas editáveis e dependem de legislação posterior e do ente federativo;
- regime especial exige validação material de NCM/NBS, requisitos e documentação.

## Decisões de produto adotadas

- interface orientada por etapas, inspirada na simplicidade de uso do simulador do Sebrae, mas com profundidade técnica superior;
- memória de cálculo sempre acessível;
- separação entre entrada do usuário, valor calculado e alerta de premissa;
- funcionamento local sem servidor e estrutura pronta para autenticação/backend posterior;
- responsividade completa, tabelas com rolagem segura e navegação móvel fixa;
- dados persistidos apenas no navegador nesta primeira versão.
