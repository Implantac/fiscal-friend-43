import type { ResultadoSimulado } from "@/domain/types";

export type DocumentoTipo = "nfe55" | "nfce65" | "nfse" | "cte57" | "cteos67" | "mdfe58";

export interface ProblemaCampo {
  campo: string;
  mensagem: string;
  docId?: string;
}

export interface TransmissaoInput {
  tipo: DocumentoTipo;
  resumo: string;
  problemas: ProblemaCampo[];
  /** Cenário de conectividade simulada; quando false, demonstra contingência/fila. */
  online?: boolean;
  /** Força o cenário de falha didático. */
  forcarFalha?: boolean;
}

/** Porta de saída. No sistema real, a implementação chamará o back-end Python. */
export interface EmissaoGateway {
  salvarRascunho(input: { tipo: DocumentoTipo; resumo: string }): Promise<ResultadoSimulado>;
  transmitir(input: TransmissaoInput): Promise<ResultadoSimulado>;
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

const nomeDoc: Record<DocumentoTipo, string> = {
  nfe55: "NF-e modelo 55",
  nfce65: "NFC-e modelo 65",
  nfse: "NFS-e",
  cte57: "CT-e modelo 57",
  cteos67: "CT-e OS modelo 67",
  mdfe58: "MDF-e modelo 58",
};

export class MockEmissaoGateway implements EmissaoGateway {
  async salvarRascunho({ tipo, resumo }: { tipo: DocumentoTipo; resumo: string }) {
    await delay(350);
    return {
      tipo: "sucesso" as const,
      titulo: `Rascunho de ${nomeDoc[tipo]} salvo (simulado)`,
      mensagemTecnica: `mock_gateway: rascunho mantido apenas na sessão — ${resumo}`,
      explicacao: "O rascunho existe somente nesta sessão do navegador.",
      acaoSugerida: "No sistema real, o rascunho deve ser persistido pelo back-end.",
    };
  }

  async transmitir({ tipo, resumo, problemas, online = true, forcarFalha }: TransmissaoInput) {
    await delay(800);

    if (problemas.length > 0) {
      const p = problemas[0]!;
      return {
        tipo: "erro_local" as const,
        titulo: "Documento não passou na validação da interface",
        mensagemTecnica: `validacao_local: ${problemas.map((x) => x.campo).join(", ")}`,
        explicacao: p.mensagem,
        acaoSugerida: "Corrija os campos destacados antes de transmitir.",
        ...(p.docId ? { docId: p.docId } : {}),
      };
    }

    if (!online) {
      return {
        tipo: "erro_provedor" as const,
        titulo: "Sem conexão — documento enviado para a fila (simulado)",
        mensagemTecnica: "mock_gateway: network_unavailable, documento enfileirado",
        explicacao:
          "O documento ficou pendente de transmissão. Contingência offline depende da UF, do modelo e da regulamentação vigente — este protótipo apenas demonstra a fila.",
        acaoSugerida: "Restabeleça a conexão simulada e processe a fila.",
      };
    }

    if (forcarFalha) {
      return {
        tipo: "rejeicao_fiscal" as const,
        titulo: "Documento recusado no cenário simulado",
        mensagemTecnica: `mock_gateway: retorno fictício de recusa para ${nomeDoc[tipo]}`,
        explicacao:
          "Cenário didático de rejeição. O código oficial não é exibido porque ainda não foi confirmado em manual versionado.",
        acaoSugerida:
          "Revise os dados do documento e registre o código oficial quando a referência for validada.",
      };
    }

    return {
      tipo: "sucesso" as const,
      titulo: `${nomeDoc[tipo]} transmitida (simulado)`,
      mensagemTecnica: `mock_gateway: protocolo fictício 999260000000${Math.floor(Math.random() * 900 + 100)} — ${resumo}`,
      explicacao:
        "Resultado gerado pela camada de simulação. Nenhum documento fiscal foi emitido ou transmitido.",
      acaoSugerida: "Use o painel técnico para ver o que o back-end precisará montar de verdade.",
    };
  }
}

export const emissaoGateway: EmissaoGateway = new MockEmissaoGateway();
export const nomeDocumento = nomeDoc;
