import { useCallback, useState } from "react";
import { toast } from "sonner";
import type { ResultadoSimulado } from "@/domain/types";
import { useSimulator } from "@/blueprint/SimulatorProvider";
import {
  emissaoGateway,
  nomeDocumento,
  type DocumentoTipo,
  type ProblemaCampo,
} from "@/simulation/emissao-gateway";

/**
 * Orquestra as ações simuladas de rascunho e transmissão de um documento.
 * Nenhuma chamada sai do navegador.
 */
export function useEmissao(tipo: DocumentoTipo) {
  const { registrarLog } = useSimulator();
  const [resultado, setResultado] = useState<ResultadoSimulado | null>(null);
  const [processando, setProcessando] = useState(false);

  const salvar = useCallback(
    async (resumo: string) => {
      setProcessando(true);
      const r = await emissaoGateway.salvarRascunho({ tipo, resumo });
      setProcessando(false);
      setResultado(r);
      registrarLog(`${nomeDocumento[tipo]} · ${r.titulo}`, r.tipo);
      toast.success(r.titulo, { description: r.explicacao });
      return r;
    },
    [tipo, registrarLog],
  );

  const transmitir = useCallback(
    async (opts: {
      resumo: string;
      problemas: ProblemaCampo[];
      online?: boolean;
      forcarFalha?: boolean;
    }) => {
      setProcessando(true);
      const r = await emissaoGateway.transmitir({
        tipo,
        resumo: opts.resumo,
        problemas: opts.problemas,
        ...(opts.online === undefined ? {} : { online: opts.online }),
        ...(opts.forcarFalha === undefined ? {} : { forcarFalha: opts.forcarFalha }),
      });
      setProcessando(false);
      setResultado(r);
      registrarLog(`${nomeDocumento[tipo]} · ${r.titulo}`, r.tipo);
      if (r.tipo === "sucesso") toast.success(r.titulo, { description: r.explicacao });
      else toast.error(r.titulo, { description: r.explicacao });
      return r;
    },
    [tipo, registrarLog],
  );

  return {
    resultado,
    processando,
    salvar,
    transmitir,
    limpar: useCallback(() => setResultado(null), []),
  };
}
