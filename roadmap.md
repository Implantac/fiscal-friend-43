# Roadmap — Simulador Fiscal + Blueprint

## Concluído

- Design system, casca da aplicação, estado global, Modo Desenvolvedor e painel de engenharia
- Catálogo de metadados com IDs estáveis (global + módulos 1 a 7)
- Gateways simulados: manifestação (`FiscalGateway`) e emissão (`EmissaoGateway`)
- Atalhos F9 / F10 e navegação por teclado
- Módulo 1 — Central de Manifestação de Notas
- Módulo 2 — NF-e 55 (itens, totais, CFOP sugerido, prévia tributária)
- Módulo 3 — NFC-e 65 (PDV, pagamentos, contingência simulada e fila)
- Módulo 4 — NFS-e (campos essenciais + tributação avançada recolhida)
- Módulo 5 — CT-e 57 (arrastar e soltar XML, leitura demonstrativa, frete)
- Módulo 6 — CT-e OS 67 (pessoas e valores, grade de malotes)
- Módulo 7 — MDF-e 58 (documentos, condutor, veículo, reboques, percurso)
- Documentação: README, architecture, integration-map, fiscal-assumptions, test-scenarios

## Pendente (depende de validação externa)

- Confirmar leiautes, nomes de campos e endpoints em documentação oficial TecnoSpeed / PlugNotas
- Registrar códigos oficiais de eventos, rejeições e meios de pagamento
- Substituir os parâmetros de cenário por cálculo do back-end
- Persistência real de rascunhos e da fila de contingência
