# Changelog

Todas as mudanças relevantes deste repositório são registradas aqui.
Formato: [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/).

## [Não publicado] — 2026-10-14 (continuação)

### Adicionado — Etapa 2: fundação de produção

- `src/fiscal/tenancy.ts` — modelo multi-tenant (Tenant, Empresa,
  Estabelecimento, CertificadoDigital), validação estrutural de CNPJ/CPF,
  `assertMesmoTenant`, `filtrarPorTenant` e `verificarHabilitacaoTecnica`.
  Um CNPJ válido estruturalmente **não** afirma habilitação fiscal.
- `src/fiscal/seguranca.ts` — 5 papéis, 11 permissões, `ContextoUsuario`,
  `assertAutorizado` (permissão + tenant + estabelecimento) e separação de funções.
- `src/fiscal/ciclo-vida.ts` — máquina de estados com 11 estados e transições
  bloqueadas por regra de integridade; histórico de eventos congelado.
- `src/fiscal/numeracao.ts` — numeração sequencial atômica, idempotência
  obrigatória e inutilização com justificativa.
- `src/fiscal/auditoria.ts` — trilha append-only + sanitização de credenciais.
- `src/fiscal/persistencia.ts` — portas de repositório e unidade de trabalho com
  staging, commit, rollback e concorrência otimista.
- `docs/modelo-dados.md` e `docs/seguranca-multiempresa.md`.
- 75 novos testes para a camada fiscal.

### Corrigido

- Nenhum. A Etapa 2 é exclusivamente aditiva — nenhum comportamento existente
  foi alterado.

## [Não publicado] — 2026-10-14

### Adicionado

- `src/lib/money.ts` — motor monetário exato em `bigint` (centavos), sem
  `number`/`toFixed()`/`Math.round()`. Inclui quatro critérios de arredondamento
  (`half_up`, `half_even`, `truncate`, `ceil`), `aplicarPercentual`,
  `aplicarPercentualExato`, `ratear` (método do maior resto, invariante de
  fechamento do total), `valorUnitario`, `multiplicarDecimalPorMoney`, parsing
  pt-BR/notação científica e `ErroMonetario` para entrada inválida.
- `src/domain/pendencia.ts` — modelo de pendência bloqueante/informativa e
  pendências canônicas (alíquota não validada, CFOP heurístico).
- `src/fiscal/regras.ts` — registro de regras fiscais com fonte normativa,
  vigência, versão, casos de teste, responsável, histórico e ciclo de vida
  formal; `regraParaCalculo()` recusa regra inexistente, não aprovada ou fora
  de vigência.
- `vitest.config.ts` e suíte de testes (62 testes): `src/lib/money.test.ts`,
  `src/fiscal/regras.test.ts`, `src/simulation/parametros-cenario.test.ts`,
  `src/simulation/documento-saida.test.ts`.
- Scripts `test`, `test:watch`, `typecheck` e `verify` no `package.json`.
- `.env.example` — contrato de variáveis de ambiente, sem segredos.
- `docs/auditoria-tecnica.md` — auditoria do repositório e matriz de lacunas
  com prioridade, risco, arquivos, critérios de aceite e dependências externas.

### Corrigido

- **Rateio de frete** na geração de XML: antes cada item era arredondado
  isoladamente e a soma podia fechar 1 centavo diferente do frete informado.
  Agora o rateio é por maior resto e a soma é exata.
- **Quantidade × preço unitário** no XML: quantidade era convertida como valor
  monetário, produzindo `vProd` 100× maior (ex.: 3620,00 em vez de 36,20).
- Parsing decimal: "R$ 1.234,56" era rejeitado; notação científica negativa
  (`1.5e-2`) expandia na direção errada.
- Lint: 706 erros de formatação Prettier → 0.

### Alterado

- `previaTributaria()` e `sugerirCfop()` passam a devolver `pendencias`
  explícitas junto dos números; `parametrosCenario` carrega a marca
  `naoOficial: true`.
- `documento-saida.ts` (NF-e, NFC-e, CT-e, CT-e OS, MDF-e, DPS NFS-e) calcula
  todos os valores monetários via motor decimal e mantém os selos de simulação,
  `tpAmb=2`, ausência de `<Signature>` e de protocolo.
- Telas `nfe.tsx`, `nfse.tsx` e `cte.tsx` usam `aplicarPercentualCenario` e
  exibem a pendência da prévia.

### Não alterado (por design)

- Nenhuma alíquota, código de rejeição, endpoint ou protocolo foi inventado.
- Nenhuma integração real foi implementada: depende de credenciamento,
  certificado e documentação oficial contratada.
- Os gateways `Mock` e a fronteira de simulação permanecem intactos.
