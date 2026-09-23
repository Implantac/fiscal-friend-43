import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { ManifestacaoTipo, NotaRecebida, ResultadoSimulado } from "@/domain/types";
import { notasIniciais } from "@/simulation/mock-data";
import { fiscalGateway, rotuloManifestacao } from "@/simulation/fiscal-gateway";

interface LogEntry {
  id: string;
  em: string;
  texto: string;
  tipo: ResultadoSimulado["tipo"];
}

interface SimulatorState {
  devMode: boolean;
  setDevMode: (v: boolean) => void;
  docId: string | null;
  selectDoc: (id: string | null) => void;
  notas: NotaRecebida[];
  manifestar: (
    notaId: string,
    tipo: ManifestacaoTipo,
    justificativa?: string,
  ) => Promise<ResultadoSimulado>;
  baixarXml: (notaId: string) => Promise<ResultadoSimulado>;
  log: LogEntry[];
  registrarLog: (texto: string, tipo: ResultadoSimulado["tipo"]) => void;
}

const Ctx = createContext<SimulatorState | null>(null);

const uid = () => Math.random().toString(36).slice(2, 10);

export function SimulatorProvider({ children }: { children: ReactNode }) {
  const [devMode, setDevMode] = useState(false);
  const [docId, setDocId] = useState<string | null>(null);
  const [notas, setNotas] = useState<NotaRecebida[]>(notasIniciais);
  const [log, setLog] = useState<LogEntry[]>([]);

  const registrarLog = useCallback((texto: string, tipo: ResultadoSimulado["tipo"]) => {
    setLog((prev) =>
      [{ id: uid(), em: new Date().toISOString(), texto, tipo }, ...prev].slice(0, 30),
    );
  }, []);

  const selectDoc = useCallback((id: string | null) => setDocId(id), []);

  const manifestar = useCallback(
    async (notaId: string, tipo: ManifestacaoTipo, justificativa?: string) => {
      const nota = notas.find((n) => n.id === notaId);
      if (!nota) {
        return {
          tipo: "erro_local" as const,
          titulo: "Nota não encontrada",
          mensagemTecnica: "estado_local: id inexistente",
          explicacao: "O documento selecionado não está mais na lista carregada.",
          acaoSugerida: "Atualize a lista e tente novamente.",
        };
      }
      const resultado = await fiscalGateway.manifestar({ nota, tipo, justificativa });

      setNotas((prev) =>
        prev.map((n) =>
          n.id !== notaId
            ? n
            : {
                ...n,
                status: resultado.tipo === "sucesso" ? tipo : n.status,
                historico: [
                  {
                    id: uid(),
                    em: new Date().toISOString(),
                    titulo: `${rotuloManifestacao[tipo]} — ${resultado.titulo}`,
                    detalhe: resultado.mensagemTecnica,
                    origem:
                      resultado.tipo === "erro_local"
                        ? ("local" as const)
                        : resultado.tipo === "erro_provedor"
                          ? ("provedor_simulado" as const)
                          : ("sefaz_simulada" as const),
                    resultado:
                      resultado.tipo === "sucesso"
                        ? ("sucesso" as const)
                        : resultado.tipo === "rejeicao_fiscal"
                          ? ("rejeicao" as const)
                          : ("erro" as const),
                  },
                  ...n.historico,
                ],
              },
        ),
      );

      registrarLog(`${rotuloManifestacao[tipo]} · ${nota.emitente}: ${resultado.titulo}`, resultado.tipo);
      return resultado;
    },
    [notas, registrarLog],
  );

  const baixarXml = useCallback(
    async (notaId: string) => {
      const nota = notas.find((n) => n.id === notaId);
      if (!nota) {
        return {
          tipo: "erro_local" as const,
          titulo: "Nota não encontrada",
          mensagemTecnica: "estado_local: id inexistente",
          explicacao: "O documento selecionado não está mais na lista carregada.",
          acaoSugerida: "Atualize a lista e tente novamente.",
        };
      }
      const resultado = await fiscalGateway.baixarXml(nota);
      registrarLog(`Download de XML · ${nota.emitente}: ${resultado.titulo}`, resultado.tipo);
      return resultado;
    },
    [notas, registrarLog],
  );

  const value = useMemo<SimulatorState>(
    () => ({
      devMode,
      setDevMode,
      docId,
      selectDoc,
      notas,
      manifestar,
      baixarXml,
      log,
      registrarLog,
    }),
    [devMode, docId, selectDoc, notas, manifestar, baixarXml, log, registrarLog],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSimulator() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useSimulator precisa estar dentro de SimulatorProvider");
  return ctx;
}
