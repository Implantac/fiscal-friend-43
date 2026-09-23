/**
 * Parâmetros de CENÁRIO DEMONSTRATIVO.
 *
 * Não são alíquotas oficiais nem regra fiscal. Existem apenas para que a prévia
 * do protótipo produza números. No sistema real, estes valores devem vir de
 * regras versionadas no back-end, dependentes de operação, finalidade, origem,
 * destino, cadastro fiscal, benefícios, vigência e demais parâmetros aplicáveis.
 */
export const parametrosCenario = {
  descricao:
    "Percentuais arbitrários definidos apenas para demonstrar o comportamento da tela.",
  icmsPercentual: 12,
  ipiPercentual: 5,
  pisPercentual: 1.65,
  cofinsPercentual: 7.6,
  issPercentual: 3,
  /** Taxa usada apenas para ilustrar o campo de seguro no CT-e. */
  seguroPercentual: 0.15,
};

/**
 * Sugestão de CFOP puramente heurística do protótipo.
 * Serve para demonstrar o comportamento da tela, não para decidir a operação real.
 */
export function sugerirCfop(ufDestino: string, ufOrigem: string, contribuinte: boolean) {
  const mesmaUf = ufDestino === ufOrigem;
  const codigo = mesmaUf ? (contribuinte ? "5102" : "5101") : contribuinte ? "6102" : "6101";
  return {
    codigo,
    justificativa: mesmaUf
      ? "Cenário demonstrativo: operação dentro da mesma UF."
      : "Cenário demonstrativo: operação interestadual.",
    aviso:
      "Heurística do protótipo. A definição real do CFOP depende de natureza da operação, finalidade, origem da mercadoria, destinatário e regras versionadas no back-end.",
  };
}

export const previaTributaria = (baseCalculo: number) => ({
  aviso: "Prévia simulada com parâmetros de cenário. Não é apuração fiscal.",
  linhas: [
    { grupo: "ICMS", percentual: parametrosCenario.icmsPercentual, valor: (baseCalculo * parametrosCenario.icmsPercentual) / 100 },
    { grupo: "IPI", percentual: parametrosCenario.ipiPercentual, valor: (baseCalculo * parametrosCenario.ipiPercentual) / 100 },
    { grupo: "PIS", percentual: parametrosCenario.pisPercentual, valor: (baseCalculo * parametrosCenario.pisPercentual) / 100 },
    { grupo: "COFINS", percentual: parametrosCenario.cofinsPercentual, valor: (baseCalculo * parametrosCenario.cofinsPercentual) / 100 },
  ],
});
