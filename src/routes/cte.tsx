import { useState, type DragEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { FileUp, Loader2, Send, Trash2 } from "lucide-react";

import { ExportarDocumento } from "@/components/blueprint/ExportarDocumento";
import { gerarCte } from "@/simulation/documento-saida";
import { PageHeader } from "@/components/layout/AppShell";
import { Documented } from "@/components/blueprint/Documented";
import { ResultadoAlert } from "@/components/blueprint/ResultadoAlert";
import { useEmissao } from "@/simulation/useEmissao";
import { clientes, ufs } from "@/simulation/cadastros";
import { parametrosCenario } from "@/simulation/parametros-cenario";
import { brl, formatChave } from "@/lib/format";
import type { ProblemaCampo } from "@/simulation/emissao-gateway";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const Route = createFileRoute("/cte")({
  head: () => ({
    meta: [
      { title: "Emissão de CT-e modelo 57 — Simulador Fiscal" },
      {
        name: "description",
        content:
          "Emissão simulada de CT-e de carga, modelo 57, com leitura demonstrativa de XML de NF-e e composição manual do frete.",
      },
      { property: "og:title", content: "Emissão de CT-e modelo 57 — Simulador Fiscal" },
      {
        property: "og:description",
        content: "CT-e de carga simulado com arrastar e soltar de XML e blueprint técnico.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: EmissaoCte,
});

interface NotaVinculada {
  id: string;
  arquivo: string;
  chave: string;
  emitente: string;
  valor: number;
  peso: number;
  origemLeitura: "xml" | "demonstrativa";
}

/** Extração demonstrativa. Não substitui a leitura e a validação do XML no back-end. */
function lerXmlDemonstrativo(nome: string, conteudo: string): NotaVinculada {
  const base: NotaVinculada = {
    id: Math.random().toString(36).slice(2, 9),
    arquivo: nome,
    chave: "",
    emitente: "Emitente não identificado no arquivo",
    valor: 0,
    peso: 0,
    origemLeitura: "demonstrativa",
  };

  const chave = conteudo.match(/NFe(\d{44})/)?.[1] ?? conteudo.match(/\b(\d{44})\b/)?.[1] ?? "";
  const nome1 = conteudo.match(/<xNome>([^<]+)<\/xNome>/)?.[1];
  const valor = conteudo.match(/<vNF>([\d.]+)<\/vNF>/)?.[1];
  const peso = conteudo.match(/<pesoB>([\d.]+)<\/pesoB>/)?.[1];

  if (chave) base.chave = chave;
  if (nome1) base.emitente = nome1;
  if (valor) base.valor = Number(valor);
  if (peso) base.peso = Number(peso);
  if (chave || nome1 || valor) base.origemLeitura = "xml";

  if (!chave) {
    base.chave = `3526040000000000019155001000000${Math.floor(Math.random() * 9000 + 1000)}1000000123`.slice(0, 44);
    base.emitente = `${base.emitente} (dado demonstrativo)`;
    base.valor = base.valor || 4820.9;
    base.peso = base.peso || 320;
  }

  return base;
}

function EmissaoCte() {
  const [notas, setNotas] = useState<NotaVinculada[]>([]);
  const [arrastando, setArrastando] = useState(false);
  const [remetenteId, setRemetenteId] = useState("");
  const [destinatarioId, setDestinatarioId] = useState("");
  const [ufInicio, setUfInicio] = useState("SP");
  const [ufFim, setUfFim] = useState("MG");
  const [valorFrete, setValorFrete] = useState(0);
  const [pedagio, setPedagio] = useState(0);
  const [observacao, setObservacao] = useState("");

  const { resultado, processando, transmitir, limpar } = useEmissao("cte57");

  const totalCarga = notas.reduce((a, n) => a + n.valor, 0);
  const pesoTotal = notas.reduce((a, n) => a + n.peso, 0);
  const seguroEstimado = (totalCarga * parametrosCenario.seguroPercentual) / 100;
  const totalPrestacao = valorFrete + pedagio;

  const processarArquivos = async (arquivos: FileList | null) => {
    if (!arquivos) return;
    const lidos: NotaVinculada[] = [];
    for (const arquivo of Array.from(arquivos)) {
      const texto = await arquivo.text();
      lidos.push(lerXmlDemonstrativo(arquivo.name, texto));
    }
    setNotas((prev) => [...prev, ...lidos]);
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setArrastando(false);
    void processarArquivos(e.dataTransfer.files);
  };

  const problemas: ProblemaCampo[] = [];
  if (notas.length === 0)
    problemas.push({
      campo: "Documentos transportados",
      mensagem: "Vincule ao menos um XML de NF-e ao conhecimento.",
      docId: "m5.xml",
    });
  if (!remetenteId || !destinatarioId)
    problemas.push({
      campo: "Remetente/Destinatário",
      mensagem: "Informe remetente e destinatário fictícios.",
      docId: "m5.partes",
    });
  if (valorFrete <= 0)
    problemas.push({
      campo: "Valor do frete",
      mensagem: "O valor da prestação deve ser maior que zero.",
      docId: "m5.frete",
    });

  return (
    <div className="space-y-5">
      <PageHeader
        titulo="Emissão de CT-e — modelo 57 (carga)"
        descricao="Arraste XMLs de NF-e para vincular a carga. A leitura é demonstrativa e serve apenas para preencher a tela; a validação real do arquivo é responsabilidade do back-end."
        acoes={
          <Button
            disabled={processando}
            onClick={() =>
              transmitir({
                resumo: `${notas.length} NF-e · frete ${brl(totalPrestacao)}`,
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

      <ExportarDocumento rotuloPdf="DACTE" gerar={() => gerarCte({ remetente: clientes.find((c) => c.id === remetenteId), destinatario: clientes.find((c) => c.id === destinatarioId), ufInicio, ufFim, valorFrete, pedagio, notas, observacao })} />

      {resultado ? <ResultadoAlert resultado={resultado} onFechar={limpar} /> : null}

      <Documented docId="m5.xml">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Documentos transportados</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setArrastando(true);
              }}
              onDragLeave={() => setArrastando(false)}
              onDrop={onDrop}
              className={`flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
                arrastando ? "border-primary bg-primary/5" : "border-muted-foreground/30"
              }`}
            >
              <FileUp className="size-6 text-muted-foreground" aria-hidden />
              <p className="text-sm">
                Arraste arquivos XML de NF-e aqui ou selecione no disco.
              </p>
              <p className="text-xs text-muted-foreground">
                Os arquivos permanecem no navegador. Nada é enviado a servidores.
              </p>
              <Label
                htmlFor="xmls"
                className="mt-1 cursor-pointer rounded-md border px-3 py-1.5 text-sm"
              >
                Selecionar arquivos
              </Label>
              <Input
                id="xmls"
                type="file"
                accept=".xml,text/xml"
                multiple
                className="sr-only"
                onChange={(e) => void processarArquivos(e.target.files)}
              />
            </div>

            {notas.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Arquivo</TableHead>
                    <TableHead className="min-w-[200px]">Emitente</TableHead>
                    <TableHead className="w-[250px]">Chave</TableHead>
                    <TableHead className="w-[120px] text-right">Valor</TableHead>
                    <TableHead className="w-[100px] text-right">Peso (kg)</TableHead>
                    <TableHead className="w-[48px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {notas.map((n) => (
                    <TableRow key={n.id}>
                      <TableCell className="text-xs">{n.arquivo}</TableCell>
                      <TableCell>
                        {n.emitente}
                        <Badge variant="outline" className="ml-2 text-[10px]">
                          {n.origemLeitura === "xml" ? "lido do arquivo" : "demonstrativo"}
                        </Badge>
                      </TableCell>
                      <TableCell className="whitespace-nowrap font-mono text-[10px] text-muted-foreground">
                        {formatChave(n.chave)}
                      </TableCell>
                      <TableCell className="text-right">{brl(n.valor)}</TableCell>
                      <TableCell className="text-right">{n.peso}</TableCell>
                      <TableCell>
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label="Remover documento"
                          onClick={() => setNotas((p) => p.filter((x) => x.id !== n.id))}
                        >
                          <Trash2 className="size-4" aria-hidden />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : null}
          </CardContent>
        </Card>
      </Documented>

      <div className="grid gap-5 xl:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Prestação do serviço de transporte</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Documented docId="m5.partes" className="space-y-1.5">
              <Label htmlFor="remetente">Remetente (fictício)</Label>
              <Select value={remetenteId} onValueChange={setRemetenteId}>
                <SelectTrigger id="remetente">
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
              <Label htmlFor="destinatario">Destinatário (fictício)</Label>
              <Select value={destinatarioId} onValueChange={setDestinatarioId}>
                <SelectTrigger id="destinatario">
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
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="uf-inicio">UF de início</Label>
              <Select value={ufInicio} onValueChange={setUfInicio}>
                <SelectTrigger id="uf-inicio">
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
              <Label htmlFor="uf-fim">UF de término</Label>
              <Select value={ufFim} onValueChange={setUfFim}>
                <SelectTrigger id="uf-fim">
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
            <Documented docId="m5.frete" className="space-y-1.5">
              <Label htmlFor="frete">Valor do frete</Label>
              <Input
                id="frete"
                type="number"
                step="0.01"
                value={valorFrete}
                onChange={(e) => setValorFrete(Number(e.target.value))}
              />
            </Documented>
            <div className="space-y-1.5">
              <Label htmlFor="pedagio">Pedágio</Label>
              <Input
                id="pedagio"
                type="number"
                step="0.01"
                value={pedagio}
                onChange={(e) => setPedagio(Number(e.target.value))}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="obs-cte">Observações</Label>
              <Input
                id="obs-cte"
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
                placeholder="Informações complementares (fictícias)"
              />
            </div>
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
              <span className="text-muted-foreground">Documentos vinculados</span>
              <span>{notas.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Valor da carga</span>
              <span>{brl(totalCarga)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Peso total</span>
              <span>{pesoTotal} kg</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Seguro estimado (cenário)</span>
              <span>{brl(seguroEstimado)}</span>
            </div>
            <Separator />
            <div className="flex justify-between text-base font-semibold">
              <span>Total da prestação</span>
              <span>{brl(totalPrestacao)}</span>
            </div>
            <p className="pt-1 text-xs text-muted-foreground">
              Composição do frete, tomador do serviço e tributação do CT-e dependem de regras
              versionadas no back-end. Aqui tudo é demonstrativo.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
