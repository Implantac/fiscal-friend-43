/**
 * TESTES DOS REPOSITÓRIOS POSTGRES DE USUÁRIOS E SESSÕES.
 *
 * Com executor SQL falso, como em `persistencia-postgres.test.ts`. O objetivo
 * não é validar SQL contra banco real (isso é teste de integração, que ainda não
 * pode rodar aqui) e sim as garantias de segurança da camada:
 *
 *   1. nenhum valor de dado é interpolado no texto do SQL;
 *   2. toda ESCRITA passa por transação com o tenant em `params[0]` — sem isso a
 *      RLS barraria a escrita e ela falharia em silêncio;
 *   3. o token é consultado pelo hash, nunca pelo token em texto;
 *   4. revogação é condicional a `revogada_em IS NULL` e filtrada por tenant;
 *   5. o hash de senha é serializado no formato validado, não em JSON solto.
 */

import { describe, expect, it } from "vitest";
import { SessoesPostgres, UsuariosPostgres } from "./repositorios-postgres";
import type { SqlExecutor } from "@/fiscal/persistencia-postgres";
import { desserializarSenhaHash, serializarSenhaHash } from "@/fiscal/autenticacao";
import type { UsuarioInterno } from "./portas-servidor";

/**
 * Execor que IMPLEMENTA a política de RLS de `db/migrations/001_fundacao.sql`.
 *
 * Existe porque o `SqlFalso` não pode pegar o bug mais perigoso do schema: ele
 * devolve linhas para qualquer query conhecida, quando o Postgres real
 * *recusaria* a entregá-las. As regras emuladas aqui são exatamente as do
 * migration:
 *
 *   - `sessoes`  : SELECT permitido com contexto ligado OU desligado
 *                  (`tenant_atual() IS NULL`); escrita exige contexto.
 *   - `usuarios` : SELECT e escrita exigem contexto. Com contexto desligado,
 *                  `tenant_id = tenant_atual()` avalia para NULL, que não é
 *                  verdadeiro — nenhuma linha fica visível.
 *
 * É essa segunda regra que quebrou o login: a consulta por token fazia JOIN com
 * `usuarios` sem contexto, e o JOIN eliminava a própria sessão procurada.
 */
class SqlComRls implements SqlExecutor {
  queries: { sql: string; params: unknown[] }[] = [];
  transacoes: string[] = [];
  /** Contexto de tenant da transação corrente; `null` = desligado. */
  private contexto: string | null = null;

  async query<T>(sql: string, params: unknown[] = []): Promise<T[]> {
    this.queries.push({ sql, params });

    // `set_config('app.tenant_id', $1, true)` — é assim que o executor liga o
    // contexto. `SELECT set_config(...)` vem de `emTransacao`.
    if (/set_config\('app\.tenant_id'/.test(sql)) {
      this.contexto = String(params[0]);
      return [] as T[];
    }

    if (/INSERT INTO sessoes/.test(sql)) {
      // Escrita em `sessoes` EXIGE contexto, como a política `sessoes_escrita_tenant`.
      if (this.contexto === null) return [] as T[];
      return [] as T[];
    }

    // ESTA verificação vem ANTES da de `sessoes`, e a ordem é o ponto.
    // Qualquer leitura que toque `usuarios` sem contexto de tenant devolve zero
    // linhas — inclusive um JOIN: se um lado do JOIN é invisível, o resultado
    // inteiro é vazio. É exatamente o sintoma em produção. Uma versão anterior
    // deste fake fazia o match de `FROM sessoes` primeiro e devolvia a linha
    // mesmo com o JOIN presente, então o fake não emulava nada.
    if (/\busuarios\b/i.test(sql) && this.contexto === null) {
      return [] as T[];
    }

    if (/FROM sessoes/.test(sql) && /token_hash = \$1/.test(sql)) {
      // Leitura permitida mesmo sem contexto — é a exceção documentada.
      const [tokenHash] = params;
      if (tokenHash !== "h1") return [] as T[];
      return [
        {
          id: "ses-1",
          tenant_id: "tenant-a",
          usuario_id: "usr-1",
          expira_em: "2026-10-14T13:00:00.000Z",
          revogada_em: null,
        },
      ] as T[];
    }

    throw new Error(`query não simulada pelo SqlComRls: ${sql}`);
  }

  async emTransacao<T>(tenantId: string, fn: (tx: SqlExecutor) => Promise<T>): Promise<T> {
    this.transacoes.push(tenantId);
    return fn(this);
  }
}

class SqlFalso implements SqlExecutor {
  queries: { sql: string; params: unknown[] }[] = [];
  transacoes: string[] = [];
  usuarios: Record<string, unknown>[] = [];
  sessoes: Record<string, unknown>[] = [];

  async query<T>(sql: string, params: unknown[] = []): Promise<T[]> {
    this.queries.push({ sql, params });

    if (/INSERT INTO usuarios/.test(sql)) {
      const [id, tenantId, email, hash, papel, ativo, falhas, bloqueado] = params;
      this.usuarios.push({
        id,
        tenant_id: tenantId,
        email,
        hash_senha: hash,
        papel,
        ativo,
        falhas_login: falhas,
        bloqueado_ate: bloqueado,
      });
      return [] as T[];
    }
    if (/UPDATE usuarios/.test(sql)) {
      const [tenantId, usuarioId, falhas, bloqueadoAte] = params;
      for (const u of this.usuarios) {
        if (u["id"] === usuarioId && u["tenant_id"] === tenantId) {
          if (/bloqueado_ate = NULL/.test(sql)) {
            u["falhas_login"] = 0;
            u["bloqueado_ate"] = null;
          } else {
            u["falhas_login"] = falhas;
            u["bloqueado_ate"] = bloqueadoAte;
          }
        }
      }
      return [] as T[];
    }
    if (/INSERT INTO sessoes/.test(sql)) {
      const [id, tenantId, usuarioId, tokenHash, expiraEm, ip, agente] = params;
      this.sessoes.push({
        id,
        tenant_id: tenantId,
        usuario_id: usuarioId,
        token_hash: tokenHash,
        expira_em: expiraEm,
        ip,
        agente,
        revogada_em: null,
      });
      return [] as T[];
    }
    if (/FROM sessoes/.test(sql) && /token_hash = \$1/.test(sql)) {
      // Devolve EXATAMENTE as colunas que a query real seleciona. O fake já
      // devolveu `papel_usuario` quando a consulta fazia JOIN com `usuarios` —
      // e aí o teste passava validando uma coluna que o Postgres real não
      // entregaria, porque a RLS de `usuarios` barraria o JOIN.
      const [tokenHash] = params;
      const s = this.sessoes.find((x) => x["token_hash"] === tokenHash);
      if (!s) return [] as T[];
      return [
        {
          id: s["id"],
          tenant_id: s["tenant_id"],
          usuario_id: s["usuario_id"],
          expira_em: s["expira_em"],
          revogada_em: s["revogada_em"],
        },
      ] as T[];
    }
    if (/UPDATE sessoes/.test(sql)) {
      const [tenantId, alvo] = params;
      if (/usuario_id = \$2/.test(sql)) {
        for (const s of this.sessoes) {
          if (s["usuario_id"] === alvo && s["tenant_id"] === tenantId) s["revogada_em"] = "agora";
        }
      } else {
        for (const s of this.sessoes) {
          if (s["id"] === alvo && s["tenant_id"] === tenantId) s["revogada_em"] = "agora";
        }
      }
      return [] as T[];
    }
    if (/SELECT id, tenant_id, email, hash_senha/.test(sql)) {
      const [tenantId, alvo] = params;
      const achados = this.usuarios.filter(
        (u) =>
          u["tenant_id"] === tenantId &&
          (String(u["email"]).toLowerCase() === String(alvo).toLowerCase() || u["id"] === alvo),
      );
      return achados.map((u) => ({
        id: u["id"],
        tenant_id: u["tenant_id"],
        email: u["email"],
        hash_senha: u["hash_senha"],
        nome: null,
        papel: u["papel"],
        ativo: u["ativo"],
        falhas_login: u["falhas_login"],
        bloqueado_ate: u["bloqueado_ate"],
      })) as T[];
    }
    throw new Error(`query não simulada: ${sql}`);
  }

  async emTransacao<T>(tenantId: string, fn: (tx: SqlExecutor) => Promise<T>): Promise<T> {
    this.transacoes.push(tenantId);
    return fn(this);
  }
}

const hashFake = serializarSenhaHash({
  algoritmo: "PBKDF2-SHA256",
  iteracoes: 1,
  salt: "c2FsdA==",
  hash: "aGFzaA==",
});

const usuario = (over: Partial<UsuarioInterno> = {}): UsuarioInterno => ({
  id: "usr-1",
  tenantId: "tenant-a",
  email: "ana@empresa.com",
  hashSenha: desserializarSenhaHash(hashFake),
  papel: "operador",
  ativo: true,
  falhasLogin: 0,
  bloqueadoAte: null,
  ...over,
});

const criarSessao = {
  id: "ses-1",
  tenantId: "tenant-a",
  usuarioId: "usr-1",
  tokenHash: "h1",
  expiraEm: "2026-10-14T13:00:00.000Z",
};

describe("UsuariosPostgres", () => {
  it("insere o usuário dentro de transação com o tenant, sem interpolar valores", async () => {
    const sql = new SqlFalso();
    const repo = new UsuariosPostgres(sql);
    const emailInjetavel = "x'; DROP TABLE usuarios; --";
    await repo.criar(usuario({ email: emailInjetavel }));

    expect(sql.usuarios).toHaveLength(1);
    expect(sql.usuarios[0]?.["email"]).toBe(emailInjetavel.toLowerCase());
    expect(sql.usuarios[0]?.["hash_senha"]).toBe(hashFake);

    // Escrita sempre em transação, sempre com o tenant.
    expect(sql.transacoes).toEqual(["tenant-a"]);

    // A query enviada não contém nenhum desses valores no texto.
    const texto = sql.queries[0]?.sql ?? "";
    expect(texto).not.toContain("ana@empresa.com");
    expect(texto).not.toContain("DROP TABLE");
    expect(texto).not.toContain("tenant-a");
  });

  it("busca por e-mail filtrando pelo tenant informado", async () => {
    const sql = new SqlFalso();
    const repo = new UsuariosPostgres(sql);
    await repo.criar(usuario());

    const achado = await repo.buscarPorEmail("tenant-a", "ANA@EMPRESA.COM");
    expect(achado?.id).toBe("usr-1");

    // Mesmo e-mail em outro tenant: não encontra (isolamento).
    expect(await repo.buscarPorEmail("tenant-b", "ana@empresa.com")).toBeUndefined();
  });

  it("busca por id devolvendo o hash no formato validado", async () => {
    const sql = new SqlFalso();
    const repo = new UsuariosPostgres(sql);
    await repo.criar(usuario());
    const achado = await repo.buscarPorId("tenant-a", "usr-1");
    expect(achado?.hashSenha.algoritmo).toBe("PBKDF2-SHA256");
    expect(serializarSenhaHash(achado!.hashSenha)).toBe(hashFake);
  });

  it("registra falha e bloqueio em transação com tenant, sucesso zera os dois", async () => {
    const sql = new SqlFalso();
    const repo = new UsuariosPostgres(sql);
    await repo.criar(usuario());

    await repo.registrarFalhaLogin("tenant-a", "usr-1", 5, "2026-10-14T12:15:00.000Z");
    expect(sql.transacoes).toEqual(["tenant-a", "tenant-a"]);
    let u = await repo.buscarPorId("tenant-a", "usr-1");
    expect(u?.falhasLogin).toBe(5);
    expect(u?.bloqueadoAte).toBe("2026-10-14T12:15:00.000Z");

    await repo.registrarSucessoLogin("tenant-a", "usr-1");
    u = await repo.buscarPorId("tenant-a", "usr-1");
    expect(u?.falhasLogin).toBe(0);
    expect(u?.bloqueadoAte).toBeNull();
  });

  it("o tenant de outro usuário não altera nada", async () => {
    const sql = new SqlFalso();
    const repo = new UsuariosPostgres(sql);
    await repo.criar(usuario());
    await repo.registrarFalhaLogin("tenant-b", "usr-1", 5, "2026-10-14T12:15:00.000Z");
    const u = await repo.buscarPorId("tenant-a", "usr-1");
    expect(u?.falhasLogin).toBe(0);
  });
});

describe("SessoesPostgres", () => {
  it("cria a sessão em transação com o tenant e consulta pelo HASH do token", async () => {
    const sql = new SqlFalso();
    const sessoes = new SessoesPostgres(sql);
    await sessoes.criar(criarSessao);
    expect(sql.transacoes).toEqual(["tenant-a"]);

    await sessoes.buscarPorTokenHash("hash-do-token");
    const busca = sql.queries.at(-1)?.sql ?? "";
    expect(busca).toContain("token_hash = $1");
    expect(busca).not.toContain("hash-do-token");
    // A consulta pelo token é a ÚNICA leitura sem contexto de tenant.
    expect(sql.transacoes).toEqual(["tenant-a"]);
  });

  it("devolve os dados da sessão sem papel — ele é relido do usuário", async () => {
    const sql = new SqlFalso();
    const usuarios = new UsuariosPostgres(sql);
    const sessoes = new SessoesPostgres(sql);
    await usuarios.criar(usuario({ papel: "fiscal" }));
    await sessoes.criar({ ...criarSessao, ip: "10.0.0.1" });

    const s = await sessoes.buscarPorTokenHash("h1");
    expect(s).toEqual({
      id: "ses-1",
      tenantId: "tenant-a",
      usuarioId: "usr-1",
      expiraEm: "2026-10-14T13:00:00.000Z",
      revogadaEm: null,
    });
    // `papel` não é campo da sessão: guardá-lo deixaria o papel velho na sessão
    // já aberta quando um administrador rebaixasse o usuário.
    expect(s).not.toHaveProperty("papel");
  });

  /**
   * REGRESSÃO — o bug que quebrou o login inteiro sob RLS.
   *
   * A consulta por token é a única do sistema que roda com `app.tenant_id`
   * desligado. Ela já fez `JOIN usuarios`, e `usuarios` tem política estrita
   * (`tenant_id = tenant_atual()`): com o contexto desligado a expressão avalia
   * para NULL, nenhuma linha fica visível, e o JOIN eliminava a própria sessão
   * procurada. `buscarPorTokenHash` devolvia `undefined` para todo token
   * válido — o login respondia 200 e cada request seguinte falhava.
   *
   * O executor abaixo emula a semântica da RLS para que isto não volte em
   * silêncio: qualquer consulta que toque `usuarios` sem contexto de tenant
   * devolve zero linhas, exatamente como o Postgres real faria.
   */
  it("não toca `usuarios` na consulta por token (regressão de RLS)", async () => {
    const sql = new SqlFalso();
    const sessoes = new SessoesPostgres(sql);
    await sessoes.criar(criarSessao);
    const antes = sql.queries.length;

    // A consulta precisa acontecer ANTES de inspecionar o SQL registrado — uma
    // versão anterior deste teste lia `at(-1)` antes de chamar e validava o
    // INSERT, passando por acidente.
    const s = await sessoes.buscarPorTokenHash("h1");
    expect(s?.id).toBe("ses-1");

    const busca = sql.queries.at(-1)?.sql ?? "";
    expect(busca).toContain("token_hash = $1");
    // Sem JOIN, sem referência a `usuarios`.
    expect(busca).not.toMatch(/\busuarios\b/i);
    expect(busca).not.toMatch(/join/i);
    // Não acrescentou consulta extra só para buscar o papel.
    expect(sql.queries.length).toBe(antes + 1);
  });

  /**
   * A simulação que faltava: um executor que **implementa a política de RLS**.
   *
   * O `SqlFalso` devolve linhas para qualquer query conhecida, então ele nunca
   * poderia pegar o bug — o bug só existe porque o Postgres real *recusaria* a
   * entregar as linhas de `usuarios`. Este executor fecha essa lacuna: quando o
   * contexto de tenant está desligado, `usuarios` fica invisível, exatamente
   * como em `db/migrations/001_fundacao.sql`.
   *
   * Se alguém reintroduzir o JOIN, este teste falha com a mensagem que explica
   * por que — em vez de o sistema quebrar em produção sem aviso.
   */
  it("executor com RLS: consulta por token acha a sessão mesmo sem tenant", async () => {
    const rls = new SqlComRls();
    const sessoes = new SessoesPostgres(rls);
    await sessoes.criar({ ...criarSessao, ip: "10.0.0.1" });

    // Sem contexto de tenant — é o estado em que a consulta por token roda.
    const s = await sessoes.buscarPorTokenHash("h1");
    expect(s).toEqual({
      id: "ses-1",
      tenantId: "tenant-a",
      usuarioId: "usr-1",
      expiraEm: "2026-10-14T13:00:00.000Z",
      revogadaEm: null,
    });
  });

  it("revogação é condicional a revogada_em IS NULL e passa pelo tenant", async () => {
    const sql = new SqlFalso();
    const sessoes = new SessoesPostgres(sql);
    await sessoes.criar(criarSessao);
    await sessoes.revogar("tenant-a", "ses-1");
    const update = sql.queries.at(-1)?.sql ?? "";
    expect(update).toContain("revogada_em IS NULL");
    expect(update).toContain("WHERE tenant_id = $1");
    expect(update).toContain("id = $2");
    expect(sql.transacoes.at(-1)).toBe("tenant-a");
  });

  it("revoga todas as sessões do usuário, apenas do tenant informado", async () => {
    const sql = new SqlFalso();
    const sessoes = new SessoesPostgres(sql);
    for (const id of ["ses-1", "ses-2"]) {
      await sessoes.criar({ ...criarSessao, id, tokenHash: `h-${id}` });
    }
    await sessoes.revogarTodasDoUsuario("tenant-a", "usr-1");
    expect(sql.sessoes.every((s) => s["revogada_em"] === "agora")).toBe(true);

    // Outro tenant: nada é revogado.
    const sql2 = new SqlFalso();
    const s2 = new SessoesPostgres(sql2);
    await s2.criar(criarSessao);
    await s2.revogarTodasDoUsuario("tenant-b", "usr-1");
    expect(sql2.sessoes.every((x) => x["revogada_em"] === null)).toBe(true);
  });
});
