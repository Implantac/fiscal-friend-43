import { describe, expect, it } from "vitest";
import {
  ErroMonetario,
  ZERO,
  absoluto,
  aplicarPercentual,
  aplicarPercentualExato,
  comparar,
  deCentavos,
  deMoeda,
  deNumero,
  deTexto,
  formatar,
  formatarDecimal,
  formatarXml,
  iguais,
  multiplicarInteiro,
  parseDecimal,
  paraMoney,
  paraNumero,
  ratear,
  somar,
  subtrair,
  valorUnitario,
} from "./money";

describe("parsing exato", () => {
  it("não passa por ponto flutuante ao interpretar texto", () => {
    // 0.1 em binário não é exato; como texto, é.
    expect(deTexto("0.1") + deTexto("0.2")).toBe(deTexto("0.3"));
    expect(paraNumero(deTexto("0.1") + deTexto("0.2"))).toBe(0.3);
  });

  it("aceita formato brasileiro e cifrão", () => {
    expect(deMoeda("R$ 1.234,56")).toBe(123456n);
    expect(deMoeda("1.234,56")).toBe(123456n);
    expect(deTexto("-0,05")).toBe(-5n);
    expect(deTexto("1234.56")).toBe(123456n);
    expect(deTexto("1,234.56")).toBe(123456n); // formato americano
  });

  it("aceita notação científica", () => {
    expect(deTexto("1e3")).toBe(100000n);
    expect(parseDecimal("1.5e-2")).toEqual({ n: 15n, s: 3 });
    expect(parseDecimal("2E-2")).toEqual({ n: 2n, s: 2 });
  });

  it("rejeita entrada inválida em vez de inventar zero", () => {
    expect(() => deTexto("")).toThrow(ErroMonetario);
    expect(() => deTexto("abc")).toThrow(ErroMonetario);
    expect(() => deNumero(Number.NaN)).toThrow(ErroMonetario);
    expect(() => deNumero(Number.POSITIVE_INFINITY)).toThrow(ErroMonetario);
  });

  it("soma centenas de itens sem drift", () => {
    // 1000 x 0,01 = 10,00 exatamente (em float, 0.01*1000 = 9.999999999999998)
    let total = ZERO;
    for (let i = 0; i < 1000; i++) total = somar([total, deTexto("0.01")]);
    expect(total).toBe(1000n);
    expect(formatar(total)).toBe("10,00");
  });
});

describe("arredondamento", () => {
  it("half_up arredonda 0,5 para cima", () => {
    expect(formatarXml(aplicarPercentual(deTexto("100.00"), "12.345"))).toBe("12.35");
    expect(formatarXml(aplicarPercentual(deTexto("10.00"), "2.5"))).toBe("0.25");
  });

  it("half_even arredonda empate para o par", () => {
    // 0,125 com 2 casas: 0,12 (2 é par) — half_up daria 0,13
    expect(formatarXml(aplicarPercentual(deTexto("10.00"), "1.25", { modo: "half_even" }))).toBe(
      "0.12",
    );
    expect(formatarXml(aplicarPercentual(deTexto("10.00"), "1.25", { modo: "half_up" }))).toBe(
      "0.13",
    );
  });

  it("truncate descarta a fração", () => {
    expect(formatarXml(aplicarPercentual(deTexto("10.00"), "3.339", { modo: "truncate" }))).toBe(
      "0.33",
    );
  });

  it("ceil sempre sobe", () => {
    expect(formatarXml(aplicarPercentual(deTexto("10.00"), "3.331", { modo: "ceil" }))).toBe(
      "0.34",
    );
  });

  it("respeita precisão sub-centavo quando pedida", () => {
    // 10,00 x 1,65% = 0,1650 — 16,50 centavos. Com 4 casas em reais:
    const exato = aplicarPercentualExato(deTexto("10.00"), "1.65", { casas: 4 });
    expect(formatarDecimal(exato, 4)).toBe("0,1650");
    expect(formatarXml(paraMoney(exato))).toBe("0.17"); // 16,5 centavos -> 17 ao virar Money
  });

  it("trata valores negativos de forma simétrica", () => {
    expect(formatarXml(aplicarPercentual(deTexto("-10.00"), "18"))).toBe("-1.80");
    expect(absoluto(deTexto("-5.00"))).toBe(500n);
  });
});

describe("percentual sobre base monetária", () => {
  it("18% de 100,00 é 18,00 sem resíduo binário", () => {
    // Em float: (100 * 18) / 100 = 18.000000000000004 em alguns caminhos
    expect(formatarXml(aplicarPercentual(deTexto("100.00"), "18"))).toBe("18.00");
  });

  it("aplica PIS/COFINS com casas decimais na alíquota", () => {
    expect(formatarXml(aplicarPercentual(deTexto("1000.00"), "1.65"))).toBe("16.50");
    expect(formatarXml(aplicarPercentual(deTexto("1000.00"), "7.6"))).toBe("76.00");
  });

  it("é determinístico: mesmas entradas, mesmo resultado", () => {
    const a = aplicarPercentual(deTexto("1234.56"), "7.6");
    const b = aplicarPercentual(deTexto("1234.56"), "7.6");
    expect(a).toBe(b);
  });
});

describe("rateio sem perder centavos", () => {
  it("soma dos rateios é exatamente o valor rateado", () => {
    // Caso clássico: 3 itens de valores iguais e frete de 10,00
    const pesos = [100, 100, 100];
    const partes = ratear(deTexto("10.00"), pesos);
    expect(partes.reduce((a, b) => a + b, 0n)).toBe(1000n);
  });

  it("funciona com valores que não dividem exatamente", () => {
    const partes = ratear(deTexto("10.00"), [1, 1, 1]); // 3,3333... cada
    expect(somar(partes)).toBe(1000n);
    expect(partes.map((p) => formatarXml(p))).toEqual(["3.34", "3.33", "3.33"]);
  });

  it("nunca perde nem cria centavo em rateio com muitos itens", () => {
    const pesos = Array.from({ length: 97 }, (_, i) => (i % 7) + 1);
    const partes = ratear(deTexto("100.00"), pesos);
    expect(somar(partes)).toBe(10000n);
    expect(partes.every((p) => p >= 0n)).toBe(true);
  });

  it("funciona com rateio de 1 centavo entre 3 partes", () => {
    const partes = ratear(1n, [1, 1, 1]);
    expect(somar(partes)).toBe(1n);
    expect(partes.map((p) => formatarXml(p))).toEqual(["0.01", "0.00", "0.00"]);
  });

  it("devolve o valor inteiro no primeiro item quando não há base de rateio", () => {
    const partes = ratear(deTexto("50.00"), [0, 0, 0]);
    expect(somar(partes)).toBe(5000n);
    expect(partes[0]).toBe(5000n);
  });

  it("rateia frete proporcional ao valor dos itens", () => {
    const itens = [deTexto("300.00"), deTexto("100.00")];
    const partes = ratear(
      deTexto("40.00"),
      itens.map((i) => paraNumero(i)),
    );
    expect(formatarXml(partes[0]!)).toBe("30.00");
    expect(formatarXml(partes[1]!)).toBe("10.00");
    expect(somar(partes)).toBe(deTexto("40.00"));
  });
});

describe("valor unitário", () => {
  it("divide com 4 casas por padrão", () => {
    expect(formatarDecimal(valorUnitario(deTexto("10.00"), 3), 4)).toBe("3,3333");
  });

  it("recusa quantidade zero", () => {
    expect(() => valorUnitario(deTexto("10.00"), 0)).toThrow(ErroMonetario);
  });

  it("reconstrói o total quando a divisão é exata", () => {
    const unitario = valorUnitario(deTexto("100.00"), 4);
    expect(formatarDecimal(unitario, 4)).toBe("25,0000");
    expect(formatarDecimal({ n: unitario.n * 4n, s: unitario.s }, 4)).toBe("100,0000");
  });

  it("declara a diferença quando a divisão não é exata", () => {
    // 100,00 / 7 = 14,285714... — com 4 casas dá 14,2857, e 14,2857 x 7 = 99,9999.
    // O motor é explícito sobre essa divergência em vez de escondê-la.
    const unitario = valorUnitario(deTexto("100.00"), 7);
    expect(formatarDecimal(unitario, 4)).toBe("14,2857");
    expect(formatarDecimal({ n: unitario.n * 7n, s: unitario.s }, 4)).toBe("99,9999");
  });
});

describe("formatação e comparação", () => {
  it("formata em pt-BR", () => {
    expect(formatar(123456n)).toBe("1.234,56");
    expect(formatar(5n)).toBe("0,05");
    expect(formatar(-123456n)).toBe("-1.234,56");
  });

  it("serializa para XML com ponto decimal e casas fixas", () => {
    expect(formatarXml(123456n)).toBe("1234.56");
    expect(formatarXml(5n)).toBe("0.05");
    expect(formatarXml(123456n, 4)).toBe("1234.5600");
  });

  it("compara e subtrai", () => {
    expect(comparar(deTexto("1.00"), deTexto("2.00"))).toBe(-1);
    expect(iguais(subtrair(deTexto("2.00"), deTexto("1.00")), deTexto("1.00"))).toBe(true);
    expect(deCentavos(0)).toBe(0n);
  });
});
