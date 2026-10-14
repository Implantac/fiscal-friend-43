# Arquitetura do front-end

## Princípio central

O front-end **não decide regra fiscal**. Ele coleta dados, aplica validações de usabilidade e
apresenta resultados. Toda decisão fiscal — tributação, CFOP definitivo, obrigatoriedade,
contingência, códigos oficiais — pertence ao back-end Python, versionada e datada.

## Camadas

```text
src/
  routes/            telas (uma por módulo) — TanStack Router
  components/
    layout/          casca da aplicação: sidebar, cabeçalho, rodapé, painel de engenharia
    blueprint/       Documented, ResultadoAlert — a camada de documentação viva
    ui/              shadcn/ui
  blueprint/
    catalog.ts       catálogo central de metadados (global + módulo 1)
    catalog-modulos.ts  metadados dos módulos 2 a 7
    SimulatorProvider.tsx  estado global: Modo Desenvolvedor, notas, log
  domain/            tipos do modelo interno (não são contratos de provedor)
  simulation/        cadastros fictícios, gateways simulados, parâmetros de cenário
  lib/               formatação pt-BR e utilidades
```

## Fronteira de simulação

Toda operação passa por um *gateway*:

- `FiscalGateway` — eventos de manifestação e download de XML (módulo 1).
- `EmissaoGateway` — rascunho e transmissão dos módulos 2 a 7.

As implementações atuais (`MockFiscalGateway`, `MockEmissaoGateway`) resolvem tudo na memória do
navegador. Substituí-las por implementações HTTP contra o back-end é a única mudança necessária
para sair da simulação — nenhuma tela chama serviço diretamente.

## Resultados tipados

Toda ação devolve um `ResultadoSimulado` com um de quatro tipos, e a interface distingue os três
tipos de falha em vez de mostrar "erro":

| Tipo | Significado | Quem resolve |
|------|-------------|--------------|
| `sucesso` | Fluxo concluído na simulação | — |
| `erro_local` | Validação da própria interface | Operador, na tela |
| `erro_provedor` | Falha de comunicação/serviço | Nova tentativa, suporte |
| `rejeicao_fiscal` | Documento recusado | Correção do documento |

## Catálogo de metadados

Cada elemento documentado tem um `id` estável (`m5.xml`, `m2.cfop`, …). O componente `Documented`
apenas referencia esse `id`; o conteúdo técnico vive no catálogo. Assim a documentação não se perde
quando a interface muda, e cada entrada carrega seu estado de confiança: **Validado**,
**Ilustrativo** ou **Pendente de validação**.

## Estado

Estado local por tela (formulários) e estado global mínimo no `SimulatorProvider`: Modo
Desenvolvedor, elemento selecionado no painel, notas recebidas e log de ações simuladas.
Nada é persistido — recarregar a página reinicia a simulação, e isso é intencional.

---

## Camada fiscal e monetária (adicionada em 2026-10-14)

O front-end continua não decidindo regra fiscal, mas agora existem três módulos
explícitos que sustentam a evolução para produto:

### `src/lib/money.ts` — motor monetário exato

Toda aritmética de valor é feita em `bigint` (centavos), sem `number`,
`toFixed()` ou `Math.round()`. Características:

- quatro critérios de arredondamento explícitos (`half_up`, `half_even`,
  `truncate`, `ceil`) — a escolha é de quem chama, porque cada tributo tem
  critério próprio;
- `aplicarPercentual(valor, "18")` com precisão intermediária cheia e um único
  arredondamento no fim;
- `ratear(valor, pesos)` pelo método do maior resto: a soma dos rateios é
  **exatamente** o valor rateado (invariante testada);
- `valorUnitario(total, qtd)` devolvendo decimal de 4 casas;
- `multiplicarDecimalPorMoney(decimal, money)` para `qCom × vUnCom` — quantidade
  não é valor monetário;
- parsing pt-BR ("R$ 1.234,56"), notação científica e rejeição ruidosa de entrada
  inválida (`ErroMonetario`), nunca zero silencioso.

### `src/domain/pendencia.ts` — modelo de pendência

Quando falta informação para determinar o tratamento fiscal, o sistema não
escolhe padrão: devolve `Pendencia` com campo, motivo, consequência, orientação
e severidade (`bloqueante` | `informativa`). Pendência bloqueante impede a
emissão. `pendenciaAliquotaNaoValidada()` e `pendenciaCfopHeuristico()` são as
pendências canônicas do simulador.

### `src/fiscal/regras.ts` — registro de regras fiscais

Estrutura que obriga toda regra a carregar fonte normativa (órgão, documento,
dispositivo, versão, data da consulta), jurisdição, vigência, versão, condições,
exceções, casos de teste, responsável e histórico. Ciclo de vida formal:
`rascunho → em_revisao → validada_tecnicamente → aprovada_para_uso → vigente →
substituida/revogada/bloqueada`.

Regras de uso:

- `regraParaCalculo(id, data)` **lança erro** se a regra não existir, não
  estiver em estado utilizável ou estiver fora de vigência — o motor nunca
  aplica regra não catalogada;
- uma regra sem fonte normativa não passa de `rascunho`;
- uma regra aprovada exige caso de teste, responsável e vigência.

**Estado honesto:** o registro começa **sem nenhuma regra validada**, porque
nenhuma documentação oficial foi conferida para construí-lo.

## Fronteira de simulação (reafirmada)

As portas `FiscalGateway` e `EmissaoGateway` e suas implementações `Mock`
permanecem como única saída do domínio. Nenhuma tela chama serviço externo.
Substituir os mocks por implementações HTTP continua sendo a única mudança
necessária para sair da simulação.

## Verificação

`npm run verify` executa `typecheck` + `lint` + `test` (Vitest, ambiente Node,
configuração isolada em `vitest.config.ts`). Testes cobrem o motor monetário, o
registro de regras, a prévia/CFOP e a geração de XML (selo de simulação,
`tpAmb=2`, ausência de `<Signature>`, casas decimais e fechamento de totais).
