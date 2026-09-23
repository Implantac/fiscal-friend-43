/**
 * Modelos tipados do domínio simulado.
 * Nenhum destes tipos representa um contrato confirmado de TecnoSpeed ou PlugNotas.
 * Eles descrevem apenas o modelo interno do protótipo.
 */

export type ManifestacaoTipo =
  | "ciencia"
  | "confirmacao"
  | "nao_realizada"
  | "desconhecimento";

export type ManifestacaoStatus =
  | "sem_manifestacao"
  | "ciencia"
  | "confirmacao"
  | "nao_realizada"
  | "desconhecimento";

export interface EventoHistorico {
  id: string;
  em: string;
  titulo: string;
  detalhe: string;
  origem: "local" | "provedor_simulado" | "sefaz_simulada";
  resultado: "sucesso" | "rejeicao" | "erro";
}

export interface NotaRecebida {
  id: string;
  emissaoISO: string;
  emitente: string;
  cnpj: string;
  valor: number;
  chave: string;
  status: ManifestacaoStatus;
  /** No cenário demonstrado, indica se o XML completo está disponível para download. */
  xmlDisponivel: boolean;
  natureza: string;
  itensDemo: { descricao: string; quantidade: number; unitario: number }[];
  historico: EventoHistorico[];
}

export type ResultadoTipo = "sucesso" | "rejeicao_fiscal" | "erro_provedor" | "erro_local";

export interface ResultadoSimulado {
  tipo: ResultadoTipo;
  titulo: string;
  mensagemTecnica: string;
  explicacao: string;
  acaoSugerida: string;
  /** Identificador no catálogo do blueprint, quando houver documentação do campo/ação. */
  docId?: string;
}
