import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/layout/AppShell";
import { StatusBadge } from "@/components/knowledge/StatusBadge";
import { documentoSimuladoPadrao, executarRegras, base, type DocumentoSimulado } from "@/knowledge/regras";
import { campoById } from "@/knowledge/campos";
import { documentoById } from "@/knowledge/documentos";
import { testes } from "@/knowledge/testes";
import type { DocumentoId } from "@/knowledge/types";
import { brl } from "@/lib/format";

export const Route = createFileRoute("/matriz")({
  head: () => ({
    meta: [
      { title: "Matriz fiscal universal — Simulador Fiscal" },
      { name: "description", content: "Monte um cenário para NF-e, NFC-e, NFS-e, CT-e, CT-e OS, MDF-e ou eventos e veja a cadeia completa: tributos, cálculos, campos, XML, regras, rejeições e testes." },
      { property: "og:title", content: "Matriz fiscal universal — Simulador Fiscal" },
      { property: "og:description", content: "A mesma cadeia fiscal para todos os documentos, cada item clicável." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MatrizPage,
});

type Pergunta = "operacao" | "ufs" | "municipio" | "regime" | "destinatario" | "consumidor" | "finalidade" | "produto" | "beneficio" | "pagamento" | "servico" | "tomador" | "condutor" | "justificativa";
type Tributo = "ICMS" | "ST" | "FCP" | "DIFAL" | "IPI" | "PIS" | "COFINS" | "ISS" | "IBS" | "CBS" | "IS";

interface Perfil {
  perguntas: Pergunta[];
  tributos: Tributo[];
  classificacao: boolean;
  aviso?: string;
}

const perfis: Record<DocumentoId, Perfil> = {
  nfe55: { perguntas: ["operacao", "ufs", "regime", "destinatario", "consumidor", "finalidade", "produto", "beneficio"], tributos: ["ICMS", "ST", "FCP", "DIFAL", "IPI", "PIS", "COFINS", "IBS", "CBS", "IS"], classificacao: true },
  nfce65: { perguntas: ["regime", "produto", "pagamento"], tributos: ["ICMS", "FCP", "PIS", "COFINS", "IBS", "CBS", "IS"], classificacao: true, aviso: "Venda presencial a consumidor final dentro da UF. Contingência varia por UF (pendente)." },
  nfse: { perguntas: ["municipio", "regime", "servico"], tributos: ["ISS", "PIS", "COFINS", "IBS", "CBS"], classificacao: false, aviso: "Particularidade municipal: padrão nacional e padrões municipais coexistem; cada município pode exigir campos e regras próprias." },
  cte57: { perguntas: ["ufs", "regime", "tomador"], tributos: ["ICMS", "IBS", "CBS"], classificacao: false },
  cteos67: { perguntas: ["ufs", "regime", "tomador"], tributos: ["ICMS", "IBS", "CBS"], classificacao: false },
  mdfe58: { perguntas: ["ufs", "condutor"], tributos: [], classificacao: false, aviso: "Manifesto de carga: agrupa documentos e não destaca tributo neste simulador (ilustrativo)." },
  eventos: { perguntas: ["justificativa"], tributos: [], classificacao: false, aviso: "Eventos se relacionam a um documento já autorizado pela chave de acesso." },
};

const docsOrdem: DocumentoId[] = ["nfe55", "nfce65", "nfse", "cte57", "cteos67", "mdfe58", "eventos"];
const ufs = ["SP", "MG", "RJ", "PR", "RS", "BA"];
const tagTributo: Partial<Record<Tributo, string>> = { ICMS: "ICMS", ST: "ICMSST", FCP: "vFCP", DIFAL: "ICMSUFDest", IPI: "IPI", PIS: "PIS", COFINS: "COFINS", ISS: "ISSQN", IBS: "IBS (leiaute pendente)", CBS: "CBS (leiaute pendente)", IS: "IS (leiaute pendente)" };

function MatrizPage() {
  const [docId, setDocId] = useState<DocumentoId>("nfe55");
  const [op, setOp] = useState<"venda" | "devolucao">("venda");
  const [extra, setExtra] = useState({ municipio: "Município fictício A", finalidade: "normal", cest: "", origem: "0", beneficio: "nenhum" });
  const [d, setD] = useState<DocumentoSimulado>({ ...documentoSimuladoPadrao, cfop: "6102", difalInformado: 0 });
  const set = <K extends keyof DocumentoSimulado>(k: K, v: DocumentoSimulado[K]) => setD((x) => ({ ...x, [k]: v }));
  const perfil = perfis[docId];
  const tem = (p: Pergunta) => perfil.perguntas.includes(p);
  const documento = documentoById.get(docId);

  const cfop = useMemo(() => {
    if (docId === "nfce65") return "5102";
    const serie = d.ufOrigem === d.ufDestino ? "5" : "6";
    return op === "devolucao" ? `${serie}202` : `${serie}102`;
  }, [d.ufOrigem, d.ufDestino, op, docId]);
  const doc: DocumentoSimulado = { ...d, cfop, ...(docId === "nfce65" ? { ufDestino: d.ufOrigem, consumidorFinal: true, contribuinte: false } : {}) };
  const resultados = executarRegras(doc).filter((r) => r.regra.documento === docId);
  const falhas = resultados.filter((r) => !r.ok);
  const campos = [...new Set(resultados.flatMap((r) => r.regra.campos))];
  const regrasIds = new Set(resultados.map((r) => r.regra.id));
  const casos = testes.filter((t) => regrasIds.has(t.regraId));
  const interestadual = doc.ufOrigem !== doc.ufDestino;
  const b = base(doc);

  const Sel = ({ rotulo, v, onChange, opcoes }: { rotulo: string; v: string; onChange: (s: string) => void; opcoes: [string, string][] }) => (
    <label className="space-y-1 text-xs">
      <span className="font-medium">{rotulo}</span>
      <select value={v} onChange={(e) => onChange(e.target.value)} className="block w-full rounded-md border bg-background px-2 py-1.5 text-sm">
        {opcoes.map(([k, t]) => <option key={k} value={k}>{t}</option>)}
      </select>
    </label>
  );
  const Txt = ({ rotulo, v, onChange, mono = false }: { rotulo: string; v: string; onChange: (s: string) => void; mono?: boolean }) => (
    <label className="space-y-1 text-xs">
      <span className="font-medium">{rotulo}</span>
      <input value={v} onChange={(e) => onChange(e.target.value)} className={`block w-full rounded-md border bg-background px-2 py-1.5 text-sm ${mono ? "font-mono" : ""}`} />
    </label>
  );
  const etapa = (n: number, t: string, conteudo: React.ReactNode) => (
    <li className="rounded-lg border bg-surface p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{String(n).padStart(2, "0")} · {t}</p>
      <div className="mt-1 text-sm">{conteudo}</div>
    </li>
  );
  const pend = <StatusBadge status="pendente" />;

  const xml = (() => {
    const l: string[] = [];
    if (perfil.classificacao) l.push(`<prod><NCM>${doc.ncm}</NCM>${extra.cest ? `<CEST>${extra.cest}</CEST>` : ""}<CFOP>${cfop}</CFOP></prod>`, `<ICMS><orig>${extra.origem}</orig><CST>${doc.cst}</CST><vBC>${b.toFixed(2)}</vBC></ICMS>`);
    if (docId === "nfse") l.push(`<Servico><Discriminacao>${doc.descricaoServico}</Discriminacao></Servico>`);
    if (docId === "cte57" || docId === "cteos67") l.push(`<toma>${doc.tomador}</toma>`, `<UFIni>${doc.ufOrigem}</UFIni><UFFim>${doc.ufDestino}</UFFim>`);
    if (docId === "mdfe58") l.push(`<condutor><CPF>${doc.condutorCpf}</CPF></condutor>`);
    if (docId === "eventos") l.push(`<xJust>${doc.justificativa}</xJust>`);
    return l.join("\n") || "—";
  })();

  let n = 0;
  return (
    <div className="space-y-5">
      <PageHeader
        titulo="Matriz fiscal universal"
        descricao="Escolha o documento, responda às perguntas e acompanhe a mesma cadeia fiscal para todos. Classificações são heurísticas didáticas; tributos sem regra confirmada aparecem como pendentes."
      />
      <div className="flex flex-wrap gap-1">
        {docsOrdem.map((id) => (
          <button key={id} type="button" onClick={() => setDocId(id)} className={`rounded-md border px-3 py-1.5 text-sm ${docId === id ? "border-primary bg-primary text-primary-foreground" : "hover:bg-accent"}`}>
            {documentoById.get(id)?.sigla ?? id}
          </button>
        ))}
      </div>
      {perfil.aviso && <p className="rounded-md border border-pending/40 bg-pending/10 px-3 py-2 text-xs">{perfil.aviso}</p>}

      <div className="grid gap-5 lg:grid-cols-[300px_1fr]">
        <div className="space-y-3 rounded-lg border p-3">
          {tem("operacao") && <Sel rotulo="Operação" v={op} onChange={(v) => setOp(v as "venda" | "devolucao")} opcoes={[["venda", "Venda"], ["devolucao", "Devolução"]]} />}
          {tem("ufs") && (
            <div className="grid grid-cols-2 gap-2">
              <Sel rotulo="UF origem" v={d.ufOrigem} onChange={(v) => set("ufOrigem", v)} opcoes={ufs.map((u) => [u, u])} />
              <Sel rotulo="UF destino" v={d.ufDestino} onChange={(v) => set("ufDestino", v)} opcoes={ufs.map((u) => [u, u])} />
            </div>
          )}
          {tem("municipio") && <Txt rotulo="Município do serviço (fictício)" v={extra.municipio} onChange={(v) => setExtra({ ...extra, municipio: v })} />}
          {tem("regime") && <Sel rotulo="Regime do emitente" v={d.regime} onChange={(v) => { set("regime", v as DocumentoSimulado["regime"]); set("cst", v === "simples" ? "102" : "00"); }} opcoes={[["normal", "Regime Normal"], ["simples", "Simples Nacional"]]} />}
          {tem("destinatario") && <Sel rotulo="Destinatário" v={d.contribuinte ? "c" : "n"} onChange={(v) => set("contribuinte", v === "c")} opcoes={[["n", "Não contribuinte"], ["c", "Contribuinte"]]} />}
          {tem("consumidor") && <Sel rotulo="Consumidor final" v={d.consumidorFinal ? "s" : "n"} onChange={(v) => set("consumidorFinal", v === "s")} opcoes={[["s", "Sim"], ["n", "Não"]]} />}
          {tem("finalidade") && <Sel rotulo="Finalidade" v={extra.finalidade} onChange={(v) => setExtra({ ...extra, finalidade: v })} opcoes={[["normal", "Normal"], ["complementar", "Complementar"], ["ajuste", "Ajuste"], ["devolucao", "Devolução"]]} />}
          {tem("produto") && (
            <>
              <div className="grid grid-cols-2 gap-2">
                <Txt rotulo="NCM" v={d.ncm} onChange={(v) => set("ncm", v)} mono />
                <Txt rotulo="CEST" v={extra.cest} onChange={(v) => setExtra({ ...extra, cest: v })} mono />
              </div>
              <Sel rotulo="Origem da mercadoria" v={extra.origem} onChange={(v) => setExtra({ ...extra, origem: v })} opcoes={[["0", "0 · Nacional (ilustrativo)"], ["1", "1 · Estrangeira importação direta (ilustrativo)"], ["2", "2 · Estrangeira mercado interno (ilustrativo)"]]} />
            </>
          )}
          {tem("beneficio") && <Sel rotulo="Benefício fiscal" v={extra.beneficio} onChange={(v) => setExtra({ ...extra, beneficio: v })} opcoes={[["nenhum", "Nenhum"], ["reducao", "Redução de base (pendente)"], ["isencao", "Isenção (pendente)"]]} />}
          {tem("pagamento") && <Txt rotulo="Pagamento informado (R$)" v={String(d.pagamentoInformado)} onChange={(v) => set("pagamentoInformado", Number(v) || 0)} mono />}
          {tem("servico") && <Txt rotulo="Descrição do serviço" v={d.descricaoServico} onChange={(v) => set("descricaoServico", v)} />}
          {tem("tomador") && <Sel rotulo="Tomador do serviço" v={d.tomador} onChange={(v) => set("tomador", v)} opcoes={[["remetente", "Remetente"], ["destinatario", "Destinatário"], ["outro", "Outro"], ["", "Não informado"]]} />}
          {tem("condutor") && <Txt rotulo="CPF do condutor (fictício)" v={d.condutorCpf} onChange={(v) => set("condutorCpf", v)} mono />}
          {tem("justificativa") && <Txt rotulo="Justificativa do evento" v={d.justificativa} onChange={(v) => set("justificativa", v)} />}
          <p className="text-[11px] text-muted-foreground">Dados fictícios · Ambiente de Simulação</p>
        </div>

        <ol className="grid content-start gap-2 md:grid-cols-2">
          {etapa(++n, "Operação e documento", <>{tem("operacao") ? (op === "venda" ? "Venda" : "Devolução") : documento?.nome} · <Link to="/conhecimento" search={{ doc: docId, campo: undefined }} className="text-primary hover:underline">{documento?.sigla}</Link></>)}
          {etapa(++n, "Participantes", documento?.participantes.map((p) => p.papel).join(" · ") ?? "—")}
          {tem("ufs") && etapa(++n, "Localização", `${doc.ufOrigem} → ${doc.ufDestino} (${interestadual ? "interestadual" : "interna"})`)}
          {tem("municipio") && etapa(++n, "Município", <>{extra.municipio} {pend}</>)}
          {tem("regime") && etapa(++n, "Regime", d.regime === "simples" ? "Simples Nacional" : "Regime Normal")}
          {perfil.classificacao && etapa(++n, "Classificação", <>NCM <code className="font-mono">{doc.ncm}</code>{extra.cest && <> · CEST <code className="font-mono">{extra.cest}</code></>} · origem {extra.origem} · CFOP <code className="font-mono">{cfop}</code> · CST/CSOSN <code className="font-mono">{doc.cst}</code> <StatusBadge status="ilustrativo" /></>)}
          {tem("beneficio") && extra.beneficio !== "nenhum" && etapa(++n, "Benefício", <>Benefício depende de legislação da UF. {pend}</>)}
          {etapa(++n, "Tributos", perfil.tributos.length ? (
            <ul className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs">
              {perfil.tributos.map((t) => (
                <li key={t} className="flex items-center justify-between gap-1">
                  <span>{t} <span className="font-mono text-[10px] text-muted-foreground">{tagTributo[t]}</span></span>
                  {t === "DIFAL" && !(interestadual && doc.consumidorFinal && !doc.contribuinte) ? <span className="text-muted-foreground">não indicado</span> : <StatusBadge status="pendente" />}
                </li>
              ))}
            </ul>
          ) : "Nenhum tributo destacado neste documento (ilustrativo).")}
          {etapa(++n, "Cálculo", perfil.classificacao ? <>Base {brl(b)} × {doc.aliquotaIcms}% = {brl(Math.round(b * doc.aliquotaIcms) / 100)} <span className="text-xs text-muted-foreground">(exemplo didático)</span> · <Link to="/math-lab" search={{} as never} className="text-primary hover:underline">laboratório</Link></> : <>Sem cálculo didático para este documento. {perfil.tributos.length ? pend : null}</>)}
          {etapa(++n, "Campos", campos.length ? <div className="flex flex-wrap gap-1">{campos.map((c) => { const f = campoById.get(c); return f ? <Link key={c} to="/conhecimento" search={{ doc: f.documento, campo: c }} className="rounded border px-1.5 font-mono text-[11px] hover:bg-accent">{f.tagXml}</Link> : <span key={c} className="rounded border px-1.5 font-mono text-[11px] text-muted-foreground">{c}</span>; })}</div> : "Nenhum campo ligado às regras deste documento.")}
          {etapa(++n, "XML (ilustrativo)", <pre className="overflow-x-auto rounded bg-muted p-2 font-mono text-[11px]">{xml}</pre>)}
          {etapa(++n, `Regras (${resultados.length - falhas.length} ok, ${falhas.length} falha${falhas.length === 1 ? "" : "s"})`, resultados.length ? (
            <ul className="space-y-1">
              {resultados.map((r) => (
                <li key={r.regra.id} className="flex items-center justify-between gap-2 text-xs">
                  <Link to="/debugger" search={{ regra: r.regra.id }} className="hover:underline">{r.regra.titulo}</Link>
                  <span className={r.ok ? "text-validated" : "font-semibold text-destructive"}>{r.ok ? "OK" : "Falha"}</span>
                </li>
              ))}
            </ul>
          ) : "Nenhuma regra didática cadastrada para este documento.")}
          {etapa(++n, "Rejeições possíveis", falhas.length ? (
            <div className="flex flex-wrap gap-1">{[...new Set(falhas.flatMap((f) => f.regra.cstats))].map((c) => <Link key={c} to="/cstat" search={{ codigo: c }} className="rounded border px-1.5 font-mono text-[11px] hover:bg-accent">{c}</Link>)}</div>
          ) : "Nenhuma regra didática violada.")}
          {etapa(++n, "Testes", <>{casos.length} caso(s) ligado(s) · <Link to="/regressao" className="text-primary hover:underline">abrir regressão</Link></>)}
        </ol>
      </div>
    </div>
  );
}
