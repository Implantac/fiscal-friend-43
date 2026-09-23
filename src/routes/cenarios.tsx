import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/layout/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge, ProcedenciaNota } from "@/components/knowledge/StatusBadge";
import { XmlViewer } from "@/components/knowledge/XmlViewer";
import { cenarios } from "@/knowledge/cenarios";
import { campoById } from "@/knowledge/campos";
import { cstatByCodigo } from "@/knowledge/cstats";

export const Route = createFileRoute("/cenarios")({
  validateSearch: (s: Record<string, unknown>) => ({
    id: typeof s["id"] === "string" ? s["id"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Cenários fiscais passo a passo — Fiscal Friend" },
      {
        name: "description",
        content:
          "Cenários completos de operação: participantes, regime, tributação, cálculos, campos, XML, validações e rejeições possíveis.",
      },
      { property: "og:title", content: "Cenários fiscais passo a passo — Fiscal Friend" },
      {
        property: "og:description",
        content: "Da escolha da operação ao XML autorizado, com os erros possíveis no caminho.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CenariosPage,
});

function CenariosPage() {
  const { id } = Route.useSearch();
  const [sel, setSel] = useState(id ?? cenarios[0]!.id);
  const c = cenarios.find((x) => x.id === sel) ?? cenarios[0]!;

  return (
    <div className="space-y-5">
      <PageHeader
        titulo="Cenários fiscais"
        descricao="Cada cenário percorre a operação inteira: cadastro, escolha do CFOP, tributação, cálculo, XML, validação e as recusas mais prováveis."
      />

      <div className="flex flex-wrap gap-1.5">
        {cenarios.map((x) => (
          <button
            key={x.id}
            type="button"
            onClick={() => setSel(x.id)}
            className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
              x.id === c.id ? "bg-primary text-primary-foreground" : "bg-surface hover:bg-accent"
            }`}
          >
            {x.nome}
          </button>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-base">{c.nome}</CardTitle>
            <StatusBadge status={c.procedencia.status} />
          </div>
        </CardHeader>
        <CardContent className="space-y-5 text-sm">
          <p>{c.objetivo}</p>

          <div className="grid gap-2 sm:grid-cols-3">
            {[
              ["Participantes", c.participantes],
              ["Operação", c.operacao],
              ["Regime", c.regime],
              ["Origem", c.origem],
              ["Destino", c.destino],
              ["Consumidor", c.consumidor],
            ].map(([k, v]) => (
              <div key={k} className="rounded-md border p-2">
                <p className="text-[11px] uppercase text-muted-foreground">{k}</p>
                <p>{v}</p>
              </div>
            ))}
          </div>

          <div>
            <p className="text-[11px] font-semibold uppercase text-muted-foreground">Tributação</p>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {c.tributacao.map((t) => (
                <Badge key={t} variant="secondary">
                  {t}
                </Badge>
              ))}
            </div>
          </div>

          <div>
            <p className="text-[11px] font-semibold uppercase text-muted-foreground">Passo a passo</p>
            <ol className="space-y-1.5 pt-2">
              {c.passos.map((p, i) => (
                <li key={p} className="flex gap-2">
                  <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-secondary text-[11px] font-semibold">
                    {i + 1}
                  </span>
                  <span>{p}</span>
                </li>
              ))}
            </ol>
          </div>

          <div>
            <p className="text-[11px] font-semibold uppercase text-muted-foreground">
              Campos determinantes
            </p>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {c.campos.map((cid) => {
                const campo = campoById.get(cid);
                if (!campo) return null;
                return (
                  <Link
                    key={cid}
                    to="/conhecimento"
                    search={{ doc: campo.documento, campo: campo.id }}
                    className="rounded-md border px-2 py-0.5 font-mono text-xs hover:bg-accent"
                  >
                    {campo.tagXml}
                  </Link>
                );
              })}
            </div>
          </div>

          <div>
            <p className="text-[11px] font-semibold uppercase text-muted-foreground">XML</p>
            <XmlViewer xml={c.xml} className="mt-1" />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <p className="text-[11px] font-semibold uppercase text-muted-foreground">Validações</p>
              <ul className="list-disc space-y-1 pl-4 pt-1">
                {c.validacoes.map((v) => (
                  <li key={v}>{v}</li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase text-muted-foreground">
                Rejeições possíveis
              </p>
              <ul className="space-y-1 pt-1">
                {c.possiveisRejeicoes.map((r) => (
                  <li key={r}>
                    <Link
                      to="/cstat"
                      search={{ codigo: r }}
                      className="text-xs text-primary hover:underline"
                    >
                      {cstatByCodigo.get(r)?.situacao ?? r}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div>
            <p className="text-[11px] font-semibold uppercase text-muted-foreground">Solução</p>
            <p>{c.solucao}</p>
          </div>

          <ProcedenciaNota p={c.procedencia} />
        </CardContent>
      </Card>
    </div>
  );
}
