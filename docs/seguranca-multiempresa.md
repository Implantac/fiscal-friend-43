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

## 5. Autenticação e sessão (Etapa 2.6)

| Decisão | Implementação | Motivo |
|---|---|---|
| Transporto da credencial | cookie **HttpOnly**, `SameSite=Lax`, `Secure` em produção, `Path=/`, `Max-Age` 60 min | token fora do alcance de JavaScript: um XSS não exfilta a sessão |
| Formato do token | 32 bytes aleatórios, opaco, nunca derivado de dado do usuário | nada a adivinhar; rotação = novo registro |
| O que o banco guarda | apenas o **hash SHA-256** do token | vazamento do banco não produz sessões utilizáveis |
| Senha | PBKDF2-SHA256, 210.000 iterações, salt por senha, verificação em tempo constante | atrasa força bruta; evita timing attack |
| Resposta a falha | sempre `"E-mail ou senha inválidos."`, com atraso uniforme | não revela se o e-mail existe |
| Abuso | bloqueio progressivo: 5 falhas → 15 min | força bruta |
| Tenant | faz parte da credencial e vem da sessão | o tenant não é parâmetro livre do request |

**O que a sessão não faz.** Autenticar prova *quem* é o usuário. Autorizar uso
de documento fiscal é decisão do SEFAZ, com protocolo próprio, e nenhuma
resposta HTTP 200 da camada de sessão — ou de qualquer outra deste sistema —
significa autorização fiscal.

**Auditoria.** `sessao.iniciada`, `sessao.encerrada` e `sessao.falha` são
eventos de trilha. Falhar em registrar um login bem-sucedido **falha o login**
(fail closed): um login sem rastro é pior que um login negado. A tentativa falha
é registrada sem e-mail — dado pessoal só entra na trilha quando estritamente
necessário.

**Persistência.** `FISCAL_PERSISTENCIA=memoria` (padrão) usa repositório em
memória do processo e é **recusado em produção**: `obterDependencias()` lança em
vez de fingir que existe banco. `FISCAL_PERSISTENCIA=postgres` exige
`DATABASE_URL` e o driver — ainda não provisionados.

**Bundle do cliente.** O plugin `import-protection` do framework nega
`@tanstack/react-start/server` no cliente. O acesso a cookie/request vive em
`http-cookies.ts`, carregado por `import()` dinâmico dentro dos `handler()`.
Verificado no artefato de build: `.output/public/assets` não contém PBKDF2, o
nome do cookie, o driver `pg` nem a lógica de sessão.

### Persistência no Lovable Cloud

O projeto roda no Lovable Cloud, cujo backend é Supabase. A conexão é feita como
o role `postgres` — **nunca** como `service_role`, que tem `BYPASSRLS` e anularia
por completo o isolamento por tenant. Com `FORCE ROW LEVEL SECURITY` no migration,
até o dono da tabela obedece à política.

`sessoes` tem uma exceção deliberada: a leitura é permitida sem contexto de tenant
porque o token de sessão é a credencial e o tenant só se revela depois da
consulta. A escrita exige contexto de tenant. O raciocínio e as compensações
estão comentados no migration; a política é verificada estaticamente por teste
(pg-mem não implementa RLS).

## 6. O que ainda não está implementado

- MFA e rate limiting por IP (hoje o bloqueio é por conta);
- ligação das rotas de documento (NF-e, CT-e, MDF-e…) a `exigirContexto()`;
- criptografia em trânsito (TLS) e em repouso (Etapa 7 — decisão de hospedagem);
- criptografia em trânsito (TLS) e em repouso (Etapa 7 — decisão de hospedagem);
- política de retenção e descarte conforme a legislação aplicável (Etapa 7);
- procedimento de resposta a incidente de segurança (Etapa 7).

Até que esses itens existam, o sistema **não** está apto a operar com dados
reais de contribuintes.
