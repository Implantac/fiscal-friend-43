import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import { PageHeader } from "@/components/layout/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { StatusBadge, ProcedenciaNota, EtiquetaDidatica } from "@/components/knowledge/StatusBadge";
import { FichaRastreabilidade } from "@/components/knowledge/FichaRastreabilidade";
import { XmlViewer } from "@/components/knowledge/XmlViewer";
import {
  documentoSimuladoPadrao,
  executarRegras,
  base,
  type DocumentoSimulado,
} from "@/knowledge/regras";
import { campoById } from "@/knowledge/campos";
import { cstatByCodigo } from "@/knowledge/cstats";
import { brl } from "@/lib/format";

export const Route = createFileRoute("/debugger")({
  validateSearch: (s: Record<string, unknown>) => ({
    regra: typeof s["regra"] === "string" ? s["regra"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Fiscal Debugger — diagnóstico didático de regras" },
      {
        name: "description",
        content:
          "Execute o conjunto de regras didáticas sobre um documento simulado e investigue cada erro: regra, campo, valor informado, valor esperado, XML e correção.",
      },
      { property: "og:title", content: "Fiscal Debugger — diagnóstico didático de regras" },
      {
        property: "og:description",
        content: "Regra → campo → valor esperado → impacto → XML → correção → prevenção.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DebuggerPage,
});

function DebuggerPage() {
  const { regra: regraUrl } = Route.useSearch();
  const [doc, setDoc] = useState<DocumentoSimulado>(documentoSimuladoPadrao);
  const [selecionada, setSelecionada] = useState<string | undefined>(regraUrl);

  const resultados = useMemo(() => executarRegras(doc), [doc]);
  const erros = resultados.filter((r) => !r.ok && r.regra.severidade === "erro");
  const alertas = resultados.filter((r) => !r.ok && r.regra.severidade === "alerta");
  const ok = resultados.filter((r) => r.ok);
  const detalhe = resultados.find((r) => r.regra.id === selecionada);

  const set = <K extends keyof DocumentoSimulado>(k: K, v: DocumentoSimulado[K]) =>
    setDoc((d) => ({ ...d, [k]: v }));

  const numero = (k: keyof DocumentoSimulado, label: string) => (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input
        type="number"
        value={String(doc[k])}
        onChange={(e) => set(k, Number(e.target.value) as never)}
      />
    </div>
  );

  const texto = (k: keyof DocumentoSimulado, label: string) => (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input value={String(doc[k])} onChange={(e) => set(k, e.target.value as never)} />
    </div>
  );

  return (
    <div className="space-y-5">
      <PageHeader
        titulo="Fiscal Debugger"
        descricao="Motor de diagnóstico didático. As regras abaixo são deste ambiente de ensino — não reproduzem o validador oficial."
        acoes={
          <div className="flex items-center gap-2">
            <EtiquetaDidatica texto="Regras didáticas" />
            <Button variant="outline" size="sm" onClick={() => setDoc(documentoSimuladoPadrao)}>
              Restaurar cenário
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Documento simulado</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              {texto("ufOrigem", "UF origem")}
              {texto("ufDestino", "UF destino")}
              {texto("cfop", "CFOP")}
              {texto("ncm", "NCM")}
              {texto("cst", "CST / CSOSN")}
              {numero("aliquotaIcms", "Alíquota ICMS (%)")}
              {numero("quantidade", "Quantidade")}
              {numero("valorUnitario", "Valor unitário")}
              {numero("desconto", "Desconto")}
              {numero("frete", "Frete")}
              {numero("valorIcmsInformado", "ICMS informado")}
              {numero("totalInformado", "Total informado")}
              {numero("difalInformado", "DIFAL informado")}
              {numero("pagamentoInformado", "Pagamento informado")}
              {texto("condutorCpf", "CPF do condutor")}
              {texto("tomador", "Tomador (CT-e)")}
            </div>
            {texto("chaveReferenciada", "Chave referenciada")}
            {texto("justificativa", "Justificativa da manifestação")}
            {texto("descricaoServico", "Discriminação do serviço")}

            <div className="flex flex-wrap gap-4 pt-1">
              <label className="flex items-center gap-2 text-xs">
                <Switch
                  checked={doc.consumidorFinal}
                  onCheckedChange={(v) => set("consumidorFinal", v)}
                />
                Consumidor final
              </label>
              <label className="flex items-center gap-2 text-xs">
                <Switch checked={doc.contribuinte} onCheckedChange={(v) => set("contribuinte", v)} />
                Contribuinte
              </label>
              <label className="flex items-center gap-2 text-xs">
                <Switch
                  checked={doc.regime === "simples"}
                  onCheckedChange={(v) => set("regime", v ? "simples" : "normal")}
                />
                Simples Nacional
              </label>
            </div>

            <p className="rounded-md bg-muted p-2 text-xs text-muted-foreground">
              Base calculada do item: <strong>{brl(base(doc))}</strong> (quantidade × unitário −
              desconto + frete).
            </p>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">
                {resultados.length} regras executadas
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-2 text-xs font-semibold">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--auto-surface)] px-3 py-1 text-[var(--auto-foreground)]">
                  <CheckCircle2 className="size-3.5" aria-hidden /> {ok.length} OK
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-sim-surface px-3 py-1 text-sim-foreground">
                  <AlertTriangle className="size-3.5" aria-hidden /> {alertas.length} alertas
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-destructive/10 px-3 py-1 text-destructive">
                  <XCircle className="size-3.5" aria-hidden /> {erros.length} erros
                </span>
              </div>

              <ul className="divide-y rounded-md border">
                {resultados.map((r) => (
                  <li key={r.regra.id}>
                    <button
                      type="button"
                      onClick={() => setSelecionada(r.regra.id)}
                      className={`flex w-full items-start gap-3 px-3 py-2 text-left transition-colors hover:bg-accent/60 ${
                        selecionada === r.regra.id ? "bg-accent" : ""
                      }`}
                    >
                      {r.ok ? (
                        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-[var(--auto)]" aria-hidden />
                      ) : r.regra.severidade === "erro" ? (
                        <XCircle className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
                      ) : (
                        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-sim" aria-hidden />
                      )}
                      <span className="min-w-0">
                        <span className="block font-mono text-xs text-muted-foreground">
                          {r.regra.id}
                        </span>
                        <span className="block text-sm">{r.regra.titulo}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          {detalhe && (
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-base">{detalhe.regra.titulo}</CardTitle>
                  <StatusBadge status={detalhe.regra.procedencia.status} />
                </div>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="rounded-md border p-2">
                    <p className="text-[11px] uppercase text-muted-foreground">Valor informado</p>
                    <p className="font-mono text-sm">{detalhe.informado}</p>
                  </div>
                  <div className="rounded-md border p-2">
                    <p className="text-[11px] uppercase text-muted-foreground">Valor esperado</p>
                    <p className="font-mono text-sm">{detalhe.esperado}</p>
                  </div>
                </div>

                <Secao titulo="Explicação">{detalhe.regra.explicacaoSimples}</Secao>
                <Secao titulo="Regra técnica">
                  <code className="block rounded bg-muted px-2 py-1 font-mono text-xs">
                    {detalhe.regra.condicaoTecnica}
                  </code>
                </Secao>
                <Secao titulo="Impacto">{detalhe.regra.impacto}</Secao>

                {detalhe.regra.campos.map((cid) => {
                  const campo = campoById.get(cid);
                  if (!campo) return null;
                  return (
                    <Secao key={cid} titulo={`XML — ${campo.tagXml}`}>
                      <XmlViewer xml={campo.exemploXml} />
                      <Link
                        to="/conhecimento"
                        search={{ doc: campo.documento, campo: campo.id }}
                        className="text-xs text-primary hover:underline"
                      >
                        Ver ficha completa do campo
                      </Link>
                    </Secao>
                  );
                })}

                <Secao titulo="Correção">{detalhe.regra.correcao}</Secao>
                <Secao titulo="Prevenção no ERP">{detalhe.regra.prevencao}</Secao>

                {detalhe.regra.cstats.length > 0 && (
                  <Secao titulo="Rejeições relacionadas">
                    <ul className="space-y-1">
                      {detalhe.regra.cstats.map((code) => (
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
                  </Secao>
                )}

                <ProcedenciaNota p={detalhe.regra.procedencia} />
                <FichaRastreabilidade tipo="regra" id={detalhe.regra.id} />
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="space-y-1">
      <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {titulo}
      </h3>
      <div className="space-y-1.5">{children}</div>
    </section>
  );
}
