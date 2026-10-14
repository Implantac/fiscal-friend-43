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

/* ------------------------------------------------- identificadores derivados */

function fnv1a(texto: string, semente: number): number {
  let h = semente >>> 0;
  for (let i = 0; i < texto.length; i += 1) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/**
 * UUID **determinístico** a partir de um texto.
 *
 * Existe por um motivo concreto: as tabelas usam `UUID` como chave, mas o
 * identificador que o operador digita no login é um nome legível
 * ("tenant-dev"). Sem esta função, o arranque de desenvolvimento teria de
 * escolher entre (a) um UUID fixo e opaco que ninguém decora, ou (b) inventar
 * um UUID aleatório a cada inicialização — que quebraria o login na segunda
 * vez, porque o usuário ficaria com um `tenant_id` diferente do que está no
 * banco.
 *
 * Determinístico resolve os dois: o mesmo nome produz sempre o mesmo UUID, em
 * qualquer processo, sem consulta ao banco e sem estado.
 *
 * Os bits de versão (4) e variante (RFC 4122) são fixados para que o resultado
 * seja um UUID de formato válido — alguns drivers e o próprio Postgres
 * rejeitam strings que não obedecerem à máscara.
 *
 * **Não é criptografia.** Serve para derivar identificadores estáveis de
 * desenvolvimento, nunca para gerar segredos.
 */
export function uuidDeterministico(texto: string): string {
  const hex = [0x811c9dc5, 0x85ebca6b, 0xc2b2ae35, 0x27d4eb2f]
    .map((semente) => fnv1a(texto, semente).toString(16).padStart(8, "0"))
    .join("");

  const comVersao = hex.slice(0, 12) + "4" + hex.slice(13);
  const indiceVariante = Number(comVersao[16] ?? "8") % 4;
  const variante = "89ab"[indiceVariante] ?? "8";
  const comVariante = comVersao.slice(0, 16) + variante + comVersao.slice(17);

  return [
    comVariante.slice(0, 8),
    comVariante.slice(8, 12),
    comVariante.slice(12, 16),
    comVariante.slice(16, 20),
    comVariante.slice(20, 32),
  ].join("-");
}

/** UUID do tenant de desenvolvimento derivado do nome informado. */
export function tenantDevId(nome = "tenant-dev"): string {
  return uuidDeterministico(`tenant:${nome}`);
}
