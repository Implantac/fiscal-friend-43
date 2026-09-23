import { useEffect, useMemo, useState } from "react";
import { testesRascunhoRepo, type TesteRascunho } from "@/knowledge/testes-rascunho";
import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/layout/AppShell";
import { StatusBadge } from "@/components/knowledge/StatusBadge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { executarTestes, type ExecucaoTeste } from "@/knowledge/testes";
import { documentoById } from "@/knowledge/documentos";
import { executarTestesCalculo } from "@/knowledge/testes-calculo";
import { calculoById } from "@/knowledge/calculos";
import { brl } from "@/lib/format";

export const Route = createFileRoute("/regressao")({
  head: () => ({
    meta: [
      { title: "Regressão fiscal — Simulador Fiscal" },
      { name: "description", content: "Casos de teste didáticos executados contra as regras do simulador para detectar o que quebra quando uma regra muda." },
      { property: "og:title", content: "Regressão fiscal — Simulador Fiscal" },
      { property: "og:description", content: "Casos de teste por documento, regra, UF e operação, com resultado esperado e obtido." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RegressaoPage,
});

function RegressaoPage() {
  const [execucao, setExecucao] = useState<ExecucaoTeste[]>(() => executarTestes());
  const [doc, setDoc] = useState("");
  const [status, setStatus] = useState("");
  const [operacao, setOperacao] = useState("");
  const [execCalc, setExecCalc] = useState(() => executarTestesCalculo());

  const lista = useMemo(
    () =>
      execucao.filter(
        (e) =>
          (!doc || e.teste.documento === doc) &&
          (!status || e.resultado === status) &&
          (!operacao || e.teste.operacao === operacao),
      ),
    [execucao, doc, status, operacao],
  );
  const aprovados = execucao.filter((e) => e.resultado === "aprovado").length;
  const falhas = execucao.length - aprovados;
  const docs = [...new Set(execucao.map((e) => e.teste.documento))];
  const ops = [...new Set(execucao.map((e) => e.teste.operacao))];

  const Filtro = ({ v, set, opcoes, rotulo }: { v: string; set: (s: string) => void; opcoes: [string, string][]; rotulo: string }) => (
    <label className="space-y-1 text-xs">
      <span className="font-medium">{rotulo}</span>
      <select value={v} onChange={(e) => set(e.target.value)} className="block w-44 rounded-md border bg-background px-2 py-1.5 text-sm">
        <option value="">Todos</option>
        {opcoes.map(([k, t]) => <option key={k} value={k}>{t}</option>)}
      </select>
    </label>
  );

  return (
    <div className="space-y-5">
      <PageHeader
        titulo="Regressão fiscal"
        descricao="Cada caso aplica uma variação a um documento simulado e confere a regra. Se uma regra mudar, os casos mostram o que deixou de funcionar. Casos didáticos."
        acoes={<Button onClick={() => { setExecucao(executarTestes()); setExecCalc(executarTestesCalculo()); }}>Executar novamente</Button>}
      />
      <div className="grid grid-cols-3 gap-3">
        {[["Casos", execucao.length], ["Aprovados", aprovados], ["Falhas", falhas]].map(([t, n]) => (
          <div key={t} className="rounded-lg border bg-surface p-3">
            <p className="text-xs text-muted-foreground">{t}</p>
            <p className="font-mono text-2xl font-semibold">{n}</p>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-3">
        <Filtro rotulo="Documento" v={doc} set={setDoc} opcoes={docs.map((d) => [d, documentoById.get(d)?.sigla ?? d])} />
        <Filtro rotulo="Operação" v={operacao} set={setOperacao} opcoes={ops.map((o) => [o, o])} />
        <Filtro rotulo="Resultado" v={status} set={setStatus} opcoes={[["aprovado", "Aprovado"], ["falha", "Falha"]]} />
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>ID</TableHead><TableHead>Documento</TableHead><TableHead>Cenário</TableHead><TableHead>UF</TableHead>
            <TableHead>Regra</TableHead><TableHead>Esperado</TableHead><TableHead>Obtido</TableHead><TableHead>Rejeição esperada</TableHead><TableHead>Resultado</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {lista.map(({ teste: t, resultado, regraAtendida }) => (
            <TableRow key={t.id}>
              <TableCell className="font-mono text-xs">{t.id}<div><StatusBadge status={t.status} /></div></TableCell>
              <TableCell>{documentoById.get(t.documento)?.sigla}</TableCell>
              <TableCell className="text-sm">{t.cenario}</TableCell>
              <TableCell className="text-xs">{t.uf}</TableCell>
              <TableCell><Link to="/debugger" search={{ regra: t.regraId }} className="font-mono text-xs text-primary hover:underline">{t.regraId}</Link></TableCell>
              <TableCell className="text-xs">{t.esperaAtender ? "Regra atendida" : "Regra aponta falha"}</TableCell>
              <TableCell className="text-xs">{regraAtendida === undefined ? "—" : regraAtendida ? "Regra atendida" : "Regra aponta falha"}</TableCell>
              <TableCell>{t.cstatEsperado ? <Link to="/cstat" search={{ codigo: t.cstatEsperado }} className="font-mono text-xs text-primary hover:underline">{t.cstatEsperado}</Link> : "—"}</TableCell>
              <TableCell className={resultado === "aprovado" ? "text-validated font-semibold" : "text-destructive font-semibold"}>
                {resultado === "aprovado" ? "Aprovado" : resultado === "falha" ? "Falha" : "Regra ausente"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <section className="space-y-2 pt-4">
        <h2 className="text-base font-semibold">Casos de teste dos cálculos</h2>
        <p className="text-sm text-muted-foreground">
          Valor esperado feito à mão a partir da fórmula do laboratório de cálculos. Exemplo didático, não é apuração.
          Aprovados: {execCalc.filter((e) => e.aprovado).length} de {execCalc.length}.
        </p>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead><TableHead>Cálculo</TableHead><TableHead>Caso</TableHead>
              <TableHead className="text-right">Esperado</TableHead><TableHead className="text-right">Obtido</TableHead><TableHead>Resultado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {execCalc.map(({ teste: t, obtido, aprovado }) => (
              <TableRow key={t.id}>
                <TableCell className="font-mono text-xs">{t.id}<div><StatusBadge status="ilustrativo" /></div></TableCell>
                <TableCell><Link to="/math-lab" search={{ calc: t.calculoId } as never} className="text-sm text-primary hover:underline">{calculoById.get(t.calculoId)?.nome ?? t.calculoId}</Link></TableCell>
                <TableCell className="text-sm">{t.descricao}</TableCell>
                <TableCell className="text-right font-mono text-sm">{brl(t.esperado)}</TableCell>
                <TableCell className="text-right font-mono text-sm">{obtido === null ? "—" : brl(obtido)}</TableCell>
                <TableCell className={aprovado ? "text-validated font-semibold" : "text-destructive font-semibold"}>{aprovado ? "Aprovado" : "Falha"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>
      <RascunhosIncidentes />
    </div>
  );
}

function RascunhosIncidentes() {
  const [itens, setItens] = useState<TesteRascunho[]>([]);
  useEffect(() => setItens(testesRascunhoRepo.listar()), []);
  const mudar = (t: TesteRascunho, status: TesteRascunho["status"]) =>
    setItens(testesRascunhoRepo.salvar({ ...t, status }));
  const rot = { pendente_aprovacao: "Pendente de aprovação", aprovado: "Aprovado", descartado: "Descartado" };
  return (
    <section className="space-y-2 pt-4">
      <h2 className="text-base font-semibold">Casos vindos de incidentes</h2>
      <p className="text-sm text-muted-foreground">
        Problema do ERP → incidente → conhecimento → caso de regressão. Salvos neste navegador.{" "}
        <Link to="/incidentes" className="text-primary hover:underline">Registrar incidente</Link>
      </p>
      {itens.length === 0 ? (
        <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">Nenhum caso gerado a partir de incidentes ainda.</p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {itens.map((t) => (
            <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-xs">
              <div className="min-w-0">
                <p className="font-medium"><span className="font-mono">{t.id}</span> · {t.cenario}</p>
                <p className="text-muted-foreground">Regras: {t.regras.join(", ") || "—"} · Esperado: {t.esperado}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded border px-1.5 py-0.5 font-semibold">{rot[t.status]}</span>
                {t.status === "pendente_aprovacao" && (
                  <>
                    <Button size="sm" variant="outline" className="h-6 text-xs" onClick={() => mudar(t, "aprovado")}>Aprovar</Button>
                    <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => mudar(t, "descartado")}>Descartar</Button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
