# Changelog

Todas as mudanças relevantes deste repositório são registradas aqui.
Formato: [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/).

## [Não publicado] — 2026-10-14 (Etapa 2.7)

### Adicionado — conexão Postgres real (Lovable Cloud)

- `src/fiscal/servidor/conexao-postgres.ts` — implementação concreta de
  `SqlExecutor` com o driver `pg`: pool único por processo, `query` direto e
  `emTransacao` com `BEGIN`/`COMMIT`/`ROLLBACK`, devolvendo a conexão ao pool
  inclusive em erro.
- `src/fiscal/servidor/ambiente.ts` — leitura de configuração e **decisão de
  persistência** como função pura, testável sem framework e sem banco:
  - `auto` (padrão): Postgres se houver `SUPABASE_DB_URL`/`DATABASE_URL`, memória
    caso contrário;
  - `postgres`: exige conexão — sem ela, falha com mensagem explícita;
  - `memoria`: apenas desenvolvimento; **recusado em produção**, porque as
    sessões sumiriam no restart.
- 9 testes do executor com pool falso (transação, rollback, liberação da conexão,
  `set_config` com parâmetro vinculado) e 10 testes da decisão de persistência.

### Corrigido — conflito real entre RLS e login, encontrado ao conectar

A política de RLS de `sessoes` era `tenant_id = tenant_atual()` pura. Como o
token de sessão é a credencial e o tenant só é conhecido **depois** de a sessão
ser encontrada, o login teria devolvido zero linhas em produção — falha
silenciosa, o pior tipo em sistema fiscal. A política foi dividida:

- **leitura** permitida sem contexto de tenant (o hash do token é SHA-256 de 256
  bits: conhecer a linha não concede uso da sessão);
- **escrita** exige contexto de tenant, porque revogar a sessão de outro tenant
  é o dano concreto que a política existe para impedir.

Em consequência, toda escrita passou a receber `tenantId` explícito
(`registrarFalhaLogin`, `registrarSucessoLogin`, `revogar`,
`revogarTodasDoUsuario`) e a rodar dentro de `emTransacao`. Sem o tenant na
assinatura, nada obrigaria o chamador a informá-lo.

### Decisão de arquitetura — conexão como `postgres`, não `service_role`

O role `service_role` do Supabase tem **`BYPASSRLS`** e ignoraria por completo o
isolamento por tenant do migration 001. A conexão direta como `postgres`
**respeita** RLS — e o migration usa `FORCE ROW LEVEL SECURITY`, que sujeita até
o dono da tabela à política. A chave secreta portanto não entra neste projeto, e
nunca com prefixo `VITE_`.

### Detalhe técnico que travava o isolamento

`SET LOCAL app.tenant_id = $1` **não é válido**: Postgres não aceita parâmetro
vinculado em utility statement, e a saída ingênua seria concatenar o tenant no
texto do SQL. A forma correta é `set_config('app.tenant_id', $1, true)` — o
terceiro argumento dá escopo de transação, que é o que o pooler do Supabase em
modo transação preserva.

### Limitações conhecidas (não escondidas)

- **Nenhuma consulta real foi feita contra um Postgres.** O executor está
  implementado e testado com pool falso; SSL, pooler, latência e a política de
  RLS de `sessoes` seguem não verificados.
- `bun.lock` está dessincronizado com `package.json` desde a Etapa 2.5 (`pg-mem`)
  e agora também com `pg`/`@types/pg`: o sandbox não tem `bun`. Rode
  `bun install` onde houver bun para regenerá-lo.
- 3 vulnerabilidades pré-existentes em `tinypool` (via `vitest`) permanecem:
  corrigi-las exigiria `npm audit fix --force`, que quebraria o `vitest`.
- O build emite avisos de "externalized for browser compatibility" para `node:*`
  durante a varredura do ambiente cliente — o artefato final foi verificado e
  **não** contém o driver, o nome do cookie nem a lógica de sessão.

## [Não publicado] — 2026-10-14 (Etapa 2.6)

### Adicionado — camada HTTP de autenticação

- `src/fiscal/servidor/portas-servidor.ts` — portas `RepositorioUsuarios` e
  `RepositorioSessoes`. Nenhuma porta devolve senha ou token em texto.
- `src/fiscal/servidor/sessao.ts` — lógica de autenticação, independente de
  framework e de HTTP, portanto testável sem banco e sem servidor:
  - **sem enumeração de usuário**: e-mail inexistente, usuário inativo e senha
    errada produzem a mesma mensagem e passam pelo mesmo atraso;
  - **token existe uma única vez**: `autenticar` devolve o token em texto para
    o cookie; o repositório guarda apenas o hash SHA-256;
  - **sessão inválida ≠ acesso**: token expirado, revogado ou inexistente
    devolve `null`, nunca um contexto parcial;
  - bloqueio progressivo (5 falhas / 15 minutos) e logout idempotente.
- `src/fiscal/servidor/repositorios-memoria.ts` — implementação em memória para
  desenvolvimento e teste, explicitamente **recusada em produção**
  (`obterDependencias()` falha alto se `NODE_ENV=production`).
- `src/fiscal/servidor/repositorios-postgres.ts` — implementação real contra as
  tabelas `usuarios`/`sessoes` do migration 001, com zero interpolação de SQL,
  hash de senha no formato `algoritmo$iteracoes$salt$hash` validado por
  `desserializarSenhaHash` (formato desconhecido lança, não "passa") e revogação
  condicional a `revogada_em IS NULL`.
- `src/fiscal/servidor/sessao.functions.ts` — server functions `iniciarSessao`,
  `encerrarSessao` e `sessaoAtual`, mais `exigirContexto()` para as funções que
  exigirem usuário logado.
- `src/fiscal/servidor/http-cookies.ts` — cookie de sessão **HttpOnly,
  SameSite=Lax, Secure em produção, Path=/, Max-Age de 60 min**.
- `src/routes/entrar.tsx` — tela de login. Além do formulário, ela declara o que
  a sessão **não** faz: autenticar não é autorizar documento fiscal, e nenhum
  HTTP 200 daquela tela significa autorização do SEFAZ.
- 3 ações de auditoria: `sessao.iniciada`, `sessao.encerrada`, `sessao.falha`.
  Falhar em registrar o login **falha o login** (fail closed); a tentativa falha
  é registrada sem e-mail (LGPD).
- `.env.example` ganhou `FISCAL_PERSISTENCIA` e `DEV_AUTH_*`. Não existe usuário
  padrão com senha embutida no código: sem `DEV_AUTH_EMAIL`/`DEV_AUTH_SENHA`
  nenhum usuário é criado.

### Corrigido

- `src/fiscal/persistencia-postgres.ts` — `inutilizados()` ainda lia as colunas
  antigas `de`/`ate` depois da renomeação para `numero_de`/`numero_ate`, e
  ordenava por `de` (coluna inexistente). O `npm run typecheck` estava falhando
  desde a Etapa 2.5 — a afirmação "typecheck 0 erro" do relatório anterior
  estava incorreta e foi corrigida aqui.
- `src/fiscal/schema.test.ts` — tipos do `pg-mem` (`Db` → `IMemoryDb`,
  `"uuid"` → `DataType.uuid`) que também quebravam o typecheck.

### Arquitetura (restrição do framework, descoberta e contornada)

O plugin `import-protection` do TanStack Start nega `@tanstack/react-start/server`
no bundle do cliente. Um import estático desse módulo em qualquer arquivo
alcançável a partir de uma rota **quebra o build** (não adianta renomear o arquivo
para `.functions.ts`). Solução: o acesso a cookie/request ficou em
`http-cookies.ts`, carregado por `import()` dinâmico **dentro** dos `handler()`.
Verificado no artefato final: o bundle do cliente não contém PBKDF2, nem o nome do
cookie, nem a lógica de sessão.

### Provado por execução (servidor de desenvolvimento real)

- login com credencial correta → HTTP 200 + `set-cookie: ff_sessao=…; Max-Age=3600;
  Path=/; HttpOnly; SameSite=Lax`;
- `sessaoAtual` com cookie → contexto `{usuarioId, tenantId, papel}`; sem cookie
  ou após logout → `{autenticado: false}`;
- 4 senhas erradas → `"E-mail ou senha inválidos."`; 5ª → bloqueio de 900 s; com a
  senha correta depois do bloqueio → continua bloqueado;
- e-mail inexistente → **mensagem idêntica** à de senha errada.

### Limitações conhecidas (não escondidas)

- A persistência da sessão está **em memória do processo**: reiniciar o servidor
  derruba todas as sessões. `FISCAL_PERSISTENCIA=postgres` falha com mensagem
  explícita porque o banco não está provisionado.
- As rotas de documento (NF-e, CT-e, MDF-e…) **ainda não passam** por esta
  autenticação. A camada existe e é testada; falta ligá-las.
- `exigirContexto()` não é usado por nenhuma rota ainda.
- Nada disso foi validado contra Postgres real.

## [Não publicado] — 2026-10-14 (Etapa 2.5)

### Adicionado

- `db/migrations/001_fundacao.sql` — schema Postgres completo com Row-Level
  Security em toda tabela de negócio, constraints de unicidade (idempotência,
  número, CNPJ por tenant), triggers que tornam `eventos_documento` e
  `auditoria` append-only, e trigger de consistência de tenant.
- `src/fiscal/autenticacao.ts` — hash de senha PBKDF2-SHA256 (210.000 iterações,
  salt por senha), verificação em tempo constante, token de sessão opaco com
  apenas o hash persistido, bloqueio progressivo após 5 falhas.
- `src/fiscal/persistencia-postgres.ts` — implementação Postgres das portas do
  domínio: numeração atômica em uma única instrução
  (`INSERT … ON CONFLICT DO UPDATE … RETURNING`), zero interpolação de SQL,
  concorrência otimista.
- Regra de lint que proíbe `src/routes`, `src/components` e `src/hooks` de
  importar módulos exclusivos de servidor — evita vazamento de credencial para
  o bundle do cliente.
- `docs/banco-de-dados.md`.
- 29 novos testes (154 no total).

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
