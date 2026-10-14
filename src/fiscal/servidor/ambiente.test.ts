/**
 * TESTES DA DECISÃO DE PERSISTÊNCIA.
 *
 * A regra que não pode quebrar em silêncio: repositório em memória em produção
 * daria a ilusão de login persistente sem guardar nada. O sistema precisa FALHAR
 * ALTO nessa configuração, e precisa usar Postgres sempre que houver conexão.
 */

import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
  decisaoAtual,
  decidirPersistencia,
  emProducao,
  modoPersistencia,
  urlDoBanco,
} from "./ambiente";

const URL = "postgres://usuario:senha@host:5432/banco";

describe("decidirPersistencia", () => {
  it("com conexão disponível, usa Postgres (modo auto)", () => {
    expect(decidirPersistencia({ modo: "auto", url: URL, producao: true })).toEqual({
      tipo: "postgres",
    });
  });

  it("sem conexão e em desenvolvimento, cai para memória", () => {
    expect(decidirPersistencia({ modo: "auto", url: undefined, producao: false })).toEqual({
      tipo: "memoria",
    });
  });

  it("modo postgres sem conexão: ERRO, nunca memória silenciosa", () => {
    const d = decidirPersistencia({ modo: "postgres", url: undefined, producao: false });
    expect(d.tipo).toBe("erro");
    if (d.tipo === "erro") expect(d.mensagem).toContain("SUPABASE_DB_URL");
  });

  it("modo memoria em produção: ERRO — a sessão sumiria no restart", () => {
    const d = decidirPersistencia({ modo: "memoria", url: URL, producao: true });
    expect(d.tipo).toBe("erro");
    if (d.tipo === "erro") expect(d.mensagem).toContain("produção");
  });

  it("modo memoria em desenvolvimento é aceito", () => {
    expect(decidirPersistencia({ modo: "memoria", url: undefined, producao: false })).toEqual({
      tipo: "memoria",
    });
  });
});

describe("leitura do ambiente do processo", () => {
  const anterior = { ...process.env };

  beforeEach(() => {
    delete process.env["FISCAL_PERSISTENCIA"];
    delete process.env["SUPABASE_DB_URL"];
    delete process.env["DATABASE_URL"];
    delete process.env["NODE_ENV"];
  });

  afterEach(() => {
    process.env = anterior;
  });

  it("padrão é auto e sem banco", () => {
    expect(modoPersistencia()).toBe("auto");
    expect(urlDoBanco()).toBeUndefined();
    expect(decisaoAtual()).toEqual({ tipo: "memoria" });
  });

  it("SUPABASE_DB_URL (Lovable Cloud) tem precedência sobre DATABASE_URL", () => {
    process.env["DATABASE_URL"] = "postgres://generico";
    process.env["SUPABASE_DB_URL"] = "postgres://lovable";
    expect(urlDoBanco()).toBe("postgres://lovable");
    expect(decisaoAtual()).toEqual({ tipo: "postgres" });
  });

  it("DATABASE_URL sozinho também liga o Postgres", () => {
    process.env["DATABASE_URL"] = URL;
    expect(decisaoAtual()).toEqual({ tipo: "postgres" });
  });

  it("NODE_ENV=production sem conexão continua em memória (modo auto) mas memoria explicita falha", () => {
    process.env["NODE_ENV"] = "production";
    expect(emProducao()).toBe(true);
    // auto + sem banco em produção: memória — o modo auto não adivinha intenção.
    expect(decisaoAtual()).toEqual({ tipo: "memoria" });
    // Já `memoria` explícito em produção é recusado.
    process.env["FISCAL_PERSISTENCIA"] = "memoria";
    expect(decisaoAtual().tipo).toBe("erro");
  });

  it("modo desconhecido cai em auto", () => {
    process.env["FISCAL_PERSISTENCIA"] = "xpto";
    expect(modoPersistencia()).toBe("auto");
  });
});
