/**
 * ACESSO HTTP A COOKIES E METADADOS DO REQUEST.
 *
 * Este módulo importa `@tanstack/react-start/server`, que o framework PROÍBE no
 * bundle do cliente (regra `import-protection`). Por isso ele nunca pode ser
 * importado estaticamente por módulo alcançável a partir de uma rota — apenas
 * dinamicamente, dentro de `handler()` de funções de servidor, que rodam no
 * ambiente servidor. Ver `sessao.functions.ts`.
 */

import {
  deleteCookie,
  getCookie,
  getRequestHeader,
  getRequestIP,
  setCookie,
} from "@tanstack/react-start/server";

export const COOKIE_SESSAO = "ff_sessao";

/** Opções do cookie de sessão. HttpOnly é inegociável. */
export function opcoesCookieSessao(maxAgeSegundos: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    // Secure apenas em produção: em dev local (http://localhost) o cookie com
    // Secure seria descartado pelo navegador e o login "funcionaria" sem sessão.
    secure: process.env["NODE_ENV"] === "production",
    path: "/",
    maxAge: maxAgeSegundos,
  };
}

export function gravarCookieSessao(token: string, maxAgeSegundos: number): void {
  setCookie(COOKIE_SESSAO, token, opcoesCookieSessao(maxAgeSegundos));
}

export function apagarCookieSessao(): void {
  deleteCookie(COOKIE_SESSAO, { path: "/" });
}

export function lerCookieSessao(): string | undefined {
  return getCookie(COOKIE_SESSAO);
}

export function ipDoRequest(): string | undefined {
  return getRequestIP({ xForwardedFor: true });
}

export function agenteDoRequest(): string | undefined {
  return getRequestHeader("user-agent");
}
