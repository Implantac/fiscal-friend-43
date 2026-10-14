/**
 * REPOSITÓRIOS POSTGRES — usuários e sessões.
 *
 * Implementação real das portas `RepositorioUsuarios`/`RepositorioSessoes`
 * contra as tabelas `usuarios` e `sessoes` de `db/migrations/001_fundacao.sql`.
 *
 * Regras desta camada (idênticas às de `persistencia-postgres.ts`):
 *   1. Nenhum valor externo é interpolado no SQL — tudo via parâmetro vinculado.
 *   2. Toda ESCRITA passa por `emTransacao(tenantId, …)`, que fixa
 *      `app.tenant_id` para a duração da transação. Sem isso a política de RLS
 *      (`FORCE ROW LEVEL SECURITY`) barraria a escrita com zero linhas afetadas —
 *      uma falha silenciosa, o pior tipo de falha em sistema fiscal.
 *   3. A senha nunca é lida de volta em texto plano: só o hash serializado.
 *
 * AINDA NÃO EXECUTADO CONTRA UM POSTGRES REAL. A conexão
 * (`conexao-postgres.ts`) existe, mas nenhuma instância foi provisionada neste
 * ambiente. O que está provado aqui é a ausência de interpolação (teste
 * automatizado) e o mapeamento coluna↔domínio.
 */

import { desserializarSenhaHash, serializarSenhaHash } from "@/fiscal/autenticacao";
import type { SqlExecutor } from "@/fiscal/persistencia-postgres";
import type {
  RepositorioSessoes,
  RepositorioUsuarios,
  SessaoInterna,
  UsuarioInterno,
} from "./portas-servidor";

interface LinhaUsuario {
  id: string;
  tenant_id: string;
  email: string;
  hash_senha: string;
  nome: string | null;
  papel: UsuarioInterno["papel"];
  ativo: boolean;
  falhas_login: number;
  bloqueado_ate: string | null;
}

interface LinhaSessao {
  id: string;
  tenant_id: string;
  usuario_id: string;
  papel: UsuarioInterno["papel"];
  expira_em: string;
  revogada_em: string | null;
}

function paraUsuario(l: LinhaUsuario): UsuarioInterno {
  return {
    id: l.id,
    tenantId: l.tenant_id,
    email: l.email,
    // Formato inválido ou algoritmo desconhecido lança aqui — não "passa" silenciosamente.
    hashSenha: desserializarSenhaHash(l.hash_senha),
    papel: l.papel,
    ativo: l.ativo,
    falhasLogin: l.falhas_login,
    bloqueadoAte: l.bloqueado_ate,
  };
}

function paraSessao(l: LinhaSessao): SessaoInterna {
  return {
    id: l.id,
    tenantId: l.tenant_id,
    usuarioId: l.usuario_id,
    papel: l.papel,
    expiraEm: l.expira_em,
    revogadaEm: l.revogada_em,
  };
}

const SQL_USUARIO = `SELECT id, tenant_id, email, hash_senha, nome, papel, ativo, falhas_login, bloqueado_ate
  FROM usuarios`;

export class UsuariosPostgres implements RepositorioUsuarios {
  constructor(private readonly db: SqlExecutor) {}

  async criar(u: UsuarioInterno): Promise<void> {
    await this.db.emTransacao(u.tenantId, (tx) =>
      tx.query(
        `INSERT INTO usuarios
           (id, tenant_id, email, hash_senha, papel, ativo, falhas_login, bloqueado_ate)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          u.id,
          u.tenantId,
          u.email.toLowerCase(),
          serializarSenhaHash(u.hashSenha),
          u.papel,
          u.ativo,
          u.falhasLogin,
          u.bloqueadoAte,
        ],
      ),
    );
  }

  async buscarPorEmail(tenantId: string, email: string): Promise<UsuarioInterno | undefined> {
    const linhas = await this.db.query<LinhaUsuario>(
      `${SQL_USUARIO} WHERE tenant_id = $1 AND lower(email) = lower($2)`,
      [tenantId, email],
    );
    const l = linhas[0];
    return l ? paraUsuario(l) : undefined;
  }

  async buscarPorId(tenantId: string, id: string): Promise<UsuarioInterno | undefined> {
    const linhas = await this.db.query<LinhaUsuario>(
      `${SQL_USUARIO} WHERE tenant_id = $1 AND id = $2`,
      [tenantId, id],
    );
    const l = linhas[0];
    return l ? paraUsuario(l) : undefined;
  }

  async registrarFalhaLogin(
    tenantId: string,
    usuarioId: string,
    falhas: number,
    bloqueadoAte: string | null,
  ): Promise<void> {
    await this.db.emTransacao(tenantId, (tx) =>
      tx.query(
        `UPDATE usuarios
            SET falhas_login = $3, bloqueado_ate = $4, atualizado_em = now()
          WHERE tenant_id = $1 AND id = $2`,
        [tenantId, usuarioId, falhas, bloqueadoAte],
      ),
    );
  }

  async registrarSucessoLogin(tenantId: string, usuarioId: string): Promise<void> {
    await this.db.emTransacao(tenantId, (tx) =>
      tx.query(
        `UPDATE usuarios
            SET falhas_login = 0, bloqueado_ate = NULL, atualizado_em = now()
          WHERE tenant_id = $1 AND id = $2`,
        [tenantId, usuarioId],
      ),
    );
  }
}

export class SessoesPostgres implements RepositorioSessoes {
  constructor(private readonly db: SqlExecutor) {}

  async criar(s: {
    id: string;
    tenantId: string;
    usuarioId: string;
    papel: UsuarioInterno["papel"];
    tokenHash: string;
    expiraEm: string;
    ip?: string | undefined;
    agente?: string | undefined;
  }): Promise<void> {
    await this.db.emTransacao(s.tenantId, (tx) =>
      tx.query(
        `INSERT INTO sessoes
           (id, tenant_id, usuario_id, token_hash, expira_em, ip, agente)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [s.id, s.tenantId, s.usuarioId, s.tokenHash, s.expiraEm, s.ip ?? null, s.agente ?? null],
      ),
    );
  }

  /**
   * Consulta pelo HASH do token, sem filtro de tenant — o hash é globalmente
   * único e é a própria credencial; o tenant vem da linha encontrada. É a única
   * leitura do sistema autorizada a rodar sem contexto de tenant (ver a política
   * `sessoes_leitura_token` no migration).
   */
  async buscarPorTokenHash(tokenHash: string): Promise<SessaoInterna | undefined> {
    const linhas = await this.db.query<LinhaSessao & { papel_usuario: string }>(
      `SELECT s.id, s.tenant_id, s.usuario_id, u.papel AS papel_usuario, s.expira_em, s.revogada_em
         FROM sessoes s
         JOIN usuarios u ON u.id = s.usuario_id
        WHERE s.token_hash = $1`,
      [tokenHash],
    );
    const l = linhas[0];
    if (!l) return undefined;
    return paraSessao({ ...l, papel: l.papel_usuario as UsuarioInterno["papel"] });
  }

  async revogar(tenantId: string, sessaoId: string): Promise<void> {
    // O tenant aparece no WHERE **e** em `app.tenant_id`: a RLS já filtra, mas
    // repetir o filtro no SQL torna a intenção legível e faz a consulta falhar
    // de forma explícita (zero linhas) se alguém mudar a política.
    await this.db.emTransacao(tenantId, (tx) =>
      tx.query(
        `UPDATE sessoes SET revogada_em = now()
          WHERE tenant_id = $1 AND id = $2 AND revogada_em IS NULL`,
        [tenantId, sessaoId],
      ),
    );
  }

  async revogarTodasDoUsuario(tenantId: string, usuarioId: string): Promise<void> {
    await this.db.emTransacao(tenantId, (tx) =>
      tx.query(
        `UPDATE sessoes SET revogada_em = now()
          WHERE tenant_id = $1 AND usuario_id = $2 AND revogada_em IS NULL`,
        [tenantId, usuarioId],
      ),
    );
  }
}
