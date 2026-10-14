/**
 * PORTAS DA CAMADA DE SERVIDOR — usuários e sessões.
 *
 * Framework-agnóstico: a lógica de autenticação (`sessao.ts`) depende apenas
 * destas interfaces, o que permite testá-la sem banco e sem HTTP.
 *
 * Nenhuma porta devolve senha ou token em texto: `buscarPorEmail` devolve o
 * hash, e `buscarPorTokenHash` devolve a sessão **sem** o token (o token só
 * existe uma vez, na resposta de login).
 */

import type { ContextoUsuario, Papel } from "@/fiscal/seguranca";
import type { SenhaHash } from "@/fiscal/autenticacao";

export interface UsuarioInterno {
  id: string;
  tenantId: string;
  email: string;
  hashSenha: SenhaHash;
  papel: Papel;
  ativo: boolean;
  falhasLogin: number;
  bloqueadoAte: string | null;
  estabelecimentoIds?: string[] | undefined;
}

export interface SessaoInterna {
  id: string;
  tenantId: string;
  usuarioId: string;
  papel: Papel;
  expiraEm: string;
  revogadaEm: string | null;
}

export interface RepositorioUsuarios {
  criar(usuario: UsuarioInterno): Promise<void>;
  buscarPorEmail(tenantId: string, email: string): Promise<UsuarioInterno | undefined>;
  buscarPorId(tenantId: string, id: string): Promise<UsuarioInterno | undefined>;
  registrarFalhaLogin(
    usuarioId: string,
    falhas: number,
    bloqueadoAte: string | null,
  ): Promise<void>;
  registrarSucessoLogin(usuarioId: string): Promise<void>;
}

export interface RepositorioSessoes {
  criar(sessao: {
    id: string;
    tenantId: string;
    usuarioId: string;
    papel: Papel;
    tokenHash: string;
    expiraEm: string;
    ip?: string | undefined;
    agente?: string | undefined;
  }): Promise<void>;
  buscarPorTokenHash(tokenHash: string): Promise<SessaoInterna | undefined>;
  revogar(sessaoId: string): Promise<void>;
  revogarTodasDoUsuario(usuarioId: string): Promise<void>;
}

/** Dependências injetadas na camada de autenticação. */
export interface DependenciasSessao {
  usuarios: RepositorioUsuarios;
  sessoes: RepositorioSessoes;
}
