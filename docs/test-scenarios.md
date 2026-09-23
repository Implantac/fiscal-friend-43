# Cenários de teste manual

Todos os cenários rodam em Ambiente de Simulação. Nenhum deles gera documento fiscal.

## Global

| # | Cenário | Passos | Resultado esperado |
|---|---------|--------|--------------------|
| G1 | Selo de ambiente | Abrir qualquer tela | "Ambiente de Simulação" visível no cabeçalho |
| G2 | Modo Desenvolvedor | Ligar a alternância e clicar num elemento marcado | Painel direito mostra a ficha técnica do elemento |
| G3 | Atalho F9 | Pressionar F9 em qualquer tela | Aviso de rascunho salvo (simulado) |
| G4 | Atalho F10 | Pressionar F10 | Aviso de transmissão simulada |
| G5 | Teclado | Navegar com Tab | Foco visível em todos os controles, sem armadilha de foco |

## Módulo 1 — Manifestação

| # | Cenário | Passos | Resultado esperado |
|---|---------|--------|--------------------|
| M1.1 | Confirmação | Manifestar "Confirmação" numa nota sem manifestação | Sucesso simulado; status e histórico atualizados |
| M1.2 | Justificativa curta | Recusar operação com menos de 15 caracteres | **Erro local**, com o campo destacado |
| M1.3 | Repetição | Manifestar o mesmo evento já registrado | **Rejeição fiscal** simulada |
| M1.4 | Falha de provedor | Manifestar a nota da Indústria Química Sul | **Erro do provedor**, permitindo nova tentativa |
| M1.5 | XML indisponível | Baixar XML de nota sem arquivo | Erro do provedor explicando a indisponibilidade |

## Módulo 2 — NF-e 55

| # | Cenário | Passos | Resultado esperado |
|---|---------|--------|--------------------|
| M2.1 | Sem destinatário | Transmitir sem escolher destinatário | Erro local apontando o campo |
| M2.2 | Quantidade inválida | Zerar a quantidade de um item e transmitir | Erro local |
| M2.3 | Totais | Alterar quantidade, preço, desconto e frete | Totais recalculados na hora |
| M2.4 | CFOP | Trocar entre destinatário de SP e de outra UF | Sugestão muda e continua rotulada como heurística |
| M2.5 | Prévia | Observar o painel tributário | Sempre rotulado "Estimativa simulada" |

## Módulo 3 — NFC-e 65

| # | Cenário | Passos | Resultado esperado |
|---|---------|--------|--------------------|
| M3.1 | Venda simples | Incluir itens e finalizar com Pix | Sucesso simulado e cupom limpo |
| M3.2 | Dinheiro insuficiente | Pagar em dinheiro com valor abaixo do total | Erro local |
| M3.3 | Troco | Informar valor acima do total | Troco calculado corretamente |
| M3.4 | Offline | Desligar a conexão simulada e finalizar | Venda entra na fila de contingência |
| M3.5 | Processar fila | Religar a conexão e processar | Fila esvazia |
| M3.6 | Cupom vazio | Finalizar sem itens | Erro local |

## Módulo 4 — NFS-e

| # | Cenário | Passos | Resultado esperado |
|---|---------|--------|--------------------|
| M4.1 | Emissão mínima | Preencher cliente, serviço, valor e descrição | Sucesso simulado |
| M4.2 | Descrição curta | Descrever com menos de 10 caracteres | Erro local |
| M4.3 | Avançado recolhido | Abrir a tela | Bloco de tributação avançada fechado por padrão |
| M4.4 | ISS retido | Marcar retenção | Líquido estimado muda, com aviso de estimativa |

## Módulo 5 — CT-e 57

| # | Cenário | Passos | Resultado esperado |
|---|---------|--------|--------------------|
| M5.1 | Arrastar XML | Soltar um XML de NF-e na área indicada | Linha criada com marca "lido do arquivo" |
| M5.2 | Arquivo sem dados | Soltar um XML sem chave reconhecível | Linha marcada como "demonstrativo" |
| M5.3 | Sem documento | Transmitir sem vincular nada | Erro local |
| M5.4 | Frete zerado | Transmitir com frete zero | Erro local |
| M5.5 | Resumo | Vincular dois documentos | Valor da carga e peso somados |

## Módulo 6 — CT-e OS 67

| # | Cenário | Passos | Resultado esperado |
|---|---------|--------|--------------------|
| M6.1 | Pessoas | Preencher passageiros, tomador e valor | Sucesso simulado |
| M6.2 | Valores | Trocar para a aba de valores e deixar malote sem número | Erro local |
| M6.3 | Totais de malotes | Informar valores declarados | Total exibido no resumo |
| M6.4 | Percurso | Trocar UF de início e término | Resumo atualizado |

## Módulo 7 — MDF-e 58

| # | Cenário | Passos | Resultado esperado |
|---|---------|--------|--------------------|
| M7.1 | Seleção | Marcar dois documentos | Totais de valor e peso somados |
| M7.2 | Sem documento | Transmitir sem seleção | Erro local |
| M7.3 | Reboques | Escolher o veículo com dois reboques | Ambos aparecem para vínculo |
| M7.4 | Percurso | Marcar UFs intermediárias | Trajeto exibido na ordem escolhida |
| M7.5 | Sem motorista | Transmitir sem condutor | Erro local |
