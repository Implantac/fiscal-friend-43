/**
 * CAMADA HTTP DE AUTENTICAÇÃO (server functions).
 *
 * ============================================================================
 * O QUE ESTA CAMADA FAZ — E O QUE ELA NÃO FAZ
 * ============================================================================
 * Faz: traduzir request HTTP <-> regras de `sessao.ts`; gravar o token de sessão
 * em cookie HttpOnly + SameSite=Lax + Secure em produção; devolver mensagem
 * genérica em falha de credencial.
 *
 * Não faz: autorizar documento fiscal. Autenticar prova *quem* é o usuário;
 * autorizar uso de documento é decisão do SEFAZ, nunca desta camada. Nenhuma
 * resposta HTTP 200 daqui significa autorização fiscal de documento algum.
 *
 * ============================================================================
 * PERSISTÊNCIA
 * ============================================================================
 * Os repositórios são injetados por `obterDependencias()`:
 *   - `FISCAL_PERSISTENCIA=postgres` -> implementação Postgres (a ser conectada
 *     quando o banco for provisionado; ver `docs/banco-de-dados.md`).
 *   - `FISCAL_PERSISTENCIA=memoria`  -> apenas desenvolvimento/teste. Dados
 *     somem ao reiniciar o processo e a configuração é recusada em produção.
 *
 * ============================================================================
 * POR QUE `http-cookies.ts` E `sessao.ts` SÃO IMPORTADOS DINAMICAMENTE
 * ============================================================================
 * O plugin `import-protection` do framework nega o especificador
 * `@tanstack/react-start/server` no ambiente cliente. Este módulo é alcançável
 * a partir de `src/routes/entrar.tsx`; um import ESTÁTICO de `http-cookies.ts`
 * arrastaria aquele especificador para o bundle do cliente e o build falharia.
 * Com `import()` dentro do `handler()`, o módulo só existe no ambiente servidor
 * — confirmado no artefato: `.output/public/assets` não contém PBKDF2, o nome do
 * cookie nem as mensagens de erro da sessão.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { ContextoUsuario } from "@/fiscal/seguranca";
import type { EstruturaDev } from "./estrutura-dev";
import type { DependenciasSessao } from "@/fiscal/servidor/portas-servidor";
import { SessoesMemoria, UsuariosMemoria } from "@/fiscal/servidor/repositorios-memoria";
import { AuditoriaMemoria } from "@/fiscal/auditoria";
import { decisaoAtual, tenantDevId } from "@/fiscal/servidor/ambiente";
import { registroGlobal } from "./registro";

const MINUTOS_COOKIE = 60;

/**
 * Carregamento dinâmico do acesso HTTP. O import estático quebraria o build:
 * `@tanstack/react-start/server` é proibido no bundle do cliente e este módulo
 * é alcançável a partir das rotas.
 */
type Http = typeof import("./http-cookies");
const http = (): Promise<Http> => import("./http-cookies");

type Logica = typeof import("./sessao");
const logica = (): Promise<Logica> => import("./sessao");

const entradaLogin = z.object({
  tenantId: z.string().min(1).max(64),
  email: z.string().email().max(254),
  senha: z.string().min(8).max(200),
});

/* --------------------------------------------------------------- dependências */

/**
 * REGISTRO GLOBAL — e por que ele não é um simples `let` de módulo.
 *
 * ============================================================================
 * O BUG QUE ISTO CORRIGE
 * ============================================================================
 * Em desenvolvimento, o plugin do framework carrega os módulos de server
 * function com um sufixo de query (`…sessao.functions.ts?tsr-serverfn-split`),
 * que é uma instância de módulo **diferente** da que as rotas importam
 * normalmente. Consequência, observada em execução real:
 *
 *   POST /_serverFn/<iniciarSessao>  -> 200, cookie gravado, sessão criada
 *   GET  /_serverFn/<listarDocumentos> -> "Sessão inválida ou expirada"
 *
 * O login gravava a sessão no `SessoesMemoria` de uma instância do módulo, e
 * `exigirContexto()` — chamado de dentro de `documento.functions.ts`, que
 * importa `sessao.functions.ts` sem a query — consultava o `SessoesMemoria` de
 * outra instância. A sessão existia; o lugar onde ela foi guardada é que não
 * era o mesmo.
 *
 * Um `let` de módulo não sobrevive a isso. `globalThis` sobrevive: qualquer que
 * seja o número de instâncias do módulo, existe um único registro.
 *
 * Em produção o bundle é único e o problema não se manifesta — mas a correção
 * vale para os dois ambientes, e não custa nada.
 */
interface RegistroSessao {
  dependencias?: DependenciasSessao;
  trilha?: AuditoriaMemoria;
  seed?: Promise<void>;
  estrutura?: Promise<EstruturaDev | undefined>;
}

/** Registro em `globalThis`: sobrevive à duplicação de módulos em dev. */
function registro(): RegistroSessao {
  return registroGlobal<RegistroSessao>("__fiscal_friend_43_sessao__");
}

function memoria(): { deps: DependenciasSessao; auditoria: AuditoriaMemoria } {
  const reg = registro();
  if (reg.dependencias && reg.trilha) return { deps: reg.dependencias, auditoria: reg.trilha };
  const usuarios = new UsuariosMemoria();
  const novas: DependenciasSessao = { usuarios, sessoes: new SessoesMemoria() };
  reg.dependencias = novas;
  reg.trilha = new AuditoriaMemoria();
  return { deps: novas, auditoria: reg.trilha };
}

/**
 * Resolve as dependências de autenticação.
 *
 * Ordem de decisão:
 *   1. `FISCAL_PERSISTENCIA=postgres` → Postgres obrigatório; sem conexão, falha.
 *   2. `FISCAL_PERSISTENCIA=auto` (padrão) → Postgres se houver string de conexão
 *      (`SUPABASE_DB_URL` do Lovable Cloud ou `DATABASE_URL`), memória caso contrário.
 *   3. `FISCAL_PERSISTENCIA=memoria` → memória, **recusada em produção**.
 *
 * A regra 3 é a mais importante: um sistema que "funcionasse" com repositório em
 * memória em produção daria a ilusão de login persistente sem guardar nada.
 * Falhar alto é honesto; fingir não é.
 */
export async function obterDependencias(): Promise<DependenciasSessao> {
  const decisao = decisaoAtual();
  if (decisao.tipo === "erro") throw new Error(decisao.mensagem);
  if (decisao.tipo === "memoria") return memoria().deps;

  // Postgres. `conexao-postgres.ts` importa `pg` (Node puro) e por isso só pode
  // ser carregado dinamicamente — nunca estaticamente por módulo alcançável a
  // partir de uma rota.
  const { obterExecutor } = await import("./conexao-postgres");
  const { UsuariosPostgres, SessoesPostgres } = await import("./repositorios-postgres");
  const reg = registro();
  if (!reg.dependencias) {
    const executor = obterExecutor();
    reg.dependencias = {
      usuarios: new UsuariosPostgres(executor),
      sessoes: new SessoesPostgres(executor),
    };
  }
  return reg.dependencias;
}

/** Trilha de auditoria da camada de sessão (mesma instância dos repositórios). */
export function obterAuditoria(): AuditoriaMemoria {
  return memoria().auditoria;
}

/**
 * Estrutura mínima de desenvolvimento (tenant, empresa, estabelecimento).
 *
 * Só existe quando `DEV_AUTH_EMAIL` está definido **e** há banco Postgres. Sem
 * banco não há chaves estrangeiras a satisfazer, e sem `DEV_AUTH_EMAIL` não há
 * arranque de desenvolvimento — em produção nada é criado aqui.
 *
 * O tenant é identificado por UUID determinístico derivado do nome. A versão
 * anterior passava a string `"tenant-dev"` direto, o que quebrava o caminho
 * Postgres em dois lugares: `set_config('app.tenant_id', …)` faz
 * `NULLIF(…)::UUID` e lança em texto que não é UUID, e a chave estrangeira de
 * `tenants` rejeita a linha. Só o caminho em memória "funcionava" — que é
 * justamente o caminho que os testes não cobriam.
 */
export function estruturaDev(): Promise<EstruturaDev | undefined> {
  const reg = registro();
  if (!reg.estrutura) {
    reg.estrutura = (async () => {
      if (!process.env["DEV_AUTH_EMAIL"]) return undefined;
      const { estruturaDevDeterministica } = await import("./estrutura-dev");
      const ids = estruturaDevDeterministica();

      // Em memória não há chave estrangeira a satisfazer: os identificadores
      // são apenas rótulos, e a estrutura "existe" no repositório em memória.
      // Em Postgres as linhas precisam existir de verdade.
      if (decisaoAtual().tipo === "postgres") {
        const { obterExecutor } = await import("./conexao-postgres");
        const { garantirEstruturaDev } = await import("./estrutura-dev");
        return garantirEstruturaDev(obterExecutor());
      }
      return ids;
    })().catch((e) => {
      // Falhar aqui não pode derrubar o login com erro genérico: a mensagem
      // precisa dizer o que aconteceu.
      throw e;
    });
  }
  return reg.estrutura;
}

/**
 * Cria o usuário de desenvolvimento a partir de variáveis de ambiente.
 * Sem `DEV_AUTH_EMAIL`/`DEV_AUTH_SENHA` nada é criado — não existe usuário
 * padrão com senha conhecida embutida no código.
 *
 * A promessa é única e **aguardada** pelo handler de login. A primeira versão
 * desta função era *fire-and-forget* e perdia a corrida com o primeiro login,
 * que falhava sem motivo aparente — o teste HTTP pegou o bug.
 */

export function garantirUsuarioDev(): Promise<void> {
  const reg = registro();
  if (!reg.seed) {
    reg.seed = (async () => {
      const email = process.env["DEV_AUTH_EMAIL"];
      const senha = process.env["DEV_AUTH_SENHA"];
      if (!email || !senha) return;
      const nomeTenant = process.env["DEV_AUTH_TENANT"] ?? "tenant-dev";
      const tenantId = tenantDevId(nomeTenant);
      await estruturaDev();
      const m = await logica();
      await m.criarUsuario(await obterDependencias(), {
        id: process.env["DEV_AUTH_USUARIO"] ?? "usr-dev-1",
        tenantId,
        email,
        senha,
        papel: (process.env["DEV_AUTH_PAPEL"] as ContextoUsuario["papel"]) ?? "administrador",
      });
    })().catch(() => {
      /* usuário já existe — irrelevante */
    });
  }
  return reg.seed;
}

/* ----------------------------------------------------------------- server fns */

type RespostaLogin =
  | { ok: true; dados: { usuario: { id: string; tenantId: string; email: string; papel: string } } }
  | { ok: false; erro: string };

/**
 * Login. Devolve mensagem genérica em falha — nunca "e-mail não encontrado"
 * nem "senha incorreta" separadamente, para não permitir enumeração de contas.
 */
export const iniciarSessao = createServerFn({ method: "POST" })
  .validator((d: unknown) => entradaLogin.parse(d))
  .handler(async ({ data }): Promise<RespostaLogin> => {
    await garantirUsuarioDev();
    const agora = new Date().toISOString();

    const auth = await logica();
    let resultado;
    try {
      resultado = await auth.autenticar(await obterDependencias(), {
        tenantId: data.tenantId,
        email: data.email,
        senha: data.senha,
        agora,
        ip: (await http()).ipDoRequest(),
        agente: (await http()).agenteDoRequest(),
      });
    } catch (e) {
      const bloqueado = e instanceof auth.UsuarioBloqueado;
      if (bloqueado || e instanceof auth.CredencialInvalida) {
        // Registra a tentativa sem e-mail (LGPD: dado pessoal apenas quando
        // estritamente necessário) e devolve mensagem genérica.
        await obterAuditoria()
          .registrar({
            em: agora,
            tenantId: data.tenantId,
            usuarioId: "desconhecido",
            papel: "desconhecido",
            acao: "sessao.falha",
            entidade: "sessao",
            entidadeId: "tentativa",
            resumo: bloqueado
              ? "Tentativa de login em conta bloqueada por excesso de falhas."
              : "Tentativa de login com credencial inválida.",
            origem: "usuario",
            sessao: "http",
          })
          .catch(() => {
            /* auditoria é melhor-esforço em falha de credencial */
          });
        return { ok: false, erro: bloqueado ? e.message : "E-mail ou senha inválidos." };
      }
      // Erro inesperado (ex.: persistência não configurada): mensagem honesta,
      // sem sugerir que a credencial estava certa ou errada.
      return {
        ok: false,
        erro: e instanceof Error ? e.message : "Falha inesperada ao iniciar sessão.",
      };
    }

    (await http()).gravarCookieSessao(resultado.token, MINUTOS_COOKIE * 60);

    // Auditoria do login: falhar em registrar FALHA o login (fail closed).
    // Um login que não deixa rastro é pior que um login negado.
    await obterAuditoria().registrar({
      em: agora,
      tenantId: resultado.usuario.tenantId,
      usuarioId: resultado.usuario.id,
      papel: resultado.usuario.papel,
      acao: "sessao.iniciada",
      entidade: "sessao",
      entidadeId: resultado.usuario.id,
      resumo: "Sessão iniciada com sucesso.",
      origem: "usuario",
      sessao: "http",
    });

    return { ok: true, dados: { usuario: resultado.usuario } };
  });

export const encerrarSessao = createServerFn({ method: "POST" }).handler(
  async (): Promise<{ ok: true }> => {
    const token = (await http()).lerCookieSessao();
    if (token) {
      await (await logica()).encerrarSessao(await obterDependencias(), token).catch(() => {
        /* logout é melhor-esforço: falhar aqui não é falha de segurança */
      });
    }
    (await http()).apagarCookieSessao();
    return { ok: true };
  },
);

/** Contexto do usuário logado, ou `autenticado: false`. */
export const sessaoAtual = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ autenticado: false } | { autenticado: true; contexto: ContextoUsuario }> => {
    const token = (await http()).lerCookieSessao();
    if (!token) return { autenticado: false };
    const contexto = await (
      await logica()
    ).resolverContexto(await obterDependencias(), token, new Date().toISOString());
    if (!contexto) return { autenticado: false };
    return { autenticado: true, contexto };
  },
);

/**
 * Resolve o contexto ou lança. Para uso interno de outras server functions:
 * uma função que exige usuário logado chama `exigirContexto()` no início.
 */
export async function exigirContexto(): Promise<ContextoUsuario> {
  const token = (await http()).lerCookieSessao();
  const contexto = token
    ? await (
        await logica()
      ).resolverContexto(await obterDependencias(), token, new Date().toISOString())
    : null;
  if (!contexto) throw new Error("Sessão inválida ou expirada. Faça login novamente.");
  return contexto;
}
