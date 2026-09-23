import { campos } from "./campos";
import { regras } from "./regras";
import { cstats } from "./cstats";
import { calculos } from "./calculos";
import { cenarios } from "./cenarios";
import { documentos } from "./documentos";
import { fontes } from "./fontes";
import { testes } from "./testes";
import type { Procedencia } from "./types";

/** Tudo aqui é calculado a partir da base existente — nenhum número é inventado. */

const temFonte = (p: Procedencia) => p.fonteId !== "sem-fonte";
const temVersao = (p: Procedencia) => !!p.versao;
const temVigencia = (p: Procedencia) => !!p.vigencia?.inicio;

export interface Lacuna {
  tipo: string;
  item: string;
  destino: { to: "/conhecimento" | "/debugger" | "/cstat" | "/math-lab" | "/cenarios"; search?: Record<string, string> };
}

export function detectarLacunas(): Lacuna[] {
  const l: Lacuna[] = [];
  const regrasTestadas = new Set(testes.map((t) => t.regraId));
  const regrasCitadasEmCstat = new Set(cstats.flatMap((c) => c.regras));

  for (const r of regras) {
    const d = { to: "/debugger" as const, search: { regra: r.id } };
    if (!temFonte(r.procedencia)) l.push({ tipo: "Regra sem fonte oficial", item: r.id, destino: d });
    if (!regrasTestadas.has(r.id)) l.push({ tipo: "Regra sem caso de teste", item: r.id, destino: d });
    if (r.cstats.length === 0) l.push({ tipo: "Regra sem rejeição relacionada", item: r.id, destino: d });
  }
  for (const c of campos) {
    const d = { to: "/conhecimento" as const, search: { doc: c.documento, campo: c.id } };
    if (c.regras.length === 0) l.push({ tipo: "Campo sem regra", item: c.id, destino: d });
    if (!c.exemploXml) l.push({ tipo: "XML sem documentação", item: c.id, destino: d });
    if (!temVersao(c.procedencia)) l.push({ tipo: "Conteúdo sem versão", item: c.id, destino: d });
    if (!temVigencia(c.procedencia)) l.push({ tipo: "Conteúdo sem vigência", item: c.id, destino: d });
  }
  for (const c of cstats) {
    const d = { to: "/cstat" as const, search: { codigo: c.codigo } };
    if (c.regras.length === 0 && !regrasCitadasEmCstat.has(c.codigo)) l.push({ tipo: "Rejeição sem regra", item: c.codigo, destino: d });
    if (!c.descricaoOficial) l.push({ tipo: "Rejeição sem código oficial conferido", item: c.codigo, destino: d });
  }
  for (const c of calculos) {
    l.push({ tipo: "Cálculo sem caso de teste", item: c.nome, destino: { to: "/math-lab" } });
  }
  for (const c of cenarios) {
    if (!c.xml) l.push({ tipo: "Cenário sem XML", item: c.nome, destino: { to: "/cenarios" } });
  }
  return l;
}

export interface Completude {
  id: string;
  tipo: "Campo" | "Regra";
  itens: { rotulo: string; ok: boolean }[];
}

export function completude(): Completude[] {
  const regrasTestadas = new Set(testes.map((t) => t.regraId));
  return [
    ...campos.map((c) => ({
      id: c.id,
      tipo: "Campo" as const,
      itens: [
        { rotulo: "Fonte", ok: temFonte(c.procedencia) },
        { rotulo: "Versão", ok: temVersao(c.procedencia) },
        { rotulo: "Vigência", ok: temVigencia(c.procedencia) },
        { rotulo: "Regra", ok: c.regras.length > 0 },
        { rotulo: "Teste", ok: c.regras.some((r) => regrasTestadas.has(r)) },
        { rotulo: "XML", ok: !!c.exemploXml },
        { rotulo: "CStat", ok: c.cstats.length > 0 },
        { rotulo: "ERP", ok: c.implementacaoErp.length > 0 },
      ],
    })),
    ...regras.map((r) => ({
      id: r.id,
      tipo: "Regra" as const,
      itens: [
        { rotulo: "Fonte", ok: temFonte(r.procedencia) },
        { rotulo: "Versão", ok: temVersao(r.procedencia) },
        { rotulo: "Vigência", ok: temVigencia(r.procedencia) },
        { rotulo: "Campo", ok: r.campos.length > 0 },
        { rotulo: "Teste", ok: regrasTestadas.has(r.id) },
        { rotulo: "CStat", ok: r.cstats.length > 0 },
        { rotulo: "ERP", ok: !!r.prevencao },
      ],
    })),
  ];
}

export function indicadores() {
  const todas: Procedencia[] = [
    ...documentos.map((d) => d.procedencia),
    ...campos.map((c) => c.procedencia),
    ...regras.map((r) => r.procedencia),
    ...calculos.map((c) => c.procedencia),
    ...cstats.map((c) => c.procedencia),
    ...cenarios.map((c) => c.procedencia),
  ];
  const conta = (s: string) => todas.filter((p) => p.status === s).length;
  return {
    documentos: documentos.length,
    campos: campos.length,
    regras: regras.length,
    calculos: calculos.length,
    cstatsOficiais: cstats.filter((c) => !!c.descricaoOficial).length,
    cstatsDidaticos: cstats.filter((c) => !c.descricaoOficial).length,
    cenarios: cenarios.length,
    testes: testes.length,
    fontes: fontes.filter((f) => f.id !== "sem-fonte").length,
    validados: conta("validado"),
    ilustrativos: conta("ilustrativo"),
    pendentes: conta("pendente"),
    obsoletos: conta("obsoleto"),
  };
}
