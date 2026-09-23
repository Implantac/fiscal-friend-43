import type { CalculoFiscal, Procedencia } from "./types";

/**
 * FISCAL MATH LAB — cálculos determinísticos, todos EXEMPLO DIDÁTICO.
 * As alíquotas usadas como valor inicial são parâmetros de cenário deste
 * ambiente, não legislação. Nenhum resultado aqui vale como apuração.
 */
const didatico: Procedencia = {
  status: "ilustrativo",
  fonteId: "sem-fonte",
  vigencia: { observacao: "Exemplo didático — sem vigência legal." },
};

const r2 = (n: number) => Math.round((Number.isFinite(n) ? n : 0) * 100) / 100;

export const calculos: CalculoFiscal[] = [
  {
    id: "calc.base",
    nome: "Composição da base de cálculo",
    grupo: "Base",
    formula: "base = (quantidade × valorUnitario) − desconto + frete + seguro + outrasDespesas",
    variaveis: [
      { simbolo: "quantidade", nome: "Quantidade", descricao: "Quantidade comercial do item." },
      { simbolo: "valorUnitario", nome: "Valor unitário", descricao: "Preço unitário do item." },
      { simbolo: "desconto", nome: "Desconto", descricao: "Desconto incondicional do item." },
      { simbolo: "frete", nome: "Frete", descricao: "Parcela de frete rateada no item." },
      { simbolo: "seguro", nome: "Seguro", descricao: "Parcela de seguro rateada no item." },
      { simbolo: "outrasDespesas", nome: "Outras despesas", descricao: "Acessórias rateadas." },
    ],
    arredondamento: "Duas casas decimais no valor final do item.",
    xml: "<prod><vProd>…</vProd><vDesc>…</vDesc><vFrete>…</vFrete><vSeg>…</vSeg><vOutro>…</vOutro></prod>",
    calcular: (v) =>
      r2(
        (v.quantidade ?? 0) * (v.valorUnitario ?? 0) -
          (v.desconto ?? 0) +
          (v.frete ?? 0) +
          (v.seguro ?? 0) +
          (v.outrasDespesas ?? 0),
      ),
    padrao: { quantidade: 10, valorUnitario: 250, desconto: 100, frete: 80, seguro: 20, outrasDespesas: 0 },
    procedencia: didatico,
  },
  {
    id: "calc.icms",
    nome: "ICMS próprio com redução de base",
    grupo: "ICMS",
    formula: "vICMS = base × (1 − reducao/100) × aliquota/100",
    variaveis: [
      { simbolo: "base", nome: "Base", descricao: "Base de cálculo do ICMS antes da redução." },
      { simbolo: "reducao", nome: "Redução (%)", descricao: "Percentual de redução da base." },
      { simbolo: "aliquota", nome: "Alíquota (%)", descricao: "Alíquota aplicável à operação." },
    ],
    arredondamento: "Duas casas decimais.",
    xml: "<ICMS00><vBC>…</vBC><pICMS>…</pICMS><vICMS>…</vICMS></ICMS00>",
    calcular: (v) => r2(((v.base ?? 0) * (1 - (v.reducao ?? 0) / 100) * (v.aliquota ?? 0)) / 100),
    padrao: { base: 2400, reducao: 0, aliquota: 12 },
    procedencia: didatico,
  },
  {
    id: "calc.ipi",
    nome: "IPI",
    grupo: "IPI",
    formula: "vIPI = base × aliquota/100",
    variaveis: [
      { simbolo: "base", nome: "Base", descricao: "Valor tributável do item." },
      { simbolo: "aliquota", nome: "Alíquota (%)", descricao: "Alíquota da TIPI para o NCM." },
    ],
    arredondamento: "Duas casas decimais.",
    xml: "<IPITrib><vBC>…</vBC><pIPI>…</pIPI><vIPI>…</vIPI></IPITrib>",
    calcular: (v) => r2(((v.base ?? 0) * (v.aliquota ?? 0)) / 100),
    padrao: { base: 2400, aliquota: 5 },
    procedencia: didatico,
  },
  {
    id: "calc.piscofins",
    nome: "PIS e COFINS",
    grupo: "PIS/COFINS",
    formula: "vPIS = base × pPIS/100  ·  vCOFINS = base × pCOFINS/100",
    variaveis: [
      { simbolo: "base", nome: "Base", descricao: "Base das contribuições." },
      { simbolo: "pPIS", nome: "PIS (%)", descricao: "Alíquota de PIS do regime aplicável." },
      { simbolo: "pCOFINS", nome: "COFINS (%)", descricao: "Alíquota de COFINS do regime aplicável." },
    ],
    arredondamento: "Duas casas decimais em cada contribuição.",
    xml: "<PISAliq><vBC>…</vBC><pPIS>…</pPIS><vPIS>…</vPIS></PISAliq>",
    calcular: (v) =>
      r2(((v.base ?? 0) * (v.pPIS ?? 0)) / 100) + r2(((v.base ?? 0) * (v.pCOFINS ?? 0)) / 100),
    padrao: { base: 2400, pPIS: 1.65, pCOFINS: 7.6 },
    procedencia: didatico,
  },
  {
    id: "calc.st",
    nome: "ICMS-ST com MVA",
    grupo: "ST e FCP",
    formula:
      "baseST = base × (1 + mva/100) · vST = baseST × aliqInterna/100 − vICMSProprio",
    variaveis: [
      { simbolo: "base", nome: "Base", descricao: "Base da operação própria." },
      { simbolo: "mva", nome: "MVA (%)", descricao: "Margem de valor agregado aplicável." },
      { simbolo: "aliqInterna", nome: "Alíquota interna (%)", descricao: "Alíquota do destino." },
      { simbolo: "vICMSProprio", nome: "ICMS próprio", descricao: "ICMS da operação própria." },
    ],
    arredondamento: "Duas casas decimais; não permitir resultado negativo.",
    xml: "<ICMS10><vBCST>…</vBCST><pICMSST>…</pICMSST><vICMSST>…</vICMSST></ICMS10>",
    calcular: (v) => {
      const baseST = (v.base ?? 0) * (1 + (v.mva ?? 0) / 100);
      return r2(Math.max(0, (baseST * (v.aliqInterna ?? 0)) / 100 - (v.vICMSProprio ?? 0)));
    },
    padrao: { base: 2400, mva: 40, aliqInterna: 18, vICMSProprio: 288 },
    procedencia: didatico,
  },
  {
    id: "calc.fcp",
    nome: "FCP",
    grupo: "ST e FCP",
    formula: "vFCP = base × pFCP/100",
    variaveis: [
      { simbolo: "base", nome: "Base", descricao: "Base do FCP conforme a UF de destino." },
      { simbolo: "pFCP", nome: "FCP (%)", descricao: "Percentual definido pela UF de destino." },
    ],
    arredondamento: "Duas casas decimais.",
    xml: "<ICMS><vBCFCP>…</vBCFCP><pFCP>…</pFCP><vFCP>…</vFCP></ICMS>",
    calcular: (v) => r2(((v.base ?? 0) * (v.pFCP ?? 0)) / 100),
    padrao: { base: 2400, pFCP: 2 },
    procedencia: didatico,
  },
  {
    id: "calc.difal",
    nome: "DIFAL — venda interestadual a consumidor final",
    grupo: "DIFAL",
    formula: "vDifal = base × (aliqInterna − aliqInter)/100",
    variaveis: [
      { simbolo: "base", nome: "Base", descricao: "Base de cálculo no destino." },
      { simbolo: "aliqInterna", nome: "Alíquota interna destino (%)", descricao: "Alíquota da UF de destino." },
      { simbolo: "aliqInter", nome: "Alíquota interestadual (%)", descricao: "Alíquota da operação interestadual." },
    ],
    arredondamento: "Duas casas decimais; resultado negativo indica parametrização incorreta.",
    xml: "<ICMSUFDest><vBCUFDest>…</vBCUFDest><pICMSUFDest>…</pICMSUFDest><vICMSUFDest>…</vICMSUFDest></ICMSUFDest>",
    calcular: (v) => r2(((v.base ?? 0) * ((v.aliqInterna ?? 0) - (v.aliqInter ?? 0))) / 100),
    padrao: { base: 2400, aliqInterna: 18, aliqInter: 12 },
    procedencia: didatico,
  },
  {
    id: "calc.iss",
    nome: "ISS com dedução e retenção",
    grupo: "Base",
    formula: "baseISS = valorServico − deducoes · vISS = baseISS × aliquota/100",
    variaveis: [
      { simbolo: "valorServico", nome: "Valor do serviço", descricao: "Valor bruto da prestação." },
      { simbolo: "deducoes", nome: "Deduções", descricao: "Deduções admitidas pelo município." },
      { simbolo: "aliquota", nome: "Alíquota ISS (%)", descricao: "Alíquota municipal do item da lista." },
    ],
    arredondamento: "Duas casas decimais.",
    xml: "<servico><valores><vServicos>…</vServicos><vDeducoes>…</vDeducoes><vIss>…</vIss></valores></servico>",
    calcular: (v) =>
      r2((Math.max(0, (v.valorServico ?? 0) - (v.deducoes ?? 0)) * (v.aliquota ?? 0)) / 100),
    padrao: { valorServico: 5000, deducoes: 0, aliquota: 3 },
    procedencia: didatico,
  },
  {
    id: "calc.ibscbs",
    nome: "IBS e CBS — modelo da Reforma",
    grupo: "Reforma",
    formula: "vIBS = base × pIBS/100 · vCBS = base × pCBS/100",
    variaveis: [
      { simbolo: "base", nome: "Base", descricao: "Base da operação no novo modelo." },
      { simbolo: "pIBS", nome: "IBS (%)", descricao: "Percentual de teste — não é alíquota oficial." },
      { simbolo: "pCBS", nome: "CBS (%)", descricao: "Percentual de teste — não é alíquota oficial." },
    ],
    arredondamento: "Duas casas decimais.",
    xml: "<IBSCBS><gIBSCBS><vBC>…</vBC><gIBS>…</gIBS><gCBS>…</gCBS></gIBSCBS></IBSCBS>",
    calcular: (v) =>
      r2(((v.base ?? 0) * (v.pIBS ?? 0)) / 100) + r2(((v.base ?? 0) * (v.pCBS ?? 0)) / 100),
    padrao: { base: 2400, pIBS: 0, pCBS: 0 },
    procedencia: {
      status: "pendente",
      fonteId: "reforma",
      vigencia: { observacao: "Alíquotas, grupos XML e cronograma pendentes de validação oficial." },
    },
  },
];

export const calculoById = new Map(calculos.map((c) => [c.id, c]));
