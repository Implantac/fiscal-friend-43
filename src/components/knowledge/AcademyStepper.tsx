import { useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { ChevronDown, GraduationCap } from "lucide-react";
import { documentos } from "@/knowledge/documentos";
import { camposPorDocumento } from "@/knowledge/campos";
import { StatusBadge } from "./StatusBadge";

const etapas = [
  "Aprender",
  "Simular",
  "Calcular",
  "Gerar XML",
  "Validar",
  "Gerar erro",
  "Diagnosticar",
  "Corrigir",
] as const;

const efeitosManifestacao = [
  ["Ciência da Emissão", "Registra que a nota chegou ao conhecimento do destinatário; não confirma a operação."],
  ["Confirmação da Operação", "Declara que a operação aconteceu como descrita na nota."],
  ["Desconhecimento da Operação", "Declara que o destinatário não reconhece a operação; exige justificativa."],
  ["Operação não Realizada", "A operação foi reconhecida, mas não se concretizou; exige justificativa."],
];

/** Faixa de academia exibida no topo de cada módulo fiscal. Conteúdo sempre didático. */
export function AcademyStepper() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const doc = documentos.find((d) => d.rota === path) ?? (path === "/" ? documentos.find((d) => d.id === "eventos") : undefined);
  const [aberto, setAberto] = useState(false);
  if (!doc) return null;
  const campos = camposPorDocumento(doc.id);

  const destino = (e: (typeof etapas)[number]) => {
    switch (e) {
      case "Calcular": return { to: "/math-lab" as const };
      case "Gerar XML": return { to: "/xml-lab" as const };
      case "Validar":
      case "Gerar erro": return { to: "/debugger" as const };
      case "Diagnosticar": return { to: "/cstat" as const };
      case "Corrigir": return { to: "/academia" as const };
      default: return null;
    }
  };

  return (
    <section className="mb-4 rounded-lg border bg-surface">
      <div className="flex flex-wrap items-center gap-2 px-3 py-2">
        <GraduationCap className="size-4 text-primary" aria-hidden />
        <span className="text-xs font-semibold">Academia · {doc.sigla}</span>
        <ol className="flex flex-wrap items-center gap-1 text-[11px]">
          {etapas.map((e, i) => {
            const d = destino(e);
            const cls = "rounded-full border px-2 py-0.5 hover:bg-accent";
            return (
              <li key={e} className="flex items-center gap-1">
                {e === "Aprender" ? (
                  <button className={cls} onClick={() => setAberto((a) => !a)}>{e}</button>
                ) : d ? (
                  <Link to={d.to} className={cls}>{e}</Link>
                ) : (
                  <span className={`${cls} bg-accent`}>{e} (esta tela)</span>
                )}
                {i < etapas.length - 1 && <span className="text-muted-foreground">→</span>}
              </li>
            );
          })}
        </ol>
        <button
          onClick={() => setAberto((a) => !a)}
          className="ml-auto flex items-center gap-1 text-xs text-primary"
          aria-expanded={aberto}
        >
          {aberto ? "Fechar aula" : "Abrir aula"}
          <ChevronDown className={`size-3 transition-transform ${aberto ? "rotate-180" : ""}`} />
        </button>
      </div>

      {aberto && (
        <div className="grid gap-4 border-t p-4 text-sm md:grid-cols-3">
          <div className="space-y-2 md:col-span-2">
            <div className="flex items-center gap-2">
              <h2 className="font-semibold">{doc.nome}</h2>
              <StatusBadge status={doc.procedencia.status} />
            </div>
            <p>{doc.oQueE}</p>
            <p className="text-muted-foreground">{doc.porQueExiste}</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <p className="text-xs font-semibold">Quando usar</p>
                <ul className="list-disc pl-4 text-xs">{doc.quandoUsar.map((q) => <li key={q}>{q}</li>)}</ul>
              </div>
              <div>
                <p className="text-xs font-semibold">Quando não usar</p>
                <ul className="list-disc pl-4 text-xs">{doc.quandoNaoUsar.map((q) => <li key={q}>{q}</li>)}</ul>
              </div>
            </div>
            {doc.id === "eventos" && (
              <div className="space-y-2">
                <p className="text-xs font-semibold">
                  NF-e recebida → manifestação → evento → protocolo → consequência
                </p>
                <ul className="grid gap-2 sm:grid-cols-2">
                  {efeitosManifestacao.map(([t, e]) => (
                    <li key={t} className="rounded-md border p-2 text-xs">
                      <p className="font-semibold">{t}</p>
                      <p className="text-muted-foreground">{e}</p>
                    </li>
                  ))}
                </ul>
                <p className="text-[11px] text-muted-foreground">
                  Prazos e efeitos legais: Pendente de validação em fonte oficial.
                </p>
              </div>
            )}
          </div>
          <div className="space-y-3">
            <div>
              <p className="text-xs font-semibold">Fluxo</p>
              <ol className="mt-1 space-y-1 text-xs">
                {doc.fluxo.map((f, i) => (
                  <li key={f} className="flex gap-2"><span className="font-mono text-muted-foreground">{i + 1}.</span>{f}</li>
                ))}
              </ol>
            </div>
            {campos.length > 0 && (
              <div>
                <p className="text-xs font-semibold">Campos para estudar</p>
                <ul className="mt-1 flex flex-wrap gap-1">
                  {campos.map((c) => (
                    <li key={c.id}>
                      <Link
                        to="/conhecimento"
                        search={{ doc: c.documento, campo: c.id }}
                        className="rounded border px-1.5 py-0.5 font-mono text-[11px] hover:bg-accent"
                      >
                        {c.tagXml}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
