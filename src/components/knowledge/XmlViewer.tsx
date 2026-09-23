import { useMemo } from "react";
import { cn } from "@/lib/utils";

/** Formata XML com indentação simples. Não valida esquema — é leitura didática. */
export function formatarXml(xml: string) {
  const compacto = xml.replace(/>\s+</g, "><").trim();
  let nivel = 0;
  const linhas: string[] = [];
  compacto
    .replace(/></g, ">\n<")
    .split("\n")
    .forEach((linha) => {
      const fecha = /^<\//.test(linha);
      if (fecha) nivel = Math.max(0, nivel - 1);
      linhas.push(`${"  ".repeat(nivel)}${linha}`);
      const abre = /^<[^/!?]/.test(linha) && !/\/>$/.test(linha) && !/<\/[\w:.-]+>$/.test(linha);
      if (abre) nivel += 1;
    });
  return linhas.join("\n");
}

export const tagDaLinha = (linha: string) => {
  const m = linha.match(/<\/?([\w:.-]+)/);
  return m?.[1] ?? "";
};

export function XmlViewer({
  xml,
  formatar = true,
  destaque,
  tagSelecionada,
  onSelecionarTag,
  className,
}: {
  xml: string;
  formatar?: boolean | undefined;
  destaque?: string | undefined;
  tagSelecionada?: string | undefined;
  onSelecionarTag?: ((tag: string) => void) | undefined;
  className?: string | undefined;
}) {
  const linhas = useMemo(
    () => (formatar ? formatarXml(xml) : xml).split("\n"),
    [xml, formatar],
  );
  const busca = destaque?.trim().toLowerCase() ?? "";

  return (
    <div className={cn("overflow-x-auto rounded-md border bg-muted/50 font-mono text-xs", className)}>
      {linhas.map((linha, i) => {
        const tag = tagDaLinha(linha);
        const marcada = !!busca && linha.toLowerCase().includes(busca);
        const ativa = !!tagSelecionada && tag === tagSelecionada;
        return (
          <button
            key={`${i}-${linha}`}
            type="button"
            onClick={() => tag && onSelecionarTag?.(tag)}
            className={cn(
              "flex w-full items-start gap-3 px-3 py-0.5 text-left transition-colors hover:bg-accent/60",
              marcada && "bg-sim-surface",
              ativa && "bg-accent",
            )}
          >
            <span className="w-8 shrink-0 select-none text-right text-muted-foreground">{i + 1}</span>
            <span className="whitespace-pre">{linha}</span>
          </button>
        );
      })}
    </div>
  );
}

/** Comparação linha a linha entre XML correto e incorreto. */
export function XmlDiff({ correto, incorreto }: { correto: string; incorreto: string }) {
  const a = formatarXml(correto).split("\n");
  const b = formatarXml(incorreto).split("\n");
  const total = Math.max(a.length, b.length);

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {[
        { titulo: "XML correto", linhas: a, outras: b },
        { titulo: "XML incorreto", linhas: b, outras: a },
      ].map((lado) => (
        <div key={lado.titulo} className="overflow-hidden rounded-md border">
          <p className="border-b bg-muted px-3 py-1.5 text-xs font-semibold">{lado.titulo}</p>
          <div className="overflow-x-auto font-mono text-xs">
            {Array.from({ length: total }).map((_, i) => {
              const linha = lado.linhas[i] ?? "";
              const diferente = (lado.outras[i] ?? "") !== linha;
              return (
                <div
                  key={i}
                  className={cn(
                    "flex items-start gap-3 px-3 py-0.5",
                    diferente && linha && "bg-destructive/10",
                  )}
                >
                  <span className="w-8 shrink-0 select-none text-right text-muted-foreground">
                    {i + 1}
                  </span>
                  <span className="whitespace-pre">{linha}</span>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
