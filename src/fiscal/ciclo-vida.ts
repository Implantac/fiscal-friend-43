/**
 * MÁQUINA DE ESTADOS DO DOCUMENTO FISCAL.
 *
 * ============================================================================
 * POR QUE ISSO EXISTE
 * ============================================================================
 * Um documento fiscal não é um registro qualquer: ele tem ciclo de vida com
 * consequência legal. Marcar "autorizado" sem resposta oficial, ou deixar o
 * operador editar um XML já assinado, são erros que não têm desfazer.
 *
 * Esta máquina torna as transições **explícitas e bloqueáveis**: o que não
 * está na tabela é proibido. Nenhum estado de sucesso pode ser atingido por
 * atalho — `autorizado` só se alcançado a partir de `transmitido` mediante
 * resposta oficial registrada.
 *
 * ============================================================================
 * ESTADOS
 * ============================================================================
 * `simulacao`            cálculo experimental, sem valor fiscal
 * `pre_validacao`        dados verificados antes de gerar o documento
 * `documento_gerado`     XML construído, ainda sem autorização fiscal
 * `xml_validado`         estrutura validada contra o XSD da versão
 * `assinado`             assinado digitalmente (quando o modelo exige)
 * `transmitido`          envio efetivamente realizado ao serviço fiscal
 * `autorizado`           resposta oficial válida confirmando autorização
 * `rejeitado`            resposta oficial que rejeitou a solicitação
 * `pendente_consulta`    resultado indeterminado (ex.: timeout após envio)
 * `cancelado_ou_encerrado` evento oficial confirmado
 * `indisponivel_ou_contingencia` estado operacional controlado
 */

export type EstadoDocumento =
  | "simulacao"
  | "pre_validacao"
  | "documento_gerado"
  | "xml_validado"
  | "assinado"
  | "transmitido"
  | "autorizado"
  | "rejeitado"
  | "pendente_consulta"
  | "cancelado_ou_encerrado"
  | "indisponivel_ou_contingencia";

export type FamiliaDocumental = "nfe55" | "nfce65" | "nfse" | "cte57" | "cteos67" | "mdfe58";

export type OrigemEvento = "local" | "provedor" | "sefaz" | "sistema";

export interface EventoDocumento {
  id: string;
  em: string;
  de: EstadoDocumento;
  para: EstadoDocumento;
  tipo: "transicao" | "transmissao" | "resposta_oficial" | "evento_fiscal" | "correcao_manual";
  detalhe: string;
  usuarioId: string;
  origem: OrigemEvento;
}

export interface DocumentoFiscal {
  id: string;
  tenantId: string;
  empresaId: string;
  estabelecimentoId: string;
  familia: FamiliaDocumental;
  modelo: string;
  serie: string;
  numero: string;
  /** Chave de acesso, quando o documento já a possui. */
  chave?: string | undefined;
  estado: EstadoDocumento;
  /** 1 = produção, 2 = homologação. */
  ambiente: 1 | 2;
  /** XML gerado. Só existe a partir de `documento_gerado`. */
  xml?: string | undefined;
  /** Versão do leiaute utilizada na geração. */
  versaoLeiaute?: string | undefined;
  /** Protocolo oficial. Só preenchido a partir de `autorizado`. */
  protocolo?: string | undefined;
  /** cStat oficial, quando houver rejeição. */
  cStat?: string | undefined;
  /** Chave de idempotência da transmissão. */
  idempotencia?: string | undefined;
  historico: EventoDocumento[];
  criadoEm: string;
  atualizadoEm: string;
}

/* ---------------------------------------------------------------- tabelas */

/**
 * Transições permitidas por família. A tabela é a autoridade: qualquer
 * transição fora dela lança `TransicaoInvalida`.
 */
const TRANSICOES: Record<FamiliaDocumental, Partial<Record<EstadoDocumento, EstadoDocumento[]>>> = {
  nfe55: {
    simulacao: ["pre_validacao"],
    pre_validacao: ["documento_gerado", "simulacao"],
    documento_gerado: ["xml_validado"],
    xml_validado: ["assinado"],
    assinado: ["transmitido"],
    transmitido: ["autorizado", "rejeitado", "pendente_consulta", "indisponivel_ou_contingencia"],
    pendente_consulta: ["autorizado", "rejeitado", "transmitido", "indisponivel_ou_contingencia"],
    indisponivel_ou_contingencia: ["transmitido"],
    rejeitado: ["documento_gerado"],
    autorizado: ["cancelado_ou_encerrado"],
    cancelado_ou_encerrado: [],
  },
  // NFC-e: mesmas regras de ciclo; particularidades de contingência por UF
  // continuam fora do escopo do simulador.
  nfce65: {
    simulacao: ["pre_validacao"],
    pre_validacao: ["documento_gerado", "simulacao"],
    documento_gerado: ["xml_validado"],
    xml_validado: ["assinado"],
    assinado: ["transmitido"],
    transmitido: ["autorizado", "rejeitado", "pendente_consulta", "indisponivel_ou_contingencia"],
    pendente_consulta: ["autorizado", "rejeitado", "transmitido", "indisponivel_ou_contingencia"],
    indisponivel_ou_contingencia: ["transmitido"],
    rejeitado: ["documento_gerado"],
    autorizado: ["cancelado_ou_encerrado"],
    cancelado_ou_encerrado: [],
  },
  // NFS-e: o DPS é assinado e transmitido; o documento resultante vem na
  // resposta do provedor municipal.
  nfse: {
    simulacao: ["pre_validacao"],
    pre_validacao: ["documento_gerado", "simulacao"],
    documento_gerado: ["xml_validado"],
    xml_validado: ["assinado"],
    assinado: ["transmitido"],
    transmitido: ["autorizado", "rejeitado", "pendente_consulta", "indisponivel_ou_contingencia"],
    pendente_consulta: ["autorizado", "rejeitado", "transmitido", "indisponivel_ou_contingencia"],
    indisponivel_ou_contingencia: ["transmitido"],
    rejeitado: ["documento_gerado"],
    autorizado: ["cancelado_ou_encerrado"],
    cancelado_ou_encerrado: [],
  },
  cte57: {
    simulacao: ["pre_validacao"],
    pre_validacao: ["documento_gerado", "simulacao"],
    documento_gerado: ["xml_validado"],
    xml_validado: ["assinado"],
    assinado: ["transmitido"],
    transmitido: ["autorizado", "rejeitado", "pendente_consulta", "indisponivel_ou_contingencia"],
    pendente_consulta: ["autorizado", "rejeitado", "transmitido", "indisponivel_ou_contingencia"],
    indisponivel_ou_contingencia: ["transmitido"],
    rejeitado: ["documento_gerado"],
    autorizado: ["cancelado_ou_encerrado"],
    cancelado_ou_encerrado: [],
  },
  cteos67: {
    simulacao: ["pre_validacao"],
    pre_validacao: ["documento_gerado", "simulacao"],
    documento_gerado: ["xml_validado"],
    xml_validado: ["assinado"],
    assinado: ["transmitido"],
    transmitido: ["autorizado", "rejeitado", "pendente_consulta", "indisponivel_ou_contingencia"],
    pendente_consulta: ["autorizado", "rejeitado", "transmitido", "indisponivel_ou_contingencia"],
    indisponivel_ou_contingencia: ["transmitido"],
    rejeitado: ["documento_gerado"],
    autorizado: ["cancelado_ou_encerrado"],
    cancelado_ou_encerrado: [],
  },
  mdfe58: {
    simulacao: ["pre_validacao"],
    pre_validacao: ["documento_gerado", "simulacao"],
    documento_gerado: ["xml_validado"],
    xml_validado: ["assinado"],
    assinado: ["transmitido"],
    transmitido: ["autorizado", "rejeitado", "pendente_consulta", "indisponivel_ou_contingencia"],
    pendente_consulta: ["autorizado", "rejeitado", "transmitido", "indisponivel_ou_contingencia"],
    indisponivel_ou_contingencia: ["transmitido"],
    rejeitado: ["documento_gerado"],
    autorizado: ["cancelado_ou_encerrado"],
    cancelado_ou_encerrado: [],
  },
};

/** Famílias cujo leiaute exige assinatura digital do documento. */
const EXIGE_ASSINATURA: Record<FamiliaDocumental, boolean> = {
  nfe55: true,
  nfce65: true,
  nfse: true,
  cte57: true,
  cteos67: true,
  mdfe58: true,
};

/* ------------------------------------------------------------------ erros */

export class TransicaoInvalida extends Error {
  constructor(
    readonly familia: FamiliaDocumental,
    readonly de: EstadoDocumento,
    readonly para: EstadoDocumento,
  ) {
    super(
      `Transição inválida para ${familia}: "${de}" → "${para}". ` +
        `Transições permitidas a partir de "${de}": ${
          TRANSICOES[familia][de]?.join(", ") || "(nenhuma — estado terminal)"
        }.`,
    );
    this.name = "TransicaoInvalida";
  }
}

/** Tentativa de alterar documento em estado que não admite edição. */
export class DocumentoImutavel extends Error {
  constructor(estado: EstadoDocumento) {
    super(
      `Documento em estado "${estado}" não pode ser alterado. ` +
        `Documentos autorizados só se modificam pelos mecanismos legalmente admitidos ` +
        `(cancelamento, correção, inutilização, encerramento).`,
    );
    this.name = "DocumentoImutavel";
  }
}

/* ------------------------------------------------------------- consultas */

export function transicoesPermitidas(
  familia: FamiliaDocumental,
  estado: EstadoDocumento,
): EstadoDocumento[] {
  return [...(TRANSICOES[familia][estado] ?? [])];
}

export function transicaoPermitida(
  familia: FamiliaDocumental,
  de: EstadoDocumento,
  para: EstadoDocumento,
): boolean {
  return transicoesPermitidas(familia, de).includes(para);
}

export function exigeAssinatura(familia: FamiliaDocumental): boolean {
  return EXIGE_ASSINATURA[familia];
}

export function estadoTerminal(estado: EstadoDocumento): boolean {
  return estado === "cancelado_ou_encerrado";
}

/** Estados em que o documento já tem valor fiscal — nunca podem ser "simulados". */
export function estadoComValorFiscal(estado: EstadoDocumento): boolean {
  return estado === "transmitido" || estado === "autorizado" || estado === "cancelado_ou_encerrado";
}

/**
 * O documento pode ser alterado?
 * Regra: até `documento_gerado` (inclusive) sim; de `xml_validado` em diante,
 * não — qualquer correção exige passar pelo fluxo legal.
 */
export function podeEditar(estado: EstadoDocumento): boolean {
  return estado === "simulacao" || estado === "pre_validacao" || estado === "documento_gerado";
}

/* ------------------------------------------------------------ transições */

export interface ContextoTransicao {
  usuarioId: string;
  em: string;
  detalhe?: string;
  origem?: OrigemEvento;
  /** Protocolo oficial, obrigatório para alcançar `autorizado`. */
  protocolo?: string;
  /** cStat oficial, obrigatório para alcançar `rejeitado`. */
  cStat?: string;
}

/**
 * Aplica uma transição, validando a tabela e as regras de integridade.
 * Devolve um **novo** documento (imutabilidade): o anterior não é mutado.
 */
export function transicionar(
  doc: DocumentoFiscal,
  para: EstadoDocumento,
  ctx: ContextoTransicao,
): DocumentoFiscal {
  if (!transicaoPermitida(doc.familia, doc.estado, para)) {
    throw new TransicaoInvalida(doc.familia, doc.estado, para);
  }

  // Regras de integridade por estado de destino.
  if (para === "autorizado") {
    if (!ctx.protocolo) {
      throw new TransicaoInvalida(doc.familia, doc.estado, para);
    }
    if (ctx.origem === "local") {
      // Um protocolo não pode ser inventado localmente.
      throw new TransicaoInvalida(doc.familia, doc.estado, para);
    }
  }
  if (para === "rejeitado" && !ctx.cStat) {
    throw new TransicaoInvalida(doc.familia, doc.estado, para);
  }
  if (para === "transmitido" && !doc.idempotencia) {
    throw new TransicaoInvalida(doc.familia, doc.estado, para);
  }

  const evento: EventoDocumento = {
    id: `ev-${doc.historico.length + 1}-${para}`,
    em: ctx.em,
    de: doc.estado,
    para,
    tipo: tipoDoEvento(para, ctx),
    detalhe:
      ctx.detalhe ??
      (para === "autorizado"
        ? `Autorizado com protocolo ${ctx.protocolo}`
        : para === "rejeitado"
          ? `Rejeitado com cStat ${ctx.cStat}`
          : `Transição para ${para}`),
    usuarioId: ctx.usuarioId,
    origem: ctx.origem ?? "sistema",
  };

  return {
    ...doc,
    estado: para,
    protocolo: para === "autorizado" ? ctx.protocolo : doc.protocolo,
    cStat: para === "rejeitado" ? ctx.cStat : doc.cStat,
    historico: [...doc.historico, Object.freeze(evento)],
    atualizadoEm: ctx.em,
  };
}

function tipoDoEvento(para: EstadoDocumento, ctx: ContextoTransicao): EventoDocumento["tipo"] {
  if (para === "autorizado" || para === "rejeitado") return "resposta_oficial";
  if (para === "transmitido") return "transmissao";
  if (para === "cancelado_ou_encerrado") return "evento_fiscal";
  if (ctx.origem === "local") return "correcao_manual";
  return "transicao";
}

/** Impede alteração de conteúdo em estado que não admite edição. */
export function assertEditavel(doc: DocumentoFiscal): void {
  if (!podeEditar(doc.estado)) {
    throw new DocumentoImutavel(doc.estado);
  }
}

/** Atalho seguro para criar o documento no estado inicial. */
export function criarDocumento(
  base: Omit<DocumentoFiscal, "estado" | "historico" | "criadoEm" | "atualizadoEm">,
  em: string,
): DocumentoFiscal {
  return {
    ...base,
    estado: "simulacao",
    historico: [],
    criadoEm: em,
    atualizadoEm: em,
  };
}
