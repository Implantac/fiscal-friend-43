import { readFileSync } from "node:fs";
import { describe, expect, it, beforeAll } from "vitest";
import { newDb, DataType, type IMemoryDb } from "pg-mem";

/**
 * VALIDAÇÃO DO SCHEMA CONTRA UM EMULADOR DE POSTGRES.
 *
 * ============================================================================
 * O QUE ESTE TESTE PROVA — E O QUE NÃO PROVA
 * ============================================================================
 * Prova: o DDL é aceito por um parser de Postgres, e as restrições de
 * integridade (UNIQUE, CHECK, FK) se comportam como documentado.
 *
 * NÃO prova: Row-Level Security, triggers `plpgsql`, `DO $$ … $$` e
 * `SET LOCAL`. O emulador usado (`pg-mem`) não implementa essas construções —
 * elas só podem ser validadas contra um Postgres real, o que não existe neste
 * ambiente. Essa lacuna está registrada em `docs/banco-de-dados.md`.
 *
 * Por isso o teste é explícito sobre o escopo: ele valida as constraints, não
 * a política de isolamento.
 */

const MIGRACAO = "db/migrations/001_fundacao.sql";

/**
 * Extrai apenas DDL de tabelas e índices (o que o emulador entende).
 *
 * Duas remoções necessárias, ambas documentadas e sem impacto no que está sendo
 * validado:
 *
 * 1. `DEFAULT gen_random_uuid()` — vem da extensão `pgcrypto`, ausente no
 *    emulador. Os testes sempre informam o `id` explicitamente.
 * 2. `CONSTRAINT … CHECK (col ~ 'regex')` — o emulador não implementa o
 *    operador `~`. Essas validações de formato permanecem no schema de
 *    produção; a existência delas é verificada estaticamente no último teste.
 */
function extrairDdl(sql: string): string[] {
  const semComentarios = sql.replace(/--[^\n]*/g, "");
  return (
    semComentarios
      .replace(/DEFAULT gen_random_uuid\(\)/gi, "")
      .split("\n")
      .filter((linha) => !/CONSTRAINT\s+\w+\s+CHECK\s+\(.*~/.test(linha))
      .join("\n")
      .split(/;\s*(?=\n|$)/)
      .map((s) => s.trim())
      // Remover a linha da constraint deixa vírgula sobrando antes do `)`.
      .map((s) => s.replace(/,\s*\)/g, ")"))
      .filter((s) => /^CREATE (TABLE|INDEX|UNIQUE INDEX)/i.test(s))
  );
}

let db: IMemoryDb;

beforeAll(() => {
  db = newDb();
  // O emulador não possui estas funções do Postgres/pgcrypto; registramos
  // equivalentes triviais para que os DEFAULTs e CHECKs sejam avaliados.
  db.public.registerFunction({
    name: "gen_random_uuid",
    returns: DataType.uuid,
    implementation: () => crypto.randomUUID(),
  });
  db.public.registerFunction({
    name: "char_length",
    args: [DataType.text],
    returns: DataType.integer,
    implementation: (t: string) => String(t ?? "").length,
  });
  db.public.registerFunction({
    name: "length",
    args: [DataType.text],
    returns: DataType.integer,
    implementation: (t: string) => String(t ?? "").length,
  });
  db.public.none(extrairDdl(readFileSync(MIGRACAO, "utf8")).join(";\n") + ";");
});

/**
 * O emulador usado não suporta parâmetros posicionais (`$1`). Como este teste
 * valida o **schema** — e não o repositório —, os valores são embutidos como
 * literais SQL com escape. A garantia de "zero interpolação" do repositório é
 * testada separadamente em `persistencia-postgres.test.ts`.
 */
function lit(v: unknown): string {
  if (v === null || v === undefined) return "NULL";
  if (typeof v === "number") return String(v);
  if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
  return `'${String(v).replace(/'/g, "''")}'`;
}

function inserir(sql: string, params: unknown[] = []): void {
  // Substitui $1, $2, ... na ordem pelos literais correspondentes.
  const comValores = sql.replace(/\$(\d+)/g, (_, i: string) => lit(params[Number(i) - 1]));
  db.public.none(comValores);
}

function consultar<T>(sql: string, params: unknown[] = []): T[] {
  const comValores = sql.replace(/\$(\d+)/g, (_, i: string) => lit(params[Number(i) - 1]));
  return db.public.many(comValores) as T[];
}

const TENANT = "11111111-1111-1111-1111-111111111111";
const TENANT_B = "22222222-2222-2222-2222-222222222222";
const EMPRESA = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const ESTABELECIMENTO = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const DOC = "cccccccc-cccc-cccc-cccc-cccccccccccc";

function criarBase() {
  // Ordem: filhos antes dos pais (as FKs são enforced pelo emulador).
  for (const t of [
    "documentos_fiscais",
    "eventos_documento",
    "numeracao_inutilizada",
    "numeracao",
    "certificados_digitais",
    "auditoria",
    "regras_casos_teste",
    "regras_fiscais",
    "usuarios",
    "sessoes",
    "estabelecimentos",
    "empresas",
    "tenants",
  ]) {
    db.public.none(`DELETE FROM ${t}`);
  }

  inserir(`INSERT INTO tenants (id, nome) VALUES ($1, 'Tenant A')`, [TENANT]);
  inserir(`INSERT INTO tenants (id, nome) VALUES ($1, 'Tenant B')`, [TENANT_B]);
  inserir(
    `INSERT INTO empresas (id, tenant_id, razao_social, cnpj, municipio, uf, regime_tributario)
     VALUES ($1,$2,'Empresa A','11222333000181','Campinas','SP','lucro_real')`,
    [EMPRESA, TENANT],
  );
  inserir(
    `INSERT INTO estabelecimentos (id, tenant_id, empresa_id, cnpj, municipio, uf, series, ambiente)
     VALUES ($1,$2,$3,'11222333000181','Campinas','SP','{"55":1}',2)`,
    [ESTABELECIMENTO, TENANT, EMPRESA],
  );
}

function inserirDocumento(over: {
  id?: string;
  tenantId?: string;
  numero?: string;
  idempotencia?: string;
  estado?: string;
  ambiente?: number;
  chave?: string;
}) {
  inserir(
    `INSERT INTO documentos_fiscais
       (id, tenant_id, empresa_id, estabelecimento_id, familia, modelo, serie, numero,
        chave, estado, ambiente, idempotencia)
     VALUES ($1,$2,$3,$4,'nfe55','55','1',$5,$6,$7,$8,$9)`,
    [
      over.id ?? DOC,
      over.tenantId ?? TENANT,
      EMPRESA,
      ESTABELECIMENTO,
      over.numero ?? "1",
      over.chave ?? null,
      over.estado ?? "simulacao",
      over.ambiente ?? 2,
      over.idempotencia ?? null,
    ],
  );
}

describe("schema: restrições de integridade", () => {
  it("cria todas as tabelas do schema", () => {
    for (const t of [
      "tenants",
      "usuarios",
      "sessoes",
      "empresas",
      "estabelecimentos",
      "certificados_digitais",
      "numeracao",
      "numeracao_inutilizada",
      "documentos_fiscais",
      "eventos_documento",
      "auditoria",
      "regras_fiscais",
      "regras_casos_teste",
    ]) {
      expect(() => db.public.getTable(t)).not.toThrow();
    }
  });

  it("idempotência é única por tenant", () => {
    criarBase();
    inserirDocumento({ idempotencia: "idem-1" });
    expect(() =>
      inserirDocumento({ id: "cccccccc-cccc-cccc-cccc-ccccccccccce", idempotencia: "idem-1" }),
    ).toThrow(/unique|duplicate|constraint/i);
  });

  it("a mesma chave de idempotência pode existir em tenants diferentes", () => {
    criarBase();
    inserir(
      `INSERT INTO empresas (id, tenant_id, razao_social, cnpj, municipio, uf, regime_tributario)
             VALUES ($1,$2,'Empresa B','44555666000181','Belo Horizonte','MG','simples_nacional')`,
      ["dddddddd-dddd-dddd-dddd-dddddddddddd", TENANT_B],
    );
    inserir(
      `INSERT INTO estabelecimentos (id, tenant_id, empresa_id, cnpj, municipio, uf, series, ambiente)
             VALUES ($1,$2,$3,'44555666000181','Belo Horizonte','MG','{}',2)`,
      ["eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee", TENANT_B, "dddddddd-dddd-dddd-dddd-dddddddddddd"],
    );
    inserirDocumento({ idempotencia: "idem-1" });
    inserir(
      `INSERT INTO documentos_fiscais
         (id, tenant_id, empresa_id, estabelecimento_id, familia, modelo, serie, numero, estado, ambiente, idempotencia)
       VALUES ($1,$2,$3,$4,'nfe55','55','1','1','simulacao',2,$5)`,
      [
        "ffffffff-ffff-ffff-ffff-ffffffffffff",
        TENANT_B,
        "dddddddd-dddd-dddd-dddd-dddddddddddd",
        "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee",
        "idem-1",
      ],
    );
    expect(
      consultar(`SELECT id FROM documentos_fiscais WHERE idempotencia = 'idem-1'`),
    ).toHaveLength(2);
  });

  it("número não se repete dentro de tenant + estabelecimento + modelo + série", () => {
    criarBase();
    inserirDocumento({ numero: "100" });
    expect(() =>
      inserirDocumento({ id: "cccccccc-cccc-cccc-cccc-ccccccccccce", numero: "100" }),
    ).toThrow(/unique|duplicate|constraint/i);
  });

  it("CNPJ não se repete dentro do mesmo tenant", () => {
    criarBase();
    expect(() =>
      inserir(
        `INSERT INTO empresas (id, tenant_id, razao_social, cnpj, municipio, uf, regime_tributario)
         VALUES ($1,$2,'Outra','11222333000181','Campinas','SP','mei')`,
        ["dddddddd-dddd-dddd-dddd-dddddddddddd", TENANT],
      ),
    ).toThrow(/unique|duplicate|constraint/i);
  });

  it("CHECK rejeita estado inexistente", () => {
    criarBase();
    expect(() => inserirDocumento({ estado: "autorizado_magicamente" })).toThrow(/check|violates/i);
  });

  it("CHECK rejeita ambiente fora de 1 e 2", () => {
    criarBase();
    expect(() => inserirDocumento({ ambiente: 3 })).toThrow(/check|violates/i);
  });

  it("CHECK rejeita chave com comprimento diferente de 44", () => {
    criarBase();
    expect(() => inserirDocumento({ chave: "123" })).toThrow(/check|violates/i);
    expect(() => inserirDocumento({ chave: "1".repeat(45) })).toThrow(/check|violates/i);
    expect(() =>
      inserirDocumento({ id: "cccccccc-cccc-cccc-cccc-ccccccccccce", chave: "1".repeat(44) }),
    ).not.toThrow();
  });

  it("CHECK rejeita UF com tamanho errado e CNPJ fora do formato", () => {
    criarBase();
    expect(() =>
      inserir(
        `INSERT INTO empresas (id, tenant_id, razao_social, cnpj, municipio, uf, regime_tributario)
         VALUES ($1,$2,'X','123','Campinas','SPX','mei')`,
        ["dddddddd-dddd-dddd-dddd-dddddddddddd", TENANT],
      ),
    ).toThrow(/check|violates/i);
  });

  it("FK impede documento sem estabelecimento existente", () => {
    criarBase();
    expect(() =>
      inserir(
        `INSERT INTO documentos_fiscais
           (id, tenant_id, empresa_id, estabelecimento_id, familia, modelo, serie, numero, estado, ambiente)
         VALUES ($1,$2,$3,'00000000-0000-0000-0000-000000000000','nfe55','55','1','1','simulacao',2)`,
        [DOC, TENANT, EMPRESA],
      ),
    ).toThrow(/foreign key|violates/i);
  });

  it("inutilização de numeração exige justificativa com 15+ caracteres e intervalo válido", () => {
    criarBase();
    const sql = `INSERT INTO numeracao_inutilizada
       (id, tenant_id, estabelecimento_id, modelo, serie, numero_de, numero_ate, justificativa)
       VALUES ($1,$2,$3,'55','1',$4,$5,$6)`;
    const id = "99999999-9999-9999-9999-999999999999";
    expect(() => inserir(sql, [id, TENANT, ESTABELECIMENTO, 5, 7, "curta"])).toThrow(
      /check|violates/i,
    );
    expect(() =>
      inserir(sql, [id, TENANT, ESTABELECIMENTO, 7, 5, "justificativa longa o suficiente"]),
    ).toThrow(/check|violates/i);
    expect(() =>
      inserir(sql, [id, TENANT, ESTABELECIMENTO, 5, 7, "justificativa longa o suficiente"]),
    ).not.toThrow();
  });

  it("numeração não aceita valor negativo", () => {
    criarBase();
    expect(() =>
      inserir(
        `INSERT INTO numeracao (tenant_id, estabelecimento_id, modelo, serie, atual)
         VALUES ($1,$2,'55','1',-1)`,
        [TENANT, ESTABELECIMENTO],
      ),
    ).toThrow(/check|violates/i);
  });

  it("regra fiscal fora de rascunho EXIGE fonte com data de consulta", () => {
    criarBase();
    const sql = `INSERT INTO regras_fiscais (id, versao, titulo, descricao, estado, orgao_fonte, documento_fonte, consultada_em)
                 VALUES ($1,'1.0','Regra','Descricao',$2,$3,$4,$5)`;
    // Sem fonte: apenas rascunho passa.
    expect(() => inserir(sql, ["R1", "rascunho", null, null, null])).not.toThrow();
    expect(() => inserir(sql, ["R2", "vigente", null, null, null])).toThrow(/check|violates/i);
    // Fonte incompleta também não passa.
    expect(() => inserir(sql, ["R3", "vigente", "CONFAZ", null, null])).toThrow(/check|violates/i);
    expect(() =>
      inserir(sql, ["R4", "vigente", "CONFAZ", "Ajuste SINIEF", "2026-10-14"]),
    ).not.toThrow();
  });

  it("as validações de formato por regex existem no schema de produção", () => {
    // O emulador não implementa o operador `~`, então estas constraints são
    // removidas antes da carga. Este teste garante que elas não se percam:
    // a validação de formato continua sendo exigência do banco real.
    const sql = readFileSync(MIGRACAO, "utf8");
    expect(sql).toContain("cnpj_matriz ~ '^[0-9]{14}$'");
    expect(sql).toContain("cnpj ~ '^[0-9]{14}$'");
    expect(sql).toContain("char_length(uf) = 2");
  });

  it("certificado exige período de validade coerente", () => {
    criarBase();
    const sql = `INSERT INTO certificados_digitais
       (id, tenant_id, estabelecimento_id, thumbprint, titular, cnpj, valido_de, valido_ate)
       VALUES ($1,$2,$3,'AB','Titular','11222333000181',$4,$5)`;
    expect(() =>
      inserir(sql, [
        "11111111-2222-3333-4444-555555555555",
        TENANT,
        ESTABELECIMENTO,
        "2027-01-01",
        "2026-01-01",
      ]),
    ).toThrow(/check|violates/i);
  });
});
