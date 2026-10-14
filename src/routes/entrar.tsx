import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { LogIn, LogOut, ShieldAlert } from "lucide-react";
import { PageHeader } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { encerrarSessao, iniciarSessao, sessaoAtual } from "@/fiscal/servidor/sessao.functions";
import type { ContextoUsuario } from "@/fiscal/seguranca";

export const Route = createFileRoute("/entrar")({
  head: () => ({
    meta: [
      { title: "Entrar — Simulador Fiscal" },
      {
        name: "description",
        content:
          "Autenticação da camada de servidor: sessão com token opaco em cookie HttpOnly, hash de senha PBKDF2 e bloqueio progressivo.",
      },
      { property: "og:title", content: "Entrar — Simulador Fiscal" },
      {
        property: "og:description",
        content: "Camada HTTP de autenticação do fiscal-friend.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: EntrarPage,
});

type Usuario = { id: string; tenantId: string; email: string; papel: string };

function EntrarPage() {
  const entrar = useServerFn(iniciarSessao);
  const sair = useServerFn(encerrarSessao);
  const consultar = useServerFn(sessaoAtual);

  const [tenantId, setTenantId] = useState("tenant-dev");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [contexto, setContexto] = useState<ContextoUsuario | null>(null);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setCarregando(true);
    setErro(null);
    try {
      const r = await entrar({ data: { tenantId, email, senha } });
      if (!r.ok) {
        // Erro honesto: a mensagem vem do servidor e nunca esconde a falha.
        setErro(r.erro);
        return;
      }
      setUsuario(r.dados.usuario);
      const atual = await consultar({});
      setContexto(atual.autenticado ? atual.contexto : null);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha inesperada ao entrar.");
    } finally {
      setCarregando(false);
    }
  }

  async function sairDaSessao() {
    setCarregando(true);
    setErro(null);
    try {
      await sair({});
      setUsuario(null);
      setContexto(null);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha inesperada ao sair.");
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        titulo="Entrar"
        descricao="Camada HTTP de autenticação: token opaco em cookie HttpOnly, senha com PBKDF2-SHA256 e bloqueio progressivo após falhas consecutivas."
      />

      {usuario ? (
        <div className="space-y-4">
          <Alert>
            <LogIn className="size-4" aria-hidden />
            <AlertTitle>Sessão iniciada</AlertTitle>
            <AlertDescription>
              {usuario.email} · tenant {usuario.tenantId} · papel {usuario.papel}
              {contexto ? ` · usuário ${contexto.usuarioId}` : ""}
            </AlertDescription>
          </Alert>

          <Alert variant="destructive">
            <ShieldAlert className="size-4" aria-hidden />
            <AlertTitle>O que esta sessão não faz</AlertTitle>
            <AlertDescription>
              <p>
                Autenticar não é autorizar documento fiscal. Nenhuma resposta HTTP 200 desta tela
                significa que um documento foi autorizado pelo SEFAZ — autorização fiscal é retorno
                do órgão, com protocolo próprio, e só existe depois de transmissão real.
              </p>
              <p className="mt-2">
                A persistência desta sessão está <strong>em memória do processo</strong> enquanto o
                banco não for provisionado: reiniciar o servidor derruba todas as sessões. As rotas
                de documento (NF-e, CT-e, MDF-e…) ainda não passam por esta autenticação.
              </p>
            </AlertDescription>
          </Alert>

          <div className="flex gap-2">
            <Button variant="outline" onClick={sairDaSessao} disabled={carregando}>
              <LogOut className="size-4" aria-hidden /> Encerrar sessão
            </Button>
            <Button variant="ghost" asChild>
              <Link to="/">Voltar ao início</Link>
            </Button>
          </div>
        </div>
      ) : (
        <form onSubmit={enviar} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="tenant">Tenant</Label>
            <Input
              id="tenant"
              value={tenantId}
              onChange={(e) => setTenantId(e.target.value)}
              autoComplete="organization"
              required
            />
            <p className="text-xs text-muted-foreground">
              Identificador da conta. O mesmo e-mail pode existir em tenants diferentes — o tenant
              faz parte da credencial.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="senha">Senha</Label>
            <Input
              id="senha"
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              autoComplete="current-password"
              minLength={8}
              required
            />
            <p className="text-xs text-muted-foreground">Mínimo de 8 caracteres.</p>
          </div>

          {erro ? (
            <Alert variant="destructive">
              <ShieldAlert className="size-4" aria-hidden />
              <AlertTitle>Não foi possível entrar</AlertTitle>
              <AlertDescription>{erro}</AlertDescription>
            </Alert>
          ) : null}

          <Button type="submit" disabled={carregando}>
            <LogIn className="size-4" aria-hidden /> Entrar
          </Button>

          <p className="text-xs text-muted-foreground">
            Em falha de credencial a resposta é sempre a mesma — o sistema não informa se o e-mail
            existe. Após 5 falhas consecutivas a conta é bloqueada por 15 minutos.
          </p>
        </form>
      )}
    </div>
  );
}
