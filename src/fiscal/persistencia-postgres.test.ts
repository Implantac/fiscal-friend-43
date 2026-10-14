import { describe, expect, it } from "vitest";
import {
  AuditoriaPostgres,
  ErroPersistencia,
  RepositorioDocumentosPostgres,
  ServicoNumeracaoPostgres,
  type SqlExecutor,
} from "./persistencia-postgres";
import { criarDocumento, type DocumentoFiscal } from "./ciclo-vida";

/**
 * Executor SQL falso que simula o comportamento do Postgres para as queries
 * usadas pelo repositório. O objetivo dos testes NÃO é validar SQL contra um
 * banco real (isso é teste de integração), e sim validar as garantias de
 * segurança da camada:
 *
 *   1. nenhum valor de dado é interpolado no texto do SQL;
 *   2. o tenant está sempre em `params` e é aplicado via `SET LOCAL`;
 *   3. a numeração é atômica (uma única instrução);
 *   4. o mapeamento linha → domínio preserva os campos.
 */
class SqlFalso implements SqlExecutor {
  queries: { sql: string; params: unknown[] }[] = [];
  transacoes: string[] = [];
  private numeracao = new Map<string, number>();
  private documentos = new Map<string, Record<string, unknown>>();
  private contadorAuditoria = 0;

  async query<T>(sql: string, params: unknown[] = []): Promise<T[]> {
    this.queries.push({ sql, params });

    const numeracaoInsert =
      /INSERT INTO numeracao[\s\S]*?ON CONFLICT[\s\S]*?DO UPDATE SET atual = numeracao\.atual \+ 1[\s\S]*?RETURNING atual/.exec(
        sql,
      );
    if (numeracaoInsert) {
      const [tenantId, estId, modelo, serie] = params as string[];
      const k = `${tenantId}|${estId}|${modelo}|${serie}`;
      const proximo = (this.numeracao.get(k) ?? 0) + 1;
      this.numeracao.set(k, proximo);
      return [{ atual: String(proximo) }] as T[];
    }

    const numSelect = /SELECT atual FROM numeracao/.exec(sql);
    if (numSelect) {
      const [tenantId, estId, modelo, serie] = params as string[];
      const atual = this.numeracao.get(`${tenantId}|${estId}|${modelo}|${serie}`) ?? 0;
      return [{ atual: String(atual) }] as T[];
    }

    const auditoriaInsert = /INSERT INTO auditoria/.exec(sql);
    if (auditoriaInsert) {
      this.contadorAuditoria += 1;
      return [{ id: `aud-${this.contadorAuditoria}` }] as T[];
    }

    const docInsert = /INSERT INTO documentos_fiscais/.exec(sql);
    if (docInsert) {
      const [
        id,
        tenantId,
        empresaId,
        estId,
        familia,
        modelo,
        serie,
        numero,
        chave,
        estado,
        ambiente,
        xml,
        versao,
        protocolo,
        cStat,
        idempotencia,
        valorCentavos,
        criadoEm,
        atualizadoEm,
      ] = params;
      this.documentos.set(String(id), {
        id,
        tenant_id: tenantId,
        empresa_id: empresaId,
        estabelecimento_id: estId,
        familia,
        modelo,
        serie,
        numero,
        chave,
        estado,
        ambiente,
        xml,
        versao_leiaute: versao,
        protocolo,
        c_stat: cStat,
        idempotencia,
        valor_total_centavos: valorCentavos,
        criado_em: criadoEm,
        atualizado_em: atualizadoEm,
      });
      return [] as T[];
    }

    const docSelectId = /FROM documentos_fiscais WHERE tenant_id = \$1 AND id = \$2/.exec(sql);
    if (docSelectId) {
      const [tenantId, id] = params as string[];
      const doc = this.documentos.get(String(id));
      return doc && doc["tenant_id"] === tenantId ? ([doc] as T[]) : ([] as T[]);
    }

    const docSelectIdem =
      /FROM documentos_fiscais WHERE tenant_id = \$1 AND idempotencia = \$2/.exec(sql);
    if (docSelectIdem) {
      const [tenantId, idem] = params as string[];
      const achado = [...this.documentos.values()].find(
        (d) => d["tenant_id"] === tenantId && d["idempotencia"] === idem,
      );
      return achado ? ([achado] as T[]) : ([] as T[]);
    }

    return [] as T[];
  }

  async emTransacao<T>(tenantId: string, fn: (tx: SqlExecutor) => Promise<T>): Promise<T> {
    this.transacoes.push(tenantId);
    return fn(this);
  }
}

const base = {
  id: "doc-1",
  tenantId: "t1",
  empresaId: "emp-1",
  estabelecimentoId: "est-1",
  familia: "nfe55" as const,
  modelo: "55",
  serie: "1",
  numero: "1",
  ambiente: 2 as const,
  valorTotalCentavos: 0n,
};

function doc(over: Partial<DocumentoFiscal> = {}): DocumentoFiscal {
  return { ...criarDocumento(base, "2026-10-14T10:00:00-03:00"), ...over };
}

describe("RepositorioDocumentosPostgres", () => {
  it("nunca interpola valores de dados no SQL", async () => {
    const sql = new SqlFalso();
    const repo = new RepositorioDocumentosPostgres(sql);
    const perigoso = doc({ chave: "'; DROP TABLE documentos_fiscais; --" });

    await repo.salvar(perigoso);

    for (const q of sql.queries) {
      expect(q.sql).not.toContain("DROP TABLE");
      expect(q.sql).not.toContain("';");
      // Toda query usa apenas parâmetros posicionais.
      expect(q.sql).not.toMatch(/'[^']*'/);
    }
  });

  it("o valor perigoso trafega como parâmetro vinculado", async () => {
    const sql = new SqlFalso();
    const repo = new RepositorioDocumentosPostgres(sql);
    const chave = "'; DROP TABLE documentos_fiscais; --";
    await repo.salvar(doc({ chave }));
    const insert = sql.queries.find((q) => q.sql.includes("INSERT INTO documentos_fiscais"))!;
    expect(insert.params).toContain(chave);
    expect(insert.params[0]).toBe("doc-1"); // id é o primeiro parâmetro
  });

  it("toda query de escrita passa pelo tenant da sessão", async () => {
    const sql = new SqlFalso();
    const repo = new RepositorioDocumentosPostgres(sql);
    await repo.salvar(doc());
    expect(sql.transacoes).toEqual(["t1"]);
  });

  it("faz round-trip preservando todos os campos", async () => {
    const sql = new SqlFalso();
    const repo = new RepositorioDocumentosPostgres(sql);
    const original = doc({
      chave: "35261000000000000191550010000000012345678901",
      xml: "<NFe>...</NFe>",
      versaoLeiaute: "4.00",
      idempotencia: "idem-1",
    });
    await repo.salvar(original);

    const lido = await repo.obterPorId("t1", "doc-1");
    expect(lido).toBeDefined();
    expect(lido!.chave).toBe(original.chave);
    expect(lido!.xml).toBe(original.xml);
    expect(lido!.versaoLeiaute).toBe("4.00");
    expect(lido!.idempotencia).toBe("idem-1");
    expect(lido!.ambiente).toBe(2);
    expect(lido!.estado).toBe("simulacao");
  });

  it("o valor em centavos faz round-trip como inteiro exato", async () => {
    const sql = new SqlFalso();
    const repo = new RepositorioDocumentosPostgres(sql);
    // Valor acima de 2^53 centavos: Number() perderia precisão aqui, BigInt não.
    const grande = 9007199254740993n; // 2^53 + 1
    await repo.salvar(doc({ valorTotalCentavos: grande }));

    const insert = sql.queries.find((q) => q.sql.includes("INSERT INTO documentos_fiscais"))!;
    // O driver `pg` não aceita bigint: trafega como string, sem perder casas.
    expect(insert.params).toContain(String(grande));

    const lido = await repo.obterPorId("t1", "doc-1");
    expect(lido!.valorTotalCentavos).toBe(grande);
  });

  it("isolamento por tenant na leitura", async () => {
    const sql = new SqlFalso();
    const repo = new RepositorioDocumentosPostgres(sql);
    await repo.salvar(doc({ id: "doc-1", tenantId: "t1" }));
    await repo.salvar(doc({ id: "doc-2", tenantId: "t2" }));

    expect(await repo.obterPorId("t1", "doc-2")).toBeUndefined();
    expect(await repo.obterPorId("t2", "doc-1")).toBeUndefined();
    expect(await repo.obterPorId("t1", "doc-1")).toBeDefined();
  });

  it("busca por idempotência respeita o tenant", async () => {
    const sql = new SqlFalso();
    const repo = new RepositorioDocumentosPostgres(sql);
    await repo.salvar(doc({ idempotencia: "idem-x" }));
    expect((await repo.obterPorIdempotencia("t1", "idem-x"))?.id).toBe("doc-1");
    expect(await repo.obterPorIdempotencia("t2", "idem-x")).toBeUndefined();
  });

  it("constrói o WHERE dinamicamente sem abrir brecha de injeção", async () => {
    const sql = new SqlFalso();
    const repo = new RepositorioDocumentosPostgres(sql);
    await repo.listar("t1", {
      estado: "autorizado",
      familia: "nfe55",
      chave: "x' OR '1'='1",
    });
    const select = sql.queries.at(-1)!;
    expect(select.sql).toContain("tenant_id = $1");
    // A ordem segue a ordem de aplicação dos filtros no repositório.
    expect(select.sql).toContain("familia = $2");
    expect(select.sql).toContain("estado = $3");
    expect(select.sql).toContain("chave = $4");
    expect(select.params).toContain("x' OR '1'='1");
    expect(select.sql).not.toContain("OR '1'='1");
  });
});

describe("ServicoNumeracaoPostgres", () => {
  const chave = { tenantId: "t1", estabelecimentoId: "est-1", modelo: "55", serie: "1" };

  it("reserva com uma única instrução atômica", async () => {
    const sql = new SqlFalso();
    const s = new ServicoNumeracaoPostgres(sql);
    await s.reservar(chave, "idem-1");

    expect(sql.queries).toHaveLength(1);
    expect(sql.queries[0]!.sql).toContain("ON CONFLICT");
    expect(sql.queries[0]!.sql).toContain("DO UPDATE SET atual = numeracao.atual + 1");
    expect(sql.queries[0]!.sql).not.toContain("SELECT");
    expect(sql.queries[0]!.params).toEqual(["t1", "est-1", "55", "1"]);
  });

  it("numera sequencialmente", async () => {
    const sql = new SqlFalso();
    const s = new ServicoNumeracaoPostgres(sql);
    expect((await s.reservar(chave, "a")).numero).toBe("1");
    expect((await s.reservar(chave, "b")).numero).toBe("2");
    expect(await s.atual(chave)).toBe(2);
  });

  it("séries são independentes", async () => {
    const sql = new SqlFalso();
    const s = new ServicoNumeracaoPostgres(sql);
    await s.reservar(chave, "a");
    expect((await s.reservar({ ...chave, serie: "2" }, "b")).numero).toBe("1");
  });

  it("recusa reserva sem chave de idempotência", async () => {
    const s = new ServicoNumeracaoPostgres(new SqlFalso());
    await expect(s.reservar(chave, "")).rejects.toThrow(ErroPersistencia);
  });

  it("inutilização exige justificativa e intervalo válido", async () => {
    const s = new ServicoNumeracaoPostgres(new SqlFalso());
    await expect(s.inutilizar(chave, 7, 5, "justificativa longa o suficiente")).rejects.toThrow(
      ErroPersistencia,
    );
    await expect(s.inutilizar(chave, 5, 7, "curta")).rejects.toThrow(/15 caracteres/);
    await expect(
      s.inutilizar(chave, 5, 7, "justificativa longa o suficiente"),
    ).resolves.toBeUndefined();
  });

  it("inutilização registra os parâmetros, sem interpolar", async () => {
    const sql = new SqlFalso();
    const s = new ServicoNumeracaoPostgres(sql);
    await s.inutilizar(chave, 5, 7, "justificativa longa o suficiente");
    expect(sql.queries[0]!.params).toEqual([
      "t1",
      "est-1",
      "55",
      "1",
      5,
      7,
      "justificativa longa o suficiente",
    ]);
    expect(sql.queries[0]!.sql).not.toContain("justificativa longa");
  });
});

describe("AuditoriaPostgres", () => {
  it("registra com parâmetros vinculados e devolve o id", async () => {
    const sql = new SqlFalso();
    const aud = new AuditoriaPostgres(sql);
    const r = await aud.registrar({
      em: "2026-10-14T10:00:00-03:00",
      tenantId: "t1",
      usuarioId: "u1",
      papel: "operador",
      acao: "documento.transmitido",
      entidade: "documento",
      entidadeId: "doc-1",
      resumo: "Transmitido",
      origem: "sistema",
    });
    expect(r.id).toBe("aud-1");
    expect(sql.queries[0]!.params[0]).toBe("t1");
    expect(sql.queries[0]!.sql).not.toContain("Transmitido");
  });

  it("filtra sempre pelo tenant", async () => {
    const sql = new SqlFalso();
    const aud = new AuditoriaPostgres(sql);
    await aud.listar({ tenantId: "t1", acao: "documento.autorizado" });
    expect(sql.queries[0]!.sql).toContain("tenant_id = $1");
    expect(sql.queries[0]!.sql).toContain("acao = $2");
  });
});
