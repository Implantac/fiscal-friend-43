/**
 * CHAVE DE ACESSO DE DOCUMENTO FISCAL ELETRÔNICO — implementação oficial.
 *
 * ============================================================================
 * PROCEDÊNCIA DAS REGRAS AQUI IMPLEMENTADAS
 * ============================================================================
 * As regras deste arquivo vêm do **Manual de Orientação do Contribuinte
 * (MOC) versão 7.00 — NF-e e NFC-e**, da Receita Federal / SEFAZ.
 *
 * restrição de acesso: o portal `nfe.fazenda.gov.br` bloqueia requisição
 * automatizada (loop de redirect 302 sem cookie de sessão). O PDF do MOC não
 * pôde ser baixado daqui. As regras foram confirmadas por **múltiplas fontes
 * independentes que citam o MOC 7.00 explicitamente**, e a estrutura da chave
 * é confirmada de forma idêntica por todas elas. A versão exata do MOC
 * consultada e a data de conferência no documento original ficam registradas
 * em `regras-oficiais.ts` — **a conferência no PDF original ainda não foi
 * feita**, e por isso as regras entram como `validada_tecnicamente`, não
 * `aprovada_para_uso`. Ver `docs/atualizacao-normativa.md`.
 *
 * ============================================================================
 * O QUE ESTE ARQUIVO SUBSTITUI
 * ============================================================================
 * Havia uma cópia de `dvModulo11` em `src/simulation/documento-saida.ts`, com
 * `Number(base[i])`. Dois problemas:
 *
 *  1. **Bug real com CNPJ alfanumérico.** Desde a IN RFB 2.229/2024, o CNPJ
 *     passou a admitir letras. `Number("A")` é `NaN`, `NaN * peso` é `NaN`, e
 *     a chave inteira ficava com DV `NaN` — inválida, sem erro visível.
 *  2. **Estava no lugar errado.** Regra fiscal no simulador não pode ser usada
 *     pelo domínio. A versão daqui é a que vale; o simulador delega para cá.
 */

/** Modelos de documento fiscal eletrônico e seus códigos oficiais. */
export const MODELO_DOCUMENTO = {
  "55": "NF-e — Nota Fiscal Eletrônica",
  "65": "NFC-e — Nota Fiscal de Consumidor Eletrônica",
  "57": "CT-e — Conhecimento de Transporte Eletrônico",
  "67": "CT-e OS — Conhecimento de Transporte Eletrônico para Outros Serviços",
  "58": "MDF-e — Manifesto Eletrônico de Documentos Fiscais",
} as const;

export type CodigoModelo = keyof typeof MODELO_DOCUMENTO;

/**
 * Tipos de emissão (`tpEmis`). Os códigos variam por modelo e por UF; a lista
 * abaixo cobre o que é comum. Códigos não confirmados no manual do modelo
 * específico **não** entram aqui.
 */
export const TIPO_EMISSAO = {
  "1": "Emissão normal",
  "9": "Contingência off-line",
} as const;

export type CodigoTpEmis = keyof typeof TIPO_EMISSAO;

/** Tamanho, em caracteres, de cada campo da chave. */
export const LAYOUT_CHAVE = [
  { campo: "cUF", tamanho: 2 },
  { campo: "AAMM", tamanho: 4 },
  { campo: "CNPJ", tamanho: 14 },
  { campo: "mod", tamanho: 2 },
  { campo: "serie", tamanho: 3 },
  { campo: "nNF", tamanho: 9 },
  { campo: "tpEmis", tamanho: 1 },
  { campo: "cNF", tamanho: 8 },
  { campo: "cDV", tamanho: 1 },
] as const;

export const TAMANHO_CHAVE = LAYOUT_CHAVE.reduce((s, c) => s + c.tamanho, 0);

/** Dígito verificador da chave: módulo 11, pesos 2 a 9, da direita para a esquerda. */
export function dvChave(base43: string): number {
  if (base43.length !== TAMANHO_CHAVE - 1) {
    throw new Error(
      `Base da chave deve ter ${TAMANHO_CHAVE - 1} caracteres; recebeu ${base43.length}.`,
    );
  }
  let peso = 2;
  let soma = 0;
  for (let i = base43.length - 1; i >= 0; i--) {
    const c = base43[i];
    if (c === undefined) {
      throw new Error("Índice fora dos limites ao calcular o DV da chave.");
    }
    soma += valorCaractere(c) * peso;
    peso = peso === 9 ? 2 : peso + 1;
  }
  const resto = soma % 11;
  return resto < 2 ? 0 : 11 - resto;
}

/**
 * Valor numérico de um caractere da chave.
 *
 * Dígitos valem 0–9. Letras maiúsculas valem **código ASCII menos 48** — é o
 * que a IN RFB 2.229/2024 definiu para o CNPJ alfanumérico, e o que o cálculo
 * do dígito verificador passou a usar. `"A"` (ASCII 65) vale 17.
 *
 * Qualquer outra coisa é erro: a chave é `0-9` e `A-Z` maiúsculo, e aceitar
 * silenciosamente minúscula ou símbolo produziria chave inválida sem aviso.
 */
export function valorCaractere(c: string): number {
  if (c >= "0" && c <= "9") return c.charCodeAt(0) - 48;
  if (c >= "A" && c <= "Z") return c.charCodeAt(0) - 48;
  throw new Error(
    `Caractere "${c}" não é válido em chave de acesso (permitido: 0-9 e A-Z maiúsculo).`,
  );
}

export interface EntradaChave {
  /** Código IBGE da UF do emitente (2 dígitos). */
  cUF: string;
  /** Ano e mês de emissão, formato AAMM (4 dígitos). */
  aamm: string;
  /** CNPJ do emitente, sem pontuação (14 caracteres; alfanumérico a partir de 2026). */
  cnpj: string;
  /** Modelo do documento. */
  modelo: CodigoModelo;
  /** Série (1–999). */
  serie: number;
  /** Número do documento (1–999.999.999). */
  numero: number;
  /** Tipo de emissão. */
  tpEmis?: CodigoTpEmis;
  /** Código numérico de controle do emitente (8 caracteres). */
  cNF: string;
}

function pad(v: string | number, n: number): string {
  return String(v).padStart(n, "0");
}

/**
 * Monta a chave de acesso completa, com o dígito verificador calculado.
 *
 * A chave resultante tem 44 caracteres e é validada campo a campo antes de ser
 * devolvida — uma chave mal formada é erro, não resultado.
 */
export function montarChaveAcesso(e: EntradaChave): string {
  const base = [
    pad(e.cUF, 2),
    pad(e.aamm, 4),
    pad(e.cnpj, 14),
    pad(e.modelo, 2),
    pad(e.serie, 3),
    pad(e.numero, 9),
    pad(e.tpEmis ?? "1", 1),
    pad(e.cNF, 8),
  ].join("");
  const chave = base + String(dvChave(base));
  validarChave(chave);
  return chave;
}

export interface ChaveDecodificada {
  cUF: string;
  aamm: string;
  cnpj: string;
  modelo: string;
  serie: number;
  numero: number;
  tpEmis: string;
  cNF: string;
  cDV: number;
  dvConfere: boolean;
}

/** Decodifica uma chave e confere o dígito verificador. */
export function decodificarChave(chave: string): ChaveDecodificada {
  if (chave.length !== TAMANHO_CHAVE) {
    throw new Error(`Chave deve ter ${TAMANHO_CHAVE} caracteres; recebeu ${chave.length}.`);
  }
  let p = 0;
  const cortar = (n: number) => chave.slice(p, (p += n));
  const cUF = cortar(2);
  const aamm = cortar(4);
  const cnpj = cortar(14);
  const modelo = cortar(2);
  const serie = cortar(3);
  const numero = cortar(9);
  const tpEmis = cortar(1);
  const cNF = cortar(8);
  const cDV = Number(cortar(1));
  let dvConfere = false;
  try {
    dvConfere = dvChave(chave.slice(0, TAMANHO_CHAVE - 1)) === cDV;
  } catch {
    dvConfere = false;
  }
  return {
    cUF,
    aamm,
    cnpj,
    modelo,
    serie: Number(serie),
    numero: Number(numero),
    tpEmis,
    cNF,
    cDV,
    dvConfere,
  };
}

/**
 * Valida a chave inteira: tamanho, alfabeto, e dígito verificador.
 *
 * `dvConfere` é devolvido em vez de lançar, porque a conferência do DV é o uso
 * mais comum — detectar chave digitada errada. Erro de formato é exceção.
 */
export function validarChave(chave: string): boolean {
  if (chave.length !== TAMANHO_CHAVE) {
    throw new Error(`Chave deve ter ${TAMANHO_CHAVE} caracteres; recebeu ${chave.length}.`);
  }
  for (const c of chave) {
    if (!((c >= "0" && c <= "9") || (c >= "A" && c <= "Z"))) {
      throw new Error(`Chave contém caractere inválido "${c}" (permitido: 0-9 e A-Z maiúsculo).`);
    }
  }
  return decodificarChave(chave).dvConfere;
}

/** Gera `cNF` numérico de 8 posições, sem `Math.random` em caminho testável. */
export function gerarCNF(semente: number): string {
  return pad(Math.abs(Math.trunc(semente)) % 100_000_000, 8);
}
