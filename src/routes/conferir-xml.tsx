import { useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/knowledge/StatusBadge";
import { conferirNfe, xmlExemploComErros, type Achado, type ResultadoConferencia } from "@/knowledge/conferir-nfe";

export const Route = createFileRoute("/conferir-xml")({
  head: () => ({
    meta: [
      { title: "Conferir XML de NF-e — Simulador Fiscal" },
      { name: "description", content: "Carregue um XML de NF-e e veja exatamente a linha, o campo, o valor encontrado e o esperado de cada problema, com correção e roteiro de suporte." },
      { property: "og:title", content: "Conferir XML de NF-e — Simulador Fiscal" },
      { property: "og:description", content: "Linha, campo, valor encontrado × esperado e como corrigir." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ConferirPage,
});

function ConferirPage() {
  const [texto, setTexto] = useState("");
  const [res, setRes] = useState<ResultadoConferencia | null>(null);
  const [sel, setSel] = useState<Achado | null>(null);
  const linhasRef = useRef<HTMLDivElement>(null);

  const conferir = (xml: string) => {
    if (!xml.trim()) { toast.error("Cole ou carregue um XML."); return; }
    if (xml.length > 2_000_000) { toast.error("Arquivo grande demais (máx. 2 MB)."); return; }
    const r = conferirNfe(xml);
    setRes(r);
    setSel(r.achados[0] ?? null);
  };
  const carregar = async (f: File | undefined) => {
    if (!f) return;
    const xml = await f.text();
    setTexto(xml);
    conferir(xml);
  };
  const irPara = (a: Achado) => {
    setSel(a);
    if (a.linha) linhasRef.current?.querySelector(`[data-l="${a.linha}"]`)?.scrollIntoView({ block: "center", behavior: "smooth" });
  };
  const erros = res?.achados.filter((a) => a.severidade === "erro").length ?? 0;
  const alertas = (res?.achados.length ?? 0) - erros;
  const linhasMarcadas = new Set(res?.achados.map((a) => a.linha));

  return (
    <div className="space-y-5">
      <PageHeader
        titulo="Conferir XML de NF-e"
        descricao="Carregue o XML que deu problema. O arquivo é lido só no seu navegador e não é enviado a lugar nenhum. A conferência aponta linha, campo, valor encontrado e esperado."
      />
      <div className="flex flex-wrap items-center gap-2">
        <label className="cursor-pointer">
          <input type="file" accept=".xml,text/xml" className="hidden" onChange={(e) => void carregar(e.target.files?.[0])} />
          <span className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground">Carregar arquivo XML</span>
        </label>
        <Button variant="outline" onClick={() => { setTexto(xmlExemploComErros); conferir(xmlExemploComErros); }}>Usar exemplo com erros</Button>
        <Button variant="outline" onClick={() => conferir(texto)}>Conferir texto colado</Button>
        <span className="text-xs text-muted-foreground">Ambiente de Simulação · nada é transmitido</span>
      </div>
      {!res && (
        <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={10} placeholder="…ou cole aqui o conteúdo do XML" className="w-full rounded-md border bg-background p-3 font-mono text-xs" />
      )}

      {res && (
        <>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-6">
            {[["Erros", erros], ["Alertas", alertas], ["Itens", res.resumo.itens], ["Valor da nota", res.resumo.vNF], ["Emitente", res.resumo.emitente], ["Destinatário", res.resumo.destinatario]].map(([k, v]) => (
              <div key={String(k)} className="rounded-lg border bg-surface p-3">
                <p className="text-[11px] text-muted-foreground">{k}</p>
                <p className={`truncate text-sm font-semibold ${k === "Erros" && erros ? "text-destructive" : ""}`}>{v}</p>
              </div>
            ))}
          </div>
          {res.achados.length === 0 && <p className="rounded-md border border-validated/40 bg-validated/10 p-3 text-sm">Nenhum problema encontrado nas conferências disponíveis. Isso não garante autorização: a validação oficial pelo esquema e pela SEFAZ tem mais regras.</p>}

          <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
            <ul className="max-h-[640px] space-y-1 overflow-auto">
              {res.achados.map((a) => (
                <li key={a.id}>
                  <button type="button" onClick={() => irPara(a)} className={`w-full rounded-md border px-3 py-2 text-left text-xs hover:bg-accent ${sel?.id === a.id ? "border-primary bg-accent" : ""}`}>
                    <span className={`mr-1 font-semibold ${a.severidade === "erro" ? "text-destructive" : "text-pending"}`}>{a.severidade === "erro" ? "ERRO" : "ALERTA"}</span>
                    {a.linha && <span className="font-mono text-muted-foreground">linha {a.linha} · </span>}
                    <span className="font-medium">{a.titulo}</span>
                  </button>
                </li>
              ))}
            </ul>

            <div className="space-y-3">
              {sel && (
                <div className="space-y-2 rounded-lg border bg-surface p-4 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-semibold">{sel.titulo}</h2>
                    <StatusBadge status="ilustrativo" />
                  </div>
                  <p className="font-mono text-xs">{sel.caminho}{sel.linha ? ` · linha ${sel.linha}` : ""}</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="rounded border border-destructive/40 bg-destructive/5 p-2 text-xs"><p className="font-semibold">Encontrado</p><p className="break-all font-mono">{sel.encontrado}</p></div>
                    <div className="rounded border border-validated/40 bg-validated/5 p-2 text-xs"><p className="font-semibold">Esperado</p><p className="break-all font-mono">{sel.esperado}</p></div>
                  </div>
                  <p><b>Por quê:</b> {sel.explicacao}</p>
                  <p><b>Como corrigir (desenvolvimento):</b> {sel.correcao}</p>
                  <p><b>Roteiro de suporte:</b> {sel.suporte}</p>
                  <p className="text-xs text-muted-foreground">Código oficial de rejeição: Pendente de validação (cadastre na Governança com fonte e versão).</p>
                  <div className="flex flex-wrap gap-3 text-xs">
                    {sel.regraId && <Link to="/debugger" search={{ regra: sel.regraId }} className="text-primary hover:underline">Ver regra</Link>}
                    {sel.campoId && <Link to="/conhecimento" search={{ doc: "nfe55", campo: sel.campoId }} className="text-primary hover:underline">Ver campo</Link>}
                    <Link to="/incidentes" className="text-primary hover:underline">Registrar como incidente</Link>
                  </div>
                </div>
              )}
              <div ref={linhasRef} className="max-h-[440px] overflow-auto rounded-lg border bg-muted/40 font-mono text-[11px]">
                {res.linhas.map((l, i) => {
                  const n = i + 1;
                  const marcada = linhasMarcadas.has(n);
                  return (
                    <div key={n} data-l={n} className={`flex ${sel?.linha === n ? "bg-destructive/20" : marcada ? "bg-pending/15" : ""}`}>
                      <span className="w-10 shrink-0 select-none pr-2 text-right text-muted-foreground">{n}</span>
                      <pre className="whitespace-pre">{l}</pre>
                    </div>
                  );
                })}
              </div>
              <Button variant="ghost" size="sm" onClick={() => { setRes(null); setSel(null); }}>Conferir outro XML</Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
