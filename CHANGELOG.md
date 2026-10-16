# Changelog

Todas as mudanças relevantes deste repositório são registradas aqui.
Formato: [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/).

## [Não publicado] — 2026-10-16 (Etapa 2.16 — classificador fiscal com tabelas oficiais)

Continuação da frente de regras. O objetivo declarado era transformar o
simulador em sistema de emissão; o que esta etapa faz é substituir **heurística
inventada por tabela oficial** na classificação.

### Adicionado

- `src/fiscal/classificacao.ts` — tabelas oficiais e classificador:
  - **CFOP**: `CFOP_SENTIDO` (6 primeiros dígitos), `CFOP_GRUPO` (segundo
    dígito) e `CFOP_CONHECIDOS` (24 códigos de uso frequente).
  - **CST**: `CST_ORIGEM` (Tabela A, 9 origens), `CST_TRIBUTACAO` (Tabela B, 15
    situações), `CSOSN` (10 códigos), `CRT` (3 regimes).
  - `decomporCfop`, `decomporCst`, `sugerirCfop` e `classificarOperacao`.
    33 testes.
- Duas regras novas no registro, com fonte: `CFOP-ESTRUTURA-PRIMEIRO-DIGITO` e
  `CST-COMPOSICAO-ORIGEM-TRIBUTACAO`. O registro passou de 3 para **5 regras**.
- Capacidade nova na cobertura: "Classificação fiscal (CFOP, CST, CSOSN)".

### A regra que governa o classificador

**Quando a tabela não cobre o caso, devolve pendência — não inventa código.**

Concretamente: `classificarOperacao` com `crt: "1"` devolve
`CSOSN não determinado` em vez de escolher entre 101/102/103/...; sem
`tributacao` informada, devolve `Tributação não informada` em vez de assumir
`00`; CFOP fora de `CFOP_CONHECIDOS` devolve `CFOP não determinável`. E
`completa === false` sempre que há pendência, para que o chamador trate como
"não classificado", nunca como "classificado com ressalva".

### Fontes

- **CFOP**: Convênio SINIEF s/nº, de 15 de dezembro de 1970 (CONFAZ).
- **CST**: mesmo convênio, Anexo — Código de Situação Tributária, Tabelas A e B.

Como nas regras da Etapa 2.15, os portais do CONFAZ e da NF-e bloqueiam
requisição automatizada. As tabelas foram confirmadas por múltiplas fontes
independentes que citam os atos — **não** pelo texto original. Daí
`validada_tecnicamente` e o motor continuar se recusando a calcular.

### Armadilha repetida

`exactOptionalPropertyTypes` barrou `tributacao: undefined` no teste. Corrigido
com `tributacao?: string | undefined` na interface — sem isso, o caminho de
"tributação ausente" ficaria sem cobertura de teste.

### Evidência

- `tsc --noEmit`: 0 erros.
- `eslint`: 0 erros, 6 warnings `react-refresh` pré-existentes.
- `vitest`: **368 passando, 13 pulados**, 26 arquivos (era 334/25).
- `vite build`: exit 0.
- Trava na cobertura: classificação e registro de regras nunca passam de
  `estrutural` e nunca dizem "pronto para produção".

### O que isto não é

**Não é emissão.** O classificador não calcula tributo, não escolhe alíquota e
não decide entre isenção, ST e redução de base — nenhuma dessas escolhas é
normativa em tabela nacional. Nenhum documento foi autorizado por serviço
fiscal em nenhum ambiente. Ver `docs/relatorio-limitacoes.md`.

## [Não publicado] — 2026-10-15 (Etapa 2.15 — primeiras regras fiscais com fonte)

Resposta a "o sistema não parece ser um emissor de documentos reais". O
diagnóstico estava certo. Esta etapa ataca a **raiz**, que é a que o usuário
priorizou: sem regra validada, XML bem-formado é ficção bem-formada.

### Encontrado — bug real na chave de acesso

`src/simulation/documento-saida.ts` tinha sua própria cópia de `dvModulo11`
usando `Number(base[i])`. Com o **CNPJ alfanumérico** (IN RFB 2.229/2024,
vigente desde 2026), `Number("A")` é `NaN`, `NaN * peso` é `NaN`, e a chave
inteira ficava com DV `NaN` — **inválida, sem erro visível**.

A cópia também estava no lugar errado: regra fiscal no simulador não pode ser
usada pelo domínio.

### Adicionado

- `src/fiscal/chave-acesso.ts` — implementação oficial da chave de 44 posições
  e do DV módulo 11, com a regra **ASCII − 48** para letras (CNPJ alfanumérico)
  e **recusa explícita** de caractere inválido em vez de devolver NaN. 22 testes.
- `src/fiscal/regras-oficiais.ts` — popula o registro de `regras.ts` com **3
  regras que têm fonte normativa identificada** e caso de teste falseável, mais
  um executor que roda os casos contra a implementação real. 13 testes.
- Capacidades novas na matriz de cobertura: "Chave de acesso e dígito
  verificador" e "Registro de regras fiscais", ambas `estrutural`.

### Verificação independente

O algoritmo foi conferido contra **exemplo publicado na documentação oficial**,
não contra valor calculado por este código:

    35 2607 12345678000199 55 001 000012345 1 23456789 | DV 5
    → 35260712345678000199550010000123451234567895  ✓

Um primeiro rascunho do teste afirmava DV `6` — valor que eu **inventei**. A
implementação estava certa e o teste errado; a âncora oficial pegou.

### Corrigido

`src/simulation/documento-saida.ts` delega ao domínio. A cópia local foi
removida. Isolamento preservado: o simulador continua sem importar repositório,
sessão ou conexão — `chave-acesso.ts` é algoritmo puro, sem driver, sem
credencial e sem API de Node.

Um teste do simulador passava base de **44** caracteres a uma função que espera
43; a implementação antiga era leniente e aceitava. A nova rejeita
corretamente, e o teste foi corrigido para a base oficial de 43.

### O que estas regras NÃO são

**Nenhuma está `aprovada_para_uso`**, e o motor se recusa a calcular com elas.
O motivo é procedural: o portal `nfe.fazenda.gov.br` bloqueia requisição
automatizada (loop de redirect 302 sem cookie de sessão), então **o PDF do MOC
7.00 não pôde ser aberto**. As regras foram confirmadas por múltiplas fontes
independentes que citam o MOC explicitamente — não pelo texto original.

`docs/atualizacao-normativa.md` exige conferência no documento original antes de
promover. Até lá, `validada_tecnicamente` é o estado correto, e a tela de
conhecimento continua dizendo a verdade.

### Evidência

- `tsc --noEmit`: 0 erros.
- `eslint`: 0 erros, 6 warnings `react-refresh` pré-existentes.
- `vitest`: **334 passando, 13 pulados**, 25 arquivos (era 298/23).
- `vite build`: exit 0.
- Isolamento do simulador verificado: zero import de `fiscal/servidor`,
  `fiscal/autenticacao` ou `fiscal/persistencia*`.
- Trava nova na cobertura: registro de regras e chave de acesso nunca passam de
  `estrutural`, e nunca dizem "pronto para produção".

### O que continua não sendo um emissor real

As três regras cobrem a **chave de acesso**. Não cobrem tributo, CFOP, CST,
alíquota, rejeição, XSD, assinatura ou transmissão. Nenhum documento foi
autorizado por serviço fiscal em nenhum ambiente. Ver
`docs/relatorio-limitacoes.md`.

## [Não publicado] — 2026-10-15 (Etapa 2.14 — deliverables documentais)

Cinco documentos pedidos. **Três não existiam; dois já existiam.**

| Documento                             | Situação anterior                            | Ação                 |
| ------------------------------------- | -------------------------------------------- | -------------------- |
| Manual do desenvolvedor               | inexistente                                  | criado (220 linhas)  |
| Procedimento de atualização normativa | inexistente                                  | criado (182 linhas)  |
| Relatório final de limitações         | inexistente                                  | criado (149 linhas)  |
| Mapa de integrações                   | existia, de 23/09, **zero menções a tenant** | revisado (107 → 142) |
| Arquitetura                           | existia, atualizado na Etapa 2.5             | **mantido**          |

### A descoberta que mudou o escopo

`docs/` já tinha `architecture.md`, `integration-map.md`, `modelo-dados.md`,
`fiscal-assumptions.md` e `test-scenarios.md`. Dois dos cinco pedidos já
existiam. Criar arquivos novos teria gerado duas versões da mesma verdade.

`integration-map.md` foi revisado porque descrevia um **back-end Python separado
que foi abandonado** — a divisão atual é front-end / servidor TanStack /
provedor — e porque a revisão anterior não sabia que multi-tenant existia. As
tabelas de mapeamento por módulo eram precisas e foram mantidas.

### Manual do desenvolvedor

Inclui as dez armadilhas que já custaram tempo neste repositório, entre elas:
`vite preview` não funciona neste projeto (preset Cloudflare, devolve 500 em
tudo); `node_modules` não persiste no snapshot do workspace; query sem contexto
de tenant não enxerga nada sob RLS; `pg` não liga `bigint`; `pg-mem` não
implementa RLS; e `next()` em `requestMiddleware` não devolve uma `Response`.

### Procedimento de atualização normativa

Define o ciclo `candidata → validada → revogada/substituida`, proíbe scraping
como fonte, exige `casoTeste` falseável para qualquer regra, e trata a Reforma
Tributária como caso particular por ter transição em vez de data de troca.

**Nunca foi executado** — nenhuma regra foi promovida. Está escrito no próprio
documento.

### Relatório final de limitações

Separa o que está provado (com evidência) do que não está. Os itens não
provados são os que importam: nenhuma conexão com Postgres real, zero
integração com SEFAZ ou provedor, zero regras validadas, sem XSD, sem
assinatura, sem credenciamento.

Lista explicitamente as afirmações que o relatório **não** faz: não é "100%
funcional", não é "100% conforme a legislação", não é "pronto para produção".

### Evidência

Documentação não altera comportamento; gate reverificado: `tsc` 0 erros;
`eslint` 0 erros e 6 warnings; `vitest` **298 passando, 13 pulados**, 23
arquivos; `vite build` exit 0.

## [Não publicado] — 2026-10-15 (Etapa 2.13 — extração do cromo de emissão)

### A medição derrubou a estimativa

A estimativa de trabalho era "~400 linhas de cromo compartilhado" nas seis
telas de emissão. **A medição real é outra**: o núcleo comum às seis é de **56
linhas normalizadas**, e quase tudo é tag de fechamento de JSX (`</CardContent>`,
`</div>`, `/>`). Os ~400 linhas mediam a soma da duplicação aos pares (76–125
linhas idênticas por par), não o que é extraível.

O cromo de verdade **já estava extraído em componentes**: `PageHeader`,
`Documented`, `ResultadoAlert`, `ExportarDocumento`, `useEmissao`, `brl` e os
primitivos de `ui/`.

### Extraído

Um único bloco semântico era genuinamente idêntico nas seis — o spinner enquanto
processa, o ícone de envio quando parado:

    {processando ? (
      <Loader2 className="size-4 animate-spin" aria-hidden />
    ) : (
      <Send className="size-4" aria-hidden />
    )}

Virou `src/components/blueprint/IconeTransmissao.tsx`, com 6 testes que travam o
markup servido via `react-dom/server` em Node puro (sem DOM).

Resultado: **21 inserções, 37 remoções**. Um componente de 41 linhas substitui
30 linhas repetidas, e o que se ganha de fato é a garantia de que o tratamento
do spinner é idêntico nas seis telas.

### O que continua fora, de propósito

`variant`, `className`, `onClick`, o texto do botão ("Transmitir (simulado)",
"Emitir (simulado)", "Finalizar venda (F10 simulado)", "Encerrar montagem e
transmitir (simulado)") e o wrapper `<Documented>`. Cada família tem o seu
`docId` (`m2.*` NF-e, `m3.*` NFC-e, `m4.*` NFS-e, `m5.*` CT-e, `m6.*` CT-e OS,
`m7.*` MDF-e) e o seu texto — fundir isso apagaria documentação específica de
módulo. **A fusão das seis rotas em uma não foi feita e não deve ser
reproposta.**

### Também

`vitest.config.ts` passa a aceitar `src/**/*.test.{ts,tsx}` — `tsx` entrou para
os testes de componente.

### Evidência

- `tsc --noEmit`: 0 erros.
- `eslint`: 0 erros, 6 warnings `react-refresh` pré-existentes.
- `vitest`: **298 passando, 13 pulados**, 23 arquivos (era 292/22).
- `vite build`: exit 0.
- Seis rotas de emissão em 200 no servidor real.
- `lucide-send size-4` presente no HTML servido das seis — o componente renderiza
  no SSR.
- Rótulos por família preservados e verificados no HTML servido.
- `docId` por módulo preservado e verificado no fonte.

### Pendente

- Verificação no dev server, não no preview de produção (preset Cloudflare
  module, preview via wrangler, sem rede aqui).
- `bun.lock` continua dessincronizado e precisa ser regenerado com `bun install`
  onde bun existir.

## [Não publicado] — 2026-10-15 (Etapa 2.12 — cabeçalhos de segurança)

Motivado pela verificação do que está publicado em
`fiscal-friend-43.lovable.app`: o ar tinha HSTS, `x-content-type-options` e
`referrer-policy`, mas **não tinha** `Content-Security-Policy` nem
`X-Frame-Options`.

### Adicionado

- `src/lib/headers-seguranca.ts` — política CSP e os três cabeçalhos, em módulo
  puro. 11 testes.
- `src/lib/headers-seguranca.test.ts` — trava o que a política precisa conter
  (`default-src 'self'`, `frame-ancestors 'none'`, `object-src 'none'`,
  `base-uri 'self'`, `connect-src 'self'`) e o que **não** pode conter
  (`ai.gateway.lovable.dev` em `connect-src`, origem externa em `script-src`).
- Middleware em `src/start.ts` aplicando os cabeçalhos em toda resposta.

### Por que no middleware e não no `_headers`

O build gera `.output/public/_headers` via Nitro e ele é **sobrescrito** a cada
build — editar o artefato não sobrevive. E o app é publicado no Lovable Cloud e
pode mudar de host; prender os headers à config de um host os perderia na
mudança.

### O que a política protege — e o que não

Protege: injeção de script de terceiro, embutir o app em iframe alheio,
plugins, mudança de `<base>`, e exfiltração por `fetch`/XHR para origem
externa.

**Não protege contra XSS, e isto é deliberado e honesto.** `script-src` precisa
de `'unsafe-inline'` porque o TanStack Start injeta dois scripts inline no HTML
servido — o bootstrap de hydration (`$tsr-stream-barrier`) e o de restauração de
scroll. Sem `'unsafe-inline'` o app não hidrata. Com ele, um XSS já existente
continua executando. XSS mitigado de verdade exige nonce ou hash, o que precisa
de suporte do framework à injeção de nonce — não tentado aqui.

`style-src` também leva `'unsafe-inline'` (Tailwind + estilos inline do SSR), e
`https://fonts.googleapis.com`/`https://fonts.gstatic.com` porque o `__root.tsx`
carrega a IBM Plex por stylesheet externo. `connect-src 'self'` é suficiente: as
server functions são same-origin e o `fetch` para `ai.gateway.lovable.dev` roda
**no servidor**, dentro de `diagnostico-ia.functions.ts`.

### Corrigido — um middleware que não fazia nada, sem erro

A primeira versão testava `resultado instanceof Response`. Em
`requestMiddleware`, `next()` **não devolve uma `Response`**: devolve o contexto
do request — `{request, pathname, handlerType, context, response}` — e a
`Response` está em `.response`. O teste era sempre falso, então o middleware
não aplicava header algum e não lançava erro.

**Só foi pego porque a verificação foi feita contra servidor real.** Os 11
testes de unidade passavam verdes sobre um middleware inerte. A rota correta é
`resultado.response.headers`.

### Evidência

- `tsc --noEmit`: 0 erros.
- `eslint`: 0 erros, 6 warnings `react-refresh` pré-existentes.
- `vitest`: **292 passando, 13 pulados**, 22 arquivos.
- `vite build`: exit 0.
- Headers verificados em servidor real (dev server, mesmo `src/start.ts`):
  `content-security-policy`, `x-frame-options: DENY` e `x-content-type-options`
  presentes em `/` e `/documentos`.
- Fumaça HTTP do fluxo autenticado: **8/8 verdes**, incluindo "CSP presente na
  resposta de login" — um CSP quebrado barraria as server functions.
- 7 rotas em 200 com os headers aplicados.
- Middleware compilado em `.output/server/_ssr/start-*.mjs` e **ausente** do
  bundle do cliente.

### Pendente

- A verificação dos headers foi no dev server, não no preview de produção: o
  build gera um preset Cloudflare module cujo preview exige `wrangler`, que
  precisa de rede e não está disponível aqui. O mesmo `src/start.ts` é compilado
  para os dois, mas a execução em produção não foi observada.
- O CSP usa `'unsafe-inline'` em `script-src`; nonce/hash ficou para quando o
  framework oferecer injeção de nonce.

## [Não publicado] — 2026-10-15 (Etapa 2.11 — o login que quebraria sob RLS)

### Corrigido — bug crítico que nenhum teste existente podia pegar

`buscarPorTokenHash` fazia `JOIN usuarios` para trazer o papel. Essa é a **única**
query do sistema que roda com `app.tenant_id` desligado — o tenant ainda é
desconhecido. A política de `sessoes` permite essa leitura
(`tenant_atual() IS NULL`), mas `usuarios` tem política **estrita**
(`usuarios_tenant_isolation`, `tenant_id = tenant_atual()`). Com o contexto
desligado a expressão avalia para `NULL`, que não é verdadeiro, e **nenhuma**
linha de `usuarios` fica visível. O `JOIN` eliminava a própria sessão procurada.

Sintoma em produção: o login responde 200 e grava o cookie; cada request
seguinte falha com "Sessão inválida ou expirada".

**Por que 281 testes passavam:** o `pg-mem` não implementa Row-Level Security, e
o caminho em memória — o único exercitado por HTTP — não tem política alguma.
O defeito só existiria contra Postgres real, que é justamente o elo não provado.

### Corrigido — segundo defeito encontrado no caminho

`SessaoInterna` carregava `papel`, e ele era **ignorado** por `resolverContexto`,
que relê o papel de `usuarios` dentro do contexto do tenant. Ou seja: o campo
era redundante _e_ perigoso. Se um administrador rebaixasse um usuário de
`administrador` para `leitor`, a sessão já aberta continuaria reportando
`administrador` — autorização velha na sessão.

O campo foi removido de `SessaoInterna`, de `RepositorioSessoes.criar`, dos dois
repositórios e da query. O papel passa a ser sempre relido do usuário.

### Adicionado — um executor que implementa a RLS

`SqlComRls` no `repositorios-postgres.test.ts` emula as políticas reais do
migration: `sessoes` permite leitura sem contexto, `usuarios` não permite. Com
ele, reintroduzir o `JOIN` faz **dois** testes falharem.

A verificação de `usuarios` vem **antes** da de `sessoes`, e a ordem é o ponto:
se um lado do JOIN é invisível, o resultado inteiro é vazio. Uma primeira versão
do fake fazia o match ao contrário e devolvia a linha mesmo com o JOIN presente
— o fake não emulava nada.

### Corrigido — dois testes que passavam por acidente

1. O teste de regressão lia `sql.queries.at(-1)` **antes** de chamar a query, então
   validava o `INSERT` e não a busca. Reintroduzir o `JOIN` não o derrubava.
2. O `SqlFalso` devolvia a coluna `papel_usuario`, que a query real não
   seleciona mais — o teste validava uma coluna que o Postgres não entregaria.

Ambos corrigidos e verificados por fuzzing: com o `JOIN` reintroduzido, 2 testes
falham; sem ele, 11 passam.

### Evidência

- `tsc --noEmit`: 0 erros. (Pegou algo que o `vitest` não pega: a assinatura de
  `criar` na classe ainda declarava `papel` depois de eu ter corrigido só a
  interface — a substituição anterior não casou o texto e silenciosamente não
  fez nada.)
- `eslint`: 0 erros, 6 warnings `react-refresh` pré-existentes.
- `vitest`: **281 passando, 13 pulados**, 21 arquivos.
- `vite build`: exit 0, bundle de cliente limpo.
- Fumaça HTTP do fluxo autenticado real: **7/7 verdes** — recusa sem sessão,
  login com cookie `ff_sessao` HttpOnly, `sessaoAtual` com usuário,
  `listarDocumentos`, `criarDocumento` com UUID real, `avancarDocumento`, e
  recusa de cookie forjado.
- Fuzzing da regressão: com o `JOIN` de volta, 2 testes falham; sem ele, 11
  passam.

### Pendente

- A query corrigida **não foi executada contra Postgres real**. A prova é de
  fuzzing contra um executor que emula a RLS, não contra o Postgres.
- `node_modules` precisou ser reinstalado com `npm install` no meio da etapa
  (o snapshot do workspace não o preserva).

## [Não publicado] — 2026-10-15 (Etapa 2.10 — validação contra Postgres real)

Não foi possível _executar_ a validação: este ambiente não tem Postgres, não
tem `psql`, não tem Docker. O que foi feito é tornar a validação **executável
por quem tem a instância**, em um comando, e integrá-la ao gate para que ela
não possa ser esquecida nem passar em silêncio.

### Adicionado

- `src/fiscal/servidor/migracoes.ts` — planejador de migrações, lógica pura sem
  I/O e sem banco: descoberta, ordenação lexicográfica, checksum SHA-256,
  decisão de aplicar/pular/recusar, detecção de órfãs, tabela de controle
  `schema_migracoes`. **Recusa aplicar** migração cujo nome já exista no banco
  com checksum diferente, e acusa como órfã a que o banco tem e o disco perdeu.
- `src/fiscal/servidor/migracoes.test.ts` — 23 testes.
- `src/fiscal/servidor/validacao-postgres.test.ts` — nove verificações (C1–C9)
  contra Postgres real: privilégios do role, estado das migrações, RLS **forçada**
  em todas as tabelas, isolamento real entre dois tenants, política de `sessoes`,
  round-trip de centavos em 2^53+1, trigger de imutabilidade, aplicação opt-in de
  migrações e relatório do que foi **observado**. Sem `DATABASE_URL` é pulada e
  diz por quê.
- `docs/validacao-postgres.md` — runbook: como rodar, o que cada verificação
  prova, o que a derrubaria, e o que continua não provado **mesmo depois** que
  tudo passar.

### Corrigido — defeito real encontrado pelos testes novos

`planejar()` preservava a ordem do array recebido. Um chamador que passasse a
lista fora de ordem aplicaria `002` antes de `001` — silencioso, e só apareceria
em produção. Agora reordena internamente, sem confiar em quem chama. Pegado por
um teste que passava a lista deliberadamente invertida.

## [Não publicado] — 2026-10-15 (Etapa 2.9 — enxugamento de portfólio)

Decisão de produto: `docs/analise-portfolio-modulos.md`. O usuário escolheu o
caminho **B** (cortar o morto + reorganizar a navegação).

### Adicionado

- `src/knowledge/cobertura.ts` — matriz de cobertura por modelo de documento.
  Cada capacidade declara o que é: `estrutural` (código real e testado, sem
  integração provada), `simulado` (tela de demonstração que **não emite
  documento válido**) ou `documentado` (só descrição). Nenhuma entrada declara
  prontidão de produção. As pendências do catálogo são **preservadas**, não
  sobrescritas.
- `src/knowledge/cobertura.test.ts` — 9 testes. Trava a honestidade da matriz:
  transmissão e assinatura nunca podem aparecer como prontas, e nenhum modelo
  pode alegar documento autorizado.
- `src/routes/cobertura.tsx` — página `/cobertura`: resumo por nível e ficha por
  modelo, com link para a simulação e a lista de pendências. Inclui os modelos
  previstos e ainda não construídos (NF3e, NFCom, BP-e, DERE).

### Removido — 24 dependências e 27 componentes sem uso

Verificado antes de remover: **zero** imports fora de `src/components/ui/`, zero
referências por string em rotas, features, `src/fiscal`, `src/lib` e testes, e
zero imports cruzados entre componentes de `ui/`.

- 15 pacotes Radix: `alert-dialog`, `aspect-ratio`, `avatar`, `collapsible`,
  `context-menu`, `hover-card`, `menubar`, `navigation-menu`, `popover`,
  `progress`, `radio-group`, `slider`, `toggle`, `toggle-group`, `tooltip`.
- 8 pacotes de terceiros: `recharts`, `embla-carousel-react`, `vaul`,
  `react-resizable-panels`, `react-day-picker`, `react-hook-form`,
  `@hookform/resolvers`, `input-otp`.
- `date-fns` — zero imports em todo o `src/`.
- 27 arquivos de `src/components/ui/`, cada um importado por nada.
- Produção: 55 → 31 dependências (−44%).

### Alterado — navegação

- Seções **Engenharia** (8 itens) e **Simuladores** (6 itens) só aparecem com o
  **Modo Desenvolvedor** ativado — interruptor que já existia no cabeçalho.
- Nova seção **Suporte** (Rejeições, Conferir XML, Diagnóstico com IA) sempre
  visível: são ferramentas de quem atende cliente, não de engenharia.
- **Módulos fiscais** passou a ter 3 entradas (Manifestação, Cobertura,
  Documentos) em vez de 8. Menu principal: 27 → 14 entradas (22 com dev ligado).
- Nenhuma rota foi apagada. Todas as 22 continuam respondendo HTTP 200.

### Corrigido — número errado na análise que autorizou a mudança

A primeira versão de `docs/analise-portfolio-modulos.md` afirmava "~1.900 LOC de
duplicação" entre as 6 telas de emissão. O número vinha de um diff que removia
caracteres alfabéticos e contava tags de fechamento de JSX como linhas
idênticas. Medindo corretamente: 73–125 linhas em comum entre pares, 69 no
núcleo das seis (das quais ~44 são fechamentos e pontuação). A duplicação real
é ~400 linhas de cromo, não 1.900.

**Consequência: a fusão das 6 telas em 1 simulador parametrizado não foi
executada.** Os campos são fiscalmente distintos (itens/NCM/CFOP/frete em NF-e;
tomador/serviço/tributação municipal em NFS-e; arrastar-e-soltar XML e
composição de frete em CT-e; abas de modalidade e malotes em CT-e OS;
documentos manifestados e percurso em MDF-e; frente de caixa em NFC-e). Fundir
destruiria o detalhe que dá valor ao catálogo em troca de ~15% das linhas.

### Evidência

- `tsc --noEmit`: 0 erros.
- `eslint`: 0 erros, 6 warnings (todos `react-refresh` pré-existentes; eram 10,
  4 estavam nos componentes removidos).
- `vitest`: **255 testes em 19 arquivos**, todos passando (246 + 9 novos).
- `vite build`: exit 0. Bundle do cliente sem `createPool`, `node:net`,
  `node:tls`, `set_config`, `ff_sessao`, `valor_total_centavos` nem
  `INSERT INTO`.
- Fumaça HTTP contra o servidor de dev, fluxo autenticado real: 8/8 passos
  verdes — recusa sem sessão, login com cookie `ff_sessao` HttpOnly,
  `sessaoAtual`, `listarDocumentos`, `criarDocumento` (UUID real criado),
  `avancarDocumento`, e recusa de cookie forjado.
- Gate de navegação verificado por SSR: com dev desligado, "Engenharia",
  "Regressão", "XML Lab", "Governança", "Debugger", "Qualidade", "Incidentes",
  "Modo suporte", "Cálculos" e os 6 simuladores estão **ausentes** do HTML
  servido; "Suporte" e "Cobertura" presentes.

### Pendente — não resolvido nesta etapa

- `bun.lock` continua **fora de sincronia** com `package.json`: faltavam
  `pg-mem`, `pg` e `@types/pg` antes, e agora sobravam os 24 pacotes removidos.
  Não foi regenerado porque `bun` não existe neste ambiente. Precisa de
  `bun install` onde bun estiver disponível.
- `node_modules` foi reinstalado com `npm install` neste ambiente; o projeto
  declara bun (`bunfig.toml`, `minimumReleaseAge = 86400`).
- A fusão das telas de simulação e a extração do cromo compartilhado
  (`head.meta`, `ExportarDocumento`/`ResultadoAlert`, grid) **não** foram
  feitas — ver "Corrigido" acima.
- Nenhuma conexão com Postgres real foi feita. Nenhum documento foi autorizado
  por serviço fiscal em qualquer ambiente.

## [Não publicado] — 2026-10-14 (Etapa 2.8)

### Adicionado — documentos fiscais reais, atrás de autenticação

- `src/fiscal/servidor/documento.ts` — serviço de ciclo de vida, sem framework
  e sem HTTP: cria documento com número reservado atomicamente, lista isolado
  por tenant e aplica transições. Recebe a unidade de trabalho por injeção, o
  que permite testar **todas** as regras de autorização sem subir servidor.
- `src/fiscal/servidor/documento.functions.ts` — `listarDocumentos`,
  `criarDocumento` e `avancarDocumento`, todos começando em `exigirContexto()`.
  Devolvem DTO, nunca o objeto de domínio: `bigint` não sobrevive a
  `JSON.stringify` (a serialização lança `TypeError`), e o valor trafega como
  string de centavos.
- `src/fiscal/servidor/estrutura-dev.ts` — tenant, empresa e estabelecimento de
  desenvolvimento, com identificadores UUID determinísticos.
- `src/fiscal/servidor/registro.ts` — singletons de processo em `globalThis`.
- `src/routes/documentos.tsx` — tela real de documentos, com selo de estado,
  valor formatado a partir do inteiro exato e a lista de estados indisponíveis
  **com o motivo de cada um**.
- 29 testes novos (19 do serviço, 4 do registro, 6 do schema/repositório de
  valor).

### Corrigido — três bugs reais encontrados ao ligar as peças

1. **O tenant de desenvolvimento não era UUID.** `garantirUsuarioDev` passava a
   string `"tenant-dev"`. No caminho Postgres isso quebra em dois lugares:
   `set_config('app.tenant_id', …)` faz `NULLIF(…)::UUID` e lança, e a chave
   estrangeira de `tenants` rejeita a linha. Só o caminho em memória
   "funcionava" — que é justamente o caminho que os testes não cobriam.
   Agora o identificador é derivado por `uuidDeterministico`, com bits de
   versão e variante fixados.

2. **Em dev, o login e a consulta usavam repositórios diferentes.** O plugin do
   framework carrega módulos de server function com um sufixo de query
   (`?tss-serverfn-split`), que é uma instância de módulo distinta da que as
   rotas importam. Um `let` de módulo dividia os repositórios em memória em
   dois: `POST iniciarSessao` gravava a sessão em um, e `exigirContexto()` —
   chamado de dentro de `documento.functions.ts` — consultava o outro.
   Sintoma observado em execução real: "Sessão inválida ou expirada" um
   milissegundo depois de um login com HTTP 200. Os singletons passaram a viver
   em `globalThis`, com teste de regressão que reimporta o módulo.

3. **`revogar`/`revogarTodasDoUsuario` ligavam `$1` sem usá-lo.** O SQL filtrava
   só por `id`/`usuario_id` e confiava na RLS para o tenant. Agora o tenant
   aparece no `WHERE` também — a intenção fica legível e a consulta falha de
   forma explícita se a política mudar.

### Adicionado — valor monetário na entidade persistida (migração 002)

`valor_total_centavos BIGINT NOT NULL DEFAULT 0`, com `CHECK (>= 0)`. A coluna
usa a **mesma unidade interna do motor monetário** (`src/lib/money.ts`, onde
`Money = bigint`), para que não exista conversão entre cálculo e persistência —
conversão é onde o erro de escala nasce. `DocumentoFiscal.valorTotalCentavos` é
`bigint`; o repositório converte com `BigInt(string)`, que é exato, ao
contrário de `Number(string)`, que perde precisão acima de 2^53 (há teste com
2^53 + 1).

### Decisão de arquitetura — o que a tela de documentos NÃO pode fazer

`autorizado`, `transmitido`, `rejeitado`, `pendente_consulta`,
`cancelado_ou_encerrado`, `indisponivel_ou_contingencia`, `assinado`,
`xml_validado` e `documento_gerado` são **inalcançáveis** por este serviço.
Todos dependem de algo que não existe ainda — XSD oficial, certificado A1/A3,
transmissão ao SEFAZ — e oferecer o botão seria convidar o operador a marcar,
com as próprias mãos, um documento como autorizado sem que nenhum fisco tenha
dito isso. Cada estado recusado vem com o motivo, e a recusa acontece **antes**
de qualquer consulta ao banco (há teste que conta as consultas).

### Evidência por execução (servidor de desenvolvimento real, HTTP)

```
POST /_serverFn/<iniciarSessao>    tenant derivado, credencial correta
  -> 200 + set-cookie: ff_sessao=<opaco>; Max-Age=3600; HttpOnly; SameSite=Lax

GET  listarDocumentos  SEM cookie            -> {ok:false,"Sessão inválida ou expirada."}
GET  listarDocumentos  cookie forjado        -> {ok:false,"Sessão inválida ou expirada."}
POST criarDocumento    SEM cookie            -> {ok:false,"Sessão inválida ou expirada."}
GET  listarDocumentos  com cookie            -> {ok:true, documentos:[], memoria:true}
POST criarDocumento    com cookie            -> nfe55 55/1/1, "simulacao",
                                                12345 centavos -> "R$ 123,45",
                                                transições: ["pre_validacao"]
POST criarDocumento    MESMA idempotência    -> MESMO documento (mesmo id, mesmo
                                                criadoEm) — nenhum número novo
POST avancarDocumento  -> "pre_validacao", evento ev-1, usuário usr-dev-1
POST avancarDocumento  para "autorizado"     -> RECUSADO pelo validador
GET  listarDocumentos  depois                -> 1 documento, semValorFiscal:true,
                                                bloqueado: "documento_gerado" com motivo
```

### Limitações conhecidas

- Nenhuma consulta real contra um Postgres: o executor segue testado com pool
  falso. Todo o smoke test acima rodou no caminho em memória.
- Criar documento exige empresa e estabelecimento. Sem `DEV_AUTH_EMAIL` (ou sem
  banco) a operação é recusada com mensagem explícita; em produção o cadastro
  de empresa/estabelecimento ainda não existe.
- As telas de emissão (NF-e, CT-e, MDF-e…) continuam sendo simuladores e não
  passam por `exigirContexto()`. `/documentos` é o caminho real.
- `bun.lock` continua dessincronizado (`pg-mem`, `pg`, `@types/pg` ausentes).

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
