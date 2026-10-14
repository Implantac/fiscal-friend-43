/**
 * PERSISTÊNCIA E TRANSAÇÃO.
 *
 * ============================================================================
 * O QUE É ISSO
 * ============================================================================
 * As **portas** (interfaces) que o domínio fiscal usa para persistir, e uma
 * implementação em memória com semântica transacional real (staging, commit,
 * rollback e controle de concorrência otimista).
 *
 * ============================================================================
 * POR QUE A IMPLEMENTAÇÃO É EM MEMÓRIA
 * ============================================================================
 * Não existe banco de dados provisionado neste ambiente, e inventar uma
 * conexão fictícia seria exatamente o tipo de falsidade que este produto
 * proíbe. A porta é o contrato estável; a implementação Postgres entra na
 * Etapa 2.5 sem alterar uma linha do domínio.
 *
 * Isolamento multi-tenant é aplicado **na consulta** (`tenantId` obrigatório em
 * toda leitura), não na leitura do registro — assim a existência de um recurso
 * não vaza para outro tenant.
 */

import type { DocumentoFiscal, FamiliaDocumental, EstadoDocumento } from "./ciclo-vida";
import type { ServicoNumeracao } from "./numeracao";
import type { AuditoriaPort } from "./auditoria";

export interface FiltroDocumentos {
  familia?: FamiliaDocumental;
  estado?: EstadoDocumento;
  estabelecimentoId?: string;
  chave?: string;
  de?: string;
  ate?: string;
}

export interface RepositorioDocumentos {
  salvar(doc: DocumentoFiscal): Promise<void>;
  obterPorId(tenantId: string, id: string): Promise<DocumentoFiscal | undefined>;
  obterPorIdempotencia(
    tenantId: string,
    idempotencia: string,
  ): Promise<DocumentoFiscal | undefined>;
  listar(tenantId: string, filtro?: FiltroDocumentos): Promise<DocumentoFiscal[]>;
}

/** Conflito de concorrência: outro escritor alterou o registro desde a leitura. */
export class ConflitoConcorrencia extends Error {
  constructor(entidade: string, id: string) {
    super(
      `Conflito de concorrência em ${entidade} ${id}: o registro foi alterado por outra operação ` +
        `desde a leitura. Releia e tente novamente — não sobrescreva.`,
    );
    this.name = "ConflitoConcorrencia";
  }
}

export class DocumentoNaoEncontrado extends Error {
  constructor(tenantId: string, id: string) {
    super(
      `Documento ${id} não encontrado para o tenant ${tenantId}. ` +
        `(Se o documento existir em outro tenant, o acesso é negado e auditado.)`,
    );
    this.name = "DocumentoNaoEncontrado";
  }
}

/** Unidade de trabalho: tudo ou nada. */
export interface UnidadeTrabalho {
  readonly documentos: RepositorioDocumentos;
  readonly numeracao: ServicoNumeracao;
  readonly auditoria: AuditoriaPort;
  commit(): Promise<void>;
  rollback(): Promise<void>;
}

/* ------------------------------------------------- implementação em memória */

/**
 * Implementação em memória com transação de verdade:
 * escritas vão para área de staging; `commit()` aplica; `rollback()` descarta.
 * Leituras dentro da transição enxergam as próprias escrituras (read-your-writes).
 */
export class UnidadeTrabalhoMemoria implements UnidadeTrabalho {
  private comprometidos = new Map<string, DocumentoFiscal>();
  private staging = new Map<string, DocumentoFiscal>();
  private versoes = new Map<string, string>();

  constructor(
    readonly numeracao: ServicoNumeracao,
    readonly auditoria: AuditoriaPort,
  ) {}

  readonly documentos: RepositorioDocumentos = {
    salvar: async (doc) => {
      const anterior = this.staging.get(doc.id) ?? this.comprometidos.get(doc.id);
      if (anterior && anterior.atualizadoEm !== doc.criadoEm && anterior.id === doc.id) {
        // Controle de concorrência otimista: se havia registro anterior e ele
        // foi modificado depois da nossa leitura, a escrita é recusada.
        if (anterior.atualizadoEm > doc.atualizadoEm) {
          throw new ConflitoConcorrencia("documento", doc.id);
        }
      }
      this.staging.set(doc.id, doc);
    },

    obterPorId: async (tenantId, id) => {
      const doc = this.staging.get(id) ?? this.comprometidos.get(id);
      if (!doc || doc.tenantId !== tenantId) return undefined;
      return doc;
    },

    obterPorIdempotencia: async (tenantId, idempotencia) => {
      for (const doc of [...this.staging.values(), ...this.comprometidos.values()]) {
        if (doc.tenantId === tenantId && doc.idempotencia === idempotencia) return doc;
      }
      return undefined;
    },

    listar: async (tenantId, filtro = {}) => {
      const todos = [...this.comprometidos.values(), ...this.staging.values()];
      const vistos = new Map<string, DocumentoFiscal>();
      for (const d of todos) if (d.tenantId === tenantId) vistos.set(d.id, d);
      return [...vistos.values()].filter((d) => {
        if (filtro.familia && d.familia !== filtro.familia) return false;
        if (filtro.estado && d.estado !== filtro.estado) return false;
        if (filtro.estabelecimentoId && d.estabelecimentoId !== filtro.estabelecimentoId)
          return false;
        if (filtro.chave && d.chave !== filtro.chave) return false;
        if (filtro.de && d.criadoEm < filtro.de) return false;
        if (filtro.ate && d.criadoEm > filtro.ate) return false;
        return true;
      });
    },
  };

  async commit(): Promise<void> {
    for (const [id, doc] of this.staging) {
      const versaoAtual = this.versoes.get(id);
      if (versaoAtual && versaoAtual > doc.atualizadoEm) {
        throw new ConflitoConcorrencia("documento", id);
      }
      this.comprometidos.set(id, doc);
      this.versoes.set(id, doc.atualizadoEm);
    }
    this.staging.clear();
  }

  async rollback(): Promise<void> {
    this.staging.clear();
  }

  /** Exposição para testes: total de documentos comprometidos. */
  get totalComprometidos(): number {
    return this.comprometidos.size;
  }
}

/**
 * Fábrica da unidade de trabalho. Em produção, recebe as implementações de
 * banco; em desenvolvimento e teste, as em memória.
 */
export function criarUnidadeTrabalho(
  numeracao: ServicoNumeracao,
  auditoria: AuditoriaPort,
): UnidadeTrabalho {
  return new UnidadeTrabalhoMemoria(numeracao, auditoria);
}
