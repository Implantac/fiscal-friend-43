# Premissas fiscais do protótipo

Este documento existe para que ninguém confunda o que o protótipo **mostra** com o que a legislação
**exige**. A regra é simples: quando não havia fonte oficial consultada, nada foi afirmado.

## 1. Nada aqui é oficial

- Nenhum manual de orientação, nota técnica ou documentação de provedor foi consultado durante a
  construção do protótipo.
- Nenhum código de rejeição, código de evento ou código de meio de pagamento foi fixado.
- Nenhuma alíquota exibida é real.

## 2. Parâmetros de cenário

`src/simulation/parametros-cenario.ts` define percentuais **arbitrários** (ICMS, IPI, PIS, COFINS,
ISS, seguro) apenas para que as telas produzam números. Eles não representam nenhum estado,
município, regime tributário ou operação. A apuração real depende de regras versionadas no
back-end, com vigência e parâmetros do contribuinte.

## 3. Sugestão de CFOP

A função `sugerirCfop` aplica uma heurística de três linhas: mesma UF ou não, contribuinte ou não.
Ela não cobre devolução, remessa, industrialização, exportação, substituição tributária,
transferência entre estabelecimentos nem benefícios fiscais. É um acelerador de digitação, nunca
uma decisão.

## 4. Manifestação do destinatário

A obrigatoriedade da manifestação **não é universal**: depende do tipo de operação, do porte e das
regras aplicáveis ao contribuinte. O protótipo exige justificativa nos eventos de recusa apenas
como demonstração de comportamento de interface, com mínimo arbitrário de caracteres.

A relação entre manifestar e obter o XML também varia por situação; o protótipo não generaliza
essa regra.

## 5. Contingência da NFC-e

O interruptor de conexão simulada e a fila do PDV demonstram *comportamento de interface*. As
modalidades de contingência válidas, os prazos e as obrigações posteriores variam por UF e não
foram fixados. A fila existe apenas na memória da página.

## 6. NFS-e

A NFS-e é municipal. Lista de serviços, limites de texto da discriminação, retenções, alíquotas e
regras de incidência mudam de município para município. Os códigos exibidos (`INT-…`) são internos
e fictícios, criados para o simulador.

## 7. Leitura de XML no CT-e

A extração de dados do XML arrastado usa expressões regulares no navegador, marcada como leitura
demonstrativa. Quando algum dado não é reconhecido, a linha é rotulada como *demonstrativo*. Um
parser validado, com verificação de assinatura e de situação do documento, é responsabilidade do
back-end.

## 8. Dados fictícios

Empresa, clientes, produtos, serviços, motoristas, veículos, chaves de acesso e protocolos são
inventados para o simulador. As chaves têm 44 dígitos apenas para que a formatação da tela faça
sentido; não correspondem a documentos existentes e não passam por verificação de dígito oficial.

## 9. Como registrar uma validação

Ao confirmar um item em documentação oficial, atualize a entrada correspondente no catálogo
(`src/blueprint/catalog.ts` ou `catalog-modulos.ts`):

1. mude `estado` para `"validado"`;
2. preencha `rastreabilidade` com fonte, versão e data da referência;
3. remova o item correspondente de `pendencias`;
4. registre aqui, nesta lista, o que passou a ser fato.

Enquanto isso não acontecer, o item permanece **Pendente de validação** — e a interface diz isso ao
desenvolvedor.
