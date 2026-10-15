# Validação contra Postgres real

**Este é o único elo da Etapa 2 sem evidência.** Nenhuma consulta jamais rodou
contra um Postgres de verdade neste ambiente de desenvolvimento. Tudo o que
existe sobre o executor é lógica testada contra repositórios falsos e contra o
`pg-mem` — e o `pg-mem` **não implementa** Row-Level Security, triggers
`plpgsql`, blocos `DO $$ … $$` nem `SET LOCAL`. Ou seja: as três coisas que mais
importam neste schema são exatamente as que o emulador não faz.

Este documento transforma a lacuna em algo executável. A suíte é
`src/fiscal/servidor/validacao-postgres.test.ts` e ela faz parte do gate: sem
`DATABASE_URL`, ela é **PULADA e diz por quê** — nunca passa em silêncio.

---

## 1. Pré-requisito que decide se a validação vale alguma coisa

Use o role **`postgres`**, via `SUPABASE_DB_URL` (Lovable Cloud) ou
`DATABASE_URL`.

**Nunca `service_role`.** O `service_role` tem `BYPASSRLS`: com ele a RLS
simplesmente não executa, e _todos_ os testes de isolamento passariam por
acidente. A verificação **C1 falha de propósito** se detectar `BYPASSRLS` — ela
existe para impedir que uma conexão errada produza um resultado falso.

## 2. Como rodar

```bash
cd /home/user/fiscal-friend-43
DATABASE_URL='postgres://postgres:<senha>@<host>:5432/postgres' \
  npx vitest run src/fiscal/servidor/validacao-postgres.test.ts
```

Se a instância exigir TLS com certificado não verificável (pooler do Supabase em
alguns modos), acrescente:

```bash
DATABASE_SSL=no-verify
```

**Sem `DATABASE_URL`, a suíte é pulada e imprime o motivo.** Isso é deliberado:
um teste que passa sem provar nada é pior que um teste ausente. A contagem
aparece no gate como `13 skipped`.

## 3. Aplicar as migrações (opt-in)

A suíte **não aplica migrações por padrão** — um teste não deve mutar o banco.
Para aplicar, ligue o opt-in:

```bash
DATABASE_URL='…' VALIDAR_APLICAR_MIGRACOES=1 \
  npx vitest run src/fiscal/servidor/validacao-postgres.test.ts
```

Cada migração roda em sua própria transação; se uma falhar, ela é revertida
(`ROLLBACK`) e a execução para com o nome do arquivo e o erro do Postgres. O
planejador por trás disso é `src/fiscal/servidor/migracoes.ts` (23 testes) e ele
**recusa aplicar** uma migração cujo nome já exista no banco com checksum
diferente, e acusa como órfã qualquer migração que o banco tenha e o disco
perdeu. As duas recusas são deliberadas: reaplicar por cima gravaria um
histórico falso.

## 4. O que cada verificação prova — e o que a derrubaria

| #      | Verificação           | O que prova                                                                                                                                   | O que falsificaria                                                                                                                                 |
| ------ | --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| **C1** | Conexão e privilégios | O role conecta e **não** tem `BYPASSRLS`                                                                                                      | `bypassrls = true`, ou `current_user = service_role`. Nesse caso **pare**: o resto do relatório seria mentira.                                     |
| **C2** | Migrações             | Nenhuma divergência de checksum, nenhuma órfã, nada a aplicar                                                                                 | Um arquivo aplicado com conteúdo diferente (histórico falso) ou um arquivo apagado depois de aplicado.                                             |
| **C3** | RLS forçada           | `relrowsecurity` **e** `relforcerowsecurity` ligados em todas as tabelas                                                                      | `relrowsecurity` sem `relforcerowsecurity`: o dono da tabela lê tudo. É o modo de falha silencioso — a migração "passa" e o isolamento não existe. |
| **C4** | Isolamento real       | Com contexto do tenant A, `SELECT` em `empresas` devolve **só** a linha de A. Sem contexto, devolve **zero** linhas.                          | Ver a linha de B, ou ver linhas sem contexto.                                                                                                      |
| **C5** | Caminho da sessão     | A política de `SELECT` em `sessoes` permite leitura com contexto nulo (sem isso o login seria impossível), e a de `INSERT` **exige** contexto | `INSERT` sem exigência de tenant: qualquer um gravaria sessão em tenant alheio.                                                                    |
| **C6** | Centavos              | `2^53 + 1` centavos volta exato, como `string`                                                                                                | `pg` devolver número, ou o valor voltar diferente. `Number(x)` perderia o bit mais baixo.                                                          |
| **C7** | Histórico imutável    | Existe trigger não-internal em `eventos_documento`                                                                                            | Nenhum trigger: o histórico seria editável.                                                                                                        |
| **C8** | Aplicar migrações     | Opt-in. Aplica em ordem, cada uma em transação própria, com `ROLLBACK` se falhar                                                              | Aplicar fora de ordem, ou aplicar por cima de checksum divergente                                                                                  |
| **C9** | Relatório             | Emite o que foi **observado**, não o que se espera                                                                                            | —                                                                                                                                                  |

C4 é a verificação que importa. Se ela falhar, nada do resto compensa: o
isolamento multi-tenant é a afirmação central do produto.

## 5. O que continuar não provado **mesmo depois** que tudo passar

Esta validação prova o schema e o isolamento. Não prova:

- **Credenciamento, certificado digital e ambiente de homologação.** Nenhum
  documento foi autorizado por serviço fiscal em nenhum ambiente.
- **Latência e comportamento do pooler.** A suíte usa uma conexão por vez; o
  pool em modo transação do Supabase, com `set_config` por transação, não foi
  exercitado sob concorrência.
- **SSL de verdade.** `DATABASE_SSL=require` é o padrão, mas o handshake só foi
  validado contra `pg-mem`.
- **Backup, restauração, retenção e criptografia em repouso.**
- **Desempenho.** Nenhuma medição de volume.

## 6. Se algo falhar

| Falha                          | Leitura                                        | Ação                                                             |
| ------------------------------ | ---------------------------------------------- | ---------------------------------------------------------------- |
| C1 com `bypassrls = true`      | Conexão errada                                 | Trocar para o role `postgres`. Não "corrigir" o teste.           |
| C3 sem `relforcerowsecurity`   | A migração 001 não forçou a RLS                | Corrigir a migração, **não** o teste.                            |
| C4 vendo linha de outro tenant | Isolamento quebrado                            | **Parar tudo.** Este é o defeito mais grave possível no produto. |
| C6 devolvendo número           | `pg` configurado para parsear `bigint`         | Forçar leitura como string; nunca `Number()` em dinheiro.        |
| C2 com divergência             | Arquivo de migração editado depois de aplicado | Criar uma migração **nova** (`003_…`), não reeditar a velha.     |

---

**Resumo honesto:** enquanto a C4 não rodar contra uma instância real, a
afirmação "multi-tenant com RLS forçada" é um **desenho**, não uma propriedade
verificada do sistema.
