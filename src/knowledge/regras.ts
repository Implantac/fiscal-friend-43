import type { RegraFiscal, Procedencia } from "./types";

/**
 * Motor de validação DIDÁTICO. Nenhuma destas regras reproduz o validador
 * oficial: elas ensinam o formato de raciocínio (condição → impacto →
 * correção → prevenção) usando um documento simulado desta aplicação.
 */

export interface DocumentoSimulado {
  ufOrigem: string;
  ufDestino: string;
  consumidorFinal: boolean;
  contribuinte: boolean;
  regime: "normal" | "simples";
  cfop: string;
  ncm: string;
  cst: string;
  chaveReferenciada: string;
  quantidade: number;
  valorUnitario: number;
  desconto: number;
  frete: number;
  aliquotaIcms: number;
  valorIcmsInformado: number;
  totalInformado: number;
  difalInformado: number;
  pagamentoInformado: number;
  justificativa: string;
  condutorCpf: string;
  descricaoServico: string;
  tomador: string;
}

export const documentoSimuladoPadrao: DocumentoSimulado = {
  ufOrigem: "SP",
  ufDestino: "MG",
  consumidorFinal: true,
  contribuinte: false,
  regime: "normal",
  cfop: "5102",
  ncm: "73269090",
  cst: "00",
  chaveReferenciada: "35250400011122000199550010000001231000001230",
  quantidade: 10,
  valorUnitario: 250,
  desconto: 100,
  frete: 80,
  aliquotaIcms: 12,
  valorIcmsInformado: 288,
  totalInformado: 2480,
  difalInformado: 0,
  pagamentoInformado: 2480,
  justificativa: "Mercadoria devolvida integralmente ao emitente",
  condutorCpf: "11144477735",
  descricaoServico: "Consultoria de implantação de sistema de gestão",
  tomador: "destinatario",
};

export const base = (d: DocumentoSimulado) =>
  Math.round((d.quantidade * d.valorUnitario - d.desconto + d.frete) * 100) / 100;

const didatico: Procedencia = {
  status: "ilustrativo",
  fonteId: "sem-fonte",
  vigencia: { observacao: "Regra didática deste ambiente, não é regra oficial de validação." },
};

export interface RegraExecutavel extends RegraFiscal {
  /** true = regra atendida. */
  avaliar: (d: DocumentoSimulado) => boolean;
  valorInformado: (d: DocumentoSimulado) => string;
  valorEsperado: (d: DocumentoSimulado) => string;
}

const cfopInterestadual = (c: string) => c.startsWith("6");

export const regras: RegraExecutavel[] = [
  {
    id: "REGRA-CFOP-DESTINO",
    documento: "nfe55",
    titulo: "CFOP coerente com a UF de destino",
    explicacaoSimples:
      "Operação dentro do mesmo estado usa CFOP da série 5; operação para outro estado usa a série 6.",
    condicaoTecnica: "ufOrigem === ufDestino ? CFOP começa com 5 : CFOP começa com 6",
    impacto: "A operação é escriturada com natureza errada e a tributação pode ficar incorreta.",
    campos: ["nfe.cfop"],
    correcao: "Ajustar o CFOP à UF de destino informada no cadastro do destinatário.",
    prevencao: "Derivar o CFOP de tabela de operações no back-end, sem digitação livre.",
    cstats: ["cstat.pendente.cfop"],
    severidade: "erro",
    procedencia: didatico,
    avaliar: (d) => (d.ufOrigem === d.ufDestino ? d.cfop.startsWith("5") : cfopInterestadual(d.cfop)),
    valorInformado: (d) => d.cfop,
    valorEsperado: (d) => (d.ufOrigem === d.ufDestino ? "CFOP 5xxx" : "CFOP 6xxx"),
  },
  {
    id: "REGRA-CFOP-DEVOLUCAO",
    documento: "nfe55",
    titulo: "CFOP de devolução exige documento referenciado",
    explicacaoSimples: "Devolução precisa apontar a nota que está sendo devolvida.",
    condicaoTecnica: "CFOP ∈ {5202, 6202, 5411, 6411} ⇒ chaveReferenciada preenchida",
    impacto: "Sem a referência, a devolução não se liga à operação original na escrituração.",
    campos: ["nfe.cfop", "cte.docs"],
    correcao: "Informar a chave de acesso da nota original.",
    prevencao: "Bloquear a operação de devolução sem seleção da nota de origem.",
    cstats: ["cstat.pendente.referencia"],
    severidade: "erro",
    procedencia: didatico,
    avaliar: (d) =>
      !["5202", "6202", "5411", "6411"].includes(d.cfop) || d.chaveReferenciada.length === 44,
    valorInformado: (d) => d.chaveReferenciada || "(vazio)",
    valorEsperado: () => "Chave de 44 dígitos da nota devolvida",
  },
  {
    id: "REGRA-NCM-FORMATO",
    documento: "nfe55",
    titulo: "NCM com 8 dígitos numéricos",
    explicacaoSimples: "A classificação fiscal do produto tem exatamente oito números.",
    condicaoTecnica: "/^\\d{8}$/.test(NCM)",
    impacto: "O documento é recusado na validação de esquema.",
    campos: ["nfe.ncm"],
    correcao: "Corrigir o NCM no cadastro do produto.",
    prevencao: "Validar o formato no cadastro, não só na emissão.",
    cstats: ["cstat.pendente.ncm"],
    severidade: "erro",
    procedencia: didatico,
    avaliar: (d) => /^\d{8}$/.test(d.ncm),
    valorInformado: (d) => d.ncm || "(vazio)",
    valorEsperado: () => "8 dígitos numéricos",
  },
  {
    id: "REGRA-CST-GRUPO",
    documento: "nfe55",
    titulo: "CST informado com dois dígitos",
    explicacaoSimples: "No regime normal a situação tributária do ICMS tem dois dígitos.",
    condicaoTecnica: "regime === 'normal' ⇒ /^\\d{2}$/.test(CST)",
    impacto: "Grupo de ICMS incorreto no XML.",
    campos: ["nfe.cst"],
    correcao: "Informar o CST correspondente à tributação do item.",
    prevencao: "Manter a tributação por produto e UF no cadastro fiscal.",
    cstats: ["cstat.pendente.cst"],
    severidade: "erro",
    procedencia: didatico,
    avaliar: (d) => d.regime !== "normal" || /^\d{2}$/.test(d.cst),
    valorInformado: (d) => d.cst || "(vazio)",
    valorEsperado: () => "CST de 2 dígitos",
  },
  {
    id: "REGRA-CSOSN-REGIME",
    documento: "nfe55",
    titulo: "Simples Nacional usa CSOSN, não CST",
    explicacaoSimples: "Quem é do Simples Nacional informa CSOSN, com três dígitos.",
    condicaoTecnica: "regime === 'simples' ⇒ /^\\d{3}$/.test(CST)",
    impacto: "Grupo de ICMS do Simples fica inconsistente.",
    campos: ["nfe.cst"],
    correcao: "Trocar o código pelo CSOSN correspondente.",
    prevencao: "Derivar o código do regime tributário do emitente.",
    cstats: ["cstat.pendente.cst"],
    severidade: "erro",
    procedencia: didatico,
    avaliar: (d) => d.regime !== "simples" || /^\d{3}$/.test(d.cst),
    valorInformado: (d) => d.cst || "(vazio)",
    valorEsperado: () => "CSOSN de 3 dígitos",
  },
  {
    id: "REGRA-ICMS-VALOR",
    documento: "nfe55",
    titulo: "ICMS destacado igual a base × alíquota",
    explicacaoSimples: "O valor do imposto tem que bater com a conta da base pela alíquota.",
    condicaoTecnica: "|vICMS − round(vBC × pICMS / 100, 2)| ≤ 0,01",
    impacto: "Divergência de cálculo entre o documento e a apuração.",
    campos: ["nfe.vbc"],
    correcao: "Recalcular o imposto a partir da base e da alíquota vigentes.",
    prevencao: "Calcular sempre no back-end; nunca aceitar valor digitado.",
    cstats: ["cstat.pendente.calculo"],
    severidade: "erro",
    procedencia: didatico,
    avaliar: (d) =>
      Math.abs(d.valorIcmsInformado - Math.round(base(d) * d.aliquotaIcms) / 100) <= 0.01,
    valorInformado: (d) => d.valorIcmsInformado.toFixed(2),
    valorEsperado: (d) => (Math.round(base(d) * d.aliquotaIcms) / 100).toFixed(2),
  },
  {
    id: "REGRA-TOTAL-ITENS",
    documento: "nfe55",
    titulo: "Total do documento igual à soma dos itens",
    explicacaoSimples: "O total informado precisa ser igual ao que os itens somam.",
    condicaoTecnica: "|vNF − Σ itens| ≤ 0,01",
    impacto: "Documento inconsistente entre detalhe e totais.",
    campos: ["nfe.vbc"],
    correcao: "Recalcular os totais a partir dos itens.",
    prevencao: "Totalizar sempre a partir do detalhe, nunca em campo editável.",
    cstats: ["cstat.pendente.calculo"],
    severidade: "erro",
    procedencia: didatico,
    avaliar: (d) => Math.abs(d.totalInformado - base(d)) <= 0.01,
    valorInformado: (d) => d.totalInformado.toFixed(2),
    valorEsperado: (d) => base(d).toFixed(2),
  },
  {
    id: "REGRA-DIFAL-OBRIGATORIO",
    documento: "nfe55",
    titulo: "DIFAL em venda interestadual a consumidor final não contribuinte",
    explicacaoSimples:
      "Quando a venda cruza estados e o comprador é consumidor final não contribuinte, há parcela devida ao destino.",
    condicaoTecnica: "ufOrigem ≠ ufDestino ∧ consumidorFinal ∧ ¬contribuinte ⇒ vICMSUFDest > 0",
    impacto: "Falta de recolhimento ao estado de destino.",
    campos: ["nfe.difal"],
    correcao: "Calcular a diferença entre a alíquota interna do destino e a interestadual.",
    prevencao: "Detectar a condição automaticamente a partir do cadastro do destinatário.",
    cstats: ["cstat.pendente.difal"],
    severidade: "erro",
    procedencia: didatico,
    avaliar: (d) =>
      !(d.ufOrigem !== d.ufDestino && d.consumidorFinal && !d.contribuinte) || d.difalInformado > 0,
    valorInformado: (d) => d.difalInformado.toFixed(2),
    valorEsperado: () => "Valor maior que zero",
  },
  {
    id: "REGRA-PAG-SOMA",
    documento: "nfce65",
    titulo: "Soma dos pagamentos cobre o total",
    explicacaoSimples: "No caixa, o que foi pago não pode ser menor que o valor da venda.",
    condicaoTecnica: "Σ vPag ≥ vNF",
    impacto: "Venda registrada sem liquidação correspondente.",
    campos: ["nfce.pag"],
    correcao: "Registrar o pagamento restante ou corrigir o valor da venda.",
    prevencao: "Impedir a finalização do cupom com saldo em aberto.",
    cstats: ["cstat.pendente.pagamento"],
    severidade: "erro",
    procedencia: didatico,
    avaliar: (d) => d.pagamentoInformado + 0.01 >= d.totalInformado,
    valorInformado: (d) => d.pagamentoInformado.toFixed(2),
    valorEsperado: (d) => `≥ ${d.totalInformado.toFixed(2)}`,
  },
  {
    id: "REGRA-CHAVE-44",
    documento: "cte57",
    titulo: "Chave referenciada com 44 dígitos",
    explicacaoSimples: "Toda chave de acesso tem 44 números.",
    condicaoTecnica: "/^\\d{44}$/.test(chave)",
    impacto: "Vínculo com o documento de carga não é aceito.",
    campos: ["cte.docs"],
    correcao: "Reimportar o XML da nota ou digitar a chave completa.",
    prevencao: "Validar tamanho e dígito verificador na importação.",
    cstats: ["cstat.pendente.chave"],
    severidade: "erro",
    procedencia: didatico,
    avaliar: (d) => d.chaveReferenciada === "" || /^\d{44}$/.test(d.chaveReferenciada),
    valorInformado: (d) => `${d.chaveReferenciada.length} dígitos`,
    valorEsperado: () => "44 dígitos",
  },
  {
    id: "REGRA-CTE-TOMADOR",
    documento: "cte57",
    titulo: "Tomador é um dos participantes da prestação",
    explicacaoSimples: "Quem paga o frete precisa ser alguém que já aparece no documento.",
    condicaoTecnica: "tomador ∈ {remetente, expedidor, recebedor, destinatario, outros}",
    impacto: "Documento com tomador indefinido gera escrituração incorreta.",
    campos: ["cte.tomador"],
    correcao: "Selecionar o participante que contratou o transporte.",
    prevencao: "Derivar o tomador da condição de frete do pedido.",
    cstats: ["cstat.pendente.cte"],
    severidade: "erro",
    procedencia: didatico,
    avaliar: (d) =>
      ["remetente", "expedidor", "recebedor", "destinatario", "outros"].includes(d.tomador),
    valorInformado: (d) => d.tomador || "(vazio)",
    valorEsperado: () => "remetente | expedidor | recebedor | destinatario | outros",
  },
  {
    id: "REGRA-CTEOS-MODALIDADE",
    documento: "cteos67",
    titulo: "CT-e OS não vincula documentos de carga",
    explicacaoSimples:
      "Transporte de pessoas ou de valores não tem nota de mercadoria vinculada à prestação.",
    condicaoTecnica: "documento === 'cteos67' ⇒ sem grupo infDoc de NF-e",
    impacto: "Uso de leiaute incorreto para a prestação.",
    campos: ["cteos.modalidade"],
    correcao: "Escolher CT-e 57 quando houver carga com documentos vinculados.",
    prevencao: "Separar as telas por modalidade desde o início do cadastro.",
    cstats: ["cstat.pendente.cteos"],
    severidade: "alerta",
    procedencia: didatico,
    avaliar: () => true,
    valorInformado: () => "—",
    valorEsperado: () => "Sem documentos de carga vinculados",
  },
  {
    id: "REGRA-MDFE-CONDUTOR",
    documento: "mdfe58",
    titulo: "CPF do condutor válido",
    explicacaoSimples: "O CPF do motorista precisa ter 11 números e dígitos verificadores válidos.",
    condicaoTecnica: "Validação de dígitos verificadores do CPF",
    impacto: "Manifesto recusado na validação.",
    campos: ["mdfe.condutor"],
    correcao: "Corrigir o CPF no cadastro do motorista.",
    prevencao: "Validar CPF no cadastro de pessoal.",
    cstats: ["cstat.pendente.mdfe"],
    severidade: "erro",
    procedencia: didatico,
    avaliar: (d) => cpfValido(d.condutorCpf),
    valorInformado: (d) => d.condutorCpf || "(vazio)",
    valorEsperado: () => "CPF válido",
  },
  {
    id: "REGRA-MDFE-PERCURSO",
    documento: "mdfe58",
    titulo: "UF final coerente com o destino da carga",
    explicacaoSimples: "A viagem deve terminar no estado para onde a carga vai.",
    condicaoTecnica: "UFFim === ufDestino dos documentos vinculados",
    impacto: "Fiscos intermediários não acompanham a viagem corretamente.",
    campos: ["mdfe.percurso"],
    correcao: "Ajustar a UF final ou revisar os documentos vinculados.",
    prevencao: "Sugerir o percurso a partir dos documentos selecionados.",
    cstats: ["cstat.pendente.mdfe"],
    severidade: "alerta",
    procedencia: didatico,
    avaliar: () => true,
    valorInformado: (d) => d.ufDestino,
    valorEsperado: (d) => d.ufDestino,
  },
  {
    id: "REGRA-NFSE-DESCRICAO",
    documento: "nfse",
    titulo: "Discriminação do serviço suficiente",
    explicacaoSimples: "A descrição precisa dizer o que foi feito, não apenas 'serviços prestados'.",
    condicaoTecnica: "descricaoServico.length ≥ 10",
    impacto: "Município pode recusar ou glosar a nota.",
    campos: ["nfse.servico"],
    correcao: "Detalhar o serviço prestado.",
    prevencao: "Exigir tamanho mínimo no formulário e sugerir texto do contrato.",
    cstats: ["cstat.pendente.nfse"],
    severidade: "alerta",
    procedencia: didatico,
    avaliar: (d) => d.descricaoServico.trim().length >= 10,
    valorInformado: (d) => `${d.descricaoServico.trim().length} caracteres`,
    valorEsperado: () => "Ao menos 10 caracteres",
  },
  {
    id: "REGRA-MANIF-JUSTIFICATIVA",
    documento: "eventos",
    titulo: "Justificativa mínima nas manifestações de recusa",
    explicacaoSimples:
      "Recusar ou desconhecer uma operação exige explicar o motivo em texto suficiente.",
    condicaoTecnica: "tipo ∈ {desconhecimento, nao_realizada} ⇒ xJust.length ≥ 15",
    impacto: "Evento recusado por justificativa insuficiente.",
    campos: ["evento.manifestacao"],
    correcao: "Escrever uma justificativa objetiva do motivo da recusa.",
    prevencao: "Validar o tamanho mínimo no formulário antes de transmitir.",
    cstats: ["cstat.pendente.evento"],
    severidade: "erro",
    procedencia: didatico,
    avaliar: (d) => d.justificativa.trim().length >= 15,
    valorInformado: (d) => `${d.justificativa.trim().length} caracteres`,
    valorEsperado: () => "Ao menos 15 caracteres",
  },
  {
    id: "REGRA-MANIF-DUPLICIDADE",
    documento: "eventos",
    titulo: "Evento já registrado não deve ser reenviado",
    explicacaoSimples: "Repetir a mesma manifestação sobre a mesma nota costuma ser recusado.",
    condicaoTecnica: "statusAtual ≠ tipoSolicitado",
    impacto: "Retorno de duplicidade e ruído no histórico.",
    campos: ["evento.manifestacao"],
    correcao: "Conferir o histórico antes de reenviar.",
    prevencao: "Desabilitar o tipo já registrado na interface.",
    cstats: ["cstat.pendente.evento"],
    severidade: "alerta",
    procedencia: didatico,
    avaliar: () => true,
    valorInformado: () => "—",
    valorEsperado: () => "Tipo diferente do já registrado",
  },
];

export const regraById = new Map(regras.map((r) => [r.id, r]));

export function cpfValido(raw: string) {
  const c = raw.replace(/\D/g, "");
  if (c.length !== 11 || /^(\d)\1{10}$/.test(c)) return false;
  const dv = (len: number) => {
    let soma = 0;
    for (let i = 0; i < len; i++) soma += Number(c[i]) * (len + 1 - i);
    const r = (soma * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return dv(9) === Number(c[9]) && dv(10) === Number(c[10]);
}

export interface ResultadoRegra {
  regra: RegraExecutavel;
  ok: boolean;
  informado: string;
  esperado: string;
}

export function executarRegras(d: DocumentoSimulado): ResultadoRegra[] {
  return regras.map((regra) => ({
    regra,
    ok: regra.avaliar(d),
    informado: regra.valorInformado(d),
    esperado: regra.valorEsperado(d),
  }));
}
