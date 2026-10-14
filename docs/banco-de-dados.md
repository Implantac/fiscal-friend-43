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

## 5. Como subir localmente

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

## 6. O que falta para operar

1. Driver de conexão (`pg`/`postgres.js`) e pool — decisão de hospedagem.
2. Migrações automatizadas no start (hoje são aplicadas via `psql`).
3. Backup, retenção e descarte (Etapa 7).
4. TLS em trânsito e criptografia em repouso (Etapa 7).

A camada HTTP de login/sessão/cookie **existe desde a Etapa 2.6**
(`src/fiscal/servidor/`): `usuarios` e `sessoes` já têm repositório Postgres
implementado e testado (zero interpolação, hash no formato validado, revogação
condicional). O que falta é o item 1 — sem driver e sem `DATABASE_URL`, a
inicialização falha com mensagem explícita em vez de usar repositório em memória.

Até 1–5 existirem, o sistema **não** está apto a dados reais de contribuintes.
