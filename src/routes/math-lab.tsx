import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/layout/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { StatusBadge, ProcedenciaNota, EtiquetaDidatica } from "@/components/knowledge/StatusBadge";
import { XmlViewer } from "@/components/knowledge/XmlViewer";
import { calculos } from "@/knowledge/calculos";
import { brl, num } from "@/lib/format";

export const Route = createFileRoute("/math-lab")({
  validateSearch: (s: Record<string, unknown>) => ({
    calc: typeof s["calc"] === "string" ? s["calc"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Laboratório de cálculos fiscais — Fiscal Friend" },
      {
        name: "description",
        content:
          "Fórmula, variáveis, valores, resultado e XML de cada cálculo fiscal, em exemplos didáticos determinísticos.",
      },
      { property: "og:title", content: "Laboratório de cálculos fiscais — Fiscal Friend" },
      { property: "og:description", content: "Fórmula → variáveis → valores → resultado → XML." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MathLab,
});

function MathLab() {
  const { calc } = Route.useSearch();
  const [sel, setSel] = useState(calc ?? calculos[0]!.id);
  const atual = calculos.find((c) => c.id === sel) ?? calculos[0]!;
  const [valores, setValores] = useState<Record<string, number>>(atual.padrao);

  const trocar = (id: string) => {
    const c = calculos.find((x) => x.id === id);
    if (!c) return;
    setSel(id);
    setValores(c.padrao);
  };

  const resultado = atual.calcular(valores);

  return (
    <div className="space-y-5">
      <PageHeader
        titulo="Laboratório de cálculos"
        descricao="Cada cálculo é determinístico e serve para ensinar a composição do valor. Os percentuais iniciais são parâmetros deste ambiente, não legislação."
        acoes={<EtiquetaDidatica />}
      />

      <div className="flex flex-wrap gap-1.5">
        {calculos.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => trocar(c.id)}
            className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
              c.id === atual.id ? "bg-primary text-primary-foreground" : "bg-surface hover:bg-accent"
            }`}
          >
            {c.nome}
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-base">{atual.nome}</CardTitle>
              <StatusBadge status={atual.procedencia.status} />
            </div>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div>
              <p className="text-[11px] font-semibold uppercase text-muted-foreground">Fórmula</p>
              <code className="mt-1 block rounded-md bg-muted p-2 font-mono text-xs">
                {atual.formula}
              </code>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {atual.variaveis.map((v) => (
                <div key={v.simbolo} className="space-y-1">
                  <Label className="text-xs" htmlFor={`v-${v.simbolo}`}>
                    {v.nome}
                  </Label>
                  <Input
                    id={`v-${v.simbolo}`}
                    type="number"
                    step="0.01"
                    value={String(valores[v.simbolo] ?? 0)}
                    onChange={(e) =>
                      setValores((p) => ({ ...p, [v.simbolo]: Number(e.target.value) }))
                    }
                  />
                  <p className="text-[11px] text-muted-foreground">{v.descricao}</p>
                </div>
              ))}
            </div>

            <Button variant="outline" size="sm" onClick={() => setValores(atual.padrao)}>
              Restaurar valores do exemplo
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Resultado</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="rounded-md border bg-auto-surface p-3">
              <p className="text-[11px] uppercase text-[var(--auto-foreground)]">
                Valor calculado (exemplo didático)
              </p>
              <p className="text-2xl font-semibold text-[var(--auto-foreground)]">
                {brl(resultado)}
              </p>
              <p className="text-xs text-[var(--auto-foreground)]">
                Valor numérico: {num(resultado)}
              </p>
            </div>

            <div>
              <p className="text-[11px] font-semibold uppercase text-muted-foreground">
                Substituição
              </p>
              <ul className="space-y-0.5 pt-1 font-mono text-xs">
                {atual.variaveis.map((v) => (
                  <li key={v.simbolo}>
                    {v.simbolo} = {num(valores[v.simbolo] ?? 0)}
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <p className="text-[11px] font-semibold uppercase text-muted-foreground">
                Arredondamento
              </p>
              <p>{atual.arredondamento}</p>
            </div>

            <div>
              <p className="text-[11px] font-semibold uppercase text-muted-foreground">XML</p>
              <XmlViewer xml={atual.xml} formatar={false} className="mt-1" />
            </div>

            <ProcedenciaNota p={atual.procedencia} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
