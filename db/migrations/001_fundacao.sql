-- ============================================================================
-- Fiscal Friend 43 — Migração 001: fundacao multi-tenant
-- ============================================================================
-- Banco alvo: PostgreSQL 14+
--
-- DECISÃO DE SEGURANÇA CENTRAL DESTE SCHEMA
-- ----------------------------------------------------------------------------
-- O isolamento entre empresas NÃO depende apenas do código da aplicação.
-- Cada tabela de negócio tem Row-Level Security (RLS) ativada, e a política
-- compara `tenant_id` com a variável de sessão `app.tenant_id`, que a
-- aplicação define por conexão/transação.
--
-- Consequência prática: mesmo que uma query esqueça o filtro de tenant, o
-- banco devolve zero linhas em vez de vazar dados de outra empresa. O código
-- filtra; o banco garante.
--
-- Nenhuma coluna armazena segredo em texto: senha e token de sessão são
-- guardados como hash (PBKDF2), e metadados de certificado digital não
-- incluem chave privada.
-- ============================================================================

BEGIN;

-- Extensão para geração de UUIDs (disponível no Postgres 13+ sem extensão).
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ----------------------------------------------------------------------------
-- TENANTS E USUÁRIOS
-- ----------------------------------------------------------------------------

CREATE TABLE tenants (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome          TEXT NOT NULL,
  cnpj_matriz   TEXT,
  ativo         BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT tenants_cnpj_matriz_formato CHECK (cnpj_matriz IS NULL OR cnpj_matriz ~ '^[0-9]{14}$')
);

CREATE TABLE usuarios (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  email         TEXT NOT NULL,
  -- Hash PBKDF2 (formato: algoritmo$iteracoes$salt_b64$hash_b64).
  -- NUNCA texto plano.
  hash_senha    TEXT NOT NULL,
  nome          TEXT,
  papel         TEXT NOT NULL CHECK (papel IN
                  ('administrador','fiscal','operador','suporte','auditor')),
  ativo         BOOLEAN NOT NULL DEFAULT TRUE,
  -- Controle de abuso: falhas consecutivas e bloqueio temporário.
  falhas_login  INTEGER NOT NULL DEFAULT 0,
  bloqueado_ate TIMESTAMPTZ,
  criado_em     TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT usuarios_email_unico_por_tenant UNIQUE (tenant_id, email)
);

CREATE TABLE sessoes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  usuario_id    UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  -- Hash do token; o token em si trafega apenas por cookie HttpOnly.
  token_hash    TEXT NOT NULL UNIQUE,
  criada_em     TIMESTAMPTZ NOT NULL DEFAULT now(),
  expira_em     TIMESTAMPTZ NOT NULL,
  revogada_em   TIMESTAMPTZ,
  ip            TEXT,
  agente        TEXT
);

CREATE INDEX sessoes_expira_idx ON sessoes (expira_em) WHERE revogada_em IS NULL;

-- ----------------------------------------------------------------------------
-- CADASTRO FISCAL
-- ----------------------------------------------------------------------------

CREATE TABLE empresas (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id            UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  razao_social         TEXT NOT NULL,
  nome_fantasia        TEXT,
  cnpj                 TEXT NOT NULL,
  inscricao_estadual   TEXT,
  inscricao_municipal  TEXT,
  cnae                 TEXT,
  municipio            TEXT NOT NULL,
  uf                   TEXT NOT NULL CHECK (char_length(uf) = 2),
  pais                 TEXT NOT NULL DEFAULT '1058',
  regime_tributario    TEXT NOT NULL CHECK (regime_tributario IN
                         ('simples_nacional','simples_nacional_excesso',
                          'lucro_presumido','lucro_real','mei','nao_definido')),
  ativo                BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em            TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT empresas_cnpj_formato CHECK (cnpj ~ '^[0-9]{14}$'),
  -- Um CNPJ não pode se repetir dentro do mesmo tenant.
  CONSTRAINT empresas_cnpj_unico_por_tenant UNIQUE (tenant_id, cnpj)
);

CREATE TABLE estabelecimentos (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id            UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  empresa_id           UUID NOT NULL REFERENCES empresas(id) ON DELETE RESTRICT,
  cnpj                 TEXT NOT NULL,
  inscricao_estadual   TEXT,
  inscricao_municipal  TEXT,
  municipio            TEXT NOT NULL,
  uf                   TEXT NOT NULL CHECK (char_length(uf) = 2),
  -- Séries por modelo documental, ex.: {"55":1,"65":1}
  series               JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- 1 = produção, 2 = homologação
  ambiente             SMALLINT NOT NULL DEFAULT 2 CHECK (ambiente IN (1,2)),
  ativo                BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em            TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT estabelecimentos_cnpj_formato CHECK (cnpj ~ '^[0-9]{14}$'),
  CONSTRAINT estabelecimentos_unico_por_tenant UNIQUE (tenant_id, cnpj)
);

CREATE INDEX estabelecimentos_empresa_idx ON estabelecimentos (tenant_id, empresa_id);

-- Metadados do certificado. A chave privada NUNCA é persistida aqui.
CREATE TABLE certificados_digitais (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  estabelecimento_id UUID NOT NULL REFERENCES estabelecimentos(id) ON DELETE CASCADE,
  thumbprint         TEXT NOT NULL,
  titular            TEXT NOT NULL,
  cnpj               TEXT NOT NULL,
  valido_de          TIMESTAMPTZ NOT NULL,
  valido_ate         TIMESTAMPTZ NOT NULL,
  emissor            TEXT,
  revogado           BOOLEAN NOT NULL DEFAULT FALSE,
  criado_em          TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT certificados_validade CHECK (valido_ate > valido_de)
);

-- ----------------------------------------------------------------------------
-- NUMERAÇÃO (transacional)
-- ----------------------------------------------------------------------------

CREATE TABLE numeracao (
  tenant_id          UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  estabelecimento_id UUID NOT NULL REFERENCES estabelecimentos(id) ON DELETE RESTRICT,
  modelo             TEXT NOT NULL,
  serie              TEXT NOT NULL,
  atual              BIGINT NOT NULL DEFAULT 0 CHECK (atual >= 0),
  atualizado_em      TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, estabelecimento_id, modelo, serie)
);

CREATE TABLE numeracao_inutilizada (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  estabelecimento_id UUID NOT NULL REFERENCES estabelecimentos(id) ON DELETE RESTRICT,
  modelo             TEXT NOT NULL,
  serie              TEXT NOT NULL,
  numero_de          BIGINT NOT NULL,
  numero_ate         BIGINT NOT NULL,
  justificativa      TEXT NOT NULL CHECK (char_length(justificativa) >= 15),
  criado_em          TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT numeracao_inutilizada_intervalo CHECK (numero_ate >= numero_de)
);

-- ----------------------------------------------------------------------------
-- DOCUMENTOS FISCAIS E EVENTOS
-- ----------------------------------------------------------------------------

CREATE TABLE documentos_fiscais (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  empresa_id         UUID NOT NULL REFERENCES empresas(id) ON DELETE RESTRICT,
  estabelecimento_id UUID NOT NULL REFERENCES estabelecimentos(id) ON DELETE RESTRICT,
  familia            TEXT NOT NULL CHECK (familia IN
                      ('nfe55','nfce65','nfse','cte57','cteos67','mdfe58')),
  modelo             TEXT NOT NULL,
  serie              TEXT NOT NULL,
  numero             TEXT NOT NULL,
  chave              TEXT CHECK (chave IS NULL OR char_length(chave) = 44),
  estado             TEXT NOT NULL CHECK (estado IN
                      ('simulacao','pre_validacao','documento_gerado','xml_validado',
                       'assinado','transmitido','autorizado','rejeitado',
                       'pendente_consulta','cancelado_ou_encerrado',
                       'indisponivel_ou_contingencia')),
  ambiente           SMALLINT NOT NULL DEFAULT 2 CHECK (ambiente IN (1,2)),
  xml                TEXT,
  versao_leiaute     TEXT,
  protocolo          TEXT,
  c_stat             TEXT,
  -- Chave de idempotência da transmissão. ÚNICA POR TENANT: é o que impede
  -- que uma retentativa após timeout gere um segundo documento.
  idempotencia       TEXT,
  criado_em          TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT documentos_idempotencia_unica UNIQUE (tenant_id, idempotencia),
  -- Número não se repete dentro do tenant + estabelecimento + modelo + série.
  CONSTRAINT documentos_numero_unico UNIQUE (tenant_id, estabelecimento_id, modelo, serie, numero)
);

CREATE INDEX documentos_estado_idx ON documentos_fiscais (tenant_id, estado);
CREATE INDEX documentos_chave_idx ON documentos_fiscais (tenant_id, chave) WHERE chave IS NOT NULL;
CREATE INDEX documentos_periodo_idx ON documentos_fiscais (tenant_id, criado_em);

CREATE TABLE eventos_documento (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  documento_id   UUID NOT NULL REFERENCES documentos_fiscais(id) ON DELETE CASCADE,
  de             TEXT NOT NULL,
  para           TEXT NOT NULL,
  tipo           TEXT NOT NULL CHECK (tipo IN
                 ('transicao','transmissao','resposta_oficial','evento_fiscal','correcao_manual')),
  detalhe        TEXT,
  usuario_id     UUID,
  origem         TEXT NOT NULL CHECK (origem IN ('local','provedor','sefaz','sistema')),
  em             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX eventos_documento_idx ON eventos_documento (tenant_id, documento_id, em);

-- Histórico imutável: nenhuma atualização ou exclusão é permitida.
CREATE OR REPLACE FUNCTION eventos_documento_imutaveis() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'eventos_documento é append-only: % não é permitido', TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER eventos_documento_bloqueia_update
  BEFORE UPDATE OR DELETE ON eventos_documento
  FOR EACH ROW EXECUTE FUNCTION eventos_documento_imutaveis();

-- ----------------------------------------------------------------------------
-- AUDITORIA (append-only)
-- ----------------------------------------------------------------------------

CREATE TABLE auditoria (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  usuario_id   UUID,
  papel        TEXT,
  acao         TEXT NOT NULL,
  entidade     TEXT NOT NULL,
  entidade_id  TEXT NOT NULL,
  resumo       TEXT NOT NULL,
  antes        TEXT,
  depois       TEXT,
  origem       TEXT NOT NULL CHECK (origem IN ('usuario','sistema','integracao')),
  sessao       TEXT,
  em           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX auditoria_consulta_idx ON auditoria (tenant_id, em DESC);
CREATE INDEX auditoria_entidade_idx ON auditoria (tenant_id, entidade, entidade_id);

CREATE OR REPLACE FUNCTION auditoria_imutavel() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'auditoria é append-only: % não é permitido', TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER auditoria_bloqueia_update
  BEFORE UPDATE OR DELETE ON auditoria
  FOR EACH ROW EXECUTE FUNCTION auditoria_imutavel();

-- ----------------------------------------------------------------------------
-- REGRAS FISCAIS (Etapa 3 — estrutura criada agora, dados entram com fonte)
-- ----------------------------------------------------------------------------

CREATE TABLE regras_fiscais (
  id                TEXT PRIMARY KEY,
  versao            TEXT NOT NULL,
  titulo            TEXT NOT NULL,
  descricao         TEXT NOT NULL,
  orgao_fonte       TEXT,
  documento_fonte   TEXT,
  dispositivo       TEXT,
  versao_fonte      TEXT,
  consultada_em     DATE,
  url_fonte         TEXT,
  jurisdicao        TEXT,
  escopo            TEXT,
  vigencia_inicio   DATE,
  vigencia_fim      DATE,
  estado            TEXT NOT NULL CHECK (estado IN
                      ('rascunho','em_revisao','validada_tecnicamente','aprovada_para_uso',
                       'vigente','substituida','revogada','bloqueada')),
  formula           TEXT,
  arredondamento   TEXT,
  responsavel       TEXT,
  aprovada_em       DATE,
  limitacoes        TEXT,
  criado_em         TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Regra aprovada exige fonte com data de consulta.
  CONSTRAINT regras_fonte_obrigatoria CHECK (
    estado = 'rascunho' OR (orgao_fonte IS NOT NULL AND documento_fonte IS NOT NULL AND consultada_em IS NOT NULL)
  )
);

CREATE TABLE regras_casos_teste (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  regra_id       TEXT NOT NULL REFERENCES regras_fiscais(id) ON DELETE CASCADE,
  descricao      TEXT NOT NULL,
  entrada        JSONB NOT NULL,
  saida_esperada JSONB NOT NULL,
  origem         TEXT NOT NULL CHECK (origem IN ('fonte_oficial','especialista','didatico'))
);

-- ----------------------------------------------------------------------------
-- ROW-LEVEL SECURITY
-- ----------------------------------------------------------------------------
-- A aplicação define, por conexão/transação:
--   SET LOCAL app.tenant_id = '<uuid>';
-- Sem essa variável, nenhuma linha é visível (política é restritiva).
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION tenant_atual() RETURNS UUID AS $$
  SELECT NULLIF(current_setting('app.tenant_id', TRUE), '')::UUID;
$$ LANGUAGE sql STABLE;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'usuarios','empresas','estabelecimentos','certificados_digitais','numeracao',
    'numeracao_inutilizada','documentos_fiscais','eventos_documento','auditoria'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'CREATE POLICY %I ON %I USING (tenant_id = tenant_atual()) WITH CHECK (tenant_id = tenant_atual())',
      t || '_tenant_isolation', t
    );
  END LOOP;
END $$;

-- ----------------------------------------------------------------------------
-- POLÍTICA DE `sessoes` — exceção deliberada e documentada
-- ----------------------------------------------------------------------------
-- `sessoes` é a fronteira de AUTENTICAÇÃO, não a fronteira de dados de tenant.
-- O token de sessão é a própria credencial: para descobrir a qual tenant uma
-- sessão pertence, é preciso primeiro LER a sessão — e nesse momento o contexto
-- de tenant ainda não existe. Uma política `tenant_id = tenant_atual()` pura
-- tornaria o login impossível (a consulta devolveria zero linhas).
--
-- A divisão escolhida:
--   * LEITURA  é permitida sem contexto de tenant. O que se expõe é metadado
--     (id, tenant, usuário, hash do token, expiração, revogação). O hash do
--     token é SHA-256 de 256 bits: conhecer a linha não concede uso da sessão.
--   * ESCRITA  exige contexto de tenant. Revogar a sessão de outro tenant é o
--     dano concreto que a política precisa impedir, e nesse caminho o tenant já
--     é conhecido (a sessão foi encontrada; o usuário foi encontrado).
--
-- Compensações: (a) só o repositório de autenticação toca `sessoes`;
-- (b) a linha nunca contém o token, apenas o hash; (c) `usuarios` mantém a
-- política estrita porque nela o tenant sempre é conhecido.
-- ----------------------------------------------------------------------------
ALTER TABLE sessoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessoes FORCE ROW LEVEL SECURITY;

CREATE POLICY sessoes_leitura_token ON sessoes
  FOR SELECT
  USING (tenant_id = tenant_atual() OR tenant_atual() IS NULL);

CREATE POLICY sessoes_escrita_tenant ON sessoes
  FOR INSERT
  WITH CHECK (tenant_id = tenant_atual());

CREATE POLICY sessoes_atualiza_tenant ON sessoes
  FOR UPDATE
  USING (tenant_id = tenant_atual()) WITH CHECK (tenant_id = tenant_atual());

CREATE POLICY sessoes_remove_tenant ON sessoes
  FOR DELETE
  USING (tenant_id = tenant_atual());

-- ----------------------------------------------------------------------------
-- GARANTIA DE CONSISTÊNCIA DE TENANT
-- ----------------------------------------------------------------------------
-- FK normal não impede que um documento do tenant A aponte para um
-- estabelecimento do tenant B (as FKs são por coluna, não por par
-- tenant+id). Este trigger fecha esse buraco.
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION validar_tenant_documento() RETURNS trigger AS $$
DECLARE est_tenant UUID;
BEGIN
  SELECT tenant_id INTO est_tenant FROM estabelecimentos WHERE id = NEW.estabelecimento_id;
  IF est_tenant IS NULL OR est_tenant <> NEW.tenant_id THEN
    RAISE EXCEPTION 'estabelecimento % não pertence ao tenant %', NEW.estabelecimento_id, NEW.tenant_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER documentos_tenant_consistente
  BEFORE INSERT OR UPDATE ON documentos_fiscais
  FOR EACH ROW EXECUTE FUNCTION validar_tenant_documento();

COMMIT;
