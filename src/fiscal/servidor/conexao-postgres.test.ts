/**
 * TESTES DO EXECUTOR POSTGRES (`conexao-postgres.ts`).
 *
 * Com pool falso. O que se valida é a lógica de transação — não a conexão real,
 * que não pode ser exercitada aqui (nenhum Postgres provisionado):
 *
 *   1. `BEGIN` … `COMMIT` em volta do trabalho, e `ROLLBACK` em qualquer erro;
 *   2. o tenant entra como **parâmetro vinculado** de `set_config`, nunca
 *      interpolado no texto do SQL — `SET LOCAL` não aceita parâmetro no
 *      Postgres, e a saída ingênua seria concatenar string;
 *   3. a conexão é sempre devolvida ao pool (`release`), inclusive em erro;
 *   4. transação aninhada reaproveita a conexão em vez de abrir outra.
 */

import { describe, expect, it, vi } from "vitest";
import { ExecutorCliente, ExecutorPg, criarPool, urlDoBanco } from "./conexao-postgres";

interface Chamada {
  sql: string;
  params: unknown[];
}

class PoolFalso {
  chamadas: Chamada[] = [];
  transacional = 0;
  liberados = 0;
  falharEm: string | undefined;

  private cliente = {
    query: vi.fn(async (sql: string, params: unknown[] = []) => {
      this.chamadas.push({ sql, params });
      if (this.falharEm && sql.includes(this.falharEm)) throw new Error("falha simulada");
      return { rows: [] as Record<string, unknown>[] };
    }),
    release: () => {
      this.liberados += 1;
    },
  };

  async connect() {
    this.transacional += 1;
    return this.cliente;
  }

  async query(sql: string, params: unknown[] = []) {
    this.chamadas.push({ sql, params });
    return { rows: [] as Record<string, unknown>[] };
  }

  async end() {}
}

describe("ExecutorPg.emTransacao", () => {
  it("abre transação, fixa o tenant por parâmetro e commita", async () => {
    const pool = new PoolFalso();
    const executor = new ExecutorPg(pool as never);

    await executor.emTransacao("tenant-a", async (tx) => {
      await tx.query("SELECT 1", []);
    });

    const sqls = pool.chamadas.map((c) => c.sql);
    expect(sqls[0]).toBe("BEGIN");
    expect(sqls[1]).toContain("set_config('app.tenant_id', $1, true)");
    expect(sqls.at(-1)).toBe("COMMIT");

    // O tenant é PARÂMETRO, não texto.
    const setConfig = pool.chamadas.find((c) => c.sql.includes("set_config"));
    expect(setConfig?.params).toEqual(["tenant-a"]);
    expect(setConfig?.sql).not.toContain("tenant-a");
  });

  it("faz ROLLBACK e propaga o erro quando o trabalho falha", async () => {
    const pool = new PoolFalso();
    pool.falharEm = "SELECT quebra";
    const executor = new ExecutorPg(pool as never);

    await expect(
      executor.emTransacao("tenant-a", async (tx) => {
        await tx.query("SELECT quebra", []);
      }),
    ).rejects.toThrow("falha simulada");

    const sqls = pool.chamadas.map((c) => c.sql);
    expect(sqls).toContain("BEGIN");
    expect(sqls).toContain("ROLLBACK");
    expect(sqls).not.toContain("COMMIT");
  });

  it("devolve a conexão ao pool mesmo em erro", async () => {
    const pool = new PoolFalso();
    pool.falharEm = "SELECT quebra";
    const executor = new ExecutorPg(pool as never);
    await expect(
      executor.emTransacao("tenant-a", (tx) => tx.query("SELECT quebra", [])),
    ).rejects.toThrow();
    expect(pool.liberados).toBe(1);
  });

  it("transação aninhada reaproveita a conexão, sem segundo BEGIN", async () => {
    const pool = new PoolFalso();
    const executor = new ExecutorPg(pool as never);

    await executor.emTransacao("tenant-a", async (tx) => {
      await tx.emTransacao("tenant-a", async (tx2) => {
        await tx2.query("SELECT 1", []);
      });
    });

    expect(pool.chamadas.filter((c) => c.sql === "BEGIN")).toHaveLength(1);
    // O tenant é reafirmado na transação interna (mesmo valor, mesma conexão).
    expect(pool.chamadas.filter((c) => c.sql.includes("set_config"))).toHaveLength(2);
  });
});

describe("ExecutorPg.query", () => {
  it("usa o pool diretamente e devolve as linhas", async () => {
    const pool = new PoolFalso();
    const executor = new ExecutorPg(pool as never);
    await executor.query("SELECT now()", []);
    expect(pool.chamadas.at(-1)?.sql).toBe("SELECT now()");
  });
});

describe("ExecutorCliente", () => {
  it("fixa o tenant antes de delegar", async () => {
    const chamadas: Chamada[] = [];
    const cliente = {
      query: async (sql: string, params: unknown[] = []) => {
        chamadas.push({ sql, params });
        return { rows: [] };
      },
    };
    const executor = new ExecutorCliente(cliente as never);
    await executor.emTransacao("tenant-z", (tx) => tx.query("SELECT 1", []));
    expect(chamadas[0]?.sql).toContain("set_config");
    expect(chamadas[0]?.params).toEqual(["tenant-z"]);
  });
});

describe("urlDoBanco", () => {
  it("prefere SUPABASE_DB_URL (Lovable Cloud) e cai para DATABASE_URL", () => {
    const anterior = { ...process.env };
    try {
      delete process.env["SUPABASE_DB_URL"];
      delete process.env["DATABASE_URL"];
      expect(urlDoBanco()).toBeUndefined();

      process.env["DATABASE_URL"] = "postgres://generico";
      expect(urlDoBanco()).toBe("postgres://generico");

      process.env["SUPABASE_DB_URL"] = "postgres://lovable";
      expect(urlDoBanco()).toBe("postgres://lovable");
    } finally {
      process.env = anterior;
    }
  });

  it("criarPool falha alto sem string de conexão", () => {
    const anterior = { ...process.env };
    try {
      delete process.env["SUPABASE_DB_URL"];
      delete process.env["DATABASE_URL"];
      expect(() => criarPool()).toThrow(/Nenhuma string de conexão/);
    } finally {
      process.env = anterior;
    }
  });

  it("criarPool aceita uma string explícita (usado em teste de integração)", () => {
    const pool = criarPool({ connectionString: "postgres://usuario:senha@host:5432/db" });
    expect(pool).toBeDefined();
    void pool.end();
  });
});
