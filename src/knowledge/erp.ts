/**
 * IMPACTO NO ERP — camada transversal. Fiscal não começa na NF-e:
 * cada regra nasce em cadastros e termina no financeiro/contábil.
 * Conteúdo conceitual (ilustrativo), para orientar a implementação.
 */
export const etapasErp = [
  "Cadastro",
  "Produto/Serviço",
  "Pedido",
  "Faturamento",
  "Tributação",
  "Cálculo",
  "Documento",
  "XML",
  "Autorização",
  "Evento",
  "Estoque",
  "Financeiro",
  "Contábil",
] as const;
export type EtapaErp = (typeof etapasErp)[number];

type Impacto = Partial<Record<EtapaErp, string>>;

export const impactoErpPorRegra: Record<string, Impacto> = {
  "REGRA-CFOP-DESTINO": {
    Cadastro: "UF do destinatário obrigatória e confiável no cadastro de clientes.",
    Pedido: "Operação escolhida no pedido define a natureza.",
    Tributação: "Tabela de CFOP por operação × dentro/fora da UF.",
    XML: "Preencher <CFOP> por item.",
    Autorização: "Bloquear envio quando CFOP não combina com o destino.",
    Contábil: "CFOP alimenta o livro fiscal e a escrituração.",
  },
  "REGRA-CFOP-DEVOLUCAO": {
    Pedido: "Devolução nasce da nota original, não de um pedido novo.",
    Documento: "Referenciar a chave da nota de origem.",
    Estoque: "Entrada ou saída conforme o sentido da devolução.",
    Financeiro: "Estornar ou gerar crédito ao cliente.",
  },
  "REGRA-NCM-FORMATO": {
    "Produto/Serviço": "NCM com 8 dígitos no cadastro do produto, validado ao salvar.",
    Tributação: "NCM é chave para regras de tributação por produto.",
    XML: "<NCM> por item.",
  },
  "REGRA-CST-GRUPO": {
    "Produto/Serviço": "Situação tributária padrão por produto.",
    Tributação: "Grupo de ICMS do XML deve seguir o CST escolhido.",
    XML: "Grupo ICMSxx coerente com o CST.",
  },
  "REGRA-CSOSN-REGIME": {
    Cadastro: "Regime tributário do emitente parametrizado na empresa.",
    Tributação: "Simples usa CSOSN; regime normal usa CST.",
  },
  "REGRA-ICMS-VALOR": {
    Cálculo: "Valor do imposto calculado pelo sistema, nunca digitado.",
    XML: "<vICMS> = base × alíquota, com arredondamento definido.",
    Contábil: "Valor vai para apuração do imposto.",
  },
  "REGRA-TOTAL-ITENS": {
    Faturamento: "Totais recalculados a partir dos itens antes de emitir.",
    Cálculo: "Soma de itens, descontos e frete.",
    XML: "Grupo de totais igual à soma dos itens.",
    Financeiro: "Título a receber com o mesmo total.",
  },
  "REGRA-DIFAL-OBRIGATORIO": {
    Cadastro: "Indicador de contribuinte e consumidor final no cliente.",
    Tributação: "Partilha para a UF de destino em venda a não contribuinte.",
    Cálculo: "Cálculo da diferença de alíquota (regra oficial pendente).",
    Financeiro: "Guia de recolhimento da UF de destino, quando aplicável.",
  },
  "REGRA-PAG-SOMA": {
    Faturamento: "Formas de pagamento somam o total da nota.",
    XML: "Grupo de pagamento.",
    Financeiro: "Uma parcela por forma de pagamento.",
  },
  "REGRA-CHAVE-44": {
    Documento: "Chave de acesso sempre com 44 dígitos.",
    Evento: "Eventos e referências usam a chave completa.",
  },
  "REGRA-CTE-TOMADOR": {
    Cadastro: "Quem paga o frete precisa estar cadastrado.",
    Documento: "Tomador informado no CT-e.",
    Financeiro: "Título de frete contra o tomador.",
  },
  "REGRA-CTEOS-MODALIDADE": {
    Pedido: "Serviço de transporte de pessoas/valores definido no contrato.",
    Documento: "Modalidade coerente com o serviço.",
  },
  "REGRA-MDFE-CONDUTOR": {
    Cadastro: "CPF do condutor validado no cadastro de motoristas.",
    Documento: "Condutor informado no MDF-e.",
  },
  "REGRA-MDFE-PERCURSO": {
    Documento: "UFs de percurso entre carregamento e descarregamento.",
    Evento: "Encerramento ao fim da viagem.",
  },
  "REGRA-NFSE-DESCRICAO": {
    "Produto/Serviço": "Descrição do serviço suficiente e item da lista municipal.",
    Documento: "Discriminação do serviço na NFS-e.",
  },
  "REGRA-MANIF-JUSTIFICATIVA": {
    Evento: "Justificativa mínima exigida antes de enviar o evento.",
  },
  "REGRA-MANIF-DUPLICIDADE": {
    Evento: "Impedir evento repetido sobre a mesma nota.",
    Estoque: "Entrada só após confirmação da operação.",
    Financeiro: "Contas a pagar liberadas conforme manifestação.",
  },
};
