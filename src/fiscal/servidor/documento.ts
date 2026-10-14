/**
 * SERVIÇO DE DOCUMENTOS FISCAIS — ciclo de vida atrás de autenticação.
 *
 * ============================================================================
 * O QUE ESTE MÓDULO É
 * ============================================================================
 * A ponte entre o usuário autenticado e o domínio fiscal. Ele orquestra:
 *   - criação de documento, com numeração reservada atomicamente e chave de
 *     idempotência obrigatória;
 *   - consulta isolada por tenant;
 *   - transição de estado, **apenas** para estados que o sistema consegue
 *     produzir sozinho.
 *
 * Não conhece HTTP, cookie, cookie de sessão nem framework: recebe o
 * `ContextoUsuario` já resolvido e uma unidade de trabalho já escolhida. Isso é
 * o que permite testar todas as regras de autorização sem subir um servidor.
 *
 * ============================================================================
 * A REGRA MAIS IMPORTANTE DESTE ARQUIVO
 * ============================================================================
 * `autorizado` **não** é alcançável por aqui. Nem `transmitido`, `rejeitado`,
 * `pendente_consulta`, `cancelado_ou_encerrado` ou `indisponivel_ou_contingencia`.
 *
 * Esses estados só existem depois de uma resposta oficial do SEFAZ ou de um
 * provedor, e nenhuma integração dessas foi implementada ainda. Oferecer o
 * botão seria convidar o operador a marcar, com as próprias mãos, um documento
 * como autorizado sem que nenhum fisco tenha dito isso — exatamente a fraude
 * que este produto existe para não permitir.
 *
 * Por isso a lista de transições permitidas é uma tabela com o **motivo** de
 * cada indisponibilidade, e o motivo aparece na mensagem de erro. "Erro
 * desconhecido" e "operação não suportada" escondem o estado real do sistema;
 * "validação contra XSD ainda não implementada" não esconde.
 *
 * ============================================================================
 * IDEMPOTÊNCIA
 * ============================================================================
 * Criar documento com uma chave já usada devolve o documento **existente**, com
 * `duplicado: true`. Nunca reserva número novo. O cenário que isso evita: o
 * operador clica duas vezes em "salvar", ou a rede cai depois do commit e o
 * navegador repete o POST — e o contribuinte descobre que emitiu a mesma nota
 * duas vezes com números diferentes.
 *
 * ============================================================================
 * ISOLAMENTO
 * ============================================================================
 * Toda leitura filtra por tenant. Documento de outro tenant devolve
 * "não encontrado" — não "sem permissão" — porque confirmar a existência já é
 * vazamento de informação. A tentativa é auditada como `acesso.negado`.
 */

import type { ContextoUsuario } from "@/fiscal/seguranca";
import { assertAutorizado, type Permissao } from "@/fiscal/seguranca";
import {
  criarDocumento,
  modeloDaFamilia,
  transicoesPermitidas,
  transicionar,
  type DocumentoFiscal,
  type EstadoDocumento,
  type FamiliaDocumental,
  type OrigemEvento,
} from "@/fiscal/ciclo-vida";
import { DocumentoNaoEncontrado } from "@/fiscal/persistencia";
import type { FiltroDocumentos, RepositorioDocumentos } from "@/fiscal/persistencia";
import type { AuditoriaPort } from "@/fiscal/auditoria";
import type { ServicoNumeracao } from "@/fiscal/numeracao";

/* ------------------------------------------------------------- dependências */

/** As três portas do domínio, agrupadas. */
export interface UnidadeDocumento {
  readonly documentos: RepositorioDocumentos;
  readonly numeracao: ServicoNumeracao;
  readonly auditoria: AuditoriaPort;
}

/**
 * Executa `fn` dentro de uma unidade de trabalho do tenant informado.
 *
 * A implementação decide o que "unidade de trabalho" significa: no Postgres é
 * uma transação com `set_config('app.tenant_id', …)`; em memória, a área de
 * staging com commit/rollback de `persistencia.ts`. O serviço não sabe qual
 * das duas está em uso — e é exatamente isso que o torna testável.
 */
export type EmUnidadeDeTrabalho = <T>(
  tenantId: string,
  fn: (unidade: UnidadeDocumento) => Promise<T>,
) => Promise<T>;

/* -------------------------------------------------------------------- entrada */

export interface EntradaDocumento {
  /** Identificador do documento. Gerado pelo chamador (UUID). */
  id: string;
  empresaId: string;
  estabelecimentoId: string;
  familia: FamiliaDocumental;
  /** Modelo explícito. Obrigatório para `nfse`; nos demais casos é derivado. */
  modelo?: string | undefined;
  serie: string;
  /** 1 = produção, 2 = homologação. */
  ambiente: 1 | 2;
  /** Total em centavos de Real, inteiro exato (`bigint`). */
  valorTotalCentavos: bigint;
  /**
   * Chave de idempotência. Obrigatória: sem ela, uma retentativa pode gerar
   * documento duplicado.
   */
  idempotencia: string;
}

export interface ResultadoCriacao {
  documento: DocumentoFiscal;
  /** `true` quando a chave de idempotência já existia — nenhum número novo foi reservado. */
  duplicado: boolean;
}

/* --------------------------------------------------- estados alcançáveis aqui */

/**
 * Transições que o sistema pode executar sozinho, com o motivo pelo qual cada
 * uma das outras está indisponível.
 *
 * A mensagem é parte do contrato: ela é o que o operador lê quando tenta
 * apertar um botão que ainda não corresponde a nada real.
 */
const MOTIVO_INDISPONIVEL: Partial<Record<EstadoDocumento, string>> = {
  documento_gerado:
    "geração de XML fiscal ainda não implementada — o documento não tem leiaute para gerar.",
  xml_validado:
    "validação contra o XSD oficial ainda não implementada; sem ela, 'validado' seria opinião, não verificação.",
  assinado:
    "assinatura digital com certificado A1/A3 ainda não implementada; sem ela o documento não tem valor jurídico.",
  transmitido: "transmissão ao serviço fiscal (SEFAZ ou provedor) ainda não implementada.",
  autorizado:
    "somente uma resposta oficial do SEFAZ ou do provedor pode autorizar um documento. Não existe caminho local para este estado.",
  rejeitado: "somente uma resposta oficial do SEFAZ ou do provedor pode rejeitar um documento.",
  pendente_consulta:
    "estado de resultado indeterminado após transmissão; depende de uma transmissão que ainda não existe.",
  indisponivel_ou_contingencia:
    "contingência é um regime autorizado pelo fisco, com regras por UF; não implementado.",
  cancelado_ou_encerrado:
    "cancelamento e encerramento exigem evento fiscal autorizado; não implementado.",
};

/** Permissão exigida por estado de destino. */
function permissaoParaDestino(para: EstadoDocumento): Permissao {
  if (para === "transmitido") return "documento.transmitir";
  if (para === "cancelado_ou_encerrado") return "documento.cancelar";
  return "documento.criar";
}

/** Erro de regra de negócio com mensagem que não esconde o motivo. */
export class ErroDocumento extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = "ErroDocumento";
  }
}

function validarEntrada(entrada: EntradaDocumento): void {
  if (entrada.valorTotalCentavos < 0n) {
    throw new ErroDocumento(
      "Valor total não pode ser negativo. Estorno e cancelamento são documentos ou eventos próprios, não sinal invertido no total.",
    );
  }
  if (!entrada.idempotencia || entrada.idempotencia.trim() === "") {
    throw new ErroDocumento(
      "Chave de idempotência é obrigatória. Sem ela, uma retentativa pode gerar documento duplicado.",
    );
  }
  if (!entrada.id || entrada.id.trim() === "") {
    throw new ErroDocumento("Identificador do documento é obrigatório.");
  }
  if (!entrada.serie || entrada.serie.trim() === "") {
    throw new ErroDocumento("Série é obrigatória para reservar numeração.");
  }
}

/* ------------------------------------------------------------------ operações */

/**
 * Cria um documento no estado `simulacao`, com número já reservado.
 *
 * Ordem deliberada: **idempotência antes de numeração**. Se a chave já existe,
 * devolve-se o documento anterior e nenhum número é consumido. Consumir número
 * e só depois descobrir a duplicata deixaria um buraco na sequência — e buraco
 * em sequência fiscal é problema declarado ao Fisco.
 */
export async function criarDocumentoFiscal(
  emUnidade: EmUnidadeDeTrabalho,
  ctx: ContextoUsuario,
  entrada: EntradaDocumento,
): Promise<ResultadoCriacao> {
  assertAutorizado(ctx, "documento.criar");
  validarEntrada(entrada);

  return emUnidade(ctx.tenantId, async (u) => {
    const existente = await u.documentos.obterPorIdempotencia(ctx.tenantId, entrada.idempotencia);
    if (existente) {
      return { documento: existente, duplicado: true };
    }

    const modelo = entrada.modelo ?? modeloDaFamilia(entrada.familia);
    if (!modelo) {
      throw new ErroDocumento(
        `A família "${entrada.familia}" não determina o modelo do documento (NFS-e varia por município). Informe o modelo explicitamente.`,
      );
    }

    const reserva = await u.numeracao.reservar(
      {
        tenantId: ctx.tenantId,
        estabelecimentoId: entrada.estabelecimentoId,
        modelo,
        serie: entrada.serie,
      },
      entrada.idempotencia,
    );

    const agora = new Date().toISOString();
    const documento = criarDocumento(
      {
        id: entrada.id,
        tenantId: ctx.tenantId,
        empresaId: entrada.empresaId,
        estabelecimentoId: entrada.estabelecimentoId,
        familia: entrada.familia,
        modelo,
        serie: entrada.serie,
        numero: reserva.numero,
        ambiente: entrada.ambiente,
        valorTotalCentavos: entrada.valorTotalCentavos,
        idempotencia: entrada.idempotencia,
      },
      agora,
    );

    await u.documentos.salvar(documento);

    await u.auditoria.registrar({
      em: agora,
      tenantId: ctx.tenantId,
      usuarioId: ctx.usuarioId,
      papel: ctx.papel,
      acao: "numeracao.reservada",
      entidade: "numeracao",
      entidadeId: `${entrada.estabelecimentoId}/${modelo}/${entrada.serie}`,
      resumo: `Número ${reserva.numero} reservado para ${entrada.familia} série ${entrada.serie}.`,
      origem: "usuario",
      sessao: ctx.usuarioId,
    });

    await u.auditoria.registrar({
      em: agora,
      tenantId: ctx.tenantId,
      usuarioId: ctx.usuarioId,
      papel: ctx.papel,
      acao: "documento.criado",
      entidade: "documento",
      entidadeId: documento.id,
      resumo:
        `Documento ${entrada.familia} ${modelo}/${entrada.serie}/${reserva.numero} criado em ` +
        `"simulacao" — sem valor fiscal, sem transmissão e sem autorização.`,
      depois: documento.estado,
      origem: "usuario",
      sessao: ctx.usuarioId,
    });

    return { documento, duplicado: false };
  });
}

/** Lista documentos do tenant. Nunca de outro tenant. */
export async function listarDocumentosFiscais(
  emUnidade: EmUnidadeDeTrabalho,
  ctx: ContextoUsuario,
  filtro: FiltroDocumentos = {},
): Promise<DocumentoFiscal[]> {
  assertAutorizado(ctx, "documento.consultar");
  return emUnidade(ctx.tenantId, (u) => u.documentos.listar(ctx.tenantId, filtro));
}

/** Busca um documento do tenant. `undefined` se não existir ou for de outro tenant. */
export async function obterDocumentoFiscal(
  emUnidade: EmUnidadeDeTrabalho,
  ctx: ContextoUsuario,
  id: string,
): Promise<DocumentoFiscal | undefined> {
  assertAutorizado(ctx, "documento.consultar");
  return emUnidade(ctx.tenantId, (u) => u.documentos.obterPorId(ctx.tenantId, id));
}

/**
 * Avança o documento de estado.
 *
 * Recusa, com motivo explícito, qualquer destino que exija integração externa
 * ainda inexistente (ver `MOTIVO_INDISPONIVEL`). O domínio
 * (`transicionar`) continua sendo a autoridade final sobre a tabela de
 * transições — este serviço só reduz o que a interface pode pedir.
 */
export async function transicionarDocumentoFiscal(
  emUnidade: EmUnidadeDeTrabalho,
  ctx: ContextoUsuario,
  id: string,
  para: EstadoDocumento,
  extra: { detalhe?: string | undefined; origem?: OrigemEvento | undefined } = {},
): Promise<DocumentoFiscal> {
  const motivo = MOTIVO_INDISPONIVEL[para];
  if (motivo) {
    throw new ErroDocumento(
      `Não é possível mover um documento para "${para}": ${motivo} ` +
        `A operação foi recusada antes de tocar no banco.`,
    );
  }

  const permissao = permissaoParaDestino(para);

  return emUnidade(ctx.tenantId, async (u) => {
    const documento = await u.documentos.obterPorId(ctx.tenantId, id);
    if (!documento) {
      // Não distinguir "não existe" de "é de outro tenant": a diferença já seria
      // vazamento. A tentativa fica registrada.
      await u.auditoria.registrar({
        em: new Date().toISOString(),
        tenantId: ctx.tenantId,
        usuarioId: ctx.usuarioId,
        papel: ctx.papel,
        acao: "acesso.negado",
        entidade: "documento",
        entidadeId: id,
        resumo: "Tentativa de transição em documento não encontrado para este tenant.",
        origem: "usuario",
        sessao: ctx.usuarioId,
      });
      throw new DocumentoNaoEncontrado(ctx.tenantId, id);
    }

    assertAutorizado(ctx, permissao, {
      tenantId: documento.tenantId,
      estabelecimentoId: documento.estabelecimentoId,
    });

    const agora = new Date().toISOString();
    // Spread condicional: `exactOptionalPropertyTypes` proíbe atribuir
    // `undefined` explícito a uma propriedade opcional.
    const novo = transicionar(documento, para, {
      usuarioId: ctx.usuarioId,
      em: agora,
      ...(extra.detalhe !== undefined ? { detalhe: extra.detalhe } : {}),
      origem: extra.origem ?? "sistema",
    });

    await u.documentos.salvar(novo);

    await u.auditoria.registrar({
      em: agora,
      tenantId: ctx.tenantId,
      usuarioId: ctx.usuarioId,
      papel: ctx.papel,
      acao: "documento.transicionado",
      entidade: "documento",
      entidadeId: documento.id,
      resumo: `Transição "${documento.estado}" → "${para}".`,
      antes: documento.estado,
      depois: para,
      origem: "usuario",
      sessao: ctx.usuarioId,
    });

    return novo;
  });
}

/** Destinos que a interface pode oferecer hoje, com o motivo dos demais. */
export function transicoesDisponiveis(documento: DocumentoFiscal): {
  permitidas: EstadoDocumento[];
  bloqueadas: { estado: EstadoDocumento; motivo: string }[];
} {
  const todas = transicoesPermitidas(documento.familia, documento.estado);
  return {
    permitidas: todas.filter((e) => !MOTIVO_INDISPONIVEL[e]),
    bloqueadas: todas
      .filter((e) => MOTIVO_INDISPONIVEL[e])
      .map((e) => ({ estado: e, motivo: MOTIVO_INDISPONIVEL[e]! })),
  };
}
