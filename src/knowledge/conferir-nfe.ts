/**
 * Conferência de XML de NF-e (modelo 55) no navegador.
 * Aponta linha, caminho e valor de cada problema. Checagens estruturais e
 * aritméticas (dígito verificador, somas, coerência entre campos).
 * Nenhum código de rejeição oficial é afirmado aqui: o vínculo com cStat
 * oficial fica "Pendente de validação" até ser cadastrado na Governança.
 */
export type Severidade = "erro" | "alerta";

export interface Achado {
  id: string;
  severidade: Severidade;
  titulo: string;
  caminho: string;
  linha: number | null;
  encontrado: string;
  esperado: string;
  explicacao: string;
  correcao: string;
  suporte: string;
  regraId?: string;
  campoId?: string;
}

export interface ResultadoConferencia {
  bemFormado: boolean;
  achados: Achado[];
  resumo: { chave: string; emitente: string; destinatario: string; itens: number; vNF: string };
  linhas: string[];
}

const dig = (s: string) => s.replace(/\D/g, "");

export function dvChave(chave43: string) {
  let peso = 2, soma = 0;
  for (let i = chave43.length - 1; i >= 0; i--) {
    soma += Number(chave43[i]) * peso;
    peso = peso === 9 ? 2 : peso + 1;
  }
  const r = soma % 11;
  return r < 2 ? 0 : 11 - r;
}

export function cnpjValido(v: string) {
  const c = dig(v);
  if (c.length !== 14 || /^(\d)\1+$/.test(c)) return false;
  const calc = (n: number) => {
    const pesos = n === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const s = pesos.reduce((a, p, i) => a + Number(c[i]) * p, 0);
    const r = s % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return calc(12) === Number(c[12]) && calc(13) === Number(c[13]);
}

export function cpfValido(v: string) {
  const c = dig(v);
  if (c.length !== 11 || /^(\d)\1+$/.test(c)) return false;
  const calc = (n: number) => {
    let s = 0;
    for (let i = 0; i < n; i++) s += Number(c[i]) * (n + 1 - i);
    const r = (s * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return calc(9) === Number(c[9]) && calc(10) === Number(c[10]);
}

/** Linha (1-based) da n-ésima ocorrência de <tag no texto bruto. */
function linhaDe(raw: string, tag: string, ocorrencia = 0): number | null {
  const re = new RegExp(`<(?:\\w+:)?${tag}[\\s>/]`, "g");
  let m: RegExpExecArray | null, i = 0;
  while ((m = re.exec(raw))) {
    if (i === ocorrencia) return raw.slice(0, m.index).split("\n").length;
    i++;
  }
  return null;
}

const num = (s: string | null | undefined) => (s == null || s === "" ? NaN : Number(s));
const f2 = (n: number) => (Number.isFinite(n) ? n.toFixed(2) : "—");

export function conferirNfe(raw: string): ResultadoConferencia {
  const linhas = raw.split("\n");
  const achados: Achado[] = [];
  const resumo = { chave: "—", emitente: "—", destinatario: "—", itens: 0, vNF: "—" };
  const doc = new DOMParser().parseFromString(raw, "application/xml");
  const pe = doc.getElementsByTagName("parsererror")[0];
  if (pe) {
    const msg = pe.textContent ?? "";
    const l = /line\s+(\d+)/i.exec(msg)?.[1] ?? /linha\s+(\d+)/i.exec(msg)?.[1];
    achados.push({
      id: "XML-MAL-FORMADO", severidade: "erro", titulo: "XML mal formado", caminho: "(documento)", linha: l ? Number(l) : null,
      encontrado: msg.split("\n").slice(0, 2).join(" ").slice(0, 200), esperado: "Tags abertas e fechadas corretamente, caracteres especiais escapados (&amp; &lt;)",
      explicacao: "O arquivo não pode ser lido como XML. Nada é validado antes disso.",
      correcao: "Corrigir a tag indicada; conferir '&' sem escape e tags sem fechamento.",
      suporte: "Pedir o XML original gerado pelo ERP, não uma cópia editada à mão.",
    });
    return { bemFormado: false, achados, resumo, linhas };
  }

  const q = (el: Element | Document, tag: string) => el.getElementsByTagName(tag)[0] ?? null;
  const t = (el: Element | Document | null, tag: string) => (el ? q(el, tag)?.textContent?.trim() ?? "" : "");
  const add = (a: Omit<Achado, "linha"> & { tag: string; oc?: number }) => {
    const { tag, oc, ...resto } = a;
    achados.push({ ...resto, linha: linhaDe(raw, tag, oc ?? 0) });
  };

  const inf = q(doc, "infNFe");
  if (!inf) {
    add({ id: "SEM-INFNFE", severidade: "erro", titulo: "Grupo infNFe ausente", caminho: "NFe/infNFe", tag: "NFe", encontrado: "não encontrado", esperado: "<infNFe Id=\"NFe...\">", explicacao: "Não parece ser uma NF-e.", correcao: "Enviar o XML da NF-e (ou nfeProc).", suporte: "Confirmar se o cliente enviou NF-e e não CT-e/NFS-e." });
    return { bemFormado: true, achados, resumo, linhas };
  }
  const ide = q(inf, "ide"), emit = q(inf, "emit"), dest = q(inf, "dest"), tot = q(inf, "ICMSTot");

  // Chave
  const id = inf.getAttribute("Id") ?? "";
  const chave = id.replace(/^NFe/, "");
  resumo.chave = chave || "—";
  if (!/^NFe\d{44}$/.test(id)) {
    add({ id: "CHAVE-FORMATO", severidade: "erro", titulo: "Id da infNFe fora do formato", caminho: "infNFe/@Id", tag: "infNFe", encontrado: id || "(vazio)", esperado: "NFe + 44 dígitos", explicacao: "A chave de acesso tem 44 dígitos numéricos, precedidos de 'NFe' no atributo Id.", correcao: "Regerar a chave pelo ERP; nunca digitar.", suporte: "Verificar se algum sistema intermediário alterou o XML.", regraId: "REGRA-CHAVE-44" });
  } else {
    const dv = dvChave(chave.slice(0, 43));
    if (dv !== Number(chave[43])) add({ id: "CHAVE-DV", severidade: "erro", titulo: "Dígito verificador da chave inválido", caminho: "infNFe/@Id (posição 44)", tag: "infNFe", encontrado: chave[43] ?? "", esperado: String(dv), explicacao: "O último dígito é calculado por módulo 11 sobre os 43 anteriores (pesos 2 a 9 da direita para a esquerda).", correcao: "Recalcular o DV após qualquer mudança em UF, data, CNPJ, modelo, série, número, tipo de emissão ou código numérico.", suporte: "Comum quando série/número foram alterados sem regerar a chave.", regraId: "REGRA-CHAVE-44" });
    const pares: [string, string, number, number][] = [["cUF", t(ide, "cUF"), 0, 2], ["mod", t(ide, "mod"), 20, 22], ["serie", t(ide, "serie").padStart(3, "0"), 22, 25], ["nNF", t(ide, "nNF").padStart(9, "0"), 25, 34], ["tpEmis", t(ide, "tpEmis"), 34, 35], ["cNF", t(ide, "cNF").padStart(8, "0"), 35, 43]];
    for (const [tag, v, a, b] of pares) {
      if (v && chave.slice(a, b) !== v) add({ id: `CHAVE-${tag.toUpperCase()}`, severidade: "erro", titulo: `${tag} diverge da chave`, caminho: `ide/${tag}`, tag, encontrado: `${v} (na chave: ${chave.slice(a, b)})`, esperado: chave.slice(a, b), explicacao: `As posições ${a + 1}–${b} da chave repetem o campo ${tag}.`, correcao: "Regerar a chave a partir dos dados atuais do documento.", suporte: "Pergunte se a nota foi editada depois de gerada." });
    }
    const cnpjChave = chave.slice(6, 20), cnpjEmit = dig(t(emit, "CNPJ"));
    if (cnpjEmit && cnpjEmit !== cnpjChave) add({ id: "CHAVE-CNPJ", severidade: "erro", titulo: "CNPJ do emitente diverge da chave", caminho: "emit/CNPJ", tag: "CNPJ", encontrado: cnpjEmit, esperado: cnpjChave, explicacao: "Posições 7–20 da chave são o CNPJ do emitente.", correcao: "Conferir a empresa/filial emitente e regerar a chave.", suporte: "Frequente em empresas com várias filiais." });
  }
  if (t(ide, "mod") && t(ide, "mod") !== "55") add({ id: "MODELO", severidade: "erro", titulo: "Modelo diferente de 55", caminho: "ide/mod", tag: "mod", encontrado: t(ide, "mod"), esperado: "55", explicacao: "Esta conferência é para NF-e modelo 55.", correcao: "Usar a conferência do documento correto.", suporte: "Modelo 65 é NFC-e." });
  const dh = t(ide, "dhEmi");
  if (dh && !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/.test(dh)) add({ id: "DHEMI", severidade: "erro", titulo: "Data de emissão fora do formato", caminho: "ide/dhEmi", tag: "dhEmi", encontrado: dh, esperado: "AAAA-MM-DDThh:mm:ss-03:00", explicacao: "Data/hora com fuso horário (UTC).", correcao: "Gerar a data com fuso horário no ERP.", suporte: "Conferir fuso configurado no servidor." });

  // Participantes
  const cnpjE = t(emit, "CNPJ");
  resumo.emitente = t(emit, "xNome") || "—";
  if (cnpjE && !cnpjValido(cnpjE)) add({ id: "EMIT-CNPJ-DV", severidade: "erro", titulo: "CNPJ do emitente inválido", caminho: "emit/CNPJ", tag: "CNPJ", encontrado: cnpjE, esperado: "CNPJ com dígitos verificadores corretos", explicacao: "Os dois últimos dígitos são calculados por módulo 11.", correcao: "Corrigir o cadastro da empresa.", suporte: "Verificar cadastro da empresa no ERP." });
  if (dest) {
    resumo.destinatario = t(dest, "xNome") || "—";
    const cd = t(dest, "CNPJ"), cp = t(dest, "CPF");
    const oc = cnpjE ? 1 : 0;
    if (cd && !cnpjValido(cd)) add({ id: "DEST-CNPJ-DV", severidade: "erro", titulo: "CNPJ do destinatário inválido", caminho: "dest/CNPJ", tag: "CNPJ", oc, encontrado: cd, esperado: "CNPJ válido", explicacao: "Dígitos verificadores não conferem.", correcao: "Corrigir o cadastro do cliente e reemitir.", suporte: "Pedir o cartão CNPJ do cliente." });
    if (cp && !cpfValido(cp)) add({ id: "DEST-CPF-DV", severidade: "erro", titulo: "CPF do destinatário inválido", caminho: "dest/CPF", tag: "CPF", encontrado: cp, esperado: "CPF válido", explicacao: "Dígitos verificadores não conferem.", correcao: "Corrigir o cadastro do cliente.", suporte: "Confirmar documento com o cliente." });
  }

  // Itens
  const idDest = t(ide, "idDest");
  const esperadoCfop: Record<string, string> = { "1": "5", "2": "6", "3": "7" };
  const dets = Array.from(inf.getElementsByTagName("det"));
  resumo.itens = dets.length;
  let somaProd = 0;
  dets.forEach((det, i) => {
    const n = det.getAttribute("nItem") ?? String(i + 1);
    const prod = q(det, "prod");
    const ncm = t(prod, "NCM"), cfop = t(prod, "CFOP");
    const vProd = num(t(prod, "vProd")), qCom = num(t(prod, "qCom")), vUn = num(t(prod, "vUnCom"));
    somaProd += Number.isFinite(vProd) ? vProd : 0;
    if (ncm && !/^\d{8}$/.test(ncm) && ncm !== "00") add({ id: `NCM-${n}`, severidade: "erro", titulo: `Item ${n}: NCM com formato inválido`, caminho: `det[${n}]/prod/NCM`, tag: "NCM", oc: i, encontrado: ncm, esperado: "8 dígitos numéricos", explicacao: "O NCM classifica a mercadoria e influencia a tributação.", correcao: "Corrigir o NCM no cadastro do produto.", suporte: "Pedir ao fiscal do cliente a classificação correta.", regraId: "REGRA-NCM-FORMATO", campoId: "nfe.ncm" });
    if (cfop && idDest && esperadoCfop[idDest] && cfop[0] !== esperadoCfop[idDest]) add({ id: `CFOP-${n}`, severidade: "erro", titulo: `Item ${n}: CFOP incompatível com o destino`, caminho: `det[${n}]/prod/CFOP`, tag: "CFOP", oc: i, encontrado: `${cfop} (idDest=${idDest})`, esperado: `CFOP iniciando em ${esperadoCfop[idDest]}`, explicacao: "idDest 1=interna (5xxx), 2=interestadual (6xxx), 3=exterior (7xxx) para saídas.", correcao: "Ajustar a operação/UF do destinatário e recalcular o CFOP.", suporte: "Conferir UF do cliente no cadastro.", regraId: "REGRA-CFOP-DESTINO", campoId: "nfe.cfop" });
    if (Number.isFinite(qCom) && Number.isFinite(vUn) && Number.isFinite(vProd) && Math.abs(qCom * vUn - vProd) > 0.01) add({ id: `VPROD-${n}`, severidade: "alerta", titulo: `Item ${n}: vProd diferente de qCom × vUnCom`, caminho: `det[${n}]/prod/vProd`, tag: "vProd", oc: i, encontrado: f2(vProd), esperado: f2(qCom * vUn), explicacao: "O valor bruto do item normalmente é quantidade × valor unitário.", correcao: "Revisar arredondamento de quantidade/valor unitário.", suporte: "Comum com unitários de muitas casas decimais." });
    const icms = q(det, "ICMS");
    if (icms) {
      const vBC = num(t(icms, "vBC")), p = num(t(icms, "pICMS")), v = num(t(icms, "vICMS"));
      if ([vBC, p, v].every(Number.isFinite) && Math.abs(Math.round(vBC * p) / 100 - v) > 0.01) add({ id: `VICMS-${n}`, severidade: "erro", titulo: `Item ${n}: vICMS não confere com vBC × pICMS`, caminho: `det[${n}]/imposto/ICMS/vICMS`, tag: "vICMS", oc: i, encontrado: f2(v), esperado: f2(Math.round(vBC * p) / 100), explicacao: "O valor do imposto deve ser a base multiplicada pela alíquota.", correcao: "Deixar o ERP calcular o imposto; não digitar o valor.", suporte: "Verificar se houve alteração manual no pedido.", regraId: "REGRA-ICMS-VALOR" });
    }
  });

  // Totais
  if (tot) {
    const g = (x: string) => num(t(tot, x)) || 0;
    const vProdT = num(t(tot, "vProd")), vNF = num(t(tot, "vNF"));
    resumo.vNF = f2(vNF);
    if (Number.isFinite(vProdT) && Math.abs(vProdT - somaProd) > 0.01) add({ id: "TOT-VPROD", severidade: "erro", titulo: "Total de produtos diferente da soma dos itens", caminho: "total/ICMSTot/vProd", tag: "vProd", oc: dets.length, encontrado: f2(vProdT), esperado: f2(somaProd), explicacao: "O total deve ser a soma dos vProd dos itens.", correcao: "Recalcular os totais a partir dos itens antes de gerar o XML.", suporte: "Acontece quando um item é removido sem recalcular.", regraId: "REGRA-TOTAL-ITENS" });
    const calc = g("vProd") - g("vDesc") + g("vST") + g("vFCPST") + g("vFrete") + g("vSeg") + g("vOutro") + g("vII") + g("vIPI") + g("vIPIDevol");
    if (Number.isFinite(vNF) && Math.abs(calc - vNF) > 0.01) add({ id: "TOT-VNF", severidade: "alerta", titulo: "vNF não confere com a composição dos totais", caminho: "total/ICMSTot/vNF", tag: "vNF", encontrado: f2(vNF), esperado: `${f2(calc)} (vProd − vDesc + vST + vFCPST + vFrete + vSeg + vOutro + vII + vIPI + vIPIDevol)`, explicacao: "Composição didática do valor total; casos especiais (ex.: desoneração, serviços) mudam a fórmula.", correcao: "Revisar descontos, frete e impostos somados ao total.", suporte: "Conferir se há ICMS desonerado ou ISSQN na nota.", regraId: "REGRA-TOTAL-ITENS" });
    const somaPag = Array.from(inf.getElementsByTagName("vPag")).reduce((a, e) => a + (num(e.textContent) || 0), 0);
    if (inf.getElementsByTagName("pag").length && Number.isFinite(vNF) && somaPag + 0.01 < vNF && t(inf, "tPag") !== "90") add({ id: "PAG-SOMA", severidade: "alerta", titulo: "Pagamentos somam menos que o total da nota", caminho: "pag/detPag/vPag", tag: "vPag", encontrado: f2(somaPag), esperado: `≥ ${f2(vNF)}`, explicacao: "As formas de pagamento devem cobrir o valor da nota.", correcao: "Incluir todas as formas de pagamento.", suporte: "Verificar parcelas no financeiro.", regraId: "REGRA-PAG-SOMA" });
  } else {
    add({ id: "SEM-TOTAL", severidade: "erro", titulo: "Grupo de totais ausente", caminho: "total/ICMSTot", tag: "total", encontrado: "não encontrado", esperado: "<total><ICMSTot>…", explicacao: "Toda NF-e traz os totais.", correcao: "Regerar o XML.", suporte: "XML provavelmente incompleto." });
  }

  achados.sort((a, b) => (a.linha ?? 1e9) - (b.linha ?? 1e9));
  return { bemFormado: true, achados, resumo, linhas };
}

export const xmlExemploComErros = `<?xml version="1.0" encoding="UTF-8"?>
<NFe xmlns="http://www.portalfiscal.inf.br/nfe">
  <infNFe Id="NFe35250400000000000191550010000001231000001235" versao="4.00">
    <ide>
      <cUF>35</cUF>
      <cNF>00000123</cNF>
      <natOp>Venda de mercadoria</natOp>
      <mod>55</mod>
      <serie>1</serie>
      <nNF>124</nNF>
      <dhEmi>2025-04-10 10:00:00</dhEmi>
      <tpNF>1</tpNF>
      <idDest>2</idDest>
      <tpEmis>1</tpEmis>
    </ide>
    <emit>
      <CNPJ>00000000000191</CNPJ>
      <xNome>Aurora Distribuidora de Materiais Ltda (fictício)</xNome>
    </emit>
    <dest>
      <CNPJ>11222333000100</CNPJ>
      <xNome>Cliente Exemplo Ltda (fictício)</xNome>
    </dest>
    <det nItem="1">
      <prod>
        <cProd>001</cProd>
        <xProd>Parafuso sextavado</xProd>
        <NCM>7318159</NCM>
        <CFOP>5102</CFOP>
        <qCom>10.0000</qCom>
        <vUnCom>25.00</vUnCom>
        <vProd>250.00</vProd>
      </prod>
      <imposto>
        <ICMS><ICMS00><orig>0</orig><CST>00</CST><vBC>250.00</vBC><pICMS>12.00</pICMS><vICMS>35.00</vICMS></ICMS00></ICMS>
      </imposto>
    </det>
    <det nItem="2">
      <prod>
        <cProd>002</cProd>
        <xProd>Arruela lisa</xProd>
        <NCM>73182200</NCM>
        <CFOP>6102</CFOP>
        <qCom>5.0000</qCom>
        <vUnCom>10.00</vUnCom>
        <vProd>50.00</vProd>
      </prod>
      <imposto>
        <ICMS><ICMS00><orig>0</orig><CST>00</CST><vBC>50.00</vBC><pICMS>12.00</pICMS><vICMS>6.00</vICMS></ICMS00></ICMS>
      </imposto>
    </det>
    <total>
      <ICMSTot><vBC>300.00</vBC><vICMS>41.00</vICMS><vProd>280.00</vProd><vDesc>0.00</vDesc><vFrete>0.00</vFrete><vNF>300.00</vNF></ICMSTot>
    </total>
    <pag><detPag><tPag>01</tPag><vPag>250.00</vPag></detPag></pag>
  </infNFe>
</NFe>`;
