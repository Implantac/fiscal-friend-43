import type { CStat, DocumentoId } from "./types";
import { repositorioLocal } from "./storage";

/**
 * Separação definitiva: base OFICIAL × base DIDÁTICA.
 * A base oficial começa vazia; só recebe itens com fonte, versão e referência.
 */
export type Natureza = "oficial" | "didatico";

export const naturezaLabel: Record<Natureza, string> = { oficial: "Oficial", didatico: "Didático" };

export const naturezaCstat = (c: CStat): Natureza =>
  c.descricaoOficial && c.procedencia.status === "validado" && c.procedencia.fonteId !== "sem-fonte" ? "oficial" : "didatico";

/** Todas as regras e cálculos atuais são exemplos didáticos. */
export const naturezaRegra = (): Natureza => "didatico";
export const naturezaCalculo = (): Natureza => "didatico";

export interface RegistroOficial {
  id: string;
  tipo: "cstat" | "regra" | "calculo";
  codigo: string;
  descricaoOficial: string;
  documento: DocumentoId | "geral";
  fonteId: string;
  referencia: string;
  versao: string;
  vigenciaInicio: string;
  vigenciaFim: string;
  autor: string;
  data: string;
}

export const baseOficialRepo = repositorioLocal<RegistroOficial>("simulador-fiscal:base-oficial");

export function validarRegistroOficial(r: Omit<RegistroOficial, "id" | "data">): string | null {
  if (!r.codigo.trim()) return "Informe o código oficial.";
  if (r.descricaoOficial.trim().length < 5) return "Copie a descrição oficial exatamente como no documento.";
  if (r.fonteId === "sem-fonte") return "Escolha a fonte oficial.";
  if (!r.referencia.trim()) return "Informe onde está no documento (seção, página ou link).";
  if (!r.versao.trim()) return "Informe a versão do documento.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(r.vigenciaInicio)) return "Informe o início da vigência.";
  if (r.autor.trim().length < 2) return "Informe o autor do cadastro.";
  return null;
}
