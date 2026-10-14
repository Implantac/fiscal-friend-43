/**
 * REGISTRO DE REGRAS FISCAIS — versão, vigência, fonte e estado.
 *
 * ============================================================================
 * ESTADO ATUAL (honesto, e proposital)
 * ============================================================================
 * Este registro começa **vazio de regras validadas**. Nenhuma documentação
 * oficial de SEFAZ, CONFAZ, Receita Federal, TecnoSpeed ou PlugNotas foi
 * conferida para construir esta base. Enquanto uma regra não tiver fonte
 * normativa com dispositivo, versão e data, ela não pode ser marcada como
 * validada — e o motor se recusa a aplicá-la em cálculo real.
 *
 * O que este arquivo entrega é o **arcabouço**: a estrutura de dados que
 * obriga qualquer regra futura a carregar fonte, vigência, versão, condições,
 * exceções, casos de teste, responsável e histórico; e as funções que
 * impedem o uso de regra em estado inadequado.
 *
 * Migração: as regras hoje distribuídas em telas e heurísticas devem ser
 * cadastradas aqui antes de serem promovidas a cálculo de produção.
 */

/** Ciclo de vida formal de uma regra fiscal. */
export type EstadoRegra =
  | "rascunho"
  | "em_revisao"
  | "validada_tecnicamente"
  | "aprovada_para_uso"
  | "vigente"
  | "substituida"
  | "revogada"
  | "bloqueada";

/** Fonte normativa. Sem fonte, não há regra validada. */
export interface FonteNormativa {
  /** Órgão ou documento (ex.: "CONFAZ", "Ajuste SINIEF", "Manual NF-e v6.00"). */
  orgao: string;
  /** Identificação do ato/documento. */
  documento: string;
  /** Dispositivo, artigo, cláusula ou item. */
  dispositivo?: string;
  /** Versão do documento consultado. */
  versao?: string;
  /** Data da consulta (ISO). */
  consultadaEm?: string;
  /** URL canônica, quando pública. */
  url?: string;
}

export interface CasoTeste {
  id: string;
  descricao: string;
  entrada: Record<string, unknown>;
  saidaEsperada: Record<string, unknown>;
  /** Origem do caso: documento oficial, especialista ou exemplo didático. */
  origem: "fonte_oficial" | "especialista" | "didatico";
}

export interface RegraFiscal {
  /** Identificador único e estável (ex.: "ICMS-BASE-REDUZIDA-SP"). */
  id: string;
  versao: string;
  titulo: string;
  descricao: string;
  /** Obrigatório para qualquer estado além de rascunho. */
  fonte?: FonteNormativa;
  /** Jurisdição e escopo (UF, município, modelo documental, NCM...). */
  jurisdicao?: string;
  escopo?: string;
  /** Vigência em ISO date (inclusivo). */
  vigenciaInicio?: string;
  vigenciaFim?: string;
  estado: EstadoRegra;
  /** Condições de aplicação, em texto legível. */
  condicoes?: string[];
  excecoes?: string[];
  /** Fórmula e critério de arredondamento, quando aplicável. */
  formula?: string;
  arredondamento?: string;
  casosTeste?: CasoTeste[];
  /** Responsável pela revisão técnica/fiscal. */
  responsavel?: string;
  /** Data de aprovação (ISO). */
  aprovadaEm?: string;
  historico?: { versao: string; em: string; mudanca: string; autor: string }[];
  /** Limitações conhecidas. */
  limitacoes?: string[];
}

/** Erros de uso do registro — falham ruidosamente, nunca em silêncio. */
export class ErroRegra extends Error {
  constructor(
    mensagem: string,
    readonly regraId: string,
  ) {
    super(mensagem);
    this.name = "ErroRegra";
  }
}

/** Registro em memória. No sistema real, vem do banco, versionado. */
const registro = new Map<string, RegraFiscal>();

export function registrarRegra(regra: RegraFiscal): RegraFiscal {
  validarRegra(regra);
  registro.set(regra.id, regra);
  return regra;
}

export function obterRegra(id: string): RegraFiscal | undefined {
  return registro.get(id);
}

export function listarRegras(
  filtro: { estado?: EstadoRegra; vigenteEm?: string } = {},
): RegraFiscal[] {
  return [...registro.values()].filter((r) => {
    if (filtro.estado && r.estado !== filtro.estado) return false;
    if (filtro.vigenteEm && !vigenteEm(r, filtro.vigenteEm)) return false;
    return true;
  });
}

/** Limpa o registro (uso em testes). */
export function limparRegistro(): void {
  registro.clear();
}

/** A regra está dentro da vigência na data informada? */
export function vigenteEm(regra: RegraFiscal, dataISO: string): boolean {
  if (regra.vigenciaInicio && dataISO < regra.vigenciaInicio) return false;
  if (regra.vigenciaFim && dataISO > regra.vigenciaFim) return false;
  return true;
}

/** Estados em que a regra pode ser usada em cálculo real. */
export function utilizavel(regra: RegraFiscal): boolean {
  return regra.estado === "aprovada_para_uso" || regra.estado === "vigente";
}

/**
 * Valida a integridade mínima de uma regra antes de aceitá-la no registro.
 * Uma regra sem fonte não passa — é a barreira contra legislação inventada.
 */
export function validarRegra(regra: RegraFiscal): void {
  const problemas: string[] = [];
  if (!regra.id || !/^[A-Z0-9-]+$/i.test(regra.id)) {
    problemas.push("id deve ser identificador estável (letras, números e hífen).");
  }
  if (!regra.titulo) problemas.push("titulo é obrigatório.");
  if (!regra.descricao) problemas.push("descricao é obrigatória.");

  const exigeFonte = regra.estado !== "rascunho";
  if (exigeFonte && !regra.fonte) {
    problemas.push(
      `estado "${regra.estado}" exige fonte normativa (orgao, documento, versao e data de consulta).`,
    );
  }
  if (regra.fonte && (!regra.fonte.orgao || !regra.fonte.documento)) {
    problemas.push("fonte normativa incompleta: informe orgao e documento.");
  }
  if (regra.estado === "aprovada_para_uso" || regra.estado === "vigente") {
    if (!regra.casosTeste || regra.casosTeste.length === 0) {
      problemas.push("regra aprovada exige ao menos um caso de teste.");
    }
    if (!regra.responsavel) problemas.push("regra aprovada exige responsável pela revisão.");
    if (!regra.vigenciaInicio) problemas.push("regra aprovada exige data de início de vigência.");
  }
  if (problemas.length > 0) {
    throw new ErroRegra(`Regra "${regra.id}" inválida: ${problemas.join(" ")}`, regra.id);
  }
}

/**
 * Retorna a regra somente se puder ser usada em cálculo real.
 * Usada pelo motor tributário para nunca aplicar regra em estado inadequado.
 */
export function regraParaCalculo(id: string, dataISO: string): RegraFiscal {
  const regra = registro.get(id);
  if (!regra) {
    throw new ErroRegra(
      `Regra "${id}" não encontrada no registro. Não é permitido aplicar regra não catalogada.`,
      id,
    );
  }
  if (!utilizavel(regra)) {
    throw new ErroRegra(
      `Regra "${id}" está em estado "${regra.estado}" e não pode ser usada em cálculo real.`,
      id,
    );
  }
  if (!vigenteEm(regra, dataISO)) {
    throw new ErroRegra(
      `Regra "${id}" fora de vigência em ${dataISO} (início ${regra.vigenciaInicio ?? "—"}, fim ${regra.vigenciaFim ?? "—"}).`,
      id,
    );
  }
  return regra;
}

/** Resumo de cobertura do registro — usado pelo painel de qualidade. */
export function resumoRegistro(): {
  total: number;
  porEstado: Record<EstadoRegra, number>;
  validadas: number;
} {
  const porEstado: Record<EstadoRegra, number> = {
    rascunho: 0,
    em_revisao: 0,
    validada_tecnicamente: 0,
    aprovada_para_uso: 0,
    vigente: 0,
    substituida: 0,
    revogada: 0,
    bloqueada: 0,
  };
  for (const r of registro.values()) porEstado[r.estado] += 1;
  return { total: registro.size, porEstado, validadas: listarRegras({ estado: "vigente" }).length };
}
