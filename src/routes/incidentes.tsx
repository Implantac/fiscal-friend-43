import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/AppShell";
import { StatusBadge } from "@/components/knowledge/StatusBadge";
import { Button } from "@/components/ui/button";
import { documentos } from "@/knowledge/documentos";
import { cstats, cstatByCodigo } from "@/knowledge/cstats";
import { dateBR } from "@/lib/format";

export const Route = createFileRoute("/incidentes")({
  head: () => ({
    meta: [
      { title: "Registro de incidentes — Simulador Fiscal" },
      { name: "description", content: "Registre incidentes fiscais do suporte e transforme cada caso em rascunho de conhecimento pendente de validação." },
      { property: "og:title", content: "Registro de incidentes — Simulador Fiscal" },
      { property: "og:description", content: "Sintoma, rejeição, causa, correção e prevenção, virando conhecimento para a equipe." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: IncidentesPage,
});

interface Incidente {
  id: string;
  data: string;
  titulo: string;
  documento: string;
  cstat: string;
  sintoma: string;
  causa: string;
  correcao: string;
  prevencao: string;
}

const CHAVE = "simulador-fiscal:incidentes";
const vazio: Omit<Incidente, "id" | "data"> = { titulo: "", documento: "nfe55", cstat: "", sintoma: "", causa: "", correcao: "", prevencao: "" };

function paraConhecimento(i: Incidente): string {
  const c = cstatByCodigo.get(i.cstat);
  return [
    `# Conhecimento derivado do incidente ${i.id}`,
    `Status: PENDENTE DE VALIDAÇÃO (origem: suporte, não é fonte oficial)`,
    `Documento: ${documentos.find((d) => d.id === i.documento)?.sigla ?? i.documento}`,
    `Rejeição relacionada: ${c ? c.situacao : "não identificada"}`,
    `Regras relacionadas: ${c?.regras.join(", ") || "—"}`,
    `Campos relacionados: ${c?.campos.join(", ") || "—"}`,
    ``,
    `## Sintoma`, i.sintoma || "—",
    `## Causa`, i.causa || "—",
    `## Correção`, i.correcao || "—",
    `## Prevenção no ERP`, i.prevencao || "—",
    `## Teste de regressão sugerido`,
    `Reproduzir o cenário do incidente e confirmar que a regra aponta a falha antes do envio.`,
  ].join("\n");
}

function IncidentesPage() {
  const [lista, setLista] = useState<Incidente[]>([]);
  const [form, setForm] = useState(vazio);
  const [selecionado, setSelecionado] = useState<string | null>(null);

  useEffect(() => {
    try {
      setLista(JSON.parse(localStorage.getItem(CHAVE) ?? "[]") as Incidente[]);
    } catch {
      setLista([]);
    }
  }, []);

  const salvar = (nova: Incidente[]) => {
    setLista(nova);
    localStorage.setItem(CHAVE, JSON.stringify(nova));
  };

  const registrar = () => {
    if (form.titulo.trim().length < 5 || form.sintoma.trim().length < 10) {
      toast.error("Informe um título (5+ caracteres) e o sintoma (10+ caracteres).");
      return;
    }
    const inc: Incidente = { ...form, id: `INC-${String(lista.length + 1).padStart(3, "0")}`, data: new Date().toISOString() };
    salvar([inc, ...lista]);
    setForm(vazio);
    setSelecionado(inc.id);
    toast.success(`Incidente ${inc.id} registrado neste navegador.`);
  };

  const atual = lista.find((i) => i.id === selecionado);
  const campo = (k: keyof typeof vazio, rotulo: string, area = false) => (
    <label className="block space-y-1 text-xs">
      <span className="font-medium">{rotulo}</span>
      {area ? (
        <textarea rows={2} value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} className="w-full rounded-md border bg-background px-2 py-1.5 text-sm" />
      ) : (
        <input value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} className="w-full rounded-md border bg-background px-2 py-1.5 text-sm" />
      )}
    </label>
  );

  return (
    <div className="space-y-5">
      <PageHeader
        titulo="Registro de incidentes"
        descricao="Registre o que aconteceu no atendimento e transforme o caso em conhecimento para a equipe. Tudo fica salvo apenas neste navegador e nasce como pendente de validação."
      />
      <div className="grid gap-5 lg:grid-cols-[380px_1fr]">
        <div className="space-y-3 rounded-lg border bg-surface p-4">
          <h2 className="text-sm font-semibold">Novo incidente (fictício)</h2>
          {campo("titulo", "Título")}
          <div className="grid grid-cols-2 gap-2">
            <label className="space-y-1 text-xs">
              <span className="font-medium">Documento</span>
              <select value={form.documento} onChange={(e) => setForm({ ...form, documento: e.target.value })} className="w-full rounded-md border bg-background px-2 py-1.5 text-sm">
                {documentos.map((d) => <option key={d.id} value={d.id}>{d.sigla}</option>)}
              </select>
            </label>
            <label className="space-y-1 text-xs">
              <span className="font-medium">Rejeição</span>
              <select value={form.cstat} onChange={(e) => setForm({ ...form, cstat: e.target.value })} className="w-full rounded-md border bg-background px-2 py-1.5 text-sm">
                <option value="">Não identificada</option>
                {cstats.map((c) => <option key={c.codigo} value={c.codigo}>{c.situacao}</option>)}
              </select>
            </label>
          </div>
          {campo("sintoma", "Sintoma relatado", true)}
          {campo("causa", "Causa encontrada", true)}
          {campo("correcao", "Correção aplicada", true)}
          {campo("prevencao", "Como o ERP deve prevenir", true)}
          <Button onClick={registrar} className="w-full">Registrar incidente</Button>
        </div>

        <div className="space-y-4">
          {lista.length === 0 ? (
            <p className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">Nenhum incidente registrado ainda.</p>
          ) : (
            <ul className="divide-y rounded-lg border bg-surface">
              {lista.map((i) => (
                <li key={i.id}>
                  <button type="button" onClick={() => setSelecionado(i.id)} className={`flex w-full items-center justify-between gap-3 px-4 py-2 text-left text-sm hover:bg-accent ${selecionado === i.id ? "bg-accent" : ""}`}>
                    <span><span className="font-mono text-xs">{i.id}</span> · {i.titulo}</span>
                    <span className="text-xs text-muted-foreground">{dateBR(i.data)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {atual && (
            <div className="space-y-3 rounded-lg border bg-surface p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-semibold">Transformar em conhecimento</h2>
                <StatusBadge status="pendente" />
              </div>
              {atual.cstat && (
                <p className="text-xs">
                  Ver na base: <Link to="/cstat" search={{ codigo: atual.cstat }} className="text-primary hover:underline">rejeição relacionada</Link>
                </p>
              )}
              <pre className="max-h-96 overflow-auto rounded-md bg-muted p-3 font-mono text-xs whitespace-pre-wrap">{paraConhecimento(atual)}</pre>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => { void navigator.clipboard.writeText(paraConhecimento(atual)); toast.success("Rascunho copiado."); }}>Copiar rascunho</Button>
                <Button variant="ghost" onClick={() => { salvar(lista.filter((i) => i.id !== atual.id)); setSelecionado(null); }}>Excluir</Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
