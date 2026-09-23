import { useEffect, type ReactNode } from "react";
import { toast } from "sonner";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { Footer } from "./Footer";
import { EngineeringPanel } from "./EngineeringPanel";
import { useSimulator } from "@/blueprint/SimulatorProvider";
import { AcademyStepper } from "@/components/knowledge/AcademyStepper";

/** F9 e F10 executam apenas ações simuladas. Nunca disparam operação fiscal real. */
function useAtalhosSimulados() {
  const { registrarLog } = useSimulator();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "F9") {
        e.preventDefault();
        registrarLog("F9 — rascunho salvo na sessão (simulado)", "sucesso");
        toast.success("Rascunho salvo (simulado)", {
          description: "Nada foi gravado em sistema fiscal real.",
        });
      }
      if (e.key === "F10") {
        e.preventDefault();
        registrarLog("F10 — transmissão simulada solicitada", "sucesso");
        toast.success("Transmissão simulada executada", {
          description: "Nenhum documento foi enviado à SEFAZ ou a provedores.",
        });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [registrarLog]);
}

export function AppShell({ children }: { children: ReactNode }) {
  useAtalhosSimulados();

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header />
        <div className="flex min-h-0 flex-1">
          <main className="min-w-0 flex-1 overflow-y-auto p-5">
            <AcademyStepper />
            {children}
          </main>
          <EngineeringPanel />
        </div>
        <Footer />
      </div>
    </div>
  );
}

export function PageHeader({
  titulo,
  descricao,
  acoes,
}: {
  titulo: string;
  descricao: string;
  acoes?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{titulo}</h1>
        <p className="mt-0.5 max-w-3xl text-sm text-muted-foreground">{descricao}</p>
      </div>
      {acoes}
    </div>
  );
}
