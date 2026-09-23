import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Loader2, Plus, Send, Trash2 } from "lucide-react";

import { PageHeader } from "@/components/layout/AppShell";
import { Documented } from "@/components/blueprint/Documented";
import { ResultadoAlert } from "@/components/blueprint/ResultadoAlert";
import { useEmissao } from "@/simulation/useEmissao";
import { clientes, motoristas, ufs, veiculos } from "@/simulation/cadastros";
import { brl } from "@/lib/format";
import type { ProblemaCampo } from "@/simulation/emissao-gateway";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const Route = createFileRoute("/cte-os")({
  head: () => ({
    meta: [
      { title: "CT-e OS modelo 67 — Simulador Fiscal" },
      {
        name: "description",
        content:
          "Simulação de CT-e Outros Serviços, modelo 67, para transporte de pessoas e transporte de valores com grade de malotes.",
      },
      { property: "og:title", content: "CT-e OS modelo 67 — Simulador Fiscal" },
      {
        property: "og:description",
        content: "Transporte de pessoas e de valores simulados, com blueprint técnico de integração.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: EmissaoCteOs,
});

interface Malote {
  id: string;
  numero: string;
  descricao: string;
  quantidade: number;
  valor: number;
}

const novoMalote = (): Malote => ({
  id: Math.random().toString(36).slice(2, 9),
  numero: "",
  descricao: "Malote lacrado (fictício)",
  quantidade: 1,
  valor: 0,
});

function EmissaoCteOs() {
  const [modalidade, setModalidade] = useState<"pessoas" | "valores">("pessoas");
  const [tomadorId, setTomadorId] = useState("");
  const [motoristaId, setMotoristaId] = useState("");
  const [veiculoId, setVeiculoId] = useState("");
  const [ufInicio, setUfInicio] = useState("SP");
  const [ufFim, setUfFim] = useState("SP");
  const [passageiros, setPassageiros] = useState(1);
  const [valorPrestacao, setValorPrestacao] = useState(0);
  const [malotes, setMalotes] = useState<Malote[]>([novoMalote()]);

  const { resultado, processando, transmitir, limpar } = useEmissao("cteos67");

  const totalMalotes = malotes.reduce((a, m) => a + m.valor, 0);

  const atualizar = (id: string, patch: Partial<Malote>) =>
    setMalotes((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)));

  const problemas: ProblemaCampo[] = [];
  if (!tomadorId)
    problemas.push({ campo: "Tomador", mensagem: "Selecione o tomador do serviço.", docId: "m6.tomador" });
  if (valorPrestacao <= 0)
    problemas.push({
      campo: "Valor da prestação",
      mensagem: "Informe o valor da prestação do serviço.",
      docId: "m6.prestacao",
    });
  if (modalidade === "valores" && malotes.some((m) => !m.numero.trim()))
    problemas.push({
      campo: "Malotes",
      mensagem: "Todo malote precisa de número de identificação.",
      docId: "m6.malotes",
    });
  if (modalidade === "pessoas" && passageiros <= 0)
    problemas.push({
      campo: "Passageiros",
      mensagem: "Informe a quantidade de passageiros.",
      docId: "m6.passageiros",
    });

  return (
    <div className="space-y-5">
      <PageHeader
        titulo="CT-e OS — modelo 67"
        descricao="Duas modalidades simuladas de Outros Serviços: transporte de pessoas e transporte de valores. Nenhum documento é transmitido."
        acoes={
          <Button
            disabled={processando}
            onClick={() =>
              transmitir({
                resumo: `${modalidade === "pessoas" ? "Transporte de pessoas" : "Transporte de valores"} · ${brl(valorPrestacao)}`,
                problemas,
              })
            }
          >
            {processando ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Send className="size-4" aria-hidden />
            )}
            Transmitir (simulado)
          </Button>
        }
      />

      {resultado ? <ResultadoAlert resultado={resultado} onFechar={limpar} /> : null}

      <Documented docId="m6.modalidade">
        <Tabs value={modalidade} onValueChange={(v) => setModalidade(v as typeof modalidade)}>
          <TabsList>
            <TabsTrigger value="pessoas">Transporte de pessoas</TabsTrigger>
            <TabsTrigger value="valores">Transporte de valores</TabsTrigger>
          </TabsList>

          <TabsContent value="pessoas" className="mt-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Dados do transporte de pessoas</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <Documented docId="m6.passageiros" className="space-y-1.5">
                  <Label htmlFor="passageiros">Quantidade de passageiros</Label>
                  <Input
                    id="passageiros"
                    type="number"
                    min={1}
                    value={passageiros}
                    onChange={(e) => setPassageiros(Number(e.target.value))}
                  />
                </Documented>
                <div className="space-y-1.5">
                  <Label htmlFor="motorista-p">Motorista (fictício)</Label>
                  <Select value={motoristaId} onValueChange={setMotoristaId}>
                    <SelectTrigger id="motorista-p">
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
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="valores" className="mt-4">
            <Documented docId="m6.malotes">
              <Card>
                <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
                  <CardTitle className="text-base">Grade de malotes</CardTitle>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setMalotes((p) => [...p, novoMalote()])}
                  >
                    <Plus className="size-4" aria-hidden /> Adicionar malote
                  </Button>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[160px]">Número</TableHead>
                        <TableHead>Descrição</TableHead>
                        <TableHead className="w-[100px] text-right">Qtd.</TableHead>
                        <TableHead className="w-[140px] text-right">Valor declarado</TableHead>
                        <TableHead className="w-[48px]" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {malotes.map((m) => (
                        <TableRow key={m.id}>
                          <TableCell>
                            <Input
                              value={m.numero}
                              placeholder="ML-0001"
                              onChange={(e) => atualizar(m.id, { numero: e.target.value })}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              value={m.descricao}
                              onChange={(e) => atualizar(m.id, { descricao: e.target.value })}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              className="text-right"
                              type="number"
                              min={1}
                              value={m.quantidade}
                              onChange={(e) => atualizar(m.id, { quantidade: Number(e.target.value) })}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              className="text-right"
                              type="number"
                              step="0.01"
                              value={m.valor}
                              onChange={(e) => atualizar(m.id, { valor: Number(e.target.value) })}
                            />
                          </TableCell>
                          <TableCell>
                            <Button
                              size="icon"
                              variant="ghost"
                              aria-label="Remover malote"
                              onClick={() => setMalotes((p) => p.filter((x) => x.id !== m.id))}
                            >
                              <Trash2 className="size-4" aria-hidden />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <p className="pt-3 text-xs text-muted-foreground">
                    Estrutura de grade demonstrativa. Os campos exigidos para transporte de valores
                    precisam ser confirmados no manual do modelo 67 antes da implementação.
                  </p>
                </CardContent>
              </Card>
            </Documented>
          </TabsContent>
        </Tabs>
      </Documented>

      <div className="grid gap-5 xl:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Prestação e percurso</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Documented docId="m6.tomador" className="space-y-1.5">
              <Label htmlFor="tomador">Tomador do serviço (fictício)</Label>
              <Select value={tomadorId} onValueChange={setTomadorId}>
                <SelectTrigger id="tomador">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {clientes.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Documented>
            <div className="space-y-1.5">
              <Label htmlFor="veiculo-os">Veículo (fictício)</Label>
              <Select value={veiculoId} onValueChange={setVeiculoId}>
                <SelectTrigger id="veiculo-os">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {veiculos.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.placa} — {v.uf}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="uf-ini-os">UF de início</Label>
              <Select value={ufInicio} onValueChange={setUfInicio}>
                <SelectTrigger id="uf-ini-os">
                  <SelectValue />
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
              <Label htmlFor="uf-fim-os">UF de término</Label>
              <Select value={ufFim} onValueChange={setUfFim}>
                <SelectTrigger id="uf-fim-os">
                  <SelectValue />
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
            <Documented docId="m6.prestacao" className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="prestacao">Valor da prestação</Label>
              <Input
                id="prestacao"
                type="number"
                step="0.01"
                value={valorPrestacao}
                onChange={(e) => setValorPrestacao(Number(e.target.value))}
              />
            </Documented>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              Resumo
              <Badge variant="outline">Simulação</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Modalidade</span>
              <span>{modalidade === "pessoas" ? "Pessoas" : "Valores"}</span>
            </div>
            {modalidade === "pessoas" ? (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Passageiros</span>
                <span>{passageiros}</span>
              </div>
            ) : (
              <>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Malotes</span>
                  <span>{malotes.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Valor declarado total</span>
                  <span>{brl(totalMalotes)}</span>
                </div>
              </>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Percurso</span>
              <span>
                {ufInicio} → {ufFim}
              </span>
            </div>
            <Separator />
            <div className="flex justify-between text-base font-semibold">
              <span>Prestação</span>
              <span>{brl(valorPrestacao)}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
