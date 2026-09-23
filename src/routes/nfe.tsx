import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Loader2, Plus, Save, Send, Trash2 } from "lucide-react";

import { PageHeader } from "@/components/layout/AppShell";
import { Documented } from "@/components/blueprint/Documented";
import { ResultadoAlert } from "@/components/blueprint/ResultadoAlert";
import { useEmissao } from "@/simulation/useEmissao";
import { clientes, produtos } from "@/simulation/cadastros";
import { empresaSimulada } from "@/simulation/mock-data";
import { previaTributaria, sugerirCfop } from "@/simulation/parametros-cenario";
import { brl } from "@/lib/format";
import type { ProblemaCampo } from "@/simulation/emissao-gateway";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const Route = createFileRoute("/nfe")({
  head: () => ({
    meta: [
      { title: "Emissão de NF-e modelo 55 — Simulador Fiscal" },
      {
        name: "description",
        content:
          "Simulação de emissão de NF-e de produtos, modelo 55, com itens, totais e prévia tributária identificada como estimativa.",
      },
      { property: "og:title", content: "Emissão de NF-e modelo 55 — Simulador Fiscal" },
      {
        property: "og:description",
        content: "Tela simulada de emissão de NF-e de produtos com blueprint de integração.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: EmissaoNfe,
});

interface ItemNota {
  id: string;
  produtoId: string;
  quantidade: number;
  preco: number;
  desconto: number;
}

const novoItem = (): ItemNota => ({
  id: Math.random().toString(36).slice(2, 9),
  produtoId: produtos[0]!.id,
  quantidade: 1,
  preco: produtos[0]!.preco,
  desconto: 0,
});

function EmissaoNfe() {
  const [clienteId, setClienteId] = useState<string>("");
  const [natureza, setNatureza] = useState("Venda de mercadoria (fictícia)");
  const [itens, setItens] = useState<ItemNota[]>([novoItem()]);
  const [frete, setFrete] = useState(0);
  const { resultado, processando, salvar, transmitir, limpar } = useEmissao("nfe55");

  const cliente = clientes.find((c) => c.id === clienteId);

  const totais = useMemo(() => {
    const produtosTotal = itens.reduce(
      (acc, i) => acc + i.quantidade * i.preco - i.desconto,
      0,
    );
    return { produtos: produtosTotal, frete, nota: produtosTotal + frete };
  }, [itens, frete]);

  const cfop = cliente
    ? sugerirCfop(cliente.uf, empresaSimulada.uf, cliente.contribuinte)
    : null;
  const previa = previaTributaria(totais.produtos);

  const problemas: ProblemaCampo[] = [];
  if (!cliente)
    problemas.push({
      campo: "Destinatário",
      mensagem: "Selecione o destinatário fictício antes de transmitir.",
      docId: "m2.destinatario",
    });
  if (itens.length === 0)
    problemas.push({
      campo: "Itens",
      mensagem: "A nota precisa de pelo menos um item.",
      docId: "m2.itens",
    });
  if (itens.some((i) => i.quantidade <= 0))
    problemas.push({
      campo: "Quantidade",
      mensagem: "Há item com quantidade menor ou igual a zero.",
      docId: "m2.itens",
    });

  const atualizar = (id: string, patch: Partial<ItemNota>) =>
    setItens((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));

  const resumo = `${itens.length} item(ns) · ${brl(totais.nota)}`;

  return (
    <div className="space-y-5">
      <PageHeader
        titulo="Emissão de NF-e de Produtos — modelo 55"
        descricao="Fluxo simulado de emissão. Todos os cadastros são fictícios e nenhum documento é transmitido a SEFAZ ou provedor."
        acoes={
          <div className="flex gap-2">
            <Button variant="outline" disabled={processando} onClick={() => salvar(resumo)}>
              <Save className="size-4" aria-hidden /> Salvar rascunho (F9)
            </Button>
            <Documented docId="m2.transmitir" inline>
              <Button
                disabled={processando}
                onClick={() => transmitir({ resumo, problemas })}
              >
                {processando ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : (
                  <Send className="size-4" aria-hidden />
                )}
                Transmitir (simulado)
              </Button>
            </Documented>
          </div>
        }
      />

      {resultado ? <ResultadoAlert resultado={resultado} onFechar={limpar} /> : null}

      <div className="grid gap-5 xl:grid-cols-[2fr_1fr]">
        <div className="space-y-5">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Dados da operação</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <Documented docId="m2.destinatario" className="space-y-1.5">
                <Label htmlFor="destinatario">Destinatário (fictício)</Label>
                <Select value={clienteId} onValueChange={setClienteId}>
                  <SelectTrigger id="destinatario">
                    <SelectValue placeholder="Selecione o destinatário" />
                  </SelectTrigger>
                  <SelectContent>
                    {clientes.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.nome} — {c.municipio}/{c.uf}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Documented>

              <div className="space-y-1.5">
                <Label htmlFor="natureza">Natureza da operação</Label>
                <Input
                  id="natureza"
                  value={natureza}
                  onChange={(e) => setNatureza(e.target.value)}
                />
              </div>

              <Documented docId="m2.cfop" className="space-y-1.5 sm:col-span-2">
                <Label>CFOP sugerido pelo protótipo</Label>
                <div className="rounded-md border bg-muted/40 p-3 text-sm">
                  {cfop ? (
                    <>
                      <span className="font-mono text-base font-semibold">{cfop.codigo}</span>
                      <p className="mt-1 text-muted-foreground">{cfop.justificativa}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{cfop.aviso}</p>
                    </>
                  ) : (
                    <p className="text-muted-foreground">
                      Selecione o destinatário para ver a sugestão demonstrativa.
                    </p>
                  )}
                </div>
              </Documented>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-base">Itens da nota</CardTitle>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setItens((p) => [...p, novoItem()])}
              >
                <Plus className="size-4" aria-hidden /> Adicionar item
              </Button>
            </CardHeader>
            <CardContent>
              <Documented docId="m2.itens">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[220px]">Produto (fictício)</TableHead>
                      <TableHead className="w-[90px]">NCM</TableHead>
                      <TableHead className="w-[90px] text-right">Qtd.</TableHead>
                      <TableHead className="w-[120px] text-right">Preço</TableHead>
                      <TableHead className="w-[120px] text-right">Desconto</TableHead>
                      <TableHead className="w-[120px] text-right">Total</TableHead>
                      <TableHead className="w-[48px]" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {itens.map((item) => {
                      const prod = produtos.find((p) => p.id === item.produtoId)!;
                      const total = item.quantidade * item.preco - item.desconto;
                      return (
                        <TableRow key={item.id}>
                          <TableCell>
                            <Select
                              value={item.produtoId}
                              onValueChange={(v) => {
                                const p = produtos.find((x) => x.id === v)!;
                                atualizar(item.id, { produtoId: v, preco: p.preco });
                              }}
                            >
                              <SelectTrigger>
                                <SelectValue>
                                  {prod.codigo} — {prod.descricao}
                                </SelectValue>
                              </SelectTrigger>
                              <SelectContent>
                                {produtos.map((p) => (
                                  <SelectItem key={p.id} value={p.id}>
                                    {p.codigo} — {p.descricao}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className="font-mono text-xs">{prod.ncm}</TableCell>
                          <TableCell>
                            <Input
                              className="text-right"
                              type="number"
                              min={0}
                              value={item.quantidade}
                              onChange={(e) =>
                                atualizar(item.id, { quantidade: Number(e.target.value) })
                              }
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              className="text-right"
                              type="number"
                              step="0.01"
                              value={item.preco}
                              onChange={(e) => atualizar(item.id, { preco: Number(e.target.value) })}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              className="text-right"
                              type="number"
                              step="0.01"
                              value={item.desconto}
                              onChange={(e) =>
                                atualizar(item.id, { desconto: Number(e.target.value) })
                              }
                            />
                          </TableCell>
                          <TableCell className="text-right font-medium">{brl(total)}</TableCell>
                          <TableCell>
                            <Button
                              size="icon"
                              variant="ghost"
                              aria-label="Remover item"
                              onClick={() => setItens((p) => p.filter((x) => x.id !== item.id))}
                            >
                              <Trash2 className="size-4" aria-hidden />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </Documented>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Totais</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Produtos</span>
                <span className="font-medium">{brl(totais.produtos)}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="frete" className="text-muted-foreground font-normal">
                  Frete
                </Label>
                <Input
                  id="frete"
                  className="h-8 w-32 text-right"
                  type="number"
                  step="0.01"
                  value={frete}
                  onChange={(e) => setFrete(Number(e.target.value))}
                />
              </div>
              <Separator />
              <div className="flex justify-between text-base">
                <span className="font-medium">Total da nota</span>
                <span className="font-semibold">{brl(totais.nota)}</span>
              </div>
            </CardContent>
          </Card>

          <Documented docId="m2.previa">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  Prévia tributária
                  <Badge variant="outline">Estimativa simulada</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p className="text-xs text-muted-foreground">{previa.aviso}</p>
                {previa.linhas.map((l) => (
                  <div key={l.grupo} className="flex justify-between">
                    <span className="text-muted-foreground">
                      {l.grupo} · {l.percentual}% (cenário)
                    </span>
                    <span>{brl(l.valor)}</span>
                  </div>
                ))}
                <p className="pt-1 text-xs text-muted-foreground">
                  Os percentuais acima são arbitrários e servem apenas para demonstrar a tela. A
                  apuração real depende de regras versionadas no back-end.
                </p>
              </CardContent>
            </Card>
          </Documented>
        </div>
      </div>
    </div>
  );
}
