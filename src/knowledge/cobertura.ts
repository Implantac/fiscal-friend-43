/**
 * Matriz de cobertura real por modelo de documento.
 *
 * Este módulo existe para responder uma pergunta que a navegação antiga
 * respondia de forma enganosa: "quais modelos o sistema cobre?".
 *
 * Regra inegociável: cada capacidade declara o que ela É. Capacidade
 * `simulada` produz XML de demonstração, sem XSD, sem assinatura e sem
 * transmissão — nunca pode ser apresentada como emissão. Capacidade
 * `estrutural` existe código real e testado, mas não foi homologada contra
 * serviço fiscal algum. Nada aqui declara "pronto para produção".
 *
 * A lista de documentos vem de `src/knowledge/documentos.ts`; a avaliação de
 * capacidade vem do que o código faz hoje, não do que a tela promete.
 */

import { documentos } from "./documentos";

export type NivelCapacidade =
  /** Nada implementado além da documentação. */
  | "documentado"
  /** Código real e testado no domínio, sem integração externa provada. */
  | "estrutural"
  /** Tela de simulação: demonstra o fluxo, não emite documento válido. */
  | "simulado";

export interface Capacidade {
  area: string;
  nivel: NivelCapacidade;
  /** O que exatamente existe hoje, em uma frase. */
  realidade: string;
}

export interface CoberturaModelo {
  documentoId: string;
  sigla: string;
  modelo?: string;
  nome: string;
  /** Rota da tela de simulação, quando existir. */
  rotaSimulacao?: string;
  capacidades: Capacidade[];
  pendencias: string[];
}

export const nivelLabel: Record<NivelCapacidade, string> = {
  documentado: "Documentado",
  estrutural: "Estrutura real",
  simulado: "Simulado",
};

export const nivelDescricao: Record<NivelCapacidade, string> = {
  documentado: "Existe descrição fiscal do modelo; não há código de emissão.",
  estrutural:
    "Existe código de domínio testado (estados, numeração, valores), sem transmissão comprovada.",
  simulado:
    "Tela de simulação: monta XML de demonstração e não emite documento válido. Sem XSD, sem assinatura, sem envio a SEFAZ ou provedor.",
};

/** Capacidades comuns a todos os modelos, no mesmo grau de maturidade. */
const CAPACIDADES_COMUNS: Capacidade[] = [
  {
    area: "Ciclo de vida do documento",
    nivel: "estrutural",
    realidade:
      "Máquina de 11 estados com transições validadas, histórico imutável e `autorizado` inalcançável sem resposta oficial.",
  },
  {
    area: "Numeração",
    nivel: "estrutural",
    realidade:
      "Numeração por série com controle de concorrência no domínio; faixas e credenciamento não verificados.",
  },
  {
    area: "Chave de acesso e dígito verificador",
    nivel: "estrutural",
    realidade:
      "Estrutura de 44 posições e DV módulo 11 implementados em `src/fiscal/chave-acesso.ts`, verificados contra exemplo publicado no MOC 7.00, com suporte a CNPJ alfanumérico (IN RFB 2.229/2024).",
  },
  {
    area: "Registro de regras fiscais",
    nivel: "estrutural",
    realidade:
      "5 regras com fonte normativa identificada e caso de teste falseável: chave de acesso (estrutura, DV, caractere), CFOP (primeiro dígito) e CST (Tabela A + Tabela B). Todas em `validada_tecnicamente` — o texto original dos atos não foi conferido, então nenhuma está liberada para cálculo real.",
  },
  {
    area: "Classificação fiscal (CFOP, CST, CSOSN)",
    nivel: "estrutural",
    realidade:
      "Tabelas oficiais em `src/fiscal/classificacao.ts` e classificador que as consulta. Quando a tabela não cobre o caso, devolve pendência em vez de inventar código. **A escolha entre as situações da Tabela B não é decidida** — depende de legislação estadual e de cadastro.",
  },
  {
    area: "Valores monetários",
    nivel: "estrutural",
    realidade:
      "Inteiros em centavos (`bigint`) ponta a ponta; arredondamento de regra fiscal ainda não aplicado.",
  },
  {
    area: "Multi-tenant e isolamento",
    nivel: "estrutural",
    realidade:
      "RLS com `FORCE ROW LEVEL SECURITY` e contexto de tenant por transação; nunca exercido contra Postgres real.",
  },
  {
    area: "XSD e assinatura digital",
    nivel: "documentado",
    realidade: "Nenhum XSD validado e nenhum certificado carregado.",
  },
  {
    area: "Transmissão a SEFAZ ou provedor",
    nivel: "documentado",
    realidade:
      "Nenhum adaptador implementado. Nenhuma chamada de rede a serviço fiscal existe no repositório.",
  },
];

const ESPECIFICAS: Record<string, Capacidade[]> = {
  nfe55: [
    {
      area: "Grade de itens e totais",
      nivel: "simulado",
      realidade: "Itens, NCM, desconto e frete somados apenas para exibição.",
    },
    {
      area: "Sugestão de CFOP",
      nivel: "simulado",
      realidade: "Heurística de 4 códigos; não cobre devolução, remessa ou exportação.",
    },
    {
      area: "Prévia tributária",
      nivel: "simulado",
      realidade: "Percentuais arbitrários de cenário, sem fonte oficial.",
    },
  ],
  nfce65: [
    {
      area: "Frente de caixa",
      nivel: "simulado",
      realidade: "Inclusão de itens por produto e quantidade, com fila local de demonstração.",
    },
    {
      area: "Formas de pagamento",
      nivel: "simulado",
      realidade: "Meios mapeados por tabela interna; códigos oficiais não confirmados.",
    },
    {
      area: "Contingência",
      nivel: "simulado",
      realidade:
        "Interruptor de conexão fictício; nenhuma modalidade de contingência implementada.",
    },
  ],
  nfse: [
    {
      area: "Tomador e serviço",
      nivel: "simulado",
      realidade: "Campos de tomador, código de serviço e valor; códigos municipais fictícios.",
    },
    {
      area: "Tributação municipal",
      nivel: "simulado",
      realidade: "Bloco opcional com alíquota de cenário; nenhuma lista municipal versionada.",
    },
  ],
  cte57: [
    {
      area: "Vinculação de documentos",
      nivel: "simulado",
      realidade: "Leitura de XML por expressão regular no navegador; não valida assinatura.",
    },
    {
      area: "Composição do frete",
      nivel: "simulado",
      realidade: "Componentes somados para exibição; nomes e códigos não confirmados.",
    },
  ],
  cteos67: [
    {
      area: "Modalidades",
      nivel: "simulado",
      realidade: "Abas de pessoas e valores com campos próprios por modalidade.",
    },
    {
      area: "Grade de malotes",
      nivel: "simulado",
      realidade: "Proposta de leiaute; não espelha o leiaute oficial.",
    },
  ],
  mdfe58: [
    {
      area: "Documentos manifestados",
      nivel: "simulado",
      realidade: "Seleção de chaves sem consulta à situação real de cada documento.",
    },
    {
      area: "Condutor, veículo e percurso",
      nivel: "simulado",
      realidade: "Cadastro e lista de UFs sem validação de contiguidade.",
    },
  ],
};

/** Modelos previstos no escopo e ainda sem nenhuma tela. */
export const MODELOS_PENDENTES: Array<{
  sigla: string;
  nome: string;
  motivo: string;
}> = [
  {
    sigla: "NF3e",
    nome: "Nota Fiscal de Energia Elétrica",
    motivo: "Fora do escopo entregue até aqui.",
  },
  {
    sigla: "NFCom",
    nome: "Nota Fiscal de Comunicação",
    motivo: "Fora do escopo entregue até aqui.",
  },
  {
    sigla: "BP-e",
    nome: "Bilhete de Passagem Eletrônico",
    motivo: "Fora do escopo entregue até aqui.",
  },
  {
    sigla: "DERE",
    nome: "Declaração de Excesso de Receita",
    motivo: "Fora do escopo entregue até aqui.",
  },
];

/**
 * Monta a matriz a partir do catálogo de documentos. A procedência vem do
 * próprio catálogo — se um item nasceu `pendente`, ele aparece `pendente`.
 */
export function matrizCobertura(): CoberturaModelo[] {
  return documentos
    .filter((d) => d.id !== "eventos")
    .map((d) => {
      const especificas = ESPECIFICAS[d.id] ?? [];
      const capacidades = [...CAPACIDADES_COMUNS, ...especificas];
      return {
        documentoId: d.id,
        sigla: d.sigla,
        ...(d.modelo !== undefined ? { modelo: d.modelo } : {}),
        nome: d.nome,
        rotaSimulacao: d.rota,
        capacidades,
        pendencias: [...(d.pendencias ?? []), ...pendenciasDoModelo(d.id)],
      };
    });
}

function pendenciasDoModelo(id: string): string[] {
  const comuns = [
    "Credenciamento, certificado digital e ambiente de homologação não verificados.",
    "Nenhum documento foi autorizado por serviço fiscal em nenhum ambiente.",
  ];
  const especificas: Record<string, string[]> = {
    nfse: ["Cada município tem leiaute próprio; nenhum foi implementado."],
    nfce: ["Regras de contingência variam por UF e nenhuma foi fixada."],
    cte57: ["Extração por regex não substitui parser validado no servidor."],
    mdfe: ["Situação dos documentos vinculados não é consultada em lugar algum."],
  };
  return [...comuns, ...(especificas[id] ?? [])];
}

/** Contagem por nível, para o resumo do topo da página. */
export function resumoCobertura(): Record<NivelCapacidade, number> {
  const todos = matrizCobertura().flatMap((m) => m.capacidades);
  return {
    documentado: todos.filter((c) => c.nivel === "documentado").length,
    estrutural: todos.filter((c) => c.nivel === "estrutural").length,
    simulado: todos.filter((c) => c.nivel === "simulado").length,
  };
}
