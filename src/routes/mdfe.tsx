import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Loader2, Send } from "lucide-react";

import { ExportarDocumento } from "@/components/blueprint/ExportarDocumento";
import { gerarMdfe } from "@/simulation/documento-saida";
import { PageHeader } from "@/components/layout/AppShell";
import { Documented } from "@/components/blueprint/Documented";
import { ResultadoAlert } from "@/components/blueprint/ResultadoAlert";
import { useEmissao } from "@/simulation/useEmissao";
import { motoristas, ufs, veiculos } from "@/simulation/cadastros";
import { brl, formatChave } from "@/lib/format";
import type { ProblemaCampo } from "@/simulation/emissao-gateway";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const Route = createFileRoute("/mdfe")({
  head: () => ({
    meta: [
      { title: "MDF-e modelo 58 — Simulador Fiscal" },
      {
        name: "description",
        content:
          "Manifesto eletrônico de documentos fiscais simulado: seleção de CT-e e NF-e, motorista, veículo, reboques, totais e percurso.",
      },
      { property: "og:title", content: "MDF-e modelo 58 — Simulador Fiscal" },
      {
        property: "og:description",
        content: "Montagem simulada do manifesto de carga com blueprint técnico de integração.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: EmissaoMdfe,
});

interface DocumentoManifesto {
  id: string;
  tipo: "CT-e" | "NF-e";
  chave: string;
  destino: string;
  valor: number;
  peso: number;
}

const documentosDisponiveis: DocumentoManifesto[] = [
  { id: "d1", tipo: "CT-e", chave: "35260400000000000191570010000004411000004410", destino: "Uberlândia/MG", valor: 3200, peso: 820 },
  { id: "d2", tipo: "CT-e", chave: "35260400000000000191570010000004421000004420", destino: "Londrina/PR", valor: 5400, peso: 1450 },
  { id: "d3", tipo: "NF-e", chave: "35260400000000000191550010000009911000009910", destino: "Sorocaba/SP", valor: 18400.5, peso: 640 },
  { id: "d4", tipo: "NF-e", chave: "35260400000000000191550010000009921000009920", destino: "Uberlândia/MG", valor: 7620.3, peso: 310 },
];

function EmissaoMdfe() {
  const [selecionados, setSelecionados] = useState<string[]>([]);
  const [motoristaId, setMotoristaId] = useState("");
  const [veiculoId, setVeiculoId] = useState("");
  const [reboquesAtivos, setReboquesAtivos] = useState<string[]>([]);
  const [ufInicio, setUfInicio] = useState("SP");
  const [ufFim, setUfFim] = useState("MG");
  const [percurso, setPercurso] = useState<string[]>([]);

  const { resultado, processando, transmitir, limpar } = useEmissao("mdfe58");

  const veiculo = veiculos.find((v) => v.id === veiculoId);

  const totais = useMemo(() => {
    const docs = documentosDisponiveis.filter((d) => selecionados.includes(d.id));
    return {
      quantidade: docs.length,
      valor: docs.reduce((a, d) => a + d.valor, 0),
      peso: docs.reduce((a, d) => a + d.peso, 0),
    };
  }, [selecionados]);

  const alternar = (id: string) =>
    setSelecionados((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  const problemas: ProblemaCampo[] = [];
  if (selecionados.length === 0)
    problemas.push({
      campo: "Documentos",
      mensagem: "Selecione ao menos um CT-e ou NF-e para o manifesto.",
      docId: "m7.documentos",
    });
  if (!motoristaId)
    problemas.push({ campo: "Motorista", mensagem: "Informe o motorista.", docId: "m7.condutor" });
  if (!veiculoId)
    problemas.push({ campo: "Veículo", mensagem: "Informe o veículo de tração.", docId: "m7.veiculo" });

  return (
    <div className="space-y-5">
      <PageHeader
        titulo="MDF-e — modelo 58"
        descricao="Montagem simulada do manifesto: documentos transportados, condutor, veículo, reboques e percurso. Nada é transmitido."
        acoes={
          <Button
            disabled={processando}
            onClick={() =>
              transmitir({
                resumo: `${totais.quantidade} documento(s) · ${brl(totais.valor)}`,
                problemas,
              })
            }
          >
            {processando ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Send className="size-4" aria-hidden />
            )}
            Encerrar montagem e transmitir (simulado)
          </Button>
        }
      />

      <ExportarDocumento rotuloPdf="DAMDFE" gerar={() => gerarMdfe({ documentos: documentosDisponiveis.filter((d) => selecionados.includes(d.id)), motorista: motoristas.find((m) => m.id === motoristaId), veiculo: veiculos.find((v) => v.id === veiculoId), reboques: (veiculos.find((v) => v.id === veiculoId)?.reboques ?? []).filter((r) => reboquesAtivos.includes(r.placa)), ufInicio, ufFim, percurso })} />

      {resultado ? <ResultadoAlert resultado={resultado} onFechar={limpar} /> : null}

      <Documented docId="m7.documentos">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Documentos a manifestar (fictícios)</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[48px]" />
                  <TableHead className="w-[80px]">Tipo</TableHead>
                  <TableHead className="w-[250px]">Chave</TableHead>
                  <TableHead>Destino</TableHead>
                  <TableHead className="w-[130px] text-right">Valor</TableHead>
                  <TableHead className="w-[110px] text-right">Peso (kg)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {documentosDisponiveis.map((d) => (
                  <TableRow key={d.id} data-state={selecionados.includes(d.id) ? "selected" : undefined}>
                    <TableCell>
                      <Checkbox
                        checked={selecionados.includes(d.id)}
                        onCheckedChange={() => alternar(d.id)}
                        aria-label={`Selecionar ${d.tipo} para ${d.destino}`}
                      />
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{d.tipo}</Badge>
                    </TableCell>
                    <TableCell className="whitespace-nowrap font-mono text-[10px] text-muted-foreground">
                      {formatChave(d.chave)}
                    </TableCell>
                    <TableCell>{d.destino}</TableCell>
                    <TableCell className="text-right">{brl(d.valor)}</TableCell>
                    <TableCell className="text-right">{d.peso}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </Documented>

      <div className="grid gap-5 xl:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Condutor, veículo e percurso</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Documented docId="m7.condutor" className="space-y-1.5">
              <Label htmlFor="motorista">Motorista (fictício)</Label>
              <Select value={motoristaId} onValueChange={setMotoristaId}>
                <SelectTrigger id="motorista">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {motoristas.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Documented>

            <Documented docId="m7.veiculo" className="space-y-1.5">
              <Label htmlFor="veiculo">Veículo de tração (fictício)</Label>
              <Select
                value={veiculoId}
                onValueChange={(v) => {
                  setVeiculoId(v);
                  setReboquesAtivos([]);
                }}
              >
                <SelectTrigger id="veiculo">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {veiculos.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.placa} — {v.uf} — tara {v.tara} kg
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Documented>

            <div className="space-y-2 sm:col-span-2">
              <Label>Reboques vinculados</Label>
              {veiculo && veiculo.reboques.length > 0 ? (
                <div className="flex flex-wrap gap-3">
                  {veiculo.reboques.map((r) => (
                    <label
                      key={r.placa}
                      className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm"
                    >
                      <Checkbox
                        checked={reboquesAtivos.includes(r.placa)}
                        onCheckedChange={() =>
                          setReboquesAtivos((p) =>
                            p.includes(r.placa) ? p.filter((x) => x !== r.placa) : [...p, r.placa],
                          )
                        }
                      />
                      {r.placa} / {r.uf}
                    </label>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {veiculo
                    ? "Veículo sem reboques cadastrados no simulador."
                    : "Selecione um veículo para ver os reboques."}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="uf-ini-mdfe">UF de carregamento</Label>
              <Select value={ufInicio} onValueChange={setUfInicio}>
                <SelectTrigger id="uf-ini-mdfe">
                  <SelectValue>{ufInicio}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {ufs.map((u) => (
                    <SelectItem key={u} value={u}>
                      {u}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="uf-fim-mdfe">UF de descarregamento</Label>
              <Select value={ufFim} onValueChange={setUfFim}>
                <SelectTrigger id="uf-fim-mdfe">
                  <SelectValue>{ufFim}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {ufs.map((u) => (
                    <SelectItem key={u} value={u}>
                      {u}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Documented docId="m7.percurso" className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="percurso">UFs de percurso (entre início e fim)</Label>
              <div className="flex flex-wrap gap-2">
                {ufs.map((u) => {
                  const ativo = percurso.includes(u);
                  return (
                    <button
                      key={u}
                      type="button"
                      onClick={() =>
                        setPercurso((p) => (ativo ? p.filter((x) => x !== u) : [...p, u]))
                      }
                      className={`rounded border px-2 py-1 text-xs transition-colors ${
                        ativo ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                      }`}
                    >
                      {u}
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground">
                Seleção livre no protótipo. A coerência do percurso com origem e destino deve ser
                validada pelo back-end.
              </p>
            </Documented>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              Totais do manifesto
              <Badge variant="outline">Simulação</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Documentos</span>
              <span>{totais.quantidade}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Peso total</span>
              <span>{totais.peso} kg</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Reboques</span>
              <span>{reboquesAtivos.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Percurso</span>
              <span className="text-right">
                {ufInicio}
                {percurso.length ? ` → ${percurso.join(" → ")}` : ""} → {ufFim}
              </span>
            </div>
            <Separator />
            <div className="flex justify-between text-base font-semibold">
              <span>Valor da carga</span>
              <span>{brl(totais.valor)}</span>
            </div>
            <p className="pt-1 text-xs text-muted-foreground">
              Encerramento do manifesto, eventos e regras de totalização precisam ser confirmados no
              manual do modelo 58.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
