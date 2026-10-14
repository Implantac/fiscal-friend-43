# Modelo de dados e ciclo de vida

> Status: **contrato definido e testado**; persistência real (Postgres) é a
> Etapa 2.5. As portas em `src/fiscal/persistencia.ts` não mudam quando o banco
> entrar — só a implementação.

## 1. Entidades

```text
Tenant (conta/empresa-raiz)
 └── Empresa            (CNPJ, regime, inscrições)
     └── Estabelecimento (CNPJ, IE, séries por modelo, ambiente)
         ├── CertificadoDigital   (metadados; chave privada NUNCA aqui)
         └── DocumentoFiscal      (agregado raiz do ciclo de vida)
             └── EventoDocumento  (histórico imutável)
```

Toda entidade carrega `tenantId`. Não existe entidade de negócio sem tenant —
isso é o que torna o isolamento estrutural e não por convenção.

### Regras de cadastro

| Campo | Regra |
|---|---|
| CNPJ/CPF | validação **estrutural** (dígitos verificadores). Não afirma situação cadastral nem habilitação fiscal |
| `ambiente` | 1 = produção, 2 = homologação. O simulador é fixo em 2 e recusa 1 |
| `series` | mapa `modelo → série`; a numeração é por estabelecimento + modelo + série |
| Certificado | somente metadados públicos (thumbprint, validade, emissor). Chave privada e senha ficam no back-end, em cofre de segredos |

## 2. Máquina de estados do documento

```text
simulacao ──► pre_validacao ──► documento_gerado ──► xml_validado ──► assinado
   ▲                │                                                   │
   └────────────────┘                                                   ▼
                              rejeitado ◄──── transmitido ────────────────┘
                                  │              │  │  │
                                  │              │  │  └──► indisponivel_ou_contingencia ──► transmitido
                                  │              │  └─────► pendente_consulta
                                  │              │            │  │  │  └──► transmitido (retentativa)
                                  └──► documento_gerado      │  └─────► rejeitado
                                                 autorizado ◄┘
                                                     │
                                                     ▼
                                        cancelado_ou_encerrado (terminal)
```

### Regras bloqueadas (testadas)

| Regra | Motivo |
|---|---|
| `autorizado` sem protocolo oficial | protocolo não pode ser inventado |
| `autorizado` com `origem: "local"` | resposta oficial vem do Fisco/provedor, nunca da interface |
| `rejeitado` sem `cStat` | rejeição sem código oficial não é rejeição, é chute |
| `transmitido` sem chave de idempotência | retentativa geraria documento duplicado |
| `pendente_consulta` → `documento_gerado` | timeout após envio **não** autoriza reemitir; primeiro investiga-se |
| `autorizado` → `documento_gerado` | documento autorizado só muda por mecanismo legal |
| `xml_validado`/`assinado` → `documento_gerado` | não se edita XML validado ou assinado |
| qualquer estado → `cancelado_ou_encerrado` sem evento | cancelamento exige evento oficial confirmado |

### Edição

`podeEditar(estado)` é verdadeiro apenas em `simulacao`, `pre_validacao` e
`documento_gerado`. A partir de `xml_validado`, `assertEditavel` lança
`DocumentoImutavel` com a mensagem apontando os mecanismos admitidos.

## 3. Numeração e idempotência

`ServicoNumeracao` (`src/fiscal/numeracao.ts`):

- reserva atômica e sequencial por `tenant + estabelecimento + modelo + série`;
- **chave de idempotência obrigatória**: a mesma chave devolve o mesmo número
  sem consumir a sequência;
- a mesma chave não pode ser reutilizada em outra sequência (erro explícito);
- inutilização exige justificativa com pelo menos 15 caracteres;
- teste de concorrência: 50 reservas simultâneas → 50 números únicos e sequenciais.

Em produção, a reserva deve ser `SELECT ... FOR UPDATE` sobre a tabela de
sequência, dentro da transação do documento.

## 4. Persistência e transação

`UnidadeTrabalho` agrupa documentos, numeração e auditoria com semântica
**tudo-ou-nada**: escritas em staging, `commit()` aplica, `rollback()` descarta.
Controle de concorrência otimista: escrita baseada em leitura desatualizada
gera `ConflitoConcorrencia` em vez de sobrescrever.

Consultas sempre recebem `tenantId` — o filtro é aplicado na query, não na
leitura do registro, para que a existência de um recurso não vaze para outro
tenant.

## 5. Trilha de auditoria

`AuditoriaPort` é **append-only**: registros são congelados com
`Object.freeze` no momento da criação. Não há update nem delete. Ações
registradas incluem criação, transição, transmissão, autorização, rejeição,
cancelamento, reserva e inutilização de numeração, além de `acesso.negado` e
`acesso.cross_tenant`.

`sanitizarParaAuditoria()` redige `senha`/`token`/`api_key`/`secret`, blocos
PEM e CPF antes de qualquer registro.

## 6. O que ainda não existe

- Postgres e migrações versionadas (Etapa 2.5);
- autenticação/sessão/MFA (Etapa 2.5);
- tabela de regras com vigência ligada ao cálculo (Etapa 3);
- retenção, backup e descarte (Etapa 7).
