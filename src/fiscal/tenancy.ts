/**
 * MULTIEMPRESA E ISOLAMENTO (multi-tenant).
 *
 * ============================================================================
 * REGRA INEGOCIÁVEL
 * ============================================================================
 * Nenhum usuário de uma empresa pode consultar documentos, certificados,
 * configurações ou dados fiscais de outra empresa sem autorização explícita e
 * auditável. Este módulo é a barreira: toda entidade de negócio carrega
 * `tenantId`, e toda operação passa por `assertMesmoTenant`.
 *
 * O isolamento é **estrutural**, não por convenção: quem tentar ler um recurso
 * de outro tenant recebe `AcessoCrossTenant` — um erro ruidoso, nunca um
 * resultado vazio silencioso (que seria indistinguível de "não existe" e
 * esconderia a tentativa de acesso).
 */

export interface Tenant {
  id: string;
  nome: string;
  /** CNPJ da matriz, quando houver. Validado estruturalmente apenas. */
  cnpjMatriz?: string | undefined;
  ativo: boolean;
}

/** Regime tributário. Valores de catálogo; a vigência fica no registro de regras. */
export type RegimeTributario =
  | "simples_nacional"
  | "simples_nacional_excesso"
  | "lucro_presumido"
  | "lucro_real"
  | "mei"
  | "nao_definido";

export interface Empresa {
  id: string;
  tenantId: string;
  razaoSocial: string;
  nomeFantasia?: string | undefined;
  cnpj: string;
  /** Inscrição estadual. Pode ser "ISENTO" ou vazio quando não aplicável. */
  inscricaoEstadual?: string | undefined;
  inscricaoMunicipal?: string | undefined;
  cnae?: string | undefined;
  municipio: string;
  uf: string;
  pais: string;
  regimeTributario: RegimeTributario;
  ativo: boolean;
  criadoEm: string;
  atualizadoEm: string;
}

export interface Estabelecimento {
  id: string;
  tenantId: string;
  empresaId: string;
  cnpj: string;
  inscricaoEstadual?: string | undefined;
  inscricaoMunicipal?: string | undefined;
  municipio: string;
  uf: string;
  /**
   * Série por modelo documental (ex.: { "55": 1, "65": 1, "57": 1 }).
   * A numeração é controlada por estabelecimento + modelo + série.
   */
  series: Record<string, number>;
  /** 1 = produção, 2 = homologação. O simulador é fixo em 2. */
  ambiente: 1 | 2;
  ativo: boolean;
}

/** Metadados do certificado digital. A chave privada NUNCA entra aqui. */
export interface CertificadoDigital {
  id: string;
  tenantId: string;
  estabelecimentoId: string;
  /** Identificação pública do certificado (thumbprint/serial). */
  thumbprint: string;
  titular: string;
  cnpj: string;
  validoDe: string;
  validoAte: string;
  /** Autoridade certificadora. */
  emissor: string;
  revogado: boolean;
}

/* ------------------------------------------------------------------ erros */

export class ErroTenancy extends Error {
  constructor(
    mensagem: string,
    readonly tenantId?: string,
  ) {
    super(mensagem);
    this.name = "ErroTenancy";
  }
}

/** Acesso a recurso de outro tenant. Sempre registrado em auditoria. */
export class AcessoCrossTenant extends ErroTenancy {
  constructor(tenantSolicitante: string, tenantRecurso: string) {
    super(
      `Acesso negado: tenant "${tenantSolicitante}" tentou acessar recurso do tenant "${tenantRecurso}". ` +
        `A tentativa deve ser registrada em auditoria.`,
      tenantRecurso,
    );
    this.name = "AcessoCrossTenant";
  }
}

/* ------------------------------------------------------------- validações */

/**
 * Validação **estrutural** de CNPJ (14 dígitos + dígitos verificadores).
 *
 * ATENÇÃO: um CNPJ estruturalmente válido NÃO significa que a empresa esteja
 * habilitada a emitir documentos fiscais. Habilitação, situação cadastral e
 * credenciamento são verificados nos serviços oficiais, fora deste código.
 */
export function cnpjEstruturalmenteValido(cnpj: string): boolean {
  const limpo = cnpj.replace(/\D/g, "");
  if (limpo.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(limpo)) return false; // dígitos repetidos

  const digitos = limpo.split("").map(Number);

  const calculaDv = (tamanho: number): number => {
    let soma = 0;
    let peso = tamanho - 7;
    for (let i = 0; i < tamanho; i++) {
      soma += digitos[i]! * peso;
      peso = peso === 2 ? 9 : peso - 1;
    }
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };

  return calculaDv(12) === digitos[12]! && calculaDv(13) === digitos[13]!;
}

/**
 * Validação estrutural de CPF (11 dígitos + dígitos verificadores).
 * Mesma ressalva do CNPJ: valida formato, não situação cadastral.
 */
export function cpfEstruturalmenteValido(cpf: string): boolean {
  const limpo = cpf.replace(/\D/g, "");
  if (limpo.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(limpo)) return false;

  const digitos = limpo.split("").map(Number);
  const calculaDv = (tamanho: number): number => {
    let soma = 0;
    for (let i = 0; i < tamanho; i++) soma += digitos[i]! * (tamanho + 1 - i);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  return calculaDv(9) === digitos[9]! && calculaDv(10) === digitos[10]!;
}

/** Documento (CPF ou CNPJ) válido estruturalmente. */
export function documentoEstruturalmenteValido(documento: string): boolean {
  const limpo = documento.replace(/\D/g, "");
  return limpo.length === 11 ? cpfEstruturalmenteValido(limpo) : cnpjEstruturalmenteValido(limpo);
}

/* -------------------------------------------------------------- isolamento */

/** Barreira de isolamento. Lança `AcessoCrossTenant` se os tenants divergem. */
export function assertMesmoTenant(tenantSolicitante: string, tenantRecurso: string): void {
  if (tenantSolicitante !== tenantRecurso) {
    throw new AcessoCrossTenant(tenantSolicitante, tenantRecurso);
  }
}

/** Versão que devolve booleano, para filtros de consulta. */
export function mesmoTenant(tenantSolicitante: string, tenantRecurso: string): boolean {
  return tenantSolicitante === tenantRecurso;
}

/**
 * Filtra uma lista pelo tenant. Usado em toda consulta: o isolamento é aplicado
 * na query, não apenas na leitura do registro — assim nem a existência do
 * recurso vaza para outro tenant.
 */
export function filtrarPorTenant<T extends { tenantId: string }>(
  itens: T[],
  tenantId: string,
): T[] {
  return itens.filter((i) => i.tenantId === tenantId);
}

/* ------------------------------------------------------------ habilitação */

export interface HabilitacaoEmissao {
  apto: boolean;
  pendencias: string[];
}

/**
 * Verifica os pré-requisitos **técnicos** de emissão de um estabelecimento.
 *
 * Deliberadamente não afirma habilitação fiscal: credenciamento junto à SEFAZ,
 * situação cadastral e autorização de uso são verificados externamente. O que
 * este código garante é que o cadastro interno está completo e o certificado
 * existe e está dentro da validade.
 */
export function verificarHabilitacaoTecnica(
  estabelecimento: Estabelecimento,
  certificado: CertificadoDigital | undefined,
  agora: string,
): HabilitacaoEmissao {
  const pendencias: string[] = [];

  if (!cnpjEstruturalmenteValido(estabelecimento.cnpj)) {
    pendencias.push("CNPJ do estabelecimento não é estruturalmente válido.");
  }
  if (!estabelecimento.ativo) pendencias.push("Estabelecimento inativo.");
  if (!estabelecimento.municipio || !estabelecimento.uf) {
    pendencias.push("Município/UF do estabelecimento não informados.");
  }
  if (estabelecimento.ambiente !== 2) {
    // O simulador nunca emite em produção. Em produção real, ambiente 1 exige
    // credenciamento confirmado externamente — verificado fora deste código.
    pendencias.push(
      `Ambiente ${estabelecimento.ambiente} selecionado. O simulador opera exclusivamente em homologação (2).`,
    );
  }
  if (!certificado) {
    pendencias.push("Nenhum certificado digital vinculado ao estabelecimento.");
  } else {
    if (certificado.revogado) pendencias.push("Certificado digital revogado.");
    if (certificado.validoAte < agora) {
      pendencias.push(`Certificado digital vencido em ${certificado.validoAte}.`);
    }
    if (certificado.validoDe > agora) {
      pendencias.push(`Certificado digital ainda não válido (início ${certificado.validoDe}).`);
    }
  }

  return { apto: pendencias.length === 0, pendencias };
}
