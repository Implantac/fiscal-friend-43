/**
 * TESTES DO SERVIÇO DE DOCUMENTOS FISCAIS.
 *
 * Sem HTTP, sem framework, sem banco: o serviço recebe uma unidade de trabalho
 * falsa. O que está sendo testado são as **regras**, que é onde o dano fiscal
 * acontece:
 *
 *   1. nenhum documento é criado sem chave de idempotência;
 *   2. a mesma chave devolve o mesmo documento — nunca um número novo;
 *   3. `autorizado` (e todo estado que dependa de resposta oficial) é
 *      **inalcançável** por este serviço, com motivo explícito;
 *   4. papel sem permissão é barrado antes de tocar no banco;
 *   5. documento de outro tenant devolve "não encontrado", não "sem permissão";
 *   6. toda operação deixa rastro de auditoria.
 */

import { describe, expect, it } from "vitest";
import {
  ErroDocumento,
  criarDocumentoFiscal,
  listarDocumentosFiscais,
  obterDocumentoFiscal,
  transicionarDocumentoFiscal,
  transicoesDisponiveis,
  type EmUnidadeDeTrabalho,
  type EntradaDocumento,
  type UnidadeDocumento,
} from "./documento";
import type { ContextoUsuario } from "@/fiscal/seguranca";
import type { DocumentoFiscal } from "@/fiscal/ciclo-vida";
import { criarDocumento } from "@/fiscal/ciclo-vida";
import { AuditoriaMemoria, type AcaoAuditoria, type RegistroAuditoria } from "@/fiscal/auditoria";
import { ServicoNumeracaoMemoria } from "@/fiscal/numeracao";
import { UnidadeTrabalhoMemoria } from "@/fiscal/persistencia";

/* ------------------------------------------------------------------- fakes */

/** Unidade de trabalho real, em memória — a mesma usada em desenvolvimento. */
function uowMemoria(): {
  unidade: UnidadeDocumento;
  uow: UnidadeTrabalhoMemoria;
  auditoria: AuditoriaMemoria;
} {
  const auditoria = new AuditoriaMemoria();
  const uow = new UnidadeTrabalhoMemoria(new ServicoNumeracaoMemoria(), auditoria);
  return { unidade: uow, uow, auditoria };
}

/**
 * Implementação de `EmUnidadeDeTrabalho` sobre a unidade em memória, com
 * commit e rollback de verdade — não um atalho que ignora a transação. Se o
 * serviço lança no meio, o rollback tem de descartar tudo; um atalho que
 * apenas chamasse `fn(uow` esconderia exatamente essa garantia.
 */
function emUnidadeMemoria(uow: UnidadeTrabalhoMemoria): EmUnidadeDeTrabalho {
  return async (tenantId, fn) => {
    void tenantId; // a unidade em memória é única; o tenant vai nas consultas
    try {
      const resultado = await fn(uow);
      await uow.commit();
      return resultado;
    } catch (erro) {
      await uow.rollback();
      throw erro;
    }
  };
}

const CTX_ADMIN: ContextoUsuario = {
  usuarioId: "usr-admin",
  tenantId: "tenant-a",
  papel: "administrador",
};

const CTX_AUDITOR: ContextoUsuario = {
  usuarioId: "usr-auditor",
  tenantId: "tenant-a",
  papel: "auditor",
};

const CTX_OUTRO_TENANT: ContextoUsuario = {
  usuarioId: "usr-outro",
  tenantId: "tenant-b",
  papel: "administrador",
};

function entrada(over: Partial<EntradaDocumento> = {}): EntradaDocumento {
  return {
    id: "doc-1",
    empresaId: "emp-1",
    estabelecimentoId: "est-1",
    familia: "nfe55",
    serie: "1",
    ambiente: 2,
    valorTotalCentavos: 12345n,
    idempotencia: "idem-1",
    ...over,
  };
}

/* ------------------------------------------------------------------ testes */

describe("criarDocumentoFiscal", () => {
  it("cria no estado simulacao, com número reservado e sem valor fiscal", async () => {
    const { unidade } = uowMemoria();
    const { documento, duplicado } = await criarDocumentoFiscal(
      emUnidadeMemoria(unidade as unknown as UnidadeTrabalhoMemoria),
      CTX_ADMIN,
      entrada(),
    );

    expect(duplicado).toBe(false);
    expect(documento.estado).toBe("simulacao");
    expect(documento.numero).toBe("1");
    expect(documento.modelo).toBe("55");
    expect(documento.valorTotalCentavos).toBe(12345n);
    // Nenhum estado de valor fiscal é atribuído na criação.
    expect(documento.protocolo).toBeUndefined();
    expect(documento.chave).toBeUndefined();
  });

  it("exige chave de idempotência", async () => {
    const { unidade } = uowMemoria();
    await expect(
      criarDocumentoFiscal(
        emUnidadeMemoria(unidade as unknown as UnidadeTrabalhoMemoria),
        CTX_ADMIN,
        entrada({ idempotencia: "   " }),
      ),
    ).rejects.toThrow(/idempotência/i);
  });

  it("recusa valor negativo antes de tocar no banco", async () => {
    const { unidade } = uowMemoria();
    await expect(
      criarDocumentoFiscal(
        emUnidadeMemoria(unidade as unknown as UnidadeTrabalhoMemoria),
        CTX_ADMIN,
        entrada({ valorTotalCentavos: -1n }),
      ),
    ).rejects.toThrow(ErroDocumento);
  });

  it("a mesma chave de idempotência devolve o MESMO documento, sem consumir número", async () => {
    const { unidade, uow } = uowMemoria();
    const em = emUnidadeMemoria(uow);

    const primeiro = await criarDocumentoFiscal(em, CTX_ADMIN, entrada());
    const segundo = await criarDocumentoFiscal(em, CTX_ADMIN, entrada());

    expect(segundo.duplicado).toBe(true);
    expect(segundo.documento.id).toBe(primeiro.documento.id);
    expect(segundo.documento.numero).toBe(primeiro.documento.numero);

    // A sequência não avançou: nenhum número foi queimado na retentativa.
    expect(
      await uow.numeracao.atual({
        tenantId: "tenant-a",
        estabelecimentoId: "est-1",
        modelo: "55",
        serie: "1",
      }),
    ).toBe(1);
  });

  it("nfs-e exige modelo explícito — a família não determina", async () => {
    const { unidade } = uowMemoria();
    await expect(
      criarDocumentoFiscal(
        emUnidadeMemoria(unidade as unknown as UnidadeTrabalhoMemoria),
        CTX_ADMIN,
        entrada({ familia: "nfse" }),
      ),
    ).rejects.toThrow(/modelo/i);

    // Informado explicitamente, passa.
    const { documento } = await criarDocumentoFiscal(
      emUnidadeMemoria(unidade as unknown as UnidadeTrabalhoMemoria),
      CTX_ADMIN,
      entrada({ familia: "nfse", modelo: "NFS-e" }),
    );
    expect(documento.modelo).toBe("NFS-e");
  });

  it("papel sem permissão de criar é barrado", async () => {
    const { unidade } = uowMemoria();
    await expect(
      criarDocumentoFiscal(
        emUnidadeMemoria(unidade as unknown as UnidadeTrabalhoMemoria),
        CTX_AUDITOR,
        entrada(),
      ),
    ).rejects.toThrow(/Permissão "documento.criar" negada/);
  });

  it("numera sequencialmente por série, sem colisão", async () => {
    const { unidade, uow } = uowMemoria();
    const em = emUnidadeMemoria(uow);
    const a = await criarDocumentoFiscal(em, CTX_ADMIN, entrada({ idempotencia: "i1" }));
    const b = await criarDocumentoFiscal(em, CTX_ADMIN, entrada({ idempotencia: "i2" }));
    const c = await criarDocumentoFiscal(
      em,
      CTX_ADMIN,
      entrada({ idempotencia: "i3", serie: "2" }),
    );
    expect([a.documento.numero, b.documento.numero, c.documento.numero]).toEqual(["1", "2", "1"]);
  });

  it("registra auditoria da numeração e da criação", async () => {
    const { unidade, uow, auditoria } = uowMemoria();
    await criarDocumentoFiscal(emUnidadeMemoria(uow), CTX_ADMIN, entrada());

    const acoes = (await auditoria.listar({ tenantId: "tenant-a" })).map((r) => r.acao);
    expect(acoes).toContain<AcaoAuditoria>("numeracao.reservada");
    expect(acoes).toContain<AcaoAuditoria>("documento.criado");

    // O resumo da criação diz explicitamente que o documento não tem valor
    // fiscal — a trilha não pode dar a entender o contrário.
    const criado = (await auditoria.listar({ tenantId: "tenant-a" })).find(
      (r: RegistroAuditoria) => r.acao === "documento.criado",
    );
    expect(criado?.resumo).toMatch(/sem valor fiscal/i);
  });
});

describe("listarDocumentosFiscais / obterDocumentoFiscal", () => {
  it("lista apenas documentos do tenant do contexto", async () => {
    const { unidade, uow } = uowMemoria();
    const em = emUnidadeMemoria(uow);
    await criarDocumentoFiscal(em, CTX_ADMIN, entrada({ idempotencia: "i1" }));
    await criarDocumentoFiscal(em, CTX_OUTRO_TENANT, entrada({ idempotencia: "i2", id: "doc-2" }));

    const doA = await listarDocumentosFiscais(em, CTX_ADMIN);
    const doB = await listarDocumentosFiscais(em, CTX_OUTRO_TENANT);
    expect(doA.map((d) => d.id)).toEqual(["doc-1"]);
    expect(doB.map((d) => d.id)).toEqual(["doc-2"]);
  });

  it("documento de outro tenant não é encontrado — e não é 'sem permissão'", async () => {
    const { unidade, uow } = uowMemoria();
    const em = emUnidadeMemoria(uow);
    await criarDocumentoFiscal(em, CTX_ADMIN, entrada());

    expect(await obterDocumentoFiscal(em, CTX_OUTRO_TENANT, "doc-1")).toBeUndefined();
  });
});

describe("transicionarDocumentoFiscal", () => {
  async function comDocumento() {
    const { unidade, uow, auditoria } = uowMemoria();
    const em = emUnidadeMemoria(uow);
    await criarDocumentoFiscal(em, CTX_ADMIN, entrada());
    return { em, uow, auditoria, unidade };
  }

  it("avança simulacao -> pre_validacao", async () => {
    const { em, uow } = await comDocumento();
    const doc = await transicionarDocumentoFiscal(em, CTX_ADMIN, "doc-1", "pre_validacao");
    expect(doc.estado).toBe("pre_validacao");
    expect(doc.historico).toHaveLength(1);
    expect((await uow.documentos.obterPorId("tenant-a", "doc-1"))!.estado).toBe("pre_validacao");
  });

  it("RECUSA mover para autorizado, com motivo explícito", async () => {
    const { em } = await comDocumento();
    await expect(transicionarDocumentoFiscal(em, CTX_ADMIN, "doc-1", "autorizado")).rejects.toThrow(
      /somente uma resposta oficial/i,
    );
  });

  it("recusa transmitido, rejeitado, assinado, xml_validado e cancelado", async () => {
    const { em } = await comDocumento();
    for (const destino of [
      "transmitido",
      "rejeitado",
      "assinado",
      "xml_validado",
      "cancelado_ou_encerrado",
      "pendente_consulta",
      "indisponivel_ou_contingencia",
      "documento_gerado",
    ] as const) {
      await expect(transicionarDocumentoFiscal(em, CTX_ADMIN, "doc-1", destino)).rejects.toThrow(
        ErroDocumento,
      );
    }
  });

  it("a recusa acontece ANTES de qualquer consulta ao banco", async () => {
    const { unidade, uow } = await comDocumento();
    let consultas = 0;
    const emEspiao: EmUnidadeDeTrabalho = async (tenantId, fn) => {
      const original = uow.documentos.obterPorId;
      (uow.documentos as { obterPorId: typeof original }).obterPorId = async (...a) => {
        consultas += 1;
        return original(...a);
      };
      return fn(unidade);
      void tenantId;
    };
    await expect(
      transicionarDocumentoFiscal(emEspiao, CTX_ADMIN, "doc-1", "autorizado"),
    ).rejects.toThrow();
    expect(consultas).toBe(0);
  });

  it("transição fora da tabela do domínio é recusada pelo domínio", async () => {
    const { em } = await comDocumento();
    // pre_validacao -> pre_validacao não existe na tabela de transições.
    await expect(transicionarDocumentoFiscal(em, CTX_ADMIN, "doc-1", "simulacao")).rejects.toThrow(
      /Transição inválida/,
    );
  });

  it("auditor não pode criar documento, mas pode consultar", async () => {
    const { em } = await comDocumento();
    // consulta passa
    expect(await listarDocumentosFiscais(em, CTX_AUDITOR)).toHaveLength(1);
    // transição (exige documento.criar) é barrada
    await expect(
      transicionarDocumentoFiscal(em, CTX_AUDITOR, "doc-1", "pre_validacao"),
    ).rejects.toThrow(/Permissão "documento.criar" negada/);
  });

  it("transição em documento inexistente audita acesso.negado e não revela existência", async () => {
    const { em, auditoria } = await comDocumento();
    await expect(
      transicionarDocumentoFiscal(em, CTX_ADMIN, "doc-inexistente", "pre_validacao"),
    ).rejects.toThrow(/não encontrado/i);

    const negados = (await auditoria.listar({ tenantId: "tenant-a" })).filter(
      (r) => r.acao === "acesso.negado",
    );
    expect(negados).toHaveLength(1);
    // O resumo não diz "existe em outro tenant".
    expect(negados[0]!.resumo).toMatch(/não encontrado para este tenant/i);
  });

  it("registra auditoria da transição com antes e depois", async () => {
    const { em, auditoria } = await comDocumento();
    await transicionarDocumentoFiscal(em, CTX_ADMIN, "doc-1", "pre_validacao");
    const reg = (await auditoria.listar({ tenantId: "tenant-a" })).find(
      (r) => r.acao === "documento.transicionado",
    );
    expect(reg?.antes).toBe("simulacao");
    expect(reg?.depois).toBe("pre_validacao");
  });
});

describe("transicoesDisponiveis", () => {
  it("separa o que é alcançável do que está bloqueado, com motivo", () => {
    const base = {
      id: "d",
      tenantId: "t",
      empresaId: "e",
      estabelecimentoId: "x",
      familia: "nfe55" as const,
      modelo: "55",
      serie: "1",
      numero: "1",
      ambiente: 2 as const,
      valorTotalCentavos: 0n,
    };
    const em = "2026-10-14T10:00:00-03:00";

    // De `simulacao` só se vai a `pre_validacao`, e essa transição é permitida.
    const deSimulacao = transicoesDisponiveis(criarDocumento(base, em));
    expect(deSimulacao.permitidas).toEqual(["pre_validacao"]);
    expect(deSimulacao.bloqueadas).toEqual([]);

    // De `pre_validacao` a tabela do domínio permite dois destinos; o serviço
    // entrega um e explica o outro.
    const pre = transicoesDisponiveis(criarDocumento(base, em));
    void pre;

    const emPreValidacao = transicoesDisponiveis({
      ...criarDocumento(base, em),
      estado: "pre_validacao",
    });
    expect(emPreValidacao.permitidas).toEqual(["simulacao"]);
    expect(emPreValidacao.bloqueadas.map((x) => x.estado)).toEqual(["documento_gerado"]);
    expect(emPreValidacao.bloqueadas[0]!.motivo).toMatch(/XML fiscal ainda não implementada/i);
  });
});
