/**
 * ESTRUTURA MÍNIMA DE DESENVOLVIMENTO — tenant, empresa e estabelecimento.
 *
 * ============================================================================
 * POR QUE ISTO EXISTE
 * ============================================================================
 * `documentos_fiscais` tem chaves estrangeiras para `empresas` e
 * `estabelecimentos`, e ambas as tabelas têm RLS comparando `tenant_id` com
 * `app.tenant_id`. Consequência: **não é possível criar um documento sem que o
 * tenant, a empresa e o estabelecimento já existam**, e sem que o contexto de
 * tenant esteja fixado — `set_config('app.tenant_id', …)` faz
 * `NULLIF(…)::UUID`, que lança erro se o identificador não for um UUID válido.
 *
 * O arranque de desenvolvimento anterior passava `"tenant-dev"` como
 * `tenant_id`. Contra o Postgres isso falha em dois lugares: na conversão para
 * UUID e na chave estrangeira de `tenants`. O login de desenvolvimento só
 * "funcionava" no caminho em memória, que não tem nenhuma das duas restrições —
 * ou seja, o teste que passava não cobria o caminho real.
 *
 * Este módulo cria a estrutura com identificadores **determinísticos** derivados
 * do nome do tenant (`uuidDeterministico`), para que o segundo arranque encontre
 * as mesmas linhas em vez de criar um segundo tenant.
 *
 * ============================================================================
 * O QUE ISTO NÃO É
 * ============================================================================
 * Não é cadastro de produção. Em produção, tenant/empresa/estabelecimento
 * entram por fluxo de contratação com CNPJ, certificado e credenciamento —
 * nada disso existe ainda. Por isso este módulo só é chamado quando as
 * variáveis de desenvolvimento (`DEV_AUTH_EMAIL`/`DEV_AUTH_SENHA`) estão
 * presentes, e nunca em produção.
 */

import { tenantDevId, uuidDeterministico } from "./ambiente";
import type { SqlExecutor } from "@/fiscal/persistencia-postgres";

export interface EstruturaDev {
  tenantId: string;
  empresaId: string;
  estabelecimentoId: string;
}

/**
 * Cria (ou encontra) a estrutura mínima de desenvolvimento.
 *
 * Idempotente: `ON CONFLICT DO NOTHING` em cada inserção, então chamar duas
 * vezes não duplica nem sobrescreve. Cada escrita roda dentro de
 * `emTransacao(tenantId, …)` — sem o contexto de tenant, a política de RLS
 * barraria a inserção com **zero linhas afetadas**, que é o pior modo de falha
 * possível neste sistema.
 */
/**
 * Identificadores determinísticos da estrutura de desenvolvimento, sem tocar
 * no banco. Usado também no caminho em memória, onde não há chave estrangeira:
 * os ids são rótulos, e precisam ser os mesmos em todo caso para que o login
 * e a criação de documento falem ou funcionem juntos.
 */
export function estruturaDevDeterministica(): EstruturaDev {
  const nomeTenant = process.env["DEV_AUTH_TENANT"] ?? "tenant-dev";
  return {
    tenantId: tenantDevId(nomeTenant),
    empresaId: uuidDeterministico(`empresa:${nomeTenant}`),
    estabelecimentoId: uuidDeterministico(`estabelecimento:${nomeTenant}`),
  };
}

export async function garantirEstruturaDev(sql: SqlExecutor): Promise<EstruturaDev> {
  const nomeTenant = process.env["DEV_AUTH_TENANT"] ?? "tenant-dev";
  const { tenantId, empresaId, estabelecimentoId } = estruturaDevDeterministica();
  const nomeEmpresa = process.env["DEV_EMPRESA_NOME"] ?? "Empresa de Desenvolvimento";
  const cnpj = process.env["DEV_EMPRESA_CNPJ"] ?? "11222333000181";

  // `tenants` não tem RLS (é a raiz do isolamento, não um dado de tenant), mas
  // a transação é mantida por uniformidade e para que a criação da estrutura
  // seja atômica como um todo.
  await sql.emTransacao(tenantId, async (tx) => {
    await tx.query(
      `INSERT INTO tenants (id, nome, cnpj_matriz)
       VALUES ($1, $2, $3)
       ON CONFLICT (id) DO NOTHING`,
      [tenantId, nomeTenant, cnpj],
    );

    await tx.query(
      `INSERT INTO empresas (id, tenant_id, razao_social, cnpj, municipio, uf, regime_tributario)
       VALUES ($1, $2, $3, $4, 'Campinas', 'SP', 'simples_nacional')
       ON CONFLICT (id) DO NOTHING`,
      [empresaId, tenantId, nomeEmpresa, cnpj],
    );

    await tx.query(
      `INSERT INTO estabelecimentos (id, tenant_id, empresa_id, cnpj, municipio, uf, series, ambiente)
       VALUES ($1, $2, $3, $4, 'Campinas', 'SP', '{"55":1,"65":1}', 2)
       ON CONFLICT (id) DO NOTHING`,
      [estabelecimentoId, tenantId, empresaId, cnpj],
    );
  });

  return { tenantId, empresaId, estabelecimentoId };
}
