import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/layout/AppShell";
import { Checkbox } from "@/components/ui/checkbox";
import { StatusBadge } from "@/components/knowledge/StatusBadge";
import { cstats } from "@/knowledge/cstats";
import { regraById } from "@/knowledge/regras";
import { campoById } from "@/knowledge/campos";
import { documentoById } from "@/knowledge/documentos";

export const Route = createFileRoute("/suporte")({
  head: () => ({
    meta: [
      { title: "Modo suporte — Simulador Fiscal" },
      { name: "description", content: "Do problema relatado pelo cliente ao diagnóstico: documento, rejeição, XML, regra, correção, teste e checklist do analista." },
      { property: "og:title", content: "Modo suporte — Simulador Fiscal" },
      { property: "og:description", content: "Roteiro guiado de atendimento fiscal com checklist." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SuportePage,
});

function SuportePage() {
  const [relato, setRelato] = useState("");
  const [codigo, setCodigo] = useState("");
  const [feitos, setFeitos] = useState<Record<string, boolean>>({});
  const termos = relato.toLowerCase().split(/\s+/).filter((t) => t.length > 3);
  const sugestoes = termos.length
    ? cstats.filter((c) => termos.some((t) => `${c.situacao} ${c.causaProvavel} ${c.campos.join(" ")}`.toLowerCase().includes(t)))
    : [];
  const c = cstats.find((x) => x.codigo === codigo);

  return (
    <div className="space-y-5">
      <PageHeader
        titulo="Modo suporte"
        descricao="Problema informado → classificação → documento → rejeição → XML → regra → diagnóstico → correção → teste. Roteiro didático para o analista."
      />
      <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
        <div className="space-y-3">
          <label className="block space-y-1 text-sm">
            <span className="font-medium">1. O que o cliente relatou?</span>
            <textarea value={relato} onChange={(e) => setRelato(e.target.value)} rows={3}
              placeholder="Ex.: nota recusada, CFOP, pagamento, condutor…"
              className="w-full rounded-md border bg-background p-2 text-sm" />
          </label>
          <p className="text-sm font-medium">2. Classificação</p>
          <ul className="space-y-1">
            {(sugestoes.length ? sugestoes : cstats).map((x) => (
              <li key={x.codigo}>
                <button onClick={() => { setCodigo(x.codigo); setFeitos({}); }}
                  className={`w-full rounded-md border px-2 py-1.5 text-left text-xs hover:bg-accent ${codigo === x.codigo ? "border-primary bg-accent" : ""}`}>
                  <span className="font-semibold">{x.situacao}</span>
                  <span className="block text-muted-foreground">{documentoById.get(x.documento as never)?.sigla ?? "Geral"}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
        {!c ? (
          <p className="text-sm text-muted-foreground">Escolha uma classificação para abrir o roteiro.</p>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <h2 className="font-semibold">{c.situacao}</h2>
              <StatusBadge status={c.procedencia.status} />
            </div>
            <ol className="space-y-3 text-sm">
              <Passo n={3} t="Documento">{documentoById.get(c.documento as never)?.nome ?? "Vários documentos"}</Passo>
              <Passo n={4} t="Rejeição">
                <Link to="/cstat" search={{ codigo: c.codigo }} className="font-mono text-xs text-primary hover:underline">{c.codigo}</Link>
                {!c.descricaoOficial && <span className="ml-2 text-xs text-muted-foreground">Código oficial pendente de validação</span>}
              </Passo>
              {c.xmlProblema && <Passo n={5} t="XML a conferir"><pre className="overflow-x-auto rounded bg-muted p-2 font-mono text-[11px]">{c.xmlProblema}</pre></Passo>}
              <Passo n={6} t="Regra">
                <div className="flex flex-wrap gap-1">
                  {c.regras.map((r) => <Link key={r} to="/debugger" search={{ regra: r }} className="rounded border px-1.5 font-mono text-[11px] hover:bg-accent">{regraById.get(r)?.titulo ?? r}</Link>)}
                </div>
              </Passo>
              <Passo n={7} t="Diagnóstico">{c.causaProvavel}</Passo>
              <Passo n={8} t="Correção">{c.correcao}</Passo>
              <Passo n={9} t="Campos envolvidos">
                <div className="flex flex-wrap gap-1">
                  {c.campos.map((f) => { const cf = campoById.get(f); return cf ? <Link key={f} to="/conhecimento" search={{ doc: cf.documento, campo: f }} className="rounded border px-1.5 font-mono text-[11px] hover:bg-accent">{cf.tagXml}</Link> : <span key={f} className="font-mono text-[11px]">{f}</span>; })}
                </div>
              </Passo>
              <Passo n={10} t="Teste"><Link to="/regressao" className="text-primary hover:underline">Conferir casos na regressão fiscal</Link></Passo>
            </ol>
            <div className="rounded-lg border p-3">
              <p className="mb-2 text-sm font-semibold">Checklist do analista</p>
              <ul className="space-y-1.5">
                {c.checklistSuporte.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm">
                    <Checkbox id={item} checked={!!feitos[item]} onCheckedChange={(v) => setFeitos((f) => ({ ...f, [item]: v === true }))} />
                    <label htmlFor={item} className={feitos[item] ? "text-muted-foreground line-through" : ""}>{item}</label>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Passo({ n, t, children }: { n: number; t: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="font-mono text-xs text-muted-foreground">{String(n).padStart(2, "0")}</span>
      <div className="min-w-0 flex-1"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t}</p><div>{children}</div></div>
    </li>
  );
}
