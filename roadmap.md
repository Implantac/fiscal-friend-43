# Roadmap

## Concluído

- Design system, layout, estado global, Modo Desenvolvedor e painel de engenharia
- Módulo 1 — Central de Manifestação
- Módulos 2 a 7 — NF-e 55, NFC-e 65, NFS-e, CT-e 57, CT-e OS 67, MDF-e 58
- Documentação: README, arquitetura, mapa de integração, premissas fiscais, cenários de teste
- Base de conhecimento fiscal (`src/knowledge/`): documentos, campos, regras executáveis,
  cálculos, famílias de rejeição, cenários, trilhas, desafios, fontes e reforma
- Novas áreas: Base fiscal (`/conhecimento`), Cenários (`/cenarios`), Reforma (`/reforma`),
  Fiscal Debugger (`/debugger`), Central de rejeições (`/cstat`), XML Lab (`/xml-lab`),
  Laboratório de cálculos (`/math-lab`), Academia (`/academia`)
- Busca global fiscal no cabeçalho (Ctrl+K)

## Pendente — depende de validação externa

- Conferir em manual oficial cada família de rejeição e substituir pelos códigos reais
- Registrar versão de leiaute e vigência em cada campo, regra e cálculo
- Confirmar alíquotas e regras de cálculo hoje marcadas como exemplo didático
- Confirmar leiaute, grupos XML e classificação do novo modelo de tributos
- Trocar os gateways simulados por chamadas ao back-end Python
