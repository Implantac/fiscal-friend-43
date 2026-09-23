# Mapa de integração

Este documento registra **para onde cada bloco de dados deve ir** quando a integração real for
implementada. Nenhum nome de campo, endpoint ou código de provedor foi copiado de documentação
oficial — o que existe aqui é a intenção de mapeamento, marcada como pendente de validação.

## Regra de leitura

| Estado | Significado |
|--------|-------------|
| Validado | Confirmado em documentação oficial com versão e data registradas |
| Ilustrativo | Estrutura proposta pelo protótipo, coerente mas não confirmada |
| Pendente de validação | Precisa ser conferido no manual da versão contratada antes de codificar |

Neste momento **não há nenhuma entrada marcada como Validado**, porque nenhuma documentação
oficial de TecnoSpeed, PlugNotas ou SEFAZ foi consultada durante a construção do protótipo.

## Responsabilidades

| Camada | Responsabilidade |
|--------|------------------|
| Front-end | Coleta, validação de usabilidade, apresentação, distinção de tipos de falha |
| Back-end Python | Montagem, assinatura, transmissão, persistência, regras fiscais versionadas |
| TecnoSpeed | NF-e 55, NFC-e 65, CT-e 57, CT-e OS 67, MDF-e 58 (escopo previsto) |
| PlugNotas | NFS-e (escopo previsto) |

O certificado digital, tokens e credenciais ficam exclusivamente no back-end. O front-end nunca os
recebe, exibe ou armazena.

## Módulo 1 — Manifestação

| Bloco interno | Destino previsto | Estado |
|---|---|---|
| `notaRecebida[]` | Serviço de distribuição/consulta de documentos destinados | Pendente |
| `eventoManifestacao` | Serviço de envio de evento de manifestação | Pendente |
| `notaRecebida.xmlDisponivel` | Serviço de download de documento | Pendente |

Pendências: mecanismo de paginação/NSU, periodicidade permitida de consulta, códigos oficiais dos
eventos e das rejeições, e regra de substituição de manifestação anterior.

## Módulo 2 — NF-e 55

| Bloco interno | Destino previsto | Estado |
|---|---|---|
| `nfe.destinatario` | Grupo de destinatário | Pendente |
| `nfe.itens[]` | Grupo de detalhamento de produtos | Pendente |
| `nfe.itens[].cfop` | Campo de CFOP por item | Pendente |
| `emissao.transmitir()` | Serviço de envio de NF-e | Pendente |

Pendências: leiaute e nomes de campos, tratamento de rejeição, idempotência da transmissão.

## Módulo 3 — NFC-e 65

| Bloco interno | Destino previsto | Estado |
|---|---|---|
| `nfce.itens[]` | Grupo de itens do cupom | Pendente |
| `nfce.pagamentos[]` | Grupo de formas de pagamento | Pendente |
| `pdv.fila[]` | Fila de contingência do back-end | Pendente |

Pendências: códigos oficiais de meio de pagamento, modalidades de contingência por UF, geração do
DANFE NFC-e e do QR Code.

## Módulo 4 — NFS-e (PlugNotas)

| Bloco interno | Destino previsto | Estado |
|---|---|---|
| `nfse.tomador` | Grupo de tomador | Pendente |
| `nfse.servico.codigoInterno` | Código de serviço municipal | Pendente |
| `nfse.valorServico` | Valor da prestação | Pendente |
| `nfse.tributacao` | Grupo de tributação/retenções | Pendente |

Pendências: a NFS-e varia por município — lista de serviços, limites de texto, retenções e
alíquotas precisam ser resolvidos por município no back-end.

## Módulo 5 — CT-e 57

| Bloco interno | Destino previsto | Estado |
|---|---|---|
| `cte.documentos[]` | Grupo de documentos transportados | Pendente |
| `cte.partes` | Remetente, destinatário, tomador | Pendente |
| `cte.prestacao` | Componentes do frete | Pendente |

Pendências: regra de definição do tomador, nomes dos componentes de frete, validação autoritativa
do XML vinculado.

## Módulo 6 — CT-e OS 67

| Bloco interno | Destino previsto | Estado |
|---|---|---|
| `cteOs.modalidade` | Tipo de serviço | Pendente |
| `cteOs.passageiros` | Dados do transporte de pessoas | Pendente |
| `cteOs.malotes[]` | Dados do transporte de valores | Pendente |

Pendências: se há exigência de identificação individual de passageiros; estrutura oficial dos
malotes.

## Módulo 7 — MDF-e 58

| Bloco interno | Destino previsto | Estado |
|---|---|---|
| `mdfe.documentos[]` | Grupo de documentos manifestados | Pendente |
| `mdfe.condutor` | Grupo de condutor | Pendente |
| `mdfe.veiculo` | Composição veicular e reboques | Pendente |
| `mdfe.percurso[]` | UFs de percurso | Pendente |

Pendências: limite de reboques, regra de contiguidade do percurso, eventos de encerramento.
