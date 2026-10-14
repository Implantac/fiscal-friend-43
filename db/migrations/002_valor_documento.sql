-- ============================================================================
-- Fiscal Friend 43 — Migração 002: valor monetário do documento
-- ============================================================================
-- Banco alvo: PostgreSQL 14+
--
-- DECISÃO DE MODELAGEM
-- ----------------------------------------------------------------------------
-- O valor do documento é guardado em **centavos inteiros** (`BIGINT`), não em
-- `NUMERIC(15,2)` e nunca em `DOUBLE PRECISION`. A razão é o motor monetário
-- (`src/lib/money.ts`): ele opera em `bigint` de centavos, onde toda aritmética
-- é exata e determinística. `DOUBLE PRECISION` é binário — `0,1 + 0,2 != 0,3` —
-- e a diferença de um centavo entre a soma dos itens e o total do documento é
-- justamente o que os validadores oficiais comparam.
--
-- `NUMERIC(15,2)` seria aceitável, mas obrigaria conversão de ida e volta a
-- cada leitura, e a conversão é onde os erros de escala nascem. Guardar na
-- unidade interna do motor elimina a conversão.
--
-- A coluna é NOT NULL com DEFAULT 0: um documento recém-criado ainda não tem
-- valor definitivo, e "zero" é um estado honesto — melhor que NULL, que
-- obrigaria todo leitor a tratar ausência de valor.
--
-- LIMITE: BIGINT aceita até 9,2 × 10^18 centavos (~R$ 9,2 × 10^16). É ordens de
-- magnitude acima do maior documento fiscal brasileiro, mas o limite é real e
-- fica registrado aqui em vez de descoberto em produção.
-- ============================================================================

BEGIN;

ALTER TABLE documentos_fiscais
  ADD COLUMN IF NOT EXISTS valor_total_centavos BIGINT NOT NULL DEFAULT 0;

-- Valor não pode ser negativo. Documento fiscal com total negativo não existe;
-- estornos e cancelamentos são documentos/eventos próprios, não sinal invertido.
ALTER TABLE documentos_fiscais
  DROP CONSTRAINT IF EXISTS documentos_valor_nao_negativo;
ALTER TABLE documentos_fiscais
  ADD CONSTRAINT documentos_valor_nao_negativo CHECK (valor_total_centavos >= 0);

COMMENT ON COLUMN documentos_fiscais.valor_total_centavos IS
  'Total do documento em centavos de Real (BIGINT). Unidade interna do motor monetário; nunca ponto flutuante.';

COMMIT;
