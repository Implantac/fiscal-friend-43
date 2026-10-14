/**
 * AUTENTICAÇÃO, AUTORIZAÇÃO E SEGREGAÇÃO DE PAPÉIS.
 *
 * ============================================================================
 * O QUE ESTE MÓDULO FAZ
 * ============================================================================
 * Define papéis, permissões e o contexto do usuário autenticado, e **nega**
 * qualquer operação fora do papel ou fora do tenant.
 *
 * ============================================================================
 * O QUE ELE NÃO FAZ (ainda)
 * ============================================================================
 * Não implementa login, senha, token, sessão ou MFA. Isso exige back-end com
 * armazenamento seguro de credenciais — Etapa 2.5. O que existe aqui é o
 * **contrato de autorização**, já testado, para que a UI e os serviços futuros
 * não inventem regra de acesso própria.
 *
 * Regra de ouro: a autorização é verificada no servidor, nunca apenas na
 * interface. Uma tela que esconde um botão não é controle de acesso.
 */

export type Papel =
  /** Dono da conta: gerencia empresas, certificados e usuários. */
  | "administrador"
  /** Especialista tributário: aprova regras e vigências. */
  | "fiscal"
  /** Operador de emissão: cria e transmite documentos. */
  | "operador"
  /** Suporte: apenas leitura, com trilha de auditoria reforçada. */
  | "suporte"
  /** Auditor: somente leitura, sem qualquer ação de escrita. */
  | "auditor";

export type Permissao =
  | "documento.criar"
  | "documento.transmitir"
  | "documento.cancelar"
  | "documento.consultar"
  | "empresa.gerenciar"
  | "estabelecimento.gerenciar"
  | "certificado.gerenciar"
  | "participante.gerenciar"
  | "regra.propor"
  | "regra.aprovar"
  | "leitura";

const PERMISSOES: Record<Papel, Permissao[]> = {
  administrador: [
    "documento.criar",
    "documento.transmitir",
    "documento.cancelar",
    "documento.consultar",
    "empresa.gerenciar",
    "estabelecimento.gerenciar",
    "certificado.gerenciar",
    "participante.gerenciar",
    "regra.propor",
    "regra.aprovar",
    "leitura",
  ],
  fiscal: [
    "documento.consultar",
    "participante.gerenciar",
    "regra.propor",
    "regra.aprovar",
    "leitura",
  ],
  operador: [
    "documento.criar",
    "documento.transmitir",
    "documento.consultar",
    "participante.gerenciar",
    "leitura",
  ],
  suporte: ["documento.consultar", "leitura"],
  auditor: ["documento.consultar", "leitura"],
};

/** Contexto do usuário autenticado. Construído no servidor a partir da sessão. */
export interface ContextoUsuario {
  usuarioId: string;
  tenantId: string;
  papel: Papel;
  /**
   * Estabelecimentos aos quais o usuário tem acesso. Vazio/indefinido = todos
   * os estabelecimentos do tenant (comportamento do administrador).
   */
  estabelecimentoIds?: string[] | undefined;
  /** Nome exibido, usado apenas em trilha de auditoria. */
  nome?: string | undefined;
}

/* ------------------------------------------------------------------ erros */

export class PermissaoNegada extends Error {
  constructor(
    readonly usuarioId: string,
    readonly papel: Papel,
    readonly permissao: Permissao,
  ) {
    super(
      `Permissão "${permissao}" negada para o usuário ${usuarioId} (papel ${papel}). ` +
        `A tentativa deve ser registrada em auditoria.`,
    );
    this.name = "PermissaoNegada";
  }
}

export class AcessoEstabelecimentoNegado extends Error {
  constructor(usuarioId: string, estabelecimentoId: string) {
    super(
      `Usuário ${usuarioId} não tem acesso ao estabelecimento ${estabelecimentoId}. ` +
        `A tentativa deve ser registrada em auditoria.`,
    );
    this.name = "AcessoEstabelecimentoNegado";
  }
}

/* ------------------------------------------------------------ verificações */

export function permissoesDoPapel(papel: Papel): Permissao[] {
  return [...PERMISSOES[papel]];
}

export function pode(ctx: ContextoUsuario, permissao: Permissao): boolean {
  return PERMISSOES[ctx.papel].includes(permissao);
}

/** Lança `PermissaoNegada` se o papel não cobre a permissão. */
export function assertPermitido(ctx: ContextoUsuario, permissao: Permissao): void {
  if (!pode(ctx, permissao)) {
    throw new PermissaoNegada(ctx.usuarioId, ctx.papel, permissao);
  }
}

/**
 * Verifica acesso a um estabelecimento específico.
 * Lista vazia = acesso a todos os estabelecimentos do tenant.
 */
export function assertAcessoEstabelecimento(ctx: ContextoUsuario, estabelecimentoId: string): void {
  const lista = ctx.estabelecimentoIds;
  if (lista && lista.length > 0 && !lista.includes(estabelecimentoId)) {
    throw new AcessoEstabelecimentoNegado(ctx.usuarioId, estabelecimentoId);
  }
}

/**
 * Verificação completa de uma operação: permissão do papel + tenant do recurso.
 * Usada por todo serviço de aplicação antes de tocar em dados.
 */
export function assertAutorizado(
  ctx: ContextoUsuario,
  permissao: Permissao,
  recurso?: { tenantId: string; estabelecimentoId?: string } | undefined,
): void {
  assertPermitido(ctx, permissao);
  if (recurso) {
    if (recurso.tenantId !== ctx.tenantId) {
      throw new PermissaoNegada(ctx.usuarioId, ctx.papel, permissao);
    }
    if (recurso.estabelecimentoId) {
      assertAcessoEstabelecimento(ctx, recurso.estabelecimentoId);
    }
  }
}

/**
 * Separação de funções: quem aprova regra não pode ser o mesmo que a executou
 * em documento de produção. Regra preventiva contra autoaprovacao.
 */
export function violaSeparacaoDeFuncoes(aprovador: ContextoUsuario, executanteId: string): boolean {
  return aprovador.usuarioId === executanteId;
}
