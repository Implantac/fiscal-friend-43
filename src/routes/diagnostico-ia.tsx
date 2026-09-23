import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/knowledge/StatusBadge";
import { conferirNfe, xmlExemploComErros } from "@/knowledge/conferir-nfe";
import { campoById } from "@/knowledge/campos";
import { regraById } from "@/knowledge/regras";
import { nomeFonte } from "@/knowledge/fontes";
import { diagnosticarNfe, type DiagnosticoIA } from "@/lib/diagnostico-ia.functions";

export const Route = createFileRoute("/diagnostico-ia")({
  head: () => ({
    meta: [
      { title: "Diagnóstico de NF-e com IA — Simulador Fiscal" },
      { name: "description", content: "Envie o XML da NF-e e a descrição do erro: a IA aponta o campo exato, a causa provável e a correção, ligada às regras e fontes da base." },
      { property: "og:title", content: "Diagnóstico de NF-e com IA — Simulador Fiscal" },
      { property: "og:description", content: "Campo exato, causa provável e correção recomendada, com fontes." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DiagnosticoPage,
});

function DiagnosticoPage() {
  const diagnosticar = useServerFn(diagnosticarNfe);
  const [xml, setXml] = useState("");
  const [descricao, setDescricao] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [d, setD] = useState<DiagnosticoIA | null>(null);

  const enviar = async () => {
    if (xml.trim().length < 20) { toast.error("Carregue ou cole o XML da NF-e."); return; }
    if (descricao.trim().length < 5) { toast.error("Descreva o erro que apareceu."); return; }
    if (xml.length > 400_000) { toast.error("XML grande demais (máx. 400 KB)."); return; }
    setCarregando(true); setErro(null); setD(null);
    try {
      const local = conferirNfe(xml);
      const achadosLocais = local.achados.map((a) => `- [${a.severidade}] linha ${a.linha ?? "?"} ${a.caminho}: ${a.titulo} (encontrado ${a.encontrado}; esperado ${a.esperado})`).join("\n");
      const r = await diagnosticar({ data: { xml, descricao, achadosLocais } });
      if (r.ok) setD(r.diagnostico); else setErro(r.erro);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao diagnosticar.");
    } finally { setCarregando(false); }
  };

  const campo = d?.campoBaseId ? campoById.get(d.campoBaseId) : undefined;
  const regra = d?.regraBaseId ? regraById.get(d.regraBaseId) : undefined;

  return (
    <div className="space-y-5">
      <PageHeader titulo="Diagnóstico de NF-e com IA" descricao="Para desenvolvimento e suporte: envie o XML e a mensagem de erro. A IA cruza com a conferência local e com a base de regras e aponta o campo, a causa e a correção." />
      <p className="rounded-md border border-pending/40 bg-pending/10 p-3 text-xs">Ambiente de Simulação · o diagnóstico é uma sugestão da IA e precisa ser conferido. Códigos oficiais de rejeição não confirmados aparecem como Pendente de validação. Não envie XML com dados reais de clientes.</p>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <label className="cursor-pointer">
              <input type="file" accept=".xml,text/xml" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (f) setXml(await f.text()); }} />
              <span className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground">Carregar XML</span>
            </label>
            <Button variant="outline" onClick={() => { setXml(xmlExemploComErros); setDescricao("A nota foi recusada ao transmitir. O cliente diz que o total não bate e que apareceu erro no emitente."); }}>Usar exemplo</Button>
          </div>
          <textarea value={xml} onChange={(e) => setXml(e.target.value)} rows={14} placeholder="Cole aqui o XML da NF-e" className="w-full rounded-md border bg-background p-3 font-mono text-xs" />
        </div>
        <div className="space-y-2">
          <p className="text-sm font-medium">Descrição do erro</p>
          <textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={8} placeholder="Ex.: rejeição ao transmitir dizendo que o total da nota difere da soma dos itens" className="w-full rounded-md border bg-background p-3 text-sm" />
          <Button onClick={() => void enviar()} disabled={carregando}>{carregando ? "Analisando… (pode levar até um minuto)" : "Diagnosticar"}</Button>
          {erro && <p className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">{erro}</p>}
        </div>
      </div>

      {d && (
        <div className="space-y-3 rounded-lg border bg-surface p-4 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-semibold">Diagnóstico</h2>
            <StatusBadge status="ilustrativo" />
            <span className="text-xs text-muted-foreground">Confiança da IA: {d.confianca}</span>
          </div>
          <p>{d.resumo}</p>
          <div className="rounded border p-3">
            <p className="font-semibold">Campo com problema</p>
            <p className="font-mono text-xs">{d.campo.caminho} · &lt;{d.campo.tag}&gt;{d.campo.linha ? ` · linha ${d.campo.linha}` : ""}</p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <div className="rounded border border-destructive/40 bg-destructive/5 p-2 text-xs"><p className="font-semibold">Encontrado</p><p className="break-all font-mono">{d.campo.valorEncontrado}</p></div>
              <div className="rounded border border-validated/40 bg-validated/5 p-2 text-xs"><p className="font-semibold">Esperado</p><p className="break-all font-mono">{d.campo.valorEsperado}</p></div>
            </div>
          </div>
          <p><b>Causa provável:</b> {d.causaProvavel}</p>
          <p><b>Correção (desenvolvimento):</b> {d.correcaoDesenvolvimento}</p>
          <p><b>Roteiro (suporte):</b> {d.correcaoSuporte}</p>
          <div className="rounded border p-3 text-xs space-y-1">
            <p className="font-semibold text-sm">Ligações com a base</p>
            {campo ? <p>Campo: <Link to="/conhecimento" search={{ doc: "nfe55", campo: campo.id } as never} className="text-primary hover:underline">{campo.nome}</Link> <StatusBadge status={campo.procedencia.status} /></p> : <p>Campo: sem correspondência na base.</p>}
            {regra ? <p>Regra: <Link to="/debugger" search={{ regra: regra.id } as never} className="text-primary hover:underline">{regra.titulo}</Link> <StatusBadge status={regra.procedencia.status} /></p> : <p>Regra: sem correspondência na base.</p>}
            <p>Fontes: {d.fontesIds.length ? d.fontesIds.map(nomeFonte).join(" · ") : "Fonte oficial ainda não cadastrada."}</p>
          </div>
          {d.pendencias.length > 0 && (
            <div className="text-xs"><p className="font-semibold">Pendente de validação</p><ul className="list-disc pl-5">{d.pendencias.map((p, i) => <li key={i}>{p}</li>)}</ul></div>
          )}
          <Link to="/incidentes" className="text-xs text-primary hover:underline">Registrar como incidente</Link>
        </div>
      )}
    </div>
  );
}
