import { CheckCircle2, CircleDashed } from "lucide-react";
import { fichaCampo, fichaRegra } from "@/knowledge/rastreabilidade";
import { regraById } from "@/knowledge/regras";
import { campoById } from "@/knowledge/campos";
import { ImpactoErpFaixa } from "./ImpactoErpFaixa";
import { HistoricoRevisao } from "./HistoricoRevisao";

export function FichaRastreabilidade({ tipo, id }: { tipo: "regra" | "campo"; id: string }) {
  const ficha = tipo === "regra" ? fichaRegra(id) : fichaCampo(id);
  const proc = tipo === "regra" ? regraById.get(id)?.procedencia : campoById.get(id)?.procedencia;
  if (!ficha.length || !proc) return null;
  const ok = ficha.filter((f) => f.ok).length;
  return (
    <div className="space-y-3 rounded-lg border bg-surface p-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">Ficha de rastreabilidade</p>
        <span className="text-xs text-muted-foreground">{ok} de {ficha.length} respondidas</span>
      </div>
      <ul className="space-y-1.5">
        {ficha.map((f) => (
          <li key={f.pergunta} className="flex gap-2 text-xs">
            {f.ok ? <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-validated" /> : <CircleDashed className="mt-0.5 h-3.5 w-3.5 shrink-0 text-pending" />}
            <div className="min-w-0">
              <p className="font-medium">{f.pergunta}</p>
              <p className="break-words text-muted-foreground">{f.resposta}</p>
            </div>
          </li>
        ))}
      </ul>
      {tipo === "regra" && <ImpactoErpFaixa regraId={id} />}
      <HistoricoRevisao itemId={id} procedencia={proc} />
    </div>
  );
}
