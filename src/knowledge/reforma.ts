import type { Procedencia } from "./types";

/**
 * Área da Reforma Tributária. TUDO aqui é pendente de validação: leiautes,
 * alíquotas, códigos de classificação e cronograma continuam em evolução.
 */
export const procedenciaReforma: Procedencia = {
  status: "pendente",
  fonteId: "reforma",
  vigencia: {
    observacao:
      "Cronograma, alíquotas e leiautes em evolução. Nada nesta área deve ser tratado como definitivo.",
  },
};

export interface TopicoReforma {
  id: string;
  titulo: string;
  conteudo: string[];
}

export const conceitoReforma: TopicoReforma[] = [
  {
    id: "ref.conceito",
    titulo: "Conceito e objetivo",
    conteudo: [
      "A reforma do consumo substitui um conjunto de tributos por um modelo de valor agregado com duas bases: IBS, de competência compartilhada entre estados e municípios, e CBS, de competência federal.",
      "O Imposto Seletivo (IS) incide sobre bens e serviços específicos definidos em lei.",
      "O objetivo declarado é simplificar a apuração, dar não cumulatividade ampla e mover a arrecadação para o destino.",
    ],
  },
  {
    id: "ref.transicao",
    titulo: "Período de transição",
    conteudo: [
      "Durante a transição, o modelo atual e o novo modelo coexistem nos documentos fiscais.",
      "O ERP precisa manter as duas apurações simultaneamente e saber qual vale para cada operação e data.",
      "Datas e percentuais de transição não estão registrados neste ambiente: dependem da legislação vigente na consulta.",
    ],
  },
  {
    id: "ref.documentos",
    titulo: "Documentos afetados",
    conteudo: [
      "NF-e, NFC-e, NFS-e, CT-e, CT-e OS e MDF-e recebem grupos próprios do novo modelo, em versões de leiaute específicas.",
      "Cada documento tem seu cronograma de adequação; não assumir que todos mudam ao mesmo tempo.",
    ],
  },
  {
    id: "ref.cclasstrib",
    titulo: "Classificação tributária (cClassTrib)",
    conteudo: [
      "O novo modelo introduz uma classificação que liga o item a um tratamento tributário específico.",
      "A tabela de códigos é publicada oficialmente e muda por nota técnica: precisa ser versionada no back-end, nunca fixada em código.",
      "Nenhum código foi cadastrado aqui para não induzir a implementação errada.",
    ],
  },
  {
    id: "ref.erp",
    titulo: "Impactos no ERP",
    conteudo: [
      "Cadastro de produtos e serviços passa a exigir classificação no novo modelo além do NCM.",
      "O motor de cálculo precisa apurar simultaneamente o modelo atual e o novo durante a transição.",
      "Relatórios, escrituração e conciliação precisam distinguir as duas apurações.",
      "Tudo isso exige vigência por data: a mesma operação muda de resultado conforme a data de emissão.",
    ],
  },
];

export interface ComparacaoModelo {
  aspecto: string;
  atual: string;
  reforma: string;
}

export const comparacao: ComparacaoModelo[] = [
  {
    aspecto: "Tributos sobre consumo",
    atual: "ICMS, ISS, PIS, COFINS e IPI convivendo com regras próprias",
    reforma: "IBS e CBS como bases principais, com IS em casos específicos",
  },
  {
    aspecto: "Competência",
    atual: "Estados (ICMS), municípios (ISS) e União (federais)",
    reforma: "IBS compartilhado entre estados e municípios; CBS federal",
  },
  {
    aspecto: "Local de arrecadação",
    atual: "Mistura de origem e destino, com partilha em casos específicos",
    reforma: "Tendência de arrecadação no destino",
  },
  {
    aspecto: "Créditos",
    atual: "Não cumulatividade parcial, com restrições por tributo",
    reforma: "Não cumulatividade ampla, conforme a legislação de regência",
  },
  {
    aspecto: "Classificação do item",
    atual: "NCM, CST/CSOSN e códigos de benefício",
    reforma: "NCM mais classificação tributária específica do novo modelo",
  },
  {
    aspecto: "Impacto no XML",
    atual: "Grupos de ICMS, IPI, PIS e COFINS",
    reforma: "Novos grupos para IBS, CBS e IS, em versões próprias de leiaute",
  },
];
