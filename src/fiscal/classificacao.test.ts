import { describe, expect, it } from "vitest";
import {
  CFOP_CONHECIDOS,
  CFOP_GRUPO,
  CFOP_SENTIDO,
  CSOSN,
  CRT,
  CST_ORIGEM,
  CST_TRIBUTACAO,
  classificarOperacao,
  decomporCfop,
  decomporCst,
  sugerirCfop,
  type EntradaClassificacao,
} from "./classificacao";

const base: EntradaClassificacao = {
  sentido: "saida",
  ufEmitente: "SP",
  ufDestinatario: "MG",
  natureza: "venda_revenda",
  crt: "3",
  origem: "0",
  tributacao: "00",
};

describe("CFOP — estrutura oficial", () => {
  it("não existe primeiro dígito 4, 8 ou 0", () => {
    // Os primeiros dígitos são 1, 2, 3, 5, 6 e 7.
    expect(decomporCfop("4102").valido).toBe(false);
    expect(decomporCfop("8102").valido).toBe(false);
    expect(decomporCfop("0102").valido).toBe(false);
  });

  it("1/2/3 são entrada e 5/6/7 são saída", () => {
    expect(decomporCfop("1102").sentido).toContain("Entrada");
    expect(decomporCfop("2102").sentido).toContain("Entrada");
    expect(decomporCfop("3102").sentido).toContain("Entrada");
    expect(decomporCfop("5102").sentido).toContain("Saída");
    expect(decomporCfop("6102").sentido).toContain("Saída");
    expect(decomporCfop("7102").sentido).toContain("Saída");
  });

  it("1/5 é mesma UF e 2/6 é outra UF", () => {
    expect(decomporCfop("5102").sentido).toContain("interna");
    expect(decomporCfop("6102").sentido).toContain("interestadual");
    expect(decomporCfop("1102").sentido).toContain("interna");
    expect(decomporCfop("2102").sentido).toContain("interestadual");
  });

  it("3/7 é com o exterior", () => {
    expect(decomporCfop("3102").sentido).toContain("exterior");
    expect(decomporCfop("7102").sentido).toContain("exterior");
  });

  it("o segundo dígito dá o grupo da operação", () => {
    expect(decomporCfop("5102").grupo).toBe(CFOP_GRUPO["1"]);
    expect(decomporCfop("5202").grupo).toBe(CFOP_GRUPO["2"]);
    expect(decomporCfop("5405").grupo).toBe(CFOP_GRUPO["4"]);
  });

  it("rejeita CFOP que não tem 4 dígitos", () => {
    expect(decomporCfop("51").valido).toBe(false);
    expect(decomporCfop("51020").valido).toBe(false);
    expect(decomporCfop("abcd").valido).toBe(false);
  });

  it("marca conhecido apenas o que está na tabela", () => {
    expect(decomporCfop("5102").conhecido).toBe(true);
    expect(decomporCfop("6999").conhecido).toBe(false);
    expect(decomporCfop("6999").valido).toBe(true);
  });

  it("os códigos conhecidos são todos válidos e descritos", () => {
    for (const cfop of Object.keys(CFOP_CONHECIDOS)) {
      expect(decomporCfop(cfop).valido, cfop).toBe(true);
      expect(CFOP_CONHECIDOS[cfop], cfop).toBeTruthy();
    }
  });
});

describe("CST — Tabela A e Tabela B", () => {
  it("a Tabela A tem 9 origens, de 0 a 8", () => {
    expect(Object.keys(CST_ORIGEM).sort()).toEqual(["0", "1", "2", "3", "4", "5", "6", "7", "8"]);
  });

  it("a Tabela B tem as 15 situações oficiais", () => {
    expect(Object.keys(CST_TRIBUTACAO).sort()).toEqual([
      "00",
      "02",
      "10",
      "15",
      "20",
      "30",
      "40",
      "41",
      "50",
      "51",
      "53",
      "60",
      "61",
      "70",
      "90",
    ]);
  });

  it("decompõe CST em origem e tributação", () => {
    const d = decomporCst("060");
    expect(d.valido).toBe(true);
    expect(d.origem).toBe("0");
    expect(d.tributacao).toBe("60");
    expect(d.tributacaoDescricao).toContain("substituição tributária");
  });

  it("rejeita CST cujo par não existe nas tabelas", () => {
    expect(decomporCst("099").valido).toBe(false); // tributação 99 não existe
    expect(decomporCst("900").valido).toBe(false); // origem 9 não existe
    expect(decomporCst("06").valido).toBe(false);
    expect(decomporCst("0600").valido).toBe(false);
  });

  it("CSOSN tem os 10 códigos oficiais", () => {
    expect(Object.keys(CSOSN).sort()).toEqual([
      "101",
      "102",
      "103",
      "201",
      "202",
      "203",
      "300",
      "400",
      "500",
      "900",
    ]);
  });
});

describe("sugerirCfop", () => {
  it("venda de revenda dentro da UF é 5102", () => {
    expect(sugerirCfop({ ...base, ufDestinatario: "SP" })).toBe("5102");
  });

  it("venda de revenda para outra UF é 6102", () => {
    expect(sugerirCfop(base)).toBe("6102");
  });

  it("compra para comercialização espelha a venda", () => {
    expect(
      sugerirCfop({
        ...base,
        sentido: "entrada",
        natureza: "compra_comercializacao",
        ufDestinatario: "SP",
      }),
    ).toBe("1102");
    expect(sugerirCfop({ ...base, sentido: "entrada", natureza: "compra_comercializacao" })).toBe(
      "2102",
    );
  });

  it("devolução de venda é entrada com sufixo 202", () => {
    expect(
      sugerirCfop({
        ...base,
        sentido: "entrada",
        natureza: "devolucao_venda",
        ufDestinatario: "SP",
      }),
    ).toBe("1202");
    expect(sugerirCfop({ ...base, sentido: "entrada", natureza: "devolucao_venda" })).toBe("2202");
  });

  it("devolução de compra é saída com sufixo 202", () => {
    expect(sugerirCfop({ ...base, natureza: "devolucao_compra", ufDestinatario: "SP" })).toBe(
      "5202",
    );
  });

  it("transferência entre filiais", () => {
    expect(sugerirCfop({ ...base, natureza: "transferencia", ufDestinatario: "SP" })).toBe("5152");
    expect(sugerirCfop({ ...base, natureza: "transferencia" })).toBe("6152");
  });

  it("bonificação", () => {
    expect(sugerirCfop({ ...base, natureza: "bonificacao_doacao", ufDestinatario: "SP" })).toBe(
      "5910",
    );
    expect(sugerirCfop({ ...base, natureza: "bonificacao_doacao" })).toBe("6910");
  });
});

describe("classificarOperacao", () => {
  it("devolve CFOP e CST quando tudo está coberto", () => {
    const r = classificarOperacao(base);
    expect(r.cfop).toBe("6102");
    expect(r.codigoTributario).toBe("000");
    expect(r.tipoCodigoTributario).toBe("CST");
    expect(r.codigoTributarioDescricao).toContain("Nacional");
    expect(r.codigoTributarioDescricao).toContain("Tributada integralmente");
    expect(r.completa).toBe(true);
    expect(r.pendencias).toHaveLength(0);
  });

  it("CRT = 1 usa CSOSN e NÃO escolhe código — devolve pendência", () => {
    // A escolha entre 101/102/103/... depende de legislação do Simples e do
    // cadastro. O classificador não chuta.
    const r = classificarOperacao({ ...base, crt: "1" });
    expect(r.tipoCodigoTributario).toBe("CSOSN");
    expect(r.codigoTributario).toBeUndefined();
    expect(r.completa).toBe(false);
    expect(r.pendencias.join(" ")).toContain("CSOSN não determinado");
  });

  it("sem tributação informada, devolve pendência em vez de assumir", () => {
    const r = classificarOperacao({ ...base, tributacao: undefined });
    expect(r.codigoTributario).toBeUndefined();
    expect(r.completa).toBe(false);
    expect(r.pendencias.join(" ")).toContain("Tributação não informada");
  });

  it("tributação inexistente na Tabela B é recusada", () => {
    const r = classificarOperacao({ ...base, tributacao: "99" });
    expect(r.codigoTributario).toBeUndefined();
    expect(r.pendencias.join(" ")).toContain("não existe na Tabela B");
  });

  it("origem inexistente na Tabela A é recusada", () => {
    const r = classificarOperacao({ ...base, origem: "9" });
    expect(r.codigoTributario).toBeUndefined();
    expect(r.pendencias.join(" ")).toContain("não existe na Tabela A");
  });

  it("remessa para conserto dentro da UF é 5915", () => {
    const r = classificarOperacao({ ...base, natureza: "remessa_conserto", ufDestinatario: "SP" });
    expect(r.cfop).toBe("5915");
  });

  it("natureza sem CFOP na tabela conhecida devolve pendência, não código inventado", () => {
    // 6915 (remessa para conserto interestadual) não está em CFOP_CONHECIDOS:
    // a tabela copiada não a cobre. O classificador devolve pendência.
    const r = classificarOperacao({ ...base, natureza: "remessa_conserto", ufDestinatario: "MG" });
    expect(r.cfop).toBeUndefined();
    expect(r.completa).toBe(false);
    expect(r.pendencias.join(" ")).toContain("CFOP não determinável");
  });

  it("CRT tem os três regimes oficiais", () => {
    expect(Object.keys(CRT).sort()).toEqual(["1", "2", "3"]);
  });

  it("nunca devolve completa=true com pendência", () => {
    for (const e of [
      base,
      { ...base, crt: "1" as const },
      { ...base, tributacao: undefined },
      { ...base, tributacao: "99" },
      { ...base, origem: "9" },
    ]) {
      const r = classificarOperacao(e);
      expect(r.completa).toBe(r.pendencias.length === 0);
    }
  });

  it("todas as naturezes mapeadas produzem CFOP conhecido", () => {
    const naturezas: EntradaClassificacao["natureza"][] = [
      "venda_revenda",
      "venda_producao_propria",
      "devolucao_venda",
      "devolucao_compra",
      "transferencia",
      "bonificacao_doacao",
      "remessa_conserto",
      "compra_comercializacao",
      "compra_ativo",
      "compra_uso_consumo",
    ];
    // Compras são entrada; as demais, saída. Forçar o sentido errado produziria
    // um prefixo que não existe na tabela — o que o teste anterior já cobre.
    const deEntrada = new Set(["compra_comercializacao", "compra_ativo", "compra_uso_consumo"]);
    for (const natureza of naturezas) {
      const r = classificarOperacao({
        ...base,
        natureza,
        sentido: deEntrada.has(natureza) ? "entrada" : "saida",
        ufDestinatario: "SP",
      });
      expect(r.cfop, natureza).toBeDefined();
      expect(CFOP_CONHECIDOS[r.cfop!], natureza).toBeTruthy();
    }
  });
});

describe("integridade das tabelas", () => {
  it("CFOP conhecido bate com a decomposição", () => {
    for (const cfop of Object.keys(CFOP_CONHECIDOS)) {
      expect(decomporCfop(cfop).valido, cfop).toBe(true);
    }
  });

  it("todo CST da Tabela B combinado com origem 0 é válido", () => {
    for (const t of Object.keys(CST_TRIBUTACAO)) {
      expect(decomporCst("0" + t).valido, `0${t}`).toBe(true);
    }
  });

  it("CFOP_SENTIDO cobre exatamente os 6 primeiros dígitos oficiais", () => {
    expect(Object.keys(CFOP_SENTIDO).sort()).toEqual(["1", "2", "3", "5", "6", "7"]);
  });
});
