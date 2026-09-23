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
    nome: "Manual de Orientação do Contribuinte — NF-e/NFC-e (Portal Nacional da NF-e)",
    referencia: "https://www.nfe.fazenda.gov.br/portal/listaConteudo.aspx?tipoConteudo=ndIjl+iEFdE=",
    observacao: "Página oficial de documentos. Consulte a versão vigente do MOC; a versão exata usada pelo ERP ainda não foi registrada.",
  },
  {
    id: "portal-nfe",
    categoria: "Portal NF-e",
    nome: "Portal Nacional da NF-e — notas técnicas, esquemas XSD e tabelas de rejeição",
    referencia: "https://www.nfe.fazenda.gov.br/portal/principal.aspx",
    observacao: "Notas técnicas e esquemas publicados pelo ENCAT/SEFAZ.",
  },
  {
    id: "ajuste-sinief-07-05",
    categoria: "Ajuste SINIEF",
    nome: "Ajuste SINIEF 07/2005 — institui a NF-e e o DANFE",
    referencia: "https://www.confaz.fazenda.gov.br/legislacao/ajustes/2005/AJ_007_05",
    observacao: "Base legal da NF-e modelo 55.",
  },
  {
    id: "convenio-sinief-70",
    categoria: "Convênio",
    nome: "Convênio SINIEF s/nº de 1970 — CFOP e Código de Situação Tributária",
    referencia: "https://www.confaz.fazenda.gov.br/legislacao/convenios/1970/CV_SINIEF_001_70",
    observacao: "Tabelas de CFOP e CST (anexos).",
  },
  {
    id: "mo-nfce",
    categoria: "Manual / MOC",
    nome: "Manual de Orientação — NFC-e (modelo 65)",
    referencia: "https://www.nfe.fazenda.gov.br/portal/listaConteudo.aspx?tipoConteudo=ndIjl+iEFdE=",
    observacao: "Regras de contingência e QR Code variam por UF.",
  },
  {
    id: "mo-cte",
    categoria: "Manual / MOC",
    nome: "Manual de Orientação do Contribuinte — CT-e / CT-e OS",
    referencia: "https://dfe-portal.svrs.rs.gov.br/Cte",
    observacao: "Documentação oficial publicada no portal SVRS.",
  },
  {
    id: "mo-mdfe",
    categoria: "Manual / MOC",
    nome: "Manual de Orientação do Contribuinte — MDF-e",
    referencia: "https://dfe-portal.svrs.rs.gov.br/Mdfe",
    observacao: "Documentação oficial publicada no portal SVRS.",
  },
  {
    id: "nfse-nacional",
    categoria: "Receita Federal",
    nome: "Padrão nacional da NFS-e",
    referencia: "https://www.gov.br/nfse/pt-br",
    observacao: "Coexistem padrão nacional e padrões municipais. Cada município pode exigir campos próprios.",
  },
  {
    id: "encat",
    categoria: "ENCAT",
    nome: "Documentação técnica do ENCAT (publicada no Portal NF-e)",
    referencia: "https://www.nfe.fazenda.gov.br/portal/principal.aspx",
  },
  {
    id: "reforma",
    categoria: "Legislação",
    nome: "Lei Complementar 214/2025 — IBS, CBS e Imposto Seletivo",
    referencia: "https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp214.htm",
    observacao: "Cronograma, alíquotas e leiautes ainda em evolução; tratar como pendente de validação.",
  },
  {
    id: "ec-132",
    categoria: "Legislação",
    nome: "Emenda Constitucional 132/2023 — Reforma Tributária",
    referencia: "https://www.planalto.gov.br/ccivil_03/constituicao/emendas/emc/emc132.htm",
  },
  {
    id: "ajuste-sinief-09-07",
    categoria: "Ajuste SINIEF",
    nome: "Ajuste SINIEF 09/2007 — institui o CT-e e o CT-e OS",
    referencia: "https://www.confaz.fazenda.gov.br/legislacao/ajustes/2007/AJ_009_07",
    observacao: "Base legal do CT-e (modelo 57) e do CT-e OS (modelo 67).",
  },
  {
    id: "ajuste-sinief-21-10",
    categoria: "Ajuste SINIEF",
    nome: "Ajuste SINIEF 21/2010 — institui o MDF-e",
    referencia: "https://www.confaz.fazenda.gov.br/legislacao/ajustes/2010/AJ_021_10",
    observacao: "Base legal do MDF-e (modelo 58).",
  },
  {
    id: "lc-116",
    categoria: "Legislação",
    nome: "Lei Complementar 116/2003 — ISS (lista de serviços)",
    referencia: "https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp116.htm",
    observacao: "Base do ISS na NFS-e; alíquotas e regras variam por município.",
  },
  {
    id: "nfse-doc-tecnica",
    categoria: "Receita Federal",
    nome: "NFS-e Nacional — documentação técnica (leiautes, esquemas, manuais)",
    referencia: "https://www.gov.br/nfse/pt-br/biblioteca/documentacao-tecnica",
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
