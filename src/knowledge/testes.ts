import type { DocumentoId, StatusValidacao } from "./types";
import { documentoSimuladoPadrao, regraById, type DocumentoSimulado } from "./regras";

/**
 * Casos de teste DIDÁTICOS. Cada caso aplica uma variação ao documento simulado
 * e confere se a regra se comporta como esperado. Serve de regressão: se alguém
 * alterar uma regra, os casos anteriores mostram o que quebrou.
 */
export interface TesteFiscal {
  id: string;
  documento: DocumentoId;
  cenario: string;
  uf: string;
  operacao: string;
  entrada: Partial<DocumentoSimulado>;
  regraId: string;
  /** true = a regra deve ser atendida; false = a regra deve apontar falha. */
  esperaAtender: boolean;
  cstatEsperado?: string;
  status: StatusValidacao;
  versao: string;
}

const v = "didático-1";
const t = (x: Omit<TesteFiscal, "status" | "versao">): TesteFiscal => ({ ...x, status: "ilustrativo", versao: v });

export const testes: TesteFiscal[] = [
  t({ id: "TC-001", documento: "nfe55", cenario: "Venda interna", uf: "SP→SP", operacao: "venda", entrada: { ufDestino: "SP", cfop: "5102" }, regraId: "REGRA-CFOP-DESTINO", esperaAtender: true }),
  t({ id: "TC-002", documento: "nfe55", cenario: "Venda interestadual com CFOP interno", uf: "SP→MG", operacao: "venda", entrada: { cfop: "5102" }, regraId: "REGRA-CFOP-DESTINO", esperaAtender: false, cstatEsperado: "cstat.pendente.cfop" }),
  t({ id: "TC-003", documento: "nfe55", cenario: "Venda interestadual correta", uf: "SP→MG", operacao: "venda", entrada: { cfop: "6102" }, regraId: "REGRA-CFOP-DESTINO", esperaAtender: true }),
  t({ id: "TC-004", documento: "nfe55", cenario: "Devolução sem nota de origem", uf: "SP→SP", operacao: "devolução", entrada: { ufDestino: "SP", cfop: "5202", chaveReferenciada: "" }, regraId: "REGRA-CFOP-DEVOLUCAO", esperaAtender: false, cstatEsperado: "cstat.pendente.referencia" }),
  t({ id: "TC-005", documento: "nfe55", cenario: "Devolução com nota de origem", uf: "SP→SP", operacao: "devolução", entrada: { ufDestino: "SP", cfop: "5202" }, regraId: "REGRA-CFOP-DEVOLUCAO", esperaAtender: true }),
  t({ id: "TC-006", documento: "nfe55", cenario: "NCM com 7 dígitos", uf: "SP→MG", operacao: "venda", entrada: { ncm: "7326909" }, regraId: "REGRA-NCM-FORMATO", esperaAtender: false, cstatEsperado: "cstat.pendente.ncm" }),
  t({ id: "TC-007", documento: "nfe55", cenario: "CSOSN em empresa do Regime Normal", uf: "SP→MG", operacao: "venda", entrada: { cst: "102" }, regraId: "REGRA-CST-GRUPO", esperaAtender: false, cstatEsperado: "cstat.pendente.cst" }),
  t({ id: "TC-008", documento: "nfe55", cenario: "Simples Nacional com CSOSN", uf: "SP→MG", operacao: "venda", entrada: { regime: "simples", cst: "102" }, regraId: "REGRA-CSOSN-REGIME", esperaAtender: true }),
  t({ id: "TC-009", documento: "nfe55", cenario: "ICMS divergente do cálculo", uf: "SP→MG", operacao: "venda", entrada: { valorIcmsInformado: 290 }, regraId: "REGRA-ICMS-VALOR", esperaAtender: false, cstatEsperado: "cstat.pendente.calculo" }),
  t({ id: "TC-010", documento: "nfe55", cenario: "ICMS igual ao cálculo", uf: "SP→MG", operacao: "venda", entrada: { valorIcmsInformado: 297.6 }, regraId: "REGRA-ICMS-VALOR", esperaAtender: true }),
  t({ id: "TC-011", documento: "nfe55", cenario: "Total diferente dos itens", uf: "SP→MG", operacao: "venda", entrada: { totalInformado: 2500 }, regraId: "REGRA-TOTAL-ITENS", esperaAtender: false, cstatEsperado: "cstat.pendente.calculo" }),
  t({ id: "TC-012", documento: "nfe55", cenario: "Consumidor final de outra UF sem partilha", uf: "SP→MG", operacao: "venda", entrada: { difalInformado: 0 }, regraId: "REGRA-DIFAL-OBRIGATORIO", esperaAtender: false, cstatEsperado: "cstat.pendente.difal" }),
  t({ id: "TC-013", documento: "nfe55", cenario: "Destinatário contribuinte dispensa partilha", uf: "SP→MG", operacao: "venda", entrada: { contribuinte: true, difalInformado: 0 }, regraId: "REGRA-DIFAL-OBRIGATORIO", esperaAtender: true }),
  t({ id: "TC-014", documento: "nfce65", cenario: "Pagamento menor que o total", uf: "SP→SP", operacao: "venda no caixa", entrada: { pagamentoInformado: 2000 }, regraId: "REGRA-PAG-SOMA", esperaAtender: false, cstatEsperado: "cstat.pendente.pagamento" }),
  t({ id: "TC-015", documento: "nfce65", cenario: "Pagamento com troco", uf: "SP→SP", operacao: "venda no caixa", entrada: { pagamentoInformado: 2500 }, regraId: "REGRA-PAG-SOMA", esperaAtender: true }),
  t({ id: "TC-016", documento: "cte57", cenario: "CT-e sem tomador", uf: "SP→MG", operacao: "frete", entrada: { tomador: "" }, regraId: "REGRA-CTE-TOMADOR", esperaAtender: false, cstatEsperado: "cstat.pendente.cte" }),
  t({ id: "TC-017", documento: "mdfe58", cenario: "Condutor com CPF inválido", uf: "SP→MG", operacao: "manifesto", entrada: { condutorCpf: "11111111111" }, regraId: "REGRA-MDFE-CONDUTOR", esperaAtender: false, cstatEsperado: "cstat.pendente.mdfe" }),
  t({ id: "TC-018", documento: "mdfe58", cenario: "Condutor com CPF válido", uf: "SP→MG", operacao: "manifesto", entrada: {}, regraId: "REGRA-MDFE-CONDUTOR", esperaAtender: true }),
  t({ id: "TC-019", documento: "nfse", cenario: "Descrição de serviço curta", uf: "Município", operacao: "serviço", entrada: { descricaoServico: "Serv." }, regraId: "REGRA-NFSE-DESCRICAO", esperaAtender: false, cstatEsperado: "cstat.pendente.nfse" }),
  t({ id: "TC-020", documento: "eventos", cenario: "Desconhecimento sem justificativa", uf: "—", operacao: "manifestação", entrada: { justificativa: "não sei" }, regraId: "REGRA-MANIF-JUSTIFICATIVA", esperaAtender: false, cstatEsperado: "cstat.pendente.evento" }),
];

export type ResultadoTeste = "aprovado" | "falha" | "sem_regra";

export interface ExecucaoTeste {
  teste: TesteFiscal;
  resultado: ResultadoTeste;
  regraAtendida?: boolean;
}

export function executarTestes(): ExecucaoTeste[] {
  return testes.map((teste) => {
    const regra = regraById.get(teste.regraId);
    if (!regra) return { teste, resultado: "sem_regra" };
    const atendida = regra.avaliar({ ...documentoSimuladoPadrao, ...teste.entrada });
    return { teste, regraAtendida: atendida, resultado: atendida === teste.esperaAtender ? "aprovado" : "falha" };
  });
}
