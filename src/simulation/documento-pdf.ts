import type { LayoutPdf } from "@/simulation/documento-saida";
import { fmtChave } from "@/simulation/documento-saida";

/** Monta o PDF da representação impressa simulada (A4 retrato) e dispara o download. */
export async function baixarPdf(l: LayoutPdf, nome: string) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = 210;
  const M = 10;
  const CW = W - 2 * M;
  let y = M;

  const marcaDagua = () => {
    doc.saveGraphicsState();
    doc.setGState(new (doc as unknown as { GState: new (o: object) => unknown }).GState({ opacity: 0.12 }) as never);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(30);
    doc.setTextColor(200, 0, 0);
    doc.text("SEM VALOR FISCAL - SIMULAÇÃO", W / 2, 160, { angle: 35, align: "center" });
    doc.restoreGraphicsState();
    doc.setTextColor(0, 0, 0);
  };
  const novaPagina = (h: number) => {
    if (y + h > 285) {
      doc.addPage();
      marcaDagua();
      y = M;
    }
  };

  marcaDagua();

  // Cabeçalho
  doc.setLineWidth(0.3);
  doc.rect(M, y, CW, 30);
  doc.line(M + 110, y, M + 110, y + 30);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(l.titulo, M + 3, y + 9);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(doc.splitTextToSize(l.subtitulo, 104), M + 3, y + 15);
  doc.setFontSize(7);
  doc.setTextColor(180, 0, 0);
  doc.text("AMBIENTE DE SIMULAÇÃO — HOMOLOGAÇÃO (tpAmb=2)", M + 3, y + 26);
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text(`Modelo ${l.modelo}   Série ${l.serie}`, M + 113, y + 7);
  doc.text(`Nº ${l.numero}`, M + 113, y + 13);
  doc.setFont("helvetica", "normal");
  doc.text(`Emissão: ${l.emissao}`, M + 113, y + 19);
  doc.setFontSize(7);
  doc.text("Protocolo: não há (documento não transmitido)", M + 113, y + 25);
  y += 32;

  if (l.chave) {
    doc.rect(M, y, CW, 11);
    doc.setFontSize(7);
    doc.text("CHAVE DE ACESSO", M + 2, y + 3.5);
    doc.setFont("courier", "bold");
    doc.setFontSize(10);
    doc.text(fmtChave(l.chave), M + 2, y + 8.5);
    doc.setFont("helvetica", "normal");
    y += 13;
  }

  // Blocos
  for (const b of l.blocos) {
    const linhas = b.campos.map(([k, v]) => doc.splitTextToSize(`${k}: ${v}`, CW - 4) as string[]);
    const h = 6 + linhas.reduce((a, x) => a + x.length * 4, 0);
    novaPagina(h + 2);
    doc.setFillColor(235, 235, 235);
    doc.rect(M, y, CW, 5, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text(b.titulo.toUpperCase(), M + 2, y + 3.6);
    doc.rect(M, y, CW, h);
    doc.setFont("helvetica", "normal");
    let yy = y + 9;
    for (const ls of linhas) {
      doc.text(ls, M + 2, yy);
      yy += ls.length * 4;
    }
    y += h + 2;
  }

  // Tabela
  if (l.tabela && l.tabela.linhas.length) {
    const n = l.tabela.colunas.length;
    const larg = l.tabela.colunas.map((_, i) => (i === 1 ? CW * 0.34 : (CW * 0.66) / (n - 1)));
    novaPagina(14);
    doc.setFillColor(235, 235, 235);
    doc.rect(M, y, CW, 5, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text(l.tabela.titulo.toUpperCase(), M + 2, y + 3.6);
    y += 5;
    const linha = (cels: string[], bold: boolean) => {
      doc.setFont("helvetica", bold ? "bold" : "normal");
      doc.setFontSize(6.5);
      const partes = cels.map((c, i) => doc.splitTextToSize(c, larg[i]! - 2) as string[]);
      const h = Math.max(...partes.map((p) => p.length)) * 3 + 2;
      novaPagina(h);
      let x = M;
      partes.forEach((p, i) => {
        doc.rect(x, y, larg[i]!, h);
        doc.text(p, x + 1, y + 3);
        x += larg[i]!;
      });
      y += h;
    };
    linha(l.tabela.colunas, true);
    l.tabela.linhas.forEach((r) => linha(r, false));
    y += 2;
  }

  // Totais
  novaPagina(8 + l.totais.length * 5);
  doc.setFillColor(235, 235, 235);
  doc.rect(M, y, CW, 5, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("TOTAIS", M + 2, y + 3.6);
  y += 5;
  const tw = CW / Math.min(l.totais.length, 5);
  l.totais.forEach(([k, v], i) => {
    const col = i % 5;
    if (col === 0 && i > 0) y += 11;
    doc.rect(M + col * tw, y, tw, 11);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.text(k.toUpperCase(), M + col * tw + 1.5, y + 3.5);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text(v, M + col * tw + 1.5, y + 8.5);
  });
  y += 13;

  // Observação
  const obs = doc.splitTextToSize(l.observacao, CW - 4) as string[];
  novaPagina(obs.length * 4 + 8);
  doc.rect(M, y, CW, obs.length * 4 + 6);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.text("INFORMAÇÕES COMPLEMENTARES", M + 2, y + 3.5);
  doc.setFont("helvetica", "normal");
  doc.text(obs, M + 2, y + 7.5);

  doc.save(`${nome}.pdf`);
}

export function baixarXml(xml: string, nome: string) {
  const url = URL.createObjectURL(new Blob([xml], { type: "application/xml;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `${nome}.xml`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
