import type { FonteFiscal } from "./types";

/**
 * Sistema de fontes. Nenhum link é inventado: quando a referência exata ainda
 * não foi conferida, a entrada fica sem `referencia` e a interface mostra
 * "Fonte oficial ainda não cadastrada."
 */
export const fontes: FonteFiscal[] = [
  {
    id: "sem-fonte",
    categoria: "Sem fonte cadastrada",
    nome: "Fonte oficial ainda não cadastrada",
    observacao:
      "Conteúdo didático produzido para este ambiente. Confirmar em manual, nota técnica ou legislação antes de usar como referência.",
  },
  {
    id: "moc-nfe",
    categoria: "Manual / MOC",
    nome: "Manual de Orientação do Contribuinte — NF-e",
    observacao: "Versão consultada ainda não registrada neste ambiente.",
  },
  {
    id: "mo-nfce",
    categoria: "Manual / MOC",
    nome: "Manual de Orientação — NFC-e (modelo 65)",
    observacao: "Versão e regras de contingência variam por UF; não registrada aqui.",
  },
  {
    id: "mo-cte",
    categoria: "Manual / MOC",
    nome: "Manual de Orientação do Contribuinte — CT-e / CT-e OS",
    observacao: "Versão consultada ainda não registrada neste ambiente.",
  },
  {
    id: "mo-mdfe",
    categoria: "Manual / MOC",
    nome: "Manual de Orientação do Contribuinte — MDF-e",
    observacao: "Versão consultada ainda não registrada neste ambiente.",
  },
  {
    id: "nfse-nacional",
    categoria: "Receita Federal",
    nome: "Padrão nacional da NFS-e",
    observacao:
      "Coexistem padrão nacional e padrões municipais. Cada município pode exigir campos próprios.",
  },
  {
    id: "encat",
    categoria: "ENCAT",
    nome: "Documentação técnica do ENCAT",
  },
  {
    id: "portal-nfe",
    categoria: "Portal NF-e",
    nome: "Portal Nacional da NF-e — notas técnicas e esquemas XSD",
  },
  {
    id: "reforma",
    categoria: "Legislação",
    nome: "Legislação e notas técnicas da Reforma Tributária (IBS / CBS / IS)",
    observacao:
      "Cronograma, alíquotas e leiautes estão em evolução. Tratar tudo aqui como pendente de validação.",
  },
  {
    id: "provedores",
    categoria: "Documentação de provedor",
    nome: "Documentação TecnoSpeed / PlugNotas",
    observacao: "Campos e endpoints dependem da versão contratada; nada foi confirmado aqui.",
  },
];

export const fonteById = new Map(fontes.map((f) => [f.id, f]));

export const nomeFonte = (id: string) =>
  fonteById.get(id)?.nome ?? "Fonte oficial ainda não cadastrada";
