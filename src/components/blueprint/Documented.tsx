import type { ReactNode } from "react";
import { BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSimulator } from "@/blueprint/SimulatorProvider";

/**
 * Envolve um elemento de interface documentado no catálogo.
 * No Modo Desenvolvedor marca discretamente o elemento e, em clique ou foco
 * por teclado, atualiza o painel de engenharia — sem impedir o comportamento normal.
 */
export function Documented({
  docId,
  children,
  className,
  inline,
}: {
  docId: string;
  children: ReactNode;
  className?: string;
  inline?: boolean;
}) {
  const { devMode, selectDoc, docId: ativo } = useSimulator();

  if (!devMode) return <div className={className}>{children}</div>;

  return (
    <div
      className={cn(
        "relative rounded-md transition-shadow",
        "doc-marked",
        ativo === docId && "ring-2 ring-primary",
        inline ? "inline-block" : "block",
        className,
      )}
      onClickCapture={() => selectDoc(docId)}
      onFocusCapture={() => selectDoc(docId)}
    >
      <button
        type="button"
        onClick={() => selectDoc(docId)}
        title="Abrir documentação técnica deste elemento"
        aria-label="Abrir documentação técnica deste elemento"
        className="absolute -right-1 -top-1 z-10 rounded-full bg-primary p-0.5 text-primary-foreground shadow-sm"
      >
        <BookOpen className="size-3" aria-hidden />
      </button>
      {children}
    </div>
  );
}
