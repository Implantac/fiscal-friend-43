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
    if (/SELECT s\.id, s\.tenant_id/.test(sql)) {
      const [tokenHash] = params;
      const s = this.sessoes.find((x) => x["token_hash"] === tokenHash);
      if (!s) return [] as T[];
      const u = this.usuarios.find((x) => x["id"] === s["usuario_id"]);
      return [
        {
          id: s["id"],
          tenant_id: s["tenant_id"],
          usuario_id: s["usuario_id"],
          papel_usuario: u?.["papel"] ?? "operador",
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
  papel: "operador" as const,
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

  it("devolve o papel do usuário e os dados da sessão", async () => {
    const sql = new SqlFalso();
    const usuarios = new UsuariosPostgres(sql);
    const sessoes = new SessoesPostgres(sql);
    await usuarios.criar(usuario({ papel: "fiscal" }));
    await sessoes.criar({ ...criarSessao, papel: "fiscal", ip: "10.0.0.1" });

    const s = await sessoes.buscarPorTokenHash("h1");
    expect(s).toEqual({
      id: "ses-1",
      tenantId: "tenant-a",
      usuarioId: "usr-1",
      papel: "fiscal",
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
