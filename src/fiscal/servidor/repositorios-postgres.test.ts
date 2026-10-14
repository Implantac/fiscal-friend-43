/**
 * TESTES DOS REPOSITÓRIOS POSTGRES DE USUÁRIOS E SESSÕES.
 *
 * Com executor SQL falso, como em `persistencia-postgres.test.ts`. O objetivo
 * não é validar SQL contra banco real (isso é teste de integração, que ainda
 * não pode rodar aqui) e sim as garantias de segurança da camada:
 *
 *   1. nenhum valor de dado é interpolado no texto do SQL;
 *   2. o token é consultado pelo hash, nunca pelo token em texto;
 *   3. revogação é condicional (`revogada_em IS NULL`);
 *   4. o hash de senha é serializado no formato validado, não em JSON solto.
 */

import { describe, expect, it } from "vitest";
import { SessoesPostgres, UsuariosPostgres } from "./repositorios-postgres";
import type { SqlExecutor } from "@/fiscal/persistencia-postgres";
import { serializarSenhaHash, desserializarSenhaHash } from "@/fiscal/autenticacao";
import type { UsuarioInterno } from "./portas-servidor";

class SqlFalso implements SqlExecutor {
  queries: { sql: string; params: unknown[] }[] = [];
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
      const [usuarioId, falhas, bloqueadoAte] = params;
      for (const u of this.usuarios) {
        if (u["id"] === usuarioId) {
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
      const [sessaoId] = params;
      if (/usuario_id = \$1/.test(sql)) {
        for (const s of this.sessoes) if (s["usuario_id"] === sessaoId) s["revogada_em"] = "agora";
      } else {
        for (const s of this.sessoes) if (s["id"] === sessaoId) s["revogada_em"] = "agora";
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

describe("UsuariosPostgres", () => {
  it("insere o usuário com o hash serializado e o e-mail normalizado, sem interpolar valores", async () => {
    const sql = new SqlFalso();
    const repo = new UsuariosPostgres(sql);
    const emailInjetavel = "x'; DROP TABLE usuarios; --";
    await repo.criar(usuario({ email: emailInjetavel }));

    expect(sql.usuarios).toHaveLength(1);
    expect(sql.usuarios[0]?.["email"]).toBe(emailInjetavel.toLowerCase());
    expect(sql.usuarios[0]?.["hash_senha"]).toBe(hashFake);

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

  it("registra falha e bloqueio; sucesso zera os dois", async () => {
    const sql = new SqlFalso();
    const repo = new UsuariosPostgres(sql);
    await repo.criar(usuario());

    await repo.registrarFalhaLogin("usr-1", 5, "2026-10-14T12:15:00.000Z");
    let u = await repo.buscarPorId("tenant-a", "usr-1");
    expect(u?.falhasLogin).toBe(5);
    expect(u?.bloqueadoAte).toBe("2026-10-14T12:15:00.000Z");

    await repo.registrarSucessoLogin("usr-1");
    u = await repo.buscarPorId("tenant-a", "usr-1");
    expect(u?.falhasLogin).toBe(0);
    expect(u?.bloqueadoAte).toBeNull();
  });
});

describe("SessoesPostgres", () => {
  it("consulta a sessão pelo HASH do token, nunca pelo token em texto", async () => {
    const sql = new SqlFalso();
    const sessoes = new SessoesPostgres(sql);
    await sessoes.criar({
      id: "ses-1",
      tenantId: "tenant-a",
      usuarioId: "usr-1",
      papel: "operador",
      tokenHash: "hash-do-token",
      expiraEm: "2026-10-14T13:00:00.000Z",
    });
    await sessoes.buscarPorTokenHash("hash-do-token");

    const busca = sql.queries.at(-1)?.sql ?? "";
    expect(busca).toContain("token_hash = $1");
    expect(busca).not.toContain("hash-do-token");
  });

  it("devolve o papel do usuário e os dados da sessão", async () => {
    const sql = new SqlFalso();
    const usuarios = new UsuariosPostgres(sql);
    const sessoes = new SessoesPostgres(sql);
    await usuarios.criar(usuario({ papel: "fiscal" }));
    await sessoes.criar({
      id: "ses-1",
      tenantId: "tenant-a",
      usuarioId: "usr-1",
      papel: "fiscal",
      tokenHash: "h1",
      expiraEm: "2026-10-14T13:00:00.000Z",
      ip: "10.0.0.1",
    });

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

  it("revogação é condicional a revogada_em IS NULL (logout simultâneo não sobrescreve)", async () => {
    const sql = new SqlFalso();
    const sessoes = new SessoesPostgres(sql);
    await sessoes.criar({
      id: "ses-1",
      tenantId: "tenant-a",
      usuarioId: "usr-1",
      papel: "operador",
      tokenHash: "h1",
      expiraEm: "2026-10-14T13:00:00.000Z",
    });
    await sessoes.revogar("ses-1");
    const update = sql.queries.at(-1)?.sql ?? "";
    expect(update).toContain("revogada_em IS NULL");
  });

  it("revoga todas as sessões do usuário", async () => {
    const sql = new SqlFalso();
    const sessoes = new SessoesPostgres(sql);
    for (const id of ["ses-1", "ses-2"]) {
      await sessoes.criar({
        id,
        tenantId: "tenant-a",
        usuarioId: "usr-1",
        papel: "operador",
        tokenHash: `h-${id}`,
        expiraEm: "2026-10-14T13:00:00.000Z",
      });
    }
    await sessoes.revogarTodasDoUsuario("usr-1");
    expect(sql.sessoes.every((s) => s["revogada_em"] === "agora")).toBe(true);
  });
});
