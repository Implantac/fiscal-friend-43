# Relatório final de limitações

> **Estado:** consolidado no commit `8623b34` (Etapa 2.13).
> **Regra deste documento:** nada aqui é estimativa otimista. Onde uma
> verificação não foi feita, está escrito que não foi feita.

## 1. Em uma frase

Este repositório contém um **simulador fiscal completo e visualmente
identificado**, um **domínio multi-tenant real e testado**, e **zero integração
com serviço fiscal real**. Não é, e não deve ser apresentado como, um emissor de
documentos fiscais eletrônicos autorizados.

## 2. O que está provado

| Item | Evidência |
|---|---|
| Domínio fiscal (`src/fiscal/`, ~8.350 linhas) | Única área com testes: 298 passando, 13 pulados, 23 arquivos |
| Multi-tenant, papéis, ciclo de vida, numeração, auditoria | Testados em `src/fiscal/` |
| Dinheiro exato ponta a ponta | `bigint` em centavos; round-trip verificado em 2⁵³+1 centavos |
| `tsc --noEmit` | 0 erros |
| `eslint` | 0 erros, 6 warnings `react-refresh` pré-existentes |
| `vite build` | exit 0 |
| Build publicado | `fiscal-friend-43.lovable.app`, 24 rotas em HTTP 200 |
| Bundle do cliente limpo | Zero `service_role`, zero JWT, zero `createPool`/`node:net`/`node:tls`/`set_config`/`INSERT INTO`/`ff_sessao` |
| Cabeçalhos de segurança | CSP, `X-Frame-Options`, `nosniff` aplicados por middleware |
| Fluxo autenticado por HTTP | 8/8 passos verdes contra servidor real |
| Simulador separado do domínio | `src/simulation/` não importa `src/fiscal/` |

## 3. O que NÃO está provado — e é o que importa

### 3.1 Nenhuma conexão com Postgres real jamais foi feita

Este é o elo não provado mais importante do projeto. Não há Postgres, Docker,
`psql` ou `pg_ctl` neste ambiente de desenvolvimento, e nenhum foi instalado.

Consequência: **as migrações 001 e 002 nunca foram aplicadas a uma instância
real.** O RLS é configurado no schema, mas nunca foi exercitado por um banco de
verdade. A suíte `src/fiscal/servidor/validacao-postgres.test.ts` (C1–C9)
existe justamente para isso, e 13 dos seus testes são **pulados** sem
`DATABASE_URL`.

Um defeito crítico já foi encontrado nesse caminho exatamente por leitura de
código, não por execução: `buscarPorTokenHash` fazia `JOIN usuarios` sem
contexto de tenant, o que sob RLS devolvia zero linhas e quebrava o login para
todo token válido — com HTTP 200. Corrigido na Etapa 2.11. Mas **a correção
também não foi verificada contra banco real.**

### 3.2 Zero integração com SEFAZ ou provedor

Não existe chamada de transmissão, consulta de status, cancelamento,
inutilização, manifestação de destinatário ou download de XML real. As portas
`EmissaoGateway` e `FiscalGateway` têm apenas implementação `Mock`.

**Nenhum documento foi autorizado por serviço fiscal em nenhum ambiente.** O
estado `autorizado` é **inalcançável da camada de serviço**: `MOTIVO_INDISPONIVEL`
em `src/fiscal/servidor/documento.ts` lança antes de tocar o banco.

### 3.3 Zero regras fiscais validadas

O registro em `src/fiscal/regras.ts` está **vazio por desenho**. As 17 regras da
base de conhecimento são todas `didatico`, `ilustrativo` ou `sem-fonte`.

**Nenhuma documentação fiscal oficial (SEFAZ, CONFAZ, Receita Federal,
TecnoSpeed, PlugNotas) foi consultada para construir este repositório.** Nenhuma
alíquota, CST, CSOSN, CFOP ou código de rejeição foi copiada de fonte oficial.

Consequência direta: **nenhuma afirmação de conformidade legal pode ser feita
sobre este sistema.**

### 3.4 Sem validação XSD e sem assinatura digital

Nenhum XML gerado foi validado contra XSD oficial. Nenhuma assinatura digital
foi produzida ou verificada. `CERTIFICADO_PFX_PATH` e `CERTIFICADO_PFX_SENHA`
existem no `.env.example` como placeholders para uma fase que **não começou**.

XML produzido localmente **não é documento fiscal autorizado**, e o sistema não
o apresenta como tal.

### 3.5 Sem credenciamento, sem certificado, sem homologação

Nenhum credenciamento junto a SEFAZ, nenhum certificado digital válido, nenhum
processo de homologação iniciado. Estes são pré-requisitos de produção e nenhum
existe.

## 4. O que é simulado, e onde

| Onde | O que simula |
|---|---|
| `src/simulation/emissao-gateway.ts` | Transmissão das 6 famílias de documento |
| `src/simulation/fiscal-gateway.ts` | Manifestação de destinatário, download de XML |
| `src/simulation/documento-saida.ts` | Geração de XML/PDF didático |
| `src/simulation/cadastros.ts`, `mock-data.ts` | Clientes, produtos, motoristas, veículos, serviços |
| `src/routes/{nfe,nfce,nfse,cte,cte-os,mdfe}.tsx` | As 6 telas de emissão — Ambiente de Simulação, fixo em `tpAmb=2` |

A separação é estrutural, não cosmética: `src/simulation/` **não importa**
`src/fiscal/`, e o simulador está impedido de gerar `tpAmb=1`.

## 5. Riscos conhecidos que não são defeitos, mas podem morder

| Risco | Situação |
|---|---|
| `bun.lock` dessincronizado | Faltam `pg`, `pg-mem`, `@types/pg`; sobram 24 pacotes removidos. **Não regenerável aqui** — bun não está instalado. Se o build do Lovable usar `--frozen-lockfile`, falha. |
| Engine do Node | `@tanstack/start-storage-context` declara `node >= 22.12.0`; o desenvolvimento usa 20.20.2 e o build passa mesmo assim. |
| Cabeçalhos verificados só no dev server | O preview de produção exige wrangler e rede. O mesmo `src/start.ts` é compilado para os dois, mas a execução em produção não foi observada. |
| 3 advisories em `tinypool` (via vitest) | Pré-existentes. **Não rodar `npm audit fix --force`** — atualiza o vitest para 4.x e quebra a suíte. |
| Repositório é público | `Implantac/fiscal-friend-43` responde HTTP 200 sem autenticação. Se o código deveria ser privado, é problema de configuração a resolver. |
| PAT trafegou em canal de conversa | O token usado para push passou pelo histórico da conversa. Precisa ser revogado e reemitido. |
| `~62% do código em src/ sem teste` | `src/routes`, `src/knowledge`, `src/components`, `src/blueprint` (~19.280 linhas) não têm teste de unidade. A verificação é por HTTP contra servidor real. |

## 6. O que foi decididamente abandonado, e não deve ser reproposto

| Abandonado | Motivo |
|---|---|
| Fundir as 6 rotas de emissão em uma | A medição real mostrou 76–125 linhas idênticas por par e um núcleo comum de 56 linhas normalizadas, quase toda tag de fechamento. Fundir apagaria `docId` e texto específicos de cada família. |
| Popular o registro de regras por scraping | Procedimento em `docs/atualizacao-normativa.md` proíbe. |
| "Corrigir" a política estrita de `sessoes` | A consulta por token acontece antes de o tenant ser conhecido. A exceção documentada no migration 001 é a solução correta. |
| Colocar as rotas de simulação atrás de `exigirContexto()` | São telas de simulação pura, sem import de `src/fiscal/*`. Gatear quebraria o isolamento de simulação. |
| Usar `service_role` para conectar | Tem `BYPASSRLS`; anularia por completo o RLS do migration 001. |

## 7. Afirmações que este relatório não faz

Este sistema **não** é:

- "100% funcional";
- "100% conforme a legislação";
- "pronto para produção";
- capaz de emitir documento fiscal autorizado;
- capaz de substituir contador, sistema de ERH ou decisão fiscal humana.

Nenhuma dessas afirmações tem lastro no que está provado na seção 2.

## 8. O caminho mais curto para mudar o quadro

Em ordem de valor por esforço:

1. **Aplicar as migrações e rodar a validação C1–C9** contra Postgres real.
   Sem isso, o multi-tenant é desenho, não propriedade verificada.
2. **Regenerar `bun.lock`** com `bun install` onde bun existir.
3. **Consultar documentação fiscal oficial** e promover a primeira regra de
   `candidata` a `validada`, pelo procedimento definido.
4. **Validação XSD** do XML gerado contra schema oficial do modelo.
5. **Assinatura digital**, com certificado em repositório de segredos
   server-side.
6. **Integração real** com provedor, começando por ambiente de homologação, com
   idempotência e tratamento de timeout — nunca reemitindo após timeout.
7. **Credenciamento e homologação** junto à SEFAZ.

Os itens 1 e 2 são horas. Os itens 3 a 7 são o produto.
