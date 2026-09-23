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
