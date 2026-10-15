/**
 * Geração SIMULADA de XML e da representação impressa (DANFE, DANFE NFC-e,
 * DACTE, DACTE OS, DAMDFE e DANFSe) no leiaute oficial vigente:
 * NF-e/NFC-e 4.00, CT-e/CT-e OS 4.00, MDF-e 3.00 e DPS da NFS-e Padrão Nacional 1.00.
 *
 * - Sempre tpAmb=2 (homologação) e "SEM VALOR FISCAL".
 * - Sem assinatura digital (não há certificado) e sem protocolo de autorização.
 * - Grupos de tributos não são calculados: ficam como comentário "Pendente de validação",
 *   porque as regras de tributação não foram validadas por fonte oficial neste ambiente.
 * - A ordem e os nomes de tags seguem os leiautes dos manuais, mas a validação contra
 *   os schemas XSD oficiais ainda está Pendente de validação.
 */
import { empresaSimulada } from "@/simulation/mock-data";
import { dvChave, montarChaveAcesso } from "@/fiscal/chave-acesso";
import type { Cliente, Motorista, Produto, Veiculo } from "@/simulation/cadastros";

export type TipoSaida = "nfe55" | "nfce65" | "nfse" | "cte57" | "cteos67" | "mdfe58";

export interface LayoutPdf {
  titulo: string;
  subtitulo: string;
  modelo: string;
  numero: string;
  serie: string;
  emissao: string;
  chave: string | null;
  blocos: { titulo: string; campos: [string, string][] }[];
  tabela?: { titulo: string; colunas: string[]; linhas: string[][] };
  totais: [string, string][];
  observacao: string;
}

export interface DocumentoGerado {
  xml: string;
  pdf: LayoutPdf;
  nomeBase: string;
}

/* ------------------------------------------------------------------ utilitários */

const cUF: Record<string, string> = {
  RO: "11",
  AC: "12",
  AM: "13",
  RR: "14",
  PA: "15",
  AP: "16",
  TO: "17",
  MA: "21",
  PI: "22",
  CE: "23",
  RN: "24",
  PB: "25",
  PE: "26",
  AL: "27",
  SE: "28",
  BA: "29",
  MG: "31",
  ES: "32",
  RJ: "33",
  SP: "35",
  PR: "41",
  SC: "42",
  RS: "43",
  MS: "50",
  MT: "51",
  GO: "52",
  DF: "53",
};

/** Códigos IBGE dos municípios usados nos cadastros fictícios. */
const ibge: Record<string, string> = {
  Campinas: "3509502",
  Sorocaba: "3552205",
  Uberlândia: "3170206",
  Londrina: "4113700",
};
const codMun = (m: string) => ibge[m] ?? "9999999";

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
/** Formata um valor já exato (`Money`) em Real, sem passar por float. */
const brlM = (m: Money) => brl(paraNumero(m));

function agora() {
  const d = new Date(Date.now() - 3 * 3600_000);
  const iso = d.toISOString().slice(0, 19) + "-03:00";
  const br = `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)} ${iso.slice(11, 19)}`;
  return { iso, br, aamm: iso.slice(2, 4) + iso.slice(5, 7), data: iso.slice(0, 10) };
}

function numeroSeq() {
  return String(Math.floor(Date.now() / 1000) % 999_999_999 || 1);
}

/**
 * DV da chave de acesso — delegado ao domínio.
 *
 * Havia aqui uma cópia local que usava `Number(base[i])`. Com o CNPJ
 * alfanumérico (IN RFB 2.229/2024, vigente desde 2026) `Number("A")` é `NaN`,
 * e a chave inteira ficava com DV `NaN` — inválida, sem erro visível. A
 * implementação correta, com a regra ASCII − 48 e recusa explícita de
 * caractere inválido, está em `src/fiscal/chave-acesso.ts`, testada contra
 * exemplo publicado na documentação oficial.
 *
 * A delegação é segura: `chave-acesso.ts` é algoritmo puro, sem driver de
 * banco, sem credencial e sem API de Node — não é módulo exclusivo de
 * servidor. O que o simulador continua sem fazer é importar repositório,
 * sessão ou conexão: aí o isolamento segue valendo.
 */
export function dvModulo11(base: string) {
  return dvChave(base);
}

/** Chave de acesso de 44 dígitos: cUF AAMM CNPJ mod serie nNF tpEmis cNF DV. */
function montarChave(
  uf: string,
  aamm: string,
  mod: string,
  serie: string,
  n: string,
  tpEmis = "1",
) {
  const cNF = String(Math.floor(Math.random() * 1e8)).padStart(8, "0");
  const chave = montarChaveAcesso({
    cUF: cUF[uf] ?? "35",
    aamm,
    cnpj: empresaSimulada.cnpj,
    modelo: mod as "55",
    serie: Number(serie),
    numero: Number(n),
    tpEmis: tpEmis as "1",
    cNF,
  });
  return { chave, cNF, dv: chave.slice(-1) };
}

const fmtChave = (c: string) => c.replace(/(\d{4})(?=\d)/g, "$1 ");
const docTag = (doc: string) => (doc.length === 11 ? `<CPF>${doc}</CPF>` : `<CNPJ>${doc}</CNPJ>`);

const cabecalho = (xml: string) =>
  `<?xml version="1.0" encoding="UTF-8"?>\n<!-- AMBIENTE DE SIMULAÇÃO — SEM VALOR FISCAL. Sem assinatura digital e sem protocolo. Validação contra XSD oficial: Pendente de validação. -->\n${xml}`;

import { parametrosCenario as PC } from "@/simulation/parametros-cenario";
import {
  aplicarPercentual,
  deNumero,
  formatarXml,
  multiplicarDecimalPorMoney,
  parseDecimal,
  paraNumero,
  ratear,
  somar,
  type Money,
} from "@/lib/money";

/**
 * Formatação monetária via motor decimal (`src/lib/money`): sem `toFixed`,
 * sem `Math.round`, sem ponto flutuante. `d2`/`d4` continuam recebendo
 * `number` apenas porque os formulários ainda digitam em `number`; a
 * aritmética interna já é exata em `bigint`.
 */
const d2 = (n: number) => formatarXml(deNumero(n), 2);
const d4 = (n: number) => formatarXml(deNumero(n), 4);
/** Serializa um valor já exato (`Money`) direto no XML. */
const m2 = (m: Money) => formatarXml(m, 2);
const AVISO_TRIB =
  "Tributos calculados com percentuais de CENARIO do simulador (ICMS " +
  PC.icmsPercentual +
  "%, IPI " +
  PC.ipiPercentual +
  "%, PIS " +
  PC.pisPercentual +
  "%, COFINS " +
  PC.cofinsPercentual +
  "%). Nao sao aliquotas oficiais: a apuracao real depende de regras validadas no back-end.";
const icmsCte = (ind: string, base: number) => {
  // Cálculo exato: base (centavos) x percentual (decimal) / 100, um único
  // arredondamento no fim, critério half_up explícito.
  const v = aplicarPercentual(deNumero(base), PC.icmsPercentual.toString());
  return {
    v: paraNumero(v),
    xml: `${ind}<!-- ${AVISO_TRIB} -->
${ind}<ICMS><ICMS00><CST>00</CST><vBC>${d2(base)}</vBC><pICMS>${d2(PC.icmsPercentual)}</pICMS><vICMS>${m2(v)}</vICMS></ICMS00></ICMS>
${ind}<vTotTrib>${m2(v)}</vTotTrib>`,
  };
};
const tributosPendentes = (ind: string) =>
  `${ind}<!-- Grupo de tributos (ICMS/IPI/PIS/COFINS ou IBS/CBS): Pendente de validação — não gerado sem regra oficial validada. -->`;

const emitXml = (ind: string) => `${ind}<emit>
${ind}  <CNPJ>${empresaSimulada.cnpj}</CNPJ>
${ind}  <xNome>${esc(empresaSimulada.razaoSocial)}</xNome>
${ind}  <xFant>${esc(empresaSimulada.nomeFantasia)}</xFant>
${ind}  <enderEmit>
${ind}    <xLgr>Rua Fictícia</xLgr><nro>100</nro><xBairro>Centro</xBairro>
${ind}    <cMun>${codMun(empresaSimulada.municipio)}</cMun><xMun>${empresaSimulada.municipio}</xMun><UF>${empresaSimulada.uf}</UF>
${ind}  </enderEmit>
${ind}  <IE>ISENTO</IE>
${ind}</emit>`;

const blocoEmitente = (): LayoutPdf["blocos"][number] => ({
  titulo: "Emitente",
  campos: [
    ["Razão social", empresaSimulada.razaoSocial],
    ["CNPJ", empresaSimulada.cnpj],
    ["Município/UF", `${empresaSimulada.municipio}/${empresaSimulada.uf}`],
    ["IE", empresaSimulada.ie],
  ],
});

const OBS =
  "EMITIDO EM AMBIENTE DE SIMULAÇÃO — SEM VALOR FISCAL. Documento sem assinatura digital e sem protocolo de autorização. Tributos calculados com percentuais de cenário do simulador, não com alíquotas oficiais.";

/* ------------------------------------------------------------------ NF-e e NFC-e */

export interface EntradaNfe {
  modelo: "55" | "65";
  natureza: string;
  cliente?: Cliente | undefined;
  cfop?: string | undefined;
  itens: { produto: Produto; quantidade: number; preco: number; desconto: number }[];
  frete: number;
  pagamento?: { tPag: string; descricao: string; valor: number } | undefined;
}

export function gerarNfe(e: EntradaNfe): DocumentoGerado {
  const t = agora();
  const n = numeroSeq();
  const serie = "1";
  const { chave, cNF, dv } = montarChave(empresaSimulada.uf, t.aamm, e.modelo, serie, n);
  const nfce = e.modelo === "65";
  const idDest = !e.cliente || e.cliente.uf === empresaSimulada.uf ? "1" : "2";
  const cfop = e.cfop ?? (idDest === "1" ? "5102" : "6102");
  // ------------------------------------------------------------------
  // Cálculo em decimal exato (centavos em bigint).
  //
  // Duas correções estruturais em relação ao cálculo anterior:
  //  1. rateio do frete por maior resto (`ratear`): a soma dos rateios é
  //     EXATAMENTE igual ao frete informado. Antes, cada item era arredondado
  //     isoladamente e o total podia fechar 1 centavo diferente — o tipo de
  //     divergência que os validadores oficiais comparam.
  //  2. um único arredondamento por tributo, no fim, com critério explícito.
  // ------------------------------------------------------------------
  // Quantidade é decimal de escala própria (4 casas), NÃO valor monetário:
  // multiplicar dois `Money` produziria resultado 100x maior.
  const itensM = e.itens.map((i) => ({
    quantidade: parseDecimal(i.quantidade.toString()),
    preco: deNumero(i.preco),
    desconto: deNumero(i.desconto),
  }));
  const vProd = somar(itensM.map((i) => multiplicarDecimalPorMoney(i.quantidade, i.preco)));
  const vDesc = somar(itensM.map((i) => i.desconto));
  const freteM = deNumero(e.frete);
  const rateioFrete = ratear(
    freteM,
    itensM.map((i) => paraNumero(multiplicarDecimalPorMoney(i.quantidade, i.preco))),
  );
  const calc = itensM.map((i, k) => {
    const vp = multiplicarDecimalPorMoney(i.quantidade, i.preco);
    const frete = rateioFrete[k]!;
    const bcIcms = vp - i.desconto + frete;
    const bcIpi = vp - i.desconto;
    const vIcms = aplicarPercentual(bcIcms, PC.icmsPercentual.toString());
    const vIpi = nfce ? 0n : aplicarPercentual(bcIpi, PC.ipiPercentual.toString());
    const vPis = aplicarPercentual(bcIpi, PC.pisPercentual.toString());
    const vCofins = aplicarPercentual(bcIpi, PC.cofinsPercentual.toString());
    return {
      vp,
      frete,
      bcIcms,
      bcIpi,
      vIcms,
      vIpi,
      vPis,
      vCofins,
      tot: vIcms + vIpi + vPis + vCofins,
    };
  });
  const soma = (k: keyof (typeof calc)[number]) => calc.reduce((a, c) => a + c[k], 0n);
  const vBC = soma("bcIcms"),
    vICMS = soma("vIcms"),
    vIPI = soma("vIpi"),
    vPIS = soma("vPis"),
    vCOFINS = soma("vCofins"),
    vTotTrib = soma("tot");
  const vNF = vProd - vDesc + freteM + vIPI;
  const pag = e.pagamento ?? { tPag: "90", descricao: "Sem pagamento", valor: 0 };

  const dets = e.itens
    .map(
      (i, k) => `    <det nItem="${k + 1}">
      <prod>
        <cProd>${esc(i.produto.codigo)}</cProd>
        <cEAN>${i.produto.ean}</cEAN>
        <xProd>${esc(i.produto.descricao)}</xProd>
        <NCM>${i.produto.ncm}</NCM>
        <CFOP>${cfop}</CFOP>
        <uCom>${i.produto.unidade}</uCom>
        <qCom>${d4(i.quantidade)}</qCom>
        <vUnCom>${d4(i.preco)}</vUnCom>
        <vProd>${d2(i.quantidade * i.preco)}</vProd>
        <cEANTrib>${i.produto.ean}</cEANTrib>
        <uTrib>${i.produto.unidade}</uTrib>
        <qTrib>${d4(i.quantidade)}</qTrib>
        <vUnTrib>${d4(i.preco)}</vUnTrib>${i.desconto ? `\n        <vDesc>${d2(i.desconto)}</vDesc>` : ""}
        <indTot>1</indTot>
      </prod>
      <imposto>
        <vTotTrib>${m2(calc[k]!.tot)}</vTotTrib>
        <ICMS><ICMS00><orig>0</orig><CST>00</CST><modBC>3</modBC><vBC>${m2(calc[k]!.bcIcms)}</vBC><pICMS>${d4(PC.icmsPercentual)}</pICMS><vICMS>${m2(calc[k]!.vIcms)}</vICMS></ICMS00></ICMS>${
          nfce
            ? ""
            : `
        <IPI><cEnq>999</cEnq><IPITrib><CST>50</CST><vBC>${m2(calc[k]!.bcIpi)}</vBC><pIPI>${d4(PC.ipiPercentual)}</pIPI><vIPI>${m2(calc[k]!.vIpi)}</vIPI></IPITrib></IPI>`
        }
        <PIS><PISAliq><CST>01</CST><vBC>${m2(calc[k]!.bcIpi)}</vBC><pPIS>${d4(PC.pisPercentual)}</pPIS><vPIS>${m2(calc[k]!.vPis)}</vPIS></PISAliq></PIS>
        <COFINS><COFINSAliq><CST>01</CST><vBC>${m2(calc[k]!.bcIpi)}</vBC><pCOFINS>${d4(PC.cofinsPercentual)}</pCOFINS><vCOFINS>${m2(calc[k]!.vCofins)}</vCOFINS></COFINSAliq></COFINS>
      </imposto>
    </det>`,
    )
    .join("\n");

  const dest = e.cliente
    ? `    <dest>
      ${docTag(e.cliente.documento)}
      <xNome>NF-E EMITIDA EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL</xNome>
      <enderDest>
        <xLgr>Rua Fictícia</xLgr><nro>1</nro><xBairro>Centro</xBairro>
        <cMun>${codMun(e.cliente.municipio)}</cMun><xMun>${esc(e.cliente.municipio)}</xMun><UF>${e.cliente.uf}</UF>
      </enderDest>
      <indIEDest>${e.cliente.contribuinte ? "1" : "9"}</indIEDest>
    </dest>\n`
    : "";

  const xml = cabecalho(`<NFe xmlns="http://www.portalfiscal.inf.br/nfe">
  <infNFe versao="4.00" Id="NFe${chave}">
    <ide>
      <cUF>${cUF[empresaSimulada.uf]}</cUF>
      <cNF>${cNF}</cNF>
      <natOp>${esc(e.natureza)}</natOp>
      <mod>${e.modelo}</mod>
      <serie>${serie}</serie>
      <nNF>${n}</nNF>
      <dhEmi>${t.iso}</dhEmi>
      <tpNF>1</tpNF>
      <idDest>${idDest}</idDest>
      <cMunFG>${codMun(empresaSimulada.municipio)}</cMunFG>
      <tpImp>${nfce ? "4" : "1"}</tpImp>
      <tpEmis>1</tpEmis>
      <cDV>${dv}</cDV>
      <tpAmb>2</tpAmb>
      <finNFe>1</finNFe>
      <indFinal>${nfce || (e.cliente && !e.cliente.contribuinte) ? "1" : "0"}</indFinal>
      <indPres>1</indPres>
      <procEmi>0</procEmi>
      <verProc>FiscalFriend-Simulador</verProc>
    </ide>
${emitXml("    ")}
${dest}${dets}
    <total>
      <ICMSTot>
        <vBC>${m2(vBC)}</vBC><vICMS>${m2(vICMS)}</vICMS><vICMSDeson>0.00</vICMSDeson><vFCP>0.00</vFCP>
        <vBCST>0.00</vBCST><vST>0.00</vST><vFCPST>0.00</vFCPST><vFCPSTRet>0.00</vFCPSTRet>
        <vProd>${m2(vProd)}</vProd>
        <vFrete>${d2(e.frete)}</vFrete>
        <vSeg>0.00</vSeg>
        <vDesc>${m2(vDesc)}</vDesc>
        <vII>0.00</vII><vIPI>${m2(vIPI)}</vIPI><vIPIDevol>0.00</vIPIDevol><vPIS>${m2(vPIS)}</vPIS><vCOFINS>${m2(vCOFINS)}</vCOFINS>
        <vOutro>0.00</vOutro>
        <vNF>${m2(vNF)}</vNF>
        <vTotTrib>${m2(vTotTrib)}</vTotTrib>
      </ICMSTot>
    </total>
    <transp>
      <modFrete>${nfce ? "9" : e.frete > 0 ? "0" : "9"}</modFrete>
    </transp>
    <pag>
      <detPag>
        <tPag>${pag.tPag}</tPag>
        <vPag>${m2(pag.tPag === "90" ? 0n : deNumero(pag.valor || paraNumero(vNF)))}</vPag>
      </detPag>${pag.valor > paraNumero(vNF) ? `\n      <vTroco>${d2(pag.valor - paraNumero(vNF))}</vTroco>` : ""}
    </pag>
    <infAdic>
      <infCpl>${OBS} ${AVISO_TRIB}</infCpl>
    </infAdic>
  </infNFe>${nfce ? `\n  <infNFeSupl>\n    <!-- qrCode e urlChave dependem do CSC e da URL da UF: Pendente de validação. -->\n  </infNFeSupl>` : ""}
  <!-- Signature: não gerada (sem certificado digital no ambiente de simulação). -->
</NFe>`);

  const pdf: LayoutPdf = {
    titulo: nfce ? "DANFE NFC-e" : "DANFE",
    subtitulo: nfce
      ? "Documento Auxiliar da Nota Fiscal de Consumidor Eletrônica"
      : "Documento Auxiliar da Nota Fiscal Eletrônica",
    modelo: e.modelo,
    numero: n,
    serie,
    emissao: t.br,
    chave,
    blocos: [
      blocoEmitente(),
      {
        titulo: "Destinatário",
        campos: e.cliente
          ? [
              ["Nome", e.cliente.nome],
              [e.cliente.documento.length === 11 ? "CPF" : "CNPJ", e.cliente.documento],
              ["Município/UF", `${e.cliente.municipio}/${e.cliente.uf}`],
            ]
          : [["Consumidor", "CONSUMIDOR NÃO IDENTIFICADO"]],
      },
      {
        titulo: "Operação",
        campos: [
          ["Natureza", e.natureza],
          ["CFOP", cfop],
          ["Pagamento", pag.descricao],
        ],
      },
    ],
    tabela: {
      titulo: "Dados dos produtos",
      colunas: [
        "Código",
        "Descrição",
        "NCM",
        "CFOP",
        "Qtd",
        "V. unit.",
        "V. total",
        "BC ICMS",
        "V. ICMS",
        "V. IPI",
      ],
      linhas: e.itens.map((i, k) => [
        i.produto.codigo,
        i.produto.descricao,
        i.produto.ncm,
        cfop,
        `${i.quantidade} ${i.produto.unidade}`,
        brl(i.preco),
        brl(i.quantidade * i.preco - i.desconto),
        brlM(calc[k]!.bcIcms),
        brlM(calc[k]!.vIcms),
        brlM(calc[k]!.vIpi),
      ]),
    },
    totais: [
      ["Valor dos produtos", brlM(vProd)],
      ["Desconto", brlM(vDesc)],
      ["Frete", brl(e.frete)],
      ["Base de cálculo ICMS", brlM(vBC)],
      ["Valor do ICMS", brlM(vICMS)],
      ["Valor do IPI", brlM(vIPI)],
      ["Valor do PIS", brlM(vPIS)],
      ["Valor da COFINS", brlM(vCOFINS)],
      ["Tributos aprox.", brl(paraNumero(vTotTrib))],
      ["Valor total da nota", brlM(vNF)],
    ],
    observacao: `${OBS} ${AVISO_TRIB}`,
  };
  return { xml, pdf, nomeBase: `${nfce ? "NFCe" : "NFe"}${chave}` };
}

/* ------------------------------------------------------------------ NFS-e (DPS Padrão Nacional) */

export interface EntradaNfse {
  cliente?: Cliente | undefined;
  servico?: { descricao: string; codigoInterno: string } | undefined;
  descricao: string;
  valor: number;
  deducoes: number;
  aliquotaIss: number;
  issRetido: boolean;
}

export function gerarNfse(e: EntradaNfse): DocumentoGerado {
  const t = agora();
  const n = numeroSeq();
  const serie = "1";
  const cMun = codMun(empresaSimulada.municipio);
  const id = `DPS${cMun}2${empresaSimulada.cnpj}${serie.padStart(5, "0")}${n.padStart(15, "0")}`;
  // Base e ISS em decimal exato; deduções nunca tornam a base negativa.
  const valorM = deNumero(e.valor);
  const deducoesM = deNumero(e.deducoes);
  const baseM = valorM > deducoesM ? valorM - deducoesM : 0n;
  const issM = aplicarPercentual(baseM, e.aliquotaIss.toString());
  const base = paraNumero(baseM);
  const iss = paraNumero(issM);

  const xml = cabecalho(`<DPS xmlns="http://www.sped.fazenda.gov.br/nfse" versao="1.00">
  <infDPS Id="${id}">
    <tpAmb>2</tpAmb>
    <dhEmi>${t.iso}</dhEmi>
    <verAplic>FiscalFriend-Simulador</verAplic>
    <serie>${serie}</serie>
    <nDPS>${n}</nDPS>
    <dCompet>${t.data}</dCompet>
    <tpEmit>1</tpEmit>
    <cLocEmi>${cMun}</cLocEmi>
    <prest>
      <CNPJ>${empresaSimulada.cnpj}</CNPJ>
      <regTrib>
        <!-- opSimpNac / regEspTrib dependem do regime do emitente: Pendente de validação. -->
      </regTrib>
    </prest>
${
  e.cliente
    ? `    <toma>
      ${docTag(e.cliente.documento)}
      <xNome>${esc(e.cliente.nome)}</xNome>
    </toma>\n`
    : ""
}    <serv>
      <locPrest>
        <cLocPrestacao>${cMun}</cLocPrestacao>
      </locPrest>
      <cServ>
        <!-- cTribNac: código da lista nacional ainda não mapeado (código interno ${esc(e.servico?.codigoInterno ?? "—")}): Pendente de validação. -->
        <xDescServ>${esc(e.descricao || e.servico?.descricao || "")}</xDescServ>
      </cServ>
    </serv>
    <valores>
      <vServPrest>
        <vServ>${d2(e.valor)}</vServ>
      </vServPrest>
      <trib>
        <tribMun>
          <tribISSQN>1</tribISSQN>
          <tpRetISSQN>${e.issRetido ? "2" : "1"}</tpRetISSQN>
          <!-- Alíquota ${d2(e.aliquotaIss)}% é parâmetro de cenário, não a alíquota oficial do município: Pendente de validação. -->
        </tribMun>
      </trib>
    </valores>
  </infDPS>
  <!-- Signature: não gerada (sem certificado digital no ambiente de simulação). -->
</DPS>`);

  return {
    xml,
    nomeBase: `NFSe-DPS${n}`,
    pdf: {
      titulo: "DANFSe",
      subtitulo: "Documento Auxiliar da NFS-e (Padrão Nacional)",
      modelo: "NFS-e",
      numero: n,
      serie,
      emissao: t.br,
      chave: null,
      blocos: [
        { ...blocoEmitente(), titulo: "Prestador" },
        {
          titulo: "Tomador",
          campos: e.cliente
            ? [
                ["Nome", e.cliente.nome],
                [e.cliente.documento.length === 11 ? "CPF" : "CNPJ", e.cliente.documento],
                ["Município/UF", `${e.cliente.municipio}/${e.cliente.uf}`],
              ]
            : [["Tomador", "Não informado"]],
        },
        {
          titulo: "Serviço",
          campos: [
            ["Código interno", e.servico?.codigoInterno ?? "—"],
            ["Código nacional", "Pendente de validação"],
            ["Descrição", e.descricao || e.servico?.descricao || "—"],
            ["Local da prestação", `${empresaSimulada.municipio}/${empresaSimulada.uf}`],
          ],
        },
      ],
      totais: [
        ["Valor do serviço", brl(e.valor)],
        ["Deduções", brl(e.deducoes)],
        ["Base de cálculo (cenário)", brlM(baseM)],
        [`ISS ${d2(e.aliquotaIss)}% (cenário)`, brlM(issM)],
        ["ISS retido", e.issRetido ? "Sim" : "Não"],
      ],
      observacao: OBS,
    },
  };
}

/* ------------------------------------------------------------------ CT-e 57 */

export interface EntradaCte {
  remetente?: Cliente | undefined;
  destinatario?: Cliente | undefined;
  ufInicio: string;
  ufFim: string;
  valorFrete: number;
  pedagio: number;
  notas: { chave: string; emitente: string; valor: number; peso: number }[];
  observacao: string;
}

const munDe = (c: Cliente | undefined, uf: string) =>
  c && c.uf === uf
    ? { c: codMun(c.municipio), x: c.municipio }
    : { c: "9999999", x: "Município não informado" };

export function gerarCte(e: EntradaCte): DocumentoGerado {
  const t = agora();
  const n = numeroSeq();
  const serie = "1";
  const { chave, cNF, dv } = montarChave(empresaSimulada.uf, t.aamm, "57", serie, n);
  const vPrest = e.valorFrete + e.pedagio;
  // Soma exata: `reduce` com `number` acumula erro de ponto flutuante.
  const vCargaM = somar(e.notas.map((x) => deNumero(x.valor)));
  const pesoM = somar(e.notas.map((x) => deNumero(x.peso)));
  const vCarga = paraNumero(vCargaM);
  const peso = paraNumero(pesoM);
  const ini = munDe(e.remetente, e.ufInicio);
  const fim = munDe(e.destinatario, e.ufFim);
  const cfop = e.ufInicio === e.ufFim ? "5353" : "6353";
  const imp = icmsCte("      ", vPrest);
  const part = (tag: string, c?: Cliente) =>
    c
      ? `    <${tag}>
      ${docTag(c.documento)}
      <xNome>CT-E EMITIDO EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL</xNome>
      <ender${tag === "rem" ? "Reme" : "Dest"}>
        <xLgr>Rua Fictícia</xLgr><nro>1</nro><xBairro>Centro</xBairro>
        <cMun>${codMun(c.municipio)}</cMun><xMun>${esc(c.municipio)}</xMun><UF>${c.uf}</UF>
      </ender${tag === "rem" ? "Reme" : "Dest"}>
    </${tag}>\n`
      : "";

  const xml = cabecalho(`<CTe xmlns="http://www.portalfiscal.inf.br/cte">
  <infCte versao="4.00" Id="CTe${chave}">
    <ide>
      <cUF>${cUF[empresaSimulada.uf]}</cUF>
      <cCT>${cNF}</cCT>
      <CFOP>${cfop}</CFOP>
      <natOp>Prestação de serviço de transporte (fictícia)</natOp>
      <mod>57</mod>
      <serie>${serie}</serie>
      <nCT>${n}</nCT>
      <dhEmi>${t.iso}</dhEmi>
      <tpImp>1</tpImp>
      <tpEmis>1</tpEmis>
      <cDV>${dv}</cDV>
      <tpAmb>2</tpAmb>
      <tpCTe>0</tpCTe>
      <procEmi>0</procEmi>
      <verProc>FiscalFriend-Simulador</verProc>
      <cMunEnv>${codMun(empresaSimulada.municipio)}</cMunEnv><xMunEnv>${empresaSimulada.municipio}</xMunEnv><UFEnv>${empresaSimulada.uf}</UFEnv>
      <modal>01</modal>
      <tpServ>0</tpServ>
      <cMunIni>${ini.c}</cMunIni><xMunIni>${esc(ini.x)}</xMunIni><UFIni>${e.ufInicio}</UFIni>
      <cMunFim>${fim.c}</cMunFim><xMunFim>${esc(fim.x)}</xMunFim><UFFim>${e.ufFim}</UFFim>
      <retira>1</retira>
      <indIEToma>1</indIEToma>
      <toma3><toma>0</toma></toma3>
    </ide>
${emitXml("    ")}
${part("rem", e.remetente)}${part("dest", e.destinatario)}    <vPrest>
      <vTPrest>${d2(vPrest)}</vTPrest>
      <vRec>${d2(vPrest)}</vRec>
      <Comp><xNome>FRETE VALOR</xNome><vComp>${d2(e.valorFrete)}</vComp></Comp>${e.pedagio ? `\n      <Comp><xNome>PEDAGIO</xNome><vComp>${d2(e.pedagio)}</vComp></Comp>` : ""}
    </vPrest>
    <imp>
${imp.xml}
    </imp>
    <infCTeNorm>
      <infCarga>
        <vCarga>${m2(vCargaM)}</vCarga>
        <proPred>Mercadorias diversas (fictício)</proPred>
        <infQ><cUnid>01</cUnid><tpMed>PESO BRUTO</tpMed><qCarga>${formatarXml(pesoM, 4)}</qCarga></infQ>
      </infCarga>
      <infDoc>
${e.notas.map((x) => `        <infNFe><chave>${x.chave || "".padStart(44, "0")}</chave></infNFe>`).join("\n")}
      </infDoc>
      <infModal versaoModal="4.00">
        <rodo><RNTRC>00000000</RNTRC></rodo>
      </infModal>
    </infCTeNorm>${e.observacao ? `\n    <compl><xObs>${esc(e.observacao)}</xObs></compl>` : ""}
  </infCte>
  <!-- infCTeSupl (QR Code) e Signature: não gerados no ambiente de simulação. -->
</CTe>`);

  return {
    xml,
    nomeBase: `CTe${chave}`,
    pdf: {
      titulo: "DACTE",
      subtitulo: "Documento Auxiliar do Conhecimento de Transporte Eletrônico",
      modelo: "57",
      numero: n,
      serie,
      emissao: t.br,
      chave,
      blocos: [
        blocoEmitente(),
        {
          titulo: "Remetente",
          campos: [
            ["Nome", e.remetente?.nome ?? "—"],
            ["Documento", e.remetente?.documento ?? "—"],
          ],
        },
        {
          titulo: "Destinatário",
          campos: [
            ["Nome", e.destinatario?.nome ?? "—"],
            ["Documento", e.destinatario?.documento ?? "—"],
          ],
        },
        {
          titulo: "Prestação",
          campos: [
            ["CFOP", cfop],
            ["Início", `${ini.x}/${e.ufInicio}`],
            ["Término", `${fim.x}/${e.ufFim}`],
            ["Modal", "Rodoviário"],
          ],
        },
      ],
      tabela: {
        titulo: "Documentos originários",
        colunas: ["Tipo", "Chave", "Emitente", "Valor", "Peso (kg)"],
        linhas: e.notas.map((x) => [
          "NF-e",
          x.chave || "—",
          x.emitente,
          brl(x.valor),
          String(x.peso),
        ]),
      },
      totais: [
        ["Valor da carga", brlM(vCargaM)],
        ["Frete", brl(e.valorFrete)],
        ["Pedágio", brl(e.pedagio)],
        ["Base ICMS", brl(vPrest)],
        [`ICMS ${d2(PC.icmsPercentual)}% (cenário)`, brlM(deNumero(imp.v))],
        ["Valor total da prestação", brl(vPrest)],
      ],
      observacao: OBS,
    },
  };
}

/* ------------------------------------------------------------------ CT-e OS 67 */

export interface EntradaCteOs {
  modalidade: "pessoas" | "valores";
  tomador?: Cliente | undefined;
  motorista?: Motorista | undefined;
  veiculo?: Veiculo | undefined;
  ufInicio: string;
  ufFim: string;
  passageiros: number;
  valorPrestacao: number;
  malotes: { numero: string; descricao: string; quantidade: number; valor: number }[];
}

export function gerarCteOs(e: EntradaCteOs): DocumentoGerado {
  const t = agora();
  const n = numeroSeq();
  const serie = "1";
  const { chave, cNF, dv } = montarChave(empresaSimulada.uf, t.aamm, "67", serie, n);
  const tpServ = e.modalidade === "pessoas" ? "6" : "7";
  const impOs = icmsCte("      ", e.valorPrestacao);
  const cfop = e.ufInicio === e.ufFim ? "5357" : "6357";
  const qtd =
    e.modalidade === "pessoas" ? e.passageiros : e.malotes.reduce((a, m) => a + m.quantidade, 0);

  const xml = cabecalho(`<CTeOS xmlns="http://www.portalfiscal.inf.br/cte" versao="4.00">
  <infCte versao="4.00" Id="CTe${chave}">
    <ide>
      <cUF>${cUF[empresaSimulada.uf]}</cUF>
      <cCT>${cNF}</cCT>
      <CFOP>${cfop}</CFOP>
      <natOp>Prestação de serviço de transporte (fictícia)</natOp>
      <mod>67</mod>
      <serie>${serie}</serie>
      <nCT>${n}</nCT>
      <dhEmi>${t.iso}</dhEmi>
      <tpImp>1</tpImp>
      <tpEmis>1</tpEmis>
      <cDV>${dv}</cDV>
      <tpAmb>2</tpAmb>
      <tpCTe>0</tpCTe>
      <procEmi>0</procEmi>
      <verProc>FiscalFriend-Simulador</verProc>
      <cMunEnv>${codMun(empresaSimulada.municipio)}</cMunEnv><xMunEnv>${empresaSimulada.municipio}</xMunEnv><UFEnv>${empresaSimulada.uf}</UFEnv>
      <modal>01</modal>
      <tpServ>${tpServ}</tpServ>
      <indIEToma>1</indIEToma>
      <UFIni>${e.ufInicio}</UFIni>
      <UFFim>${e.ufFim}</UFFim>
    </ide>
${emitXml("    ")}
${
  e.tomador
    ? `    <toma>
      ${docTag(e.tomador.documento)}
      <xNome>CT-E EMITIDO EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL</xNome>
      <enderToma><xLgr>Rua Fictícia</xLgr><nro>1</nro><xBairro>Centro</xBairro><cMun>${codMun(e.tomador.municipio)}</cMun><xMun>${esc(e.tomador.municipio)}</xMun><UF>${e.tomador.uf}</UF></enderToma>
    </toma>\n`
    : ""
}    <vPrest>
      <vTPrest>${d2(e.valorPrestacao)}</vTPrest>
      <vRec>${d2(e.valorPrestacao)}</vRec>
    </vPrest>
    <imp>
${impOs.xml}
    </imp>
    <infCTeNorm>
      <infServico>
        <xDescServ>${e.modalidade === "pessoas" ? "Transporte de pessoas (fictício)" : "Transporte de valores (fictício)"}</xDescServ>
        <infQ><qCarga>${d4(qtd)}</qCarga></infQ>
      </infServico>
      <infModal versaoModal="4.00">
        <rodoOS>
          <!-- TAF / NroRegEstadual: Pendente de validação. -->
${e.veiculo ? `          <veic><placa>${e.veiculo.placa}</placa><UF>${e.veiculo.uf}</UF></veic>` : ""}
        </rodoOS>
      </infModal>
    </infCTeNorm>
  </infCte>
  <!-- Signature: não gerada (sem certificado digital no ambiente de simulação). -->
</CTeOS>`);

  return {
    xml,
    nomeBase: `CTeOS${chave}`,
    pdf: {
      titulo: "DACTE OS",
      subtitulo: "Documento Auxiliar do CT-e Outros Serviços",
      modelo: "67",
      numero: n,
      serie,
      emissao: t.br,
      chave,
      blocos: [
        blocoEmitente(),
        {
          titulo: "Tomador",
          campos: [
            ["Nome", e.tomador?.nome ?? "—"],
            ["Documento", e.tomador?.documento ?? "—"],
          ],
        },
        {
          titulo: "Prestação",
          campos: [
            [
              "Tipo de serviço",
              e.modalidade === "pessoas" ? "Transporte de pessoas" : "Transporte de valores",
            ],
            ["CFOP", cfop],
            ["Percurso", `${e.ufInicio} → ${e.ufFim}`],
            ["Motorista", e.motorista ? `${e.motorista.nome} (CPF ${e.motorista.cpf})` : "—"],
            ["Veículo", e.veiculo ? `${e.veiculo.placa}/${e.veiculo.uf}` : "—"],
          ],
        },
      ],
      ...(e.modalidade === "valores"
        ? {
            tabela: {
              titulo: "Malotes",
              colunas: ["Número", "Descrição", "Qtd", "Valor declarado"],
              linhas: e.malotes.map((m) => [
                m.numero || "—",
                m.descricao,
                String(m.quantidade),
                brl(m.valor),
              ]),
            },
          }
        : {}),
      totais: [
        [e.modalidade === "pessoas" ? "Passageiros" : "Malotes", String(qtd)],
        [`ICMS ${d2(PC.icmsPercentual)}% (cenário)`, brl(impOs.v)],
        ["Valor total da prestação", brl(e.valorPrestacao)],
      ],
      observacao: OBS,
    },
  };
}

/* ------------------------------------------------------------------ MDF-e 58 */

export interface EntradaMdfe {
  documentos: {
    tipo: "CT-e" | "NF-e";
    chave: string;
    destino: string;
    valor: number;
    peso: number;
  }[];
  motorista?: Motorista | undefined;
  veiculo?: Veiculo | undefined;
  reboques: { placa: string; uf: string }[];
  ufInicio: string;
  ufFim: string;
  percurso: string[];
}

export function gerarMdfe(e: EntradaMdfe): DocumentoGerado {
  const t = agora();
  const n = numeroSeq();
  const serie = "1";
  const { chave, cNF, dv } = montarChave(empresaSimulada.uf, t.aamm, "58", serie, n);
  const vCargaM = somar(e.documentos.map((d) => deNumero(d.valor)));
  const pesoM = somar(e.documentos.map((d) => deNumero(d.peso)));
  const vCarga = paraNumero(vCargaM);
  const peso = paraNumero(pesoM);
  const porDestino = new Map<string, typeof e.documentos>();
  e.documentos.forEach((d) => porDestino.set(d.destino, [...(porDestino.get(d.destino) ?? []), d]));
  const tpEmit = e.documentos.some((d) => d.tipo === "CT-e") ? "1" : "2";

  const descargas = [...porDestino.entries()]
    .map(([destino, docs]) => {
      const mun = destino.split("/")[0] ?? destino;
      return `        <infMunDescarga>
          <cMunDescarga>${codMun(mun)}</cMunDescarga>
          <xMunDescarga>${esc(mun)}</xMunDescarga>
${docs
  .map((d) =>
    d.tipo === "CT-e"
      ? `          <infCTe><chCTe>${d.chave}</chCTe></infCTe>`
      : `          <infNFe><chNFe>${d.chave}</chNFe></infNFe>`,
  )
  .join("\n")}
        </infMunDescarga>`;
    })
    .join("\n");

  const xml = cabecalho(`<MDFe xmlns="http://www.portalfiscal.inf.br/mdfe">
  <infMDFe versao="3.00" Id="MDFe${chave}">
    <ide>
      <cUF>${cUF[empresaSimulada.uf]}</cUF>
      <tpAmb>2</tpAmb>
      <tpEmit>${tpEmit}</tpEmit>
      <mod>58</mod>
      <serie>${serie}</serie>
      <nMDF>${n}</nMDF>
      <cMDF>${cNF}</cMDF>
      <cDV>${dv}</cDV>
      <modal>1</modal>
      <dhEmi>${t.iso}</dhEmi>
      <tpEmis>1</tpEmis>
      <procEmi>0</procEmi>
      <verProc>FiscalFriend-Simulador</verProc>
      <UFIni>${e.ufInicio}</UFIni>
      <UFFim>${e.ufFim}</UFFim>
      <infMunCarrega><cMunCarrega>${codMun(empresaSimulada.municipio)}</cMunCarrega><xMunCarrega>${empresaSimulada.municipio}</xMunCarrega></infMunCarrega>
${e.percurso.map((uf) => `      <infPercurso><UFPer>${uf}</UFPer></infPercurso>`).join("\n")}
    </ide>
${emitXml("    ")}
    <infModal versaoModal="3.00">
      <rodo>
        <veicTracao>
          <placa>${e.veiculo?.placa ?? ""}</placa>
          <tara>${e.veiculo?.tara ?? 0}</tara>
${e.motorista ? `          <condutor><xNome>${esc(e.motorista.nome)}</xNome><CPF>${e.motorista.cpf}</CPF></condutor>` : "          <!-- condutor obrigatório não informado -->"}
          <tpRod>03</tpRod>
          <tpCar>02</tpCar>
          <UF>${e.veiculo?.uf ?? ""}</UF>
        </veicTracao>
${e.reboques.map((r) => `        <veicReboque><placa>${r.placa}</placa><tara>0</tara><capKG>0</capKG><tpCar>02</tpCar><UF>${r.uf}</UF></veicReboque>`).join("\n")}
      </rodo>
    </infModal>
    <infDoc>
${descargas}
    </infDoc>
    <tot>
      <qCTe>${e.documentos.filter((d) => d.tipo === "CT-e").length || ""}</qCTe>
      <qNFe>${e.documentos.filter((d) => d.tipo === "NF-e").length || ""}</qNFe>
      <vCarga>${m2(vCargaM)}</vCarga>
      <cUnid>01</cUnid>
      <qCarga>${formatarXml(pesoM, 4)}</qCarga>
    </tot>
    <infAdic><infCpl>${OBS} ${AVISO_TRIB}</infCpl></infAdic>
  </infMDFe>
  <!-- infMDFeSupl (QR Code) e Signature: não gerados no ambiente de simulação. -->
</MDFe>`);

  return {
    xml,
    nomeBase: `MDFe${chave}`,
    pdf: {
      titulo: "DAMDFE",
      subtitulo: "Documento Auxiliar do Manifesto Eletrônico de Documentos Fiscais",
      modelo: "58",
      numero: n,
      serie,
      emissao: t.br,
      chave,
      blocos: [
        blocoEmitente(),
        {
          titulo: "Modal rodoviário",
          campos: [
            [
              "Veículo",
              e.veiculo ? `${e.veiculo.placa}/${e.veiculo.uf} · tara ${e.veiculo.tara} kg` : "—",
            ],
            ["Reboques", e.reboques.map((r) => r.placa).join(", ") || "—"],
            ["Condutor", e.motorista ? `${e.motorista.nome} (CPF ${e.motorista.cpf})` : "—"],
          ],
        },
        {
          titulo: "Percurso",
          campos: [
            ["UF início", e.ufInicio],
            ["UFs de percurso", e.percurso.join(", ") || "—"],
            ["UF fim", e.ufFim],
          ],
        },
      ],
      tabela: {
        titulo: "Documentos vinculados",
        colunas: ["Tipo", "Chave", "Descarga", "Valor", "Peso (kg)"],
        linhas: e.documentos.map((d) => [d.tipo, d.chave, d.destino, brl(d.valor), String(d.peso)]),
      },
      totais: [
        ["Qtd. CT-e", String(e.documentos.filter((d) => d.tipo === "CT-e").length)],
        ["Qtd. NF-e", String(e.documentos.filter((d) => d.tipo === "NF-e").length)],
        ["Peso bruto (kg)", peso.toLocaleString("pt-BR")],
        ["Valor total da carga", brlM(vCargaM)],
      ],
      observacao: OBS,
    },
  };
}

export { fmtChave };
