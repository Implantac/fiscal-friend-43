import { describe, expect, it } from "vitest";
import { dvModulo11, gerarNfe, gerarNfse, gerarMdfe } from "./documento-saida";
import { produtos, clientes } from "./cadastros";
import { deTexto, formatarXml, somar } from "@/lib/money";

const produto = produtos[0]!;
const clienteSP = clientes.find((c) => c.uf === "SP")!;

function itensNfe() {
  return [
    { produto, quantidade: 3, preco: 10.33, desconto: 0 },
    { produto, quantidade: 1, preco: 5.01, desconto: 0 },
    { produto, quantidade: 2, preco: 0.1, desconto: 0 },
  ];
}

describe("chave de acesso", () => {
  it("calcula o dígito verificador módulo 11", () => {
    // Exemplo publicado na documentação oficial (MOC 7.00), com DV conhecido:
    //   35 2607 12345678000199 55 001 000012345 1 23456789 | DV 5
    // Base de 43 posições. A implementação antiga aceitava base de qualquer
    // tamanho; a do domínio rejeita, e é o comportamento correto.
    expect(dvModulo11("3526071234567800019955001000012345123456789")).toBe(5);
    expect(dvModulo11("0".repeat(43))).toBe(0);
  });

  it("gera chave de 44 dígitos com DV coerente", () => {
    const { xml } = gerarNfe({ modelo: "55", natureza: "Venda", itens: itensNfe(), frete: 0 });
    const id = /Id="NFe(\d{44})"/.exec(xml)?.[1];
    expect(id).toBeDefined();
    expect(id).toHaveLength(44);
    expect(Number(id!.slice(-1))).toBe(dvModulo11(id!.slice(0, 43)));
  });
});

describe("marcação obrigatória do ambiente de simulação", () => {
  const { xml } = gerarNfe({ modelo: "55", natureza: "Venda", itens: itensNfe(), frete: 0 });

  it("todo XML gerado carrega o selo de simulação", () => {
    expect(xml).toContain("AMBIENTE DE SIMULAÇÃO");
    expect(xml).toContain("SEM VALOR FISCAL");
  });

  it("declara tpAmb=2 (homologação) — nunca produção", () => {
    expect(xml).toContain("<tpAmb>2</tpAmb>");
    expect(xml).not.toContain("<tpAmb>1</tpAmb>");
  });

  it("não contém assinatura nem protocolo de autorização", () => {
    expect(xml).not.toContain("<Signature");
    expect(xml).not.toContain("<protNFe>");
    expect(xml).not.toContain("<infProt>");
  });

  it("o XML gerado é bem formado (tags balanceadas)", () => {
    const corpo = xml.replace(/<!--[\s\S]*?-->/g, "").replace(/<\?[\s\S]*?\?>/g, "");
    const pilha: string[] = [];
    for (const m of corpo.matchAll(/<(\/?)([A-Za-z][\w:-]*)([^>]*?)(\/?)>/g)) {
      const [, fechamento, nome, , autofecha] = m;
      if (autofecha) continue;
      if (fechamento) {
        expect(pilha.pop()).toBe(nome!);
      } else {
        pilha.push(nome!);
      }
    }
    expect(pilha).toEqual([]);
  });
});

/** Extrai o bloco <total> (ICMSTot) do XML — é onde os totais do documento vivem. */
function blocoTotal(xml: string): string {
  return /<total>([\s\S]*?)<\/total>/.exec(xml)?.[1] ?? "";
}

function doTotal(xml: string, tag: string): number {
  const m = new RegExp(`<${tag}>([\\d.-]+)</${tag}>`).exec(blocoTotal(xml));
  if (!m) throw new Error(`tag ${tag} ausente no bloco total`);
  return Number(m[1]);
}

/** Extrai os blocos <det> (um por item). */
function itensDoXml(xml: string): string[] {
  return [...xml.matchAll(/<det nItem="(\d+)">([\s\S]*?)<\/det>/g)].map((m) => m[2]!);
}

describe("precisão monetária no XML", () => {
  it("totais fecham com a soma dos itens (sem centavo de diferença)", () => {
    const itens = itensNfe();
    const { xml } = gerarNfe({ modelo: "55", natureza: "Venda", itens, frete: 7.77 });

    // soma exata dos valores de produto, feita em decimal
    const somaExata = somar(itens.map((i) => deTexto((i.quantidade * i.preco).toFixed(4))));
    expect(formatarXml(somaExata)).toBe(doTotal(xml, "vProd").toFixed(2));

    expect(doTotal(xml, "vFrete")).toBe(7.77);
    expect(doTotal(xml, "vDesc")).toBe(0);
    // vNF = vProd - vDesc + vFrete + vIPI
    expect(doTotal(xml, "vNF")).toBeCloseTo(
      doTotal(xml, "vProd") - doTotal(xml, "vDesc") + doTotal(xml, "vFrete") + doTotal(xml, "vIPI"),
      2,
    );
  });

  it("a soma dos vProd por item é igual ao vProd do total", () => {
    const { xml } = gerarNfe({ modelo: "55", natureza: "Venda", itens: itensNfe(), frete: 7.77 });
    const porItem = itensDoXml(xml).map((det) => Number(/<vProd>([\d.]+)<\/vProd>/.exec(det)![1]));
    expect(porItem.reduce((a, b) => a + b, 0)).toBeCloseTo(doTotal(xml, "vProd"), 2);
  });

  it("valores monetários têm exatamente 2 casas decimais", () => {
    const { xml } = gerarNfe({ modelo: "55", natureza: "Venda", itens: itensNfe(), frete: 3 });
    const tags = new RegExp("<(vProd|vBC|vICMS|vIPI|vPIS|vCOFINS|vNF|vFrete)>([^<]+)</", "g");
    for (const m of xml.matchAll(tags)) {
      expect(m[2]).toMatch(/^-?\d+\.\d{2}$/);
    }
  });

  it("quantidades têm 4 casas decimais", () => {
    const { xml } = gerarNfe({ modelo: "55", natureza: "Venda", itens: itensNfe(), frete: 0 });
    for (const m of xml.matchAll(/<qCom>([^<]+)<\/qCom>/g)) {
      expect(m[1]).toMatch(/^\d+\.\d{4}$/);
    }
  });
});

describe("rateio do frete", () => {
  it("a soma das bases por item é produtos + frete (rateio sem sobra)", () => {
    const itens = [
      { produto, quantidade: 1, preco: 10, desconto: 0 },
      { produto, quantidade: 1, preco: 10, desconto: 0 },
      { produto, quantidade: 1, preco: 10, desconto: 0 },
    ];
    const { xml } = gerarNfe({ modelo: "55", natureza: "Venda", itens, frete: 10 });
    const bases = itensDoXml(xml).map((det) => Number(/<vBC>([\d.]+)<\/vBC>/.exec(det)![1]));
    expect(bases).toHaveLength(3);
    // cada item: 10,00 de produto + rateio do frete; 3 x 10 + 10 = 40
    expect(bases.reduce((a, b) => a + b, 0)).toBeCloseTo(40, 2);
    // rateio equilibrado: 3,34 / 3,33 / 3,33
    expect(bases).toEqual([13.34, 13.33, 13.33]);
  });

  it("rateio de valor que não divide exatamente continua fechando o total", () => {
    const itens = [
      { produto, quantidade: 1, preco: 10, desconto: 0 },
      { produto, quantidade: 1, preco: 10, desconto: 0 },
      { produto, quantidade: 1, preco: 10, desconto: 0 },
    ];
    const { xml } = gerarNfe({ modelo: "55", natureza: "Venda", itens, frete: 0.01 });
    const bases = itensDoXml(xml).map((det) => Number(/<vBC>([\d.]+)<\/vBC>/.exec(det)![1]));
    expect(bases.reduce((a, b) => a + b, 0)).toBeCloseTo(30.01, 2);
  });
});

describe("NFS-e e MDF-e", () => {
  it("DPS da NFS-e marca simulação e não gera protocolo", () => {
    const servico = { id: "s1", descricao: "Limpeza (fictícia)", codigoInterno: "INT-0001" };
    const { xml } = gerarNfse({
      cliente: clienteSP,
      servico,
      valor: 1000,
      descricao: "Serviço de limpeza predial (fictício)",
      aliquotaIss: 3,
      deducoes: 0,
      issRetido: false,
    });
    expect(xml).toContain("AMBIENTE DE SIMULAÇÃO");
    expect(xml).not.toContain("<Signature");
    expect(xml).toContain("<tpAmb>2</tpAmb>");
  });

  it("MDF-e marca simulação e soma documentos vinculados", () => {
    const { xml } = gerarMdfe({
      documentos: [
        { tipo: "CT-e", chave: "1".repeat(44), destino: "Sorocaba/SP", valor: 100, peso: 100 },
        { tipo: "NF-e", chave: "2".repeat(44), destino: "Sorocaba/SP", valor: 50.25, peso: 50 },
      ],
      reboques: [],
      ufInicio: "SP",
      ufFim: "MG",
      percurso: ["SP"],
    });
    expect(xml).toContain("AMBIENTE DE SIMULAÇÃO");
    expect(xml).toContain("<vCarga>150.25</vCarga>");
  });
});
