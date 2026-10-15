import { describe, expect, it } from "vitest";
import {
  DDL_CONTROLE,
  TABELA_CONTROLE,
  checksum,
  descobrir,
  nomeValido,
  orfas,
  ordenar,
  planejar,
  type Migracao,
  type MigracaoAplicada,
} from "./migracoes";

const emDisco = (nomes: string[]): Migracao[] =>
  nomes.map((n) => ({ arquivo: n, checksum: `sha-${n}` }));

const aplicadas = (nomes: string[]): MigracaoAplicada[] =>
  nomes.map((n) => ({ arquivo: n, checksum: `sha-${n}` }));

describe("nomes de migração", () => {
  it("aceita o formato com três dígitos e sublinhados", () => {
    expect(nomeValido("001_fundacao.sql")).toBe(true);
    expect(nomeValido("002_valor_documento.sql")).toBe(true);
    expect(nomeValido("010_isolamento_tenant.sql")).toBe(true);
    expect(nomeValido("1000_muito_depois.sql")).toBe(true);
  });

  it("rejeita formato que quebraria a ordenação lexicográfica", () => {
    // `2_x.sql` ordenaria DEPOIS de `10_y.sql`: 1 < 2. É o bug clássico.
    expect(nomeValido("2_fundacao.sql")).toBe(false);
    expect(nomeValido("02_fundacao.sql")).toBe(false);
    expect(nomeValido("001-Fundacao.sql")).toBe(false);
    expect(nomeValido("001_Fundacao.sql")).toBe(false);
    expect(nomeValido("001_fundacao.txt")).toBe(false);
    expect(nomeValido("fundacao.sql")).toBe(false);
  });
});

describe("ordenação", () => {
  it("ordena lexicograficamente, como o schema.test.ts", () => {
    expect(ordenar(["010_c.sql", "002_b.sql", "001_a.sql"])).toEqual([
      "001_a.sql",
      "002_b.sql",
      "010_c.sql",
    ]);
  });

  it("não muta o array recebido", () => {
    const original = ["002_b.sql", "001_a.sql"];
    ordenar(original);
    expect(original).toEqual(["002_b.sql", "001_a.sql"]);
  });

  it("a ordem 009 → 010 não quebra (dígito extra à esquerda)", () => {
    // Com três dígitos fixos, 009 vem antes de 010. Sem o padrinho de zeros,
    // 10 viria antes de 9.
    expect(ordenar(["010_x.sql", "009_y.sql"])).toEqual(["009_y.sql", "010_x.sql"]);
  });
});

describe("checksum", () => {
  it("é estável para o mesmo conteúdo", () => {
    expect(checksum("CREATE TABLE t (id int);")).toBe(checksum("CREATE TABLE t (id int);"));
  });

  it("muda com qualquer alteração, inclusive de espaço", () => {
    expect(checksum("a")).not.toBe(checksum("a "));
    expect(checksum("a")).not.toBe(checksum("b"));
  });

  it("tem 64 caracteres hexadecimais (SHA-256)", () => {
    expect(checksum("qualquer")).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("descoberta", () => {
  const listar = () => [
    { nome: "002_b.sql", conteudo: "B" },
    { nome: "001_a.sql", conteudo: "A" },
    { nome: "leia-me.md", conteudo: "ignorado" },
    { nome: "003_c.sql", conteudo: "C" },
  ];

  it("filtra para .sql e devolve em ordem", () => {
    expect(descobrir(listar).map((m) => m.arquivo)).toEqual([
      "001_a.sql",
      "002_b.sql",
      "003_c.sql",
    ]);
  });

  it("associa o checksum ao arquivo certo", () => {
    const encontradas = descobrir(listar);
    expect(encontradas[0]?.checksum).toBe(checksum("A"));
    expect(encontradas[1]?.checksum).toBe(checksum("B"));
  });

  it("ignora arquivos que não são .sql", () => {
    expect(descobrir(listar).some((m) => m.arquivo === "leia-me.md")).toBe(false);
  });
});

describe("planejamento", () => {
  it("aplica o que não está no banco", () => {
    const plano = planejar(emDisco(["001_a.sql", "002_b.sql"]), aplicadas([]));
    expect(plano.aplicar.map((m) => m.arquivo)).toEqual(["001_a.sql", "002_b.sql"]);
    expect(plano.emDia).toEqual([]);
    expect(plano.divergentes).toEqual([]);
  });

  it("pula o que já está aplicado com o mesmo conteúdo", () => {
    const plano = planejar(emDisco(["001_a.sql", "002_b.sql"]), aplicadas(["001_a.sql"]));
    expect(plano.aplicar.map((m) => m.arquivo)).toEqual(["002_b.sql"]);
    expect(plano.emDia.map((m) => m.arquivo)).toEqual(["001_a.sql"]);
  });

  it("marca como divergente o arquivo que mudou de conteúdo", () => {
    const disco: Migracao[] = [{ arquivo: "001_a.sql", checksum: "novo" }];
    const banco: MigracaoAplicada[] = [{ arquivo: "001_a.sql", checksum: "velho" }];
    const plano = planejar(disco, banco);
    expect(plano.aplicar).toEqual([]);
    expect(plano.divergentes).toEqual([
      { arquivo: "001_a.sql", noBanco: "velho", noDisco: "novo" },
    ]);
  });

  it("nunca aplica uma migração divergente, mesmo que seja a única", () => {
    // Regra de segurança: reaplicar por cima gravaria um histórico falso.
    const plano = planejar(
      [{ arquivo: "001_a.sql", checksum: "x" }],
      [{ arquivo: "001_a.sql", checksum: "y" }],
    );
    expect(plano.aplicar).toHaveLength(0);
  });

  it("com banco vazio, tudo é aplicação e nada é divergente", () => {
    const plano = planejar(emDisco(["001_a.sql"]), []);
    expect(plano.aplicar).toHaveLength(1);
    expect(plano.divergentes).toHaveLength(0);
    expect(plano.emDia).toHaveLength(0);
  });

  it("as migrações aplicadas vêm na mesma ordem do disco", () => {
    const plano = planejar(emDisco(["003_c.sql", "001_a.sql", "002_b.sql"]), aplicadas([]));
    expect(plano.aplicar.map((m) => m.arquivo)).toEqual(["001_a.sql", "002_b.sql", "003_c.sql"]);
  });
});

describe("migrações órfãs", () => {
  it("aponta o que o banco tem e o disco perdeu", () => {
    const orfas_ = orfas(aplicadas(["001_a.sql", "002_b.sql"]), emDisco(["001_a.sql"]));
    expect(orfas_).toEqual(["002_b.sql"]);
  });

  it("não acusa nada quando disco e banco concordam", () => {
    expect(orfas(aplicadas(["001_a.sql"]), emDisco(["001_a.sql"]))).toEqual([]);
  });

  it("ignora o sentido inverso (disco tem, banco não) — isso é 'a aplicar'", () => {
    expect(orfas(aplicadas([]), emDisco(["001_a.sql"]))).toEqual([]);
  });
});

describe("tabela de controle", () => {
  it("o DDL usa o mesmo nome que a constante", () => {
    expect(DDL_CONTROLE).toContain(TABELA_CONTROLE);
  });

  it("o DDL é idempotente", () => {
    expect(DDL_CONTROLE).toContain("CREATE TABLE IF NOT EXISTS");
  });

  it("o DDL registra checksum e data", () => {
    expect(DDL_CONTROLE).toContain("checksum");
    expect(DDL_CONTROLE).toContain("aplicada_em");
  });
});
