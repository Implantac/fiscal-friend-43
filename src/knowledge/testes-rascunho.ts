import { repositorioLocal } from "./storage";

/** Casos de teste nascidos de incidentes reais, aguardando aprovação. */
export interface TesteRascunho {
  id: string;
  incidenteId: string;
  documento: string;
  cenario: string;
  cstat: string;
  regras: string[];
  passos: string;
  esperado: string;
  status: "pendente_aprovacao" | "aprovado" | "descartado";
  data: string;
}

export const testesRascunhoRepo = repositorioLocal<TesteRascunho>("simulador-fiscal:testes-rascunho");
