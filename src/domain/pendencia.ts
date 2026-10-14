/**
 * Modelo de PENDÊNCIA — o oposto de "achismo silencioso".
 *
 * Regra do produto: quando falta informação para determinar o tratamento
 * fiscal, o sistema NÃO escolhe um valor padrão, NÃO inventa alíquota e NÃO
 * exibe sucesso. Ele devolve uma pendência explícita dizendo o que falta,
 * por que isso importa, o que acontece se for ignorado e como corrigir.
 *
 * Uma pendência bloqueante impede a emissão do documento — nunca é um aviso
 * decorativo.
 */

export type SeveridadePendencia =
  /** Impede a emissão do documento. */
  | "bloqueante"
  /** Não impede, mas o resultado não pode ser considerado apuração. */
  | "informativa";

export interface Pendencia {
  /** Campo, grupo ou informação ausente/exigida. */
  campo: string;
  /** Por que a pendência existe. */
  motivo: string;
  /** O que acontece com o documento se a pendência for ignorada. */
  consequencia: string;
  /** Orientação prática de correção. */
  orientacao: string;
  severidade: SeveridadePendencia;
  /** Regra relacionada, quando conhecida. */
  regraId?: string;
  /** Fonte normativa, quando conhecida. */
  fonte?: string;
}

export function pendencia(
  entrada: Omit<Pendencia, "severidade"> & { severidade?: SeveridadePendencia },
): Pendencia {
  return { severidade: "bloqueante", ...entrada };
}

export function bloqueantes(pendencias: Pendencia[]): Pendencia[] {
  return pendencias.filter((p) => p.severidade === "bloqueante");
}

export function temBloqueio(pendencias: Pendencia[]): boolean {
  return pendencias.some((p) => p.severidade === "bloqueante");
}

/**
 * Pendência canônica do simulador: nenhuma alíquota exibida é oficial.
 * Existe para que a interface jamais apresente número de cenário como
 * apuração fiscal.
 */
export function pendenciaAliquotaNaoValidada(campo: string): Pendencia {
  return {
    campo,
    motivo:
      "Nenhuma alíquota oficial foi confirmada em documentação versionada para este cenário; o valor exibido usa percentuais de demonstração.",
    consequencia:
      "O número serve apenas para demonstrar o comportamento da tela e não pode ser transmitido nem usado para escrituração.",
    orientacao:
      "Implementar a regra tributária versionada no back-end, com fonte, vigência e parâmetros do contribuinte, antes de calcular valores reais.",
    severidade: "bloqueante",
    regraId: "PENDENTE-VALIDACAO",
  };
}

/** Pendência canônica para CFOP sugerido por heurística de tela. */
export function pendenciaCfopHeuristico(campo = "CFOP"): Pendencia {
  return {
    campo,
    motivo:
      "O código foi sugerido por heurística de interface (UF de origem/destino e indicador de contribuinte), não por regra fiscal.",
    consequencia:
      "A heurística não cobre devolução, remessa, industrialização, exportação, substituição tributária, transferência entre estabelecimentos nem benefícios fiscais.",
    orientacao:
      "Definir o CFOP pela natureza da operação, finalidade, origem da mercadoria e regra versionada; tratar a sugestão apenas como acelerador de digitação.",
    severidade: "informativa",
    regraId: "PENDENTE-VALIDACAO",
  };
}
