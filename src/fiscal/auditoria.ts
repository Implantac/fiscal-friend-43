/**
 * TRILHA DE AUDITORIA (append-only).
 *
 * ============================================================================
 * REGRA
 * ============================================================================
 * A trilha é **somente de acrescentar**. Não existe update, não existe delete.
 * Um registro de auditoria é congelado (`Object.freeze`) no momento em que
 * entra — qualquer tentativa de alteração posterior falha em tempo de
 * execução (modo estrito) ou é detectada pelos testes.
 *
 * O que **nunca** entra na trilha: senha, chave privada, token, conteúdo de
 * certificado ou dado pessoal além do estritamente necessário. A trilha
 * registra *quem fez o quê, quando, em qual recurso* — não o segredo.
 */

export type AcaoAuditoria =
  | "documento.criado"
  | "documento.transicionado"
  | "documento.transmitido"
  | "documento.autorizado"
  | "documento.rejeitado"
  | "documento.cancelado"
  | "numeracao.reservada"
  | "numeracao.inutilizada"
  | "acesso.negado"
  | "acesso.cross_tenant"
  | "certificado.vinculado"
  | "certificado.removido"
  | "regra.proposta"
  | "regra.aprovada"
  | "regra.revogada";

export interface RegistroAuditoria {
  id: string;
  em: string;
  tenantId: string;
  usuarioId: string;
  papel: string;
  acao: AcaoAuditoria;
  /** Tipo do recurso afetado (ex.: "documento", "empresa"). */
  entidade: string;
  entidadeId: string;
  /** Resumo legível da mudança. Nunca contém segredos. */
  resumo: string;
  /** Estado anterior/posterior, quando aplicável. */
  antes?: string | undefined;
  depois?: string | undefined;
  /** Origem da ação. */
  origem: "usuario" | "sistema" | "integracao";
  /** IP ou identificador de sessão, quando disponível. */
  sessao?: string | undefined;
}

export interface FiltroAuditoria {
  tenantId: string;
  entidade?: string;
  entidadeId?: string;
  usuarioId?: string;
  acao?: AcaoAuditoria;
  de?: string;
  ate?: string;
}

export interface AuditoriaPort {
  registrar(registro: Omit<RegistroAuditoria, "id">): Promise<RegistroAuditoria>;
  listar(filtro: FiltroAuditoria): Promise<RegistroAuditoria[]>;
}

/** Implementação em memória, append-only, para desenvolvimento e testes. */
export class AuditoriaMemoria implements AuditoriaPort {
  private registros: RegistroAuditoria[] = [];
  private contador = 0;

  async registrar(registro: Omit<RegistroAuditoria, "id">): Promise<RegistroAuditoria> {
    this.contador += 1;
    // Congela o registro: nenhum campo pode ser alterado depois.
    const completo = Object.freeze({
      ...registro,
      id: `aud-${this.contador}-${registro.tenantId}`,
    });
    this.registros.push(completo);
    return completo;
  }

  async listar(filtro: FiltroAuditoria): Promise<RegistroAuditoria[]> {
    return this.registros.filter((r) => {
      if (r.tenantId !== filtro.tenantId) return false; // isolamento por tenant
      if (filtro.entidade && r.entidade !== filtro.entidade) return false;
      if (filtro.entidadeId && r.entidadeId !== filtro.entidadeId) return false;
      if (filtro.usuarioId && r.usuarioId !== filtro.usuarioId) return false;
      if (filtro.acao && r.acao !== filtro.acao) return false;
      if (filtro.de && r.em < filtro.de) return false;
      if (filtro.ate && r.em > filtro.ate) return false;
      return true;
    });
  }

  /** Total de registros (usado em testes de integridade). */
  get total(): number {
    return this.registros.length;
  }
}

/**
 * Sanitizador de conteúdo para trilha.
 *
 * Usado antes de qualquer registro que envolva texto potencialmente sensível:
 * remove chaves, tokens e blocos que se parecem com credencial. Falhar
 * silenciosamente aqui seria o pior resultado — por isso a função é explícita
 * e testada.
 */
export function sanitizarParaAuditoria(texto: string): string {
  return texto
    .replace(/(?:senha|password|token|api[_-]?key|secret)\s*[:=]\s*\S+/gi, "[REDIGIDO]")
    .replace(/-----BEGIN [^-]+-----[\s\S]*?-----END [^-]+-----/g, "[REDIGIDO]")
    .replace(/\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/g, "[CPF REDIGIDO]");
}
