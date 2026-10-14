# Simulador Fiscal + Blueprint de Integração (ERP brasileiro)

Protótipo de interface e **blueprint técnico** para os documentos fiscais eletrônicos de um ERP
brasileiro. O sistema roda inteiramente em **Ambiente de Simulação**: nenhuma requisição é feita à
SEFAZ, à TecnoSpeed ou ao PlugNotas, e nenhum certificado, token, senha ou CNPJ real é utilizado.

## O que este projeto é

- Uma interface operacional completa dos sete módulos fiscais previstos.
- Um catálogo de metadados de engenharia acoplado à interface (Modo Desenvolvedor).
- Um registro honesto do que é **fato verificado**, do que é **ilustrativo** e do que está
  **pendente de validação**.

## Fundação de plataforma (2026-10-14)

Além do simulador, o repositório contém a camada de fundação para a plataforma
fiscal, toda testada:

- **Multi-tenant estrutural** — `tenantId` em toda entidade, isolamento aplicado
  na consulta e acesso cross-tenant negado com erro ruidoso e auditado.
- **Papéis e permissões** — administrador, fiscal, operador, suporte e auditor,
  com autorização por papel, tenant e estabelecimento.
- **Ciclo de vida do documento** — 11 estados e transições bloqueadas:
  `autorizado` exige protocolo oficial, `rejeitado` exige cStat, `transmitido`
  exige chave de idempotência, e `pendente_consulta` **não** pode virar novo
  documento (timeout não autoriza reemitir).
- **Numeração e idempotência** — reserva sequencial atômica; a mesma chave
  devolve o mesmo número, sem consumir a sequência.
- **Trilha de auditoria append-only** — registros congelados, com sanitização
  de credenciais, CPF e blocos PEM.

Detalhes: [`docs/modelo-dados.md`](docs/modelo-dados.md) ·
[`docs/seguranca-multiempresa.md`](docs/seguranca-multiempresa.md).

### Persistência e autenticação

- **Schema Postgres com Row-Level Security** (`db/migrations/001_fundacao.sql`):
  mesmo que uma query esqueça o filtro de empresa, o banco devolve zero linhas.
- **Senha e token de sessão nunca em texto** — PBKDF2 (210.000 iterações, salt
  por senha), comparação em tempo constante, bloqueio após 5 falhas.
- **Repositório real** (`src/fiscal/persistencia-postgres.ts`) com numeração
  atômica em uma única instrução e zero interpolação de SQL.
- **Camada HTTP de sessão** (`src/fiscal/servidor/`): token opaco em cookie
  `HttpOnly` + `SameSite=Lax` + `Secure` em produção, apenas o hash do token
  persistido, bloqueio progressivo após 5 falhas, resposta genérica a credencial
  inválida (sem revelar se o e-mail existe) e login/logout auditados.
- **Módulos de servidor são fechados ao cliente** por regra de lint: build
  quebra se uma rota tentar importá-los. Verificado também no artefato: o bundle
  do cliente não contém a lógica de sessão.

Detalhes: [`docs/banco-de-dados.md`](docs/banco-de-dados.md) e
[`docs/seguranca-multiempresa.md`](docs/seguranca-multiempresa.md).

> **Sessão em desenvolvimento.** Sem `DATABASE_URL`, a sessão usa repositório em
> memória do processo (`FISCAL_PERSISTENCIA=memoria`, recusado em produção):
> reiniciar o servidor derruba todas as sessões. Defina `DEV_AUTH_EMAIL` e
> `DEV_AUTH_SENHA` para criar o usuário de desenvolvimento — não existe senha
> padrão no código. Autenticar **não** é autorizar documento fiscal.

## O que este projeto não é

- Não é um emissor fiscal. Não emite, transmite, cancela nem consulta documentos reais.
- Não é fonte de alíquotas, códigos de rejeição ou leiautes oficiais.
- Não define regra fiscal: toda regra pertence ao back-end Python, versionada e datada.

## Módulos

| # | Módulo | Rota |
|---|--------|------|
| 1 | Central de Manifestação de Notas | `/` |
| 2 | NF-e de Produtos — modelo 55 | `/nfe` |
| 3 | PDV NFC-e — modelo 65 | `/nfce` |
| 4 | NFS-e (fluxo PlugNotas) | `/nfse` |
| 5 | CT-e de carga — modelo 57 | `/cte` |
| 6 | CT-e OS — modelo 67 | `/cte-os` |
| 7 | MDF-e — modelo 58 | `/mdfe` |

## Modo Desenvolvedor

A alternância no cabeçalho liga, em tempo de execução, a camada de blueprint. Elementos
documentados recebem uma marca discreta; ao clicar (ou focar pelo teclado), o painel lateral
direito mostra identificação, mapeamento, tipo e obrigatoriedade, validações de interface,
responsabilidades do back-end, exemplo de payload interno, falhas previstas e rastreabilidade.

## Atalhos

- `F9` — salvar rascunho simulado
- `F10` — transmitir (simulado)
- `Tab` — navegação por teclado com foco visível

## Documentação

- [docs/architecture.md](docs/architecture.md) — estrutura do front-end e fronteiras
- [docs/integration-map.md](docs/integration-map.md) — mapa de integração TecnoSpeed / PlugNotas
- [docs/fiscal-assumptions.md](docs/fiscal-assumptions.md) — premissas, o que é fato e o que é suposição
- [docs/test-scenarios.md](docs/test-scenarios.md) — cenários de teste manual

## Estado atual (2026-10-14)

O projeto continua sendo um **protótipo em Ambiente de Simulação**, agora com
fundação de engenharia para evoluir a plataforma fiscal:

- **Motor monetário exato** (`src/lib/money.ts`): `bigint` em centavos, sem
  `number`/`toFixed`/`Math.round`, quatro critérios de arredondamento explícitos
  e rateio por maior resto que fecha o total.
- **Modelo de pendência** (`src/domain/pendencia.ts`): nenhum número de cenário
  é exibido sem a pendência que explica por que ele não é apuração fiscal.
- **Registro de regras fiscais** (`src/fiscal/regras.ts`): fonte, vigência,
  versão, casos de teste e ciclo de vida. Começa **sem nenhuma regra validada** —
  nenhuma documentação oficial foi conferida.
- **Testes automatizados** (`npm run test`): 62 testes cobrindo cálculo, XML,
  pendências e registro de regras.
- **Verificação completa** (`npm run verify`): typecheck + lint + testes.

Auditoria técnica e matriz de lacunas: [`docs/auditoria-tecnica.md`](docs/auditoria-tecnica.md).

Ainda **não** existe: back-end, banco de dados, autenticação, isolamento
multiempresa, certificado digital, assinatura, XSD oficial versionado e
integração com SEFAZ/provedores. Nada disso é simulado como se fosse real.

## Stack

React + TypeScript + Vite, TanStack Router, Tailwind CSS, shadcn/ui, Lucide Icons.
