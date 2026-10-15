/**
 * PORTAS DA CAMADA DE SERVIDOR — usuários e sessões.
 *
 * Framework-agnóstico: a lógica de autenticação (`sessao.ts`) depende apenas
 * destas interfaces, o que permite testá-la sem banco e sem HTTP.
 *
 * ============================================================================
 * REGRA DO TENANT NAS ASSINATURAS
 * ============================================================================
 * Toda operação de ESCRITA recebe `tenantId`. O motivo é a Row-Level Security do
 * migration 001: `FORCE ROW LEVEL SECURITY` sujeita até o dono da tabela à
 * política, e a política de `sessoes`/`usuarios` compara `tenant_id` com
 * `app.tenant_id`, que a aplicação fixa por transação. Sem o tenant explícito na
 * assinatura, nada obrigaria o chamador a informá-lo — e a escrita falharia com
 * zero linhas afetadas, um modo de falha silencioso.
 *
 * A única exceção é `buscarPorTokenHash`: o token de sessão é a credencial e
 * ainda não se sabe a qual tenant ele pertence. Ver a política de `sessoes` no
 * migration.
 *
 * ============================================================================
 * POR QUE A SESSÃO NÃO CARREGA O PAPEL DO USUÁRIO
 * ============================================================================
 * `SessaoInterna` **não tem `papel`**, e isso é deliberado. Já teve, e o campo era
 * lido com um `JOIN usuarios` na consulta por token — o que quebrava o login
 * inteiro sob RLS: a consulta roda sem contexto de tenant, e a política
 * estrita de `usuarios` devolvia zero linhas, então o `JOIN` eliminava a própria
 * sessão que se procurava. Nenhum teste pegou porque o `pg-mem` não implementa
 * Row-Level Security.
 *
 * Remover o campo também fechou um segundo problema, esse de autorização: o
 * papel gravado na sessão ficava velho. Se um administrador rebaixasse um
 * usuário de `administrador` para `leitor`, a sessão já aberta continuaria
 * reportando `administrador`. O papel é propriedade do usuário e é relido a
 * cada request, dentro do contexto do tenant.
 *
 * Nenhuma porta devolve senha ou token em texto: `buscarPorEmail` devolve o
 * hash, e `buscarPorTokenHash` devolve a sessão **sem** o token — o token só
 * existe uma vez, na resposta de login.
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
  expiraEm: string;
  revogadaEm: string | null;
}

export interface RepositorioUsuarios {
  criar(usuario: UsuarioInterno): Promise<void>;
  buscarPorEmail(tenantId: string, email: string): Promise<UsuarioInterno | undefined>;
  buscarPorId(tenantId: string, id: string): Promise<UsuarioInterno | undefined>;
  registrarFalhaLogin(
    tenantId: string,
    usuarioId: string,
    falhas: number,
    bloqueadoAte: string | null,
  ): Promise<void>;
  registrarSucessoLogin(tenantId: string, usuarioId: string): Promise<void>;
}

export interface RepositorioSessoes {
  criar(sessao: {
    id: string;
    tenantId: string;
    usuarioId: string;
    tokenHash: string;
    expiraEm: string;
    ip?: string | undefined;
    agente?: string | undefined;
  }): Promise<void>;
  /** Única consulta sem tenant: o hash do token é a credencial. */
  buscarPorTokenHash(tokenHash: string): Promise<SessaoInterna | undefined>;
  revogar(tenantId: string, sessaoId: string): Promise<void>;
  revogarTodasDoUsuario(tenantId: string, usuarioId: string): Promise<void>;
}

/** Dependências injetadas na camada de autenticação. */
export interface DependenciasSessao {
  usuarios: RepositorioUsuarios;
  sessoes: RepositorioSessoes;
}
