import { etapasErp, impactoErpPorRegra } from "@/knowledge/erp";
import { StatusBadge } from "./StatusBadge";

export function ImpactoErpFaixa({ regraId }: { regraId: string }) {
  const impacto = impactoErpPorRegra[regraId] ?? {};
  const afetadas = etapasErp.filter((e) => impacto[e]);
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Impacto no ERP</p>
        <StatusBadge status="ilustrativo" />
      </div>
      <ol className="flex flex-wrap gap-1">
        {etapasErp.map((e) => (
          <li
            key={e}
            className={`rounded border px-1.5 py-0.5 text-[11px] ${impacto[e] ? "border-primary bg-primary/10 font-semibold text-primary" : "text-muted-foreground opacity-60"}`}
          >
            {e}
          </li>
        ))}
      </ol>
      {afetadas.length ? (
        <ul className="space-y-1 text-xs">
          {afetadas.map((e) => (
            <li key={e}><span className="font-semibold">{e}:</span> {impacto[e]}</li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">Impacto no ERP ainda não mapeado para esta regra.</p>
      )}
    </div>
  );
}
