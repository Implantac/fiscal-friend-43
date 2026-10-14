/**
 * NUMERAÇÃO E IDEMPOTÊNCIA.
 *
 * ============================================================================
 * OS DOIS PROBLEMAS QUE ISTO RESOLVE
 * ============================================================================
 * 1. **Concorrência na numeração.** Dois operários (ou duas abas) emitindo ao
 *    mesmo tempo não podem receber o mesmo número. A reserva é atômica por
 *    chave (tenant + estabelecimento + modelo + série) e sequencial.
 *
 * 2. **Duplicidade de transmissão.** Timeout após o envio é o cenário mais
 *    perigoso: a tentação é "tentar de novo" e emitir um segundo documento.
 *    Com chave de idempotência, a nova tentativa devolve o **mesmo** documento
 *    já reservado — nunca um número novo.
 *
 * ============================================================================
 * ESTADO ATUAL
 * ============================================================================
 * A implementação é em memória, adequada a desenvolvimento e teste. Em
 * produção, a reserva deve ser uma transação de banco com
 * `SELECT ... FOR UPDATE` (ou equivalente) sobre a tabela de sequência —
 * a porta `ServicoNumeracao` não muda, só a implementação.
 */

export interface ChaveNumeracao {
  tenantId: string;
  estabelecimentoId: string;
  modelo: string;
  serie: string;
}

export interface ReservaNumero {
  /** Número formatado (string, sem zeros à esquerda perdidos). */
  numero: string;
  sequencia: number;
  idempotencia: string;
  chave: ChaveNumeracao;
}

export interface ServicoNumeracao {
  /**
   * Reserva o próximo número da sequência.
   * @param idempotencia chave que garante que tentativas repetidas devolvam o mesmo número
   */
  reservar(chave: ChaveNumeracao, idempotencia: string): Promise<ReservaNumero>;
  /** Último número reservado (0 se nenhum). */
  atual(chave: ChaveNumeracao): Promise<number>;
  /** Marca números como inutilizados (intervalo), quando o procedimento for admitido. */
  inutilizar(chave: ChaveNumeracao, de: number, ate: number, justificativa: string): Promise<void>;
  inutilizados(
    chave: ChaveNumeracao,
  ): Promise<{ de: number; ate: number; justificativa: string }[]>;
}

export class ErroNumeracao extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = "ErroNumeracao";
  }
}

/** Serializa a chave de forma estável para uso em Map. */
export function serializarChave(chave: ChaveNumeracao): string {
  return [chave.tenantId, chave.estabelecimentoId, chave.modelo, chave.serie].join("|");
}

/**
 * Implementação em memória.
 *
 * A reserva é síncrona por dentro (Map + incremento) e envolta em `Promise`
 * para respeitar a porta assíncrona — o que permite trocar por banco sem
 * alterar os chamadores.
 */
export class ServicoNumeracaoMemoria implements ServicoNumeracao {
  private sequencias = new Map<string, number>();
  private porIdempotencia = new Map<string, ReservaNumero>();
  private inutilizacoes = new Map<string, { de: number; ate: number; justificativa: string }[]>();

  async reservar(chave: ChaveNumeracao, idempotencia: string): Promise<ReservaNumero> {
    if (!idempotencia || idempotencia.trim() === "") {
      throw new ErroNumeracao(
        "Chave de idempotência é obrigatória para reservar numeração. Sem ela, uma retentativa pode gerar documento duplicado.",
      );
    }

    const existente = this.porIdempotencia.get(idempotencia);
    if (existente) {
      if (serializarChave(existente.chave) !== serializarChave(chave)) {
        throw new ErroNumeracao(
          `Chave de idempotência "${idempotencia}" já usada para outra sequência ` +
            `(${serializarChave(existente.chave)} ≠ ${serializarChave(chave)}).`,
        );
      }
      return existente;
    }

    const k = serializarChave(chave);
    const proximo = (this.sequencias.get(k) ?? 0) + 1;
    this.sequencias.set(k, proximo);

    const reserva: ReservaNumero = {
      numero: String(proximo),
      sequencia: proximo,
      idempotencia,
      chave,
    };
    this.porIdempotencia.set(idempotencia, reserva);
    return reserva;
  }

  async atual(chave: ChaveNumeracao): Promise<number> {
    return this.sequencias.get(serializarChave(chave)) ?? 0;
  }

  async inutilizar(
    chave: ChaveNumeracao,
    de: number,
    ate: number,
    justificativa: string,
  ): Promise<void> {
    if (ate < de) throw new ErroNumeracao("Intervalo de inutilização inválido (fim < início).");
    if (!justificativa || justificativa.trim().length < 15) {
      throw new ErroNumeracao(
        "Inutilização exige justificativa (mínimo de 15 caracteres) — o procedimento é declarado ao Fisco.",
      );
    }
    const k = serializarChave(chave);
    const lista = this.inutilizacoes.get(k) ?? [];
    lista.push({ de, ate, justificativa });
    this.inutilizacoes.set(k, lista);
  }

  async inutilizados(
    chave: ChaveNumeracao,
  ): Promise<{ de: number; ate: number; justificativa: string }[]> {
    return [...(this.inutilizacoes.get(serializarChave(chave)) ?? [])];
  }
}
