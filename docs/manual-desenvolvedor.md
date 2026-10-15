# Manual do desenvolvedor

> **Estado:** documento escrito contra o código em `main` no commit `8623b34`
> (Etapa 2.13). Se você está lendo isto depois de outras etapas, desconfie dos
> números — eles envelhecem rápido. O que não envelhece são as armadilhas da
> seção 7; essas foram todas pagadas em sangue.

## 1. O que este projeto é, e o que não é

É uma plataforma de notas fiscais eletrônicas brasileiras, multi-tenant, em
construção. **Nenhum documento foi autorizado por serviço fiscal em nenhum
ambiente, e nenhuma integração real com SEFAZ ou provedor existe.**

A tela de simulação e o domínio fiscal são deliberadamente separados:

| Área | O que é |
|---|---|
| `src/fiscal/` | Domínio real. Multi-tenant, papéis, ciclo de vida, numeração, auditoria, sessão. **A única área com testes de verdade.** |
| `src/knowledge/` | Base de conhecimento e cobertura. 17 regras, **todas** `didatico`/`ilustrativo`/`sem-fonte`. |
| `src/simulation/` | Simulador. Gateways falsos, visualmente identificados. Não pode alterar estado de produção. |
| `src/routes/`, `src/components/` | UI. 30 rotas. **Zero testes** — a verificação é por HTTP contra servidor real. |

A separação não é estética: `src/simulation/` **não importa** `src/fiscal/`. Se
você criar essa importação, quebrou a regra de isolamento de simulação.

## 2. Subir o ambiente

```bash
npm install --no-audit --no-fund     # 467 pacotes, ~17 s
cp .env.example .env.local           # NUNCA versione .env.local
npm run dev                          # vite dev
```

### Variáveis que importam no dia a dia

| Variável | Efeito |
|---|---|
| `DEV_AUTH_EMAIL` + `DEV_AUTH_SENHA` | Cria **um** usuário no repositório em memória. Sem elas, nenhum usuário existe — não há senha padrão embutida no código. |
| `DEV_AUTH_TENANT` | Base do UUID determinístico do tenant de dev. |
| `SUPABASE_DB_URL` ou `DATABASE_URL` | Com isso definido, a persistência usa Postgres. Sem, usa memória do processo. |
| `FISCAL_PERSISTENCIA` | `auto` (padrão) / `postgres` (exige banco, falha sem) / `memoria` (só dev; **recusado em produção**). |

**O tenant mostrado na tela de login é um UUID derivado**, não a string
literal. `uuidDeterministico` em `src/fiscal/servidor/ambiente.ts` deriva de
`DEV_AUTH_TENANT`. A string `"tenant-dev"` não é UUID e quebra o caminho
Postgres em dois lugares: `set_config` avalia `NULLIF(…)::UUID` e estoura, e a
FK de `tenants` rejeita a linha.

### Scripts

```
npm run dev          servidor de desenvolvimento
npm run build        build de produção (saída em .output/, preset Cloudflare module)
npm run preview      preview do build — ver armadilha 7.1
npm run typecheck    tsc --noEmit
npm run lint         eslint .
npm test             vitest run
npm run verify       typecheck && lint && test  ← rode antes de commitar
```

## 3. Arquitetura em uma página

```
src/fiscal/            domínio, sem dependência de framework
  tenancy.ts           contexto de tenant
  seguranca.ts         5 papéis, 11 permissões
  ciclo-vida.ts        11 estados, tabela de transição, histórico congelado
  numeracao.ts         numeração por série, concorrência
  auditoria.ts         17 ações; listar() é ASYNC
  persistencia.ts      portas — a interface não muda quando o banco entra
  regras.ts            registro de regras fiscais. ZERO regras validadas.
  autenticacao.ts      PBKDF2-SHA256 210k iterações, bloqueio 5/15 min

src/fiscal/servidor/   camada de servidor
  documento.ts         MOTIVO_INDISPONIVEL — autorizado é INALCANÇÁVEL daqui
  sessao.ts            resolverContexto — relê o papel de usuarios a cada request
  conexao-postgres.ts  único lugar que importa `pg` (import dinâmico)
  migracoes.ts         planejador puro de migrações, ordena lexicograficamente
  validacao-postgres.test.ts   C1–C9, 13 pulados sem DATABASE_URL
```

### Regra de dependência, enforced pelo eslint

`eslint.config.js` proíbe que módulos de servidor sejam importados de
`routes/`, `components/` ou `hooks/`. A fronteira é: **servidor fala com o
cliente só por server function.**

## 4. O banco

`db/migrations/001_fundacao.sql` (11 tabelas, RLS habilitado **e forçado**,
triggers append-only) e `002_valor_documento.sql`.

**Toda tabela tem política `tenant_id = tenant_atual()`** — exceto `sessoes`,
que tem exceção documentada de leitura, porque a consulta por token acontece
**antes** de o tenant ser conhecido.

O contexto de tenant é por transação:

```sql
SELECT set_config('app.tenant_id', $1, true);
```

`SET LOCAL` **não aceita bind parameter** — use `set_config`.

`src/fiscal/schema.test.ts` carrega todos os `db/migrations/*.sql` em ordem
lexicográfica e valida o schema sem precisar de banco.

## 5. Rodando os testes

```bash
npm test                                          # suíte completa
npx vitest run src/fiscal/regras.test.ts          # um arquivo
DATABASE_URL='…' npx vitest run \
  src/fiscal/servidor/validacao-postgres.test.ts  # contra Postgres real
VALIDAR_APLICAR_MIGRACOES=1 …                     # inclui aplicar + ROLLBACK
DATABASE_SSL=no-verify …                          # TLS não verificável
```

`vitest.config.ts` roda em `environment: "node"`. Componentes React são
testados com `react-dom/server` (`renderToStaticMarkup`) — **sem DOM e sem
jsdom**. O `include` aceita `.test.{ts,tsx}`.

## 6. Verificação que não é teste

Os testes de unidade não pegam defeitos de integração. Duas vezes nesta série
de etapas um teste verde escondeu um defeito porque o alvo testado não era o
código real. **A verificação contra servidor real não é opcional.**

```bash
# 1. subir
env DEV_AUTH_EMAIL=dev@fiscal.local DEV_AUTH_SENHA=senha-forte-123 \
  npx vite dev --port 5218 --host 0.0.0.0

# 2. rotas
for r in / /cobertura /documentos /entrar /nfe; do
  curl -s -o /dev/null -w "%{http_code} $r\n" "http://127.0.0.1:5218$r"
done

# 3. cabeçalhos de segurança
curl -sI http://127.0.0.1:5218/ | grep -iE "content-security|x-frame"
```

Server functions exigem: header `x-tsr-serverFn: true`, `Origin` same-origin, e
corpo `JSON.stringify(seroval.toJSON({data:{…}}))`. `seroval.toJSON()` devolve
um **objeto**, então o `JSON.stringify` é obrigatório — sem ele o servidor
recebe a string `"[object Object]"`.

## 7. Armadilhas — todas já custaram tempo aqui

### 7.1 `vite preview` não funciona neste projeto

O build gera um preset **Cloudflare module**. `vite preview` procura
`dist/server/server.js`, que não existe, e devolve 500 em tudo. O preview
correto é `npx wrangler --cwd ./ dev`. **Use o dev server para verificar.**

### 7.2 `node_modules` não persiste no snapshot do workspace

Depois de um rollover ele pode estar vazio, e aí `npx tsc` tenta instalar o
pacote errado (`tsc@2.0.4`) do npm. **Confira `ls node_modules | wc -l`
primeiro.** Reinstale com `npm install --no-audit --no-fund`.

### 7.3 Query sem contexto de tenant não enxerga nada

`buscarPorTokenHash` fazia `JOIN usuarios` rodando **sem** contexto de tenant.
`usuarios` tem política estrita, então o JOIN eliminava a própria sessão
procurada e o login quebrava para todo token válido — com HTTP 200. **Nunca
reintroduza `JOIN usuarios` (ou qualquer leitura cruzada) em query que roda sem
contexto de tenant.**

### 7.4 `pg` não liga `bigint`, e devolve coluna `bigint` como string

Escreva com `.toString()`, leia com `BigInt(String(x))`. **Nunca `Number(x)`
para dinheiro** — precisão se perde acima de 2⁵³.

### 7.5 `pg-mem` não implementa RLS

Por isso 281 testes passavam com o defeito da 7.3 presente: o único caminho
exercitado por HTTP era o em memória, sem política alguma. A classe `SqlComRls`
em `repositorios-postgres.test.ts` existe para emular as políticas do migration.

### 7.6 Um fake que emula política precisa checar as tabelas na ordem certa

Se um lado de um JOIN é invisível, o resultado inteiro é vazio. Um fake que
testa `FROM sessoes` antes de `usuarios` devolve a linha mesmo com o JOIN
presente, e não emula nada.

### 7.7 `next()` em `requestMiddleware` não devolve uma `Response`

Devolve o **contexto** do request — `{request, pathname, handlerType, context,
response}` — e a `Response` está em `.response`. Testar
`resultado instanceof Response` é sempre falso, e o middleware não faz nada sem
lançar erro.

### 7.8 Um teste que lê o log de SQL antes de invocar a query testa o statement errado

Sempre invoque primeiro, depois inspecione `queries.at(-1)`.

### 7.9 `AuditoriaMemoria.listar()` é async

Todo ponto de chamada precisa de `await`.

### 7.10 `bun.lock` está dessincronizado

Falta `pg`, `pg-mem` e `@types/pg`; sobram 24 pacotes que foram removidos do
`package.json`. **Não pode ser regenerado aqui** — bun não está instalado neste
sandbox. Rode `bun install` onde bun existir e commite.

## 8. Convenções

- Dinheiro é `bigint` em centavos, ponta a ponta. Nunca `number`, nunca
  `toFixed`.
- Uma regra fiscal sem fonte **não pode** ser marcada validada. O registro em
  `src/fiscal/regras.ts` começa vazio por desenho.
- `autorizado` é inalcançável da camada de serviço: `MOTIVO_INDISPONIVEL` em
  `src/fiscal/servidor/documento.ts` lança antes de tocar o banco.
- `tsc` pega o que `vitest` não pega. Rode os dois.
- `git commit` falha com "empty ident name" depois de rollover — `.git/config`
  não persiste. Re-setar `user.name`/`user.email` repo-local.
- `write_file` **nunca** para edição incremental: ele sobrescreve o arquivo
  inteiro. Use `edit_file`, ou um script que afirme o que substituiu.
