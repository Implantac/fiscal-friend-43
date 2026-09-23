import { calculoById } from "./calculos";

/**
 * Casos de teste DIDÁTICOS dos cálculos. O valor esperado foi feito à mão
 * a partir da fórmula exibida — não é apuração fiscal real.
 */
export interface TesteCalculo {
  id: string;
  calculoId: string;
  descricao: string;
  entrada: Record<string, number>;
  esperado: number;
}

export const testesCalculo: TesteCalculo[] = [
  { id: "TCALC-001", calculoId: "calc.base", descricao: "Base com desconto, frete e seguro", entrada: { quantidade: 10, valorUnitario: 250, desconto: 100, frete: 80, seguro: 20, outrasDespesas: 0 }, esperado: 2500 },
  { id: "TCALC-002", calculoId: "calc.base", descricao: "Base sem acessórios", entrada: { quantidade: 3, valorUnitario: 33.33, desconto: 0, frete: 0, seguro: 0, outrasDespesas: 0 }, esperado: 99.99 },
  { id: "TCALC-003", calculoId: "calc.icms", descricao: "ICMS sem redução", entrada: { base: 2400, reducao: 0, aliquota: 12 }, esperado: 288 },
  { id: "TCALC-004", calculoId: "calc.icms", descricao: "ICMS com redução de 50% da base", entrada: { base: 1000, reducao: 50, aliquota: 18 }, esperado: 90 },
  { id: "TCALC-005", calculoId: "calc.ipi", descricao: "IPI simples", entrada: { base: 2400, aliquota: 5 }, esperado: 120 },
  { id: "TCALC-006", calculoId: "calc.fcp", descricao: "FCP de 2%", entrada: { base: 2400, pFCP: 2 }, esperado: 48 },
  { id: "TCALC-007", calculoId: "calc.iss", descricao: "ISS sem dedução", entrada: { valorServico: 5000, deducoes: 0, aliquota: 3 }, esperado: 150 },
  { id: "TCALC-008", calculoId: "calc.iss", descricao: "Dedução maior que o serviço não gera ISS negativo", entrada: { valorServico: 100, deducoes: 200, aliquota: 5 }, esperado: 0 },
];

export interface ExecucaoTesteCalculo {
  teste: TesteCalculo;
  obtido: number | null;
  aprovado: boolean;
}

export function executarTestesCalculo(): ExecucaoTesteCalculo[] {
  return testesCalculo.map((teste) => {
    const calc = calculoById.get(teste.calculoId);
    if (!calc) return { teste, obtido: null, aprovado: false };
    const obtido = calc.calcular(teste.entrada);
    return { teste, obtido, aprovado: Math.abs(obtido - teste.esperado) < 0.005 };
  });
}
