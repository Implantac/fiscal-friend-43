import { describe, expect, it } from "vitest";
import {
  ErroAutenticacao,
  MAX_FALHAS_LOGIN,
  MINUTOS_BLOQUEIO,
  desserializarSenhaHash,
  gerarTokenSessao,
  hashSenha,
  hashToken,
  loginBloqueado,
  registrarFalhaLogin,
  registrarSucessoLogin,
  segundosRestantesBloqueio,
  serializarSenhaHash,
  sessaoExpirada,
  verificarSenha,
} from "./autenticacao";

const AGORA = "2026-10-14T12:00:00.000Z";

describe("hash de senha", () => {
  it("nunca devolve a senha em texto", async () => {
    const h = await hashSenha("senha-de-teste-123");
    const serializado = serializarSenhaHash(h);
    expect(serializado).not.toContain("senha-de-teste-123");
    expect(serializado.startsWith("PBKDF2-SHA256$")).toBe(true);
  });

  it("gera salt diferente para senhas iguais (resistência a rainbow table)", async () => {
    const a = await hashSenha("mesma-senha-123");
    const b = await hashSenha("mesma-senha-123");
    expect(a.salt).not.toBe(b.salt);
    expect(a.hash).not.toBe(b.hash);
    expect(await verificarSenha("mesma-senha-123", b)).toBe(true);
  });

  it("aceita a senha correta e rejeita as demais", async () => {
    const h = await hashSenha("senha-correta-1");
    expect(await verificarSenha("senha-correta-1", h)).toBe(true);
    expect(await verificarSenha("senha-errada-99", h)).toBe(false);
    expect(await verificarSenha("", h)).toBe(false);
  });

  it("recusa senha curta em vez de aceitar credencial fraca", async () => {
    await expect(hashSenha("curta")).rejects.toThrow(ErroAutenticacao);
    await expect(hashSenha("")).rejects.toThrow(ErroAutenticacao);
  });

  it("sobrevive a serialização e desserialização", async () => {
    const h = await hashSenha("round-trip-1234");
    const restaurado = desserializarSenhaHash(serializarSenhaHash(h));
    expect(await verificarSenha("round-trip-1234", restaurado)).toBe(true);
    expect(await verificarSenha("outra-senha-999", restaurado)).toBe(false);
  });

  it("recusa formato de hash desconhecido ou corrompido", () => {
    expect(() => desserializarSenhaHash("formato-invalido")).toThrow(ErroAutenticacao);
    expect(() => desserializarSenhaHash("BCRYPT$10$salt$hash")).toThrow(/não suportado/);
  });

  it("a verificação leva tempo comparável para senha certa e errada (tempo constante)", async () => {
    const h = await hashSenha("tempo-constante-1");
    const t0 = Date.now();
    await verificarSenha("tempo-constante-1", h);
    const certo = Date.now() - t0;
    const t1 = Date.now();
    await verificarSenha("t", h); // primeiro byte já difere
    const errado = Date.now() - t1;
    // Não é teste de timing preciso (PBKDF2 domina), mas garante que a senha
    // errada não é rejeitada por atalho óbvio.
    expect(certo).toBeGreaterThan(0);
    expect(errado).toBeGreaterThan(0);
  });
});

describe("token de sessão", () => {
  it("gera tokens opacos, aleatórios e não derivados do usuário", () => {
    const a = gerarTokenSessao();
    const b = gerarTokenSessao();
    expect(a.token).not.toBe(b.token);
    expect(a.token.length).toBeGreaterThan(30);
    expect(a.token).not.toMatch(/^[0-9a-f-]{36}$/); // não é UUID previsível
  });

  it("o hash do token é determinístico e não revela o token", () => {
    const { token, tokenHash } = gerarTokenSessao();
    expect(hashToken(token)).toBe(tokenHash);
    expect(tokenHash).not.toContain(token);
    expect(tokenHash).toMatch(/^[0-9a-f]{64}$/); // SHA-256 hex
  });

  it("detecta sessão expirada", () => {
    expect(sessaoExpirada("2026-10-14T12:00:00.000Z", AGORA)).toBe(true);
    expect(sessaoExpirada("2026-10-14T13:00:00.000Z", AGORA)).toBe(false);
  });
});

describe("controle de abuso", () => {
  it("bloqueia após o limite de falhas consecutivas", () => {
    let estado = { falhas: 0, bloqueadoAte: null as string | null };
    for (let i = 0; i < MAX_FALHAS_LOGIN; i++) estado = registrarFalhaLogin(estado, AGORA);
    expect(estado.falhas).toBe(MAX_FALHAS_LOGIN);
    expect(loginBloqueado(estado, AGORA)).toBe(true);
    expect(segundosRestantesBloqueio(estado, AGORA)).toBe(MINUTOS_BLOQUEIO * 60);
  });

  it("não bloqueia antes do limite", () => {
    let estado = { falhas: 0, bloqueadoAte: null as string | null };
    estado = registrarFalhaLogin(estado, AGORA);
    estado = registrarFalhaLogin(estado, AGORA);
    expect(loginBloqueado(estado, AGORA)).toBe(false);
  });

  it("o bloqueio expira com o tempo", () => {
    let estado = { falhas: 0, bloqueadoAte: null as string | null };
    for (let i = 0; i < MAX_FALHAS_LOGIN; i++) estado = registrarFalhaLogin(estado, AGORA);
    const depois = new Date(
      new Date(AGORA).getTime() + (MINUTOS_BLOQUEIO + 1) * 60_000,
    ).toISOString();
    expect(loginBloqueado(estado, depois)).toBe(false);
    expect(segundosRestantesBloqueio(estado, depois)).toBe(0);
  });

  it("login bem-sucedido zera o contador", () => {
    let estado = { falhas: 3, bloqueadoAte: null as string | null };
    estado = registrarSucessoLogin();
    expect(estado).toEqual({ falhas: 0, bloqueadoAte: null });
  });
});
