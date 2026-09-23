import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import { PageHeader } from "@/components/layout/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { XmlViewer } from "@/components/knowledge/XmlViewer";
import { EtiquetaDidatica } from "@/components/knowledge/StatusBadge";
import { trilhas, desafios } from "@/knowledge/academia";
import { campos, campoById } from "@/knowledge/campos";
import { regras } from "@/knowledge/regras";
import { cstats, cstatByCodigo } from "@/knowledge/cstats";

export const Route = createFileRoute("/academia")({
  validateSearch: (s: Record<string, unknown>) => ({
    trilha: typeof s["trilha"] === "string" ? s["trilha"] : undefined,
    desafio: typeof s["desafio"] === "string" ? s["desafio"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Academia fiscal do desenvolvedor — Fiscal Friend" },
      {
        name: "description",
        content:
          "Doze trilhas de aprendizado fiscal e desafios de diagnóstico: analise o XML, identifique campo, regra e rejeição, corrija e teste.",
      },
      { property: "og:title", content: "Academia fiscal do desenvolvedor — Fiscal Friend" },
      {
        property: "og:description",
        content: "Aprender → simular → errar → investigar → corrigir.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Academia,
});

function Academia() {
  const { trilha, desafio } = Route.useSearch();

  return (
    <div className="space-y-5">
      <PageHeader
        titulo="Academia fiscal"
        descricao="Trilhas de aprendizado e desafios de diagnóstico. O conteúdo ensina o raciocínio fiscal; nenhuma aula substitui o manual oficial."
        acoes={<EtiquetaDidatica texto="Conteúdo de ensino" />}
      />

      <Tabs defaultValue={desafio ? "desafios" : "trilhas"}>
        <TabsList>
          <TabsTrigger value="trilhas">12 trilhas</TabsTrigger>
          <TabsTrigger value="desafios">Desafios práticos</TabsTrigger>
        </TabsList>

        <TabsContent value="trilhas" className="pt-4">
          <div className="grid gap-4 md:grid-cols-2">
            {trilhas.map((t) => (
              <Card key={t.id} id={t.id}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">
                    {t.numero}. {t.titulo}
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">{t.resumo}</p>
                </CardHeader>
                <CardContent>
                  <Accordion
                    type="single"
                    collapsible
                    defaultValue={trilha === t.id ? t.aulas[0]?.id : undefined}
                  >
                    {t.aulas.map((a) => (
                      <AccordionItem key={a.id} value={a.id}>
                        <AccordionTrigger className="text-left text-sm">{a.titulo}</AccordionTrigger>
                        <AccordionContent className="space-y-2 text-sm">
                          {[
                            ["Conceito", a.conceito],
                            ["Exemplo", a.exemplo],
                            ["Simulação", a.simulacao],
                            ["Exercício", a.exercicio],
                            ["Erro proposital", a.erroProposital],
                            ["Diagnóstico", a.diagnostico],
                            ["Solução", a.solucao],
                            ["Teste final", a.testeFinal],
                          ].map(([k, v]) => (
                            <div key={k}>
                              <p className="text-[11px] font-semibold uppercase text-muted-foreground">
                                {k}
                              </p>
                              <p>{v}</p>
                            </div>
                          ))}
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="desafios" className="space-y-4 pt-4">
          {desafios.map((d) => (
            <Desafio key={d.id} id={d.id} aberto={desafio === d.id} />
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Desafio({ id, aberto }: { id: string; aberto: boolean }) {
  const d = desafios.find((x) => x.id === id)!;
  const [campo, setCampo] = useState("");
  const [regra, setRegra] = useState("");
  const [cstat, setCstat] = useState("");
  const [enviado, setEnviado] = useState(false);

  const acertos = {
    campo: campo === d.campoCorreto,
    regra: regra === d.regraCorreta,
    cstat: cstat === d.cstatCorreto,
  };
  const tudoCerto = acertos.campo && acertos.regra && acertos.cstat;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{d.titulo}</CardTitle>
        <p className="text-sm text-muted-foreground">{d.enunciado}</p>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <XmlViewer xml={d.xml} />

        <div className="grid gap-3 md:grid-cols-3">
          <Escolha
            label="Campo responsável"
            valor={campo}
            onChange={setCampo}
            opcoes={campos.map((c) => ({ v: c.id, t: `${c.tagXml} — ${c.nome}` }))}
          />
          <Escolha
            label="Regra violada"
            valor={regra}
            onChange={setRegra}
            opcoes={regras.map((r) => ({ v: r.id, t: `${r.id} — ${r.titulo}` }))}
          />
          <Escolha
            label="Família de rejeição"
            valor={cstat}
            onChange={setCstat}
            opcoes={cstats.map((c) => ({ v: c.codigo, t: c.situacao }))}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={() => setEnviado(true)}>
            Verificar diagnóstico
          </Button>
          {(enviado || aberto) && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setEnviado(false);
                setCampo("");
                setRegra("");
                setCstat("");
              }}
            >
              Tentar de novo
            </Button>
          )}
        </div>

        {enviado && (
          <div
            className={`space-y-2 rounded-md border p-3 ${
              tudoCerto ? "border-[var(--auto-border)] bg-auto-surface" : "bg-destructive/5"
            }`}
          >
            <p className="flex items-center gap-2 font-semibold">
              {tudoCerto ? (
                <>
                  <CheckCircle2 className="size-4 text-[var(--auto)]" aria-hidden /> Diagnóstico
                  correto.
                </>
              ) : (
                <>
                  <XCircle className="size-4 text-destructive" aria-hidden /> Ainda não. Revise os
                  itens marcados.
                </>
              )}
            </p>
            <ul className="space-y-0.5 text-xs">
              <li>Campo: {acertos.campo ? "correto" : "reveja qual tag gerou o problema"}</li>
              <li>Regra: {acertos.regra ? "correta" : "abra o Fiscal Debugger e compare"}</li>
              <li>Rejeição: {acertos.cstat ? "correta" : "consulte a Central de rejeições"}</li>
            </ul>
            {tudoCerto && (
              <>
                <p>{d.explicacao}</p>
                <p className="text-muted-foreground">Correção: {d.correcao}</p>
                <div className="flex flex-wrap gap-3 pt-1 text-xs">
                  <Link
                    to="/conhecimento"
                    search={{
                      doc: campoById.get(d.campoCorreto)?.documento,
                      campo: d.campoCorreto,
                    }}
                    className="text-primary hover:underline"
                  >
                    Ficha do campo
                  </Link>
                  <Link
                    to="/cstat"
                    search={{ codigo: d.cstatCorreto }}
                    className="text-primary hover:underline"
                  >
                    {cstatByCodigo.get(d.cstatCorreto)?.situacao ?? "Rejeição"}
                  </Link>
                  <Link
                    to="/debugger"
                    search={{ regra: d.regraCorreta }}
                    className="text-primary hover:underline"
                  >
                    Regra no debugger
                  </Link>
                </div>
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Escolha({
  label,
  valor,
  onChange,
  opcoes,
}: {
  label: string;
  valor: string;
  onChange: (v: string) => void;
  opcoes: { v: string; t: string }[];
}) {
  return (
    <label className="space-y-1 text-xs">
      <span className="font-medium">{label}</span>
      <select
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border bg-background px-2 py-2 text-sm"
      >
        <option value="">Selecione…</option>
        {opcoes.map((o) => (
          <option key={o.v} value={o.v}>
            {o.t}
          </option>
        ))}
      </select>
    </label>
  );
}
