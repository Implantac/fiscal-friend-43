/**
 * Camada de conhecimento fiscal.
 *
 * Esta camada NÃO é motor fiscal de produção. Ela existe para ensinar:
 * conceito → regra → campo → dependência → cálculo → XML → validação →
 * rejeição → diagnóstico → correção → teste.
 *
 * Regra inegociável: nada aqui pode afirmar regra, alíquota, código de
 * rejeição ou leiaute como oficial sem fonte registrada. Na dúvida, o item
 * nasce como "pendente".
 */

export type StatusValidacao = "validado" | "ilustrativo" | "pendente" | "obsoleto";

export const statusLabel: Record<StatusValidacao, string> = {
  validado: "Validado",
  ilustrativo: "Ilustrativo",
  pendente: "Pendente de validação",
  obsoleto: "Obsoleto",
};

export type CategoriaFonte =
  | "Portal NF-e"
  | "SEFAZ"
  | "Receita Federal"
  | "ENCAT"
  | "Manual / MOC"
  | "Nota Técnica"
  | "Ajuste SINIEF"
  | "Convênio"
  | "Legislação"
  | "Documentação de provedor"
  | "Sem fonte cadastrada";

export interface FonteFiscal {
  id: string;
  categoria: CategoriaFonte;
  nome: string;
  /** Nunca inventar link. Ausente = "Fonte oficial ainda não cadastrada." */
  referencia?: string;
  observacao?: string;
}

export interface Vigencia {
  inicio?: string;
  fim?: string;
  observacao?: string;
}

/** Bloco de procedência anexado a todo conhecimento fiscal relevante. */
export interface Procedencia {
  status: StatusValidacao;
  fonteId: string;
  documento?: string;
  versao?: string;
  vigencia?: Vigencia;
}

export type DocumentoId = "nfe55" | "nfce65" | "nfse" | "cte57" | "cteos67" | "mdfe58" | "eventos";

export interface ParticipanteFiscal {
  papel: string;
  descricao: string;
}

export interface DocumentoFiscal {
  id: DocumentoId;
  sigla: string;
  modelo?: string;
  nome: string;
  rota: string;
  oQueE: string;
  porQueExiste: string;
  quandoUsar: string[];
  quandoNaoUsar: string[];
  participantes: ParticipanteFiscal[];
  fluxo: string[];
  eventos: string[];
  procedencia: Procedencia;
  pendencias?: string[];
}

export interface CampoFiscal {
  id: string;
  documento: DocumentoId;
  grupoXml: string;
  tagXml: string;
  nome: string;
  tipo: string;
  obrigatoriedade: string;
  conceito: string;
  porQueExiste: string;
  quemInforma: string;
  origemDado: string;
  dependeDe: string[];
  influencia: string[];
  calculoId?: string;
  exemploXml: string;
  regras: string[];
  cstats: string[];
  implementacaoErp: string[];
  testes: string[];
  procedencia: Procedencia;
  /** Vincula ao catálogo de blueprint existente, quando houver elemento de tela. */
  docId?: string;
}

export interface RegraFiscal {
  id: string;
  documento: DocumentoId;
  titulo: string;
  explicacaoSimples: string;
  condicaoTecnica: string;
  impacto: string;
  campos: string[];
  correcao: string;
  prevencao: string;
  cstats: string[];
  severidade: "erro" | "alerta";
  procedencia: Procedencia;
}

export interface VariavelCalculo {
  simbolo: string;
  nome: string;
  descricao: string;
}

export interface CalculoFiscal {
  id: string;
  nome: string;
  grupo: "Base" | "ICMS" | "IPI" | "PIS/COFINS" | "ST e FCP" | "DIFAL" | "Reforma";
  formula: string;
  variaveis: VariavelCalculo[];
  arredondamento: string;
  xml: string;
  /** Cálculo determinístico, sempre identificado como exemplo didático. */
  calcular: (v: Record<string, number>) => number;
  padrao: Record<string, number>;
  procedencia: Procedencia;
}

export interface CStat {
  codigo: string;
  documento: DocumentoId | "geral";
  /** Só preenchido quando a descrição oficial tiver sido conferida em manual. */
  descricaoOficial?: string;
  situacao: string;
  causaProvavel: string;
  regras: string[];
  campos: string[];
  xmlProblema?: string;
  exemploIncorreto?: string;
  exemploCorreto?: string;
  correcao: string;
  impactoErp: string;
  checklistSuporte: string[];
  procedencia: Procedencia;
}

export interface CenarioFiscal {
  id: string;
  nome: string;
  objetivo: string;
  documento: DocumentoId;
  participantes: string;
  operacao: string;
  regime: string;
  origem: string;
  destino: string;
  consumidor: string;
  tributacao: string[];
  passos: string[];
  campos: string[];
  xml: string;
  validacoes: string[];
  possiveisRejeicoes: string[];
  solucao: string;
  procedencia: Procedencia;
}

export interface AulaFiscal {
  id: string;
  titulo: string;
  conceito: string;
  exemplo: string;
  simulacao: string;
  exercicio: string;
  erroProposital: string;
  diagnostico: string;
  solucao: string;
  testeFinal: string;
}

export interface TrilhaFiscal {
  id: string;
  numero: number;
  titulo: string;
  resumo: string;
  documento?: DocumentoId;
  aulas: AulaFiscal[];
}

export interface DesafioFiscal {
  id: string;
  titulo: string;
  enunciado: string;
  cenarioId?: string;
  xml: string;
  campoCorreto: string;
  regraCorreta: string;
  cstatCorreto: string;
  explicacao: string;
  correcao: string;
}
