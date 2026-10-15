# Procedimento de atualização normativa

> **Estado:** procedimento definido; **nunca executado** porque nenhuma regra
> fiscal validada existe ainda neste repositório. Este documento descreve como
> uma atualização normativa deve entrar — não afirma que alguma entrou.

## 1. O problema que este procedimento resolve

Regra fiscal errada em sistema de nota eletrônica não é bug de UI: é nota
emitida com tributação errada, retrabalho fiscal, e passivo. Ao mesmo tempo, a
maioria das "regras" que circula em documentação de mercado é paráfrase, cópia
desatualizada ou interpretação de terceiros.

Este projeto portanto começa com **zero regras validadas**, e é assim por
desenho. `src/fiscal/regras.ts` tem o registro; ele está vazio. A tela de
conhecimento mostra 17 regras, todas marcadas `didatico`, `ilustrativo` ou
`sem-fonte` — nenhuma apresentada como lei.

O procedimento abaixo é o único caminho pelo qual uma regra pode sair do estado
"não validada".

## 2. O que este procedimento proíbe expressamente

| Proibido | Por quê |
|---|---|
| Popular regras por scraping de site | Scraping captura o que está publicado, não o que vigora. Não há garantia de versão, nem de vigência, nem de que o texto é o oficial. |
| Aplicar automaticamente regra nova em produção | Toda regra nova entra como candidata. A promoção é ato humano, com registro. |
| Copiar alíquota, CST, CFOP ou código de rejeição de blog, curso ou PDF de mercado | Essas fontes não são fontes. |
| Inferir regra por semelhança com outro modelo | NF-e 55, NFC-e 65, NFS-e, CT-e 57/67 e MDF-e 58 têm legislações e estruturas distintas. |
| Marcar regra como validada sem `FonteNormativa` preenchida | A trava é de tipo, não de disciplina. |

## 3. Origem aceitável

Uma regra só pode entrar com **pelo menos uma** destas:

1. **Ajuste SINI, AC, Ato Cotepe, Nota Técnica ou Manual próprio do modelo**,
   identificado por número, data e versão — não por URL solta.
2. **Legislação federal** (Lei, Decreto, IN RFB, Lei Complementar), com número,
   data e dispositivo.
3. **Legislação estadual ou municipal**, quando o campo exigir — com UF ou
   município explícitos, porque NFS-e é municipal e a regra varia por cidade.
4. **Documentação oficial do provedor de integração** (TecnoSpeed, PlugNotas),
   citada como *documentação de provedor*, não como norma — são coisas
   diferentes e o registro deve deixar clara a diferença.

Nada de "segundo o mercado", "conforme prática usual" ou "a maioria dos ERPs
faz assim".

## 4. O ciclo de vida de uma regra

```
                 ┌──────────────┐
                 │  candidata   │  fonte preenchida, vigência definida,
                 └──────┬───────┘  caso de teste escrito, NÃO usada em produção
                        │ revisão humana
                        ▼
                 ┌──────────────┐
                 │  validada    │  usada em produção
                 └──────┬───────┘
                        │ publicação de norma superveniente
                        ▼
                 ┌──────────────┐
                 │  revogada /  │  historico preservado, nunca apagada
                 │  substituida  │
                 └──────────────┘
```

### 4.1 Candidata

Para registrar, em `src/fiscal/regras.ts`:

```ts
{
  id: "…",
  estado: "candidata",
  texto: "…",
  fonte: {
    tipo: "ajuste_sini" | "lei" | "decreto" | "in_rfb" | "documentacao_provedor",
    identificador: "Ajuste SINI nn/aaaa",
    data: "aaaa-mm-dd",
    url: "…",           // opcional, nunca a única evidência
  },
  vigencia: { inicio: "aaaa-mm-dd", fim: null },
  casoTeste: { … },      // obrigatório: a regra tem que ser falseável
}
```

**`casoTeste` é obrigatório.** Uma regra sem caso de teste não pode ser
falseada, e portanto não pode ser verificada — seria apenas uma afirmação.

Enquanto `estado === "candidata"`, a regra **não** é usada em nenhum cálculo de
produção. Ela aparece na base de conhecimento marcada como tal.

### 4.2 Validação (promoção)

Requisitos, todos obrigatórios:

1. Fonte conferida **no documento original**, não em citação.
2. Vigência conferida, inclusive contra normas supervenientes.
3. `casoTeste` verde.
4. Pelo menos uma segunda pessoa revisou. Para regra que altera tributo, duas.
5. Registro em `docs/auditoria-tecnica.md` com data, autor e o que mudou.

A promoção é um commit explícito, com a mudança de `estado` visível no diff.
Nunca um script que promove em lote.

### 4.3 Revogação ou substituição

Quando norma superveniente entra:

- A regra antiga muda para `revogada` ou `substituida`, com `fim` preenchido.
- **A regra nunca é apagada.** Documento já emitido com ela continua explicável.
- Se a regra nova conflita com a antiga em sobreposição de vigência, a mais
  restritiva vale até a dúvida ser resolvida — e a dúvida é registrada, não
  silenciada.

## 5. Caso particular: Reforma Tributária (IBS/CBS/Imposto Seletivo)

A reforma tem **período de transição**, não uma data de troca. Durante a
transição, modelos antigos e novos coexistem, e a regra aplicável depende da
data do fato gerador.

Regras para a reforma, além das gerais:

1. Toda regra de transição declara **intervalo de vigência**, não só início.
2. Toda regra declara a **alíquota de teste** que ela assume, separadamente da
   alíquota cheia — as alíquotas de transição são reduzidas e variam por ano.
3. Nenhuma regra de transição pode ser promovida a `validada` enquanto a
   legislação de transição não estiver publicada e conferida.
4. `src/knowledge/reforma.ts` é onde o material de transição vive, e ele é
   **didático** — não é fonte.

## 6. O que fazer quando não há fonte

Quando a regra é necessária mas a fonte não foi conferida, o campo não pode ser
inventado. As opções, em ordem de preferência:

1. **Exibir pendência explícita** ao usuário, nomeando o que falta.
2. **Recusar a operação** com mensagem que diz o que impede.
3. **Não calcular** o campo, deixando-o vazio e visivelmente incompleto.

O que **não** pode acontecer: preencher com valor plausível. Um `0`, uma
alíquota "de mercado" ou um CST "que costuma ser esse" são piores que um campo
vazio, porque o campo vazio pede atenção e o preenchido passa por certo.

## 7. Frequência e gatilhos

Não há rotina de scraping. A atualização é **evento**, disparado por:

- Publicação de Ajuste SINI, Nota Técnica ou IN RFB relevante a modelo
  suportado;
- Mudança de alíquota ou de regra de transição da reforma;
- Rejeição em produção que revelar regra ausente ou errada;
- Inclusão de novo modelo documental no escopo.

Cada disparo abre um item no registro de auditoria técnica, com a fonte que
motivou.

## 8. Checklist de Pull Request normativo

```
[ ] Fonte primária identificada por número, data e versão
[ ] Texto conferido no original, não em citação
[ ] Vigência declarada, com fim quando aplicável
[ ] casoTeste escrito e verde
[ ] estado = candidata (não validada) neste PR
[ ] Nenhum campo preenchido por inferência
[ ] Telas de conhecimento marcando a regra como candidata
[ ] Registro em docs/auditoria-tecnica.md
```

## 9. Situação atual, sem enfeite

- Regras validadas: **zero**.
- Regras na base de conhecimento: 17, todas `didatico`/`ilustrativo`/`sem-fonte`.
- Regras promovidas por este procedimento: **nenhuma** — o procedimento nunca
  foi executado.
- Documentação fiscal oficial (SEFAZ, CONFAZ, Receita Federal, TecnoSpeed,
  PlugNotas) consultada para construir este repositório: **nenhuma**.

Essa última linha é a razão de o registro de regras estar vazio, e é a primeira
coisa que precisa mudar antes de qualquer claims de conformidade.
