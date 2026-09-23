# Plano revisado — Bíblia Fiscal Interativa (fase 2)

## Situação atual
Já entregue: 7 módulos simulados, Modo Desenvolvedor, base de conhecimento, Debugger (17 regras), Central de rejeições, XML Lab, Math Lab, Reforma, Cenários, Academia (12 trilhas, 3 desafios) e busca Ctrl+K.

## Lacunas encontradas na revisão
1. As telas dos 7 módulos ainda não seguem o ciclo APRENDER → SIMULAR → CALCULAR → XML → VALIDAR → ERRO → DIAGNOSTICAR → CORRIGIR.
2. O painel do Modo Desenvolvedor usa só o catálogo antigo; não mostra conceito, cálculo, XML, regras e rejeições da nova base.
3. Falta comparar regra anterior × atual × futura (versão e vigência não aparecem na tela).
4. Faltam o Mapa Fiscal clicável e o fluxo visual entre documentos (NF-e → CT-e → MDF-e; devolução, remessa, manifestação).
5. Debugger cobre poucas regras e não roda a partir do documento que o usuário acabou de preencher.
6. Desafios são leitura; não há o ciclo "abrir XML → apontar campo → corrigir → reexecutar → Diagnóstico correto".
7. Central de Manifestação sem o fluxo NF-e recebida → evento → protocolo → consequência.
8. Sistema de fontes sem tela própria; busca global não mostra a cadeia completa (rejeição → regra → campo → XML → aula).

## O que será feito (em ordem)
1. **Barra de academia por módulo**: faixa de etapas no topo de cada módulo, com aba "Aprender" (conceito do documento), "Validar" (roda o Debugger com os dados da tela) e "XML" (prévia gerada dos campos preenchidos, sempre rotulada simulação).
2. **Painel técnico unificado**: ao clicar num campo marcado, mostrar também as seções da base (conceito, regra, cálculo, XML, validações, rejeições, implementação no ERP, testes) com selo de status.
3. **Versões e vigência**: linha do tempo por regra/campo com anterior × atual × futura; sem data oficial fica "Pendente de validação".
4. **Mapa Fiscal** (nova página): blocos Documento → Operação → Tributação → Campos → Cálculos → XML → Validações → Autorização → Eventos → Rejeições, cada um levando à área correspondente; mais o grafo de relacionamento entre documentos.
5. **Debugger ampliado**: mais regras por documento (todas ilustrativas ou pendentes), resumo OK/alerta/erro e botão "corrigir e reexecutar".
6. **Desafios interativos**: escolher campo suspeito, regra e família de rejeição; aplicar correção no XML; confirmar "Diagnóstico correto"; +3 desafios (NFC-e, CT-e, NFS-e).
7. **Manifestação didática**: fluxo visual e explicação de efeitos de cada evento dentro do Módulo 1.
8. **Fontes**: página listando categorias; itens sem link mostram "Fonte oficial ainda não cadastrada".
9. **Busca global**: resultado abre a cadeia completa relacionada.
10. Atualizar roteiro de testes e documentação.

## Regras mantidas
Nada é apagado nem reconstruído; tudo continua em Ambiente de Simulação; nenhum código de rejeição, alíquota ou leiaute inventado — marcados Ilustrativo ou Pendente de validação.

## Detalhes técnicos
- Novo componente `AcademyStepper` reutilizado nas rotas existentes; `EngineeringPanel` lê `campoPorDocId`.
- `Vigencia[]` em `Procedencia` para histórico; componente `VersionTimeline`.
- Novas rotas `/mapa` e `/fontes`; itens na sidebar.
- `executarRegras` recebe dados mapeados de cada módulo via adaptador por documento.
