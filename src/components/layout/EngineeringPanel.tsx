import { BookOpen, X } from "lucide-react";
import { catalogById, estadoLabel, type EstadoConfianca } from "@/blueprint/catalog";
import { useSimulator } from "@/blueprint/SimulatorProvider";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";

const corEstado: Record<EstadoConfianca, string> = {
  validado: "bg-[var(--auto-surface)] text-[var(--auto-foreground)]",
  ilustrativo: "bg-accent text-accent-foreground",
  pendente: "bg-sim-surface text-sim-foreground",
};

function Selo({ estado }: { estado: EstadoConfianca }) {
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${corEstado[estado]}`}
    >
      {estadoLabel[estado]}
    </span>
  );
}

function Bloco({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="space-y-1.5">
      <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {titulo}
      </h3>
      <div className="text-sm leading-relaxed">{children}</div>
    </section>
  );
}

export function EngineeringPanel() {
  const { devMode, docId, selectDoc } = useSimulator();
  if (!devMode) return null;

  const entry = docId ? catalogById.get(docId) : undefined;

  return (
    <aside
      aria-label="Painel de engenharia"
      className="flex w-[380px] shrink-0 flex-col border-l bg-surface"
    >
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <BookOpen className="size-4 text-primary" aria-hidden />
          <span className="text-sm font-semibold">Painel de engenharia</span>
        </div>
        {entry && (
          <Button variant="ghost" size="icon" onClick={() => selectDoc(null)} aria-label="Limpar seleção">
            <X className="size-4" />
          </Button>
        )}
      </div>

      <ScrollArea className="flex-1">
        {!entry ? (
          <div className="space-y-2 p-4 text-sm text-muted-foreground">
            <p>Nenhum elemento selecionado.</p>
            <p>
              Clique — ou navegue com Tab — até um elemento marcado para ver campo, mapeamento,
              responsabilidade do back-end, falhas e rastreabilidade.
            </p>
          </div>
        ) : (
          <div className="space-y-5 p-4">
            <div className="space-y-1">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                {entry.modulo} · {entry.tela}
              </p>
              <h2 className="text-base font-semibold">{entry.nome}</h2>
              <p className="text-xs text-muted-foreground">Elemento: {entry.elemento}</p>
              <Selo estado={entry.estado} />
            </div>

            <Bloco titulo="Finalidade">{entry.finalidade}</Bloco>

            <Bloco titulo="Tipo e obrigatoriedade">
              <p>{entry.tipo}</p>
              <p className="text-muted-foreground">{entry.obrigatoriedade}</p>
            </Bloco>

            <Bloco titulo="Validação de front-end">
              <ul className="list-disc space-y-1 pl-4">
                {entry.validacaoFront.map((v) => (
                  <li key={v}>{v}</li>
                ))}
              </ul>
            </Bloco>

            <Bloco titulo="Responsabilidade do back-end Python">
              <ul className="list-disc space-y-1 pl-4">
                {entry.backendPython.map((v) => (
                  <li key={v}>{v}</li>
                ))}
              </ul>
            </Bloco>

            <Bloco titulo="Mapeamento">
              <ul className="space-y-2">
                {entry.mapeamentos.map((m) => (
                  <li key={m.alvo + m.caminho} className="rounded-md border p-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold">{m.alvo}</span>
                      <Selo estado={m.estado} />
                    </div>
                    <code className="mt-1 block break-all font-mono text-xs text-muted-foreground">
                      {m.caminho}
                    </code>
                    {m.nota && <p className="mt-1 text-xs text-muted-foreground">{m.nota}</p>}
                  </li>
                ))}
              </ul>
            </Bloco>

            {entry.exemplo && (
              <Bloco titulo="Exemplo (ilustrativo)">
                <pre className="overflow-x-auto rounded-md bg-muted p-3 font-mono text-[11px] leading-relaxed">
                  {entry.exemplo}
                </pre>
              </Bloco>
            )}

            {entry.falhas.length > 0 && (
              <Bloco titulo="Falhas e tratamento">
                <ul className="space-y-2">
                  {entry.falhas.map((f) => (
                    <li key={f.situacao} className="rounded-md border p-2">
                      <p className="text-xs font-semibold">{f.origem}</p>
                      <p className="text-xs">{f.situacao}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{f.tratamento}</p>
                    </li>
                  ))}
                </ul>
              </Bloco>
            )}

            <Bloco titulo="Rastreabilidade">
              <p>{entry.rastreabilidade.fonte}</p>
              {entry.rastreabilidade.versao && (
                <p className="text-muted-foreground">Versão: {entry.rastreabilidade.versao}</p>
              )}
              {entry.rastreabilidade.dataReferencia && (
                <p className="text-muted-foreground">
                  Data de referência: {entry.rastreabilidade.dataReferencia}
                </p>
              )}
              {entry.rastreabilidade.condicoes && (
                <p className="text-muted-foreground">{entry.rastreabilidade.condicoes}</p>
              )}
            </Bloco>

            {entry.pendencias && entry.pendencias.length > 0 && (
              <Bloco titulo="Pendências explícitas">
                <ul className="list-disc space-y-1 pl-4 text-sm">
                  {entry.pendencias.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              </Bloco>
            )}
          </div>
        )}
      </ScrollArea>
    </aside>
  );
}
