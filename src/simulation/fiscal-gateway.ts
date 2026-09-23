import type { ManifestacaoTipo, NotaRecebida, ResultadoSimulado } from "@/domain/types";

/**
 * Porta de saída do domínio. No sistema real, uma implementação desta interface
 * chamará o back-end Python, que por sua vez fala com TecnoSpeed / PlugNotas.
 * Nenhum componente visual deve conhecer o provedor.
 */
export interface FiscalGateway {
  manifestar(input: {
    nota: NotaRecebida;
    tipo: ManifestacaoTipo;
    justificativa?: string;
  }): Promise<ResultadoSimulado>;
  baixarXml(nota: NotaRecebida): Promise<ResultadoSimulado>;
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const rotuloManifestacao: Record<ManifestacaoTipo, string> = {
  ciencia: "Ciência da Operação",
  confirmacao: "Confirmação da Operação",
  nao_realizada: "Operação não Realizada",
  desconhecimento: "Desconhecimento da Operação",
};

/** Implementação simulada. Não realiza nenhuma chamada externa. */
export class MockFiscalGateway implements FiscalGateway {
  async manifestar({
    nota,
    tipo,
    justificativa,
  }: {
    nota: NotaRecebida;
    tipo: ManifestacaoTipo;
    justificativa?: string;
  }): Promise<ResultadoSimulado> {
    await delay(700);

    const exigeJustificativa = tipo === "nao_realizada" || tipo === "desconhecimento";
    if (exigeJustificativa && (justificativa ?? "").trim().length < 15) {
      return {
        tipo: "erro_local",
        titulo: "Justificativa insuficiente",
        mensagemTecnica: "validacao_local: justificativa.length < 15",
        explicacao:
          "Este tipo de manifestação, no cenário configurado, exige uma justificativa com pelo menos 15 caracteres.",
        acaoSugerida: "Descreva o motivo da recusa e envie novamente.",
        docId: "m1.manifestar",
      };
    }

    if (nota.status === tipo) {
      return {
        tipo: "rejeicao_fiscal",
        titulo: "Evento já registrado para esta nota (cenário simulado)",
        mensagemTecnica:
          "retorno_simulado: evento equivalente já existe para a chave informada",
        explicacao:
          "O cenário demonstra a recusa por repetição do mesmo evento. O código oficial de rejeição não foi fixado aqui porque ainda não foi confirmado em manual versionado.",
        acaoSugerida:
          "Confira o histórico da nota antes de reenviar e registre o código oficial quando a referência for validada.",
        docId: "m1.manifestar",
      };
    }

    // Cenário determinístico de falha do provedor, para treinar o tratamento de erro.
    if (nota.id === "nf-4") {
      return {
        tipo: "erro_provedor",
        titulo: "Provedor simulado indisponível",
        mensagemTecnica: "mock_provider: timeout após 30000ms ao enviar evento",
        explicacao:
          "A comunicação com o provedor falhou antes de chegar à SEFAZ. Nenhum evento foi registrado.",
        acaoSugerida:
          "Tente novamente em alguns instantes. Se persistir, verifique a disponibilidade do serviço com a equipe de integração.",
        docId: "m1.manifestar",
      };
    }

    return {
      tipo: "sucesso",
      titulo: `${rotuloManifestacao[tipo]} registrada (simulado)`,
      mensagemTecnica: "mock_provider: retorno fictício, protocolo 999260000000001",
      explicacao:
        "Resultado gerado pela camada de simulação. Nenhum evento foi transmitido à SEFAZ.",
      acaoSugerida: "Confira o histórico da nota para ver o registro da ação.",
      docId: "m1.manifestar",
    };
  }

  async baixarXml(nota: NotaRecebida): Promise<ResultadoSimulado> {
    await delay(500);
    if (!nota.xmlDisponivel) {
      return {
        tipo: "erro_provedor",
        titulo: "XML indisponível neste cenário",
        mensagemTecnica: "mock_provider: documento não encontrado na base simulada",
        explicacao:
          "Neste cenário demonstrativo o arquivo ainda não está na base. A disponibilidade do XML varia conforme a situação e não segue uma regra única.",
        acaoSugerida:
          "Verifique com a equipe de integração qual mecanismo de distribuição será usado para obter o arquivo.",
        docId: "m1.xml",
      };
    }
    return {
      tipo: "sucesso",
      titulo: "Download simulado concluído",
      mensagemTecnica: "mock_provider: arquivo fictício gerado em memória",
      explicacao: "O conteúdo é um exemplo didático, não é um documento fiscal autorizado.",
      acaoSugerida: "Use apenas para conferência do fluxo.",
      docId: "m1.xml",
    };
  }
}

export const fiscalGateway: FiscalGateway = new MockFiscalGateway();
