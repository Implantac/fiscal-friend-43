/**
 * Cadastros sintéticos usados por todos os módulos do simulador.
 * Nenhum dado aqui corresponde a empresa, pessoa, produto ou veículo real.
 */

export interface Produto {
  id: string;
  codigo: string;
  descricao: string;
  ncm: string;
  unidade: string;
  preco: number;
  ean: string;
  pesoKg: number;
}

export interface Cliente {
  id: string;
  nome: string;
  documento: string;
  uf: string;
  municipio: string;
  contribuinte: boolean;
}

export interface ServicoMunicipal {
  id: string;
  descricao: string;
  /** Código de lista de serviços do cadastro interno; a lista oficial do município deve ser confirmada. */
  codigoInterno: string;
}

export interface Motorista {
  id: string;
  nome: string;
  cpf: string;
}

export interface Veiculo {
  id: string;
  placa: string;
  uf: string;
  tara: number;
  reboques: { placa: string; uf: string }[];
}

export const produtos: Produto[] = [
  { id: "p1", codigo: "SKU-1001", descricao: "Chapa de aço 2mm (fictício)", ncm: "72091500", unidade: "PC", preco: 210.5, ean: "7890000000017", pesoKg: 18.4 },
  { id: "p2", codigo: "SKU-1002", descricao: "Perfil U 50x25 (fictício)", ncm: "72166100", unidade: "PC", preco: 160.42, ean: "7890000000024", pesoKg: 9.2 },
  { id: "p3", codigo: "SKU-2001", descricao: "Parafuso sextavado M8 (fictício)", ncm: "73181500", unidade: "CX", preco: 48.9, ean: "7890000000031", pesoKg: 2.1 },
  { id: "p4", codigo: "SKU-3001", descricao: "Tinta industrial 18L (fictício)", ncm: "32081010", unidade: "LT", preco: 389.0, ean: "7890000000048", pesoKg: 21.5 },
  { id: "p5", codigo: "SKU-4001", descricao: "Cabo flexível 2,5mm 100m (fictício)", ncm: "85444900", unidade: "RL", preco: 275.3, ean: "7890000000055", pesoKg: 11.0 },
  { id: "p6", codigo: "SKU-5001", descricao: "Água mineral 500ml (fictício)", ncm: "22011000", unidade: "UN", preco: 3.5, ean: "7890000000062", pesoKg: 0.52 },
  { id: "p7", codigo: "SKU-5002", descricao: "Café torrado 500g (fictício)", ncm: "09012100", unidade: "UN", preco: 21.9, ean: "7890000000079", pesoKg: 0.5 },
  { id: "p8", codigo: "SKU-5003", descricao: "Biscoito integral 200g (fictício)", ncm: "19053100", unidade: "UN", preco: 8.4, ean: "7890000000086", pesoKg: 0.2 },
];

export const clientes: Cliente[] = [
  { id: "c1", nome: "Construtora Vale Azul Ltda (fictícia)", documento: "66777888000136", uf: "SP", municipio: "Sorocaba", contribuinte: true },
  { id: "c2", nome: "Comércio Boa Safra Eireli (fictícia)", documento: "77888999000127", uf: "MG", municipio: "Uberlândia", contribuinte: true },
  { id: "c3", nome: "Maria Fictícia de Souza", documento: "00000000191", uf: "SP", municipio: "Campinas", contribuinte: false },
  { id: "c4", nome: "Agro Serra Verde S.A. (fictícia)", documento: "88999000000118", uf: "PR", municipio: "Londrina", contribuinte: true },
];

export const servicos: ServicoMunicipal[] = [
  { id: "s1", descricao: "Consultoria em tecnologia da informação (fictício)", codigoInterno: "INT-01.06" },
  { id: "s2", descricao: "Manutenção de equipamentos industriais (fictício)", codigoInterno: "INT-14.01" },
  { id: "s3", descricao: "Treinamento corporativo (fictício)", codigoInterno: "INT-08.02" },
  { id: "s4", descricao: "Transporte de valores — serviço contratado (fictício)", codigoInterno: "INT-16.01" },
];

export const motoristas: Motorista[] = [
  { id: "m1", nome: "João Fictício Pereira", cpf: "00000000272" },
  { id: "m2", nome: "Carlos Fictício Andrade", cpf: "00000000353" },
];

export const veiculos: Veiculo[] = [
  { id: "v1", placa: "ABC1D23", uf: "SP", tara: 8200, reboques: [{ placa: "REB1A11", uf: "SP" }] },
  { id: "v2", placa: "XYZ9W87", uf: "SP", tara: 12500, reboques: [
    { placa: "REB2B22", uf: "SP" },
    { placa: "REB3C33", uf: "MG" },
  ] },
  { id: "v3", placa: "QRS4T56", uf: "PR", tara: 6400, reboques: [] },
];

export const ufs = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO",
];
