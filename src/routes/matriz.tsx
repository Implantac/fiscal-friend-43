import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/layout/AppShell";
import { StatusBadge } from "@/components/knowledge/StatusBadge";
import { documentoSimuladoPadrao, executarRegras, base, type DocumentoSimulado } from "@/knowledge/regras";
import { campoById } from "@/knowledge/campos";
import { brl } from "@/lib/format";

export const Route = createFileRoute("/matriz")({
  head: () => ({
    meta: [
      { title: "Matriz fiscal — Simulador Fiscal" },
      { name: "description", content: "Monte um cenário por perguntas e veja documento, classificação, tributação, cálculo, campos, XML, regras, rejeições e testes ligados." },
      { property: "og:title", content: "Matriz fiscal — Simulador Fiscal" },
      { property: "og:description", content: "Do cenário às regras e rejeições, cada item clicável." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MatrizPage,
});

const ufs = ["SP", "MG", "RJ", "PR", "RS", "BA"];
const operacoes = { venda: "Venda", devolucao: "Devolução" } as const;

function MatrizPage() {
  const [op, setOp] = useState<keyof typeof operacoes>("venda");
  const [d, setD] = useState<DocumentoSimulado>({ ...documentoSimuladoPadrao, cfop: "6102", difalInformado: 0 });
  const set = <K extends keyof DocumentoSimulado>(k: K, v: DocumentoSimulado[K]) => setD((x) => ({ ...x, [k]: v }));

  const cfopSugerido = useMemo(() => {
    const serie = d.ufOrigem === d.ufDestino ? "5" : "6";
    return op === "devolucao" ? `${serie}202` : `${serie}102`;
  }, [d.ufOrigem, d.ufDestino, op]);
  const doc = { ...d, cfop: cfopSugerido };
  const resultados = executarRegras(doc).filter((r) => r.regra.documento === "nfe55");
  const falhas = resultados.filter((r) => !r.ok);
  const interestadual = d.ufOrigem !== d.ufDestino;
  const partilha = interestadual && d.consumidorFinal && !d.contribuinte;
  const b = base(doc);
  const campos = [...new Set(resultados.flatMap((r) => r.regra.campos))];

  const Sel = ({ rotulo, v, onChange, opcoes }: { rotulo: string; v: string; onChange: (s: string) => void; opcoes: [string, string][] }) => (
    <label className="space-y-1 text-xs">
      <span className="font-medium">{rotulo}</span>
      <select value={v} onChange={(e) => onChange(e.target.value)} className="block w-full rounded-md border bg-background px-2 py-1.5 text-sm">
        {opcoes.map(([k, t]) => <option key={k} value={k}>{t}</option>)}
      </select>
    </label>
  );

  const etapa = (n: number, t: string, conteudo: React.ReactNode) => (
    <li className="rounded-lg border bg-surface p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{String(n).padStart(2, "0")} · {t}</p>
      <div className="mt-1 text-sm">{conteudo}</div>
    </li>
  );

  return (
    <div className="space-y-5">
      <PageHeader
        titulo="Matriz fiscal"
        descricao="Responda às perguntas e acompanhe a cadeia completa da NF-e. A classificação sugerida é uma heurística didática, não uma regra oficial."
      />
      <div className="grid gap-5 lg:grid-cols-[300px_1fr]">
        <div className="space-y-3 rounded-lg border p-3">
          <Sel rotulo="Tipo de operação" v={op} onChange={(v) => setOp(v as keyof typeof operacoes)} opcoes={Object.entries(operacoes)} />
          <Sel rotulo="UF de origem" v={d.ufOrigem} onChange={(v) => set("ufOrigem", v)} opcoes={ufs.map((u) => [u, u])} />
          <Sel rotulo="UF de destino" v={d.ufDestino} onChange={(v) => set("ufDestino", v)} opcoes={ufs.map((u) => [u, u])} />
          <Sel rotulo="Regime do emitente" v={d.regime} onChange={(v) => { set("regime", v as DocumentoSimulado["regime"]); set("cst", v === "simples" ? "102" : "00"); }} opcoes={[["normal", "Regime Normal"], ["simples", "Simples Nacional"]]} />
          <Sel rotulo="Destinatário" v={d.contribuinte ? "c" : "n"} onChange={(v) => set("contribuinte", v === "c")} opcoes={[["n", "Não contribuinte"], ["c", "Contribuinte"]]} />
          <Sel rotulo="Consumidor final" v={d.consumidorFinal ? "s" : "n"} onChange={(v) => set("consumidorFinal", v === "s")} opcoes={[["s", "Sim"], ["n", "Não"]]} />
          <label className="space-y-1 text-xs">
            <span className="font-medium">NCM</span>
            <input value={d.ncm} onChange={(e) => set("ncm", e.target.value)} className="block w-full rounded-md border bg-background px-2 py-1.5 font-mono text-sm" />
          </label>
          <label className="space-y-1 text-xs">
            <span className="font-medium">Partilha informada (R$)</span>
            <input type="number" value={d.difalInformado} onChange={(e) => set("difalInformado", Number(e.target.value))} className="block w-full rounded-md border bg-background px-2 py-1.5 font-mono text-sm" />
          </label>
          <p className="text-[11px] text-muted-foreground">Dados fictícios · Ambiente de Simulação</p>
        </div>

        <ol className="grid gap-2 md:grid-cols-2">
          {etapa(1, "Cenário", `${operacoes[op]} ${interestadual ? "interestadual" : "interna"} (${d.ufOrigem} → ${d.ufDestino}), ${d.contribuinte ? "destinatário contribuinte" : "não contribuinte"}.`)}
          {etapa(2, "Documento", <Link to="/conhecimento" search={{ doc: "nfe55" }} className="text-primary hover:underline">NF-e modelo 55</Link>)}
          {etapa(3, "Classificação", <>CFOP sugerido <code className="font-mono">{cfopSugerido}</code> · CST/CSOSN <code className="font-mono">{d.cst}</code> · NCM <code className="font-mono">{d.ncm}</code> <StatusBadge status="ilustrativo" /></>)}
          {etapa(4, "Tributação", <>ICMS próprio{partilha ? " + partilha para a UF de destino" : ""}{d.regime === "simples" ? " (regras do Simples)" : ""}. <Link to="/reforma" className="text-primary hover:underline">Novo modelo IBS/CBS</Link> <StatusBadge status="pendente" /></>)}
          {etapa(5, "Cálculo", <>Base {brl(b)} × {d.aliquotaIcms}% = {brl(Math.round(b * d.aliquotaIcms) / 100)} <span className="text-xs text-muted-foreground">(exemplo didático)</span> · <Link to="/math-lab" className="text-primary hover:underline">abrir laboratório</Link></>)}
          {etapa(6, "Campos", <div className="flex flex-wrap gap-1">{campos.map((c) => { const f = campoById.get(c); return f ? <Link key={c} to="/conhecimento" search={{ doc: f.documento, campo: c }} className="rounded border px-1.5 font-mono text-[11px] hover:bg-accent">{f.tagXml}</Link> : null; })}</div>)}
          {etapa(7, "XML (ilustrativo)", <pre className="overflow-x-auto rounded bg-muted p-2 font-mono text-[11px]">{`<prod><NCM>${d.ncm}</NCM><CFOP>${cfopSugerido}</CFOP></prod>\n<ICMS><CST>${d.cst}</CST><vBC>${b.toFixed(2)}</vBC></ICMS>`}</pre>)}
          {etapa(8, `Regras (${resultados.length - falhas.length} ok, ${falhas.length} falha${falhas.length === 1 ? "" : "s"})`, (
            <ul className="space-y-1">
              {resultados.map((r) => (
                <li key={r.regra.id} className="flex items-center justify-between gap-2 text-xs">
                  <Link to="/debugger" search={{ regra: r.regra.id }} className="hover:underline">{r.regra.titulo}</Link>
                  <span className={r.ok ? "text-validated" : "text-destructive font-semibold"}>{r.ok ? "OK" : "Falha"}</span>
                </li>
              ))}
            </ul>
          ))}
          {etapa(9, "Rejeições possíveis", falhas.length ? (
            <div className="flex flex-wrap gap-1">{[...new Set(falhas.flatMap((f) => f.regra.cstats))].map((c) => <Link key={c} to="/cstat" search={{ codigo: c }} className="rounded border px-1.5 font-mono text-[11px] hover:bg-accent">{c}</Link>)}</div>
          ) : "Nenhuma regra didática violada.")}
          {etapa(10, "Testes", <Link to="/regressao" className="text-primary hover:underline">Ver casos de regressão relacionados</Link>)}
        </ol>
      </div>
    </div>
  );
}
