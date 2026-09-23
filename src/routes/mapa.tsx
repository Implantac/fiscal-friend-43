import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/layout/AppShell";

export const Route = createFileRoute("/mapa")({
  head: () => ({
    meta: [
      { title: "Mapa Fiscal — Simulador Fiscal" },
      { name: "description", content: "Visão clicável do caminho de um documento fiscal: operação, tributação, campos, cálculos, XML, validações e eventos." },
      { property: "og:title", content: "Mapa Fiscal — Simulador Fiscal" },
      { property: "og:description", content: "Do documento à autorização: cada etapa leva à área de estudo correspondente." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MapaPage,
});

const blocos = [
  { t: "Documento", d: "Qual modelo usar", to: "/conhecimento" },
  { t: "Operação", d: "Venda, devolução, remessa…", to: "/cenarios" },
  { t: "Tributação", d: "ICMS, IPI, PIS/COFINS, IBS/CBS", to: "/reforma" },
  { t: "Campos", d: "Grupo → campo → regra", to: "/conhecimento" },
  { t: "Cálculos", d: "Fórmula → resultado", to: "/math-lab" },
  { t: "XML", d: "Tag → campo", to: "/xml-lab" },
  { t: "Validações", d: "Regras executadas", to: "/debugger" },
  { t: "Autorização", d: "Transmissão simulada", to: "/nfe" },
  { t: "Eventos", d: "Manifestação e outros", to: "/" },
  { t: "Rejeições", d: "Causa e correção", to: "/cstat" },
] as const;

const cadeias = [
  { titulo: "Cadeia logística", itens: [["NF-e 55", "/nfe"], ["CT-e 57", "/cte"], ["MDF-e 58", "/mdfe"], ["Veículo e motorista", "/mdfe"], ["Encerramento", "/mdfe"]] },
  { titulo: "Ciclo da mercadoria", itens: [["NF-e de venda", "/nfe"], ["Devolução", "/cenarios"], ["Retorno", "/cenarios"], ["Transferência", "/cenarios"], ["Remessa", "/cenarios"], ["Manifestação", "/"]] },
] as const;

function MapaPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        titulo="Mapa Fiscal"
        descricao="O caminho de um documento fiscal, do início aos eventos. Clique em uma etapa para estudá-la. Conteúdo didático — Ambiente de Simulação."
      />
      <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        {blocos.map((b, i) => (
          <li key={b.t}>
            <Link to={b.to} className="block h-full rounded-lg border bg-surface p-3 transition-colors hover:border-primary">
              <span className="font-mono text-[11px] text-muted-foreground">{String(i + 1).padStart(2, "0")}</span>
              <p className="font-semibold">{b.t}</p>
              <p className="text-xs text-muted-foreground">{b.d}</p>
            </Link>
          </li>
        ))}
      </ol>
      {cadeias.map((c) => (
        <section key={c.titulo} className="space-y-2">
          <h2 className="text-sm font-semibold">{c.titulo}</h2>
          <div className="flex flex-wrap items-center gap-2">
            {c.itens.map(([t, to], i) => (
              <span key={t} className="flex items-center gap-2">
                <Link to={to} className="rounded-md border px-3 py-1.5 text-sm hover:bg-accent">{t}</Link>
                {i < c.itens.length - 1 && <span className="text-muted-foreground">→</span>}
              </span>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
