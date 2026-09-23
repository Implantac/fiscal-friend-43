import { useSimulator } from "@/blueprint/SimulatorProvider";

export function Footer() {
  const { log } = useSimulator();
  const ultimo = log[0];

  return (
    <footer className="flex h-9 shrink-0 items-center justify-between gap-4 border-t bg-surface px-4 text-xs text-muted-foreground">
      <div className="flex items-center gap-4">
        <span>
          <kbd className="rounded border px-1 font-mono">F9</kbd> salvar rascunho simulado
        </span>
        <span>
          <kbd className="rounded border px-1 font-mono">F10</kbd> transmitir (simulado)
        </span>
        <span className="hidden md:inline">
          <kbd className="rounded border px-1 font-mono">Tab</kbd> navegação por teclado
        </span>
      </div>
      <p className="truncate">
        {ultimo ? `Última ação: ${ultimo.texto}` : "Nenhuma ação simulada nesta sessão"}
      </p>
    </footer>
  );
}
