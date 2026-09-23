import type { Procedencia } from "./types";
import { repositorioLocal } from "./storage";

/** Ciclo profissional de revisão do conhecimento. */
export const ciclo = ["rascunho", "pendente", "em_revisao", "validado", "publicado", "obsoleto"] as const;
export type StatusGovernanca = (typeof ciclo)[number];

export const governancaLabel: Record<StatusGovernanca, string> = {
  rascunho: "Rascunho",
  pendente: "Pendente de validação",
  em_revisao: "Em revisão",
  validado: "Validado",
  publicado: "Publicado",
  obsoleto: "Obsoleto",
};

export interface RevisaoRegistro {
  id: string;
  itemId: string;
  de: StatusGovernanca;
  para: StatusGovernanca;
  autor: string;
  revisor: string;
  data: string;
  fonteId: string;
  versao: string;
  justificativa: string;
}

export const revisoesRepo = repositorioLocal<RevisaoRegistro>("simulador-fiscal:revisoes");

export function statusInicial(p: Procedencia): StatusGovernanca {
  if (p.status === "validado") return "validado";
  if (p.status === "obsoleto") return "obsoleto";
  if (p.status === "pendente") return "pendente";
  return "rascunho";
}

export function historico(itemId: string, todas = revisoesRepo.listar()) {
  return todas.filter((r) => r.itemId === itemId).sort((a, b) => a.data.localeCompare(b.data));
}

export function statusAtual(itemId: string, p: Procedencia, todas?: RevisaoRegistro[]) {
  const h = historico(itemId, todas);
  return h.length ? h[h.length - 1]!.para : statusInicial(p);
}

/** Próximos passos permitidos: avançar uma etapa ou tornar obsoleto. */
export function proximos(s: StatusGovernanca): StatusGovernanca[] {
  const i = ciclo.indexOf(s);
  const r: StatusGovernanca[] = [];
  if (s === "em_revisao") r.push("pendente");
  if (i < ciclo.length - 2) r.push(ciclo[i + 1]!);
  if (s !== "obsoleto") r.push("obsoleto");
  if (s === "obsoleto") r.push("rascunho");
  return r;
}

/** Retorna mensagem de bloqueio, ou null se a transição é permitida. */
export function validarTransicao(r: Omit<RevisaoRegistro, "id" | "data">): string | null {
  if (r.autor.trim().length < 2) return "Informe o autor.";
  if (r.justificativa.trim().length < 15) return "A justificativa precisa de pelo menos 15 caracteres.";
  if (r.para === "em_revisao" && r.revisor.trim().length < 2) return "Informe quem vai revisar.";
  if (r.para === "validado" || r.para === "publicado") {
    if (r.fonteId === "sem-fonte") return "Só é possível validar com fonte oficial cadastrada.";
    if (!r.versao.trim()) return "Informe a versão do documento oficial consultado.";
    if (r.revisor.trim().length < 2) return "Validação exige revisor.";
    if (r.revisor.trim().toLowerCase() === r.autor.trim().toLowerCase()) return "Revisor deve ser diferente do autor.";
  }
  return null;
}
