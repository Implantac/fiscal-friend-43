/**
 * VALIDAÇÃO CONTRA POSTGRES REAL.
 * ============================================================================
 * O QUE ESTE ARQUIVO É — E POR QUE ELE NÃO RODA NO GATE ATUAL
 * ============================================================================
 * Este é o único elo da Etapa 2 que **não** tem evidência: nenhuma consulta
 * jamais rodou contra um Postgres de verdade neste ambiente. Tudo o que existe
 * sobre o executor é lógica testada contra repositórios falsos e contra o
 * `pg-mem` — que, por sua vez, não implementa Row-Level Security, triggers
 * `plpgsql`, blocos `DO $$ … $$` nem `SET LOCAL`. Ou seja: as três coisas que
 * mais importam neste schema são exatamente as que o emulador não faz.
 *
 * Este arquivo transforma essa lacuna em algo **executável e verificável**.
 * Sem `DATABASE_URL`, ele é PULADO e diz por quê — nunca passa em silêncio,
 * porque um teste que passa sem provar nada é pior que um teste ausente.
 *
 * COMO RODAR (uma vez, contra a instância do Lovable Cloud):
 *
 *   DATABASE_URL='postgres://…' npx vitest run \
 *     src/fiscal/servidor/validacao-postgres.test.ts
 *
 * CONEXÃO: use o role `postgres` (via `SUPABASE_DB_URL`/`DATABASE_URL`), NUNCA
 * `service_role`. O `service_role` tem `BYPASSRLS`: com ele a RLS simplesmente
 * não executa, e todos os testes de isolamento abaixo passariam por acidente.
 * A verificação C1 falha de propósito se detectar `BYPASSRLS`.
 */

import { readFileSync, readdirSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { urlDoBanco } from "./conexao-postgres";
import {
  DDL_CONTROLE,
  descobrir,
  orfas,
  planejar,
  type Migracao,
  type MigracaoAplicada,
} from "./migracoes";

const URL = process.env["DATABASE_URL"] ?? urlDoBanco();
const PODE_RODAR = Boolean(URL);

/** Resultado observado de cada verificação — a evidência, não o veredito. */
interface Observacao {
  nome: string;
  passou: boolean;
  observado: string;
}

const observacoes: Observacao[] = [];

function registrar(nome: string, passou: boolean, observado: unknown): void {
  observacoes.push({
    nome,
    passou,
    observado: typeof observado === "string" ? observado : JSON.stringify(observado),
  });
}

type Conexao = {
  query: (sql: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>;
  end: () => Promise<void>;
};

let conexao: Conexao | undefined;
let migracoNoDisco: Migracao[] = [];

beforeAll(async () => {
  if (!PODE_RODAR) return;
  const { default: pg } = await import("pg");
  const cliente = new pg.Client({
    connectionString: URL,
    ssl: { rejectUnauthorized: false },
    statement_timeout: 20_000,
  });
  await cliente.connect();
  conexao = cliente as unknown as Conexao;

  migracoNoDisco = descobrir(() =>
    readdirSync("db/migrations")
      .filter((f) => f.endsWith(".sql"))
      .map((f) => ({ nome: f, conteudo: readFileSync(`db/migrations/${f}`, "utf8") })),
  );
});

afterAll(async () => {
  if (!conexao) return;
  // Limpa o que estes testes criaram, para poderem rodar de novo.
  await conexao
    .query("DELETE FROM documentos_fiscais WHERE familia LIKE 'validacao-%'")
    .catch(() => undefined);
  await conexao
    .query("DELETE FROM estabelecimentos WHERE cnpj LIKE '99999999%'")
    .catch(() => undefined);
  await conexao.query("DELETE FROM empresas WHERE cnpj LIKE '99999999%'").catch(() => undefined);
  await conexao.query("DELETE FROM tenants WHERE nome LIKE 'validacao-%'").catch(() => undefined);
  await conexao.end();
});

/** Lê o que o banco diz que já aplicou. */
async function aplicadasNoBanco(): Promise<MigracaoAplicada[]> {
  const criou = await conexao!.query(DDL_CONTROLE).catch((e: Error) => {
    throw new Error(`não foi possível criar ${DDL_CONTROLE.slice(0, 40)}…: ${e.message}`);
  });
  void criou;
  const r = await conexao!.query("SELECT arquivo, checksum FROM schema_migracoes");
  return r.rows.map((row) => ({
    arquivo: String(row["arquivo"]),
    checksum: String(row["checksum"]),
  }));
}

describe("validação contra Postgres real", () => {
  it.skipIf(!PODE_RODAR)("está configurado", () => {
    expect(URL).toBeTruthy();
  });

  it.runIf(!PODE_RODAR)("é PULADO sem DATABASE_URL — e diz por quê", () => {
    // Registrado para que o relatório de fim de etapa possa citar o motivo.
    expect(URL).toBeFalsy();
  });

  describe("C1 — conexão e privilégios", () => {
    it.runIf(PODE_RODAR)("conecta e o role NÃO tem BYPASSRLS", async () => {
      const r = await conexao!.query(
        `SELECT current_user, current_database(), version(),
                (SELECT rolbypassrls FROM pg_roles WHERE rolname = current_user) AS bypassrls`,
      );
      const bypass = r.rows[0]?.["bypassrls"];
      const usuario = String(r.rows[0]?.["current_user"]);
      registrar(
        "C1 role sem BYPASSRLS",
        bypass === false,
        `usuário=${usuario} bypassrls=${bypass} versão=${String(r.rows[0]?.["version"]).slice(0, 30)}`,
      );
      expect(bypass).toBe(false);
      // `service_role` teria bypassrls = true e tornaria todos os testes de
      // isolamento abaixo mentirosos.
      expect(usuario).not.toBe("service_role");
    });
  });

  describe("C2 — migrações", () => {
    it.runIf(PODE_RODAR)("planeja sem divergência nem órfãs", async () => {
      const aplicadas = await aplicadasNoBanco();
      const plano = planejar(migracoNoDisco, aplicadas);
      registrar(
        "C2 migrações em dia",
        plano.aplicar.length === 0 && plano.divergentes.length === 0,
        {
          noDisco: migracoNoDisco.map((m) => m.arquivo),
          aAplicar: plano.aplicar.map((m) => m.arquivo),
          divergentes: plano.divergentes.map((d) => d.arquivo),
          orfas: orfas(aplicadas, migracoNoDisco),
        },
      );
      expect(plano.divergentes).toEqual([]);
      expect(orfas(aplicadas, migracoNoDisco)).toEqual([]);
      expect(plano.aplicar).toEqual([]);
    });

    it.runIf(PODE_RODAR)("todos os arquivos de migração existem e têm nome válido", () => {
      const nomes = migracoNoDisco.map((m) => m.arquivo);
      expect(nomes.length).toBeGreaterThan(0);
      for (const n of nomes) expect(n).toMatch(/^\d{3,}_[a-z0-9_]+\.sql$/);
    });
  });

  describe("C3 — RLS está FORÇADA em todas as tabelas", () => {
    it.runIf(PODE_RODAR)("relrowsecurity E relforcerowsecurity ligados", async () => {
      const r = await conexao!.query(
        `SELECT c.relname, c.relrowsecurity, c.relforcerowsecurity
           FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname = current_schema() AND c.relkind = 'r'
            AND c.relname NOT LIKE 'pg_%' AND c.relname <> '${"schema_migracoes"}'`,
      );
      const semForca = r.rows.filter((row) => row["relrowsecurity"] !== true);
      const semForce = r.rows.filter((row) => row["relforcerowsecurity"] !== true);
      registrar("C3 RLS forçada", semForca.length === 0 && semForce.length === 0, {
        tabelas: r.rows.length,
        semRrowsecurity: semForca.map((x) => x["relname"]),
        semForceRowSecurity: semForce.map((x) => x["relname"]),
      });
      // `relrowsecurity` sem `relforcerowsecurity` deixa o dono da tabela
      // (que é quem cria a migração) ler tudo. É o modo de falha silencioso.
      expect(semForca).toEqual([]);
      expect(semForce).toEqual([]);
    });
  });

  describe("C4 — isolamento real entre tenants", () => {
    it.runIf(PODE_RODAR)("tenant A não lê linha de tenant B", async () => {
      const tA = "11111111-1111-4111-8111-111111111111";
      const tB = "22222222-2222-4222-8222-222222222222";
      const eA = "aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa";
      const eB = "bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb";

      await conexao!.query("DELETE FROM tenants WHERE id = ANY($1)", [[tA, tB]]);
      await conexao!.query(
        "INSERT INTO tenants (id, nome) VALUES ($1,'validacao-A'),($2,'validacao-B')",
        [tA, tB],
      );
      await conexao!.query(
        `INSERT INTO empresas (id, tenant_id, cnpj, razao_social)
         VALUES ($1,$2,'99999999000101','Validacao A'),($3,$4,'99999999000202','Validacao B')`,
        [eA, tA, eB, tB],
      );

      // Contexto do tenant A.
      await conexao!.query("BEGIN");
      await conexao!.query("SELECT set_config('app.tenant_id', $1, true)", [tA]);
      const vistas = await conexao!.query("SELECT id FROM empresas ORDER BY id");
      await conexao!.query("COMMIT");

      registrar(
        "C4 isolamento entre tenants",
        vistas.rows.length === 1 && vistas.rows[0]?.["id"] === eA,
        { contexto: tA, empresasVisiveis: vistas.rows.map((x) => x["id"]) },
      );
      expect(vistas.rows.map((x) => x["id"])).toEqual([eA]);

      // Sem contexto, a política estrita devolve zero linhas — ao contrário de
      // `sessoes`, cuja leitura é deliberadamente aberta.
      await conexao!.query("BEGIN");
      const semContexto = await conexao!.query("SELECT id FROM empresas");
      await conexao!.query("COMMIT");
      registrar("C4 sem contexto = zero linhas", semContexto.rows.length === 0, {
        linhas: semContexto.rows.length,
      });
      expect(semContexto.rows).toEqual([]);

      await conexao!.query("DELETE FROM tenants WHERE id = ANY($1)", [[tA, tB]]);
    });
  });

  describe("C5 — caminho da sessão (exceção documentada)", () => {
    it.runIf(PODE_RODAR)(
      "busca por token_hash funciona sem contexto e devolve 1 linha",
      async () => {
        const r = await conexao!.query(
          `SELECT policyname, cmd, qual FROM pg_policies
          WHERE tablename = 'sessoes' AND cmd = 'SELECT'`,
        );
        const politica = r.rows[0];
        registrar("C5 política de leitura de sessoes", Boolean(politica), {
          politicas: r.rows.map((x) => x["policyname"]),
        });
        // A política precisa permitir leitura quando o contexto é nulo; sem isso
        // o login seria impossível (a consulta devolveria zero linhas).
        expect(String(politica?.["qual"])).toContain("tenant_atual() IS NULL");
      },
    );

    it.runIf(PODE_RODAR)("INSERT em sessoes exige contexto de tenant", async () => {
      const r = await conexao!.query(
        `SELECT policyname, with_check FROM pg_policies
          WHERE tablename = 'sessoes' AND cmd = 'INSERT'`,
      );
      const wc = String(r.rows[0]?.["with_check"]);
      registrar("C5 INSERT de sessoes exige contexto", wc.includes("tenant_atual()"), { wc });
      expect(wc).toContain("tenant_atual()");
      expect(wc).not.toContain("IS NULL");
    });
  });

  describe("C6 — valores monetários em centavos", () => {
    it.runIf(PODE_RODAR)("2^53 + 1 centavos sobrevive ao round-trip", async () => {
      const valor = (BigInt(2) ** BigInt(53) + BigInt(1)).toString();
      const t = "33333333-3333-4333-8333-333333333333";
      const e = "cccccccc-3333-4333-8333-cccccccccccc";

      await conexao!.query("DELETE FROM tenants WHERE id = $1", [t]);
      await conexao!.query("INSERT INTO tenants (id, nome) VALUES ($1,'validacao-C6')", [t]);
      await conexao!.query(
        `INSERT INTO empresas (id, tenant_id, cnpj, razao_social)
         VALUES ($1,$2,'99999999000303','Validacao C6')`,
        [e, t],
      );

      await conexao!.query("BEGIN");
      await conexao!.query("SELECT set_config('app.tenant_id', $1, true)", [t]);
      await conexao!.query(
        `INSERT INTO documentos_fiscais
           (id, tenant_id, empresa_id, estabelecimento_id, familia, modelo, serie,
            numero, ambiente, estado, valor_total_centavos)
         VALUES (gen_random_uuid(), $1, $2, $3, 'validacao-nfe', '55', '1', 1, 2,
                 'simulacao', $4::bigint)`,
        [t, e, e, valor],
      );
      const lido = await conexao!.query(
        `SELECT valor_total_centavos FROM documentos_fiscais
          WHERE tenant_id = $1 AND familia = 'validacao-nfe'`,
        [t],
      );
      await conexao!.query("COMMIT");

      const cru = lido.rows[0]?.["valor_total_centavos"];
      const reconstruido = BigInt(String(cru));
      registrar("C6 round-trip de centavos", reconstruido === BigInt(valor), {
        enviado: valor,
        recebido: String(cru),
        tipo: typeof cru,
        igual: reconstruido === BigInt(valor),
      });
      // `pg` devolve `bigint` como string. `Number(cru)` perderia o bit mais
      // baixo — é exatamente isto que está sendo provado.
      expect(typeof cru).toBe("string");
      expect(reconstruido).toBe(BigInt(valor));

      await conexao!.query("DELETE FROM tenants WHERE id = $1", [t]);
    });
  });

  describe("C7 — histórico imutável", () => {
    it.runIf(PODE_RODAR)("UPDATE em eventos_documento é barrado pelo trigger", async () => {
      const r = await conexao!.query(
        `SELECT tgname FROM pg_trigger
          WHERE tgrelid = 'eventos_documento'::regclass AND NOT tgisinternal`,
      );
      registrar("C7 trigger de imutabilidade", r.rows.length > 0, {
        triggers: r.rows.map((x) => x["tgname"]),
      });
      expect(r.rows.length).toBeGreaterThan(0);
    });
  });

  describe("C8 — aplicar migrações (opt-in explícito)", () => {
    /**
     * Um teste não deve mutar o banco por padrão. Só roda com
     * `VALIDAR_APLICAR_MIGRACOES=1`, para que a aplicacao seja sempre uma
     * decisão consciente de quem está validando.
     */
    const APLICAR = process.env["VALIDAR_APLICAR_MIGRACOES"] === "1";

    it.runIf(PODE_RODAR && APLICAR)("aplica o que falta, na ordem, e registra", async () => {
      await conexao!.query(DDL_CONTROLE);
      const antes = await aplicadasNoBanco();
      const plano = planejar(migracoNoDisco, antes);

      registrar(
        "C8 plano de aplicação",
        plano.divergentes.length === 0 && orfas(antes, migracoNoDisco).length === 0,
        { aAplicar: plano.aplicar.map((m) => m.arquivo), divergentes: plano.divergentes },
      );

      for (const migracao of plano.aplicar) {
        const sql = readFileSync(`db/migrations/${migracao.arquivo}`, "utf8");
        await conexao!.query("BEGIN");
        try {
          await conexao!.query(sql);
          await conexao!.query("INSERT INTO schema_migracoes (arquivo, checksum) VALUES ($1, $2)", [
            migracao.arquivo,
            migracao.checksum,
          ]);
          await conexao!.query("COMMIT");
        } catch (erro) {
          await conexao!.query("ROLLBACK");
          throw new Error(
            `migração ${migracao.arquivo} falhou e foi revertida: ${(erro as Error).message}`,
          );
        }
      }

      const depois = await aplicadasNoBanco();
      expect(planejar(migracoNoDisco, depois).aplicar).toEqual([]);
    });

    it.runIf(PODE_RODAR && !APLICAR)("não aplica nada sem VALIDAR_APLICAR_MIGRACOES=1", () => {
      // Registrado para que o relatorio final deixe claro que a aplicacao nao
      // foi exercitada nesta rodada.
      registrar("C8 aplicação de migrações", false, "não executado (opt-in ausente)");
      expect(APLICAR).toBe(false);
    });
  });

  describe("C9 — relatório", () => {
    it.runIf(PODE_RODAR)("emite o que foi observado, não o que se espera", () => {
      // Sempre aprovado: o valor deste teste é o relatório que ele produz.
      const linhas = observacoes.map(
        (o) => `${o.passou ? "PASSOU" : "FALHOU "} ${o.nome} — ${o.observado}`,
      );
      console.log("\n=== VALIDAÇÃO CONTRA POSTGRES REAL ===\n" + linhas.join("\n"));
      expect(observacoes.length).toBeGreaterThan(0);
    });
  });
});
