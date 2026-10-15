import { createStart, createCsrfMiddleware, createMiddleware } from "@tanstack/react-start";

import { renderErrorPage } from "./lib/error-page";
import { cabecalhosSeguranca } from "./lib/headers-seguranca";

const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error(error);
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

// Start installs this automatically when src/start.ts is absent; defining the
// file opts out, so re-add it explicitly to keep server functions protected
// from cross-site requests.
const csrfMiddleware = createCsrfMiddleware({
  filter: (ctx) => ctx.handlerType === "serverFn",
});

/**
 * Cabeçalhos de segurança em toda resposta.
 *
 * Fica no middleware, e não no `_headers` gerado pelo Nitro, porque o artefato
 * é sobrescrito a cada build e porque o app é publicado no Lovable Cloud e pode
 * mudar de host. Prender os headers a um host os perderia na mudança.
 *
 * A política completa e o que ela **não** protege estão em
 * `src/lib/headers-seguranca.ts` — em resumo, `script-src` precisa de
 * `'unsafe-inline'` por causa do bootstrap de hydration do TanStack, então isto
 * reduz superfície de ataque mas não mitiga XSS.
 *
 * ---------------------------------------------------------------------------
 * POR QUE OS HEADERS SÃO FIXADOS EM `resultado.response`
 * ---------------------------------------------------------------------------
 * `next()` em `requestMiddleware` **não devolve uma `Response`**. Devolve o
 * contexto do request — `{request, pathname, handlerType, context, response}` —
 * e a `Response` está em `.response`. Uma primeira versão deste middleware
 * testava `resultado instanceof Response`, que é sempre falso aqui, e portanto
 * não fazia nada sem erro: os headers simplesmente não apareciam. Só foi pego
 * porque a verificação foi feita contra um servidor real, não apenas pelos
 * testes de unidade.
 *
 * Os headers são fixados na própria resposta, sem reconstruí-la: copiar o
 * `Headers` para um objeto novo pode colapsar múltiplos `Set-Cookie`, e esta
 * aplicação emite cookie de sessão no login.
 */
const segurancaMiddleware = createMiddleware().server(async ({ next }) => {
  const resultado = await next();
  const resposta = (resultado as { response?: Response }).response;
  if (resposta instanceof Response) {
    for (const [nome, valor] of Object.entries(cabecalhosSeguranca())) {
      resposta.headers.set(nome, valor);
    }
  }
  return resultado;
});

export const startInstance = createStart(() => ({
  requestMiddleware: [errorMiddleware, segurancaMiddleware, csrfMiddleware],
}));
