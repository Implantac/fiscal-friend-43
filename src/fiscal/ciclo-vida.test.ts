import { describe, expect, it } from "vitest";
import {
  DocumentoImutavel,
  TransicaoInvalida,
  assertEditavel,
  criarDocumento,
  estadoComValorFiscal,
  estadoTerminal,
  exigeAssinatura,
  podeEditar,
  transicionar,
  transicaoPermitida,
  transicoesPermitidas,
  type DocumentoFiscal,
} from "./ciclo-vida";

const base = {
  id: "doc-1",
  tenantId: "t1",
  empresaId: "emp-1",
  estabelecimentoId: "est-1",
  familia: "nfe55" as const,
  modelo: "55",
  serie: "1",
  numero: "1",
  ambiente: 2 as const,
  valorTotalCentavos: 0n,
};

const novo = (): DocumentoFiscal =>
  criarDocumento(
    // A chave de idempotência é obrigatória antes de transmitir — sem ela, uma
    // retentativa poderia gerar um segundo documento.
    { ...base, idempotencia: "idem-doc-1" },
    "2026-06-01T10:00:00-03:00",
  );

/** Leva o documento até `transmitido`, pelo caminho legal completo. */
function atéTransmitido(doc = novo()): DocumentoFiscal {
  const ctx = { usuarioId: "u1", em: "2026-06-01T10:00:00-03:00" };
  let d = transicionar(doc, "pre_validacao", ctx);
  d = transicionar(d, "documento_gerado", ctx);
  d = transicionar(d, "xml_validado", ctx);
  d = transicionar(d, "assinado", ctx);
  return transicionar(d, "transmitido", {
    ...ctx,
    detalhe: "Transmissão registrada",
  });
}

describe("caminho feliz completo", () => {
  it("percorre simulacao → autorizado registrando cada passo", () => {
    const doc = atéTransmitido();
    const autorizado = transicionar(doc, "autorizado", {
      usuarioId: "u1",
      em: "2026-06-01T10:05:00-03:00",
      protocolo: "135260000000001",
      origem: "sefaz",
    });

    expect(autorizado.estado).toBe("autorizado");
    expect(autorizado.protocolo).toBe("135260000000001");
    expect(autorizado.historico).toHaveLength(6);
    expect(autorizado.historico.at(-1)!.para).toBe("autorizado");
    expect(autorizado.historico.at(-1)!.tipo).toBe("resposta_oficial");
    expect(estadoComValorFiscal(autorizado.estado)).toBe(true);
  });

  it("não muta o documento anterior (imutabilidade)", () => {
    const doc = novo();
    const depois = transicionar(doc, "pre_validacao", {
      usuarioId: "u1",
      em: "2026-06-01T10:00:00-03:00",
    });
    expect(doc.estado).toBe("simulacao");
    expect(depois.estado).toBe("pre_validacao");
    expect(doc.historico).toHaveLength(0);
  });

  it("congela cada evento do histórico", () => {
    const doc = transicionar(novo(), "pre_validacao", {
      usuarioId: "u1",
      em: "2026-06-01T10:00:00-03:00",
    });
    const evento = doc.historico[0]!;
    expect(Object.isFrozen(evento)).toBe(true);
    expect(() => {
      (evento as { detalhe: string }).detalhe = "alterado";
    }).toThrow();
  });
});

describe("transições proibidas", () => {
  it("não é possível pular etapas", () => {
    const doc = novo();
    expect(() =>
      transicionar(doc, "autorizado", { usuarioId: "u1", em: "2026-06-01T10:00:00-03:00" }),
    ).toThrow(TransicaoInvalida);
    expect(() =>
      transicionar(doc, "transmitido", { usuarioId: "u1", em: "2026-06-01T10:00:00-03:00" }),
    ).toThrow(TransicaoInvalida);
  });

  it("documento autorizado não volta a documento_gerado", () => {
    const autorizado = transicionar(atéTransmitido(), "autorizado", {
      usuarioId: "u1",
      em: "2026-06-01T10:05:00-03:00",
      protocolo: "135260000000001",
      origem: "sefaz",
    });
    expect(transicaoPermitida("nfe55", "autorizado", "documento_gerado")).toBe(false);
    expect(() =>
      transicionar(autorizado, "documento_gerado", {
        usuarioId: "u1",
        em: "2026-06-01T11:00:00-03:00",
      }),
    ).toThrow(TransicaoInvalida);
  });

  it("documento cancelado é terminal", () => {
    const cancelado = transicionar(
      transicionar(atéTransmitido(), "autorizado", {
        usuarioId: "u1",
        em: "2026-06-01T10:05:00-03:00",
        protocolo: "135260000000001",
        origem: "sefaz",
      }),
      "cancelado_ou_encerrado",
      { usuarioId: "u1", em: "2026-06-02T10:00:00-03:00", detalhe: "Cancelamento aceito" },
    );
    expect(estadoTerminal(cancelado.estado)).toBe(true);
    expect(transicoesPermitidas("nfe55", "cancelado_ou_encerrado")).toEqual([]);
  });

  it("assinado não volta a documento_gerado (não se edita XML assinado)", () => {
    const doc = atéTransmitido();
    expect(transicaoPermitida("nfe55", "assinado", "documento_gerado")).toBe(false);
    expect(() => assertEditavel(doc)).toThrow(DocumentoImutavel);
  });

  it("pendente de consulta não pode virar novo documento", () => {
    // Timeout após envio: a regra é investigar, nunca reemitir.
    const pendente = transicionar(atéTransmitido(), "pendente_consulta", {
      usuarioId: "u1",
      em: "2026-06-01T10:06:00-03:00",
      detalhe: "Timeout após transmissão",
    });
    expect(transicaoPermitida("nfe55", "pendente_consulta", "documento_gerado")).toBe(false);
    expect(transicaoPermitida("nfe55", "pendente_consulta", "autorizado")).toBe(true);
    expect(pendente.estado).toBe("pendente_consulta");
  });

  it("toda família tem a mesma estrutura de ciclo (sem família com buraco)", () => {
    for (const familia of ["nfe55", "nfce65", "nfse", "cte57", "cteos67", "mdfe58"] as const) {
      expect(transicaoPermitida(familia, "transmitido", "autorizado")).toBe(true);
      expect(transicaoPermitida(familia, "transmitido", "rejeitado")).toBe(true);
      expect(transicaoPermitida(familia, "transmitido", "documento_gerado")).toBe(false);
      expect(exigeAssinatura(familia)).toBe(true);
    }
  });
});

describe("integridade dos estados de destino", () => {
  it("não se alcança autorizado sem protocolo", () => {
    expect(() =>
      transicionar(atéTransmitido(), "autorizado", {
        usuarioId: "u1",
        em: "2026-06-01T10:05:00-03:00",
      }),
    ).toThrow(TransicaoInvalida);
  });

  it("não se alcança autorizado com protocolo inventado localmente", () => {
    expect(() =>
      transicionar(atéTransmitido(), "autorizado", {
        usuarioId: "u1",
        em: "2026-06-01T10:05:00-03:00",
        protocolo: "999999",
        origem: "local",
      }),
    ).toThrow(TransicaoInvalida);
  });

  it("não se alcança rejeitado sem cStat", () => {
    expect(() =>
      transicionar(atéTransmitido(), "rejeitado", {
        usuarioId: "u1",
        em: "2026-06-01T10:05:00-03:00",
      }),
    ).toThrow(TransicaoInvalida);
  });

  it("não se transmite sem chave de idempotência", () => {
    const semIdempotencia = criarDocumento(
      { ...base, idempotencia: undefined },
      "2026-06-01T10:00:00-03:00",
    );
    const doc = transicionar(
      transicionar(
        transicionar(
          transicionar(semIdempotencia, "pre_validacao", {
            usuarioId: "u1",
            em: "2026-06-01T10:00:00-03:00",
          }),
          "documento_gerado",
          { usuarioId: "u1", em: "2026-06-01T10:00:00-03:00" },
        ),
        "xml_validado",
        { usuarioId: "u1", em: "2026-06-01T10:00:00-03:00" },
      ),
      "assinado",
      { usuarioId: "u1", em: "2026-06-01T10:00:00-03:00" },
    );
    expect(() =>
      transicionar(doc, "transmitido", { usuarioId: "u1", em: "2026-06-01T10:00:00-03:00" }),
    ).toThrow(TransicaoInvalida);
  });
});

describe("edição", () => {
  it("só é editável antes da validação do XML", () => {
    expect(podeEditar("simulacao")).toBe(true);
    expect(podeEditar("pre_validacao")).toBe(true);
    expect(podeEditar("documento_gerado")).toBe(true);
    expect(podeEditar("xml_validado")).toBe(false);
    expect(podeEditar("assinado")).toBe(false);
    expect(podeEditar("transmitido")).toBe(false);
    expect(podeEditar("autorizado")).toBe(false);
  });

  it("mensagem de imutabilidade aponta o mecanismo legal", () => {
    const doc = atéTransmitido();
    expect(() => assertEditavel(doc)).toThrow(/cancelamento, correção, inutilização, encerramento/);
  });
});
