/**
 * Cabeçalhos de segurança aplicados a toda resposta.
 *
 * ============================================================================
 * POR QUE ISTO É CÓDIGO E NÃO CONFIGURAÇÃO DE HOST
 * ============================================================================
 * O build gera `.output/public/_headers` via Nitro, e ele é **sobrescrito** a
 * cada build — editar o artefato não sobrevive. Além disso o app é publicado no
 * Lovable Cloud e pode ir para outro host; prender os headers à configuração de
 * um host os perderia na mudança. Aplicar no middleware do `src/start.ts` faz o
 * header seguir o código.
 *
 * ============================================================================
 * O QUE ESTA POLÍTICA PROTEGE — E O QUE NÃO PROTEGE
 * ============================================================================
 * Protege: injeção de script de terceiro (`default-src 'self'`), embutir o app
 * em iframe de terceiro (`frame-ancestors 'none'`), plugins (`object-src
 * 'none'`), mudança de `<base>` (`base-uri 'self'`), e exfiltração por
 * `fetch`/XHR para origem externa (`connect-src 'self'`).
 *
 * NÃO protege contra XSS refletido/armazenado, e isto é deliberado e honesto:
 * `script-src` precisa de `'unsafe-inline'` porque o TanStack Start injeta dois
 * scripts inline no HTML servido — o bootstrap de hydration
 * (`$tsr-stream-barrier`) e o de restauração de scroll. Sem `'unsafe-inline'` o
 * app não hidrata. Com ele, um XSS já existente continua executando.
 *
 * Ou seja: esta política reduz a superfície de ataque, mas **não substitui**
 * sanitização de entrada. Quem precisar de XSS mitigado de verdade precisa de
 * nonce ou hash, o que exige suporte do framework à injeção de nonce — não
 * tentado aqui.
 *
 * `style-src` também leva `'unsafe-inline'`: o Tailwind e os estilos inline do
 * SSR o exigem. `https://fonts.googleapis.com` está na lista porque o
 * `__root.tsx` carrega a IBM Plex por stylesheet externo, e
 * `https://fonts.gstatic.com` porque é de lá que os arquivos de fonte vêm.
 *
 * `connect-src 'self'` é suficiente para o navegador: as server functions são
 * same-origin, e o `fetch` para `ai.gateway.lovable.dev` acontece **no
 * servidor**, dentro de `diagnostico-ia.functions.ts` (um `createServerFn`).
 */

/** Origens que o app realmente carrega, além de si mesmo. */
const ORIGENS = {
  /** Stylesheet externa da IBM Plex, em `src/routes/__root.tsx`. */
  estilo: ["https://fonts.googleapis.com"],
  /** Arquivos de fonte servidos pelo Google Fonts. */
  fonte: ["https://fonts.gstatic.com"],
} as const;

export const CSP = [
  "default-src 'self'",
  // `'unsafe-inline'` é exigido pelo bootstrap de hydration do TanStack.
  "script-src 'self' 'unsafe-inline'",
  `style-src 'self' 'unsafe-inline' ${ORIGENS.estilo.join(" ")}`,
  `font-src 'self' data: ${ORIGENS.fonte.join(" ")}`,
  // Ícones lucide inline e SVGs em data URI.
  "img-src 'self' data: blob:",
  // Server functions são same-origin; a chamada de IA é server-side.
  "connect-src 'self'",
  // Equivalente moderno (e mais forte) de `X-Frame-Options`.
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

/**
 * Cabeçalhos aplicados a toda resposta.
 *
 * `X-Frame-Options` é redundante com `frame-ancestors 'none'` e existe só para
 * navegadores que não implementam `frame-ancestors`. `nosniff` é barato e
 * host-independente. HSTS **não** é setado aqui: ele pertence ao termination de
 * TLS, e o host já o emite com `includeSubDomains`.
 */
export function cabecalhosSeguranca(): Record<string, string> {
  return {
    "content-security-policy": CSP,
    "x-frame-options": "DENY",
    "x-content-type-options": "nosniff",
  };
}
