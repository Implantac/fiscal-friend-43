import type { Procedencia } from "@/knowledge/types";
import { nomeFonte } from "@/knowledge/fontes";
import { StatusBadge } from "./StatusBadge";

/** Compara regra anterior × atual × futura. Sem data oficial → Pendente de validação. */
export function VersionTimeline({ procedencia }: { procedencia: Procedencia }) {
  const v = procedencia.vigencia;
  const etapas = [
    { rotulo: "Anterior", texto: "Versão anterior não cadastrada", status: "pendente" as const },
    {
      rotulo: "Atual",
      texto: `${procedencia.documento ?? nomeFonte(procedencia.fonteId)}${
        procedencia.versao ? ` · ${procedencia.versao}` : ""
      }${v?.inicio ? ` · desde ${v.inicio}` : " · vigência não confirmada"}`,
      status: procedencia.status,
    },
    {
      rotulo: "Futura",
      texto: v?.fim ? `Muda após ${v.fim}` : "Nenhuma mudança futura cadastrada",
      status: "pendente" as const,
    },
  ];
  return (
    <ol className="relative space-y-3 border-l pl-4">
      {etapas.map((e) => (
        <li key={e.rotulo} className="relative">
          <span className="absolute -left-[21px] top-1 size-2.5 rounded-full border bg-background" />
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold">{e.rotulo}</span>
            <StatusBadge status={e.status} />
          </div>
          <p className="text-xs text-muted-foreground">{e.texto}</p>
        </li>
      ))}
    </ol>
  );
}
