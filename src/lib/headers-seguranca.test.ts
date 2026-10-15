import { describe, expect, it } from "vitest";
import { CSP, cabecalhosSeguranca } from "./headers-seguranca";

describe("cabeçalhos de segurança", () => {
  it("define CSP, X-Frame-Options e nosniff", () => {
    const h = cabecalhosSeguranca();
    expect(h["content-security-policy"]).toBe(CSP);
    expect(h["x-frame-options"]).toBe("DENY");
    expect(h["x-content-type-options"]).toBe("nosniff");
  });

  it("não seta HSTS — ele pertence ao termination de TLS", () => {
    expect(cabecalhosSeguranca()).not.toHaveProperty("strict-transport-security");
  });

  it("default-src é 'self': nada de terceiro por padrão", () => {
    expect(CSP).toContain("default-src 'self'");
  });

  it("proíbe embutir em iframe, pelo mecanismo moderno e pelo legado", () => {
    expect(CSP).toContain("frame-ancestors 'none'");
    expect(cabecalhosSeguranca()["x-frame-options"]).toBe("DENY");
  });

  it("proíbe plugins e mudança de base", () => {
    expect(CSP).toContain("object-src 'none'");
    expect(CSP).toContain("base-uri 'self'");
  });

  it("connect-src fica em 'self': exfiltração por fetch é barrada", () => {
    expect(CSP).toContain("connect-src 'self'");
    // A chamada de IA do `diagnostico-ia` roda no servidor, então não precisa
    // (e não deve) aparecer aqui.
    expect(CSP).not.toContain("ai.gateway.lovable.dev");
  });

  it("declara 'unsafe-inline' em script-src, e o motivo é registrado", () => {
    // Sem isso o bootstrap de hydration do TanStack não executa.
    expect(CSP).toContain("script-src 'self' 'unsafe-inline'");
  });

  it("libera as origens de fonte que o app realmente carrega", () => {
    expect(CSP).toContain("https://fonts.googleapis.com");
    expect(CSP).toContain("https://fonts.gstatic.com");
  });

  it("não libera origem externa em script-src", () => {
    // Só 'self' e 'unsafe-inline'. Nenhum CDN de script.
    const scriptSrc = CSP.split(";").find((d) => d.trim().startsWith("script-src"))!;
    expect(scriptSrc).not.toMatch(/https?:/);
  });

  it("não contém directiva vazia nem duplicada", () => {
    const direticas = CSP.split(";").map((d) => d.trim());
    expect(direticas.every((d) => d.length > 0)).toBe(true);
    const nomes = direticas.map((d) => d.split(" ")[0]);
    expect(new Set(nomes).size).toBe(nomes.length);
  });

  it("as diretivas são separadas por ponto e vírgula e espaço", () => {
    expect(CSP).not.toMatch(/;;/);
    expect(CSP.split("; ").length).toBeGreaterThan(8);
  });
});
