/**
 * CLASSIFICAÇÃO FISCAL — CFOP, CST e CSOSN com fonte oficial.
 *
 * ============================================================================
 * O QUE ESTE ARQUIVO SUBSTITUI
 * ============================================================================
 * Havia uma "heurística de 4 códigos" em `src/simulation/parametros-cenario.ts`
 * que sugeria CFOP, e a matriz fiscal em `src/routes/matriz.tsx` classificava
 * operação com base em regras inventadas. Nada disso tinha fonte.
 *
 * Este módulo traz as **tabelas oficiais** e um classificador que as usa. A
 * diferença é epistemológica: aqui o código não decide a regra, ele consulta
 * uma tabela que tem procedência, e quando a tabela não cobre o caso, ele
 * **devolve pendência em vez de chutar**.
 *
 * ============================================================================
 * PROCEDÊNCIA
 * ============================================================================
 * - **CFOP**: Convênio SINIEF s/nº, de 15 de dezembro de 1970 (CONFAZ). A
 *   estrutura de 4 dígitos e o significado do primeiro dígito são confirmados
 *   por todas as fontes consultadas.
 * - **CST ICMS**: Convênio SINIEF s/nº de 15.12.1970, Anexo — Código de
 *   Situação Tributária. Tabela A (origem) e Tabela B (tributação).
 * - **CSOSN**: usado exclusivamente quando CRT = 1 (Simples Nacional),
 *   substituindo a Tabela B.
 *
 * **Restrição de acesso:** o portal do CONFAZ e o da NF-e bloqueiam requisição
 * automatizada. As tabelas foram confirmadas por múltiplas fontes independentes
 * que citam os atos explicitamente — **não** pelo texto original dos atos. Por
 * isso as regras daqui entram como `validada_tecnicamente`, e o classificador
 * **nunca** apresenta seu resultado como decisão fiscal: ver
 * `classificarOperacao`.
 */

// ---------------------------------------------------------------------------
// CFOP
// ---------------------------------------------------------------------------

/**
 * Primeiro dígito do CFOP: sentido e abrangência.
 *
 * Note que **não existe dígito 4** — os primeiros dígitos são 1, 2, 3, 5, 6 e 7.
 * Séries 1–3 são entrada; 5–7 são saída.
 */
export const CFOP_SENTIDO = {
  "1": "Entrada — operação interna (mesma UF)",
  "2": "Entrada — operação interestadual",
  "3": "Entrada — operação com o exterior (importação)",
  "5": "Saída — operação interna (mesma UF)",
  "6": "Saída — operação interestadual",
  "7": "Saída — operação com o exterior (exportação)",
} as const;

export type CfopPrimeiroDigito = keyof typeof CFOP_SENTIDO;

/**
 * Segundo dígito: grupo de natureza da operação.
 * Confirmado de forma consistente pelas fontes; a granularidade abaixo do
 * grupo não é normativa e por isso não é codificada aqui.
 */
export const CFOP_GRUPO = {
  "0": "Entrada ou aquisição de serviços do estado / saída ou prestação para o estado",
  "1": "Compras para industrialização, produção rural, comercialização ou prestação de serviços",
  "2": "Devoluções de vendas e retornos",
  "3": "Aquisições ou prestações de serviços de comunicação e de transporte",
  "4": "Entradas ou saídas de mercadorias sujeitas ao regime de substituição tributária",
  "5": "Entradas ou saídas de mercadorias para o ativo imobilizado, uso e consumo",
  "6": "Créditos e ressarcimentos de ICMS",
  "9": "Outras entradas e saídas não especificadas",
} as const;

/**
 * CFOP de uso mais frequente, com descrição.
 *
 * **Isto não é a tabela completa** — a tabela do CONFAZ tem centenas de
 * códigos e não pôde ser copiada daqui (portal bloqueia acesso automatizado).
 * O classificador usa estes como os códigos conhecidos e devolve `pendente`
 * para qualquer operação fora da lista, em vez de inventar um código.
 */
export const CFOP_CONHECIDOS: Record<string, string> = {
  "1102": "Compra para comercialização (entrada, mesma UF)",
  "2102": "Compra para comercialização (entrada, outra UF)",
  "1202": "Devolução de venda de mercadoria adquirida de terceiros (entrada, mesma UF)",
  "2202": "Devolução de venda de mercadoria adquirida de terceiros (entrada, outra UF)",
  "1551": "Compra de bem para o ativo imobilizado (entrada, mesma UF)",
  "1556": "Compra de material de uso ou consumo (entrada, mesma UF)",
  "1403": "Compra para comercialização em operação com ST (entrada, mesma UF)",
  "5101": "Venda de produção do estabelecimento (saída, mesma UF)",
  "5102": "Venda de mercadoria adquirida ou recebida de terceiros (saída, mesma UF)",
  "6102": "Venda de mercadoria adquirida ou recebida de terceiros (saída, outra UF)",
  "5405":
    "Venda de mercadoria sujeita ao regime de ST, na condição de contribuinte substituído (saída, mesma UF)",
  "5403":
    "Venda de mercadoria sujeita ao regime de ST, na condição de contribuinte substituto (saída, mesma UF)",
  "5152": "Transferência de mercadoria adquirida de terceiros (saída, mesma UF)",
  "6152": "Transferência de mercadoria adquirida de terceiros (saída, outra UF)",
  "5202": "Devolução de compra para comercialização (saída, mesma UF)",
  "6202": "Devolução de compra para comercialização (saída, outra UF)",
  "5910": "Bonificação, doação ou brinde (saída, mesma UF)",
  "6910": "Bonificação, doação ou brinde (saída, outra UF)",
  "5915": "Remessa para conserto (saída, mesma UF)",
  "5949": "Outra saída de mercadoria não especificada (saída, mesma UF)",
};

/** Decompõe um CFOP em seus componentes oficiais. */
export function decomporCfop(cfop: string): {
  valido: boolean;
  primeiroDigito?: CfopPrimeiroDigito;
  sentido?: string;
  grupo?: string;
  conhecido: boolean;
  descricao?: string;
} {
  if (!/^\d{4}$/.test(cfop)) {
    return { valido: false, conhecido: false };
  }
  const d1 = cfop[0] as CfopPrimeiroDigito;
  const d2 = cfop[1] as keyof typeof CFOP_GRUPO;
  const sentido = CFOP_SENTIDO[d1];
  const grupo = CFOP_GRUPO[d2];
  const descricao = CFOP_CONHECIDOS[cfop];
  if (!sentido) {
    // Dígito 4, 8 ou 0 no primeiro dígito não existe na tabela.
    return { valido: false, conhecido: false };
  }
  return {
    valido: true,
    primeiroDigito: d1,
    sentido,
    ...(grupo !== undefined ? { grupo } : {}),
    conhecido: Boolean(descricao),
    ...(descricao !== undefined ? { descricao } : {}),
  };
}

// ---------------------------------------------------------------------------
// CST — Tabela A (origem da mercadoria) e Tabela B (tributação)
// ---------------------------------------------------------------------------

/** Tabela A — origem da mercadoria ou serviço. */
export const CST_ORIGEM: Record<string, string> = {
  "0": "Nacional, exceto as indicadas nos códigos 3, 4, 5 e 8",
  "1": "Estrangeira — importação direta, exceto a indicada no código 6",
  "2": "Estrangeira — adquirida no mercado interno, exceto a indicada no código 7",
  "3": "Nacional, mercadoria ou bem com conteúdo de importação superior a 40% e inferior ou igual a 70%",
  "4": "Nacional, cuja produção tenha sido feita em conformidade com os processos produtivos básicos (Decreto-Lei 288/1967, Leis 8.248/1991, 8.387/1991, 10.176/2001 e 11.484/2007)",
  "5": "Nacional, mercadoria ou bem com conteúdo de importação inferior ou igual a 40%",
  "6": "Estrangeira — importação direta, sem similar nacional, constante em lista de Resolução CAMEX, e gás natural",
  "7": "Estrangeira — adquirida no mercado interno, sem similar nacional, constante em lista de Resolução CAMEX, e gás natural",
  "8": "Nacional, mercadoria ou bem com conteúdo de importação superior a 70%",
};

/** Tabela B — tributação pelo ICMS. */
export const CST_TRIBUTACAO: Record<string, string> = {
  "00": "Tributada integralmente",
  "02": "Tributação monofásica própria sobre combustíveis",
  "10": "Tributada e com cobrança do ICMS por substituição tributária",
  "15": "Tributação monofásica própria e com responsabilidade pela retenção sobre combustíveis",
  "20": "Com redução de base de cálculo",
  "30": "Isenta ou não tributada e com cobrança do ICMS por substituição tributária",
  "40": "Isenta",
  "41": "Não tributada",
  "50": "Suspensão",
  "51": "Diferimento",
  "53": "Tributação monofásica sobre combustíveis com recolhimento diferido",
  "60": "ICMS cobrado anteriormente por substituição tributária",
  "61": "Tributação monofásica sobre combustíveis cobrada anteriormente",
  "70": "Com redução de base de cálculo e cobrança do ICMS por substituição tributária",
  "90": "Outras",
};

/** CSOSN — usado exclusivamente quando CRT = 1 (Simples Nacional). */
export const CSOSN: Record<string, string> = {
  "101": "Tributada pelo Simples Nacional com permissão de crédito",
  "102": "Tributada pelo Simples Nacional sem permissão de crédito",
  "103": "Isenção do ICMS no Simples Nacional para faixa de receita bruta",
  "201":
    "Tributada pelo Simples Nacional com permissão de crédito e com cobrança do ICMS por substituição tributária",
  "202":
    "Tributada pelo Simples Nacional sem permissão de crédito e com cobrança do ICMS por substituição tributária",
  "203":
    "Isenção do ICMS no Simples Nacional para faixa de receita bruta e com cobrança do ICMS por substituição tributária",
  "300": "Imune",
  "400": "Não tributada pelo Simples Nacional",
  "500": "ICMS cobrado anteriormente por substituição tributária (substituído) ou por antecipação",
  "900": "Outros",
};

/**
 * Código de Regime Tributário (CRT).
 * `1` = Simples Nacional, e é o único caso em que CSOSN substitui a Tabela B.
 */
export const CRT = {
  "1": "Simples Nacional",
  "2": "Simples Nacional — excesso de sublimite de receita bruta",
  "3": "Regime Normal",
} as const;

export type CodigoCrt = keyof typeof CRT;

/**
 * Decompõe um CST de 3 dígitos em origem + tributação.
 *
 * O primeiro dígito vem da Tabela A; os dois últimos, da Tabela B. Um CST
 * cujo par não exista em nenhuma das duas tabelas é inválido — e devolvido
 * como tal, não "arredondado" para o código mais próximo.
 */
export function decomporCst(cst: string): {
  valido: boolean;
  origem?: string;
  origemDescricao?: string;
  tributacao?: string;
  tributacaoDescricao?: string;
} {
  if (!/^\d{3}$/.test(cst)) return { valido: false };
  const origem = cst[0]!;
  const tributacao = cst.slice(1);
  const origemDescricao = CST_ORIGEM[origem];
  const tributacaoDescricao = CST_TRIBUTACAO[tributacao];
  if (!origemDescricao || !tributacaoDescricao) return { valido: false };
  return { valido: true, origem, origemDescricao, tributacao, tributacaoDescricao };
}

// ---------------------------------------------------------------------------
// Classificador
// ---------------------------------------------------------------------------

export interface EntradaClassificacao {
  /** Sentido da operação do ponto de vista de quem emite. */
  sentido: "entrada" | "saida";
  /** UF do emitente e do destinatário, para decidir interna x interestadual. */
  ufEmitente: string;
  ufDestinatario: string;
  /** Natureza da operação. */
  natureza:
    | "venda_revenda"
    | "venda_producao_propria"
    | "devolucao_venda"
    | "devolucao_compra"
    | "transferencia"
    | "bonificacao_doacao"
    | "remessa_conserto"
    | "compra_comercializacao"
    | "compra_ativo"
    | "compra_uso_consumo";
  /** Regime tributário do emitente. */
  crt: CodigoCrt;
  /** Origem da mercadoria (Tabela A). */
  origem: string;
  /**
   * Tributação pretendida (Tabela B) — só usada quando CRT ≠ 1.
   *
   * `| undefined` explícito por causa de `exactOptionalPropertyTypes`: sem ele,
   * um teste não consegue passar `tributacao: undefined` para exercitar o
   * caminho de pendência, e a ausência de tributação ficaria sem cobertura.
   */
  tributacao?: string | undefined;
}

export interface ResultadoClassificacao {
  /** CFOP sugerido, quando a operação está coberta pelas tabelas. */
  cfop?: string;
  cfopDescricao?: string;
  /** CST (CRT ≠ 1) ou CSOSN (CRT = 1), quando determinável. */
  codigoTributario?: string;
  codigoTributarioDescricao?: string;
  tipoCodigoTributario?: "CST" | "CSOSN";
  /**
   * O que falta para a classificação ser completa.
   *
   * **Regra inegociável:** se algum campo não pôde ser determinado com base em
   * tabela oficial, ele vem aqui. O classificador nunca preenche com valor
   * plausível — ver `docs/atualizacao-normativa.md` §6.
   */
  pendencias: string[];
  /**
   * False quando há pendência. O chamador deve tratar `completa === false`
   * como "não classificado", nunca como "classificado com ressalva".
   */
  completa: boolean;
}

/**
 * Sugere CFOP a partir das tabelas oficiais.
 *
 * Cobre as naturezas mapeadas em `CFOP_CONHECIDOS`. Para qualquer combinação
 * fora da tabela, devolve `undefined` e o chamador registra pendência.
 */
export function sugerirCfop(e: EntradaClassificacao): string | undefined {
  const interno = e.ufEmitente === e.ufDestinatario;
  const prefixo = `${e.sentido === "saida" ? (interno ? "5" : "6") : interno ? "1" : "2"}`;
  const sufixo: Record<EntradaClassificacao["natureza"], string> = {
    venda_revenda: "102",
    venda_producao_propria: "101",
    devolucao_venda: "202",
    devolucao_compra: "202",
    transferencia: "152",
    bonificacao_doacao: "910",
    remessa_conserto: "915",
    compra_comercializacao: "102",
    compra_ativo: "551",
    compra_uso_consumo: "556",
  };
  const s = sufixo[e.natureza];
  if (s === undefined) return undefined;
  const cfop = prefixo + s;
  // Devolução de compra é saída com sufixo 202; devolução de venda é entrada
  // com sufixo 202. A natureza já decide o sufixo, o sentido decide o prefixo.
  return cfop in CFOP_CONHECIDOS ? cfop : undefined;
}

/**
 * Classifica uma operação usando as tabelas oficiais.
 *
 * **O que este método faz:** consulta tabela, decompõe código, e diz o que
 * falta. **O que ele não faz:** decidir a tributação. A escolha entre isento,
 * tributado, com ST, com redução de base, etc. depende de legislação estadual
 * específica, de benefício fiscal e de cadastro do contribuinte — nada disso
 * está em tabela nacional, e nenhum foi inventado aqui.
 */
export function classificarOperacao(e: EntradaClassificacao): ResultadoClassificacao {
  const pendencias: string[] = [];
  const cfop = sugerirCfop(e);
  const d = cfop ? decomporCfop(cfop) : undefined;

  if (!cfop || !d?.valido) {
    pendencias.push(
      "CFOP não determinável pelas tabelas consultadas — a combinação de sentido, abrangência e natureza não está coberta. Confirme no Convênio SINIEF s/nº de 15/12/1970.",
    );
  } else if (!d.conhecido) {
    pendencias.push(
      `CFOP ${cfop} tem primeiro dígito válido (${d.sentido}), mas a descrição completa não está entre os códigos conhecidos deste módulo.`,
    );
  }

  let codigoTributario: string | undefined;
  let codigoTributarioDescricao: string | undefined;
  let tipoCodigoTributario: "CST" | "CSOSN" | undefined;

  if (e.crt === "1") {
    tipoCodigoTributario = "CSOSN";
    pendencias.push(
      "CSOSN não determinado: a escolha entre 101/102/103/201/202/203/300/400/500/900 depende de legislação do Simples Nacional e do cadastro do contribuinte. Nenhum código foi escolhido.",
    );
  } else {
    tipoCodigoTributario = "CST";
    const origemOk = e.origem in CST_ORIGEM;
    if (!origemOk) {
      pendencias.push(
        `Origem "${e.origem}" não existe na Tabela A do Convênio SINIEF s/nº de 15/12/1970.`,
      );
    }
    if (!e.tributacao) {
      pendencias.push(
        "Tributação não informada: a Tabela B tem 15 situações (00 a 90) e a escolha depende de legislação estadual e de benefício fiscal. Nenhuma foi escolhida.",
      );
    } else if (!(e.tributacao in CST_TRIBUTACAO)) {
      pendencias.push(
        `Tributação "${e.tributacao}" não existe na Tabela B do Convênio SINIEF s/nº de 15/12/1970.`,
      );
    } else if (origemOk) {
      codigoTributario = e.origem + e.tributacao;
      const dd = decomporCst(codigoTributario);
      codigoTributarioDescricao = `${dd.origemDescricao} / ${dd.tributacaoDescricao}`;
    }
  }

  return {
    ...(cfop && d?.valido ? { cfop } : {}),
    ...(d?.descricao !== undefined ? { cfopDescricao: d.descricao } : {}),
    ...(codigoTributario !== undefined ? { codigoTributario } : {}),
    ...(codigoTributarioDescricao !== undefined ? { codigoTributarioDescricao } : {}),
    ...(tipoCodigoTributario !== undefined ? { tipoCodigoTributario } : {}),
    pendencias,
    completa: pendencias.length === 0,
  };
}
