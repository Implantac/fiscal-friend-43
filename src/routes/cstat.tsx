import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/layout/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { StatusBadge, ProcedenciaNota } from "@/components/knowledge/StatusBadge";
import { naturezaCstat } from "@/knowledge/oficial";
import { XmlViewer, XmlDiff } from "@/components/knowledge/XmlViewer";
import { cstats } from "@/knowledge/cstats";
import { campoById } from "@/knowledge/campos";
import { regraById } from "@/knowledge/regras";
import { documentoById } from "@/knowledge/documentos";

export const Route = createFileRoute("/cstat")({
  validateSearch: (s: Record<string, unknown>) => ({
    codigo: typeof s["codigo"] === "string" ? s["codigo"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Central de rejeições (CStat) — Fiscal Friend" },
      {
        name: "description",
        content:
          "Pesquise famílias de rejeição por descrição, documento ou campo e veja causa, regra violada, XML problemático, correção e checklist de suporte.",
      },
      { property: "og:title", content: "Central de rejeições (CStat) — Fiscal Friend" },
      {
        property: "og:description",
        content: "Rejeição → regra → campo → XML → correção → impacto no ERP.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CStatCenter,
});

function CStatCenter() {
  const { codigo } = Route.useSearch();
  const [busca, setBusca] = useState("");
  const [sel, setSel] = useState<string | undefined>(codigo ?? cstats[0]?.codigo);

  const lista = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return cstats;
    return cstats.filter((c) =>
      `${c.codigo} ${c.situacao} ${c.causaProvavel} ${c.documento} ${c.campos.join(" ")}`
        .toLowerCase()
        .includes(q),
    );
  }, [busca]);

  const atual = cstats.find((c) => c.codigo === sel);

  return (
    <div className="space-y-5">
      <PageHeader
        titulo="Central de rejeições"
        descricao="As famílias abaixo descrevem situações de recusa. Nenhum código oficial foi inventado: enquanto o número não for conferido em manual, a entrada fica como pendente de validação."
      />

      <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Pesquisar</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Código, descrição, documento ou campo"
            />
            <ul className="divide-y rounded-md border">
              {lista.map((c) => (
                <li key={c.codigo}>
                  <button
                    type="button"
                    onClick={() => setSel(c.codigo)}
                    className={`w-full px-3 py-2 text-left transition-colors hover:bg-accent/60 ${
                      sel === c.codigo ? "bg-accent" : ""
                    }`}
                  >
                    <span className="block text-sm font-medium">{c.situacao}</span>
                    <span className="block text-xs text-muted-foreground">
                      {documentoById.get(c.documento as never)?.sigla ?? "Geral"} ·{" "}
                      {c.descricaoOficial ?? "descrição oficial não cadastrada"}
                    </span>
                  </button>
                </li>
              ))}
              {lista.length === 0 && (
                <li className="px-3 py-2 text-sm text-muted-foreground">Nada encontrado.</li>
              )}
            </ul>
          </CardContent>
        </Card>

        {atual && (
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-base">{atual.situacao}</CardTitle>
                <StatusBadge status={atual.procedencia.status} />
                <span className={`rounded border px-1.5 py-0.5 text-[11px] font-semibold ${naturezaCstat(atual) === "oficial" ? "border-validated text-validated" : "border-illustrative text-illustrative"}`}>
                  {naturezaCstat(atual) === "oficial" ? "Código oficial" : "Identificador didático (não é código oficial)"}
                </span>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <Bloco titulo="Causa provável">{atual.causaProvavel}</Bloco>

              <Bloco titulo="Regras violadas">
                <ul className="space-y-1">
                  {atual.regras.map((r) => (
                    <li key={r}>
                      <Link
                        to="/debugger"
                        search={{ regra: r }}
                        className="font-mono text-xs text-primary hover:underline"
                      >
                        {r}
                      </Link>
                      <span className="ml-2 text-xs text-muted-foreground">
                        {regraById.get(r)?.titulo ?? "não cadastrada"}
                      </span>
                    </li>
                  ))}
                </ul>
              </Bloco>

              <Bloco titulo="Campos envolvidos">
                <div className="flex flex-wrap gap-1.5">
                  {atual.campos.map((cid) => {
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
              </Bloco>

              {atual.xmlProblema && (
                <Bloco titulo="XML problemático">
                  <XmlViewer xml={atual.xmlProblema} />
                </Bloco>
              )}

              {atual.exemploCorreto && atual.exemploIncorreto && (
                <Bloco titulo="Comparação">
                  <XmlDiff correto={atual.exemploCorreto} incorreto={atual.exemploIncorreto} />
                </Bloco>
              )}

              <Bloco titulo="Correção">{atual.correcao}</Bloco>
              <Bloco titulo="Impacto no ERP">{atual.impactoErp}</Bloco>

              <Bloco titulo="Checklist de suporte">
                <ol className="list-decimal space-y-1 pl-4">
                  {atual.checklistSuporte.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ol>
              </Bloco>

              <ProcedenciaNota p={atual.procedencia} />
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function Bloco({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="space-y-1">
      <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {titulo}
      </h3>
      <div>{children}</div>
    </section>
  );
}
