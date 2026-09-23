# Simulador Fiscal + Blueprint de Integração (ERP brasileiro)

Protótipo de interface e **blueprint técnico** para os documentos fiscais eletrônicos de um ERP
brasileiro. O sistema roda inteiramente em **Ambiente de Simulação**: nenhuma requisição é feita à
SEFAZ, à TecnoSpeed ou ao PlugNotas, e nenhum certificado, token, senha ou CNPJ real é utilizado.

## O que este projeto é

- Uma interface operacional completa dos sete módulos fiscais previstos.
- Um catálogo de metadados de engenharia acoplado à interface (Modo Desenvolvedor).
- Um registro honesto do que é **fato verificado**, do que é **ilustrativo** e do que está
  **pendente de validação**.

## O que este projeto não é

- Não é um emissor fiscal. Não emite, transmite, cancela nem consulta documentos reais.
- Não é fonte de alíquotas, códigos de rejeição ou leiautes oficiais.
- Não define regra fiscal: toda regra pertence ao back-end Python, versionada e datada.

## Módulos

| # | Módulo | Rota |
|---|--------|------|
| 1 | Central de Manifestação de Notas | `/` |
| 2 | NF-e de Produtos — modelo 55 | `/nfe` |
| 3 | PDV NFC-e — modelo 65 | `/nfce` |
| 4 | NFS-e (fluxo PlugNotas) | `/nfse` |
| 5 | CT-e de carga — modelo 57 | `/cte` |
| 6 | CT-e OS — modelo 67 | `/cte-os` |
| 7 | MDF-e — modelo 58 | `/mdfe` |

## Modo Desenvolvedor

A alternância no cabeçalho liga, em tempo de execução, a camada de blueprint. Elementos
documentados recebem uma marca discreta; ao clicar (ou focar pelo teclado), o painel lateral
direito mostra identificação, mapeamento, tipo e obrigatoriedade, validações de interface,
responsabilidades do back-end, exemplo de payload interno, falhas previstas e rastreabilidade.

## Atalhos

- `F9` — salvar rascunho simulado
- `F10` — transmitir (simulado)
- `Tab` — navegação por teclado com foco visível

## Documentação

- [docs/architecture.md](docs/architecture.md) — estrutura do front-end e fronteiras
- [docs/integration-map.md](docs/integration-map.md) — mapa de integração TecnoSpeed / PlugNotas
- [docs/fiscal-assumptions.md](docs/fiscal-assumptions.md) — premissas, o que é fato e o que é suposição
- [docs/test-scenarios.md](docs/test-scenarios.md) — cenários de teste manual

## Stack

React + TypeScript + Vite, TanStack Router, Tailwind CSS, shadcn/ui, Lucide Icons.
