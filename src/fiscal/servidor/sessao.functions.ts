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
import type { DependenciasSessao } from "@/fiscal/servidor/portas-servidor";
import { SessoesMemoria, UsuariosMemoria } from "@/fiscal/servidor/repositorios-memoria";
import { AuditoriaMemoria } from "@/fiscal/auditoria";

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

let dependencias: DependenciasSessao | undefined;
let trilha: AuditoriaMemoria | undefined;

function memoria(): { deps: DependenciasSessao; auditoria: AuditoriaMemoria } {
  if (!dependencias || !trilha) {
    const usuarios = new UsuariosMemoria();
    dependencias = { usuarios, sessoes: new SessoesMemoria() };
    trilha = new AuditoriaMemoria();
  }
  return { deps: dependencias, auditoria: trilha };
}

/**
 * Resolve as dependências de autenticação.
 *
 * Falha alto e explícito quando a persistência real não está conectada: um
 * sistema que "funcionasse" com repositório em memória em produção daria a
 * ilusão de login persistente sem guardar nada.
 */
export function obterDependencias(): DependenciasSessao {
  const modo = process.env["FISCAL_PERSISTENCIA"] ?? "memoria";
  if (modo === "postgres") {
    // Os repositórios existem (`repositorios-postgres.ts`), mas falta o driver
    // e a string de conexão. Falhar aqui é honesto: o sistema não pode fingir
    // que tem banco. Quando DATABASE_URL e o driver existirem, este galho passa
    // a construir `UsuariosPostgres`/`SessoesPostgres`.
    if (!process.env["DATABASE_URL"]) {
      throw new Error(
        "FISCAL_PERSISTENCIA=postgres, mas DATABASE_URL não está definido. " +
          "Sem banco não há sessão persistente. Consulte docs/banco-de-dados.md.",
      );
    }
    throw new Error(
      "Driver Postgres ainda não conectado nesta etapa (ver docs/banco-de-dados.md, " +
        "seção 'o que falta para operar').",
    );
  }
  if (process.env["NODE_ENV"] === "production") {
    throw new Error(
      "Autenticação em memória não é permitida em produção. Configure FISCAL_PERSISTENCIA=postgres.",
    );
  }
  return memoria().deps;
}

/** Trilha de auditoria da camada de sessão (mesma instância dos repositórios). */
export function obterAuditoria(): AuditoriaMemoria {
  return memoria().auditoria;
}

let seed: Promise<void> | undefined;

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
  if (!seed) {
    seed = (async () => {
      const email = process.env["DEV_AUTH_EMAIL"];
      const senha = process.env["DEV_AUTH_SENHA"];
      const tenantId = process.env["DEV_AUTH_TENANT"] ?? "tenant-dev";
      if (!email || !senha) return;
      const m = await logica();
      await m.criarUsuario(memoria().deps, {
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
  return seed;
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
      resultado = await auth.autenticar(obterDependencias(), {
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
      await (await logica()).encerrarSessao(obterDependencias(), token).catch(() => {
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
    ).resolverContexto(obterDependencias(), token, new Date().toISOString());
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
    ? await (await logica()).resolverContexto(obterDependencias(), token, new Date().toISOString())
    : null;
  if (!contexto) throw new Error("Sessão inválida ou expirada. Faça login novamente.");
  return contexto;
}
