import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, X } from "lucide-react";
import { PageHeader } from "@/components/layout/AppShell";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { completude, detectarLacunas, indicadores } from "@/knowledge/qualidade";
import { coberturaFichas } from "@/knowledge/rastreabilidade";
import { executarTestes } from "@/knowledge/testes";

export const Route = createFileRoute("/qualidade")({
  head: () => ({
    meta: [
      { title: "Qualidade do conhecimento — Simulador Fiscal" },
      { name: "description", content: "Indicadores reais da base fiscal, lacunas detectadas automaticamente e checklist de completude por campo e regra." },
      { property: "og:title", content: "Qualidade do conhecimento — Simulador Fiscal" },
      { property: "og:description", content: "O que está validado, o que falta fonte, teste, versão ou vigência." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: QualidadePage,
});

function QualidadePage() {
  const ind = indicadores();
  const exec = executarTestes();
  const lacunas = useMemo(() => detectarLacunas(), []);
  const comp = useMemo(() => completude(), []);
  const fichas = useMemo(() => coberturaFichas(), []);
  const tipos = [...new Set(lacunas.map((l) => l.tipo))];
  const [tipo, setTipo] = useState("");

  const cards: [string, number][] = [
    ["Documentos", ind.documentos], ["Campos", ind.campos], ["Regras", ind.regras], ["Cálculos", ind.calculos],
    ["Rejeições com código oficial", ind.cstatsOficiais], ["Rejeições didáticas", ind.cstatsDidaticos],
    ["Cenários", ind.cenarios], ["Casos de teste", ind.testes],
    ["Testes aprovados", exec.filter((e) => e.resultado === "aprovado").length],
    ["Testes com falha", exec.filter((e) => e.resultado !== "aprovado").length],
    ["Conteúdos validados", ind.validados], ["Conteúdos ilustrativos", ind.ilustrativos],
    ["Conteúdos pendentes", ind.pendentes], ["Conteúdos obsoletos", ind.obsoletos], ["Fontes cadastradas", ind.fontes],
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        titulo="Qualidade do conhecimento"
        descricao="Todos os números são contados a partir da base existente. Nada é estimado."
      />
      <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
        {cards.map(([t, n]) => (
          <div key={t} className="rounded-lg border bg-surface p-3">
            <p className="text-[11px] text-muted-foreground">{t}</p>
            <p className="font-mono text-xl font-semibold">{n}</p>
          </div>
        ))}
      </div>
      <Tabs defaultValue="lacunas">
        <TabsList>
          <TabsTrigger value="lacunas">Lacunas ({lacunas.length})</TabsTrigger>
          <TabsTrigger value="completude">Completude por item</TabsTrigger>
          <TabsTrigger value="rastreabilidade">Rastreabilidade</TabsTrigger>
        </TabsList>
        <TabsContent value="lacunas" className="space-y-3 pt-3">
          <div className="flex flex-wrap gap-1">
            <button onClick={() => setTipo("")} className={`rounded-full border px-2 py-0.5 text-xs ${!tipo ? "bg-accent" : ""}`}>Todas</button>
            {tipos.map((t) => (
              <button key={t} onClick={() => setTipo(t)} className={`rounded-full border px-2 py-0.5 text-xs ${tipo === t ? "bg-accent" : ""}`}>
                {t} ({lacunas.filter((l) => l.tipo === t).length})
              </button>
            ))}
          </div>
          <ul className="divide-y rounded-lg border">
            {lacunas.filter((l) => !tipo || l.tipo === tipo).map((l, i) => (
              <li key={i} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                <span className="text-muted-foreground">{l.tipo}</span>
                <Link to={l.destino.to} search={(l.destino.search ?? {}) as never} className="font-mono text-xs text-primary hover:underline">{l.item}</Link>
              </li>
            ))}
          </ul>
        </TabsContent>
        <TabsContent value="completude" className="pt-3">
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-xs">
              <tbody>
                {comp.map((c) => (
                  <tr key={c.id} className="border-b last:border-0">
                    <td className="px-3 py-1.5 text-muted-foreground">{c.tipo}</td>
                    <td className="px-3 py-1.5 font-mono">{c.id}</td>
                    {c.itens.map((i) => (
                      <td key={i.rotulo} className="px-2 py-1.5">
                        <span className="inline-flex items-center gap-1">
                          {i.ok ? <Check className="size-3 text-validated" /> : <X className="size-3 text-destructive" />}
                          {i.rotulo}
                        </span>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>
        <TabsContent value="rastreabilidade" className="space-y-2 pt-3">
          <p className="text-sm text-muted-foreground">
            Cada item deve responder: de onde veio, versão/vigência, campos afetados, XML, erro evitado, teste e implementação no ERP.
            Respondem tudo: {fichas.filter((f) => f.respondidas === f.total).length} de {fichas.length}.
          </p>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-xs">
              <tbody>
                {fichas.map((f) => (
                  <tr key={f.id} className="border-b last:border-0">
                    <td className="px-3 py-1.5 text-muted-foreground">{f.tipo}</td>
                    <td className="px-3 py-1.5 font-mono">{f.id}</td>
                    <td className="px-3 py-1.5">{f.respondidas}/{f.total}</td>
                    <td className="px-3 py-1.5 text-muted-foreground">{f.ficha.filter((x) => !x.ok).map((x) => x.pergunta).join(" · ") || "Completo"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
