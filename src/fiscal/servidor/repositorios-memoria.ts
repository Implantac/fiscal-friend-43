/**
 * REPOSITÓRIOS EM MEMÓRIA — usuários e sessões.
 *
 * ⚠️ USO EXCLUSIVO DE DESENVOLVIMENTO E TESTE.
 * Dados vivem só no processo: reiniciar o servidor apaga tudo. Nenhum caminho
 * de produção deve usar estes repositórios (ver `eslint.config.js`: módulos
 * server-only). A implementação real é Postgres — ver `docs/banco-de-dados.md`.
 */

import type { Papel } from "@/fiscal/seguranca";
import type {
  RepositorioSessoes,
  RepositorioUsuarios,
  SessaoInterna,
  UsuarioInterno,
} from "./portas-servidor";

export class UsuariosMemoria implements RepositorioUsuarios {
  private readonly itens = new Map<string, UsuarioInterno>();

  async criar(u: UsuarioInterno): Promise<void> {
    if (this.itens.has(u.id)) throw new Error(`usuário já existe: ${u.id}`);
    this.itens.set(u.id, u);
  }

  async buscarPorEmail(tenantId: string, email: string): Promise<UsuarioInterno | undefined> {
    for (const u of this.itens.values()) {
      if (u.tenantId === tenantId && u.email.toLowerCase() === email.toLowerCase()) return u;
    }
    return undefined;
  }

  async buscarPorId(tenantId: string, id: string): Promise<UsuarioInterno | undefined> {
    const u = this.itens.get(id);
    return u && u.tenantId === tenantId ? u : undefined;
  }

  async registrarFalhaLogin(
    usuarioId: string,
    falhas: number,
    bloqueadoAte: string | null,
  ): Promise<void> {
    const u = this.itens.get(usuarioId);
    if (!u) return;
    u.falhasLogin = falhas;
    u.bloqueadoAte = bloqueadoAte;
  }

  async registrarSucessoLogin(usuarioId: string): Promise<void> {
    const u = this.itens.get(usuarioId);
    if (!u) return;
    u.falhasLogin = 0;
    u.bloqueadoAte = null;
  }
}

export class SessoesMemoria implements RepositorioSessoes {
  private readonly itens = new Map<string, SessaoInterna & { tokenHash: string }>();

  async criar(s: {
    id: string;
    tenantId: string;
    usuarioId: string;
    papel: Papel;
    tokenHash: string;
    expiraEm: string;
    ip?: string | undefined;
    agente?: string | undefined;
  }): Promise<void> {
    this.itens.set(s.id, { ...s, revogadaEm: null });
  }

  async buscarPorTokenHash(tokenHash: string): Promise<SessaoInterna | undefined> {
    for (const s of this.itens.values()) if (s.tokenHash === tokenHash) return { ...s };
    return undefined;
  }

  async revogar(sessaoId: string): Promise<void> {
    const s = this.itens.get(sessaoId);
    if (s && !s.revogadaEm) s.revogadaEm = new Date().toISOString();
  }

  async revogarTodasDoUsuario(usuarioId: string): Promise<void> {
    const agora = new Date().toISOString();
    for (const s of this.itens.values()) {
      if (s.usuarioId === usuarioId && !s.revogadaEm) s.revogadaEm = agora;
    }
  }
}
