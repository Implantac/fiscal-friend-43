import { statusLabel, type Procedencia, type StatusValidacao } from "@/knowledge/types";
import { nomeFonte } from "@/knowledge/fontes";
import { cn } from "@/lib/utils";

const cores: Record<StatusValidacao, string> = {
  validado: "bg-[var(--auto-surface)] text-[var(--auto-foreground)]",
  ilustrativo: "bg-accent text-accent-foreground",
  pendente: "bg-sim-surface text-sim-foreground",
  obsoleto: "bg-muted text-muted-foreground line-through",
};

export function StatusBadge({
  status,
  className,
}: {
  status: StatusValidacao;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold",
        cores[status],
        className,
      )}
    >
      {statusLabel[status]}
    </span>
  );
}

/** Bloco de procedência: status, fonte, documento, versão e vigência. */
export function ProcedenciaNota({ p }: { p: Procedencia }) {
  return (
    <div className="rounded-md border bg-muted/40 p-2 text-xs text-muted-foreground">
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <StatusBadge status={p.status} />
        {p.documento && <span className="font-medium text-foreground">{p.documento}</span>}
        {p.versao && <span>Versão {p.versao}</span>}
      </div>
      <p>Fonte: {nomeFonte(p.fonteId)}</p>
      {p.vigencia?.inicio && (
        <p>
          Vigência: {p.vigencia.inicio}
          {p.vigencia.fim ? ` até ${p.vigencia.fim}` : " em diante"}
        </p>
      )}
      {p.vigencia?.observacao && <p>{p.vigencia.observacao}</p>}
    </div>
  );
}

export function EtiquetaDidatica({ texto = "Exemplo didático" }: { texto?: string }) {
  return (
    <span className="inline-block rounded border border-sim/40 bg-sim-surface px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-sim-foreground">
      {texto}
    </span>
  );
}
