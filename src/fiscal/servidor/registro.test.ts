/**
 * TESTES DO REGISTRO GLOBAL.
 *
 * O bug que motivou este módulo: em desenvolvimento o plugin do framework
 * carrega os módulos de server function com um sufixo de query
 * (`?tss-serverfn-split`), criando uma segunda instância do módulo. Um `let`
 * de módulo então dividia os repositórios em memória em dois — o login gravava
 * a sessão em um, e `exigirContexto()`, chamado de outro módulo, consultava o
 * outro. O sintoma em produção de dev era "Sessão inválida ou expirada" um
 * milissegundo depois de um login bem-sucedido.
 *
 * Estes testes travam a garantia: o estado vive em `globalThis`, não no módulo.
 */

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { registroGlobal } from "./registro";

describe("registroGlobal", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    // Limpeza explícita: o registro vive em `globalThis` e vazaria entre testes.
    delete (globalThis as Record<string, unknown>)["__teste_registro__"];
  });

  it("devolve o MESMO objeto em chamadas repetidas com a mesma chave", () => {
    const a = registroGlobal<{ n: number }>("__teste_registro__");
    a.n = 1;
    const b = registroGlobal<{ n: number }>("__teste_registro__");
    expect(b).toBe(a);
    expect(b.n).toBe(1);
  });

  it("chaves diferentes têm registros independentes", () => {
    const a = registroGlobal<{ v: string }>("__teste_registro_a__");
    const b = registroGlobal<{ v: string }>("__teste_registro_b__");
    expect(a).not.toBe(b);
    delete (globalThis as Record<string, unknown>)["__teste_registro_a__"];
    delete (globalThis as Record<string, unknown>)["__teste_registro_b__"];
  });

  it("sobrevive a uma nova instância do módulo — o bug que ele corrige", async () => {
    // Simula o que o Vite faz em dev: reimportar o módulo do zero.
    const primeiro = await import("./registro");
    const r1 = primeiro.registroGlobal<{ sessoes: string[] }>("__teste_modulo__");
    r1.sessoes = ["sessao-1"];

    vi.resetModules();
    const segundo = await import("./registro");
    const r2 = segundo.registroGlobal<{ sessoes: string[] }>("__teste_modulo__");

    // Instâncias de módulo diferentes, registro igual: é toda a correção.
    expect(r2).toBe(r1);
    expect(r2.sessoes).toEqual(["sessao-1"]);

    delete (globalThis as Record<string, unknown>)["__teste_modulo__"];
  });

  it("ignora valor pré-existente que não é objeto", () => {
    (globalThis as Record<string, unknown>)["__teste_lixo__"] = "nao sou objeto";
    const r = registroGlobal<{ ok: boolean }>("__teste_lixo__");
    expect(r).not.toBe("nao sou objeto");
    expect(typeof r).toBe("object");
    delete (globalThis as Record<string, unknown>)["__teste_lixo__"];
  });
});
