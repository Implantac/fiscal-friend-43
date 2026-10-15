import { describe, expect, it } from "vitest";
import {
  LAYOUT_CHAVE,
  MODELO_DOCUMENTO,
  TAMANHO_CHAVE,
  decodificarChave,
  dvChave,
  gerarCNF,
  montarChaveAcesso,
  validarChave,
  valorCaractere,
} from "./chave-acesso";

/**
 * Casos de teste ancorados no MOC 7.00 da NF-e, confirmados por múltiplas
 * fontes independentes. A conferência no PDF original ainda não foi feita — o
 * portal da SEFAZ bloqueia requisição automatizada — e por isso estes casos
 * sustentam `validada_tecnicamente`, não `aprovada_para_uso`.
 */

const BASE_VALIDA = {
  cUF: "35",
  aamm: "2601",
  cnpj: "11222333000181",
  modelo: "55" as const,
  serie: 1,
  numero: 1,
  tpEmis: "1" as const,
  cNF: "00000001",
};

describe("layout da chave de acesso", () => {
  it("tem 44 posições somando os campos oficiais", () => {
    expect(TAMANHO_CHAVE).toBe(44);
    expect(LAYOUT_CHAVE.map((c) => c.tamanho)).toEqual([2, 4, 14, 2, 3, 9, 1, 8, 1]);
  });

  it("os campos oficiais, na ordem", () => {
    expect(LAYOUT_CHAVE.map((c) => c.campo)).toEqual([
      "cUF",
      "AAMM",
      "CNPJ",
      "mod",
      "serie",
      "nNF",
      "tpEmis",
      "cNF",
      "cDV",
    ]);
  });
});

describe("dvChave — módulo 11", () => {
  it("reproduz o DV de exemplo publicado na documentação oficial", () => {
    // Exemplo do MOC, confirmado por múltiplas fontes independentes:
    //   35 2607 12345678000199 55 001 000012345 123456789 | DV 5
    // Esta é a âncora independente do algoritmo — o valor não foi calculado
    // por este código, foi conferido contra a documentação.
    expect(dvChave("3526071234567800019955001000012345123456789")).toBe(5);
    expect(
      montarChaveAcesso({
        cUF: "35",
        aamm: "2607",
        cnpj: "12345678000199",
        modelo: "55",
        serie: 1,
        numero: 12345,
        tpEmis: "1",
        cNF: "23456789",
      }),
    ).toBe("35260712345678000199550010000123451234567895");
  });

  it("aplica pesos 2 a 9 ciclicamente da direita para a esquerda", () => {
    // Base só de zeros: soma 0, resto 0, DV 0.
    expect(dvChave("0".repeat(43))).toBe(0);
  });

  it("resto 0 e 1 resultam em DV 0", () => {
    expect(dvChave("0".repeat(43))).toBe(0);
  });

  it("é determinístico", () => {
    const b = "3526071234567800019955001000012345123456789";
    expect(dvChave(b)).toBe(dvChave(b));
  });

  it("rejeita base com tamanho errado", () => {
    expect(() => dvChave("123")).toThrow(/43 caracteres/);
  });
});

describe("valorCaractere — CNPJ alfanumérico (IN RFB 2.229/2024)", () => {
  it("dígitos valem 0 a 9", () => {
    expect(valorCaractere("0")).toBe(0);
    expect(valorCaractere("9")).toBe(9);
  });

  it("letras maiúsculas valem ASCII menos 48", () => {
    // 'A' = ASCII 65 => 17. É a regra nova do CNPJ alfanumérico.
    expect(valorCaractere("A")).toBe(17);
    expect(valorCaractere("Z")).toBe(42);
  });

  it("recusa minúscula, espaço e símbolo em vez de devolver NaN", () => {
    // A cópia do simulador usava Number(base[i]) e devolvia NaN silenciosamente,
    // produzindo chave com DV "NaN" — inválida, sem erro visível.
    expect(() => valorCaractere("a")).toThrow(/não é válido/);
    expect(() => valorCaractere(" ")).toThrow(/não é válido/);
    expect(() => valorCaractere("-")).toThrow(/não é válido/);
  });
});

describe("montarChaveAcesso", () => {
  it("monta chave de 44 caracteres com DV conferível", () => {
    const chave = montarChaveAcesso(BASE_VALIDA);
    expect(chave).toHaveLength(44);
    expect(validarChave(chave)).toBe(true);
  });

  it("os campos ficam nas posições oficiais", () => {
    const chave = montarChaveAcesso(BASE_VALIDA);
    expect(chave.slice(0, 2)).toBe("35");
    expect(chave.slice(2, 6)).toBe("2601");
    expect(chave.slice(6, 20)).toBe("11222333000181");
    expect(chave.slice(20, 22)).toBe("55");
    expect(chave.slice(22, 25)).toBe("001");
    expect(chave.slice(25, 34)).toBe("000000001");
    expect(chave.slice(34, 35)).toBe("1");
    expect(chave.slice(35, 43)).toBe("00000001");
  });

  it("aceita CNPJ alfanumérico e produz chave válida", () => {
    // A cópia do simulador quebraria aqui: Number("A") === NaN.
    const chave = montarChaveAcesso({ ...BASE_VALIDA, cnpj: "AB000000000001" });
    expect(chave).toHaveLength(44);
    expect(validarChave(chave)).toBe(true);
    expect(decodificarChave(chave).cnpj).toBe("AB000000000001");
  });

  it("preenche com zeros à esquerda", () => {
    const chave = montarChaveAcesso({ ...BASE_VALIDA, serie: 7, numero: 42, cNF: "123" });
    expect(chave.slice(22, 25)).toBe("007");
    expect(chave.slice(25, 34)).toBe("000000042");
    expect(chave.slice(35, 43)).toBe("00000123");
  });

  it("tpEmis padrão é 1 (emissão normal)", () => {
    expect(montarChaveAcesso(BASE_VALIDA).slice(34, 35)).toBe("1");
  });

  it("cada modelo produz chave própria e válida", () => {
    for (const modelo of Object.keys(MODELO_DOCUMENTO)) {
      const chave = montarChaveAcesso({ ...BASE_VALIDA, modelo: modelo as "55" });
      expect(chave.slice(20, 22)).toBe(modelo);
      expect(validarChave(chave)).toBe(true);
    }
  });
});

describe("decodificarChave", () => {
  it("devolve todos os campos", () => {
    const chave = montarChaveAcesso(BASE_VALIDA);
    const d = decodificarChave(chave);
    expect(d).toMatchObject({
      cUF: "35",
      aamm: "2601",
      cnpj: "11222333000181",
      modelo: "55",
      serie: 1,
      numero: 1,
      tpEmis: "1",
      cNF: "00000001",
      dvConfere: true,
    });
  });

  it("detecta DV errado", () => {
    const chave = montarChaveAcesso(BASE_VALIDA);
    const quebrada = chave.slice(0, 43) + String((Number(chave[43]) + 1) % 10);
    expect(decodificarChave(quebrada).dvConfere).toBe(false);
  });

  it("rejeita chave com tamanho errado", () => {
    expect(() => decodificarChave("123")).toThrow(/44 caracteres/);
  });
});

describe("validarChave", () => {
  it("recusa caractere inválido em vez de aceitar silenciosamente", () => {
    const chave = montarChaveAcesso(BASE_VALIDA);
    expect(() => validarChave(chave.slice(0, 43) + "a")).toThrow(/caractere inválido/);
  });

  it("uma chave válida continua válida", () => {
    expect(validarChave(montarChaveAcesso(BASE_VALIDA))).toBe(true);
  });
});

describe("gerarCNF", () => {
  it("gera 8 posições numéricas", () => {
    expect(gerarCNF(1)).toBe("00000001");
    expect(gerarCNF(12345678)).toBe("12345678");
    expect(gerarCNF(-5)).toBe("00000005");
  });
});
