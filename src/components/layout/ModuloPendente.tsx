import { Construction } from "lucide-react";
import { PageHeader } from "./AppShell";

/**
 * Placeholder honesto para os módulos ainda não construídos nesta etapa.
 * Não exibe controles decorativos: apenas informa o escopo previsto.
 */
export function ModuloPendente({
  titulo,
  descricao,
  escopo,
}: {
  titulo: string;
  descricao: string;
  escopo: string[];
}) {
  return (
    <>
      <PageHeader titulo={titulo} descricao={descricao} />
      <div className="max-w-2xl rounded-lg border bg-surface p-6 shadow-panel">
        <div className="flex items-center gap-2 text-sim-foreground">
          <Construction className="size-5" aria-hidden />
          <h2 className="text-sm font-semibold">Módulo previsto para a próxima etapa</h2>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          Esta tela ainda não foi implementada. O escopo acordado para ela é:
        </p>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">
          {escopo.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      </div>
    </>
  );
}
