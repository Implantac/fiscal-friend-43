import { beforeEach, describe, expect, it } from "vitest";
import { limparRegistro, listarRegras, obterRegra, regraParaCalculo, utilizavel } from "./regras";
import {
  REGRAS_COM_FONTE,
  REGRA_CHAVE_ALFANUMERICO,
  REGRA_CHAVE_DV,
  REGRA_CHAVE_ESTRUTURA,
  registrarRegrasComFonte,
  verificarCasosTeste,
} from "./regras-oficiais";

describe("registro de regras com fonte oficial", () => {
  beforeEach(() => {
    limparRegistro();
    registrarRegrasComFonte();
  });

  it("registra as três regras com fonte", () => {
    expect(REGRAS_COM_FONTE).toHaveLength(3);
    expect(listarRegras()).toHaveLength(3);
  });

  it("toda regra tem fonte normativa identificada", () => {
    for (const r of REGRAS_COM_FONTE) {
      expect(r.fonte, `${r.id} sem fonte`).toBeDefined();
      expect(r.fonte?.orgao).toBeTruthy();
      expect(r.fonte?.documento).toBeTruthy();
      expect(r.fonte?.consultadaEm).toBeTruthy();
    }
  });

  it("toda regra tem ao menos um caso de teste", () => {
    for (const r of REGRAS_COM_FONTE) {
      expect(r.casosTeste?.length ?? 0, `${r.id} sem caso`).toBeGreaterThan(0);
    }
  });

  it("todos os casos de teste passam contra a implementação real", () => {
    const resultados = verificarCasosTeste();
    const falhas = resultados.filter((r) => !r.passou);
    expect(falhas, JSON.stringify(falhas, null, 2)).toHaveLength(0);
    expect(resultados.length).toBeGreaterThanOrEqual(9);
  });

  it("nenhuma regra está aprovada para uso — a conferência no PDF original não foi feita", () => {
    for (const r of REGRAS_COM_FONTE) {
      expect(r.estado).toBe("validada_tecnicamente");
      expect(utilizavel(r)).toBe(false);
    }
  });

  it("o motor se recusa a calcular com regra não aprovada", () => {
    expect(() => regraParaCalculo("CHAVE-ACESSO-DV-MOD11", "2026-10-15")).toThrow(
      /não pode ser usada em cálculo real/,
    );
  });

  it("o motor recusa regra inexistente em vez de inventar", () => {
    expect(() => regraParaCalculo("REGRA-QUE-NAO-EXISTE", "2026-10-15")).toThrow(
      /não encontrada no registro/,
    );
  });

  it("registrar duas vezes não duplica", () => {
    registrarRegrasComFonte();
    expect(listarRegras()).toHaveLength(3);
  });

  it("cada regra declara suas limitações conhecidas", () => {
    for (const r of REGRAS_COM_FONTE) {
      expect(r.limitacoes?.length ?? 0, `${r.id} sem limitações`).toBeGreaterThan(0);
    }
  });

  it("a regra do CNPJ alfanumérico declara vigência", () => {
    expect(REGRA_CHAVE_ALFANUMERICO.vigenciaInicio).toBe("2026-01-01");
  });

  it("os ids são estáveis e únicos", () => {
    const ids = REGRAS_COM_FONTE.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[A-Z0-9-]+$/);
  });

  it("as três regras são recuperáveis individualmente", () => {
    expect(obterRegra(REGRA_CHAVE_ESTRUTURA.id)?.titulo).toBeTruthy();
    expect(obterRegra(REGRA_CHAVE_DV.id)?.titulo).toBeTruthy();
    expect(obterRegra(REGRA_CHAVE_ALFANUMERICO.id)?.titulo).toBeTruthy();
  });

  it("a regra de DV declara fórmula e critério de arredondamento", () => {
    expect(REGRA_CHAVE_DV.formula).toBeTruthy();
    expect(REGRA_CHAVE_DV.arredondamento).toBeTruthy();
  });
});
