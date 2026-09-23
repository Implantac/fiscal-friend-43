import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { regras } from "@/knowledge/regras";
import { campos } from "@/knowledge/campos";
import { cstats } from "@/knowledge/cstats";
import { fontes, nomeFonte } from "@/knowledge/fontes";
import { documentos } from "@/knowledge/documentos";
import { ciclo, governancaLabel, revisoesRepo, statusAtual, type RevisaoRegistro } from "@/knowledge/governanca";
import { baseOficialRepo, naturezaCstat, validarRegistroOficial, type RegistroOficial } from "@/knowledge/oficial";
import { dateBR } from "@/lib/format";

export const Route = createFileRoute("/governanca")({
  head: () => ({
    meta: [
      { title: "Governança do conhecimento — Simulador Fiscal" },
      { name: "description", content: "Ciclo de revisão (rascunho a publicado), base oficial separada da didática e histórico de alterações com autor, revisor, fonte e versão." },
      { property: "og:title", content: "Governança do conhecimento — Simulador Fiscal" },
      { property: "og:description", content: "Quem alterou, com qual fonte, em qual versão e por quê." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: GovernancaPage,
});

const vazio: Omit<RegistroOficial, "id" | "data"> = { tipo: "cstat", codigo: "", descricaoOficial: "", documento: "nfe55", fonteId: "sem-fonte", referencia: "", versao: "", vigenciaInicio: "", vigenciaFim: "", autor: "" };

function GovernancaPage() {
  const [revs, setRevs] = useState<RevisaoRegistro[]>([]);
  const [oficiais, setOficiais] = useState<RegistroOficial[]>([]);
  const [f, setF] = useState(vazio);
  useEffect(() => { setRevs(revisoesRepo.listar()); setOficiais(baseOficialRepo.listar()); }, []);

  const itens = [
    ...regras.map((r) => ({ id: r.id, tipo: "Regra", nome: r.titulo, p: r.procedencia, link: { to: "/debugger" as const, search: { regra: r.id } } })),
    ...campos.map((c) => ({ id: c.id, tipo: "Campo", nome: c.nome, p: c.procedencia, link: { to: "/conhecimento" as const, search: { doc: c.documento, campo: c.id } } })),
  ];
  const contagem = ciclo.map((s) => [s, itens.filter((i) => statusAtual(i.id, i.p, revs) === s).length] as const);

  const cadastrar = () => {
    const erro = validarRegistroOficial(f);
    if (erro) return toast.error(erro);
    setOficiais(baseOficialRepo.salvar({ ...f, id: `OF-${Date.now()}`, data: new Date().toISOString() }));
    setF(vazio);
    toast.success("Item oficial cadastrado neste navegador.");
  };
  const inp = "w-full rounded-md border bg-background px-2 py-1.5 text-sm";

  return (
    <div className="space-y-5">
      <PageHeader titulo="Governança do conhecimento" descricao="Ciclo Rascunho → Pendente → Em revisão → Validado → Publicado → Obsoleto. Nada é validado sem fonte oficial, versão e revisor diferente do autor. Registros salvos neste navegador." />
      <div className="grid grid-cols-3 gap-2 md:grid-cols-6">
        {contagem.map(([s, n]) => (
          <div key={s} className="rounded-lg border bg-surface p-3">
            <p className="text-[11px] text-muted-foreground">{governancaLabel[s]}</p>
            <p className="font-mono text-xl font-semibold">{n}</p>
          </div>
        ))}
      </div>
      <Tabs defaultValue="revisao">
        <TabsList>
          <TabsTrigger value="revisao">Ciclo de revisão</TabsTrigger>
          <TabsTrigger value="oficial">Base oficial ({oficiais.length})</TabsTrigger>
          <TabsTrigger value="didatica">Base didática</TabsTrigger>
          <TabsTrigger value="historico">Histórico ({revs.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="revisao" className="pt-3">
          <p className="mb-2 text-sm text-muted-foreground">Para mudar o status de um item, abra-o e use "Alterar status" na ficha de rastreabilidade.</p>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-xs">
              <tbody>
                {itens.map((i) => (
                  <tr key={i.id} className="border-b last:border-0">
                    <td className="px-3 py-1.5 text-muted-foreground">{i.tipo}</td>
                    <td className="px-3 py-1.5"><Link to={i.link.to} search={i.link.search as never} className="font-mono text-primary hover:underline">{i.id}</Link></td>
                    <td className="px-3 py-1.5">{i.nome}</td>
                    <td className="px-3 py-1.5 font-semibold">{governancaLabel[statusAtual(i.id, i.p, revs)]}</td>
                    <td className="px-3 py-1.5 text-muted-foreground">{nomeFonte(i.p.fonteId)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="oficial" className="grid gap-4 pt-3 lg:grid-cols-[360px_1fr]">
          <div className="space-y-2 rounded-lg border bg-surface p-3">
            <h2 className="text-sm font-semibold">Cadastrar item oficial</h2>
            <p className="text-[11px] text-muted-foreground">Copie código e descrição exatamente do documento oficial. Sem fonte, versão e referência, o cadastro é bloqueado.</p>
            <select className={inp} value={f.tipo} onChange={(e) => setF({ ...f, tipo: e.target.value as RegistroOficial["tipo"] })}>
              <option value="cstat">Código de rejeição (cStat)</option><option value="regra">Regra de validação</option><option value="calculo">Cálculo</option>
            </select>
            <input className={inp} placeholder="Código oficial" value={f.codigo} onChange={(e) => setF({ ...f, codigo: e.target.value })} />
            <textarea rows={2} className={inp} placeholder="Descrição oficial" value={f.descricaoOficial} onChange={(e) => setF({ ...f, descricaoOficial: e.target.value })} />
            <select className={inp} value={f.documento} onChange={(e) => setF({ ...f, documento: e.target.value as RegistroOficial["documento"] })}>
              <option value="geral">Geral</option>{documentos.map((d) => <option key={d.id} value={d.id}>{d.sigla}</option>)}
            </select>
            <select className={inp} value={f.fonteId} onChange={(e) => setF({ ...f, fonteId: e.target.value })}>
              {fontes.map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}
            </select>
            <input className={inp} placeholder="Referência (seção, página ou link)" value={f.referencia} onChange={(e) => setF({ ...f, referencia: e.target.value })} />
            <input className={inp} placeholder="Versão do documento" value={f.versao} onChange={(e) => setF({ ...f, versao: e.target.value })} />
            <div className="grid grid-cols-2 gap-2">
              <label className="text-[11px]">Vigência início<input type="date" className={inp} value={f.vigenciaInicio} onChange={(e) => setF({ ...f, vigenciaInicio: e.target.value })} /></label>
              <label className="text-[11px]">Vigência fim<input type="date" className={inp} value={f.vigenciaFim} onChange={(e) => setF({ ...f, vigenciaFim: e.target.value })} /></label>
            </div>
            <input className={inp} placeholder="Autor" value={f.autor} onChange={(e) => setF({ ...f, autor: e.target.value })} />
            <Button className="w-full" onClick={cadastrar}>Cadastrar</Button>
          </div>
          <div>
            {oficiais.length === 0 ? (
              <p className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">A base oficial está vazia. Nenhum código, regra ou cálculo oficial foi cadastrado ainda — tudo o que existe hoje é didático.</p>
            ) : (
              <ul className="divide-y rounded-lg border">
                {oficiais.map((o) => (
                  <li key={o.id} className="space-y-0.5 px-3 py-2 text-xs">
                    <p className="font-semibold"><span className="font-mono">{o.codigo}</span> · {o.descricaoOficial}</p>
                    <p className="text-muted-foreground">{o.tipo} · {o.documento} · {nomeFonte(o.fonteId)} · v{o.versao} · {o.referencia} · vigência {dateBR(o.vigenciaInicio)}{o.vigenciaFim ? ` a ${dateBR(o.vigenciaFim)}` : ""} · {o.autor}</p>
                    <button type="button" className="text-destructive hover:underline" onClick={() => setOficiais(baseOficialRepo.remover(o.id))}>Remover</button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </TabsContent>

        <TabsContent value="didatica" className="space-y-2 pt-3">
          <p className="text-sm text-muted-foreground">Identificadores internos para ensinar diagnóstico. Não são códigos oficiais.</p>
          <ul className="divide-y rounded-lg border">
            {cstats.map((c) => (
              <li key={c.codigo} className="flex justify-between gap-2 px-3 py-1.5 text-xs">
                <Link to="/cstat" search={{ codigo: c.codigo }} className="font-mono text-primary hover:underline">{c.codigo}</Link>
                <span>{c.situacao}</span>
                <span className="font-semibold">{naturezaCstat(c) === "oficial" ? "Oficial" : "Didático"}</span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">Regras ({regras.length}) e cálculos do laboratório também são didáticos.</p>
        </TabsContent>

        <TabsContent value="historico" className="pt-3">
          {revs.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma revisão registrada.</p> : (
            <ul className="divide-y rounded-lg border text-xs">
              {revs.map((r) => (
                <li key={r.id} className="px-3 py-1.5">{dateBR(r.data)} · <span className="font-mono">{r.itemId}</span> · {governancaLabel[r.de]} → <b>{governancaLabel[r.para]}</b> · autor {r.autor}{r.revisor && ` · revisor ${r.revisor}`} · {nomeFonte(r.fonteId)}{r.versao && ` v${r.versao}`} · {r.justificativa}</li>
              ))}
            </ul>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
