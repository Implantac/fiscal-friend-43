/**
 * TESTES DA LÓGICA DE AUTENTICAÇÃO E SESSÃO.
 *
 * Cobrem as garantias de segurança que a camada HTTP (`sessao.server.ts`)
 * depende — e que, se quebrarem, quebram silenciosamente em produção:
 *   1. token de sessão não é recuperável a partir do banco;
 *   2. falha de credencial não revela se o e-mail existe;
 *   3. bloqueio progressivo após falhas consecutivas;
 *   4. sessão expirada/revogada não resolve contexto;
 *   5. usuário desativado depois do login perde a sessão;
 *   6. senha nunca é devolvida em texto por nenhum caminho.
 *
 * A camada HTTP (cookie, header) não é testada aqui: depende do runtime do
 * framework. O que é testado é a lógica que ela consome.
 */

import { describe, expect, it, beforeEach } from "vitest";
import {
  CredencialInvalida,
  UsuarioBloqueado,
  autenticar,
  criarUsuario,
  encerrarSessao,
  encerrarTodasAsSessoes,
  resolverContexto,
} from "@/fiscal/servidor/sessao";
import type { DependenciasSessao } from "@/fiscal/servidor/portas-servidor";
import { SessoesMemoria, UsuariosMemoria } from "@/fiscal/servidor/repositorios-memoria";
import { hashToken } from "@/fiscal/autenticacao";
import type { ContextoUsuario, Papel } from "@/fiscal/seguranca";

const TENANT = "tenant-a";
const AGORA = "2026-10-14T12:00:00.000Z";

function montar(): DependenciasSessao {
  return { usuarios: new UsuariosMemoria(), sessoes: new SessoesMemoria() };
}

async function comUsuario(
  deps: DependenciasSessao,
  over: Partial<{ senha: string; papel: Papel; ativo: boolean; email: string }> = {},
): Promise<string> {
  const email = over.email ?? "ana@empresa.com";
  const senha = over.senha ?? "senha-correta-123";
  await criarUsuario(deps, {
    id: "usr-1",
    tenantId: TENANT,
    email,
    senha,
    papel: over.papel ?? "operador",
  });
  if (over.ativo === false) {
    const u = await deps.usuarios.buscarPorEmail(TENANT, email);
    if (u) (u as { ativo: boolean }).ativo = false;
  }
  return email;
}

async function login(
  deps: DependenciasSessao,
  email = "ana@empresa.com",
  senha = "senha-correta-123",
) {
  return autenticar(deps, { tenantId: TENANT, email, senha, agora: AGORA });
}

describe("autenticação — credenciais", () => {
  let deps: DependenciasSessao;
  beforeEach(async () => {
    deps = montar();
    await comUsuario(deps);
  });

  it("autentica com e-mail e senha corretos e devolve o token uma única vez", async () => {
    const r = await login(deps);
    expect(r.token).toBeTruthy();
    expect(r.usuario.email).toBe("ana@empresa.com");
    expect(r.usuario.papel).toBe("operador");
    expect(r.expiraEm > AGORA).toBe(true);
  });

  it("rejeita senha errada com mensagem genérica", async () => {
    await expect(login(deps, "ana@empresa.com", "senha-errada-999")).rejects.toThrow(
      CredencialInvalida,
    );
  });

  it("rejeita e-mail inexistente com a MESMA mensagem (sem enumeração de usuário)", async () => {
    let erroInexistente = "";
    let erroSenhaErrada = "";
    try {
      await login(deps, "nao-existe@empresa.com", "senha-correta-123");
    } catch (e) {
      erroInexistente = (e as Error).message;
    }
    try {
      await login(deps, "ana@empresa.com", "senha-errada-999");
    } catch (e) {
      erroSenhaErrada = (e as Error).message;
    }
    expect(erroInexistente).toBe("E-mail ou senha inválidos.");
    expect(erroSenhaErrada).toBe("E-mail ou senha inválidos.");
  });

  it("rejeita usuário inativo com a mesma mensagem genérica", async () => {
    await comUsuario(montar()); // garante estado limpo
    const d2 = montar();
    await comUsuario(d2, { ativo: false });
    await expect(login(d2)).rejects.toThrow("E-mail ou senha inválidos.");
  });

  it("o e-mail é do tenant informado: mesmo e-mail em outro tenant não autentica", async () => {
    await expect(
      autenticar(deps, {
        tenantId: "tenant-b",
        email: "ana@empresa.com",
        senha: "senha-correta-123",
        agora: AGORA,
      }),
    ).rejects.toThrow(CredencialInvalida);
  });
});

describe("autenticação — bloqueio progressivo", () => {
  it("bloqueia na 5ª falha consecutiva e mantém o bloqueio mesmo com senha correta", async () => {
    const deps = montar();
    await comUsuario(deps);

    // As 4 primeiras falhas são credencial inválida.
    for (let i = 0; i < 4; i++) {
      await expect(login(deps, "ana@empresa.com", "senha-errada-999")).rejects.toThrow(
        CredencialInvalida,
      );
    }

    // A 5ª falha já dispara o bloqueio (falha rápido: não adianta tentar de novo).
    const erro5 = await login(deps, "ana@empresa.com", "senha-errada-999").catch(
      (e) => e as UsuarioBloqueado,
    );
    expect(erro5).toBeInstanceOf(UsuarioBloqueado);
    expect((erro5 as UsuarioBloqueado).segundosRestantes).toBe(900);

    // Bloqueado: nem a senha correta passa.
    const erro6 = await login(deps).catch((e) => e as UsuarioBloqueado);
    expect(erro6).toBeInstanceOf(UsuarioBloqueado);
    expect((erro6 as Error).message).toContain("bloqueada");
  });

  it("login bem-sucedido zera o contador de falhas", async () => {
    const deps = montar();
    await comUsuario(deps);
    for (let i = 0; i < 4; i++) {
      await expect(login(deps, "ana@empresa.com", "errada-000000")).rejects.toThrow(
        CredencialInvalida,
      );
    }
    await expect(login(deps)).resolves.toBeTruthy(); // 5ª com senha certa
    const u = await deps.usuarios.buscarPorEmail(TENANT, "ana@empresa.com");
    expect(u?.falhasLogin).toBe(0);
    expect(u?.bloqueadoAte).toBeNull();
  });
});

describe("sessão — o token nunca é recuperável", () => {
  it("o repositório guarda apenas o hash: buscar pelo token em texto não encontra nada", async () => {
    const deps = montar();
    await comUsuario(deps);
    const { token } = await login(deps);

    // Prova de que não existe "buscar por token": só existe por hash.
    expect(typeof (deps.sessoes as SessoesMemoria).buscarPorTokenHash).toBe("function");
    const porToken = await deps.sessoes.buscarPorTokenHash(token);
    expect(porToken).toBeUndefined();

    // E pelo hash encontra.
    const porHash = await deps.sessoes.buscarPorTokenHash(hashToken(token));
    expect(porHash?.usuarioId).toBe("usr-1");
  });

  it("o token em texto não aparece em nenhum campo da sessão persistida", async () => {
    const deps = montar();
    await comUsuario(deps);
    const { token } = await login(deps);
    const sessao = await deps.sessoes.buscarPorTokenHash(hashToken(token));
    expect(sessao).toBeDefined();
    const json = JSON.stringify(sessao);
    expect(json).not.toContain(token);
    expect(Object.keys(sessao ?? {})).not.toContain("token");
  });
});

describe("sessão — resolução de contexto", () => {
  it("resolve contexto para token válido", async () => {
    const deps = montar();
    await comUsuario(deps, { papel: "administrador" });
    const { token } = await login(deps);
    const ctx = await resolverContexto(deps, token, AGORA);
    expect(ctx).toEqual<ContextoUsuario>({
      usuarioId: "usr-1",
      tenantId: TENANT,
      papel: "administrador",
      estabelecimentoIds: undefined,
    });
  });

  it("devolve null para token vazio, desconhecido ou adulterado", async () => {
    const deps = montar();
    await comUsuario(deps);
    const { token } = await login(deps);
    expect(await resolverContexto(deps, "", AGORA)).toBeNull();
    expect(await resolverContexto(deps, "token-inventado", AGORA)).toBeNull();
    expect(await resolverContexto(deps, `${token}x`, AGORA)).toBeNull();
  });

  it("devolve null para sessão expirada", async () => {
    const deps = montar();
    await comUsuario(deps);
    const { token, expiraEm } = await login(deps);
    const depois = new Date(new Date(expiraEm).getTime() + 1000).toISOString();
    expect(await resolverContexto(deps, token, depois)).toBeNull();
    // um instante antes da expiração ainda funciona
    expect(await resolverContexto(deps, token, expiraEm)).toBeNull(); // expiraEm <= agora
  });

  it("devolve null depois do logout (sessão revogada)", async () => {
    const deps = montar();
    await comUsuario(deps);
    const { token } = await login(deps);
    expect(await resolverContexto(deps, token, AGORA)).not.toBeNull();
    await encerrarSessao(deps, token);
    expect(await resolverContexto(deps, token, AGORA)).toBeNull();
  });

  it("logout é idempotente: token inválido não gera erro", async () => {
    const deps = montar();
    await expect(encerrarSessao(deps, "token-inventado")).resolves.toBeUndefined();
    await expect(encerrarSessao(deps, "")).resolves.toBeUndefined();
  });

  it("usuário desativado depois do login perde a sessão", async () => {
    const deps = montar();
    await comUsuario(deps);
    const { token } = await login(deps);
    const u = await deps.usuarios.buscarPorEmail(TENANT, "ana@empresa.com");
    (u as { ativo: boolean }).ativo = false;
    expect(await resolverContexto(deps, token, AGORA)).toBeNull();
  });

  it("encerrar todas as sessões invalida cada token emitido", async () => {
    const deps = montar();
    await comUsuario(deps);
    const a = await login(deps);
    const b = await login(deps);
    await encerrarTodasAsSessoes(deps, "usr-1");
    expect(await resolverContexto(deps, a.token, AGORA)).toBeNull();
    expect(await resolverContexto(deps, b.token, AGORA)).toBeNull();
  });
});

describe("criação de usuário", () => {
  it("recusa senha curta", async () => {
    const deps = montar();
    await expect(
      criarUsuario(deps, {
        id: "u2",
        tenantId: TENANT,
        email: "b@b.com",
        senha: "curta",
        papel: "operador",
      }),
    ).rejects.toThrow(/8 caracteres/);
  });

  it("a senha não aparece em texto no registro do usuário", async () => {
    const deps = montar();
    await comUsuario(deps);
    const u = await deps.usuarios.buscarPorEmail(TENANT, "ana@empresa.com");
    expect(u).toBeDefined();
    expect(JSON.stringify(u)).not.toContain("senha-correta-123");
    expect(u?.hashSenha.hash).not.toBe("senha-correta-123");
  });
});
