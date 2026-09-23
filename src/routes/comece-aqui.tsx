import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/layout/AppShell";
import { Checkbox } from "@/components/ui/checkbox";

export const Route = createFileRoute("/comece-aqui")({
  head: () => ({
    meta: [
      { title: "Comece aqui — Simulador Fiscal" },
      { name: "description", content: "Trilha de sete dias para um novo desenvolvedor aprender o fiscal: conceitos, documentos, XML, tributação, cálculos, rejeições e ERP." },
      { property: "og:title", content: "Comece aqui — Simulador Fiscal" },
      { property: "og:description", content: "Roteiro progressivo para quem chega na equipe fiscal." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ComecePage,
});

const dias = [
  { d: 1, t: "Conceitos fiscais", o: "Entender por que documentos fiscais existem e quem participa.", links: [["Mapa fiscal", "/mapa"], ["Trilha Fundamentos", "/academia"]] },
  { d: 2, t: "Documentos", o: "Saber quando usar NF-e, NFC-e, NFS-e, CT-e, CT-e OS e MDF-e.", links: [["Base fiscal", "/conhecimento"], ["NF-e 55", "/nfe"]] },
  { d: 3, t: "XML", o: "Ler um XML e ligar cada tag ao campo e à regra.", links: [["XML Lab", "/xml-lab"]] },
  { d: 4, t: "Tributação", o: "Entender operação, regime e o novo modelo de tributos.", links: [["Matriz fiscal", "/matriz"], ["Reforma", "/reforma"]] },
  { d: 5, t: "Cálculos", o: "Montar base, alíquota e arredondamento passo a passo.", links: [["Laboratório de cálculos", "/math-lab"]] },
  { d: 6, t: "Rejeições", o: "Diagnosticar uma recusa e chegar à regra violada.", links: [["Debugger", "/debugger"], ["Rejeições", "/cstat"], ["Desafios", "/academia"]] },
  { d: 7, t: "Implementação no ERP", o: "Saber onde o ERP obtém cada dado, como validar antes e como testar.", links: [["Regressão", "/regressao"], ["Modo suporte", "/suporte"], ["Qualidade", "/qualidade"]] },
] as const;

const CHAVE = "comece-aqui-progresso";

function ComecePage() {
  const [feitos, setFeitos] = useState<Record<number, boolean>>({});
  useEffect(() => {
    try { setFeitos(JSON.parse(localStorage.getItem(CHAVE) ?? "{}")); } catch { /* sem progresso salvo */ }
  }, []);
  const marcar = (d: number, v: boolean) => {
    const n = { ...feitos, [d]: v };
    setFeitos(n);
    localStorage.setItem(CHAVE, JSON.stringify(n));
  };
  const total = Object.values(feitos).filter(Boolean).length;

  return (
    <div className="space-y-5">
      <PageHeader titulo="Comece aqui" descricao={`Trilha de sete dias para quem chega na equipe fiscal. Progresso: ${total} de 7 (salvo neste navegador).`} />
      <ol className="space-y-2">
        {dias.map((x) => (
          <li key={x.d} className="flex items-start gap-4 rounded-lg border bg-surface p-4">
            <Checkbox checked={!!feitos[x.d]} onCheckedChange={(v) => marcar(x.d, v === true)} aria-label={`Concluir dia ${x.d}`} className="mt-1" />
            <div className="flex-1">
              <p className="text-xs font-mono text-muted-foreground">Dia {x.d}</p>
              <p className="font-semibold">{x.t}</p>
              <p className="text-sm text-muted-foreground">{x.o}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {x.links.map(([t, to]) => <Link key={t} to={to} search={{} as never} className="rounded-md border px-2 py-1 text-xs hover:bg-accent">{t}</Link>)}
              </div>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
