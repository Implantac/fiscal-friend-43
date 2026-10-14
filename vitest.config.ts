import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

/**
 * Configuração isolada de testes.
 *
 * Separada do `vite.config.ts` (que carrega o plugin do TanStack Router e o
 * servidor SSR) para que os testes de unidade do domínio fiscal rodem em Node
 * puro, sem servidor e sem navegador.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    reporters: ["default"],
  },
});
