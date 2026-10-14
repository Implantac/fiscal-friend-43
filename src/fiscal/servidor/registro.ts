/**
 * REGISTRO GLOBAL — singletons que sobrevivem à duplicação de módulos.
 *
 * ============================================================================
 * POR QUE ISSO EXISTE
 * ============================================================================
 * Em desenvolvimento, o plugin do TanStack Start carrega os módulos de server
 * function com um sufixo de query (`…sessao.functions.ts?tss-serverfn-split`).
 * Para o Vite, aquilo é um módulo **diferente** do que as rotas importam sem a
 * query. Consequência observada em execução real, não teorizada:
 *
 *   POST /_serverFn/<iniciarSessao>    -> 200, cookie gravado, sessão criada
 *   GET  /_serverFn/<listarDocumentos> -> "Sessão inválida ou expirada"
 *
 * O login gravava a sessão no `SessoesMemoria` de uma instância do módulo;
 * `exigirContexto()` — chamado de dentro de `documento.functions.ts`, que
 * importa `sessao.functions.ts` sem a query — consultava o `SessoesMemoria` de
 * outra instância. A sessão existia. O lugar onde ela foi guardada é que não
 * era o mesmo.
 *
 * Um `let` de módulo não sobrevive a isso. `globalThis` sobrevive: exista uma
 * ou dez instâncias do módulo, existe um único registro.
 *
 * Em produção o bundle é único e o sintoma não aparece — mas a correção vale
 * para os dois ambientes, e o teste de regressão está aqui justamente porque o
 * bug só se manifestava em um deles.
 *
 * ============================================================================
 * O QUE ISTO NÃO É
 * ============================================================================
 * Não é cache de dados de negócio e não é estado de request. É apenas o lar
 * dos singletons de processo (repositórios em memória, pool de conexão). Nada
 * aqui é por-usuário: o isolamento por tenant continua nas consultas e na RLS.
 */

/**
 * Devolve o registro identificado por `chave`, criando-o na primeira chamada.
 *
 * A chave deve ser única no processo e estável entre deploys — dois módulos
 * que precisem compartilhar estado usam a mesma string.
 */
export function registroGlobal<T extends object>(chave: string): T {
  const g = globalThis as typeof globalThis & { [k: string]: unknown };
  const atual = g[chave];
  if (atual && typeof atual === "object") return atual as T;
  const novo = {} as T;
  g[chave] = novo;
  return novo;
}
