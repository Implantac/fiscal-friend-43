import { describe, expect, it } from "vitest";
import { AuditoriaMemoria, sanitizarParaAuditoria, type AcaoAuditoria } from "./auditoria";
import {
  ConflitoConcorrencia,
  DocumentoNaoEncontrado,
  UnidadeTrabalhoMemoria,
  criarUnidadeTrabalho,
} from "./persistencia";
import { ServicoNumeracaoMemoria } from "./numeracao";
import { criarDocumento, transicionar, type DocumentoFiscal } from "./ciclo-vida";

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

function novoDoc(id = "doc-1", tenantId = "t1"): DocumentoFiscal {
  return criarDocumento({ ...base, id, tenantId }, "2026-06-01T10:00:00-03:00");
}

function criarUow() {
  return criarUnidadeTrabalho(new ServicoNumeracaoMemoria(), new AuditoriaMemoria());
}

describe("unidade de trabalho", () => {
  it("commit aplica as escritas; rollback descarta", async () => {
    const uow = criarUow();
    await uow.documentos.salvar(novoDoc());
    await uow.rollback();
    expect(await uow.documentos.obterPorId("t1", "doc-1")).toBeUndefined();

    await uow.documentos.salvar(novoDoc());
    await uow.commit();
    expect(await uow.documentos.obterPorId("t1", "doc-1")).toBeDefined();
  });

  it("leitura dentro da transação vê a própria escrita (read-your-writes)", async () => {
    const uow = criarUow();
    await uow.documentos.salvar(novoDoc());
    expect(await uow.documentos.obterPorId("t1", "doc-1")).toBeDefined();
  });

  it("isolamento por tenant na consulta — outro tenant não vê nem a existência", async () => {
    const uow = criarUow();
    await uow.documentos.salvar(novoDoc("doc-1", "t1"));
    await uow.documentos.salvar(novoDoc("doc-2", "t2"));
    await uow.commit();

    expect(await uow.documentos.obterPorId("t1", "doc-2")).toBeUndefined();
    expect(await uow.documentos.listar("t1")).toHaveLength(1);
    expect(await uow.documentos.listar("t2")).toHaveLength(1);
  });

  it("busca por idempotência respeita o tenant", async () => {
    const uow = criarUow();
    const doc = { ...novoDoc(), idempotencia: "idem-abc" };
    await uow.documentos.salvar(doc);
    await uow.commit();
    expect((await uow.documentos.obterPorIdempotencia("t1", "idem-abc"))?.id).toBe("doc-1");
    expect(await uow.documentos.obterPorIdempotencia("t2", "idem-abc")).toBeUndefined();
  });

  it("filtra por estado e estabelecimento", async () => {
    const uow = criarUow();
    const doc = transicionar(novoDoc(), "pre_validacao", {
      usuarioId: "u1",
      em: "2026-06-01T10:00:00-03:00",
    });
    await uow.documentos.salvar(doc);
    await uow.documentos.salvar(novoDoc("doc-2"));
    await uow.commit();

    expect(await uow.documentos.listar("t1", { estado: "pre_validacao" })).toHaveLength(1);
    expect(await uow.documentos.listar("t1", { estado: "simulacao" })).toHaveLength(1);
    expect(await uow.documentos.listar("t1", { estabelecimentoId: "est-1" })).toHaveLength(2);
    expect(await uow.documentos.listar("t1", { estabelecimentoId: "outro" })).toHaveLength(0);
  });

  it("detecta conflito de concorrência em vez de sobrescrever", async () => {
    const uow = new UnidadeTrabalhoMemoria(new ServicoNumeracaoMemoria(), new AuditoriaMemoria());
    const original = novoDoc();
    await uow.documentos.salvar(original);
    await uow.commit();

    // Outra operação altera o registro depois da nossa leitura.
    const alteradoPorOutro = transicionar(original, "pre_validacao", {
      usuarioId: "u2",
      em: "2026-06-01T11:00:00-03:00",
    });
    await uow.documentos.salvar(alteradoPorOutro);
    await uow.commit();

    // Nossa escrita, baseada na leitura antiga, precisa ser recusada.
    const nossaEscrita = transicionar(original, "pre_validacao", {
      usuarioId: "u1",
      em: "2026-06-01T10:30:00-03:00",
    });
    await expect(uow.documentos.salvar(nossaEscrita)).rejects.toThrow(ConflitoConcorrencia);
  });

  it("erro de não encontrado é explícito e não vaza existência cross-tenant", async () => {
    const uow = criarUow();
    await uow.documentos.salvar(novoDoc("doc-1", "t2"));
    await uow.commit();
    const doc = await uow.documentos.obterPorId("t1", "doc-1");
    expect(doc).toBeUndefined();
    const erro = new DocumentoNaoEncontrado("t1", "doc-1");
    expect(erro.message).toMatch(/acesso é negado e auditado/);
  });
});

describe("trilha de auditoria", () => {
  it("registra e filtra por tenant", async () => {
    const aud = new AuditoriaMemoria();
    await aud.registrar({
      em: "2026-06-01T10:00:00-03:00",
      tenantId: "t1",
      usuarioId: "u1",
      papel: "operador",
      acao: "documento.criado" as AcaoAuditoria,
      entidade: "documento",
      entidadeId: "doc-1",
      resumo: "Documento criado",
      origem: "usuario",
    });
    await aud.registrar({
      em: "2026-06-01T10:01:00-03:00",
      tenantId: "t2",
      usuarioId: "u9",
      papel: "operador",
      acao: "documento.criado" as AcaoAuditoria,
      entidade: "documento",
      entidadeId: "doc-9",
      resumo: "Documento de outro tenant",
      origem: "usuario",
    });

    expect(await aud.listar({ tenantId: "t1" })).toHaveLength(1);
    expect(await aud.listar({ tenantId: "t2" })).toHaveLength(1);
  });

  it("registro é imutável depois de criado", async () => {
    const aud = new AuditoriaMemoria();
    const r = await aud.registrar({
      em: "2026-06-01T10:00:00-03:00",
      tenantId: "t1",
      usuarioId: "u1",
      papel: "operador",
      acao: "documento.transmitido" as AcaoAuditoria,
      entidade: "documento",
      entidadeId: "doc-1",
      resumo: "Transmitido",
      origem: "sistema",
    });
    expect(Object.isFrozen(r)).toBe(true);
    expect(() => {
      (r as { resumo: string }).resumo = "alterado";
    }).toThrow();
    // A lista continua íntegra após a tentativa.
    expect((await aud.listar({ tenantId: "t1" }))[0]!.resumo).toBe("Transmitido");
  });

  it("filtra por ação, entidade e período", async () => {
    const aud = new AuditoriaMemoria();
    await aud.registrar({
      em: "2026-06-01T10:00:00-03:00",
      tenantId: "t1",
      usuarioId: "u1",
      papel: "operador",
      acao: "documento.transmitido" as AcaoAuditoria,
      entidade: "documento",
      entidadeId: "doc-1",
      resumo: "Transmitido",
      origem: "sistema",
    });
    await aud.registrar({
      em: "2026-06-02T10:00:00-03:00",
      tenantId: "t1",
      usuarioId: "u1",
      papel: "operador",
      acao: "documento.autorizado" as AcaoAuditoria,
      entidade: "documento",
      entidadeId: "doc-1",
      resumo: "Autorizado",
      origem: "integracao",
    });

    expect(await aud.listar({ tenantId: "t1", acao: "documento.autorizado" })).toHaveLength(1);
    expect(await aud.listar({ tenantId: "t1", de: "2026-06-02T00:00:00-03:00" })).toHaveLength(1);
    expect(await aud.listar({ tenantId: "t1", ate: "2026-06-01T23:59:59-03:00" })).toHaveLength(1);
    expect(
      await aud.listar({ tenantId: "t1", entidade: "documento", entidadeId: "doc-1" }),
    ).toHaveLength(2);
  });
});

describe("sanitização para auditoria", () => {
  it("redige credenciais antes de registrar", () => {
    expect(sanitizarParaAuditoria("token: abc123")).toBe("[REDIGIDO]");
    expect(sanitizarParaAuditoria("senha=minhasenha")).toBe("[REDIGIDO]");
    expect(sanitizarParaAuditoria("api_key: xyz")).toBe("[REDIGIDO]");
    expect(
      sanitizarParaAuditoria("-----BEGIN PRIVATE KEY-----\nABC\n-----END PRIVATE KEY-----"),
    ).toBe("[REDIGIDO]");
    expect(sanitizarParaAuditoria("CPF 529.982.247-25 do operador")).toBe(
      "CPF [CPF REDIGIDO] do operador",
    );
  });

  it("preserva texto legítimo", () => {
    expect(sanitizarParaAuditoria("Documento NF-e 55 transmitido com sucesso")).toContain(
      "transmitido",
    );
  });
});
