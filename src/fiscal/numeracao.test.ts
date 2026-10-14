import { describe, expect, it } from "vitest";
import {
  ErroNumeracao,
  ServicoNumeracaoMemoria,
  serializarChave,
  type ChaveNumeracao,
} from "./numeracao";

const chave: ChaveNumeracao = {
  tenantId: "t1",
  estabelecimentoId: "est-1",
  modelo: "55",
  serie: "1",
};

const outraChave: ChaveNumeracao = { ...chave, serie: "2" };

describe("numeração sequencial", () => {
  it("numera sequencialmente a partir de 1", async () => {
    const s = new ServicoNumeracaoMemoria();
    expect((await s.reservar(chave, "idem-1")).numero).toBe("1");
    expect((await s.reservar(chave, "idem-2")).numero).toBe("2");
    expect((await s.reservar(chave, "idem-3")).numero).toBe("3");
    expect(await s.atual(chave)).toBe(3);
  });

  it("séries são sequências independentes", async () => {
    const s = new ServicoNumeracaoMemoria();
    await s.reservar(chave, "a");
    await s.reservar(chave, "b");
    expect((await s.reservar(outraChave, "c")).numero).toBe("1");
    expect(await s.atual(outraChave)).toBe(1);
    expect(await s.atual(chave)).toBe(2);
  });

  it("tenants diferentes nunca compartilham numeração", async () => {
    const s = new ServicoNumeracaoMemoria();
    await s.reservar(chave, "a");
    const outro = { ...chave, tenantId: "t2" };
    expect((await s.reservar(outro, "b")).numero).toBe("1");
  });

  it("serializa a chave de forma estável", () => {
    expect(serializarChave(chave)).toBe("t1|est-1|55|1");
  });
});

describe("idempotência de transmissão", () => {
  it("a mesma chave devolve o mesmo número sem consumir a sequência", async () => {
    const s = new ServicoNumeracaoMemoria();
    const primeira = await s.reservar(chave, "idem-1");
    const segunda = await s.reservar(chave, "idem-1");
    expect(segunda).toEqual(primeira);
    expect(await s.atual(chave)).toBe(1);
  });

  it("a mesma chave não pode ser reutilizada em outra sequência", async () => {
    const s = new ServicoNumeracaoMemoria();
    await s.reservar(chave, "idem-1");
    await expect(s.reservar(outraChave, "idem-1")).rejects.toThrow(ErroNumeracao);
  });

  it("recusa reserva sem chave de idempotência", async () => {
    const s = new ServicoNumeracaoMemoria();
    await expect(s.reservar(chave, "")).rejects.toThrow(/obrigatória/);
    await expect(s.reservar(chave, "   ")).rejects.toThrow(/obrigatória/);
  });
});

describe("concorrência", () => {
  it("50 reservas simultâneas produzem números únicos e sequenciais", async () => {
    const s = new ServicoNumeracaoMemoria();
    const reservas = await Promise.all(
      Array.from({ length: 50 }, (_, i) => s.reservar(chave, `idem-${i}`)),
    );
    const numeros = reservas.map((r) => r.sequencia).sort((a, b) => a - b);
    expect(new Set(numeros).size).toBe(50);
    expect(numeros).toEqual(Array.from({ length: 50 }, (_, i) => i + 1));
    expect(await s.atual(chave)).toBe(50);
  });

  it("reservas simultâneas com a MESMA chave de idempotência devolvem o mesmo número", async () => {
    const s = new ServicoNumeracaoMemoria();
    const [a, b, c] = await Promise.all([
      s.reservar(chave, "idem-x"),
      s.reservar(chave, "idem-x"),
      s.reservar(chave, "idem-x"),
    ]);
    expect(a.sequencia).toBe(b.sequencia);
    expect(b.sequencia).toBe(c.sequencia);
    expect(await s.atual(chave)).toBe(1);
  });
});

describe("inutilização", () => {
  it("exige justificativa substantiva", async () => {
    const s = new ServicoNumeracaoMemoria();
    await expect(s.inutilizar(chave, 5, 7, "curta")).rejects.toThrow(ErroNumeracao);
    await expect(s.inutilizar(chave, 7, 5, "justificativa suficientemente longa")).rejects.toThrow(
      ErroNumeracao,
    );
  });

  it("registra o intervalo inutilizado", async () => {
    const s = new ServicoNumeracaoMemoria();
    await s.inutilizar(chave, 5, 7, "Justificativa suficientemente longa para o procedimento");
    expect(await s.inutilizados(chave)).toHaveLength(1);
    expect((await s.inutilizados(chave))[0]).toMatchObject({ de: 5, ate: 7 });
  });
});
