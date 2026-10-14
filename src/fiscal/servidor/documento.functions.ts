/**
 * CAMADA HTTP DE DOCUMENTOS FISCAIS (server functions).
 *
 * ============================================================================
 * O QUE ESTA CAMADA FAZ
 * ============================================================================
 * Traduz request HTTP <-> serviço de documentos (`documento.ts`), sempre com
 * `exigirContexto()` no início: **não existe operação de documento sem usuário
 * autenticado**. A autorização por papel é verificada no servidor, pelo serviço
 * — uma tela que esconde um botão não é controle de acesso.
 *
 * Devolve um DTO, nunca o objeto de domínio. O motivo é concreto: `bigint` não
 * sobrevive a `JSON.stringify` — a serialização lança `TypeError`. O valor do
 * documento trafega como string de centavos, sem perda de precisão.
 *
 * ============================================================================
 * O QUE ESTA CAMADA NÃO FAZ — E NÃO PODE PASSAR A FAZER POR ACIDENTE
 * ============================================================================
 * Não transmite, não assina, não valida XSD e **não autoriza**. Nenhuma resposta
 * HTTP 200 daqui significa autorização fiscal de documento algum. Os estados que
 * dependem de resposta oficial do SEFAZ ou de provedor são recusados pelo
 * serviço com o motivo explícito — ver `MOTIVO_INDISPONIVEL` em `documento.ts`.
 *
 * ============================================================================
 * POR QUE `conexao-postgres` E `persistencia-postgres` SÃO IMPORTADOS
 * DINAMICAMENTE
 * ============================================================================
 * `conexao-postgres.ts` importa `pg`, que puxa `node:net` e `node:tls`. Este
 * módulo é alcançável a partir de `src/routes/documentos.tsx`; um import
 * estático arrastaria o driver para o bundle do cliente e o build falharia.
 * `persistencia-postgres.ts` em si é agnóstico, mas só faz sentido junto do
 * executor — por isso vem pelo mesmo caminho dinâmico.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { ContextoUsuario } from "@/fiscal/seguranca";
import type {
  DocumentoFiscal,
  EstadoDocumento,
  FamiliaDocumental,
  EventoDocumento,
} from "@/fiscal/ciclo-vida";
import { estadoComValorFiscal } from "@/fiscal/ciclo-vida";
import type { FiltroDocumentos } from "@/fiscal/persistencia";
import { UnidadeTrabalhoMemoria } from "@/fiscal/persistencia";
import { ServicoNumeracaoMemoria } from "@/fiscal/numeracao";
import { AuditoriaMemoria } from "@/fiscal/auditoria";
import { formatar } from "@/lib/money";
import { decisaoAtual, tenantDevId } from "./ambiente";
import { registroGlobal } from "./registro";
import { estruturaDev, exigirContexto } from "./sessao.functions";
import {
  criarDocumentoFiscal,
  listarDocumentosFiscais,
  transicionarDocumentoFiscal,
  transicoesDisponiveis,
  type EmUnidadeDeTrabalho,
} from "./documento";

/* ------------------------------------------------------------------ unidades */

/**
 * Mesmo motivo de `sessao.functions.ts`: em desenvolvimento o framework cria
 * mais de uma instância do módulo (`?tsr-serverfn-split`), e um `let` de módulo
 * abriria um pool de conexões por instância — e daria repositórios em memória
 * distintos para o login e para a consulta. `globalThis` garante um só.
 */
interface RegistroDocumento {
  unidadePostgres?: EmUnidadeDeTrabalho;
  memoria?: UnidadeTrabalhoMemoria;
}

/** Registro em `globalThis`: sobrevive à duplicação de módulos em dev. */
function registro(): RegistroDocumento {
  return registroGlobal<RegistroDocumento>("__fiscal_friend_43_documento__");
}

/**
 * Unidade de trabalho do tenant.
 *
 * Postgres quando há conexão — e aí a unidade de trabalho é uma **transação**
 * com `set_config('app.tenant_id', …)`, que é o que faz a RLS valer. Memória em
 * desenvolvimento, onde não há banco: as escritas ficam no processo e somem ao
 * reiniciar, e a tela diz isso.
 */
export async function unidadeDocumento(): Promise<EmUnidadeDeTrabalho> {
  const decisao = decisaoAtual();
  if (decisao.tipo === "erro") throw new Error(decisao.mensagem);
  if (decisao.tipo === "memoria") return unidadeMemoria();

  const reg = registro();
  if (!reg.unidadePostgres) {
    const { obterExecutor } = await import("./conexao-postgres");
    const { criarRepositoriosPostgres } = await import("@/fiscal/persistencia-postgres");
    const executor = obterExecutor();
    const fabrica = criarRepositoriosPostgres(executor);

    // A transação É a unidade de trabalho: BEGIN/COMMIT/ROLLBACK e o contexto de
    // tenant ficam com o executor, não com o serviço.
    reg.unidadePostgres = async (tenantId, fn) =>
      executor.emTransacao(tenantId, (tx) => fn(fabrica));
  }
  return reg.unidadePostgres;
}

/**
 * Unidade de trabalho em memória — apenas desenvolvimento.
 *
 * `persistencia.ts`, `numeracao.ts` e `auditoria.ts` são módulos puros (sem
 * `node:*`), então podem ser importados estaticamente. A transação aqui é a de
 * `UnidadeTrabalhoMemoria`: staging, commit e rollback de verdade.
 */
function unidadeMemoria(): EmUnidadeDeTrabalho {
  const reg = registro();
  if (!reg.memoria) {
    reg.memoria = new UnidadeTrabalhoMemoria(new ServicoNumeracaoMemoria(), new AuditoriaMemoria());
  }
  const uow = reg.memoria;
  return async (tenantId, fn) => {
    void tenantId; // a unidade em memória é única; o tenant vai em cada consulta
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

/**
 * Empresa e estabelecimento a usar quando o chamador não informa.
 *
 * Só existe arranque de desenvolvimento: sem `DEV_AUTH_EMAIL` nada é criado, e
 * em produção a função devolve `undefined` — o documento então é recusado com
 * mensagem clara, em vez de apontar para um estabelecimento inventado.
 *
 * A lógica vive em `sessao.functions.ts` (`estruturaDev`) porque o login precisa
 * da mesma estrutura: duplicá-la aqui seria dois lugares para criar o mesmo
 * tenant com identificadores potencialmente diferentes.
 */
async function estabelecimentoPadrao(): Promise<
  { empresaId: string; estabelecimentoId: string } | undefined
> {
  return estruturaDev();
}

/* ---------------------------------------------------------------------- DTO */

export interface DocumentoDto {
  id: string;
  familia: FamiliaDocumental;
  modelo: string;
  serie: string;
  numero: string;
  estado: EstadoDocumento;
  ambiente: 1 | 2;
  /** Total em centavos, como string — `bigint` não sobrevive a JSON. */
  valorTotalCentavos: string;
  /** Total formatado a partir do inteiro exato, sem passar por `number`. */
  valorFormatado: string;
  criadoEm: string;
  atualizadoEm: string;
  eventos: EventoDocumento[];
  /**
   * `false` somente quando o documento tem valor fiscal de verdade — hoje,
   * nunca. A UI usa este campo para decidir se pode sugerir que o documento
   * foi autorizado; enquanto for `true`, não pode.
   */
  semValorFiscal: boolean;
  transicoes: ReturnType<typeof transicoesDisponiveis>;
}

function paraDto(doc: DocumentoFiscal): DocumentoDto {
  return {
    id: doc.id,
    familia: doc.familia,
    modelo: doc.modelo,
    serie: doc.serie,
    numero: doc.numero,
    estado: doc.estado,
    ambiente: doc.ambiente,
    valorTotalCentavos: doc.valorTotalCentavos.toString(),
    // `formatar` opera no bigint: nenhuma conversão para `number` no caminho.
    valorFormatado: `R$ ${formatar(doc.valorTotalCentavos)}`,
    criadoEm: doc.criadoEm,
    atualizadoEm: doc.atualizadoEm,
    eventos: doc.historico,
    semValorFiscal: !estadoComValorFiscal(doc.estado),
    transicoes: transicoesDisponiveis(doc),
  };
}

type Resultado<T> = { ok: true; dados: T } | { ok: false; erro: string };

function falha(e: unknown): { ok: false; erro: string } {
  return { ok: false, erro: e instanceof Error ? e.message : "Falha inesperada." };
}

/* ------------------------------------------------------------ validação */

const FAMILIAS = ["nfe55", "nfce65", "nfse", "cte57", "cteos67", "mdfe58"] as const;

const entradaCriar = z.object({
  id: z.string().min(1).max(64),
  familia: z.enum(FAMILIAS),
  modelo: z.string().min(1).max(20).optional(),
  serie: z.string().min(1).max(3),
  ambiente: z.union([z.literal(1), z.literal(2)]),
  /** Total em centavos, como string — precisão integral. */
  valorTotalCentavos: z.string().regex(/^\d{1,18}$/, "Informe o total em centavos, só dígitos."),
  idempotencia: z.string().min(8).max(128),
  empresaId: z.string().max(64).optional(),
  estabelecimentoId: z.string().max(64).optional(),
});

const entradaListar = z.object({
  familia: z.enum(FAMILIAS).optional(),
  estado: z.string().max(40).optional(),
});

const entradaTransicionar = z.object({
  id: z.string().min(1).max(64),
  para: z.enum(["pre_validacao", "documento_gerado", "simulacao"]),
  detalhe: z.string().max(300).optional(),
});

/* ------------------------------------------------------------ server fns */

/**
 * Lista documentos do tenant do usuário logado.
 *
 * `estado` entra como string e é repassado ao repositório, que filtra no banco.
 * A validação de que o estado existe fica com o domínio — aqui não se inventa
 * lista de estados.
 */
export const listarDocumentos = createServerFn({ method: "GET" })
  .validator((d: unknown) => entradaListar.parse(d ?? {}))
  .handler(
    async ({ data }): Promise<Resultado<{ documentos: DocumentoDto[]; memoria: boolean }>> => {
      try {
        const ctx = await exigirContexto();
        const filtro: FiltroDocumentos = {
          // Spread condicional: `exactOptionalPropertyTypes` proíbe atribuir
          // `undefined` explícito a propriedade opcional.
          ...(data.familia ? { familia: data.familia } : {}),
          ...(data.estado ? { estado: data.estado as EstadoDocumento } : {}),
        };
        const documentos = await listarDocumentosFiscais(await unidadeDocumento(), ctx, filtro);
        return {
          ok: true,
          dados: {
            documentos: documentos.map(paraDto),
            memoria: decisaoAtual().tipo === "memoria",
          },
        };
      } catch (e) {
        return falha(e);
      }
    },
  );

/**
 * Cria um documento no estado `simulacao`, com número reservado.
 *
 * A chave de idempotência é **obrigatória** e validada aqui: sem ela, um duplo
 * clique geraria dois documentos com números diferentes.
 */
export const criarDocumento = createServerFn({ method: "POST" })
  .validator((d: unknown) => entradaCriar.parse(d))
  .handler(async ({ data }): Promise<Resultado<DocumentoDto>> => {
    try {
      const ctx = await exigirContexto();

      let alvo =
        data.empresaId && data.estabelecimentoId
          ? { empresaId: data.empresaId, estabelecimentoId: data.estabelecimentoId }
          : undefined;
      if (!alvo) {
        alvo = await estabelecimentoPadrao();
      }
      if (!alvo) {
        return {
          ok: false,
          erro:
            "Nenhum estabelecimento disponível. Em desenvolvimento, defina DEV_AUTH_EMAIL " +
            "para que o arranque crie a estrutura mínima; em produção, o cadastro de " +
            "empresa e estabelecimento ainda não foi implementado.",
        };
      }

      const { documento } = await criarDocumentoFiscal(await unidadeDocumento(), ctx, {
        id: data.id,
        empresaId: alvo.empresaId,
        estabelecimentoId: alvo.estabelecimentoId,
        familia: data.familia,
        modelo: data.modelo,
        serie: data.serie,
        ambiente: data.ambiente,
        valorTotalCentavos: BigInt(data.valorTotalCentavos),
        idempotencia: data.idempotencia,
      });

      return { ok: true, dados: paraDto(documento) };
    } catch (e) {
      return falha(e);
    }
  });

/**
 * Avança o estado do documento.
 *
 * O validador Zod já restringe os destinos possíveis. Isso é defesa em
 * profundidade: o serviço recusaria o mesmo pedido com o motivo — mas quem
 * aperta o botão precisa ler o motivo **antes** de enviar, não depois.
 */
export const avancarDocumento = createServerFn({ method: "POST" })
  .validator((d: unknown) => entradaTransicionar.parse(d))
  .handler(async ({ data }): Promise<Resultado<DocumentoDto>> => {
    try {
      const ctx = await exigirContexto();
      const documento = await transicionarDocumentoFiscal(
        await unidadeDocumento(),
        ctx,
        data.id,
        data.para,
        { detalhe: data.detalhe },
      );
      return { ok: true, dados: paraDto(documento) };
    } catch (e) {
      return falha(e);
    }
  });

/** Contexto do usuário, para a tela decidir o que oferecer. */
export const contextoAtual = createServerFn({ method: "GET" }).handler(
  async (): Promise<Resultado<ContextoUsuario>> => {
    try {
      return { ok: true, dados: await exigirContexto() };
    } catch (e) {
      return falha(e);
    }
  },
);

/** Tenant de desenvolvimento padrão, para pré-preencher a tela de login. */
export function tenantPadraoDev(): string {
  return tenantDevId(process.env["DEV_AUTH_TENANT"] ?? "tenant-dev");
}
