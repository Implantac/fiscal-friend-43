import { Link, createFileRoute } from "@tanstack/react-router";
import { ArrowRight, CircleDashed, FileStack, FlaskConical, Layers } from "lucide-react";

import { PageHeader } from "@/components/layout/AppShell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  matrizCobertura,
  nivelDescricao,
  nivelLabel,
  resumoCobertura,
  MODELOS_PENDENTES,
  type NivelCapacidade,
} from "@/knowledge/cobertura";

export const Route = createFileRoute("/cobertura")({
  head: () => ({
    meta: [
      { title: "Cobertura por modelo — Simulador Fiscal" },
      {
        name: "description",
        content:
          "O que cada modelo de documento faz de verdade hoje: estrutura real, tela de simulação ou apenas documentação. Nenhum documento é autorizado por serviço fiscal.",
      },
      { property: "og:title", content: "Cobertura por modelo — Simulador Fiscal" },
      {
        property: "og:description",
        content: "Estado real de cada modelo, capacidade por capacidade, sem promessa de produção.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CoberturaPage,
});

const corNivel: Record<NivelCapacidade, string> = {
  documentado: "bg-sim-surface text-sim-foreground",
  estrutural: "bg-[var(--auto-surface)] text-[var(--auto-foreground)]",
  simulado: "bg-accent text-accent-foreground",
};

function SeloNivel({ nivel }: { nivel: NivelCapacidade }) {
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${corNivel[nivel]}`}
    >
      {nivelLabel[nivel]}
    </span>
  );
}

function CoberturaPage() {
  const resumo = resumoCobertura();
  const modelos = matrizCobertura();

  return (
    <div className="space-y-5">
      <PageHeader
        titulo="Cobertura por modelo de documento"
        descricao="Cada capacidade declara o que é. Uma tela de simulação demonstra o fluxo e não emite documento válido; estrutura real tem código testado, mas nenhuma homologação. Nada aqui foi autorizado por serviço fiscal."
      />

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Resumo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex flex-wrap gap-3">
            <div className="flex items-center gap-2 rounded-md border px-3 py-2">
              <Layers className="size-4 text-muted-foreground" aria-hidden />
              <span className="font-medium">{resumo.estrutural}</span>
              <span className="text-muted-foreground">capacidades com estrutura real</span>
            </div>
            <div className="flex items-center gap-2 rounded-md border px-3 py-2">
              <FlaskConical className="size-4 text-muted-foreground" aria-hidden />
              <span className="font-medium">{resumo.simulado}</span>
              <span className="text-muted-foreground">capacidades apenas simuladas</span>
            </div>
            <div className="flex items-center gap-2 rounded-md border px-3 py-2">
              <CircleDashed className="size-4 text-muted-foreground" aria-hidden />
              <span className="font-medium">{resumo.documentado}</span>
              <span className="text-muted-foreground">capacidades só documentadas</span>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            O total de capacidades é a soma das três fichas acima. Ele não mede prontidão: mede o
            que existe no repositório hoje.
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-5 xl:grid-cols-2">
        {modelos.map((m) => (
          <Card key={m.documentoId}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-3">
                <CardTitle className="text-base">
                  {m.sigla}
                  {m.modelo ? ` · modelo ${m.modelo}` : ""}
                  <span className="block text-xs font-normal text-muted-foreground">{m.nome}</span>
                </CardTitle>
                {m.rotaSimulacao ? (
                  <Link
                    to={m.rotaSimulacao}
                    className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-primary hover:underline"
                  >
                    Abrir simulação <ArrowRight className="size-3" aria-hidden />
                  </Link>
                ) : null}
              </div>
            </CardHeader>
            <CardContent className="space-y-2.5 text-sm">
              {m.capacidades.map((c) => (
                <div key={c.area} className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium">{c.area}</p>
                    <p className="text-xs text-muted-foreground">{c.realidade}</p>
                  </div>
                  <SeloNivel nivel={c.nivel} />
                </div>
              ))}

              {m.pendencias.length > 0 ? (
                <>
                  <Separator />
                  <div className="space-y-1">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Pendente
                    </p>
                    <ul className="space-y-0.5 text-xs text-muted-foreground">
                      {m.pendencias.map((p) => (
                        <li key={p}>· {p}</li>
                      ))}
                    </ul>
                  </div>
                </>
              ) : null}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <FileStack className="size-4" aria-hidden />
            Modelos previstos e ainda não construídos
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {MODELOS_PENDENTES.map((m) => (
            <div key={m.sigla} className="flex items-start justify-between gap-3">
              <div>
                <p className="font-medium">
                  {m.sigla} — {m.nome}
                </p>
                <p className="text-xs text-muted-foreground">{m.motivo}</p>
              </div>
              <Badge variant="outline">Sem tela</Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
