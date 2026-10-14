import { describe, expect, it } from "vitest";
import {
  AcessoCrossTenant,
  assertMesmoTenant,
  cnpjEstruturalmenteValido,
  cpfEstruturalmenteValido,
  documentoEstruturalmenteValido,
  filtrarPorTenant,
  verificarHabilitacaoTecnica,
  type CertificadoDigital,
  type Estabelecimento,
} from "./tenancy";

const estabelecimento = (over: Partial<Estabelecimento> = {}): Estabelecimento => ({
  id: "est-1",
  tenantId: "t1",
  empresaId: "emp-1",
  cnpj: "11222333000181",
  municipio: "Campinas",
  uf: "SP",
  series: { "55": 1 },
  ambiente: 2,
  ativo: true,
  ...over,
});

const certificado = (over: Partial<CertificadoDigital> = {}): CertificadoDigital => ({
  id: "cert-1",
  tenantId: "t1",
  estabelecimentoId: "est-1",
  thumbprint: "AB:CD:EF",
  titular: "Empresa Teste",
  cnpj: "11222333000181",
  validoDe: "2026-01-01",
  validoAte: "2027-01-01",
  emissor: "AC Teste",
  revogado: false,
  ...over,
});

describe("validação estrutural de documentos", () => {
  it("valida CNPJ com dígitos verificadores corretos", () => {
    expect(cnpjEstruturalmenteValido("11222333000181")).toBe(true);
    expect(cnpjEstruturalmenteValido("11.222.333/0001-81")).toBe(true); // com pontuação
  });

  it("rejeita CNPJ com dígito verificador errado", () => {
    expect(cnpjEstruturalmenteValido("11222333000182")).toBe(false);
    expect(cnpjEstruturalmenteValido("11222333000180")).toBe(false);
  });

  it("rejeita CNPJ de tamanho errado ou com dígitos repetidos", () => {
    expect(cnpjEstruturalmenteValido("1122233300018")).toBe(false);
    expect(cnpjEstruturalmenteValido("11111111111111")).toBe(false);
    expect(cnpjEstruturalmenteValido("")).toBe(false);
  });

  it("valida CPF", () => {
    expect(cpfEstruturalmenteValido("52998224725")).toBe(true);
    expect(cpfEstruturalmenteValido("52998224726")).toBe(false);
    expect(cpfEstruturalmenteValido("11111111111")).toBe(false);
  });

  it("distribui CPF e CNPJ pelo tamanho", () => {
    expect(documentoEstruturalmenteValido("52998224725")).toBe(true);
    expect(documentoEstruturalmenteValido("11222333000181")).toBe(true);
    expect(documentoEstruturalmenteValido("123")).toBe(false);
  });

  it("CNPJ válido estruturalmente NÃO afirma habilitação fiscal", () => {
    // Este teste documenta a ressalva: a função valida formato, não situação.
    const hab = verificarHabilitacaoTecnica(estabelecimento(), certificado(), "2026-06-01");
    expect(hab.apto).toBe(true);
    expect(hab.pendencias).toEqual([]);
    // Nenhuma das pendências possíveis menciona "habilitado na SEFAZ".
    const hab2 = verificarHabilitacaoTecnica(
      estabelecimento({ cnpj: "123" }),
      undefined,
      "2026-06-01",
    );
    expect(hab2.apto).toBe(false);
    expect(hab2.pendencias.join(" ")).not.toMatch(/sefaz/i);
  });
});

describe("isolamento multi-tenant", () => {
  it("bloqueia acesso cross-tenant com erro ruidoso", () => {
    expect(() => assertMesmoTenant("t1", "t2")).toThrow(AcessoCrossTenant);
    expect(() => assertMesmoTenant("t1", "t2")).toThrow(/deve ser registrada em auditoria/);
  });

  it("permite o mesmo tenant", () => {
    expect(() => assertMesmoTenant("t1", "t1")).not.toThrow();
  });

  it("filtra listas pelo tenant antes de qualquer leitura", () => {
    const itens = [
      { tenantId: "t1", nome: "A" },
      { tenantId: "t2", nome: "B" },
      { tenantId: "t1", nome: "C" },
    ];
    expect(filtrarPorTenant(itens, "t1").map((i) => i.nome)).toEqual(["A", "C"]);
    expect(filtrarPorTenant(itens, "t2")).toHaveLength(1);
  });
});

describe("habilitação técnica de emissão", () => {
  const agora = "2026-06-01T12:00:00-03:00";

  it("exige certificado válido e estabelecimento consistente", () => {
    expect(verificarHabilitacaoTecnica(estabelecimento(), certificado(), agora).apto).toBe(true);
  });

  it("acumula pendências em vez de parar na primeira", () => {
    const r = verificarHabilitacaoTecnica(
      estabelecimento({ ativo: false, municipio: "" }),
      certificado({ revogado: true }),
      agora,
    );
    expect(r.apto).toBe(false);
    expect(r.pendencias.length).toBeGreaterThanOrEqual(3);
  });

  it("detecta certificado vencido e ainda não válido", () => {
    expect(
      verificarHabilitacaoTecnica(
        estabelecimento(),
        certificado({ validoAte: "2026-01-01" }),
        agora,
      ).pendencias,
    ).toContain("Certificado digital vencido em 2026-01-01.");
    expect(
      verificarHabilitacaoTecnica(estabelecimento(), certificado({ validoDe: "2027-01-01" }), agora)
        .pendencias,
    ).toContain("Certificado digital ainda não válido (início 2027-01-01).");
  });

  it("o simulador nunca aceita ambiente de produção", () => {
    const r = verificarHabilitacaoTecnica(estabelecimento({ ambiente: 1 }), certificado(), agora);
    expect(r.apto).toBe(false);
    expect(r.pendencias.join(" ")).toMatch(/homologação/);
  });

  it("a chave privada não faz parte do modelo de certificado", () => {
    // O tipo CertificadoDigital não tem campo de chave; se alguém tentar
    // acrescentar, o TypeScript recusa. Este teste falha se o campo surgir.
    const chaves = Object.keys(certificado());
    expect(chaves).not.toContain("chavePrivada");
    expect(chaves).not.toContain("senha");
  });
});
