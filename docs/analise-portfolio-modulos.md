# Análise de portfólio de módulos — visão de produto

**Data:** 2026-10-15 · **Repo:** `Implantac/fiscal-friend-43` @ `21475e3`
**Método:** medição direta do código (linhas, imports, dependências declaradas
vs. usadas), não impressão. Todos os números abaixo são reproduzíveis com os
comandos listados no apêndice.

---

## 1. O diagnóstico em uma frase

**Existem dois produtos no mesmo repositório, e o que dá receita é 26% do
código.** O produto A — a "bíblia fiscal interativa", 27 telas de conhecimento e
simulação — é o ativo que já existe e que traz audiência. O produto B — a
plataforma de emissão fiscal, 1 tela e 7.475 linhas de domínio — é o negócio. O
repositório está dimensionado para A e o risco está todo em B.

Consequência prática: cada hora gasta mantendo A é hora não gasta em provar B, e
B é o único que precisa de credenciamento, certificado, XSD e homologação para
faturar.

---

## 2. Os números

| Camada                   |        LOC | % do `src` | Testes                 | Leitura                                     |
| ------------------------ | ---------: | ---------: | ---------------------- | ------------------------------------------- |
| `src/routes/`            |      8.137 |        26% | **0**                  | 28 telas, nenhuma coberta por teste         |
| `src/fiscal/`            |      7.475 |        24% | 3.688 LOC / 246 testes | **é o produto**                             |
| `src/components/`        |      5.851 |        19% | **0**                  | 63 componentes, 27 nunca usados             |
| `src/knowledge/`         |      4.065 |        13% | **0**                  | conteúdo — barato de manter, caro de copiar |
| `src/simulation/`        |      2.219 |         7% | 264 LOC                | 6 telas de emissão que não emitem           |
| `src/blueprint/`         |      1.227 |         4% | **0**                  | catalogação dos módulos                     |
| `src/lib` + `src/domain` |      1.203 |         4% | 210 LOC                | motor monetário e utilitários               |
| **Total**                | **30.942** |       100% | **3.688 LOC (12%)**    |                                             |

**62% do código (19.280 linhas) não tem nenhum teste.** E a distribuição é
invertida: o que tem teste é o que ainda não provou funcionar contra um banco
real; o que não tem teste é o que o usuário vê todos os dias.

### Dependências: 55 declaradas, 24 não sustentam nada

Dos 55 pacotes em `dependencies`, **24 só são importados pelo componente shadcn
que os embrulha — e esse componente não é usado por nenhuma rota ou feature**:

- **15 pacotes Radix** sem uso: `alert-dialog`, `aspect-ratio`, `avatar`,
  `collapsible`, `context-menu`, `hover-card`, `menubar`, `navigation-menu`,
  `popover`, `progress`, `radio-group`, `slider`, `toggle`, `toggle-group`,
  `tooltip`
- **8 pacotes de terceiros** sem uso: `recharts`, `embla-carousel-react`,
  `vaul`, `react-resizable-panels`, `react-day-picker`, `react-hook-form`,
  `@hookform/resolvers`, `input-otp`
- **`date-fns`: zero imports em todo o `src/`**

**27 dos 46 componentes de `src/components/ui/` nunca são importados fora da
própria pasta `ui/`.** São 44% das dependências de produção sustentando código
morto — superfície de supply chain, tempo de build e superfície de CVE sem
contrapartida.

---

## 3. O que AGREGA

### Tier 1 — investir sem discussão (o caminho da receita)

| Módulo                                  | Por quê                                                                                                                                                     |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/fiscal/**` (7.475 LOC, 246 testes) | Multi-tenancy, ciclo de vida, numeração atômica, auditoria, autenticação, persistência. **Isto é o produto.** Nenhum concorrente entrega isso em 2 semanas. |
| `/documentos`                           | A única tela que produz algo pelo qual alguém paga.                                                                                                         |
| `src/lib/money.ts`                      | Decimal exato em `bigint`. Inegociável em fiscal — é a diferença entre fechar o total da nota e tomar rejeição por 1 centavo.                               |
| `src/fiscal/regras.ts` (arcabouço)      | Estrutura que **obriga** fonte, vigência, versão e caso de teste. Está vazia de regras validadas — e isso é honesto, não incompleto.                        |

### Tier 2 — manter, é barato e é fosso competitivo

| Módulo                                                                 | Por quê                                                                                                                                                                 |
| ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `conhecimento`, `comece-aqui`, `mapa`, `reforma`, `fontes`, `academia` | Conteúdo. Não tem lógica para quebrar, não precisa de teste de regressão, e é **caro de copiar** — ao contrário do código. É o que traz o tráfego que alimenta o funil. |
| `cstat` (232 linhas de tabela de rejeição)                             | Utilidade real para o time de suporte do cliente. Reduz ticket.                                                                                                         |
| `conferir-xml`                                                         | mesmo — utilidade de suporte, exercita a base de conhecimento.                                                                                                          |

### Tier 3 — manter com ressalva

| Módulo           | Ressalva                                                                                                                                                                                                                                                       |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `diagnostico-ia` | Custo de inferência por uso e **responsabilidade**: a feature promete diagnóstico fiscal. Se ela errar uma causa de rejeição, o prejuízo é do cliente. Manter apenas com o selo de "não é parecer fiscal" já existente, e sem promessa de correção automática. |

---

## 4. O que NÃO AGREGA

### 4.1 As 6 telas de emissão simulada — 2.321 linhas, 6 rotas

`nfe` (385), `cte` (423), `cte-os` (415), `mdfe` (410), `nfce` (387), `nfse` (301).

Todas importam **os mesmos 6 módulos** de `src/simulation/`.

**Correção medida nesta etapa:** a primeira versão desta análise afirmava "~1.900 LOC de
duplicação". Isso estava **errado** e foi corrigido. O número vinha de um diff que removia
todos os caracteres alfabéticos e portanto contava tags de fechamento de JSX como linhas
idênticas. Medindo direito — linhas literalmente iguais, sem espaços — o quadro é outro:

- Sobreposição entre **pares** de telas: 73 a 125 linhas (de 301 a 423 linhas cada).
- Núcleo comum às **seis**: 69 linhas únicas, das quais ~44 são fechamentos de JSX e
  pontuação. A sobra real são imports, o bloco `head.meta` e o esqueleto do `PageHeader`.

Ou seja: **não há 1.900 linhas duplicadas; há ~400 linhas de cromo compartilhado** (18 linhas
de `head` × 6, mais o par `ExportarDocumento`/`ResultadoAlert` e o grid de layout).

E os campos são genuinamente distintos: `nfe` tem itens/NCM/CFOP/frete; `nfse` tem
tomador/serviço/tributação municipal; `cte` tem arrastar-e-soltar XML e composição de frete;
`cte-os` tem abas de modalidade e grade de malotes; `mdfe` tem documentos manifestados,
condutor e percurso; `nfce` tem frente de caixa e interruptor de contingência. Fundir as seis
em uma tela parametrizada significaria ou um monstro dirigido a configuração, ou perder
justamente o detalhe fiscal que dá valor ao catálogo. **A fusão não foi executada.**

O que foi feito, e é o que resolve o problema real: as seis rotas **saíram do menu
principal** e passaram a ser alcançadas por `/cobertura`, que declara capacidade por
capacidade o que cada uma faz de verdade. O menu principal não promete mais seis emissões.

### 4.2 Os 9 laboratórios expostos como produto — 2.189 linhas

`regressao` (340), `governanca` (331), `debugger` (290), `incidentes` (280),
`xml-lab` (213), `suporte` (206), `qualidade` (170), `math-lab` (164),
`cstat` (195).

Oito desses são **ferramentas internas de engenharia** — casos de teste,
lacunas, roteiro de analista, completo/incompleto. Não são features de cliente.
Um contabilista que abre o produto e vê "Regressão", "Incidentes" e "Qualidade"
no menu conclui que entrou no painel do desenvolvedor por engano.

**Feito:** os oito foram para uma seção "Engenharia" que só aparece com o
**Modo Desenvolvedor** ativado (o interruptor já existia no cabeçalho). `cstat`
e `conferir-xml` ficam — esses são de suporte, não de engenharia. Nenhuma rota
foi apagada; todas continuam acessíveis por URL.

### 4.3 Dependências e componentes mortos — 24 pacotes, 27 componentes

Já quantificado acima. Remover não muda nenhum comportamento de tela.

---

## 5. O que eu **não** cortaria (e por que essa parte é frágil)

1. **Os selos de status honestos.** `procedencia: didatico` com
   `status: "ilustrativo"` e `fonteId: "sem-fonte"` nas 17 regras da tela, e o
   registro real vazio de regras validadas. Isso parece "incompleto" e é
   exatamente o oposto: é o que impede o produto de afirmar uma alíquota que
   ninguém conferiu. Cortar isso para "parecer pronto" seria o erro mais caro
   possível — é a linha entre ferramenta e passivo jurídico.
2. **A separação de estados do documento.** `simulacao` / `pre_validacao` /
   `documento_gerado` / … / `autorizado`, com `autorizado` inalcançável sem
   resposta oficial. É aFeature que mais protege o cliente.
3. **`src/fiscal/regras.ts` vazio.** Um catálogo de regras sem fonte é pior que
   catálogo nenhum.

---

## 6. Risco de cortar — o que quebra se formos longe demais

| Corte                              | Risco                                                                                                                                                                                                                    |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Tirar as 6 telas do menu principal | Perdem o atalho direto. **Mitigação executada:** continuam acessíveis por URL e linkadas a partir de `/cobertura`, `/matriz` e das páginas de conhecimento.                                                              |
| Esconder os laboratórios           | Nenhum risco de funcionalidade; perde-se transparência com o time técnico. Mitigação: flag de desenvolvedor, já existente.                                                                                               |
| Remover 24 dependências            | Risco de build baixo e **verificado**: o gate completo (typecheck, lint, 255 testes, build, fumaça HTTP) passou. É o corte mais seguro de todos.                                                                         |
| **Fundir as 6 telas em 1**         | **Não executado.** Medi-lo mostrou que a duplicação real é ~400 linhas de cromo, não ~1.900, e que os campos são fiscalmente distintos. Fundir destruiria o detalhe que dá valor ao catálogo em troca de ~15% de LINHAS. |

---

## 7. Recomendação — três caminhos

|       | Opção                                                                                                                                                                    | Esforço                           | Efeito                                                                                                  |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------- | ------------------------------------------------------------------------------------------------------- |
| **A** | **Só cortar o morto.** Remover 24 dependências e 27 componentes não usados. Nenhuma tela muda.                                                                           | 1 dia, risco quase zero           | −44% das dependências, build mais rápido, menos superfície de CVE.                                      |
| **B** | **A + reorganizar a navegação.** Página de cobertura por modelo; mover 8 laboratórios de engenharia para trás do Modo Desenvolvedor; simuladores fora do menu principal. | 2–3 dias                          | Menu com 14 entradas em vez de 27 (22 com dev ligado). Promessa de emissão substituída por estado real. |
| **C** | **B + congelar o produto A.** Todo investimento novo em `src/fiscal/`, `documentos` e provedores. Produto A entra em manutenção (só correção e conteúdo).                | decisão de produto, não de código | Foco total em provar B contra banco real, XSD, certificado e homologação.                               |

**A e B foram executadas nesta etapa.** A foi ganho imediato e sem risco. B é
onde a percepção de produto melhora de verdade: o menu deixou de prometer seis
emissões e passou a declarar o que cada modelo faz. C continua sendo a decisão
que só você pode tomar, porque define o que a empresa é nos próximos 12 meses.

O que eu **não** recomendo é cortar as telas de conhecimento: elas são o único
ativo do produto A que um concorrente não copia em uma semana.

---

## Apêndice — como reproduzir os números

```bash
# LOC por camada
for d in src/routes src/fiscal src/components src/knowledge src/simulation \
         src/blueprint src/lib src/domain; do
  find $d -name '*.ts' -o -name '*.tsx' | xargs wc -l | tail -1
done

# Componentes de UI nunca importados fora de ui/
for f in $(ls src/components/ui/ | sed 's/.tsx//'); do
  grep -rl "components/ui/$f\"" src/routes src/components/blueprint \
    src/components/knowledge src/components/layout 2>/dev/null | wc -l
done

# Dependências órfãs (só importadas pelo wrapper shadcn)
for p in recharts embla-carousel-react vaul react-resizable-panels \
         react-day-picker react-hook-form input-otp date-fns; do
  grep -rl "$p" src/
done

# Sobreposição entre as telas de emissão
for a in nfe nfce nfse cte cte-os mdfe; do for b in nfe nfce nfse cte cte-os mdfe; do
  [ "$a" \< "$b" ] && diff <(sed 's/[A-Za-z-]*//g' src/routes/$a.tsx) \
                           <(sed 's/[A-Za-z-]*//g' src/routes/$b.tsx) | grep -c '^<'
done; done
```
