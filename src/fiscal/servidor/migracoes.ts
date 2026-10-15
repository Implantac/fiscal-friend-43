/**
 * Planejamento de aplicação de migrações — lógica pura, sem I/O e sem banco.
 *
 * ============================================================================
 * POR QUE ISTO EXISTE SEPARADO DO BANCO
 * ============================================================================
 * A validação real contra Postgres (`validacao-postgres.test.ts`) não pode
 * rodar neste ambiente: não há instância. O que *pode* ser provado aqui é a
 * parte que costuma quebrar em silêncio — a **ordem** e a **identidade** das
 * migrações. Um planejador errado aplica a migração velha por cima da nova, ou
 * pula uma, e o sintoma só aparece meses depois em produção.
 *
 * Regra de ordenação: lexicográfica pelo nome do arquivo. É a mesma regra que
 * `src/fiscal/schema.test.ts` usa para carregar o DDL, e é deliberadamente
 * frágil: `002_x.sql` vem antes de `010_y.sql`, mas `2_x.sql` viria *depois* de
 * `10_y.sql`. Por isso os nomes são validados, não apenas ordenados.
 */

import { createHash } from "node:crypto";

/** Um arquivo de migração com identidade própria. */
export interface Migracao {
  arquivo: string;
  checksum: string;
}

/** Estado de uma migração já registrada no banco. */
export interface MigracaoAplicada {
  arquivo: string;
  checksum: string;
}

export interface Plano {
  /** Migrações a aplicar agora, na ordem. */
  aplicar: Migracao[];
  /** Migrações já aplicadas e com checksum idêntico — nada a fazer. */
  emDia: Migracao[];
  /**
   * Migrações cujo nome já existe no banco mas cujo conteúdo mudou.
   * Aplicar por cima seria mentir sobre o histórico: o banco diria que a
   * migração `001` foi aplicada quando o que rodou foi outra coisa.
   */
  divergentes: Array<{ arquivo: string; noBanco: string; noDisco: string }>;
}

/** Padrão exigido: `001_nome.sql`, `002_outro_nome.sql`. */
const PADRAO_NOME = /^\d{3,}_[a-z0-9_]+\.sql$/;

export function nomeValido(arquivo: string): boolean {
  return PADRAO_NOME.test(arquivo);
}

/**
 * Ordena pelo nome. A ordenação é estável e lexicográfica — a mesma que o
 * `schema.test.ts` usa, para que teste e aplicação nunca discordem.
 */
export function ordenar(arquivos: string[]): string[] {
  return [...arquivos].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

export function checksum(conteudo: string): string {
  return createHash("sha256").update(conteudo, "utf8").digest("hex");
}

/**
 * Descobre as migrações em um diretório. `listar` injeta a listagem para que
 * esta função fique testável sem sistema de arquivos.
 */
export function descobrir(listar: () => Array<{ nome: string; conteudo: string }>): Migracao[] {
  const lidos = new Map(listar().map((f) => [f.nome, f.conteudo]));
  return ordenar([...lidos.keys()].filter((n) => n.endsWith(".sql"))).map((nome) => ({
    arquivo: nome,
    checksum: checksum(lidos.get(nome)!),
  }));
}

/**
 * Decide o que aplicar.
 *
 * `aplicadas` é o que o banco diz que já rodou. A decisão é:
 *   - nome ausente no banco            → aplicar;
 *   - nome presente, checksum igual    → em dia, pular;
 *   - nome presente, checksum diferente → divergente, **nunca** aplicar.
 *
 * A lista do disco é **reordenada aqui dentro**, não confiando que quem chama
 * já a ordenou. Aplicar `002` antes de `001` é silencioso e só aparece em
 * produção; um teste que passasse a lista fora de ordem pegou justamente isso.
 */
export function planejar(noDisco: Migracao[], aplicadas: MigracaoAplicada[]): Plano {
  const indice = new Map(aplicadas.map((m) => [m.arquivo, m.checksum]));
  const plano: Plano = { aplicar: [], emDia: [], divergentes: [] };

  for (const migracao of ordenar(noDisco.map((m) => m.arquivo)).map((arquivo) =>
    noDisco.find((m) => m.arquivo === arquivo)!,
  )) {
    const noBanco = indice.get(migracao.arquivo);
    if (noBanco === undefined) {
      plano.aplicar.push(migracao);
    } else if (noBanco === migracao.checksum) {
      plano.emDia.push(migracao);
    } else {
      plano.divergentes.push({
        arquivo: migracao.arquivo,
        noBanco,
        noDisco: migracao.checksum,
      });
    }
  }

  return plano;
}

/**
 * Migrações que o banco tem e o disco não. São um problema real: significam
 * que alguém apagou um arquivo de migração já aplicado. Aplicar o resto criaria
 * um banco cujo histórico não corresponde a nenhum estado conhecido.
 */
export function orfas(aplicadas: MigracaoAplicada[], noDisco: Migracao[]): string[] {
  const presentes = new Set(noDisco.map((m) => m.arquivo));
  return aplicadas
    .map((m) => m.arquivo)
    .filter((a) => !presentes.has(a))
    .sort();
}

/**
 * Nome da tabela de controle. Fica em constante exportada porque o DDL de
 * criação e a consulta de estado precisam concordar — se um dos dois mudar de
 * nome sem o outro, o planejador passa a achar que nada foi aplicado.
 */
export const TABELA_CONTROLE = "schema_migracoes";

/** DDL da tabela de controle. Idempotente por construção. */
export const DDL_CONTROLE = `
CREATE TABLE IF NOT EXISTS ${TABELA_CONTROLE} (
  arquivo    TEXT PRIMARY KEY,
  checksum   TEXT NOT NULL,
  aplicada_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
`.trim();
