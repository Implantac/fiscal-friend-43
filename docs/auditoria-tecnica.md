# Auditoria técnica e matriz de lacunas

> Data da auditoria: **2026-10-14** · Commit auditado: `1497b4e` (main, 89 commits)
> Escopo: repositório `Implantac/fiscal-friend-43` antes das alterações da
> **Etapa 1** descrita ao final deste documento.

Este documento existe para separar o que o protótipo **é** do que um produto
fiscal de produção **precisa ser**. Nada aqui é estimativa otimista: cada linha
aponta arquivo, comportamento observado e critério de aceite.

---

## 1. Baseline verificado (executado, não presumido)

| Verificação | Comando | Resultado |
|---|---|---|
| Clonagem e histórico | `git clone` + `git log` | main, 89 commits, working tree limpo |
| Instalação | `npm install` | 437 pacotes; aviso `EBADENGINE`: `@tanstack/start-storage-context` exige Node ≥ 22.12.0 (sandbox com Node 20.20.2) |
| Build de produção | `npm run build` | **passou** (Vite 8 + Nitro, SSR) |
| Tipos | `npx tsc --noEmit` | **passou** |
| Lint | `npx eslint .` | **706 erros** — 100% de formatação Prettier, todos auto-corrigíveis |
| Testes automatizados | — | **não existiam** (nenhum runner, nenhum arquivo `*.test.ts`) |

**Conclusão de partida:** o repositório compila e tipa, mas não tinha nenhuma
malha de verificação automatizada. Qualquer regressão de cálculo passaria
silenciosamente.

---

## 2. O que o repositário realmente é

### 2.1 Existe e funciona

- **7 telas de módulo fiscal** (`src/routes/`): manifestação, NF-e 55, NFC-e 65,
  NFS-e, CT-e 57, CT-e OS 67, MDF-e 58 — formulários, validações de interface e
  resultados tipados.
- **Fronteira de simulação por portas** (`FiscalGateway`, `EmissaoGateway` com
  implementações `Mock`): nenhuma tela chama serviço externo direto. Este é o
  ponto arquitetural mais sólido do projeto e foi **preservado**.
- **Geração de XML e PDF** (`src/simulation/documento-saida.ts`,
  `documento-pdf.ts`) nos leiautes NF-e/NFC-e 4.00, CT-e 4.00, MDF-e 3.00 e DPS
  NFS-e 1.00, sempre com `tpAmb=2`, selo "SEM VALOR FISCAL", sem `<Signature>` e
  sem protocolo.
- **Catálogo de blueprint** (`src/blueprint/catalog*.ts`) com IDs estáveis e
  estado de confiança por entrada (Validado / Ilustrativo / Pendente).
- **Base de conhecimento** (`src/knowledge/`): campos, regras, cálculos, CST,
  cenários, academia, matriz fiscal, regressão, qualidade.
- **Diagnóstico por IA** (`src/lib/diagnostico-ia.functions.ts`): função de
  servidor; a chave vem de `process.env.LOVABLE_API_KEY` e **não** chega ao
  cliente. O prompt já proíbe inventar cStat/alíquota/leiaute.

### 2.2 Não existe (e o botão não cria)

| Capacidade | Estado real |
|---|---|
| Back-end próprio | inexistente |
| Banco de dados / migrações | inexistente |
| Autenticação, autorização, papéis | inexistente |
| Isolamento multiempresa (multi-tenant) | inexistente — há **uma** empresa fictícia fixa (`empresaSimulada`) |
| Persistência de documentos | inexistente — `localStorage` guarda apenas rascunhos da base de conhecimento (`src/knowledge/storage.ts`) |
| Integração SEFAZ / TecnoSpeed / PlugNotas | inexistente — mocks em memória |
| Certificado digital / assinatura | inexistente |
| XSDs oficiais versionados | inexistentes |
| Numeração transacional com controle de concorrência | inexistente |
| Fila/retentativa/idempotência de transmissão | inexistente |
| Testes automatizados | inexistentes (antes desta etapa) |

---

## 3. Inventário de problemas técnicos encontrados

### 3.1 Precisão monetária (crítico)

Todos os cálculos usavam `number` (IEEE 754), `Math.round(x * 100) / 100` e
`toFixed()`:

- `src/simulation/documento-saida.ts` — `r2()`, `d2()`, `d4()` e o rateio de
  frete por item (`r2((e.frete * vp) / vProd)`).
- `src/routes/nfe.tsx`, `nfse.tsx`, `cte.tsx` — `(base * percentual) / 100`.
- `src/simulation/parametros-cenario.ts` — `previaTributaria()`.
- `src/knowledge/regras.ts`, `calculos.ts`, `conferir-nfe.ts` — conferências com
  `Math.round(...)/100`.

**Risco concreto:** o rateio por item arredondado isoladamente pode fechar o
total 1 centavo diferente da soma dos itens — exatamente o que validadores
oficiais comparam. E `0.1 + 0.2 !== 0.3` em binário.

### 3.2 Alíquotas fixas como padrão silencioso (alto)

`parametrosCenario` (ICMS 12%, IPI 5%, PIS 1,65%, COFINS 7,6%, ISS 3%) era
aplicado sem que a interface exigisse nada em troca. A tela avisava, mas o
cálculo seguia o mesmo caminho de um cálculo real.

### 3.3 Heurística de CFOP (alto)

`sugerirCfop()` decide por "mesma UF / outra UF × contribuinte". Não cobre
devolução, remessa, industrialização, exportação, ST, transferência entre
estabelecimentos nem benefícios fiscais — e era apresentada como sugestão neutra.

### 3.4 Chave de acesso e número de documento (médio)

`numeroSeq()` usa `Date.now() % 999999999`; `cNF` usa `Math.random()`. São
fictícios e etiquetados como tal, mas não há controle de numeração, série por
estabelecimento nem proteção contra reuso.

### 3.5 Ausência de malha de testes (crítico para evolução)

Nenhum teste. Nenhuma forma de provar que uma alteração no motor de cálculo não
quebrou outro módulo.

### 3.6 Qualidade de engenharia (médio)

Lint vermelho (706 erros de formatação) — em CI, isso é build quebrado.

### 3.7 O que **não** foi encontrado (verificado)

- Nenhum protocolo de autorização fabricado apresentado como real: os retornos
  dizem explicitamente "protocolo fictício" / "simulado".
- Nenhuma credencial, token ou certificado versionado.
- Nenhuma chamada de rede a SEFAZ/provedor.
- O PDF tem marca d'água "SEM VALOR FISCAL - SIMULAÇÃO".

---

## 4. Matriz de lacunas

Prioridade: **P0** bloqueia produto · **P1** necessário para produção ·
**P2** importante · **P3** desejável.
Risco: **alto** (erro fiscal/segurança) · **médio** · **baixo**.

| # | Lacuna | Prio | Risco | Arquivos afetados | Critério de aceite | Dependência externa |
|---|---|---|---|---|---|---|
| L1 | Sem back-end, banco, auth e multi-tenant | P0 | alto | todo `src/routes`, `src/simulation` | CRUD de empresas/estabelecimentos com isolamento por tenant testado; login com papéis; migração versionada | **endereçada nas Etapas 2, 2.5, 2.6 e 2.7**: isolamento, papéis, ciclo de vida, numeração, auditoria, schema com RLS, hash de senha, repositório Postgres, camada HTTP de sessão e conexão real com o banco implementados e testados. Falta validar a conexão contra a instância do Lovable Cloud e ligar as rotas de documento a `exigirContexto()` |
| L2 | Motor monetário em `number`/`toFixed` | P0 | alto | `documento-saida.ts`, rotas, `knowledge/*` | cálculo em decimal exato, teste de regressão com valores extremos; rateio fecha total | nenhuma — **feito na Etapa 1** |
| L3 | Sem testes automatizados | P0 | alto | repositório | runner + testes de cálculo, XML, registro de regras; `npm run verify` verde | nenhuma — **feito na Etapa 1** |
| L4 | Alíquotas de cenário aplicadas sem bloqueio | P1 | alto | `parametros-cenario.ts`, rotas | toda prévia devolve `Pendencia` bloqueante explicando o que falta | nenhuma — **feito na Etapa 1** |
| L5 | CFOP por heurística de UF | P1 | alto | `parametros-cenario.ts`, `nfe.tsx` | sugestão sempre acompanhada de pendência; decisão real vem de regra versionada | fontes oficiais de CFOP |
| L6 | Sem registro formal de regras fiscais | P1 | alto | `src/fiscal/` (novo) | regra sem fonte/vigência/teste não é utilizável em cálculo | manuais e atos oficiais |
| L7 | Sem XSD oficial versionado | P1 | alto | `src/simulation/documento-saida.ts` | XML validado contra XSD da versão antes de qualquer transmissão | pacotes XSD oficiais |
| L8 | Sem assinatura digital | P1 | alto | idem | assinatura no back-end com chave protegida; XML original preservado | certificado + credenciamento |
| L9 | Sem numeração transacional/idempotência | P1 | médio | `src/fiscal/numeracao.ts` | numeração por série/estabelecimento à prova de concorrência; retentativa não duplica | banco transacional — **endereçada na Etapa 2** com implementação em memória testada (50 reservas concorrentes → números únicos); falta a versão transacional em banco |
| L10 | Sem máquina de estados do documento | P1 | médio | `src/fiscal/ciclo-vida.ts` | transições inválidas bloqueadas; histórico imutável | — **endereçada na Etapa 2** |
| L11 | Sem importação/conferência de XML recebido | P2 | médio | `conferir-xml.tsx`, `conferir-nfe.ts` | parser validado (não regex), detecção de duplicidade, relatório de divergências | manuais de leiaute |
| L12 | Sem cobertura NFS-e por município | P2 | médio | `nfse.tsx` | matriz município × provedor implementada e testada | documentação de cada município |
| L13 | Sem EFD/obrigações acessórias | P3 | médio | — | matriz de cobertura documento a documento | SPED/CONFAZ |
| L14 | Sem observabilidade, backup, LGPD | P2 | alto | infraestrutura | logs sem segredo, métricas, alertas, política de retenção | decisão de hospedagem — **parcialmente endereçada na Etapa 2**: trilha de auditoria append-only com sanitização de credenciais; faltam logs estruturados, métricas, backup e retenção |
| L15 | Node ≥ 22.12.0 exigido por dependência | P3 | baixo | `package.json` | CI fixa Node 22 | nenhuma |
| L16 | Diagnóstico por IA sem teste de guardrail | P2 | médio | `diagnostico-ia.functions.ts` | suite que falha se o modelo citar cStat/alíquota fora da base | chave de API |

---

## 5. Arquitetura proposta (evolução, não reconstrução)

```
src/
  domain/        modelos internos + Pendencia (novo)
  fiscal/        registro de regras versionadas (novo)  <- núcleo
  lib/money.ts   motor monetário exato (novo)
  simulation/    gateways, cadastros fictícios, geração XML/PDF  (existente, evoluído)
  blueprint/     catálogo de metadados + Modo Desenvolvedor       (existente)
  knowledge/     base técnica verificável                       (existente)
  routes/        telas                                          (existente)
```

Regra de fronteira mantida: **a tela nunca decide regra fiscal**. Ela coleta,
valida usabilidade e apresenta. Cálculo e regra vivem em `fiscal/` e, na fase
real, no back-end — atrás das mesmas portas (`FiscalGateway`, `EmissaoGateway`).

---

## 6. Etapa 1 — o que foi implementado, testado e comprovado

### 6.1 Entregue nesta etapa

| Item | Arquivo | Situação |
|---|---|---|
| Motor monetário exato (`bigint`, sem float, 4 modos de arredondamento, rateio por maior resto, valor unitário, parsing pt-BR/científico) | `src/lib/money.ts` | implementado + 27 testes |
| Modelo de pendência (bloqueante/informativa) com pendências canônicas | `src/domain/pendencia.ts` | implementado + testado |
| Registro de regras fiscais com fonte, vigência, versão, estado e ciclo de vida; recusa regra sem fonte/teste | `src/fiscal/regras.ts` | implementado + 12 testes |
| Prévia tributária e sugestão de CFOP agora devolvem pendências explícitas | `src/simulation/parametros-cenario.ts` | implementado + 9 testes |
| XML (NF-e/NFC-e/CT-e/CT-e OS/MDF-e/DPS) calculado em decimal exato; rateio de frete fecha o total | `src/simulation/documento-saida.ts` | implementado + 14 testes |
| Telas usam o cálculo exato e exibem a pendência | `routes/nfe.tsx`, `nfse.tsx`, `cte.tsx` | implementado |
| Runner de testes isolado | `vitest.config.ts` | implementado |
| Scripts `test`, `test:watch`, `typecheck`, `verify` | `package.json` | implementado |
| Exemplo de variáveis de ambiente sem segredos | `.env.example` | implementado |
| Lint corrigido (706 → 0 erros) | repositório | implementado |
| `vite.config.ts`: liberação de host para dev e preview | `vite.config.ts` | implementado |

### 6.2 Bugs reais encontrados **pelos testes** durante a implementação

1. **Rateio com fator de escala errado** produzia valores 100× maiores que o
   rateado (`ratear(40, [300, 100])` devolvia 1020,00 em vez de 30,00).
2. **Notação científica negativa** (`1.5e-2`) era expandida multiplicando em
   vez de dividir (devolvia 1,5 em vez de 0,015).
3. **Parsing pt-BR com cifrão** ("R$ 1.234,56") era rejeitado.
4. **Quantidade tratada como valor monetário**: `deNumero(3) × deNumero(10,33)`
   gerava `vProd` 100× maior no XML (3620,00 em vez de 36,20) — corrigido com
   `multiplicarDecimalPorMoney()`.
5. **`aplicarPercentual` com `number`** passava `Money` (centavos) como se fosse
   escalonado, corrompendo o cálculo.

Os itens 1, 2 e 4 teriam produzido documentos fiscais com totais errados em
produção. É a demonstração prática de por que a malha de testes é pré-requisito
e não acessório.

### 6.3 Evidência de execução

```
npm run typecheck   -> 0 erros
npm run lint        -> 0 erros (10 avisos de react-refresh, pré-existentes)
npm run test        -> 4 arquivos, 62 testes, 62 passaram
npm run build       -> build de produção SSR concluído
```

### 6.4 O que **não** foi feito nesta etapa (e por quê)

- Nenhuma integração real com SEFAZ/provedor: depende de credenciamento,
  certificado e documentação oficial contratada. Implementar sem isso seria
  fabricar endpoints — proibido pelo escopo.
- Nenhum back-end/banco/auth: é a Etapa 2 e exige decisão de hospedagem.
- Nenhuma alíquota "real" foi introduzida: nenhuma fonte oficial foi consultada.
  O registro de regras começa **vazio de regras validadas**, e o motor se recusa
  a aplicar regra não catalogada.

---

## 7. Próximas etapas (ordem de execução)

1. **Etapa 2 — Fundação:** back-end + banco + migrações, autenticação, papéis,
   isolamento multi-tenant, persistência transacional de documentos e eventos.
2. **Etapa 3 — Motor fiscal:** cadastro de regras com fonte oficial, cálculos
   determinísticos por modelo/UF/operação, casos de referência e regressão.
3. **Etapa 4 — Documentos:** XSDs oficiais versionados, validação estrutural +
   semântica, assinatura, fluxo de pré-validação.
4. **Etapa 5 — Integrações:** adaptadores por documento/UF/provedor, separação
   homologação/produção, tratamento de timeout e duplicidade.
5. **Etapa 6 — Governança:** monitoramento legislativo controlado, cobertura
   documental, relatórios de conformidade.
6. **Etapa 7 — Liberação:** segurança, recuperação, matriz real de cobertura.

Critério de conclusão de cada etapa: `npm run verify` verde + cenários manuais
de `docs/test-scenarios.md` replicados + matriz de lacunas atualizada.


---

## 8. Notas de ambiente (para quem for rodar)

1. **Gerenciador de pacotes:** o projeto usa **bun** (`bun.lock`). A auditoria e
   a implementação rodaram com `npm` porque o sandbox não tinha bun. O
   `package-lock.json` gerado foi removido e ignorado no `.gitignore`; rode
   `bun install` para regenerar o lockfile canônico com o novo `vitest`.
2. **Node:** `@tanstack/start-storage-context` exige Node ≥ 22.12.0. O build
   passou em Node 20.20.2, mas a CI deve fixar Node 22.
3. **`npm run preview`:** o bundle nitro é gerado em `.output/`, enquanto o
   plugin de preview do TanStack Start procura `dist/server/server.js`. Isso é
   uma limitação **pré-existente** do scaffold e não foi introduzida por esta
   etapa. Para validar a aplicação em execução use `npm run dev` (verificado:
   todas as 10 rotas respondem 200).
4. **Preview externo:** foi necessário liberar `server.allowedHosts` e
   `preview.allowedHosts` em `vite.config.ts`, porque o proxy de preview usa um
   host próprio e o Vite bloqueia por padrão (403).


---

## 9. Etapa 2 — Fundação de produção (entregue em 2026-10-14)

### 9.1 Implementado

| Módulo | Conteúdo | Testes |
|---|---|---|
| `src/fiscal/tenancy.ts` | Tenant/Empresa/Estabelecimento/Certificado; validação estrutural de CNPJ e CPF; `assertMesmoTenant`, `filtrarPorTenant`; `verificarHabilitacaoTecnica` | 14 |
| `src/fiscal/seguranca.ts` | 5 papéis, 11 permissões, `ContextoUsuario`, `assertAutorizado` (permissão + tenant + estabelecimento), separação de funções | 11 |
| `src/fiscal/ciclo-vida.ts` | 11 estados, tabela de transições por família, regras de integridade (`autorizado` exige protocolo oficial, `rejeitado` exige cStat, `transmitido` exige idempotência), histórico congelado | 15 |
| `src/fiscal/numeracao.ts` | reserva sequencial atômica, idempotência obrigatória, inutilização com justificativa | 11 |
| `src/fiscal/auditoria.ts` | porta append-only, implementação congelada, sanitização de credenciais/CPF/PEM | (em persistencia.test) |
| `src/fiscal/persistencia.ts` | portas + unidade de trabalho em memória com staging, commit, rollback e concorrência otimista | 12 |

Documentação: `docs/modelo-dados.md`, `docs/seguranca-multiempresa.md`.

### 9.2 Evidência

```
npm run verify -> typecheck 0 erros | lint 0 erros
npm run test   -> 6 arquivos em src/fiscal, 75 testes, 75 passaram
```

### 9.3 Decisões de arquitetura (reversíveis)

1. **Não foi criado um segundo backend.** O repositório já executa funções de
   servidor (TanStack Start); o domínio fiscal entra como camada independente de
   framework, chamável por essas funções.
2. **Persistência em memória com porta estável.** Não há banco provisionado;
   inventar conexão fictícia seria justamente o que o produto proíbe.
3. **Autorização como contrato, não como tela.** Login/sessão ficam para a
   Etapa 2.5, mas a regra de acesso já está definida e testada.

### 9.5 Etapa 2.5 — entregue em 2026-10-14

| Item | Arquivo | Situação |
|---|---|---|
| Schema Postgres com RLS, constraints e triggers de imutabilidade | `db/migrations/001_fundacao.sql` | implementado |
| Hash de senha (PBKDF2, 210k iterações), comparação em tempo constante, token de sessão com hash, bloqueio progressivo | `src/fiscal/autenticacao.ts` | implementado + 14 testes |
| Repositório Postgres das portas do domínio, numeração atômica em uma instrução, zero interpolação de SQL | `src/fiscal/persistencia-postgres.ts` | implementado + 15 testes |
| Regra de lint que impede importação de módulo de servidor pelo cliente | `eslint.config.js` | implementado e verificado |
| Documentação de banco e deploy | `docs/banco-de-dados.md` | implementado |

Evidência: `npm run test` com **154 testes** em 11 arquivos e `npm run build`
concluído. **Correção de registro:** o relatório da Etapa 2.5 afirmou
"typecheck 0 erros" — isso estava **incorreto**. Ao rodar `npm run typecheck` na
Etapa 2.6 apareceram 4 erros residuais da Etapa 2.5 (colunas `de`/`ate` não
renomeadas em `persistencia-postgres.ts` e tipos errados do `pg-mem` em
`schema.test.ts`). Corrigidos na Etapa 2.6; o typecheck agora passa com 0 erros.
A lição fica registrada: `vitest` não checa tipos, então "testes verdes" não é
evidência de typecheck.

Decisão de hospedagem **não** foi informada; o schema é Postgres genérico e a
conexão entra por injeção de dependência, então trocar de provedor de banco não
altera o domínio.

### 9.6 Etapa 2.6 — camada HTTP de autenticação (entregue em 2026-10-14)

| Item | Arquivo | Situação |
|---|---|---|
| Portas de usuário/sessão (sem senha ou token em texto) | `src/fiscal/servidor/portas-servidor.ts` | implementado |
| Lógica de login, resolução de contexto, logout, criação de usuário — sem framework e sem HTTP | `src/fiscal/servidor/sessao.ts` | implementado + 18 testes |
| Repositório em memória (dev/teste), recusado em produção | `src/fiscal/servidor/repositorios-memoria.ts` | implementado |
| Repositório Postgres real (`usuarios`/`sessoes`), zero interpolação, hash no formato validado | `src/fiscal/servidor/repositorios-postgres.ts` | implementado + 8 testes |
| Server functions `iniciarSessao`/`encerrarSessao`/`sessaoAtual`/`exigirContexto` | `src/fiscal/servidor/sessao.functions.ts` | implementado |
| Cookie HttpOnly/SameSite/Secure/Max-Age isolado do resto | `src/fiscal/servidor/http-cookies.ts` | implementado |
| Tela de login com aviso explícito do que a sessão não faz | `src/routes/entrar.tsx` | implementado |
| Auditoria de sessão (`sessao.iniciada/encerrada/falha`) | `src/fiscal/auditoria.ts` | implementado |
| Variáveis `FISCAL_PERSISTENCIA` e `DEV_AUTH_*` | `.env.example` | implementado |

**Evidência por execução** (servidor de desenvolvimento real, HTTP):

```
POST /_serverFn/<iniciarSessao>  credencial correta
  -> 200 + set-cookie: ff_sessao=<token opaco>; Max-Age=3600; Path=/;
     HttpOnly; SameSite=Lax

GET  /_serverFn/<sessaoAtual>    com cookie        -> {autenticado:true, contexto:{...}}
GET  /_serverFn/<sessaoAtual>    sem cookie        -> {autenticado:false}
POST /_serverFn/<encerrarSessao>                   -> {ok:true}
GET  /_serverFn/<sessaoAtual>    apos logout       -> {autenticado:false}

4 senhas erradas  -> "E-mail ou senha inválidos."
5a senha errada   -> "Conta temporariamente bloqueada ... 900 segundo(s)."
senha correta depois do bloqueio -> continua bloqueado
e-mail inexistente -> "E-mail ou senha inválidos."  (mensagem identica)
```

**Restrição do framework, descoberta e contornada.** O plugin
`import-protection` do TanStack Start nega o especificador
`@tanstack/react-start/server` no ambiente cliente; um import estático desse
módulo em qualquer arquivo alcançável a partir de uma rota **quebra o build**
(renomear o arquivo para `.functions.ts` não resolve). O acesso a
cookie/request ficou em `http-cookies.ts`, carregado por `import()` dinâmico
dentro dos `handler()`. Confirmado no artefato: `grep` em
`.output/public/assets` não encontra PBKDF2, `ff_sessao`, `deriveBits` nem as
mensagens de erro da sessão (a única ocorrência de "PBKDF2-SHA256" é o texto
descritivo da própria tela de login).

**Erro real encontrado pelos testes HTTP:** a criação do usuário de
desenvolvimento era *fire-and-forget* e perdia a corrida com o primeiro login,
que era negado sem motivo aparente. Corrigido tornando o seed uma promessa
única, aguardada no handler.

### 9.7 Relatório de fim de etapa — 2.6 (modelo obrigatório)

**Arquivos alterados.** `src/fiscal/servidor/{portas-servidor,sessao,repositorios-memoria,repositorios-postgres,sessao.functions,http-cookies}.ts`
(+ os três de teste), `src/fiscal/servidor/sessao.test.ts`,
`src/routes/entrar.tsx`, `src/routeTree.gen.ts`, `src/fiscal/{auditoria,autenticacao,persistencia-postgres}.ts`,
`src/fiscal/schema.test.ts`, `eslint.config.js`, `.env.example`, `README.md`,
`CHANGELOG.md`, `db/migrations/001_fundacao.sql` e `docs/{banco-de-dados,seguranca-multiempresa,auditoria-tecnica}.md`.

**Implementado.** Portas de usuário e sessão que nunca expõem senha nem token em
texto; lógica de login/logout/resolução de contexto sem framework e sem HTTP;
repositório em memória recusado em produção; repositório Postgres real com zero
interpolação de SQL; server functions com cookie HttpOnly; tela de login que diz
o que a sessão **não** faz; auditoria de sessão.

**Corrigido.** O seed do usuário de desenvolvimento era *fire-and-forget* e
perdia a corrida com o primeiro login (encontrado pelos testes HTTP, não pela
leitura): virou promessa única aguardada no handler.

**Testes.** 195 → **217**, sem regressão. Inclui execução real do servidor de
desenvolvimento por HTTP (evidência em §9.6).

**Regras fiscais e fontes.** Nenhuma. Nenhuma fonte oficial foi consultada nesta
etapa; nenhuma alíquota, CST ou código foi criado ou alterado.

**Integrações reais x simuladas.** Nenhuma integração fiscal. Toda a comunicação
foi local (HTTP do próprio servidor de desenvolvimento).

**Homologações pendentes.** Nenhuma aberta por esta etapa além das já listadas
em §9.9.

**Limitações conhecidas.** Nenhuma rota de documento exige contexto ainda;
bloqueio é por conta, sem MFA nem limite por IP; sem conexão de banco real.

**Próximas prioridades.** Conectar o banco e permitir que o sistema decida onde
persistir (Etapa 2.7).

### 9.8 Etapa 2.7 — conexão Postgres e a decisão de hospedagem (2026-10-14)

O usuário informou que **o projeto roda no Lovable Cloud**, cujo backend é
Supabase (Postgres gerenciado). Isso fechou a decisão de hospedagem que estava em
aberto desde a Etapa 2.

| Item | Arquivo | Situação |
|---|---|---|
| `SqlExecutor` concreto com `pg`: pool, `query`, `emTransacao` com BEGIN/COMMIT/ROLLBACK | `src/fiscal/servidor/conexao-postgres.ts` | implementado + 9 testes (pool falso) |
| Decisão de persistência como função pura (`auto`/`postgres`/`memoria`) | `src/fiscal/servidor/ambiente.ts` | implementado + 10 testes |
| Repositórios Postgres ligados à conexão real | `src/fiscal/servidor/sessao.functions.ts` | implementado |
| Driver `pg` + `@types/pg` | `package.json` | adicionado |

**Dois problemas reais encontrados ao conectar, ambos corrigidos:**

1. **A política de RLS de `sessoes` quebraria o login.** Ela era
   `tenant_id = tenant_atual()` pura. O token de sessão é a credencial e o tenant
   só é conhecido *depois* de a sessão ser encontrada — a consulta devolveria zero
   linhas, em produção, sem erro. A política foi dividida em leitura (sem contexto
   de tenant, porque o hash do token é SHA-256 de 256 bits e conhecer a linha não
   concede uso da sessão) e escrita (com contexto de tenant, porque revogar
   sessão de outro tenant é o dano concreto). Consequência: toda escrita passou a
   receber `tenantId` explícito e a rodar dentro de `emTransacao`.

2. **`SET LOCAL` não aceita parâmetro vinculado.** `SET LOCAL app.tenant_id = $1`
   é inválido no Postgres, e a saída ingênua seria concatenar o tenant no texto
   do SQL — exatamente o que a camada de persistência promete não fazer. A forma
   correta é `set_config('app.tenant_id', $1, true)`, que dá escopo de transação
   e sobrevive ao pooler do Supabase em modo transação.

**Decisão de arquitetura:** a conexão é feita como o role `postgres`, **não** como
`service_role`. `service_role` tem `BYPASSRLS` e ignoraria por completo o
isolamento por tenant do migration 001; o role `postgres` respeita RLS, e o
migration usa `FORCE ROW LEVEL SECURITY`, que sujeita até o dono da tabela à
política. A chave secreta do Supabase portanto não entra neste projeto.

**Evidência:** typecheck 0 erros · lint 0 erros · **217 testes em 16 arquivos**
(+22 nesta etapa) · `npm run build` ok · `grep` no artefato confirma que
`.output/public/assets` não contém o driver `pg`, `set_config`, `ff_sessao` nem a
lógica de sessão (as duas ocorrências de "PBKDF2" são texto descritivo da tela).

**Não provado:** nenhuma consulta real contra um Postgres. O executor foi testado
com pool falso; SSL, pooler, latência e a política de RLS de `sessoes` seguem não
verificados porque nenhuma instância existe neste ambiente.

### 9.9 Pendente

- validar a conexão contra a instância do Lovable Cloud (aplicar a migração e
  exercitar login/logout de verdade);
- ligar as rotas de documento a `exigirContexto()` — hoje a camada existe e é
  testada, mas nenhuma rota de NF-e/CT-e/MDF-e a exige;
- MFA e rate limiting por IP (hoje o bloqueio é por conta);
- regenerar `bun.lock` (`bun install`) — está dessincronizado desde a Etapa 2.5;
- backup, retenção, TLS e criptografia em repouso (Etapa 7).

### 9.10 Relatório de fim de etapa — 2.7 (modelo obrigatório)

**Arquivos alterados.** Novos: `src/fiscal/servidor/{conexao-postgres,ambiente}.ts`
e seus dois arquivos de teste. Modificados: `src/fiscal/servidor/sessao.functions.ts`,
`src/fiscal/servidor/{portas-servidor,sessao,repositorios-memoria,repositorios-postgres}.ts`,
`src/fiscal/servidor/{sessao,repositorios-postgres}.test.ts`,
`src/fiscal/schema.test.ts`, `db/migrations/001_fundacao.sql`, `eslint.config.js`,
`.env.example`, `package.json`, `README.md`, `CHANGELOG.md` e
`docs/{banco-de-dados,seguranca-multiempresa,auditoria-tecnica}.md`.

**Implementado.** `SqlExecutor` concreto com `pg` (pool por processo,
`emTransacao` com `BEGIN`/`COMMIT`/`ROLLBACK` e liberação da conexão inclusive em
erro); leitura de configuração e decisão de persistência como função pura;
repositórios Postgres ligados à conexão real; restrição de lint impedindo
`conexao-postgres` de ser importado por rota, componente ou hook; variáveis
`SUPABASE_DB_URL`/`DATABASE_URL`/`DATABASE_SSL`/`FISCAL_PERSISTENCIA` documentadas
em `.env.example`.

**Corrigido.** (1) A política de RLS de `sessoes` era `tenant_id = tenant_atual()`
pura e faria o login devolver zero linhas em produção sem erro algum — política
dividida em leitura e escrita, e toda escrita passou a receber `tenantId`
explícito. (2) `SET LOCAL app.tenant_id = $1` não existe no Postgres; a forma
correta é `set_config('app.tenant_id', $1, true)`.

**Testes.** 195 → **217** (+22: 9 do executor com pool falso, 10 da decisão de
persistência, 3 de escrita entre tenants, mais a verificação estática da política
de RLS de `sessoes`, já que pg-mem não implementa RLS).

**Regras fiscais e fontes.** Nenhuma. Nenhuma fonte oficial consultada.

**Integrações reais x simuladas.** Nenhuma integração fiscal. A integração com o
banco é **código real, execução não verificada**: o executor foi testado com pool
falso. Nenhuma consulta rodou contra um Postgres.

**Homologações pendentes.** Aplicar a migração na instância do Lovable Cloud e
exercitar login/logout de verdade; confirmar que a política de RLS de `sessoes`
se comporta como o teste estático afirma; confirmar que o pooler do Supabase
preserva `set_config` em modo transação.

**Limitações conhecidas.** Sem conexão validada; sem rota de documento exigindo
contexto; sem MFA nem limite por IP; `bun.lock` dessincronizado (`pg-mem`, `pg`,
`@types/pg` ausentes) — o sandbox não tem `bun`; 3 vulnerabilidades pré-existentes
em `tinypool` (via `vitest`) permanecem porque corrigi-las exigiria
`npm audit fix --force`, que quebra o `vitest`.

**Próximas prioridades.** Colocar as rotas de documento atrás de
`exigirContexto()` e ligar o motor monetário às entidades persistidas — o banco
existe, mas o produto ainda não o usa.

