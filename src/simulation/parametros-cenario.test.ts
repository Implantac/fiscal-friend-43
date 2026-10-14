import { describe, expect, it } from "vitest";
import {
  aplicarPercentualCenario,
  parametrosCenario,
  previaTributaria,
  sugerirCfop,
} from "./parametros-cenario";
import { deTexto, formatarXml } from "@/lib/money";
import {
  pendenciaAliquotaNaoValidada,
  pendenciaCfopHeuristico,
  temBloqueio,
} from "@/domain/pendencia";

describe("previaTributaria", () => {
  it("nunca apresenta número sem a pendência bloqueante", () => {
    const previa = previaTributaria(1000);
    expect(previa.linhas).toHaveLength(4);
    expect(previa.pendencias).toHaveLength(1);
    expect(temBloqueio(previa.pendencias)).toBe(true);
    expect(previa.pendencias[0]!.regraId).toBe("PENDENTE-VALIDACAO");
    expect(previa.aviso).toMatch(/não é apuração fiscal/i);
  });

  it("calcula em decimal exato", () => {
    const previa = previaTributaria(1000);
    const icms = previa.linhas.find((l) => l.grupo === "ICMS")!;
    expect(formatarXml(icms.valorExato)).toBe("120.00"); // 12% de 1000
    const pis = previa.linhas.find((l) => l.grupo === "PIS")!;
    expect(formatarXml(pis.valorExato)).toBe("16.50"); // 1,65% de 1000
  });

  it("o total é a soma exata das linhas", () => {
    const previa = previaTributaria(1234.56);
    const soma = previa.linhas.reduce((a, l) => a + l.valorExato, 0n);
    expect(previa.totalExato).toBe(soma);
  });

  it("base inválida não produz NaN silencioso", () => {
    const previa = previaTributaria(Number.NaN);
    expect(previa.totalExato).toBe(0n);
    expect(Number.isNaN(previa.total)).toBe(false);
  });

  it("os parâmetros estão marcados como não oficiais", () => {
    expect(parametrosCenario.naoOficial).toBe(true);
  });
});

describe("sugerirCfop", () => {
  it("sempre acompanha a sugestão de aviso e pendência", () => {
    const s = sugerirCfop("SP", "SP", true);
    expect(s.codigo).toBe("5102");
    expect(s.aviso.length).toBeGreaterThan(0);
    expect(s.pendencias[0]!.regraId).toBe("PENDENTE-VALIDACAO");
    expect(s.pendencias[0]).toEqual(pendenciaCfopHeuristico());
  });

  it("difere interestadual de interna", () => {
    expect(sugerirCfop("MG", "SP", true).codigo).toBe("6102");
    expect(sugerirCfop("SP", "SP", false).codigo).toBe("5101");
  });
});

describe("aplicarPercentualCenario", () => {
  it("substitui o cálculo (base * percentual) / 100 sem resíduo binário", () => {
    expect(aplicarPercentualCenario(100, 18)).toBe(18);
    // Em float, (0.07 * 3) / 100 style acumula; aqui é exato.
    expect(formatarXml(deTexto(aplicarPercentualCenario(1000, 7.6).toFixed(2)))).toBe("76.00");
  });
});

describe("pendências canônicas", () => {
  it("pendência de alíquota é bloqueante e explica a consequência", () => {
    const p = pendenciaAliquotaNaoValidada("vICMS");
    expect(p.severidade).toBe("bloqueante");
    expect(p.consequencia).toMatch(/não pode ser transmitido/);
    expect(p.orientacao.length).toBeGreaterThan(0);
  });
});
