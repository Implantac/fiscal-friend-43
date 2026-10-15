import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { IconeTransmissao } from "./IconeTransmissao";

/**
 * Testa o HTML servido, não a árvore React: `renderToStaticMarkup` roda em Node
 * puro, sem DOM. O que se quer travar aqui é o markup exato que as seis telas
 * de emissão passam a compartilhar.
 */
const html = (processando: boolean) =>
  renderToStaticMarkup(<IconeTransmissao processando={processando} />);

describe("IconeTransmissao", () => {
  it("mostra o spinner enquanto processa", () => {
    const saida = html(true);
    expect(saida).toContain("animate-spin");
    expect(saida).toContain('class="lucide lucide-loader-circle size-4 animate-spin"');
  });

  it("mostra o ícone de envio quando parado", () => {
    const saida = html(false);
    expect(saida).not.toContain("animate-spin");
    expect(saida).toContain('class="lucide lucide-send size-4"');
  });

  it("marca o ícone como decorativo nos dois estados", () => {
    // O texto do botão carrega o significado; o ícone não deve ser lido.
    expect(html(true)).toContain('aria-hidden="true"');
    expect(html(false)).toContain('aria-hidden="true"');
  });

  it("usa exatamente um ícone por estado, nunca os dois", () => {
    expect(html(true).match(/<svg/g)?.length).toBe(1);
    expect(html(false).match(/<svg/g)?.length).toBe(1);
  });

  it("não renderiza texto próprio — o rótulo vem do botão", () => {
    // Se renderizasse texto, os botões das seis telas ficariam com rótulo
    // duplicado, e cada família tem o seu.
    expect(
      html(true)
        .replace(/<[^>]*>/g, "")
        .trim(),
    ).toBe("");
    expect(
      html(false)
        .replace(/<[^>]*>/g, "")
        .trim(),
    ).toBe("");
  });

  it("os dois estados produzem markup diferente", () => {
    expect(html(true)).not.toBe(html(false));
  });
});
