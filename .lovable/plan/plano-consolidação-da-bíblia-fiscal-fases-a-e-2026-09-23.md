# Plano — Consolidação da Bíblia Fiscal (fases A–E)

Foco: profundidade, rastreabilidade e governança. Nenhuma tela nova sem necessidade; nada oficial sem fonte.

## Fase A — Profundidade e rastreabilidade
1. **Ficha "6 perguntas"** em cada regra e campo: de onde veio (fonte), em qual versão/vigência vale, quais campos afeta, como aparece no XML, qual erro evita, como testar e como implementar no ERP. Ficha única reaproveitada no painel técnico, Debugger e Conhecimento.
2. Página Qualidade passa a medir essas 6 respostas por item (quantos respondem todas).

## Fase B — Matriz universal
3. Matriz passa a ter seletor de documento (NF-e, NFC-e, NFS-e, CT-e, CT-e OS, MDF-e, Eventos), com perguntas próprias de cada um.
4. Cadeia ampliada: Operação → Documento → Emitente → Destinatário → UFs → Município → Regime → Consumidor → Finalidade → NCM/CEST/Origem → CFOP → CST/CSOSN → Benefício → ICMS/ST/FCP/DIFAL/IPI/PIS/COFINS/ISS/IBS/CBS/IS → Cálculos → Campos → XML → Regras → Recusas → Testes.
5. Tributos sem regra confirmada aparecem como "Pendente de validação", nunca com número inventado. NFS-e mostra aviso de particularidade municipal.

## Fase C — Base oficial separada da didática
6. Recusas divididas em dois tipos: **oficial** (código, descrição oficial, documento, regra, fonte, versão, vigência — só entra com fonte conferida) e **didática** (identificadores internos atuais). Central de recusas e busca mostram o tipo com selo.
7. Mesma separação para regras e cálculos (oficial × didático). Hoje a base oficial começa vazia e com um formulário de cadastro guiado, exigindo fonte e versão.

## Fase D — Impacto no ERP
8. Camada transversal por regra: Cadastro → Produto/Serviço → Pedido → Faturamento → Tributação → Cálculo → Documento → XML → Autorização → Evento → Estoque → Financeiro → Contábil, marcando quais etapas a regra afeta e o que o desenvolvedor faz em cada uma. Exibida como faixa visual na ficha da regra.

## Fase E — Governança e casos reais
9. Ciclo de status: Rascunho → Pendente → Em revisão → Validado → Publicado → Obsoleto, com autor, revisor, data, fonte, versão e justificativa; histórico visível por item.
10. Incidente → conhecimento → **caso de regressão**: o incidente gera também um rascunho de teste que aparece na Regressão como "pendente de aprovação".
11. Persistência preparada: todas as gravações (incidentes, revisões, progresso, testes) passam por uma camada de armazenamento única; hoje grava no navegador, trocável por banco sem mexer nas telas. Posso ligar ao Lovable Cloud (usuários, auditoria) quando você quiser.

## Fora do escopo
Preencher alíquotas, códigos oficiais ou regras da Reforma sem fonte oficial conferida.

## Detalhes técnicos
- `types.ts`: `natureza: "oficial" | "didatico"` em CStat/Regra/Calculo; `StatusGovernanca` + `RevisaoRegistro[]`; `ImpactoErp { etapa, afeta, acao }[]` em RegraFiscal.
- Componentes: `FichaRastreabilidade`, `ImpactoErpFaixa`, `HistoricoRevisao`.
- `matriz.tsx` refatorada para `perfisMatriz: Record<DocumentoId, PerguntaMatriz[]>` + etapas genéricas.
- `src/knowledge/storage.ts`: interface `Repositorio<T>` com implementação localStorage.
- Regressão lê casos aprovados + rascunhos vindos de incidentes.
