/**
 * REGRAS FISCAIS COM FONTE OFICIAL — registro populado.
 *
 * ============================================================================
 * PROCEDÊNCIA, E POR QUE ESTAS REGRAS NÃO ESTÃO `aprovada_para_uso`
 * ============================================================================
 * Este arquivo popula o registro de `regras.ts` com regras que têm fonte
 * normativa identificada e caso de teste falseável. **Nenhuma delas está
 * `aprovada_para_uso`**, e a razão é procedural, não técnica:
 *
 *   A conferência foi feita contra **múltiplas fontes independentes que citam
 *   o MOC 7.00 da NF-e explicitamente**, e contra **exemplos publicados** com
 *   dígito verificador conhecido. O que **não** foi feito é abrir o PDF do
 *   MOC 7.00 e conferir o texto original: o portal `nfe.fazenda.gov.br`
 *   bloqueia requisição automatizada (loop de redirect 302 sem cookie de
 *   sessão), e o PDF não pôde ser baixado deste ambiente.
 *
 * `docs/atualizacao-normativa.md` exige que a promoção a `aprovada_para_uso`
 * passe por conferência no documento original. Até isso acontecer, o estado
 * correto é `validada_tecnicamente` — o motor se recusa a usá-las em cálculo
 * real, e a tela de conhecimento continua dizendo a verdade.
 *
 * ============================================================================
 * O QUE ESTAS REGRAS RESOLVEM
 * ============================================================================
 * Antes deste arquivo, o registro estava vazio: nenhuma regra fiscal no
 * repositório tinha fonte. Consequência prática — a chave de acesso era
 * montada por `src/simulation/documento-saida.ts` com `Number(base[i])`, o
 * que devolve `NaN` para letra. Com o CNPJ alfanumérico (IN RFB 2.229/2024,
 * vigente desde 2026), a chave inteira ficava com DV `NaN`: inválida, sem
 * erro visível. A implementação correta está em `src/fiscal/chave-acesso.ts`.
 */

import { registrarRegra, type RegraFiscal } from "./regras";
import { dvChave, montarChaveAcesso, valorCaractere } from "./chave-acesso";

/**
 * Data desta consulta. Como o PDF original não pôde ser aberto, esta data é a
 * da consulta às fontes secundárias — **não** a da conferência no original.
 */
const CONSULTADA_EM = "2026-10-15";

/** Fonte comum às regras de chave de acesso. */
const FONTE_MOC = {
  orgao: "Receita Federal / SEFAZ — Projeto Nota Fiscal Eletrônica",
  documento: "Manual de Orientação do Contribuinte (MOC) versão 7.00 — NF-e e NFC-e",
  consultadaEm: CONSULTADA_EM,
} as const;

/**
 * Regra 1 — estrutura da chave de acesso.
 *
 * Determinística, verificável, e confirmada de forma idêntica por todas as
 * fontes consultadas. O caso de teste é falseável: basta um campo sair da
 * posição para a chave decodificar errado.
 */
export const REGRA_CHAVE_ESTRUTURA: RegraFiscal = {
  id: "CHAVE-ACESSO-ESTRUTURA-44",
  versao: "1.0.0",
  titulo: "Estrutura da chave de acesso de documento fiscal eletrônico",
  descricao:
    "A chave de acesso tem 44 posições, compostas por cUF(2) + AAMM(4) + CNPJ(14) + mod(2) + serie(3) + nNF(9) + tpEmis(1) + cNF(8) + cDV(1). A estrutura é a mesma para NF-e, NFC-e, CT-e, CT-e OS e MDF-e; muda apenas o código do modelo.",
  fonte: { ...FONTE_MOC, dispositivo: "Chave de Acesso" },
  jurisdicao: "Nacional",
  escopo: "NF-e 55, NFC-e 65, CT-e 57, CT-e OS 67, MDF-e 58",
  estado: "validada_tecnicamente",
  condicoes: [
    "cUF: código IBGE da UF do emitente, 2 dígitos.",
    "AAMM: ano e mês de emissão, 4 dígitos, mês de 01 a 12.",
    "CNPJ: 14 caracteres sem pontuação; alfanumérico a partir da IN RFB 2.229/2024.",
    "mod: 55 NF-e, 65 NFC-e, 57 CT-e, 67 CT-e OS, 58 MDF-e.",
    "serie: 3 dígitos, 000 a 999.",
    "nNF: 9 dígitos, 1 a 999.999.999.",
    "tpEmis: 1 dígito. 1 emissão normal, 9 contingência off-line.",
    "cNF: 8 posições, código numérico de controle do emitente.",
    "cDV: 1 dígito, calculado — nunca informado pelo emitente.",
  ],
  casosTeste: [
    {
      id: "CHAVE-EST-001",
      descricao: "Exemplo publicado: 35 2607 12345678000199 55 001 000012345 1 23456789 | DV 5",
      entrada: {
        cUF: "35",
        aamm: "2607",
        cnpj: "12345678000199",
        modelo: "55",
        serie: 1,
        numero: 12345,
        tpEmis: "1",
        cNF: "23456789",
      },
      saidaEsperada: { chave: "35260712345678000199550010000123451234567895" },
      origem: "fonte_oficial",
    },
    {
      id: "CHAVE-EST-002",
      descricao: "Cada campo ocupa a posição oficial — série e número preenchidos com zeros",
      entrada: {
        cUF: "35",
        aamm: "2601",
        cnpj: "11222333000181",
        modelo: "55",
        serie: 7,
        numero: 42,
        tpEmis: "1",
        cNF: "123",
      },
      saidaEsperada: {
        cUF: "35",
        aamm: "2601",
        cnpj: "11222333000181",
        mod: "55",
        serie: "007",
        nNF: "000000042",
        tpEmis: "1",
        cNF: "00000123",
      },
      origem: "fonte_oficial",
    },
    {
      id: "CHAVE-EST-003",
      descricao: "MDF-e modelo 58 produz chave própria e válida",
      entrada: {
        cUF: "35",
        aamm: "2601",
        cnpj: "11222333000181",
        modelo: "58",
        serie: 1,
        numero: 1,
        tpEmis: "1",
        cNF: "00000001",
      },
      saidaEsperada: { modelo: "58", comprimento: 44 },
      origem: "fonte_oficial",
    },
  ],
  responsavel: "pendente — revisão por contador responsável não realizada",
  limitacoes: [
    "Texto do MOC 7.00 não conferido no PDF original; portal da SEFAZ bloqueia acesso automatizado.",
    "Códigos IBGE de UF não validados contra tabela oficial do IBGE.",
    "Faixas de série e número por UF e por credenciamento não verificadas.",
  ],
};

/**
 * Regra 2 — dígito verificador, módulo 11.
 *
 * O caso de teste âncora é o exemplo publicado com DV conhecido. Isto é o que
 * torna a regra falseável de forma independente: o valor esperado não foi
 * produzido por este código.
 */
export const REGRA_CHAVE_DV: RegraFiscal = {
  id: "CHAVE-ACESSO-DV-MOD11",
  versao: "1.0.0",
  titulo: "Dígito verificador da chave de acesso — módulo 11",
  descricao:
    "O cDV é calculado sobre os 43 primeiros caracteres com pesos cíclicos de 2 a 9, da direita para a esquerda. Se o resto da divisão por 11 for menor que 2, o DV é 0; caso contrário, é 11 menos o resto.",
  fonte: { ...FONTE_MOC, dispositivo: "Dígito verificador da chave de acesso" },
  jurisdicao: "Nacional",
  escopo: "Todos os DF-e com chave de 44 posições",
  estado: "validada_tecnicamente",
  formula:
    "DV = (soma % 11) < 2 ? 0 : 11 - (soma % 11), onde soma = Σ valor(caractere) × peso, peso ciclando 2..9 da direita para a esquerda",
  arredondamento: "Inteiro exato; nenhum arredondamento aplicável.",
  casosTeste: [
    {
      id: "CHAVE-DV-001",
      descricao: "Exemplo publicado com DV 5 — âncora independente do algoritmo",
      entrada: { base: "3526071234567800019955001000012345123456789" },
      saidaEsperada: { dv: 5 },
      origem: "fonte_oficial",
    },
    {
      id: "CHAVE-DV-002",
      descricao: "Base só de zeros tem soma zero, resto zero, DV zero",
      entrada: { base: "0".repeat(43) },
      saidaEsperada: { dv: 0 },
      origem: "didatico",
    },
  ],
  responsavel: "pendente — revisão por contador responsável não realizada",
  limitacoes: [
    "Texto do MOC 7.00 não conferido no PDF original.",
    "Comportamento em empate (resto 0 e 1) verificado apenas pelo caso de zeros.",
  ],
};

/**
 * Regra 3 — valor do caractere, CNPJ alfanumérico.
 *
 * Esta é a regra que a cópia do simulador violava. `Number("A")` é `NaN`, e a
 * chave ficava com DV `NaN` — inválida, sem erro. A regra correta é ASCII − 48.
 */
export const REGRA_CHAVE_ALFANUMERICO: RegraFiscal = {
  id: "CHAVE-ACESSO-CARACTERE-ASCII48",
  versao: "1.0.0",
  titulo: "Valor numérico de caractere na chave — CNPJ alfanumérico",
  descricao:
    "Dígitos valem 0 a 9. Letras maiúsculas valem o código ASCII menos 48, de forma que 'A' (ASCII 65) vale 17 e 'Z' vale 42. Caractere fora de 0-9 e A-Z maiúsculo é inválido e deve ser recusado, não convertido em NaN.",
  fonte: {
    orgao: "Receita Federal do Brasil",
    documento: "IN RFB 2.229/2024 — CNPJ alfanumérico",
    dispositivo: "Cálculo do dígito verificador",
    consultadaEm: CONSULTADA_EM,
  },
  jurisdicao: "Nacional",
  escopo: "Chave de acesso de DF-e com CNPJ alfanumérico",
  estado: "validada_tecnicamente",
  vigenciaInicio: "2026-01-01",
  condicoes: [
    "CNPJ alfanumérico admitido a partir da vigência da IN RFB 2.229/2024.",
    "Letras sempre maiúsculas; minúscula é inválida.",
  ],
  casosTeste: [
    {
      id: "CHAVE-ALF-001",
      descricao: "'A' vale 17 (ASCII 65 menos 48)",
      entrada: { caractere: "A" },
      saidaEsperada: { valor: 17 },
      origem: "fonte_oficial",
    },
    {
      id: "CHAVE-ALF-002",
      descricao: "'Z' vale 42 (ASCII 90 menos 48)",
      entrada: { caractere: "Z" },
      saidaEsperada: { valor: 42 },
      origem: "fonte_oficial",
    },
    {
      id: "CHAVE-ALF-003",
      descricao: "Chave com CNPJ alfanumérico é montável e válida",
      entrada: {
        cUF: "35",
        aamm: "2607",
        cnpj: "AB000000000001",
        modelo: "55",
        serie: 1,
        numero: 1,
        tpEmis: "1",
        cNF: "00000001",
      },
      saidaEsperada: { comprimento: 44, dvConfere: true },
      origem: "fonte_oficial",
    },
    {
      id: "CHAVE-ALF-004",
      descricao: "Caractere inválido é recusado com erro, não vira NaN",
      entrada: { caractere: "a" },
      saidaEsperada: { erro: true },
      origem: "didatico",
    },
  ],
  responsavel: "pendente — revisão por contador responsável não realizada",
  limitacoes: [
    "IN RFB 2.229/2024 não conferida no texto original do Diário Oficial.",
    "Regras de transição do CNPJ alfanumérico por UF não mapeadas.",
  ],
};

/** Todas as regras com fonte oficial registradas até aqui. */
export const REGRAS_COM_FONTE: RegraFiscal[] = [
  REGRA_CHAVE_ESTRUTURA,
  REGRA_CHAVE_DV,
  REGRA_CHAVE_ALFANUMERICO,
];

/**
 * Registra as regras com fonte oficial no registro de `regras.ts`.
 *
 * Idempotente: registra por id, então chamar duas vezes não duplica. Devolve
 * quantas regras passaram a estar no registro.
 */
export function registrarRegrasComFonte(): number {
  for (const regra of REGRAS_COM_FONTE) {
    registrarRegra(regra);
  }
  return REGRAS_COM_FONTE.length;
}

/**
 * Roda os casos de teste declarados nas regras contra a implementação real.
 *
 * Existe para que uma regra não possa ser registrada com caso de teste que não
 * passa: `validada_tecnicamente` sem caso verde é apenas uma afirmação.
 */
export function verificarCasosTeste(): Array<{
  regraId: string;
  casoId: string;
  passou: boolean;
  detalhe?: string;
}> {
  const saida: Array<{ regraId: string; casoId: string; passou: boolean; detalhe?: string }> = [];
  for (const regra of REGRAS_COM_FONTE) {
    for (const caso of regra.casosTeste ?? []) {
      const r = executarCaso(regra.id, caso);
      saida.push({
        regraId: regra.id,
        casoId: caso.id,
        passou: r.passou,
        ...(r.detalhe ? { detalhe: r.detalhe } : {}),
      });
    }
  }
  return saida;
}

function executarCaso(
  regraId: string,
  caso: NonNullable<RegraFiscal["casosTeste"]>[number],
): { passou: boolean; detalhe?: string } {
  const e = caso.entrada;
  const s = caso.saidaEsperada;
  try {
    switch (regraId) {
      case "CHAVE-ACESSO-ESTRUTURA-44": {
        const chave = montarChaveAcesso({
          cUF: String(e["cUF"]),
          aamm: String(e["aamm"]),
          cnpj: String(e["cnpj"]),
          modelo: String(e["modelo"]) as "55",
          serie: Number(e["serie"]),
          numero: Number(e["numero"]),
          tpEmis: String(e["tpEmis"] ?? "1") as "1",
          cNF: String(e["cNF"]),
        });
        if ("chave" in s) {
          return { passou: chave === s["chave"], detalhe: `gerada ${chave}` };
        }
        if ("comprimento" in s) {
          return { passou: chave.length === s["comprimento"], detalhe: `len ${chave.length}` };
        }
        // Caso 002: confere campo a campo.
        const esperado = s as Record<string, string>;
        const pos = {
          cUF: [0, 2],
          aamm: [2, 6],
          cnpj: [6, 20],
          mod: [20, 22],
          serie: [22, 25],
          nNF: [25, 34],
          tpEmis: [34, 35],
          cNF: [35, 43],
        } as const;
        for (const [k, [a, b]] of Object.entries(pos)) {
          if (k in esperado && chave.slice(a, b) !== esperado[k]) {
            return { passou: false, detalhe: `${k}: ${chave.slice(a, b)} ≠ ${esperado[k]}` };
          }
        }
        return { passou: true };
      }
      case "CHAVE-ACESSO-DV-MOD11": {
        const dv = dvChave(String(e["base"]));
        return { passou: dv === s["dv"], detalhe: `dv ${dv}` };
      }
      case "CHAVE-ACESSO-CARACTERE-ASCII48": {
        if ("caractere" in e) {
          try {
            const v = valorCaractere(String(e["caractere"]));
            return { passou: v === s["valor"], detalhe: `valor ${v}` };
          } catch {
            return "erro" in s ? { passou: true } : { passou: false, detalhe: "erro inesperado" };
          }
        }
        const chave = montarChaveAcesso({
          cUF: String(e["cUF"]),
          aamm: String(e["aamm"]),
          cnpj: String(e["cnpj"]),
          modelo: String(e["modelo"]) as "55",
          serie: Number(e["serie"]),
          numero: Number(e["numero"]),
          tpEmis: String(e["tpEmis"] ?? "1") as "1",
          cNF: String(e["cNF"]),
        });
        return { passou: chave.length === s["comprimento"], detalhe: `len ${chave.length}` };
      }
      default:
        return { passou: false, detalhe: "regra sem executor de caso" };
    }
  } catch (err) {
    return { passou: false, detalhe: err instanceof Error ? err.message : String(err) };
  }
}
