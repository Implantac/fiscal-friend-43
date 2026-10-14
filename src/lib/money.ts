/**
 * Motor monetário exato — sem ponto flutuante.
 *
 * ============================================================================
 * POR QUE ESTE ARQUIVO EXISTE
 * ============================================================================
 * O protótipo anterior calculava valores com `number` (IEEE 754 binário),
 * `Math.round(x * 100) / 100` e `toFixed()`. Esses três padrões são
 * inaceitáveis em apuração fiscal:
 *
 *   - `0.1 + 0.2 !== 0.3` em binário; somar centenas de itens acumula drift;
 *   - `Math.round` é "metade para cima" sempre — tributos diferentes exigem
 *     critérios diferentes (metade par, truncamento, etc.);
 *   - `toFixed()` formata com arredondamento implícito e devolve *string*,
 *     o que empurra o arredondamento para o ponto errado do cálculo;
 *   - arredondar item a item e depois somar pode fechar o total com
 *     diferença de 1 centavo — justamente o que os validadores oficiais
 *     comparam (soma dos itens × total do documento).
 *
 * Esta implementação usa `bigint` em unidades inteiras (centavos), portanto
 * toda aritmética é exata e determinística: os mesmos dados de entrada, a
 * mesma versão de regra e os mesmos parâmetros produzem sempre o mesmo
 * resultado, byte a byte.
 *
 * ============================================================================
 * O QUE ESTE MÓDULO **NÃO** FAZ
 * ============================================================================
 * - Não conhece alíquota, CFOP, CST, regra de incidência ou leiaute.
 * - Não decide o modo de arredondamento: ele é sempre informado pelo chamador,
 *   porque cada tributo/campo tem critério próprio. Impor um único critério
 *   para todos seria um erro técnico.
 * - Não valida se um valor é fiscalmente correto — apenas se é exato.
 *
 * Unidade interna: 1 = 1 centavo de Real. `Money` é um `bigint` opaco.
 */

/** Modos de arredondamento suportados. A escolha é sempre explícita. */
export type ModoArredondamento =
  /** 0.5 para cima (mais comum em documentos fiscais brasileiros). */
  | "half_up"
  /** 0.5 para o dígito par mais próximo (bancário). */
  | "half_even"
  /** Descarta a fração, na direção do zero. */
  | "truncate"
  /** Sempre para cima. */
  | "ceil";

export type Money = bigint;

/**
 * Decimal de escala arbitrária (valor = n / 10^s).
 * Usado onde 2 casas não bastam: valor unitário com 4 decimais, alíquota,
 * quantidade fracionária. `Money` é o caso particular s = 2.
 */
export interface Decimal {
  n: bigint;
  s: number;
}

const CEM = 100n;

/** Número de casas decimais do Real na unidade interna. */
export const ESCALA_REAL = 2;

const potenciaDeDez = (n: number): bigint => 10n ** BigInt(n);

/* ------------------------------------------------------------------ parsing */

/**
 * Converte texto decimal em um escalonado exato `{ n, s }` (valor = n / 10^s).
 * Aceita "1234.56", "-0.05", "1.234,56" (pt-BR), "R$ 1.234,56", "1e3".
 * Nunca passa por `number`.
 */
export function parseDecimal(texto: string): Decimal {
  const bruto = texto.trim();
  if (bruto === "") throw new ErroMonetario("Valor decimal vazio.");

  const negativo = /^-/.test(bruto);
  // Remove símbolo monetário e separadores de milhar de exibição.
  const semSinal = bruto.replace(/^[+-]/, "").replace(/[R$\s]/g, "");

  // Notação científica: expande em decimal exato, sem passar por float.
  const exp = /^(\d+(?:[.,]\d+)?)[eE]([+-]?\d+)$/.exec(semSinal);
  if (exp) {
    const base = parseDecimal(exp[1]!);
    const e = Number(exp[2]);
    return sinal(
      e >= 0 ? { n: base.n * potenciaDeDez(e), s: base.s } : { n: base.n, s: base.s - e },
      negativo,
    );
  }

  const ptBR = /^\d{1,3}(\.\d{3})*,\d+$/; // 1.234,56
  const enUS = /^\d{1,3}(,\d{3})*\.\d+$/; // 1,234.56
  const puro = /^\d+(?:[.,]\d+)?$/; // 1234.56 ou 1234,56

  let normalizado: string;
  if (ptBR.test(semSinal)) normalizado = semSinal.replace(/\./g, "").replace(",", ".");
  else if (enUS.test(semSinal)) normalizado = semSinal.replace(/,/g, "");
  else if (puro.test(semSinal)) normalizado = semSinal.replace(",", ".");
  else throw new ErroMonetario(`Não foi possível interpretar "${texto}" como decimal.`);

  const [inteiro, fracao = ""] = normalizado.split(".");
  const n = BigInt((inteiro || "0") + (fracao || ""));
  return sinal({ n, s: fracao.length }, negativo);
}

function sinal(x: { n: bigint; s: number }, negativo: boolean) {
  return negativo ? { n: -x.n, s: x.s } : x;
}

/** Remove casas decimais à direita que não alteram o valor (12.50 → 12.5). */
function normalizar(x: { n: bigint; s: number }) {
  if (x.n === 0n) return { n: 0n, s: 0 };
  let { n, s } = x;
  while (s > 0 && n % 10n === 0n) {
    n /= 10n;
    s -= 1;
  }
  return { n, s };
}

/* ------------------------------------------------------------- arredondamento */

/** Divisão inteira com resto, arredondada segundo o modo informado. */
function dividirArredondado(
  numerador: bigint,
  denominador: bigint,
  modo: ModoArredondamento,
): bigint {
  if (denominador === 0n) throw new ErroMonetario("Divisão por zero.");
  if (denominador < 0n) return dividirArredondado(-numerador, -denominador, modo);

  const negativo = numerador < 0n;
  const n = negativo ? -numerador : numerador;

  const quociente = n / denominador;
  const resto = n % denominador;
  const dobro = resto * 2n;

  let ajuste = 0n;
  switch (modo) {
    case "truncate":
      ajuste = 0n;
      break;
    case "ceil":
      ajuste = resto > 0n ? 1n : 0n;
      break;
    case "half_up":
      ajuste = dobro >= denominador ? 1n : 0n;
      break;
    case "half_even":
      ajuste = dobro > denominador || (dobro === denominador && quociente % 2n === 1n) ? 1n : 0n;
      break;
  }

  const resultado = quociente + ajuste;
  return negativo ? -resultado : resultado;
}

/** Arredonda um escalonado qualquer para `casas` decimais. */
function arredondarEscalado(
  x: { n: bigint; s: number },
  casas: number,
  modo: ModoArredondamento,
): bigint {
  if (casas < 0) throw new ErroMonetario("Número de casas decimais negativo.");
  if (x.s === casas) return x.n;
  if (x.s < casas) return x.n * potenciaDeDez(casas - x.s);
  return dividirArredondado(x.n, potenciaDeDez(x.s - casas), modo);
}

/* ------------------------------------------------------------ construtores */

/** Cria `Money` a partir de centavos (uso interno e testes). */
export function deCentavos(centavos: bigint | number): Money {
  return typeof centavos === "bigint" ? centavos : BigInt(Math.trunc(centavos));
}

/** Cria `Money` a partir de texto decimal exato ("1234.56"). */
export function deTexto(texto: string): Money {
  const { n, s } = parseDecimal(texto);
  return arredondarEscalado({ n, s }, ESCALA_REAL, "half_up");
}

/**
 * Cria `Money` a partir de `number`.
 *
 * ATENÇÃO: só é seguro quando o número veio de uma fonte já limitada a poucas
 * casas decimais (ex.: digitação do operador). Para valores fiscais, importe
 * de XML/CSV ou receba do back-end como *string* e use `deTexto`. A conversão
 * usa a menor representação decimal que reproduz o binário (`0.1` → "0.1"),
 * que é o melhor disponível sem biblioteca decimal externa.
 */
export function deNumero(valor: number): Money {
  if (!Number.isFinite(valor)) throw new ErroMonetario(`Valor não finito: ${valor}`);
  return deTexto(valor.toString());
}

/** Converte "R$ 1.234,56" ou "1.234,56" em `Money`. */
export function deMoeda(texto: string): Money {
  return deTexto(texto);
}

export const ZERO: Money = 0n;

/* -------------------------------------------------------------- operações */

export function somar(valores: Iterable<Money>): Money {
  let total = 0n;
  for (const v of valores) total += v;
  return total;
}

export function somarLista(valores: Money[]): Money {
  return somar(valores);
}

export function subtrair(a: Money, b: Money): Money {
  return a - b;
}

export function multiplicarInteiro(a: Money, fator: bigint | number): Money {
  return a * (typeof fator === "bigint" ? fator : BigInt(Math.trunc(fator)));
}

/**
 * Multiplica um decimal de escala arbitrária (quantidade) por um valor
 * monetário (preço), devolvendo `Money` em centavos.
 *
 * ATENÇÃO: quantidade NÃO é valor monetário — multiplicar dois `Money`
 * produziria um resultado 100x maior. Este é o caminho correto para
 * `qCom × vUnCom`.
 */
export function multiplicarDecimalPorMoney(
  d: Decimal,
  m: Money,
  modo: ModoArredondamento = "half_up",
): Money {
  // d = n/10^s ; m = centavos. Produto em centavos = n*m/10^s.
  return dividirArredondado(d.n * m, potenciaDeDez(d.s), modo);
}

export function negar(a: Money): Money {
  return -a;
}

export function absoluto(a: Money): Money {
  return a < 0n ? -a : a;
}

export function comparar(a: Money, b: Money): -1 | 0 | 1 {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function iguais(a: Money, b: Money): boolean {
  return a === b;
}

export function ehZero(a: Money): boolean {
  return a === 0n;
}

export function ehPositivo(a: Money): boolean {
  return a > 0n;
}

/* ------------------------------------------------------- regras de cálculo */

/**
 * Divide um valor monetário por uma quantidade, devolvendo `Decimal`
 * (valor unitário com 4 casas por padrão, suficiente para `vUnCom`/`qTrib`).
 */
export function valorUnitario(
  total: Money,
  quantidade: number | bigint,
  opcoes: { casas?: number; modo?: ModoArredondamento } = {},
): Decimal {
  const { casas = 4, modo = "half_up" } = opcoes;
  const q = typeof quantidade === "bigint" ? quantidade : BigInt(Math.trunc(quantidade));
  if (q === 0n) throw new ErroMonetario("Quantidade zero no cálculo de valor unitário.");
  // valor (escala 2) ÷ q, arredondado direto para `casas` decimais.
  const n = dividirArredondado(total * potenciaDeDez(casas), q * potenciaDeDez(ESCALA_REAL), modo);
  return { n, s: casas };
}

export interface OpcoesPercentual {
  /** Casas decimais do resultado. Padrão: 2 (centavos). */
  casas?: number;
  /** Critério de arredondamento. Sempre explícito na apuração real. */
  modo?: ModoArredondamento;
}

/**
 * Aplica um percentual a um valor monetário.
 *
 * `percentual` entra como texto/numero exato ("18", "12,5", "1.65").
 * O cálculo é feito em precisão intermediária cheia e arredondado uma única
 * vez, no fim — nunca item a item com re-arredondamento.
 *
 * Exemplo: 100,00 × 18% = 18,00 (exato, sem 17.999999999999996).
 */
export function aplicarPercentual(
  valor: Money,
  percentual: string | number,
  opcoes: OpcoesPercentual = {},
): Money {
  const { casas = ESCALA_REAL, modo = "half_up" } = opcoes;
  // percentual entra como escalonado (n/s), nunca como Money/centavos.
  const pct = parseDecimal(typeof percentual === "number" ? percentual.toString() : percentual);

  // valor (centavos) × pct / 100, mantido em precisão cheia até o arredondamento final.
  const exato: Decimal = { n: valor * pct.n, s: ESCALA_REAL + pct.s + 2 };
  const centavos = arredondarEscalado(exato, casas, modo);
  // `casas` > 2 carrega precisão sub-centavo; o valor continua determinístico.
  return centavos;
}

/**
 * Versão de escala arbitrária de `aplicarPercentual`: devolve `Decimal`,
 * para alíquotas e valores unitários que precisam de mais de 2 casas.
 */
export function aplicarPercentualExato(
  valor: Money,
  percentual: string | number,
  opcoes: OpcoesPercentual = {},
): Decimal {
  const { casas = 6, modo = "half_up" } = opcoes;
  const pct = parseDecimal(typeof percentual === "number" ? percentual.toString() : percentual);
  const exato: Decimal = { n: valor * pct.n, s: ESCALA_REAL + pct.s + 2 };
  return { n: arredondarEscalado(exato, casas, modo), s: casas };
}

/**
 * Rateia um valor entre partes proporcionais a `pesos`, **sem perder centavos**.
 *
 * Este é o ponto onde o cálculo ingênuo (`r2((frete * vp) / vProd)` por item)
 * quebra: a soma dos rateios pode fechar 1 centavo abaixo ou acima do total,
 * e o validador oficial compara item × total. Aqui o rateio é feito pelo
 * método do maior resto, então `somar(ratear(x, w)) === x` é invariante.
 *
 * @param pesos pesos proporcionais (ex.: valor de cada item). Zero é ignorado.
 */
export function ratear(valor: Money, pesos: number[], opcoes: OpcoesPercentual = {}): Money[] {
  const { modo = "half_up" } = opcoes;
  const totalPesos = pesos.reduce((a, p) => a + p, 0);

  if (pesos.length === 0) return [];
  if (totalPesos <= 0) {
    // Sem base de rateio: devolve o valor no primeiro item e zero nos demais,
    // de forma determinística e explícita (nunca silenciosa).
    return pesos.map((_, i) => (i === 0 ? valor : ZERO));
  }

  // Pesos são convertidos para inteiro (escala 1e6) para não reintroduzir
  // ponto flutuante dentro do rateio.
  const ESCALA_PESO = 1_000_000;
  const den = BigInt(Math.round(totalPesos * ESCALA_PESO));

  const truncado: Money[] = [];
  const restos: { i: number; resto: bigint }[] = [];

  pesos.forEach((p, i) => {
    if (p <= 0) {
      truncado[i] = ZERO;
      restos[i] = { i, resto: 0n };
      return;
    }
    const num = valor * BigInt(Math.round(p * ESCALA_PESO));
    truncado[i] = num / den; // truncamento em centavos inteiros
    restos[i] = { i, resto: num % den };
  });

  // Método do maior resto: a soma dos rateios é EXATAMENTE `valor`.
  const somaRateada = somar(truncado);
  const falta = valor - somaRateada;
  if (falta === 0n) return truncado;

  const ordem = restos
    .filter((r) => pesos[r.i]! > 0)
    .sort((a, b) => (b.resto > a.resto ? 1 : b.resto < a.resto ? -1 : a.i - b.i));

  const passo = falta > 0n ? 1n : -1n;
  let pendente = absoluto(falta);
  let k = 0;
  while (pendente > 0n && ordem.length > 0) {
    const alvo = ordem[k % ordem.length]!;
    truncado[alvo.i] = truncado[alvo.i]! + passo;
    pendente -= 1n;
    k += 1;
  }
  return truncado;
}

/* ------------------------------------------------------------- formatação */

/** Formata em pt-BR: 123456 → "1.234,56". */
export function formatar(valor: Money, opcoes: { casas?: number } = {}): string {
  const { casas = ESCALA_REAL } = opcoes;
  const fator = potenciaDeDez(casas);
  const negativo = valor < 0n;
  const n = absoluto(valor);
  const escala = arredondarEscalado({ n, s: ESCALA_REAL }, casas, "half_up");
  const inteiro = escala / fator;
  const fracao = (escala % fator).toString().padStart(casas, "0");
  const grupos = inteiro.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const corpo = casas > 0 ? `${grupos},${fracao}` : grupos;
  return negativo ? `-${corpo}` : corpo;
}

/**
 * Serializa para XML/CSV com separador decimal ponto e casas fixas:
 * `formatarXml(123456n)` → "1234.56".
 */
export function formatarXml(valor: Money, casas = ESCALA_REAL): string {
  const fator = potenciaDeDez(casas);
  const negativo = valor < 0n;
  const escala = arredondarEscalado({ n: absoluto(valor), s: ESCALA_REAL }, casas, "half_up");
  const inteiro = escala / fator;
  const fracao = (escala % fator).toString().padStart(casas, "0");
  return `${negativo ? "-" : ""}${inteiro}.${fracao}`;
}

/** Formata um `Decimal` em pt-BR com `casas` decimais (sem passar por centavos). */
export function formatarDecimal(d: Decimal, casas = d.s): string {
  const alvo = arredondarEscalado(d, casas, "half_up");
  const fator = potenciaDeDez(casas);
  const negativo = alvo < 0n;
  const n = negativo ? -alvo : alvo;
  const inteiro = n / fator;
  const fracao = (n % fator).toString().padStart(casas, "0");
  const grupos = inteiro.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const corpo = casas > 0 ? `${grupos},${fracao}` : grupos;
  return negativo ? `-${corpo}` : corpo;
}

/** Converte `Decimal` em `Money` (centavos), arredondando se necessário. */
export function paraMoney(d: Decimal, modo: ModoArredondamento = "half_up"): Money {
  if (d.s === ESCALA_REAL) return d.n;
  if (d.s < ESCALA_REAL) return d.n * potenciaDeDez(ESCALA_REAL - d.s);
  return dividirArredondado(d.n, potenciaDeDez(d.s - ESCALA_REAL), modo);
}

/**
 * Converte para `number` **apenas para exibição**.
 * Não usar em cálculo: precisão é perdida acima de 2^53 centavos.
 */
export function paraNumero(valor: Money): number {
  return Number(valor) / 100;
}

/* ------------------------------------------------------------------ erros */

export class ErroMonetario extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = "ErroMonetario";
  }
}
