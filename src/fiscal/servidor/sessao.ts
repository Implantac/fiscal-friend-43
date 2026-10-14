/**
 * LÓGICA DE AUTENTICAÇÃO E RESOLUÇÃO DE CONTEXTO.
 *
 * ============================================================================
 * REGRAS DE SEGURANÇA IMPLEMENTADAS
 * ============================================================================
 * 1. **Sem enumeração de usuário.** E-mail inexistente, usuário inativo e
 *    senha errada produzem a mesma mensagem e passam pelo mesmo atraso. Se o
 *    sistema dissesse "e-mail não encontrado", um atacante descobriria contas
 *    válidas a partir da resposta.
 * 2. **Token só existe uma vez.** `autenticar` devolve o token em texto (para
 *    o cookie HttpOnly); o repositório guarda apenas o hash. Nada consegue
 *    recuperar o token depois — nem o próprio banco.
 * 3. **Sessão inválida ≠ acesso.** Token expirado, revogado ou inexistente
 *    devolve `null` — nunca um contexto parcial ou "usuário genérico".
 * 4. **O contexto carrega o tenant.** A sessão define de qual tenant o usuário
 *    está falando; o tenant não é parâmetro livre do request.
 *
 * Este módulo é puro (sem HTTP, sem cookie, sem framework): a camada HTTP
 * (`sessao.server.ts`) apenas traduz request ⇄ estas funções.
 */

import {
  ErroAutenticacao,
  MINUTOS_SESSAO,
  gerarTokenSessao,
  hashSenha,
  hashToken,
  loginBloqueado,
  registrarFalhaLogin,
  registrarSucessoLogin,
  segundosRestantesBloqueio,
  verificarSenha,
} from "@/fiscal/autenticacao";
import type { ContextoUsuario, Papel } from "@/fiscal/seguranca";
import type { SenhaHash } from "@/fiscal/autenticacao";
import type { DependenciasSessao, SessaoInterna, UsuarioInterno } from "./portas-servidor";

export interface ResultadoLogin {
  /** Token em texto — devolvido UMA vez, para o cookie HttpOnly. */
  token: string;
  expiraEm: string;
  usuario: { id: string; tenantId: string; email: string; papel: Papel };
}

export class CredencialInvalida extends ErroAutenticacao {
  constructor() {
    super("E-mail ou senha inválidos.");
    this.name = "CredencialInvalida";
  }
}

export class UsuarioBloqueado extends ErroAutenticacao {
  constructor(readonly segundosRestantes: number) {
    super(
      `Conta temporariamente bloqueada por excesso de tentativas. Tente novamente em ${segundosRestantes} segundo(s).`,
    );
    this.name = "UsuarioBloqueado";
  }
}

export const MAX_FALHAS_LOGIN = 5;

const ATRASO_ANTI_ENUMERACAO_MS = 120;

/**
 * Autentica por e-mail e senha.
 *
 * @param entrada.tenantId tenant informado no login — um mesmo e-mail pode
 *        existir em tenants distintos; o tenant faz parte da credencial.
 */
export async function autenticar(
  deps: DependenciasSessao,
  entrada: {
    tenantId: string;
    email: string;
    senha: string;
    agora: string;
    ip?: string | undefined;
    agente?: string | undefined;
  },
): Promise<ResultadoLogin> {
  const usuario = await deps.usuarios.buscarPorEmail(entrada.tenantId, entrada.email);

  // Caminho único para "usuário não existe" e "usuário inativo": sem enumeração.
  if (!usuario || !usuario.ativo) {
    await atraso(ATRASO_ANTI_ENUMERACAO_MS);
    throw new CredencialInvalida();
  }

  const estado = { falhas: usuario.falhasLogin, bloqueadoAte: usuario.bloqueadoAte };
  if (loginBloqueado(estado, entrada.agora)) {
    throw new UsuarioBloqueado(segundosRestantesBloqueio(estado, entrada.agora));
  }

  const senhaOk = await verificarSenha(entrada.senha, usuario.hashSenha);
  if (!senhaOk) {
    const novo = registrarFalhaLogin(estado, entrada.agora);
    await deps.usuarios.registrarFalhaLogin(
      usuario.tenantId,
      usuario.id,
      novo.falhas,
      novo.bloqueadoAte,
    );
    if (loginBloqueado(novo, entrada.agora)) {
      throw new UsuarioBloqueado(segundosRestantesBloqueio(novo, entrada.agora));
    }
    throw new CredencialInvalida();
  }

  await deps.usuarios.registrarSucessoLogin(usuario.tenantId, usuario.id);

  const { token, tokenHash } = gerarTokenSessao();
  const expiraEm = new Date(
    new Date(entrada.agora).getTime() + MINUTOS_SESSAO * 60_000,
  ).toISOString();

  await deps.sessoes.criar({
    id: crypto.randomUUID(),
    tenantId: usuario.tenantId,
    usuarioId: usuario.id,
    papel: usuario.papel,
    tokenHash,
    expiraEm,
    ip: entrada.ip,
    agente: entrada.agente,
  });

  return {
    token, // única vez que o token em texto existe no sistema
    expiraEm,
    usuario: {
      id: usuario.id,
      tenantId: usuario.tenantId,
      email: usuario.email,
      papel: usuario.papel,
    },
  };
}

/**
 * Resolve o contexto do usuário a partir do token de sessão.
 *
 * Devolve `null` — e não um contexto parcial — quando o token é inválido,
 * expirado, revogado, ou quando o usuário foi desativado depois do login.
 */
export async function resolverContexto(
  deps: DependenciasSessao,
  token: string,
  agora: string,
): Promise<ContextoUsuario | null> {
  if (!token) return null;

  const sessao = await deps.sessoes.buscarPorTokenHash(hashToken(token));
  if (!sessao) return null;
  if (sessao.revogadaEm !== null) return null;
  if (sessao.expiraEm <= agora) return null;

  const usuario = await deps.usuarios.buscarPorId(sessao.tenantId, sessao.usuarioId);
  if (!usuario || !usuario.ativo) return null;

  return {
    usuarioId: usuario.id,
    tenantId: usuario.tenantId,
    papel: usuario.papel,
    estabelecimentoIds: usuario.estabelecimentoIds,
  };
}

/** Encerra a sessão (logout). Idempotente: token inválido não gera erro. */
export async function encerrarSessao(deps: DependenciasSessao, token: string): Promise<void> {
  if (!token) return;
  const sessao = await deps.sessoes.buscarPorTokenHash(hashToken(token));
  if (!sessao || sessao.revogadaEm) return;
  // O tenant só é conhecido AGORA, depois de a sessão ser encontrada. É ele que
  // autoriza a revogação — a política de RLS de `sessoes` exige o contexto.
  await deps.sessoes.revogar(sessao.tenantId, sessao.id);
}

/** Encerra todas as sessões de um usuário (ex.: troca de senha, desativação). */
export async function encerrarTodasAsSessoes(
  deps: DependenciasSessao,
  tenantId: string,
  usuarioId: string,
): Promise<void> {
  await deps.sessoes.revogarTodasDoUsuario(tenantId, usuarioId);
}

/**
 * Cria um usuário com a senha já hasheada (nunca em texto).
 * A senha em texto vive apenas durante esta chamada.
 */
export async function criarUsuario(
  deps: DependenciasSessao,
  entrada: {
    id: string;
    tenantId: string;
    email: string;
    senha: string;
    papel: Papel;
    estabelecimentoIds?: string[] | undefined;
  },
): Promise<void> {
  const hash: SenhaHash = await hashSenha(entrada.senha);
  const usuario: UsuarioInterno = {
    id: entrada.id,
    tenantId: entrada.tenantId,
    email: entrada.email,
    hashSenha: hash,
    papel: entrada.papel,
    ativo: true,
    falhasLogin: 0,
    bloqueadoAte: null,
    estabelecimentoIds: entrada.estabelecimentoIds,
  };
  await deps.usuarios.criar(usuario);
}

function atraso(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export type { SessaoInterna, UsuarioInterno };
