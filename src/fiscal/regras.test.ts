import { beforeEach, describe, expect, it } from "vitest";
import {
  ErroRegra,
  limparRegistro,
  listarRegras,
  obterRegra,
  registrarRegra,
  regraParaCalculo,
  resumoRegistro,
  utilizavel,
  validarRegra,
  vigenteEm,
  type RegraFiscal,
} from "./regras";

const fonteValida = {
  orgao: "CONFAZ",
  documento: "Ajuste SINIEF",
  dispositivo: "art. 1º",
  versao: "1.00",
  consultadaEm: "2026-10-14",
};

function regraBase(overrides: Partial<RegraFiscal> = {}): RegraFiscal {
  return {
    id: "REGRA-TESTE",
    versao: "1.0.0",
    titulo: "Regra de teste",
    descricao: "Usada apenas nos testes.",
    estado: "rascunho",
    ...overrides,
  };
}

beforeEach(() => {
  limparRegistro();
});

describe("integridade do registro de regras", () => {
  it("registro começa vazio de regras validadas — estado honesto do produto", () => {
    expect(resumoRegistro().validadas).toBe(0);
    expect(resumoRegistro().total).toBe(0);
  });

  it("recusa regra aprovada sem fonte normativa", () => {
    expect(() =>
      registrarRegra(
        regraBase({
          estado: "aprovada_para_uso",
          responsavel: "Fiscal",
          vigenciaInicio: "2026-01-01",
        }),
      ),
    ).toThrow(ErroRegra);
  });

  it("recusa regra aprovada sem caso de teste", () => {
    expect(() =>
      registrarRegra(
        regraBase({
          estado: "aprovada_para_uso",
          fonte: fonteValida,
          responsavel: "Fiscal",
          vigenciaInicio: "2026-01-01",
        }),
      ),
    ).toThrow(/caso de teste/);
  });

  it("recusa regra aprovada sem responsável", () => {
    expect(() =>
      registrarRegra(
        regraBase({
          estado: "aprovada_para_uso",
          fonte: fonteValida,
          vigenciaInicio: "2026-01-01",
          casosTeste: [
            { id: "CT-1", descricao: "d", entrada: {}, saidaEsperada: {}, origem: "fonte_oficial" },
          ],
        }),
      ),
    ).toThrow(/responsável/);
  });

  it("aceita regra aprovada completa", () => {
    const r = registrarRegra(
      regraBase({
        estado: "vigente",
        fonte: fonteValida,
        responsavel: "Especialista fiscal",
        vigenciaInicio: "2026-01-01",
        casosTeste: [
          { id: "CT-1", descricao: "d", entrada: {}, saidaEsperada: {}, origem: "fonte_oficial" },
        ],
      }),
    );
    expect(obterRegra("REGRA-TESTE")).toBe(r);
    expect(utilizavel(r)).toBe(true);
  });

  it("rascunho pode existir sem fonte, mas nunca é usável em cálculo", () => {
    const r = registrarRegra(regraBase());
    expect(utilizavel(r)).toBe(false);
  });

  it("recusa id malformado", () => {
    expect(() => validarRegra(regraBase({ id: "regra com espaços" }))).toThrow(ErroRegra);
  });
});

describe("vigência", () => {
  const r = regraBase({
    estado: "vigente",
    fonte: fonteValida,
    responsavel: "Fiscal",
    vigenciaInicio: "2026-01-01",
    vigenciaFim: "2026-12-31",
    casosTeste: [
      { id: "CT-1", descricao: "d", entrada: {}, saidaEsperada: {}, origem: "fonte_oficial" },
    ],
  });

  it("respeita início e fim de vigência", () => {
    expect(vigenteEm(r, "2025-12-31")).toBe(false);
    expect(vigenteEm(r, "2026-01-01")).toBe(true);
    expect(vigenteEm(r, "2026-12-31")).toBe(true);
    expect(vigenteEm(r, "2027-01-01")).toBe(false);
  });

  it("bloqueia cálculo com regra fora de vigência", () => {
    registrarRegra(r);
    expect(() => regraParaCalculo("REGRA-TESTE", "2025-06-01")).toThrow(/fora de vigência/);
    expect(regraParaCalculo("REGRA-TESTE", "2026-06-01").id).toBe("REGRA-TESTE");
  });

  it("bloqueia cálculo com regra inexistente — nunca aplica regra não catalogada", () => {
    expect(() => regraParaCalculo("REGRA-INVENTADA", "2026-06-01")).toThrow(/não encontrada/);
  });

  it("bloqueia cálculo com regra em rascunho ou revogada", () => {
    registrarRegra(regraBase({ estado: "rascunho" }));
    expect(() => regraParaCalculo("REGRA-TESTE", "2026-06-01")).toThrow(/não pode ser usada/);
    limparRegistro();
    registrarRegra(regraBase({ estado: "revogada", fonte: fonteValida }));
    expect(() => regraParaCalculo("REGRA-TESTE", "2026-06-01")).toThrow(/não pode ser usada/);
  });

  it("filtra por estado", () => {
    registrarRegra(regraBase({ estado: "em_revisao", fonte: fonteValida }));
    expect(listarRegras({ estado: "em_revisao" })).toHaveLength(1);
    expect(listarRegras({ estado: "vigente" })).toHaveLength(0);
  });
});
