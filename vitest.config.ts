import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

/**
 * Configuração isolada de testes.
 *
 * Separada do `vite.config.ts` (que carrega o plugin do TanStack Router e o
 * servidor SSR) para que os testes de unidade do domínio fiscal rodem em Node
 * puro, sem servidor e sem navegador.
 *
 * `tsx` entrou no `include` para os testes de componente, que renderizam com
 * `react-dom/server` em Node puro — sem DOM e sem jsdom.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}"],
    reporters: ["default"],
  },
});
