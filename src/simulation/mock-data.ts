import type { NotaRecebida } from "@/domain/types";

export const empresaSimulada = {
  razaoSocial: "Aurora Distribuidora de Materiais Ltda",
  nomeFantasia: "Aurora Distribuidora",
  cnpj: "00000000000191",
  ie: "ISENTO (fictício)",
  uf: "SP",
  municipio: "Campinas",
  regime: "Não definido no protótipo",
};

/** Chaves fictícias, com 44 dígitos, geradas apenas para o simulador. */
const chave = (seq: number) =>
  `3526040000000000019155001000000${String(seq).padStart(4, "0")}1000000${String(seq).padStart(3, "0")}`.slice(
    0,
    44,
  );

export const notasIniciais: NotaRecebida[] = [
  {
    id: "nf-1",
    emissaoISO: "2026-09-18",
    emitente: "Metalúrgica Boa Vista Ltda",
    cnpj: "11222333000181",
    valor: 12480.5,
    chave: chave(1231),
    status: "sem_manifestacao",
    xmlDisponivel: false,
    natureza: "Venda de mercadoria (fictícia)",
    itensDemo: [
      { descricao: "Chapa de aço 2mm (fictício)", quantidade: 40, unitario: 210.5 },
      { descricao: "Perfil U 50x25 (fictício)", quantidade: 25, unitario: 160.42 },
    ],
    historico: [],
  },
  {
    id: "nf-2",
    emissaoISO: "2026-09-17",
    emitente: "Papelaria Central Comércio ME",
    cnpj: "22333444000172",
    valor: 1843.9,
    chave: chave(884),
    status: "ciencia",
    xmlDisponivel: true,
    natureza: "Venda de mercadoria (fictícia)",
    itensDemo: [
      { descricao: "Resma A4 75g (fictício)", quantidade: 120, unitario: 12.9 },
      { descricao: "Toner compatível (fictício)", quantidade: 4, unitario: 74.5 },
    ],
    historico: [
      {
        id: "h-1",
        em: "2026-09-17T14:22:00",
        titulo: "Ciência da Operação registrada (simulado)",
        detalhe: "Retorno simulado do provedor. Nenhum evento real foi transmitido.",
        origem: "sefaz_simulada",
        resultado: "sucesso",
      },
    ],
  },
  {
    id: "nf-3",
    emissaoISO: "2026-09-15",
    emitente: "Transportes Rio Verde S.A.",
    cnpj: "33444555000163",
    valor: 7320,
    chave: chave(552),
    status: "confirmacao",
    xmlDisponivel: true,
    natureza: "Prestação de serviço de transporte (fictícia)",
    itensDemo: [{ descricao: "Frete rodoviário (fictício)", quantidade: 1, unitario: 7320 }],
    historico: [
      {
        id: "h-2",
        em: "2026-09-15T09:05:00",
        titulo: "Confirmação da Operação registrada (simulado)",
        detalhe: "Protocolo fictício 999260000000001.",
        origem: "sefaz_simulada",
        resultado: "sucesso",
      },
    ],
  },
  {
    id: "nf-4",
    emissaoISO: "2026-09-12",
    emitente: "Indústria Química Sul Ltda",
    cnpj: "44555666000154",
    valor: 45900.75,
    chave: chave(77),
    status: "sem_manifestacao",
    xmlDisponivel: false,
    natureza: "Venda de mercadoria (fictícia)",
    itensDemo: [
      { descricao: "Solvente industrial 200L (fictício)", quantidade: 15, unitario: 2100 },
      { descricao: "Aditivo concentrado 20L (fictício)", quantidade: 30, unitario: 480.03 },
    ],
    historico: [],
  },
  {
    id: "nf-5",
    emissaoISO: "2026-09-10",
    emitente: "Comercial Ponta Norte Eireli",
    cnpj: "55666777000145",
    valor: 980.4,
    chave: chave(310),
    status: "desconhecimento",
    xmlDisponivel: false,
    natureza: "Operação não reconhecida (cenário fictício)",
    itensDemo: [{ descricao: "Item não reconhecido (fictício)", quantidade: 1, unitario: 980.4 }],
    historico: [
      {
        id: "h-3",
        em: "2026-09-10T16:40:00",
        titulo: "Desconhecimento da Operação registrado (simulado)",
        detalhe: "Cenário fictício para demonstrar o fluxo de recusa.",
        origem: "sefaz_simulada",
        resultado: "sucesso",
      },
    ],
  },
];
