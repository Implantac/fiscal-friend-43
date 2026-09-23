import { regraById, regras } from "./regras";
import { campoById, campos } from "./campos";
import { testes } from "./testes";
import { nomeFonte } from "./fontes";
import { impactoErpPorRegra } from "./erp";
import type { Procedencia } from "./types";

/** As 6 perguntas que todo conhecimento importante precisa responder. */
export interface RespostaFicha {
  pergunta: string;
  resposta: string;
  ok: boolean;
}

const origem = (p: Procedencia): RespostaFicha => ({
  pergunta: "De onde veio?",
  resposta: p.fonteId === "sem-fonte" ? "Fonte oficial ainda não cadastrada." : nomeFonte(p.fonteId),
  ok: p.fonteId !== "sem-fonte",
});
const versao = (p: Procedencia): RespostaFicha => ({
  pergunta: "Em qual versão / vigência vale?",
  resposta: p.versao || p.vigencia?.inicio
    ? `${p.versao ? `Versão ${p.versao}` : "Versão não informada"} · ${p.vigencia?.inicio ? `desde ${p.vigencia.inicio}` : "vigência não informada"}`
    : "Pendente de validação",
  ok: !!p.versao && !!p.vigencia?.inicio,
});

export function fichaRegra(id: string): RespostaFicha[] {
  const r = regraById.get(id);
  if (!r) return [];
  const exXml = r.campos.map((c) => campoById.get(c)?.exemploXml).filter(Boolean);
  const nTestes = testes.filter((t) => t.regraId === id).length;
  const erp = impactoErpPorRegra[id];
  return [
    origem(r.procedencia),
    versao(r.procedencia),
    { pergunta: "Quais campos afeta?", resposta: r.campos.join(", ") || "Nenhum campo ligado", ok: r.campos.length > 0 },
    { pergunta: "Como aparece no XML?", resposta: exXml.length ? exXml.join("  ") : "Sem exemplo de XML", ok: exXml.length > 0 },
    { pergunta: "Qual erro evita?", resposta: r.cstats.length ? `${r.impacto} (${r.cstats.join(", ")})` : r.impacto, ok: r.cstats.length > 0 },
    { pergunta: "Como testar?", resposta: nTestes ? `${nTestes} caso(s) na Regressão` : "Sem caso de teste", ok: nTestes > 0 },
    { pergunta: "Como implementar no ERP?", resposta: erp ? `${Object.keys(erp).length} etapa(s) do ERP afetadas` : r.prevencao, ok: !!erp },
  ];
}

export function fichaCampo(id: string): RespostaFicha[] {
  const c = campoById.get(id);
  if (!c) return [];
  const nTestes = testes.filter((t) => c.regras.includes(t.regraId)).length;
  return [
    origem(c.procedencia),
    versao(c.procedencia),
    { pergunta: "Quais campos afeta?", resposta: c.influencia.join(", ") || "—", ok: c.influencia.length > 0 },
    { pergunta: "Como aparece no XML?", resposta: c.exemploXml || "Sem exemplo", ok: !!c.exemploXml },
    { pergunta: "Qual erro evita?", resposta: c.cstats.join(", ") || "Nenhuma rejeição ligada", ok: c.cstats.length > 0 },
    { pergunta: "Como testar?", resposta: nTestes ? `${nTestes} caso(s) na Regressão` : c.testes.join("; ") || "Sem teste", ok: nTestes > 0 },
    { pergunta: "Como implementar no ERP?", resposta: c.implementacaoErp.join("; ") || "—", ok: c.implementacaoErp.length > 0 },
  ];
}

export function coberturaFichas() {
  const itens = [
    ...regras.map((r) => ({ id: r.id, tipo: "Regra" as const, ficha: fichaRegra(r.id) })),
    ...campos.map((c) => ({ id: c.id, tipo: "Campo" as const, ficha: fichaCampo(c.id) })),
  ];
  return itens.map((i) => ({ ...i, respondidas: i.ficha.filter((f) => f.ok).length, total: i.ficha.length }));
}
