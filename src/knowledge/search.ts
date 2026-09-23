import { documentos } from "./documentos";
import { campos } from "./campos";
import { regras } from "./regras";
import { cstats } from "./cstats";
import { calculos } from "./calculos";
import { cenarios } from "./cenarios";
import { trilhas, desafios } from "./academia";

export type TipoResultado =
  | "Documento"
  | "Campo"
  | "Tag XML"
  | "Regra"
  | "Rejeição"
  | "Cálculo"
  | "Cenário"
  | "Aula"
  | "Desafio";

export interface ItemBusca {
  id: string;
  tipo: TipoResultado;
  titulo: string;
  descricao: string;
  rota: string;
  termos: string;
  /** Cadeia fiscal resumida: rejeição → regra → campo → XML → aula. */
  cadeia?: string;
}

const cadeia = (partes: (string | number | false)[]) =>
  partes.filter((p): p is string => typeof p === "string" && p.length > 0).join(" → ");

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

export const indiceBusca: ItemBusca[] = [
  ...documentos.map<ItemBusca>((d) => ({
    id: `doc:${d.id}`,
    tipo: "Documento",
    titulo: `${d.sigla}${d.modelo ? ` ${d.modelo}` : ""} — ${d.nome}`,
    descricao: d.oQueE,
    rota: `/conhecimento?doc=${d.id}`,
    termos: `${d.sigla} ${d.modelo ?? ""} ${d.nome} ${d.oQueE}`,
  })),
  ...campos.map<ItemBusca>((c) => ({
    id: `campo:${c.id}`,
    tipo: "Campo",
    titulo: `${c.nome} (${c.tagXml})`,
    descricao: c.conceito,
    rota: `/conhecimento?campo=${c.id}`,
    termos: `${c.nome} ${c.tagXml} ${c.grupoXml} ${c.conceito} ${c.id}`,
    cadeia: cadeia([c.regras.length && `${c.regras.length} regra(s)`, `XML <${c.tagXml}>`, c.cstats.length && `${c.cstats.length} rejeição(ões)`]),
  })),
  ...campos.map<ItemBusca>((c) => ({
    id: `tag:${c.id}`,
    tipo: "Tag XML",
    titulo: c.tagXml,
    descricao: `${c.grupoXml} · ${c.nome}`,
    rota: `/xml-lab?campo=${c.id}`,
    termos: `${c.tagXml} ${c.grupoXml}`,
  })),
  ...regras.map<ItemBusca>((r) => ({
    id: `regra:${r.id}`,
    tipo: "Regra",
    titulo: `${r.id} — ${r.titulo}`,
    descricao: r.explicacaoSimples,
    rota: `/debugger?regra=${r.id}`,
    termos: `${r.id} ${r.titulo} ${r.explicacaoSimples} ${r.condicaoTecnica}`,
    cadeia: cadeia([`campos: ${r.campos.join(", ") || "—"}`, `rejeições: ${r.cstats.join(", ") || "—"}`]),
  })),
  ...cstats.map<ItemBusca>((c) => ({
    id: `cstat:${c.codigo}`,
    tipo: "Rejeição",
    titulo: c.situacao,
    descricao: c.causaProvavel,
    rota: `/cstat?codigo=${c.codigo}`,
    termos: `${c.codigo} ${c.situacao} ${c.causaProvavel} ${c.campos.join(" ")}`,
    cadeia: cadeia([`regras: ${c.regras.join(", ") || "—"}`, `campos: ${c.campos.join(", ") || "—"}`, "correção", "teste"]),
  })),
  ...calculos.map<ItemBusca>((c) => ({
    id: `calc:${c.id}`,
    tipo: "Cálculo",
    titulo: c.nome,
    descricao: c.formula,
    rota: `/math-lab?calc=${c.id}`,
    termos: `${c.nome} ${c.formula} ${c.grupo}`,
  })),
  ...cenarios.map<ItemBusca>((c) => ({
    id: `cen:${c.id}`,
    tipo: "Cenário",
    titulo: c.nome,
    descricao: c.objetivo,
    rota: `/cenarios?id=${c.id}`,
    termos: `${c.nome} ${c.objetivo} ${c.operacao} ${c.tributacao.join(" ")}`,
  })),
  ...trilhas.flatMap<ItemBusca>((t) =>
    t.aulas.map((a) => ({
      id: `aula:${a.id}`,
      tipo: "Aula" as const,
      titulo: a.titulo,
      descricao: `Trilha ${t.numero} — ${t.titulo}`,
      rota: `/academia?trilha=${t.id}`,
      termos: `${a.titulo} ${a.conceito} ${t.titulo}`,
    })),
  ),
  ...desafios.map<ItemBusca>((d) => ({
    id: `desafio:${d.id}`,
    tipo: "Desafio",
    titulo: d.titulo,
    descricao: d.enunciado,
    rota: `/academia?desafio=${d.id}`,
    termos: `${d.titulo} ${d.enunciado}`,
  })),
];

export function buscar(consulta: string, limite = 24): ItemBusca[] {
  const q = norm(consulta.trim());
  if (!q) return [];
  return indiceBusca
    .filter((i) => norm(`${i.titulo} ${i.descricao} ${i.termos}`).includes(q))
    .slice(0, limite);
}
