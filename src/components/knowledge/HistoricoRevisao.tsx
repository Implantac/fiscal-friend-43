import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { fontes } from "@/knowledge/fontes";
import type { Procedencia } from "@/knowledge/types";
import { dateBR } from "@/lib/format";
import {
  governancaLabel,
  historico,
  proximos,
  revisoesRepo,
  statusAtual,
  validarTransicao,
  type RevisaoRegistro,
  type StatusGovernanca,
} from "@/knowledge/governanca";

export function HistoricoRevisao({ itemId, procedencia, compacto = false }: { itemId: string; procedencia: Procedencia; compacto?: boolean }) {
  const [todas, setTodas] = useState<RevisaoRegistro[]>([]);
  const [aberto, setAberto] = useState(false);
  const atual = statusAtual(itemId, procedencia, todas);
  const [f, setF] = useState({ para: "" as StatusGovernanca | "", autor: "", revisor: "", fonteId: procedencia.fonteId, versao: procedencia.versao ?? "", justificativa: "" });
  useEffect(() => setTodas(revisoesRepo.listar()), []);
  const h = historico(itemId, todas);

  const registrar = () => {
    if (!f.para) { toast.error("Escolha o novo status."); return; }
    const r = { ...f, para: f.para, itemId, de: atual };
    const erro = validarTransicao(r);
    if (erro) { toast.error(erro); return; }
    setTodas(revisoesRepo.salvar({ ...r, id: `REV-${Date.now()}`, data: new Date().toISOString() }));
    setAberto(false);
    toast.success(`Status alterado para ${governancaLabel[f.para]} (salvo neste navegador).`);
  };

  const inp = "w-full rounded-md border bg-background px-2 py-1 text-xs";
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Governança</p>
        <span className="rounded border px-1.5 py-0.5 text-[11px] font-semibold">{governancaLabel[atual]}</span>
        {!compacto && <Button size="sm" variant="outline" className="h-6 text-xs" onClick={() => setAberto(!aberto)}>Alterar status</Button>}
      </div>
      {aberto && (
        <div className="grid gap-2 rounded-md border p-2 sm:grid-cols-2">
          <select className={inp} value={f.para} onChange={(e) => setF({ ...f, para: e.target.value as StatusGovernanca })}>
            <option value="">Novo status…</option>
            {proximos(atual).map((s) => <option key={s} value={s}>{governancaLabel[s]}</option>)}
          </select>
          <select className={inp} value={f.fonteId} onChange={(e) => setF({ ...f, fonteId: e.target.value })}>
            {fontes.map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}
          </select>
          <input className={inp} placeholder="Autor" value={f.autor} onChange={(e) => setF({ ...f, autor: e.target.value })} />
          <input className={inp} placeholder="Revisor" value={f.revisor} onChange={(e) => setF({ ...f, revisor: e.target.value })} />
          <input className={inp} placeholder="Versão do documento oficial" value={f.versao} onChange={(e) => setF({ ...f, versao: e.target.value })} />
          <input className={inp} placeholder="Justificativa da alteração" value={f.justificativa} onChange={(e) => setF({ ...f, justificativa: e.target.value })} />
          <Button size="sm" className="sm:col-span-2" onClick={registrar}>Registrar revisão</Button>
        </div>
      )}
      {h.length > 0 && (
        <ul className="space-y-1 text-[11px] text-muted-foreground">
          {h.map((r) => (
            <li key={r.id}>
              {dateBR(r.data)} · {governancaLabel[r.de]} → <b>{governancaLabel[r.para]}</b> · {r.autor}{r.revisor ? ` / rev. ${r.revisor}` : ""} · {r.justificativa}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
