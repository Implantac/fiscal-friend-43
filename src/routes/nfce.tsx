import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Loader2, Plus, Send, Trash2, Wifi, WifiOff } from "lucide-react";

import { PageHeader } from "@/components/layout/AppShell";
import { Documented } from "@/components/blueprint/Documented";
import { ResultadoAlert } from "@/components/blueprint/ResultadoAlert";
import { useEmissao } from "@/simulation/useEmissao";
import { produtos } from "@/simulation/cadastros";
import { brl } from "@/lib/format";
import type { ProblemaCampo } from "@/simulation/emissao-gateway";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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

export const Route = createFileRoute("/nfce")({
  head: () => ({
    meta: [
      { title: "PDV NFC-e modelo 65 — Simulador Fiscal" },
      {
        name: "description",
        content:
          "Ponto de venda simulado para NFC-e modelo 65, com venda rápida, formas de pagamento e fila de contingência offline.",
      },
      { property: "og:title", content: "PDV NFC-e modelo 65 — Simulador Fiscal" },
      {
        property: "og:description",
        content: "Venda rápida simulada com fila offline e blueprint técnico de integração.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Pdv,
});

interface ItemVenda {
  id: string;
  produtoId: string;
  quantidade: number;
}

interface VendaFila {
  id: string;
  total: number;
  em: string;
}

const formasPagamento = [
  "Dinheiro",
  "Cartão de débito",
  "Cartão de crédito",
  "Pix",
  "Outro (fictício)",
];

function Pdv() {
  const [itens, setItens] = useState<ItemVenda[]>([]);
  const [produtoId, setProdutoId] = useState(produtos[5]!.id);
  const [quantidade, setQuantidade] = useState(1);
  const [pagamento, setPagamento] = useState(formasPagamento[0]!);
  const [recebido, setRecebido] = useState(0);
  const [online, setOnline] = useState(true);
  const [fila, setFila] = useState<VendaFila[]>([]);
  const { resultado, processando, transmitir, limpar } = useEmissao("nfce65");

  const total = useMemo(
    () =>
      itens.reduce((acc, i) => {
        const p = produtos.find((x) => x.id === i.produtoId)!;
        return acc + p.preco * i.quantidade;
      }, 0),
    [itens],
  );

  const troco = Math.max(0, recebido - total);

  const adicionar = () => {
    if (quantidade <= 0) return;
    setItens((prev) => [
      ...prev,
      { id: Math.random().toString(36).slice(2, 9), produtoId, quantidade },
    ]);
    setQuantidade(1);
  };

  const finalizar = async () => {
    const problemas: ProblemaCampo[] = [];
    if (itens.length === 0)
      problemas.push({
        campo: "Itens",
        mensagem: "Inclua ao menos um produto no cupom.",
        docId: "m3.itens",
      });
    if (pagamento === "Dinheiro" && recebido < total)
      problemas.push({
        campo: "Valor recebido",
        mensagem: "O valor recebido em dinheiro é menor que o total do cupom.",
        docId: "m3.pagamento",
      });

    const r = await transmitir({
      resumo: `${itens.length} item(ns) · ${brl(total)} · ${pagamento}`,
      problemas,
      online,
    });

    if (r.tipo === "sucesso") {
      setItens([]);
      setRecebido(0);
    }
    if (r.tipo === "erro_provedor" && !online) {
      setFila((prev) => [
        { id: Math.random().toString(36).slice(2, 9), total, em: new Date().toISOString() },
        ...prev,
      ]);
      setItens([]);
      setRecebido(0);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        titulo="PDV — NFC-e modelo 65"
        descricao="Venda rápida simulada. A contingência aqui é apenas uma fila local de demonstração; as regras reais dependem da UF e da regulamentação vigente."
        acoes={
          <Documented docId="m3.contingencia" inline>
            <div className="flex items-center gap-2 rounded-md border px-3 py-2">
              {online ? (
                <Wifi className="size-4 text-validated" aria-hidden />
              ) : (
                <WifiOff className="size-4 text-destructive" aria-hidden />
              )}
              <Label htmlFor="conexao" className="text-sm font-normal">
                Conexão simulada
              </Label>
              <Switch id="conexao" checked={online} onCheckedChange={setOnline} />
            </div>
          </Documented>
        }
      />

      {resultado ? <ResultadoAlert resultado={resultado} onFechar={limpar} /> : null}

      <div className="grid gap-5 xl:grid-cols-[2fr_1fr]">
        <div className="space-y-5">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Venda rápida</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Documented docId="m3.itens" className="grid gap-3 sm:grid-cols-[1fr_120px_auto]">
                <div className="space-y-1.5">
                  <Label htmlFor="produto">Produto (fictício)</Label>
                  <Select value={produtoId} onValueChange={setProdutoId}>
                    <SelectTrigger id="produto">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {produtos.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.ean} — {p.descricao}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="qtd">Quantidade</Label>
                  <Input
                    id="qtd"
                    type="number"
                    min={1}
                    value={quantidade}
                    onChange={(e) => setQuantidade(Number(e.target.value))}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") adicionar();
                    }}
                  />
                </div>
                <div className="flex items-end">
                  <Button onClick={adicionar}>
                    <Plus className="size-4" aria-hidden /> Incluir
                  </Button>
                </div>
              </Documented>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead className="w-[80px] text-right">Qtd.</TableHead>
                    <TableHead className="w-[110px] text-right">Unit.</TableHead>
                    <TableHead className="w-[110px] text-right">Total</TableHead>
                    <TableHead className="w-[48px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {itens.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                        Cupom vazio. Inclua produtos para iniciar a venda simulada.
                      </TableCell>
                    </TableRow>
                  ) : (
                    itens.map((i) => {
                      const p = produtos.find((x) => x.id === i.produtoId)!;
                      return (
                        <TableRow key={i.id}>
                          <TableCell>{p.descricao}</TableCell>
                          <TableCell className="text-right">{i.quantidade}</TableCell>
                          <TableCell className="text-right">{brl(p.preco)}</TableCell>
                          <TableCell className="text-right font-medium">
                            {brl(p.preco * i.quantidade)}
                          </TableCell>
                          <TableCell>
                            <Button
                              size="icon"
                              variant="ghost"
                              aria-label="Remover item do cupom"
                              onClick={() => setItens((prev) => prev.filter((x) => x.id !== i.id))}
                            >
                              <Trash2 className="size-4" aria-hidden />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Documented docId="m3.fila">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  Fila de contingência (simulada)
                  <Badge variant="outline">{fila.length} pendente(s)</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {fila.length === 0 ? (
                  <p className="text-muted-foreground">
                    Nenhuma venda pendente. Desligue a conexão simulada e finalize uma venda para
                    ver o comportamento da fila.
                  </p>
                ) : (
                  <>
                    {fila.map((f) => (
                      <div key={f.id} className="flex justify-between rounded border px-3 py-2">
                        <span>Venda pendente {f.id}</span>
                        <span className="font-medium">{brl(f.total)}</span>
                      </div>
                    ))}
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!online}
                      onClick={() => setFila([])}
                    >
                      Processar fila (simulado)
                    </Button>
                    {!online ? (
                      <p className="text-xs text-muted-foreground">
                        Restabeleça a conexão simulada para processar a fila.
                      </p>
                    ) : null}
                  </>
                )}
              </CardContent>
            </Card>
          </Documented>
        </div>

        <Documented docId="m3.pagamento">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Fechamento</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-md border bg-muted/40 p-4 text-center">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Total</p>
                <p className="text-3xl font-semibold">{brl(total)}</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pagamento">Forma de pagamento</Label>
                <Select value={pagamento} onValueChange={setPagamento}>
                  <SelectTrigger id="pagamento">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {formasPagamento.map((f) => (
                      <SelectItem key={f} value={f}>
                        {f}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {pagamento === "Dinheiro" ? (
                <div className="space-y-1.5">
                  <Label htmlFor="recebido">Valor recebido</Label>
                  <Input
                    id="recebido"
                    type="number"
                    step="0.01"
                    value={recebido}
                    onChange={(e) => setRecebido(Number(e.target.value))}
                  />
                  <p className="text-sm text-muted-foreground">Troco: {brl(troco)}</p>
                </div>
              ) : null}
              <Separator />
              <Button className="w-full" disabled={processando} onClick={finalizar}>
                {processando ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : (
                  <Send className="size-4" aria-hidden />
                )}
                Finalizar venda (F10 simulado)
              </Button>
              <p className="text-xs text-muted-foreground">
                Nenhum cupom fiscal é gerado. O DANFE NFC-e e o QR Code dependem de regras oficiais
                ainda não registradas neste protótipo.
              </p>
            </CardContent>
          </Card>
        </Documented>
      </div>
    </div>
  );
}
