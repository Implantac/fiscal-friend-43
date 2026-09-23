import { BookOpen, X } from "lucide-react";
import { catalogById, estadoLabel, type EstadoConfianca } from "@/blueprint/catalog";
import { useSimulator } from "@/blueprint/SimulatorProvider";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";
import { campoPorDocId } from "@/knowledge/campos";
import { StatusBadge } from "@/components/knowledge/StatusBadge";
import { VersionTimeline } from "@/components/knowledge/VersionTimeline";

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
  const campo = docId ? campoPorDocId.get(docId) : undefined;

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

            {campo && (
              <div className="space-y-4 border-t pt-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wide text-primary">Base fiscal</p>
                  <StatusBadge status={campo.procedencia.status} />
                </div>
                <Bloco titulo="Identificação">
                  <code className="font-mono text-xs">{campo.grupoXml} / {campo.tagXml}</code>
                  <p className="text-xs text-muted-foreground">{campo.tipo} · {campo.obrigatoriedade}</p>
                </Bloco>
                <Bloco titulo="Conceito">
                  <p>{campo.conceito}</p>
                  <p className="text-muted-foreground">{campo.porQueExiste}</p>
                </Bloco>
                <Bloco titulo="Origem do dado">
                  <p>{campo.quemInforma}</p>
                  <p className="text-muted-foreground">{campo.origemDado}</p>
                </Bloco>
                {campo.calculoId && (
                  <Bloco titulo="Cálculo">
                    <Link to="/math-lab" className="text-primary hover:underline">Abrir no laboratório de cálculos</Link>
                  </Bloco>
                )}
                <Bloco titulo="XML (ilustrativo)">
                  <pre className="overflow-x-auto rounded-md bg-muted p-2 font-mono text-[11px]">{campo.exemploXml}</pre>
                </Bloco>
                <Bloco titulo="Regras e rejeições">
                  <div className="flex flex-wrap gap-1">
                    {campo.regras.map((r) => (
                      <Link key={r} to="/debugger" search={{ regra: r }} className="rounded border px-1.5 py-0.5 font-mono text-[11px] hover:bg-accent">{r}</Link>
                    ))}
                    {campo.cstats.map((c) => (
                      <Link key={c} to="/cstat" search={{ codigo: c }} className="rounded border px-1.5 py-0.5 font-mono text-[11px] hover:bg-accent">{c}</Link>
                    ))}
                  </div>
                </Bloco>
                <Bloco titulo="Implementação no ERP">
                  <ul className="list-disc space-y-1 pl-4">{campo.implementacaoErp.map((i) => <li key={i}>{i}</li>)}</ul>
                </Bloco>
                <Bloco titulo="Testes">
                  <ul className="list-disc space-y-1 pl-4">{campo.testes.map((i) => <li key={i}>{i}</li>)}</ul>
                </Bloco>
                <Bloco titulo="Versão e vigência">
                  <VersionTimeline procedencia={campo.procedencia} />
                </Bloco>
              </div>
            )}
          </div>
        )}
      </ScrollArea>
    </aside>
  );
}
