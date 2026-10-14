/**
 * AUTENTICAÇÃO SERVER-SIDE — hash de senha, sessão e controle de abuso.
 *
 * ============================================================================
 * ONDE ISSO PODE RODAR
 * ============================================================================
 * EXCLUSIVAMENTE no servidor. Este módulo importa `crypto` e lida com material
 * de credencial; importá-lo a partir de código de rota (que roda no cliente)
 * seria uma falha de arquitetura com consequência de segurança. A separação é
 * reforçada por regra de lint (`eslint.config.js`).
 *
 * ============================================================================
 * O QUE ESTE MÓDULO GARANTE
 * ============================================================================
 * 1. Senha nunca é armazenada em texto — PBKDF2-SHA256 com salt por usuário.
 * 2. Token de sessão nunca é armazenado em texto — apenas seu hash; o token em
 *    si trafega por cookie HttpOnly.
 * 3. Comparação de senha em tempo constante (evita timing attack).
 * 4. Bloqueio progressivo após falhas consecutivas (contra força bruta).
 *
 * ============================================================================
 * O QUE ELE NÃO FAZ
 * ============================================================================
 * Não gerencia cookie, não faz login por formulário, não integra SSO. Isso é
 * responsabilidade da camada HTTP (Etapa 2.6), que consome estas funções.
 */

import { createHash } from "node:crypto";

// Marcador do framework: este módulo é exclusivo de servidor. Se algum dia for
// importado por código de rota, o build FALHA (regra import-protection), em vez
// de embarcar `node:crypto` no bundle do navegador.
import "@tanstack/react-start/server-only";

const PBKDF2_ITERACOES = 210_000;
const TAMANHO_SALT = 16;
const TAMANHO_HASH = 32;
const TAMANHO_TOKEN = 32;

export const MAX_FALHAS_LOGIN = 5;
export const MINUTOS_BLOQUEIO = 15;
export const MINUTOS_SESSAO = 60;

/* ------------------------------------------------------------------ senhas */

export interface SenhaHash {
  algoritmo: "PBKDF2-SHA256";
  iteracoes: number;
  salt: string;
  hash: string;
}

const paraBase64 = (buf: ArrayBuffer): string => Buffer.from(buf).toString("base64");
const deBase64 = (texto: string): Uint8Array => new Uint8Array(Buffer.from(texto, "base64"));

function subtil(): SubtleCrypto {
  const c = globalThis.crypto;
  if (!c?.subtle) {
    throw new Error(
      "Web Crypto indisponível. A autenticação só pode rodar em ambiente com crypto.subtle (servidor).",
    );
  }
  return c.subtle;
}

/**
 * Gera o hash de uma senha.
 * O salt é aleatório por senha — duas senhas iguais geram hashes diferentes.
 */
export async function hashSenha(senha: string): Promise<SenhaHash> {
  if (!senha || senha.length < 8) {
    throw new ErroAutenticacao("Senha deve ter ao menos 8 caracteres.");
  }
  const salt = globalThis.crypto.getRandomValues(new Uint8Array(TAMANHO_SALT));
  const hash = await derivar(senha, salt, PBKDF2_ITERACOES);
  return {
    algoritmo: "PBKDF2-SHA256",
    iteracoes: PBKDF2_ITERACOES,
    salt: paraBase64(salt.buffer as ArrayBuffer),
    hash: paraBase64(hash),
  };
}

async function derivar(senha: string, salt: Uint8Array, iteracoes: number): Promise<ArrayBuffer> {
  const chave = await subtil().importKey("raw", new TextEncoder().encode(senha), "PBKDF2", false, [
    "deriveBits",
  ]);
  return subtil().deriveBits(
    {
      name: "PBKDF2",
      salt: salt as unknown as BufferSource,
      iterations: iteracoes,
      hash: "SHA-256",
    },
    chave,
    TAMANHO_HASH * 8,
  );
}

/**
 * Verifica a senha em **tempo constante**.
 *
 * A comparação é feita byte a byte sem short-circuit: uma comparação que
 * abandonasse no primeiro byte diferente vazaria, por timing, quantos bytes
 * iniciais estavam corretos.
 */
export async function verificarSenha(senha: string, registro: SenhaHash): Promise<boolean> {
  const salt = deBase64(registro.salt);
  const hashInformado = await derivar(senha, salt, registro.iteracoes);
  const hashEsperado = deBase64(registro.hash);

  if (hashInformado.byteLength !== hashEsperado.length) return false;

  let diff = 0;
  const a = new Uint8Array(hashInformado);
  for (let i = 0; i < hashEsperado.length; i++) {
    diff |= a[i]! ^ hashEsperado[i]!;
  }
  return diff === 0;
}

export function serializarSenhaHash(s: SenhaHash): string {
  return `${s.algoritmo}$${s.iteracoes}$${s.salt}$${s.hash}`;
}

export function desserializarSenhaHash(texto: string): SenhaHash {
  const partes = texto.split("$");
  if (partes.length !== 4) throw new ErroAutenticacao("Formato de hash de senha inválido.");
  const [algoritmo, iteracoes, salt, hash] = partes as [string, string, string, string];
  if (algoritmo !== "PBKDF2-SHA256") {
    throw new ErroAutenticacao(`Algoritmo de hash não suportado: ${algoritmo}`);
  }
  return { algoritmo: "PBKDF2-SHA256", iteracoes: Number(iteracoes), salt, hash };
}

/* ----------------------------------------------------------------- sessões */

export interface Sessao {
  token: string;
  tokenHash: string;
  usuarioId: string;
  tenantId: string;
  papel: string;
  expiraEm: string;
}

/** Gera token opaco e aleatório. Nunca derivado de dados do usuário. */
export function gerarTokenSessao(): { token: string; tokenHash: string } {
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(TAMANHO_TOKEN));
  const token = Buffer.from(bytes).toString("base64url");
  return { token, tokenHash: hashToken(token) };
}

/**
 * Hash do token (SHA-256). O banco guarda o hash; se o banco vazar, os tokens
 * de sessão ativos continuam inutilizáveis.
 */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function sessaoExpirada(expiraEm: string, agora: string): boolean {
  return expiraEm <= agora;
}

/* ------------------------------------------------------- controle de abuso */

export interface EstadoLogin {
  falhas: number;
  bloqueadoAte: string | null;
}

/** Calcula o novo estado após uma falha de login. */
export function registrarFalhaLogin(estado: EstadoLogin, agora: string): EstadoLogin {
  const falhas = estado.falhas + 1;
  if (falhas >= MAX_FALHAS_LOGIN) {
    const bloqueadoAte = new Date(
      new Date(agora).getTime() + MINUTOS_BLOQUEIO * 60_000,
    ).toISOString();
    return { falhas, bloqueadoAte };
  }
  return { falhas, bloqueadoAte: null };
}

export function registrarSucessoLogin(): EstadoLogin {
  return { falhas: 0, bloqueadoAte: null };
}

export function loginBloqueado(estado: EstadoLogin, agora: string): boolean {
  return estado.bloqueadoAte !== null && estado.bloqueadoAte > agora;
}

/** Tempo restante de bloqueio, em segundos (0 se não bloqueado). */
export function segundosRestantesBloqueio(estado: EstadoLogin, agora: string): number {
  if (!loginBloqueado(estado, agora)) return 0;
  return Math.ceil((new Date(estado.bloqueadoAte!).getTime() - new Date(agora).getTime()) / 1000);
}

/* ------------------------------------------------------------------ erros */

export class ErroAutenticacao extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = "ErroAutenticacao";
  }
}
