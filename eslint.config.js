import js from "@eslint/js";
import eslintPluginPrettier from "eslint-plugin-prettier/recommended";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist", ".output", ".vinxi"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "server-only",
              message:
                "TanStack Start does not use the Next.js `server-only` package. Rename the module to `*.server.ts` or mark it with `@tanstack/react-start/server-only`.",
            },
          ],
        },
      ],
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
  // ------------------------------------------------------------------------
  // MÓDULOS EXCLUSIVOS DE SERVIDOR
  // ------------------------------------------------------------------------
  // `autenticacao.ts`, `persistencia-postgres.ts`, `conexao-postgres.ts` e os
  // repositórios de `servidor/` lidam com hash de senha, token de sessão, SQL e
  // driver de banco. Se qualquer um deles for importado por código de rota (que
  // roda no cliente), o material de credencial e a string de conexão entrariam
  // no bundle do navegador. A regra abaixo transforma esse erro de arquitetura
  // em falha de build.
  //
  // `servidor/sessao.functions.ts` NÃO entra na lista: é o ponto de entrada HTTP
  // autorizado (createServerFn), que as telas podem importar.
  // `servidor/ambiente.ts` também não: não tem dependência de Node nem de driver.
  // ------------------------------------------------------------------------
  {
    files: ["src/routes/**/*.{ts,tsx}", "src/components/**/*.{ts,tsx}", "src/hooks/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "**/fiscal/autenticacao",
                "@/fiscal/autenticacao",
                "**/fiscal/persistencia-postgres",
                "@/fiscal/persistencia-postgres",
                "**/fiscal/servidor/sessao",
                "@/fiscal/servidor/sessao",
                "**/fiscal/servidor/conexao-postgres",
                "@/fiscal/servidor/conexao-postgres",
                "**/fiscal/servidor/repositorios-postgres",
                "@/fiscal/servidor/repositorios-postgres",
                "**/fiscal/servidor/repositorios-memoria",
                "@/fiscal/servidor/repositorios-memoria",
              ],
              message:
                "Módulo exclusivo de servidor (hash de senha, token de sessão e SQL). Importe apenas de funções de servidor (`*.server.ts` / createServerFn).",
            },
          ],
        },
      ],
    },
  },
  eslintPluginPrettier,
);
