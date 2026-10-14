# Banco de dados, autenticação e deploy

> Estado: **schema e código prontos e testados**; provisionamento do Postgres e
> deploy são etapas externas (dependem da decisão de hospedagem).

## 1. Schema

`db/migrations/001_fundacao.sql` cria o schema completo:

| Tabela | Conteúdo |
|---|---|
| `tenants` | contas (raiz do isolamento) |
| `usuarios` | e-mail, **hash** de senha (PBKDF2), papel, controle de bloqueio |
| `sessoes` | **hash** do token, expiração, revogação |
| `empresas`, `estabelecimentos` | cadastro fiscal, séries por modelo, ambiente |
| `certificados_digitais` | **somente metadados** — chave privada nunca é persistida |
| `numeracao`, `numeracao_inutilizada` | sequência transacional |
| `documentos_fiscais` | agregado com estado, chave, protocolo, cStat, idempotência |
| `eventos_documento` | histórico **imutável** (trigger bloqueia UPDATE/DELETE) |
| `auditoria` | trilha **append-only** (trigger bloqueia UPDATE/DELETE) |
| `regras_fiscais`, `regras_casos_teste` | estrutura para a Etapa 3 |

### Restrições que o banco garante sozinho

| Restrição | Efeito |
|---|---|
| `documentos_idempotencia_unica (tenant_id, idempotencia)` | retentativa não gera segundo documento |
| `documentos_numero_unico (tenant_id, est, modelo, serie, numero)` | número não se repete |
| `empresas_cnpj_unico_por_tenant` | CNPJ não duplica dentro do tenant |
| `certificados_validade (valido_ate > valido_de)` | certificado com período absurdo é recusado |
| `numeracao_inutilizada_intervalo (ate >= de)` + `char_length(justificativa) >= 15` | inutilização séria |
| `regras_fonte_obrigatoria` | regra fora de `rascunho` **exige** fonte com data de consulta |
| trigger `documentos_tenant_consistente` | documento não pode apontar para estabelecimento de outro tenant |

## 2. Row-Level Security (a decisão central)

Toda tabela de negócio tem RLS **ativada e forçada**:

```sql
CREATE POLICY documentos_fiscais_tenant_isolation ON documentos_fiscais
  USING (tenant_id = tenant_atual())
  WITH CHECK (tenant_id = tenant_atual());
```

`tenant_atual()` lê `current_setting('app.tenant_id')`. A aplicação define, por
transação:

```sql
SET LOCAL app.tenant_id = '<uuid>';
```

Consequência: **mesmo que uma query esqueça o filtro de tenant, o banco devolve
zero linhas** em vez de vazar dados de outra empresa. O código filtra; o banco
garante. Sem a variável definida, nenhuma linha é visível — a política é
restritiva, não permissiva.

## 3. Autenticação (`src/fiscal/autenticacao.ts`)

| Aspecto | Implementação |
|---|---|
| Hash de senha | PBKDF2-SHA256, 210.000 iterações, salt de 16 bytes por senha |
| Comparação | tempo constante (XOR acumulado, sem short-circuit) |
| Token de sessão | 32 bytes aleatórios, opaco; **apenas o hash SHA-256 é persistido** |
| Bloqueio | 5 falhas consecutivas → bloqueio de 15 minutos |
| Política de senha | mínimo de 8 caracteres |

### Regra de importação (falha de build)

`src/fiscal/autenticacao.ts` e `src/fiscal/persistencia-postgres.ts` são
**exclusivos de servidor**. O `eslint.config.js` proíbe que `src/routes/**`,
`src/components/**` e `src/hooks/**` os importem — se alguém tentar, o build
quebra em vez de vazar credencial para o bundle do cliente. Verificado por teste
manual durante a implementação.

## 4. Repositório (`src/fiscal/persistencia-postgres.ts`)

Implementa as mesmas portas do domínio (`RepositorioDocumentos`,
`ServicoNumeracao`, `AuditoriaPort`) contra Postgres, recebendo um
`SqlExecutor` injetado.

| Regra | Como é garantida |
|---|---|
| Sem injeção de SQL | nenhum valor é interpolado; tudo via `$1, $2, …`. Teste automatizado falha se dado aparecer no texto do SQL |
| Tenant sempre presente | `emTransacao(tenantId, …)` aplica `SET LOCAL`; teste verifica |
| Numeração atômica | `INSERT … ON CONFLICT DO UPDATE … RETURNING` em **uma** instrução (sem SELECT-then-UPDATE) |
| Concorrência otimista | `ON CONFLICT … DO UPDATE … WHERE atualizado_em <= EXCLUDED.atualizado_em` |

## 5. Lovable Cloud (onde o projeto roda)

O backend do Lovable Cloud é Supabase — Postgres gerenciado. A conexão entra por
`SUPABASE_DB_URL`, que o Lovable injeta no servidor; `DATABASE_URL` é a
alternativa genérica (banco próprio, CI, deploy fora do Lovable).

```bash
# 1. Ligar o Cloud no painel do Lovable e copiar as variáveis para .env.local
#    (o Lovable já injeta SUPABASE_DB_URL no servidor)

# 2. Aplicar a migração (uma vez, por ambiente)
psql "$SUPABASE_DB_URL" -f db/migrations/001_fundacao.sql

# 3. Aplicação — sem SUPABASE_DB_URL ela cai em repositório em memória
npm run dev
```

### Por que a conexão é feita como `postgres`, não como `service_role`

O role `service_role` do Supabase tem **`BYPASSRLS`**: as políticas de isolamento
por tenant do migration 001 seriam ignoradas por completo, e o isolamento passaria
a depender exclusivamente de o código não errar o filtro. A conexão direta como
`postgres` **respeita** RLS — e o migration usa `FORCE ROW LEVEL SECURITY`, que
sujeita até o dono da tabela à política.

Consequência prática: a chave secreta do Supabase **não** deve aparecer em
`.env.local` deste projeto, e nunca com prefixo `VITE_` (o Vite a embutiria no
navegador). Se um dia for necessário acesso privilegiado a partir do navegador, o
caminho é uma Edge Function que valide a sessão — não a chave no cliente.

### Pooler e `SET LOCAL`

`app.tenant_id` é fixado com `set_config('app.tenant_id', $1, true)` — o terceiro
argumento `true` dá ao valor escopo de transação, que é exatamente o que
`SET LOCAL` faz e o que o pooler do Supabase em modo transação preserva.
`SET LOCAL app.tenant_id = $1` **não funciona**: Postgres não aceita parâmetro
vinculado em utility statement, e a saída ingênua seria concatenar o tenant no
texto do SQL.

### A exceção deliberada na política de `sessoes`

`sessoes` é a fronteira de autenticação, não a fronteira de dados de tenant: o
token de sessão é a própria credencial, e para saber a qual tenant ele pertence
é preciso primeiro **ler** a sessão. A política portanto permite leitura sem
contexto de tenant e exige contexto em toda escrita. O raciocínio completo está
comentado no próprio migration, junto às compensações.

## 6. Como subir localmente

```bash
# 1. Postgres (qualquer distribuição)
docker run -d --name ff43-db -e POSTGRES_PASSWORD=... -p 5432:5432 postgres:16

# 2. Aplicar migrações
psql "$DATABASE_URL" -f db/migrations/001_fundacao.sql

# 3. Variáveis de ambiente (sem segredos versionados)
cp .env.example .env.local   # e preencha

# 4. Aplicação
npm run dev
```

## 7. O que falta para operar

1. **Validar a conexão contra uma instância real.** O executor
   (`src/fiscal/servidor/conexao-postgres.ts`) está implementado e testado com
   pool falso, mas nenhum Postgres foi provisionado neste ambiente: SSL, pooler,
   latência e a política de RLS de `sessoes` continuam não verificados.
2. Migrações automatizadas no start (hoje são aplicadas via `psql`).
3. Backup, retenção e descarte (Etapa 7).
4. TLS em trânsito e criptografia em repouso (Etapa 7).

A camada HTTP de login/sessão/cookie existe desde a Etapa 2.6
(`src/fiscal/servidor/`) e desde a Etapa 2.7 escolhe sozinha onde persistir:
Postgres quando há string de conexão, memória em desenvolvimento, e **falha alto**
se alguém pedir memória em produção. O que não aconteceu ainda é uma única
consulta real contra o banco do Lovable Cloud.

Até os itens acima existirem, o sistema **não** está apto a dados reais de
contribuintes.
