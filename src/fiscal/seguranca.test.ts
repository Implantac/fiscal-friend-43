import { describe, expect, it } from "vitest";
import {
  AcessoEstabelecimentoNegado,
  PermissaoNegada,
  assertAcessoEstabelecimento,
  assertAutorizado,
  assertPermitido,
  pode,
  permissoesDoPapel,
  violaSeparacaoDeFuncoes,
  type ContextoUsuario,
} from "./seguranca";

const admin: ContextoUsuario = { usuarioId: "u1", tenantId: "t1", papel: "administrador" };
const operador: ContextoUsuario = {
  usuarioId: "u2",
  tenantId: "t1",
  papel: "operador",
  estabelecimentoIds: ["est-1"],
};
const fiscal: ContextoUsuario = { usuarioId: "u3", tenantId: "t1", papel: "fiscal" };
const suporte: ContextoUsuario = { usuarioId: "u4", tenantId: "t1", papel: "suporte" };
const auditor: ContextoUsuario = { usuarioId: "u5", tenantId: "t1", papel: "auditor" };

describe("permissões por papel", () => {
  it("operador emite mas não aprova regra nem gerencia certificado", () => {
    expect(pode(operador, "documento.transmitir")).toBe(true);
    expect(pode(operador, "regra.aprovar")).toBe(false);
    expect(pode(operador, "certificado.gerenciar")).toBe(false);
    expect(pode(operador, "documento.cancelar")).toBe(false);
  });

  it("fiscal aprova regra mas não transmite documento", () => {
    expect(pode(fiscal, "regra.aprovar")).toBe(true);
    expect(pode(fiscal, "documento.transmitir")).toBe(false);
    expect(pode(fiscal, "documento.criar")).toBe(false);
  });

  it("suporte e auditor são somente leitura", () => {
    for (const ctx of [suporte, auditor]) {
      expect(pode(ctx, "documento.consultar")).toBe(true);
      expect(pode(ctx, "documento.transmitir")).toBe(false);
      expect(pode(ctx, "documento.cancelar")).toBe(false);
      expect(pode(ctx, "regra.aprovar")).toBe(false);
    }
  });

  it("administrador tem o conjunto máximo, mas não é lista aberta", () => {
    const permissoes = permissoesDoPapel("administrador");
    expect(permissoes).toContain("documento.transmitir");
    expect(permissoes).toContain("regra.aprovar");
    expect(permissoes.every((p) => typeof p === "string")).toBe(true);
    // Devolve cópia: mutação não altera a tabela interna.
    permissoes.push("leitura");
    expect(permissoesDoPapel("administrador").filter((p) => p === "leitura")).toHaveLength(1);
  });

  it("nega com erro que manda auditar", () => {
    expect(() => assertPermitido(operador, "regra.aprovar")).toThrow(PermissaoNegada);
    expect(() => assertPermitido(operador, "regra.aprovar")).toThrow(
      /deve ser registrada em auditoria/,
    );
  });
});

describe("isolamento por tenant e estabelecimento", () => {
  it("nega operação em recurso de outro tenant", () => {
    expect(() => assertAutorizado(admin, "documento.consultar", { tenantId: "t2" })).toThrow(
      PermissaoNegada,
    );
  });

  it("permite operação no próprio tenant", () => {
    expect(() => assertAutorizado(admin, "documento.transmitir", { tenantId: "t1" })).not.toThrow();
  });

  it("respeita a lista de estabelecimentos do usuário", () => {
    expect(() => assertAcessoEstabelecimento(operador, "est-1")).not.toThrow();
    expect(() => assertAcessoEstabelecimento(operador, "est-2")).toThrow(
      AcessoEstabelecimentoNegado,
    );
  });

  it("lista vazia de estabelecimentos = todos do tenant", () => {
    expect(() => assertAcessoEstabelecimento(admin, "qualquer-um")).not.toThrow();
  });

  it("combina permissão + tenant + estabelecimento", () => {
    expect(() =>
      assertAutorizado(operador, "documento.transmitir", {
        tenantId: "t1",
        estabelecimentoId: "est-1",
      }),
    ).not.toThrow();
    expect(() =>
      assertAutorizado(operador, "documento.transmitir", {
        tenantId: "t1",
        estabelecimentoId: "est-2",
      }),
    ).toThrow(AcessoEstabelecimentoNegado);
    expect(() =>
      assertAutorizado(operador, "regra.aprovar", { tenantId: "t1", estabelecimentoId: "est-1" }),
    ).toThrow(PermissaoNegada);
  });
});

describe("separação de funções", () => {
  it("detecta autoaprovação", () => {
    expect(violaSeparacaoDeFuncoes(fiscal, "u3")).toBe(true);
    expect(violaSeparacaoDeFuncoes(fiscal, "u2")).toBe(false);
  });
});
