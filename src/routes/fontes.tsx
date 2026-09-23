import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/layout/AppShell";
import { fontes } from "@/knowledge/fontes";

export const Route = createFileRoute("/fontes")({
  head: () => ({
    meta: [
      { title: "Fontes fiscais — Simulador Fiscal" },
      { name: "description", content: "Categorias de fontes usadas pela base de conhecimento fiscal e o estado de cadastro de cada uma." },
      { property: "og:title", content: "Fontes fiscais — Simulador Fiscal" },
      { property: "og:description", content: "Manuais, notas técnicas, legislação e documentação de provedores referenciados." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: FontesPage,
});

function FontesPage() {
  const categorias = [...new Set(fontes.map((f) => f.categoria))];
  return (
    <div className="space-y-5">
      <PageHeader
        titulo="Fontes"
        descricao="De onde vem cada informação. Nenhum link foi inventado: sem referência conferida, a fonte aparece como não cadastrada."
      />
      {categorias.map((c) => (
        <section key={c} className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{c}</h2>
          <ul className="grid gap-2 md:grid-cols-2">
            {fontes.filter((f) => f.categoria === c).map((f) => (
              <li key={f.id} className="rounded-lg border bg-surface p-3 text-sm">
                <p className="font-semibold">{f.nome}</p>
                <p className="text-xs text-muted-foreground">
                  {f.referencia ?? "Fonte oficial ainda não cadastrada."}
                </p>
                {f.observacao && <p className="mt-1 text-xs">{f.observacao}</p>}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
