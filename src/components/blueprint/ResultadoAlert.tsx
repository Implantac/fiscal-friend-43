import { AlertTriangle, CheckCircle2, CloudOff, XCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useSimulator } from "@/blueprint/SimulatorProvider";
import type { ResultadoSimulado } from "@/domain/types";

const estilo: Record<
  ResultadoSimulado["tipo"],
  { icone: typeof CheckCircle2; classe: string; origem: string }
> = {
  sucesso: {
    icone: CheckCircle2,
    classe: "border-validated/40 bg-auto-surface",
    origem: "Camada de simulação",
  },
  erro_local: {
    icone: AlertTriangle,
    classe: "border-amber-500/40 bg-amber-500/10",
    origem: "Erro local (interface)",
  },
  erro_provedor: {
    icone: CloudOff,
    classe: "border-orange-500/40 bg-orange-500/10",
    origem: "Erro do provedor (simulado)",
  },
  rejeicao_fiscal: {
    icone: XCircle,
    classe: "border-destructive/40 bg-destructive/10",
    origem: "Rejeição fiscal (simulada)",
  },
};

export function ResultadoAlert({
  resultado,
  onFechar,
}: {
  resultado: ResultadoSimulado;
  onFechar?: () => void;
}) {
  const { devMode, selectDoc } = useSimulator();
  const cfg = estilo[resultado.tipo];
  const Icone = cfg.icone;

  return (
    <Alert className={cfg.classe}>
      <Icone className="size-4" aria-hidden />
      <AlertTitle className="flex flex-wrap items-center gap-2">
        {resultado.titulo}
        <span className="rounded border px-1.5 py-0.5 text-[10px] font-normal uppercase tracking-wide text-muted-foreground">
          {cfg.origem}
        </span>
      </AlertTitle>
      <AlertDescription className="space-y-1 text-sm">
        <p>{resultado.explicacao}</p>
        {resultado.acaoSugerida ? (
          <p className="text-muted-foreground">O que fazer: {resultado.acaoSugerida}</p>
        ) : null}
        <p className="font-mono text-[11px] text-muted-foreground">{resultado.mensagemTecnica}</p>
        <div className="flex gap-2 pt-1">
          {devMode && resultado.docId ? (
            <Button size="sm" variant="outline" onClick={() => selectDoc(resultado.docId!)}>
              Ver no painel técnico
            </Button>
          ) : null}
          {onFechar ? (
            <Button size="sm" variant="ghost" onClick={onFechar}>
              Fechar
            </Button>
          ) : null}
        </div>
      </AlertDescription>
    </Alert>
  );
}
