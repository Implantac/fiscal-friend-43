import { Building2, FlaskConical } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { empresaSimulada } from "@/simulation/mock-data";
import { formatCnpj } from "@/lib/format";
import { useSimulator } from "@/blueprint/SimulatorProvider";
import { Documented } from "@/components/blueprint/Documented";

export function Header() {
  const { devMode, setDevMode } = useSimulator();

  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b bg-surface px-4">
      <div className="flex min-w-0 items-center gap-3">
        <Building2 className="size-5 text-muted-foreground" aria-hidden />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{empresaSimulada.razaoSocial}</p>
          <p className="truncate text-xs text-muted-foreground">
            CNPJ fictício {formatCnpj(empresaSimulada.cnpj)} · {empresaSimulada.municipio}/
            {empresaSimulada.uf}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <GlobalSearch />

        <Documented docId="global.ambiente" inline>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-sim-surface px-3 py-1 text-xs font-semibold text-sim-foreground">
            <FlaskConical className="size-3.5" aria-hidden />
            Ambiente de Simulação
          </span>
        </Documented>

        <Documented docId="global.modo-desenvolvedor" inline>
          <div className="flex items-center gap-2 px-1">
            <Label htmlFor="dev-mode" className="cursor-pointer text-xs font-medium">
              Modo Desenvolvedor
            </Label>
            <Switch id="dev-mode" checked={devMode} onCheckedChange={setDevMode} />
          </div>
        </Documented>
      </div>
    </header>
  );
}
