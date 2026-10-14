/**
 * Parâmetros de CENÁRIO DEMONSTRATIVO.
 *
 * ============================================================================
 * LEIA ANTES DE USAR
 * ============================================================================
 * NÃO são alíquotas oficiais e NÃO são regra fiscal. Existem apenas para que
 * a prévia do protótipo produza números. No sistema real, estes valores vêm de
 * regras versionadas no back-end (`src/fiscal/regras.ts`), dependentes de
 * operação, finalidade, origem, destino, cadastro fiscal, benefícios,
 * vigência e demais parâmetros aplicáveis.
 *
 * Regra de ouro deste módulo: todo valor derivado daqui carrega, junto,
 * uma `Pendencia` bloqueante informando que não há apuração real. Nada é
 * exibido como número "neutro": a interface mostra o número **e** o bloqueio.
 *
 * Migração prevista: quando as regras oficiais entrarem no registro, estas
 * funções passam a devolver `ResultadoCalculo` com `regraId` e `fonte`
 * preenchidos, e as pendências desaparecem naturalmente.
 */

import { aplicarPercentual, deNumero, paraNumero, type Money } from "@/lib/money";
import {
  pendenciaAliquotaNaoValidada,
  pendenciaCfopHeuristico,
  type Pendencia,
} from "@/domain/pendencia";

export const parametrosCenario = {
  descricao:
    "Percentuais arbitrários definidos apenas para demonstrar o comportamento da tela. Não são alíquotas oficiais.",
  /** Marca de origem: qualquer consumidor pode filtrar o que não é oficial. */
  naoOficial: true as const,
  icmsPercentual: 12,
  ipiPercentual: 5,
  pisPercentual: 1.65,
  cofinsPercentual: 7.6,
  issPercentual: 3,
  /** Taxa usada apenas para ilustrar o campo de seguro no CT-e. */
  seguroPercentual: 0.15,
};

export type ParametroCenario = keyof typeof parametrosCenario;

/**
 * Sugestão de CFOP puramente heurística do protótipo.
 * Serve para demonstrar o comportamento da tela, não para decidir a operação real.
 * A heurística tem três linhas e **não cobre** devolução, remessa,
 * industrialização, exportação, substituição tributária, transferência entre
 * estabelecimentos nem benefícios fiscais.
 */
export function sugerirCfop(ufDestino: string, ufOrigem: string, contribuinte: boolean) {
  const mesmaUf = ufDestino === ufOrigem;
  const codigo = mesmaUf ? (contribuinte ? "5102" : "5101") : contribuinte ? "6102" : "6101";
  return {
    codigo,
    justificativa: mesmaUf
      ? "Cenário demonstrativo: operação dentro da mesma UF."
      : "Cenário demonstrativo: operação interestadual.",
    aviso:
      "Heurística do protótipo. A definição real do CFOP depende de natureza da operação, finalidade, origem da mercadoria, destinatário e regras versionadas no back-end.",
    /** Pendência sempre presente: a sugestão nunca é decisão. */
    pendencias: [pendenciaCfopHeuristico()],
  };
}

export interface LinhaPrevia {
  grupo: string;
  percentual: number;
  /** Valor em Reais (número) — apenas para exibição na tela. */
  valor: number;
  /** Valor exato em centavos, para quem precisar calcular de verdade. */
  valorExato: Money;
}

export interface PreviaTributaria {
  aviso: string;
  /** Pendência bloqueante: nenhum destes números é apuração fiscal. */
  pendencias: Pendencia[];
  linhas: LinhaPrevia[];
  /** Soma das linhas, calculada em decimal exato. */
  total: number;
  totalExato: Money;
}

const AVISO_PREVIA =
  "Prévia simulada com parâmetros de cenário. Não é apuração fiscal e não pode ser transmitida.";

/**
 * Prévia tributária didática.
 *
 * Mantida por compatibilidade com as telas existentes, mas agora:
 *  - calcula em decimal exato (`src/lib/money`), sem `number`/`toFixed`;
 *  - devolve `pendencias` bloqueantes junto dos números;
 *  - expõe o valor exato em centavos para futuros testes de regressão.
 */
export function previaTributaria(baseCalculo: number): PreviaTributaria {
  const base = deNumero(Number.isFinite(baseCalculo) ? baseCalculo : 0);

  const linhas: LinhaPrevia[] = [
    { grupo: "ICMS", percentual: parametrosCenario.icmsPercentual },
    { grupo: "IPI", percentual: parametrosCenario.ipiPercentual },
    { grupo: "PIS", percentual: parametrosCenario.pisPercentual },
    { grupo: "COFINS", percentual: parametrosCenario.cofinsPercentual },
  ].map((l) => {
    const valorExato = aplicarPercentual(base, l.percentual.toString(), {
      casas: 2,
      modo: "half_up",
    });
    return { ...l, valorExato, valor: paraNumero(valorExato) };
  });

  const totalExato = linhas.reduce((a, l) => a + l.valorExato, 0n);

  return {
    aviso: AVISO_PREVIA,
    pendencias: [pendenciaAliquotaNaoValidada("Prévia tributária")],
    linhas,
    total: paraNumero(totalExato),
    totalExato,
  };
}

/**
 * Aplica um percentual de cenário com precisão decimal.
 * Substitui os cálculos `(base * percentual) / 100` espalhados pelas telas.
 */
export function aplicarPercentualCenario(base: number, percentual: number): number {
  return paraNumero(
    aplicarPercentual(deNumero(base), percentual.toString(), { casas: 2, modo: "half_up" }),
  );
}
