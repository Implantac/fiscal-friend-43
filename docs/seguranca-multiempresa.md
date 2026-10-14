# Segurança, LGPD e isolamento multiempresa

> Escopo entregue: **contrato de autorização, isolamento estrutural e trilha de
> auditoria**, todos testados. Login, sessão, MFA, criptografia em repouso e
> gestão de segredos são Etapa 2.5/7.

## 1. Isolamento multi-tenant

| Mecanismo | Onde | Garantia |
|---|---|---|
| `tenantId` em toda entidade | `src/fiscal/tenancy.ts` | não existe dado de negócio sem tenant |
| `assertMesmoTenant()` | domínio | acesso cross-tenant lança `AcessoCrossTenant` — erro ruidoso, nunca lista vazia silenciosa |
| `filtrarPorTenant()` | consultas | filtro aplicado na query; a existência do recurso não vaza |
| `tenantId` obrigatório nas portas | `persistencia.ts`, `auditoria.ts` | não há como ler sem informar o tenant |

Um resultado vazio seria indistinguível de "não existe" e esconderia a tentativa
de acesso. Por isso a barreira **lança**, e a exceção manda auditar.

## 2. Papéis e permissões

| Papel | Pode | Não pode |
|---|---|---|
| `administrador` | tudo, inclusive aprovar regras e gerir certificados | — |
| `fiscal` | propor/aprovar regras, gerir participantes, consultar | transmitir, cancelar, criar documento |
| `operador` | criar, transmitir e consultar documentos | aprovar regra, gerir certificado, cancelar |
| `suporte` | consultar | qualquer escrita |
| `auditor` | consultar | qualquer escrita |

Regras adicionais:

- **autorização no servidor**, nunca só na interface — esconder botão não é
  controle de acesso;
- **acesso por estabelecimento**: `estabelecimentoIds` vazio = todos do tenant;
  caso contrário, somente os listados (`AcessoEstabelecimentoNegado`);
- **separação de funções**: `violaSeparacaoDeFuncoes()` impede que quem aprovou
  uma regra seja o mesmo usuário que a executou em documento de produção.

## 3. Trilha de auditoria

- append-only, registros congelados (`Object.freeze`);
- ações de acesso negado e cross-tenant são eventos de primeira classe
  (`acesso.negado`, `acesso.cross_tenant`);
- `sanitizarParaAuditoria()` redige credenciais, blocos PEM e CPF;
- consulta sempre filtrada por tenant.

## 4. Certificados e segredos

| Item | Onde vive | Onde **não** vive |
|---|---|---|
| Chave privada, senha do certificado | back-end, cofre de segredos | front-end, banco, log, trilha |
| Tokens de provedor | variável de ambiente do servidor | repositório, bundle do cliente |
| Metadados do certificado | `CertificadoDigital` | — |

`.env.example` documenta o contrato de variáveis **sem nenhum valor real**.
Nenhum arquivo versionado contém credencial.

## 5. O que ainda não está implementado

- autenticação, sessão, MFA e rate limiting (Etapa 2.5);
- criptografia em trânsito (TLS) e em repouso (Etapa 7 — decisão de hospedagem);
- política de retenção e descarte conforme a legislação aplicável (Etapa 7);
- procedimento de resposta a incidente de segurança (Etapa 7).

Até que esses itens existam, o sistema **não** está apto a operar com dados
reais de contribuintes.
