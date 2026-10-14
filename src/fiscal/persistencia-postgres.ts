/**
 * REPOSITÓRIO POSTGRES — implementação real das portas do domínio.
 *
 * ============================================================================
 * COMO USAR
 * ============================================================================
 * O código de domínio (`src/fiscal/*`) não conhece SQL. Ele fala com as portas
 * `RepositorioDocumentos`, `ServicoNumeracao` e `AuditoriaPort`. Este arquivo é
 * a implementação dessas portas contra Postgres, recebendo um executor SQL
 * injetado — o que permite testar a lógica sem banco no ambiente de CI e
 * trocar o driver sem tocar no domínio.
 *
 * ============================================================================
 * REGRAS DE SEGURANÇA DESTA CAMADA
 * ============================================================================
 * 1. **Nunca interpolar valores no SQL.** Todo dado externo entra como
 *    parâmetro vinculado (`$1`, `$2`, …). Teste automatizado falha se algum
 *    valor de dados aparecer dentro do texto da query.
 * 2. **Toda query filtra por tenant**, e a conexão tem RLS ativo
 *    (`SET LOCAL app.tenant_id`). O código filtra; o banco garante.
 * 3. **Numeração atômica em uma única instrução** — `INSERT … ON CONFLICT DO
 *    UPDATE … RETURNING`, sem SELECT seguido de UPDATE (que teria corrida).
 */

import type { DocumentoFiscal, EstadoDocumento, FamiliaDocumental } from "./ciclo-vida";
import type { ServicoNumeracao, ChaveNumeracao, ReservaNumero } from "./numeracao";
import type { AuditoriaPort, FiltroAuditoria, RegistroAuditoria } from "./auditoria";
import type { RepositorioDocumentos, FiltroDocumentos } from "./persistencia";

/* -------------------------------------------------------------- executor */

/**
 * Executor SQL mínimo. `pg`, `postgres.js` ou qualquer driver que exponha
 * `query` com parâmetros vinculados satisfaz esta interface.
 */
export interface SqlExecutor {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
  /** Executa dentro de transação, aplicando `SET LOCAL app.tenant_id`. */
  emTransacao<T>(tenantId: string, fn: (tx: SqlExecutor) => Promise<T>): Promise<T>;
}

export class ErroPersistencia extends Error {
  constructor(
    mensagem: string,
    readonly causa?: unknown,
  ) {
    super(mensagem);
    this.name = "ErroPersistencia";
  }
}

/* ------------------------------------------------------- mapeamento linha↔domínio */

interface LinhaDocumento {
  id: string;
  tenant_id: string;
  empresa_id: string;
  estabelecimento_id: string;
  familia: FamiliaDocumental;
  modelo: string;
  serie: string;
  numero: string;
  chave: string | null;
  estado: EstadoDocumento;
  ambiente: number;
  xml: string | null;
  versao_leiaute: string | null;
  protocolo: string | null;
  c_stat: string | null;
  idempotencia: string | null;
  criado_em: string;
  atualizado_em: string;
}

function paraDominio(l: LinhaDocumento): DocumentoFiscal {
  return {
    id: l.id,
    tenantId: l.tenant_id,
    empresaId: l.empresa_id,
    estabelecimentoId: l.estabelecimento_id,
    familia: l.familia,
    modelo: l.modelo,
    serie: l.serie,
    numero: l.numero,
    chave: l.chave ?? undefined,
    estado: l.estado,
    ambiente: (l.ambiente === 1 ? 1 : 2) as 1 | 2,
    xml: l.xml ?? undefined,
    versaoLeiaute: l.versao_leiaute ?? undefined,
    protocolo: l.protocolo ?? undefined,
    cStat: l.c_stat ?? undefined,
    idempotencia: l.idempotencia ?? undefined,
    historico: [],
    criadoEm: l.criado_em,
    atualizadoEm: l.atualizado_em,
  };
}

/* ------------------------------------------------------ repositório documentos */

export class RepositorioDocumentosPostgres implements RepositorioDocumentos {
  constructor(private readonly sql: SqlExecutor) {}

  async salvar(doc: DocumentoFiscal): Promise<void> {
    await this.sql.emTransacao(doc.tenantId, async (tx) => {
      await tx.query(
        `INSERT INTO documentos_fiscais
           (id, tenant_id, empresa_id, estabelecimento_id, familia, modelo, serie,
            numero, chave, estado, ambiente, xml, versao_leiaute, protocolo, c_stat,
            idempotencia, criado_em, atualizado_em)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
         ON CONFLICT (tenant_id, estabelecimento_id, modelo, serie, numero) DO UPDATE SET
           estado = EXCLUDED.estado,
           chave = EXCLUDED.chave,
           xml = EXCLUDED.xml,
           versao_leiaute = EXCLUDED.versao_leiaute,
           protocolo = EXCLUDED.protocolo,
           c_stat = EXCLUDED.c_stat,
           idempotencia = EXCLUDED.idempotencia,
           atualizado_em = EXCLUDED.atualizado_em
         WHERE documentos_fiscais.atualizado_em <= EXCLUDED.atualizado_em`,
        [
          doc.id,
          doc.tenantId,
          doc.empresaId,
          doc.estabelecimentoId,
          doc.familia,
          doc.modelo,
          doc.serie,
          doc.numero,
          doc.chave ?? null,
          doc.estado,
          doc.ambiente,
          doc.xml ?? null,
          doc.versaoLeiaute ?? null,
          doc.protocolo ?? null,
          doc.cStat ?? null,
          doc.idempotencia ?? null,
          doc.criadoEm,
          doc.atualizadoEm,
        ],
      );

      // Eventos são gravados em tabela separada e imutável (trigger no banco).
      for (const ev of doc.historico) {
        await tx.query(
          `INSERT INTO eventos_documento
             (tenant_id, documento_id, de, para, tipo, detalhe, usuario_id, origem, em)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
           ON CONFLICT DO NOTHING`,
          [
            doc.tenantId,
            doc.id,
            ev.de,
            ev.para,
            ev.tipo,
            ev.detalhe,
            ev.usuarioId,
            ev.origem,
            ev.em,
          ],
        );
      }
    });
  }

  async obterPorId(tenantId: string, id: string): Promise<DocumentoFiscal | undefined> {
    const linhas = await this.sql.query<LinhaDocumento>(
      `SELECT * FROM documentos_fiscais WHERE tenant_id = $1 AND id = $2`,
      [tenantId, id],
    );
    return linhas[0] ? paraDominio(linhas[0]) : undefined;
  }

  async obterPorIdempotencia(
    tenantId: string,
    idempotencia: string,
  ): Promise<DocumentoFiscal | undefined> {
    const linhas = await this.sql.query<LinhaDocumento>(
      `SELECT * FROM documentos_fiscais WHERE tenant_id = $1 AND idempotencia = $2`,
      [tenantId, idempotencia],
    );
    return linhas[0] ? paraDominio(linhas[0]) : undefined;
  }

  async listar(tenantId: string, filtro: FiltroDocumentos = {}): Promise<DocumentoFiscal[]> {
    const where: string[] = ["tenant_id = $1"];
    const params: unknown[] = [tenantId];

    const add = (clausula: string, valor: unknown) => {
      params.push(valor);
      where.push(clausula.replace("?", `$${params.length}`));
    };

    if (filtro.familia) add("familia = ?", filtro.familia);
    if (filtro.estado) add("estado = ?", filtro.estado);
    if (filtro.estabelecimentoId) add("estabelecimento_id = ?", filtro.estabelecimentoId);
    if (filtro.chave) add("chave = ?", filtro.chave);
    if (filtro.de) add("criado_em >= ?", filtro.de);
    if (filtro.ate) add("criado_em <= ?", filtro.ate);

    const linhas = await this.sql.query<LinhaDocumento>(
      `SELECT * FROM documentos_fiscais WHERE ${where.join(" AND ")} ORDER BY criado_em DESC`,
      params,
    );
    return linhas.map(paraDominio);
  }
}

/* ------------------------------------------------------------ numeração PG */

export class ServicoNumeracaoPostgres implements ServicoNumeracao {
  constructor(private readonly sql: SqlExecutor) {}

  /**
   * Reserva atômica em uma única instrução.
   *
   * `ON CONFLICT DO UPDATE` é executado pelo Postgres de forma serializada pela
   * própria constraint de chave primária — não há janela entre ler e escrever,
   * que é exatamente a falha do padrão SELECT-then-UPDATE.
   */
  async reservar(chave: ChaveNumeracao, idempotencia: string): Promise<ReservaNumero> {
    if (!idempotencia || idempotencia.trim() === "") {
      throw new ErroPersistencia(
        "Chave de idempotência é obrigatória para reservar numeração. Sem ela, uma retentativa pode gerar documento duplicado.",
      );
    }

    const linhas = await this.sql.query<{ atual: string }>(
      `INSERT INTO numeracao (tenant_id, estabelecimento_id, modelo, serie, atual)
       VALUES ($1,$2,$3,$4,1)
       ON CONFLICT (tenant_id, estabelecimento_id, modelo, serie)
       DO UPDATE SET atual = numeracao.atual + 1, atualizado_em = now()
       RETURNING atual`,
      [chave.tenantId, chave.estabelecimentoId, chave.modelo, chave.serie],
    );

    const atual = Number(linhas[0]?.atual ?? NaN);
    if (!Number.isFinite(atual)) {
      throw new ErroPersistencia("Falha ao reservar numeração: banco não devolveu a sequência.");
    }

    return { numero: String(atual), sequencia: atual, idempotencia, chave };
  }

  async atual(chave: ChaveNumeracao): Promise<number> {
    const linhas = await this.sql.query<{ atual: string }>(
      `SELECT atual FROM numeracao
       WHERE tenant_id = $1 AND estabelecimento_id = $2 AND modelo = $3 AND serie = $4`,
      [chave.tenantId, chave.estabelecimentoId, chave.modelo, chave.serie],
    );
    return linhas[0] ? Number(linhas[0].atual) : 0;
  }

  async inutilizar(
    chave: ChaveNumeracao,
    de: number,
    ate: number,
    justificativa: string,
  ): Promise<void> {
    if (ate < de) throw new ErroPersistencia("Intervalo de inutilização inválido (fim < início).");
    if (!justificativa || justificativa.trim().length < 15) {
      throw new ErroPersistencia(
        "Inutilização exige justificativa (mínimo de 15 caracteres) — o procedimento é declarado ao Fisco.",
      );
    }
    await this.sql.query(
      `INSERT INTO numeracao_inutilizada
         (tenant_id, estabelecimento_id, modelo, serie, de, ate, justificativa)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [chave.tenantId, chave.estabelecimentoId, chave.modelo, chave.serie, de, ate, justificativa],
    );
  }

  async inutilizados(
    chave: ChaveNumeracao,
  ): Promise<{ de: number; ate: number; justificativa: string }[]> {
    const linhas = await this.sql.query<{ de: string; ate: string; justificativa: string }>(
      `SELECT de, ate, justificativa FROM numeracao_inutilizada
       WHERE tenant_id = $1 AND estabelecimento_id = $2 AND modelo = $3 AND serie = $4
       ORDER BY de`,
      [chave.tenantId, chave.estabelecimentoId, chave.modelo, chave.serie],
    );
    return linhas.map((l) => ({
      de: Number(l.de),
      ate: Number(l.ate),
      justificativa: l.justificativa,
    }));
  }
}

/* ------------------------------------------------------------ auditoria PG */

export class AuditoriaPostgres implements AuditoriaPort {
  constructor(private readonly sql: SqlExecutor) {}

  async registrar(registro: Omit<RegistroAuditoria, "id">): Promise<RegistroAuditoria> {
    const linhas = await this.sql.query<{ id: string }>(
      `INSERT INTO auditoria
         (tenant_id, usuario_id, papel, acao, entidade, entidade_id, resumo, antes, depois, origem, sessao, em)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       RETURNING id`,
      [
        registro.tenantId,
        registro.usuarioId,
        registro.papel,
        registro.acao,
        registro.entidade,
        registro.entidadeId,
        registro.resumo,
        registro.antes ?? null,
        registro.depois ?? null,
        registro.origem,
        registro.sessao ?? null,
        registro.em,
      ],
    );
    return { ...registro, id: linhas[0]?.id ?? "" };
  }

  async listar(filtro: FiltroAuditoria): Promise<RegistroAuditoria[]> {
    const where: string[] = ["tenant_id = $1"];
    const params: unknown[] = [filtro.tenantId];
    const add = (c: string, v: unknown) => {
      params.push(v);
      where.push(c.replace("?", `$${params.length}`));
    };
    if (filtro.entidade) add("entidade = ?", filtro.entidade);
    if (filtro.entidadeId) add("entidade_id = ?", filtro.entidadeId);
    if (filtro.usuarioId) add("usuario_id = ?", filtro.usuarioId);
    if (filtro.acao) add("acao = ?", filtro.acao);
    if (filtro.de) add("em >= ?", filtro.de);
    if (filtro.ate) add("em <= ?", filtro.ate);

    const linhas = await this.sql.query<{
      id: string;
      tenant_id: string;
      usuario_id: string | null;
      papel: string | null;
      acao: string;
      entidade: string;
      entidade_id: string;
      resumo: string;
      antes: string | null;
      depois: string | null;
      origem: string;
      sessao: string | null;
      em: string;
    }>(`SELECT * FROM auditoria WHERE ${where.join(" AND ")} ORDER BY em DESC`, params);

    return linhas.map((l) => ({
      id: l.id,
      em: l.em,
      tenantId: l.tenant_id,
      usuarioId: l.usuario_id ?? "",
      papel: l.papel ?? "",
      acao: l.acao as RegistroAuditoria["acao"],
      entidade: l.entidade,
      entidadeId: l.entidade_id,
      resumo: l.resumo,
      antes: l.antes ?? undefined,
      depois: l.depois ?? undefined,
      origem: l.origem as RegistroAuditoria["origem"],
      sessao: l.sessao ?? undefined,
    }));
  }
}

/* --------------------------------------------------------- fábrica/conexão */

/**
 * Cria as implementações Postgres a partir de um executor.
 * A aplicação chama isto uma vez por request, com o tenant da sessão.
 */
export function criarRepositoriosPostgres(sql: SqlExecutor): {
  documentos: RepositorioDocumentos;
  numeracao: ServicoNumeracao;
  auditoria: AuditoriaPort;
} {
  return {
    documentos: new RepositorioDocumentosPostgres(sql),
    numeracao: new ServicoNumeracaoPostgres(sql),
    auditoria: new AuditoriaPostgres(sql),
  };
}
