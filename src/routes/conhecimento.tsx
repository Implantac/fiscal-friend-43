import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { PageHeader } from "@/components/layout/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { StatusBadge, ProcedenciaNota } from "@/components/knowledge/StatusBadge";
import { XmlViewer } from "@/components/knowledge/XmlViewer";
import { documentos, documentoById } from "@/knowledge/documentos";
import { campos, campoById, camposPorDocumento } from "@/knowledge/campos";
import { regraById } from "@/knowledge/regras";
import { cstatByCodigo } from "@/knowledge/cstats";
import { calculoById } from "@/knowledge/calculos";

export const Route = createFileRoute("/conhecimento")({
  validateSearch: (s: Record<string, unknown>) => ({
    doc: typeof s["doc"] === "string" ? s["doc"] : undefined,
    campo: typeof s["campo"] === "string" ? s["campo"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Base de conhecimento fiscal — Fiscal Friend" },
      {
        name: "description",
        content:
          "Conceito, regras, campos, dependências, cálculo, XML e rejeições de cada documento fiscal brasileiro, com status de validação.",
      },
      { property: "og:title", content: "Base de conhecimento fiscal — Fiscal Friend" },
      {
        property: "og:description",
        content: "Documento → operação → campo → cálculo → XML → validação → rejeição.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Conhecimento,
});

const MAPA = [
  "Documento",
  "Operação",
  "Tributação",
  "Campos",
  "Cálculos",
  "XML",
  "Validações",
  "Autorização",
  "Eventos",
  "Rejeições",
];

function Conhecimento() {
  const { doc, campo } = Route.useSearch();
  const [docAtivo, setDocAtivo] = useState(doc ?? "nfe55");
  const [campoAtivo, setCampoAtivo] = useState<string | undefined>(campo);

  const documento =
    documentos.find((d) => d.id === docAtivo) ?? documentoById.get("nfe55") ?? documentos[0]!;
  const campoSelecionado = campoAtivo ? campoById.get(campoAtivo) : undefined;
  const lista = camposPorDocumento(documento.id);

  return (
    <div className="space-y-5">
      <PageHeader
        titulo="Base de conhecimento fiscal"
        descricao="Cadeia completa: conceito → regra → campo → dependência → cálculo → XML → validação → rejeição → correção → teste. Todo item carrega seu status de validação."
      />

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Mapa fiscal</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-1.5">
          {MAPA.map((bloco, i) => (
            <span key={bloco} className="flex items-center gap-1.5">
              <span className="rounded-md border bg-surface px-2.5 py-1 text-xs font-medium">
                {bloco}
              </span>
              {i < MAPA.length - 1 && (
                <ArrowRight className="size-3 text-muted-foreground" aria-hidden />
              )}
            </span>
          ))}
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-1.5">
        {documentos.map((d) => (
          <button
            key={d.id}
            type="button"
            onClick={() => {
              setDocAtivo(d.id);
              setCampoAtivo(undefined);
            }}
            className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
              d.id === documento.id ? "bg-primary text-primary-foreground" : "bg-surface hover:bg-accent"
            }`}
          >
            {d.sigla}
            {d.modelo ? ` ${d.modelo}` : ""}
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-base">
                {documento.sigla} {documento.modelo} — {documento.nome}
              </CardTitle>
              <StatusBadge status={documento.procedencia.status} />
            </div>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <Tabs defaultValue="conceito">
              <TabsList>
                <TabsTrigger value="conceito">Conceito</TabsTrigger>
                <TabsTrigger value="uso">Quando usar</TabsTrigger>
                <TabsTrigger value="partes">Participantes</TabsTrigger>
                <TabsTrigger value="fluxo">Fluxo</TabsTrigger>
              </TabsList>

              <TabsContent value="conceito" className="space-y-3 pt-3">
                <div>
                  <p className="text-xs font-semibold uppercase text-muted-foreground">O que é</p>
                  <p>{documento.oQueE}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase text-muted-foreground">
                    Por que existe
                  </p>
                  <p>{documento.porQueExiste}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase text-muted-foreground">Eventos</p>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {documento.eventos.map((e) => (
                      <Badge key={e} variant="secondary">
                        {e}
                      </Badge>
                    ))}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="uso" className="grid gap-3 pt-3 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-semibold uppercase text-muted-foreground">Quando usar</p>
                  <ul className="list-disc space-y-1 pl-4 pt-1">
                    {documento.quandoUsar.map((x) => (
                      <li key={x}>{x}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase text-muted-foreground">
                    Quando não usar
                  </p>
                  <ul className="list-disc space-y-1 pl-4 pt-1">
                    {documento.quandoNaoUsar.map((x) => (
                      <li key={x}>{x}</li>
                    ))}
                  </ul>
                </div>
              </TabsContent>

              <TabsContent value="partes" className="space-y-2 pt-3">
                {documento.participantes.map((p) => (
                  <div key={p.papel} className="rounded-md border p-2">
                    <p className="text-xs font-semibold">{p.papel}</p>
                    <p className="text-xs text-muted-foreground">{p.descricao}</p>
                  </div>
                ))}
              </TabsContent>

              <TabsContent value="fluxo" className="pt-3">
                <ol className="space-y-1.5">
                  {documento.fluxo.map((passo, i) => (
                    <li key={passo} className="flex gap-2">
                      <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-secondary text-[11px] font-semibold">
                        {i + 1}
                      </span>
                      <span>{passo}</span>
                    </li>
                  ))}
                </ol>
              </TabsContent>
            </Tabs>

            <ProcedenciaNota p={documento.procedencia} />

            {documento.pendencias && (
              <div>
                <p className="text-xs font-semibold uppercase text-muted-foreground">Pendências</p>
                <ul className="list-disc space-y-1 pl-4 pt-1 text-xs text-muted-foreground">
                  {documento.pendencias.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              </div>
            )}

            <Link
              to={documento.rota}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
            >
              Abrir o módulo de simulação <ArrowRight className="size-3.5" aria-hidden />
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Campos documentados</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-1.5">
              {lista.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Nenhum campo cadastrado ainda para este documento.
                </p>
              )}
              {lista.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCampoAtivo(c.id)}
                  className={`rounded-md border px-2.5 py-1 font-mono text-xs transition-colors ${
                    campoSelecionado?.id === c.id
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-accent"
                  }`}
                >
                  {c.tagXml}
                </button>
              ))}
            </div>

            {campoSelecionado ? (
              <DetalheCampo id={campoSelecionado.id} />
            ) : (
              <p className="text-sm text-muted-foreground">
                Escolha uma tag para ver conceito, dependências, cálculo, XML, regras, rejeições e
                como implementar no ERP.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Bloco({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="space-y-1">
      <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {titulo}
      </h3>
      <div className="text-sm">{children}</div>
    </section>
  );
}

export function DetalheCampo({ id }: { id: string }) {
  const c = campoById.get(id);
  if (!c) return <p className="text-sm text-muted-foreground">Campo não encontrado.</p>;
  const calc = c.calculoId ? calculoById.get(c.calculoId) : undefined;

  return (
    <div className="space-y-4 border-t pt-3">
      <div className="space-y-1">
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
          {c.grupoXml} · {c.tipo}
        </p>
        <h2 className="text-base font-semibold">{c.nome}</h2>
        <p className="font-mono text-xs text-muted-foreground">{c.tagXml}</p>
        <StatusBadge status={c.procedencia.status} />
      </div>

      <Bloco titulo="Conceito">{c.conceito}</Bloco>
      <Bloco titulo="Por que existe">{c.porQueExiste}</Bloco>
      <Bloco titulo="Obrigatoriedade">{c.obrigatoriedade}</Bloco>
      <Bloco titulo="Quem informa / de onde vem">
        <p>{c.quemInforma}</p>
        <p className="text-muted-foreground">{c.origemDado}</p>
      </Bloco>

      <div className="grid gap-3 sm:grid-cols-2">
        <Bloco titulo="Depende de">
          <ul className="list-disc space-y-0.5 pl-4 text-sm">
            {c.dependeDe.length === 0 && <li className="text-muted-foreground">Sem dependências</li>}
            {c.dependeDe.map((d) => (
              <li key={d}>{d}</li>
            ))}
          </ul>
        </Bloco>
        <Bloco titulo="Influencia">
          <ul className="list-disc space-y-0.5 pl-4 text-sm">
            {c.influencia.map((d) => (
              <li key={d}>{d}</li>
            ))}
          </ul>
        </Bloco>
      </div>

      {calc && (
        <Bloco titulo="Cálculo">
          <p className="font-mono text-xs">{calc.formula}</p>
          <Link to="/math-lab" search={{ calc: calc.id }} className="text-xs text-primary hover:underline">
            Abrir no Laboratório de Cálculos
          </Link>
        </Bloco>
      )}

      <Bloco titulo="XML">
        <XmlViewer xml={c.exemploXml} />
      </Bloco>

      <Bloco titulo="Regras relacionadas">
        <ul className="space-y-1">
          {c.regras.length === 0 && <li className="text-muted-foreground">Nenhuma cadastrada.</li>}
          {c.regras.map((r) => (
            <li key={r}>
              <Link
                to="/debugger"
                search={{ regra: r }}
                className="font-mono text-xs text-primary hover:underline"
              >
                {r}
              </Link>
              <span className="ml-2 text-xs text-muted-foreground">
                {regraById.get(r)?.titulo ?? "Regra não cadastrada"}
              </span>
            </li>
          ))}
        </ul>
      </Bloco>

      <Bloco titulo="Rejeições relacionadas">
        <ul className="space-y-1">
          {c.cstats.map((code) => (
            <li key={code}>
              <Link
                to="/cstat"
                search={{ codigo: code }}
                className="text-xs text-primary hover:underline"
              >
                {cstatByCodigo.get(code)?.situacao ?? code}
              </Link>
            </li>
          ))}
        </ul>
      </Bloco>

      <Bloco titulo="Como implementar no ERP">
        <ul className="list-disc space-y-1 pl-4 text-sm">
          {c.implementacaoErp.map((i) => (
            <li key={i}>{i}</li>
          ))}
        </ul>
      </Bloco>

      <Bloco titulo="Como testar">
        <ul className="list-disc space-y-1 pl-4 text-sm">
          {c.testes.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      </Bloco>

      <ProcedenciaNota p={c.procedencia} />
    </div>
  );
}

export const totalCampos = campos.length;
