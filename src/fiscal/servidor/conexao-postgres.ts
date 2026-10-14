/**
 * CONEXÃO POSTGRES — implementação concreta de `SqlExecutor` com `pg`.
 *
 * ============================================================================
 * ONDE ISTO RODA
 * ============================================================================
 * Exclusivamente no servidor. `pg` importa `node:net`/`node:tls`; se este módulo
 * entrasse no grafo do cliente, o bundler externalizaria esses módulos Node e o
 * bundle do navegador carregaria lixo. Por isso ele **não** é importado
 * estaticamente por nada alcançável a partir de uma rota — só por
 * `import()` dinâmico dentro de `handler()` de funções de servidor, e por
 * outros módulos de servidor. A regra de lint (`eslint.config.js`) reforça isso.
 *
 * ============================================================================
 * LOVABLE CLOUD
 * ============================================================================
 * O backend do Lovable Cloud é Supabase (Postgres gerenciado). A conexão vem de
 * `SUPABASE_DB_URL` (injetado pelo Lovable) ou `DATABASE_URL` (genérico).
 *
 * **A conexão é feita como o role `postgres`, NÃO como `service_role`.**
 * Isso é deliberado e é a razão de a RLS do migration 001 funcionar: o role
 * `service_role` tem `BYPASSRLS` e ignoraria completamente as políticas de
 * isolamento por tenant. O role `postgres` **respeita** RLS — e o migration usa
 * `FORCE ROW LEVEL SECURITY`, que sujeita até o dono da tabela à política.
 *
 * ============================================================================
 * O QUE AINDA NÃO ESTÁ PROVADO
 * ============================================================================
 * Este módulo nunca conversou com um Postgres real: não existe banco
 * provisionado neste ambiente de desenvolvimento. O que está testado é a
 * *lógica* do executor (BEGIN/COMMIT/ROLLBACK, `set_config` transacional com
 * parâmetro vinculado, liberação do cliente) contra um pool falso. A conexão de
 * verdade — SSL, pooler, latência — precisa ser validada contra a instância.
 */

import { Pool, type PoolClient } from "pg";
import type { SqlExecutor } from "@/fiscal/persistencia-postgres";
import { urlDoBanco } from "./ambiente";

/* ------------------------------------------------------------------ configuração */

export interface OpcoesConexao {
  connectionString: string;
  /** `false` desliga SSL; `{rejectUnauthorized:false}` aceita certificado não verificável. */
  ssl?: false | { rejectUnauthorized: boolean };
  max?: number;
  /** Tempo ocioso antes de liberar a conexão, em ms. */
  idleTimeoutMillis?: number;
  /** Tempo máximo de uma conexão ociosa no pool, em ms. */
  connectionTimeoutMillis?: number;
}

function sslDasOpcoes(): OpcoesConexao["ssl"] {
  const modo = (process.env["DATABASE_SSL"] ?? "").toLowerCase();
  if (modo === "disable" || modo === "off" || modo === "false") return false;
  if (modo === "no-verify" || modo === "insecure") return { rejectUnauthorized: false };
  // Supabase exige TLS com certificado público válido: verificação ligada.
  return { rejectUnauthorized: true };
}

// `urlDoBanco` vive em `ambiente.ts` (sem dependências) para que módulos
// alcançáveis por rotas possam lê-la sem arrastar o `pg` para o cliente.
export { urlDoBanco };

export function criarPool(opcoes?: Partial<OpcoesConexao>): Pool {
  const connectionString = opcoes?.connectionString ?? urlDoBanco();
  if (!connectionString) {
    throw new Error(
      "Nenhuma string de conexão: defina SUPABASE_DB_URL (Lovable Cloud) ou DATABASE_URL.",
    );
  }
  return new Pool({
    connectionString,
    ssl: opcoes?.ssl ?? sslDasOpcoes(),
    max: opcoes?.max ?? Number(process.env["DATABASE_POOL_MAX"] ?? 10),
    idleTimeoutMillis: opcoes?.idleTimeoutMillis ?? 30_000,
    connectionTimeoutMillis: opcoes?.connectionTimeoutMillis ?? 10_000,
    // `pg` não guarda prepared statements entre conexões; manter explícito evita
    // surpresa com o pooler do Supabase em modo transação.
    statement_timeout: Number(process.env["DATABASE_STATEMENT_TIMEOUT_MS"] ?? 15_000),
  });
}

/* -------------------------------------------------------------------- executor */

/**
 * `SET LOCAL` **não aceita parâmetro vinculado** no Postgres — é um utility
 * statement. A forma correta de fazer a mesma coisa sem interpolar o tenant no
 * texto do SQL é `set_config(nome, $1, true)`: o terceiro argumento `true` torna
 * o valor local à transação, exatamente o escopo de `SET LOCAL`.
 */
const SQL_TENANT_TRANSACAO = "SELECT set_config('app.tenant_id', $1, true)";

/** Executor sobre uma conexão já obtida do pool (usado dentro da transação). */
export class ExecutorCliente implements SqlExecutor {
  constructor(private readonly client: PoolClient) {}

  async query<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
    const resultado = await this.client.query(sql, params as unknown[]);
    return resultado.rows as T[];
  }

  async emTransacao<T>(tenantId: string, fn: (tx: SqlExecutor) => Promise<T>): Promise<T> {
    // A transação já foi aberta por `ExecutorPg`; uma transação aninhada não
    // existe em Postgres. Reaproveitar a mesma conexão é o comportamento seguro.
    await this.client.query(SQL_TENANT_TRANSACAO, [tenantId]);
    return fn(this);
  }
}

/** Executor sobre o pool: cada `query` pega uma conexão livre. */
export class ExecutorPg implements SqlExecutor {
  constructor(private readonly pool: Pool) {}

  async query<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
    const resultado = await this.pool.query(sql, params as unknown[]);
    return resultado.rows as T[];
  }

  /**
   * Abre transação, fixa o tenant para a duração dela e commita.
   *
   * Qualquer erro faz ROLLBACK e propaga — uma transação parcialmente aplicada
   * seria pior que a falha visível.
   */
  async emTransacao<T>(tenantId: string, fn: (tx: SqlExecutor) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(SQL_TENANT_TRANSACAO, [tenantId]);
      const resultado = await fn(new ExecutorCliente(client));
      await client.query("COMMIT");
      return resultado;
    } catch (erro) {
      await client.query("ROLLBACK").catch(() => {
        /* a conexão pode já estar em estado de erro; o `finally` a devolve */
      });
      throw erro;
    } finally {
      client.release();
    }
  }
}

/* --------------------------------------------------------------------- fábrica */

let pool: Pool | undefined;
let executor: ExecutorPg | undefined;

/**
 * Pool único por processo (lazy). Criar pool no import do módulo quebraria o
 * build do cliente e exigiria `DATABASE_URL` em tempo de compilação.
 */
export function obterExecutor(): ExecutorPg {
  if (!executor) {
    pool = criarPool();
    executor = new ExecutorPg(pool);
  }
  return executor;
}

/** Encerra o pool (testes e desligamento gracioso). */
export async function fecharPool(): Promise<void> {
  await pool?.end();
  pool = undefined;
  executor = undefined;
}

/** Saúde da conexão: usada por verificações manuais, não por caminho de request. */
export async function testarConexao(): Promise<
  { ok: true; agora: string } | { ok: false; erro: string }
> {
  try {
    const linhas = await obterExecutor().query<{ agora: string }>("SELECT now() AS agora");
    return { ok: true, agora: linhas[0]?.agora ?? "" };
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : String(e) };
  }
}
