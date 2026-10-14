/**
 * AMBIENTE — leitura de variáveis de configuração e decisão de persistência.
 *
 * Módulo deliberadamente sem dependências: nenhum import de `node:*`, de driver
 * ou de framework. Ele pode ser importado por qualquer camada sem arrastar o
 * `pg` (Node puro) para o bundle do cliente. Quem precisa da conexão de verdade
 * importa `conexao-postgres.ts` dinamicamente.
 */

/** String de conexão: Lovable Cloud (`SUPABASE_DB_URL`) primeiro, genérico depois. */
export function urlDoBanco(): string | undefined {
  return process.env["SUPABASE_DB_URL"] ?? process.env["DATABASE_URL"] ?? undefined;
}

/**
 * Modo de persistência.
 * - `auto` (padrão): Postgres se houver string de conexão, memória caso contrário;
 * - `postgres`: exige Postgres — falha alto se não houver conexão;
 * - `memoria`: força repositório em memória (recusado em produção).
 */
export function modoPersistencia(): "auto" | "postgres" | "memoria" {
  const modo = (process.env["FISCAL_PERSISTENCIA"] ?? "auto").toLowerCase();
  if (modo === "postgres" || modo === "memoria") return modo;
  return "auto";
}

export function emProducao(): boolean {
  return process.env["NODE_ENV"] === "production";
}

export type DecisaoPersistencia =
  { tipo: "postgres" } | { tipo: "memoria" } | { tipo: "erro"; mensagem: string };

/**
 * Decide onde a sessão vai persistir — e **recusa** configurações que fingiriam
 * persistência.
 *
 * Função pura (lê só `process.env`), testável sem framework e sem banco. A
 * regra que importa: repositório em memória em produção daria a ilusão de login
 * persistente sem guardar nada. Falhar alto é honesto; fingir não é.
 */
export function decidirPersistencia(ambiente: {
  modo: "auto" | "postgres" | "memoria";
  url: string | undefined;
  producao: boolean;
}): DecisaoPersistencia {
  if (ambiente.modo === "memoria") {
    if (ambiente.producao) {
      return {
        tipo: "erro",
        mensagem:
          "FISCAL_PERSISTENCIA=memoria não é permitido em produção: as sessões " +
          "sumiriam ao reiniciar o processo. Configure Postgres.",
      };
    }
    return { tipo: "memoria" };
  }

  if (ambiente.modo === "postgres" && !ambiente.url) {
    return {
      tipo: "erro",
      mensagem:
        "FISCAL_PERSISTENCIA=postgres, mas nenhuma string de conexão foi encontrada " +
        "(SUPABASE_DB_URL ou DATABASE_URL). Sem banco não há sessão persistente.",
    };
  }

  return ambiente.url ? { tipo: "postgres" } : { tipo: "memoria" };
}

/** Atalho: decide com base no ambiente real do processo. */
export function decisaoAtual(): DecisaoPersistencia {
  return decidirPersistencia({
    modo: modoPersistencia(),
    url: urlDoBanco(),
    producao: emProducao(),
  });
}
