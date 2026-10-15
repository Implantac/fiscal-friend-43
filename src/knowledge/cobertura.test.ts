import { describe, expect, it } from "vitest";
import { matrizCobertura, resumoCobertura, nivelDescricao, MODELOS_PENDENTES } from "./cobertura";
import { documentos } from "./documentos";

describe("matriz de cobertura", () => {
  it("cobre todos os modelos do catálogo, exceto eventos", () => {
    const ids = matrizCobertura()
      .map((m) => m.documentoId)
      .sort();
    const esperado = documentos
      .map((d) => d.id)
      .filter((id) => id !== "eventos")
      .sort();
    expect(ids).toEqual(esperado);
  });

  it("todo modelo tem capacidades comuns e específicas", () => {
    for (const m of matrizCobertura()) {
      expect(m.capacidades.length).toBeGreaterThan(5);
      expect(m.capacidades.some((c) => c.area === "Ciclo de vida do documento")).toBe(true);
      expect(m.capacidades.some((c) => c.area === "Transmissão a SEFAZ ou provedor")).toBe(true);
    }
  });

  it("nenhuma capacidade de transmissão ou assinatura aparece como pronta", () => {
    for (const m of matrizCobertura()) {
      for (const c of m.capacidades) {
        if (c.area === "Transmissão a SEFAZ ou provedor" || c.area === "XSD e assinatura digital") {
          expect(c.nivel).toBe("documentado");
        }
      }
    }
  });

  it("nenhum modelo alega ter autorizado documento fiscal", () => {
    for (const m of matrizCobertura()) {
      for (const p of m.pendencias) {
        expect(p).not.toMatch(/homologad[oa] em produ/i);
      }
      expect(m.pendencias.join(" ")).toContain("Nenhum documento foi autorizado");
    }
  });

  it("cada capacidade declara uma realidade não vazia", () => {
    for (const m of matrizCobertura()) {
      for (const c of m.capacidades) {
        expect(c.realidade.trim().length).toBeGreaterThan(10);
      }
    }
  });

  it("as pendências do catálogo são preservadas, não sobrescritas", () => {
    const nfe = documentos.find((d) => d.id === "nfe55");
    const cobertura = matrizCobertura().find((m) => m.documentoId === "nfe55");
    for (const p of nfe?.pendencias ?? []) {
      expect(cobertura?.pendencias).toContain(p);
    }
  });

  it("o resumo soma exatamente as capacidades listadas", () => {
    const total = Object.values(resumoCobertura()).reduce((a, b) => a + b, 0);
    const listadas = matrizCobertura().reduce((a, m) => a + m.capacidades.length, 0);
    expect(total).toBe(listadas);
  });

  it("todo nível tem descrição honesta", () => {
    for (const descricao of Object.values(nivelDescricao)) {
      expect(descricao.length).toBeGreaterThan(10);
    }
    expect(nivelDescricao.simulado).toContain("não emite");
  });

  it("modelos pendentes continuam pendentes, sem tela", () => {
    expect(MODELOS_PENDENTES.length).toBeGreaterThan(0);
    for (const m of MODELOS_PENDENTES) {
      expect(m.motivo).toContain("Fora do escopo");
    }
  });
});
