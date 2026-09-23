import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Loader2, Save, Send } from "lucide-react";

import { ExportarDocumento } from "@/components/blueprint/ExportarDocumento";
import { gerarNfse } from "@/simulation/documento-saida";
import { PageHeader } from "@/components/layout/AppShell";
import { Documented } from "@/components/blueprint/Documented";
import { ResultadoAlert } from "@/components/blueprint/ResultadoAlert";
import { useEmissao } from "@/simulation/useEmissao";
import { clientes, servicos } from "@/simulation/cadastros";
import { parametrosCenario } from "@/simulation/parametros-cenario";
import { brl } from "@/lib/format";
import type { ProblemaCampo } from "@/simulation/emissao-gateway";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/nfse")({
  head: () => ({
    meta: [
      { title: "Emissão de NFS-e — Simulador Fiscal" },
      {
        name: "description",
        content:
          "Emissão simulada de NFS-e no fluxo do PlugNotas, com campos essenciais em destaque e tributação avançada recolhida.",
      },
      { property: "og:title", content: "Emissão de NFS-e — Simulador Fiscal" },
      {
        property: "og:description",
        content: "Tela enxuta de NFS-e simulada com blueprint de integração PlugNotas.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: EmissaoNfse,
});

function EmissaoNfse() {
  const [clienteId, setClienteId] = useState("");
  const [servicoId, setServicoId] = useState("");
  const [valor, setValor] = useState(0);
  const [descricao, setDescricao] = useState("");
  const [issRetido, setIssRetido] = useState(false);
  const [aliquotaIss, setAliquotaIss] = useState(parametrosCenario.issPercentual);
  const [deducoes, setDeducoes] = useState(0);
  const [observacoes, setObservacoes] = useState("");

  const { resultado, processando, salvar, transmitir, limpar } = useEmissao("nfse");

  const baseCalculo = Math.max(0, valor - deducoes);
  const issEstimado = (baseCalculo * aliquotaIss) / 100;

  const problemas: ProblemaCampo[] = [];
  if (!clienteId)
    problemas.push({ campo: "Cliente", mensagem: "Selecione o tomador fictício.", docId: "m4.cliente" });
  if (!servicoId)
    problemas.push({ campo: "Serviço", mensagem: "Selecione o serviço prestado.", docId: "m4.servico" });
  if (valor <= 0)
    problemas.push({ campo: "Valor", mensagem: "Informe um valor maior que zero.", docId: "m4.valor" });
  if (descricao.trim().length < 10)
    problemas.push({
      campo: "Descrição",
      mensagem: "Descreva o serviço com pelo menos 10 caracteres.",
      docId: "m4.descricao",
    });

  const resumo = `NFS-e simulada · ${brl(valor)}`;

  return (
    <div className="space-y-5">
      <PageHeader
        titulo="Emissão de NFS-e"
        descricao="Fluxo simulado no modelo do PlugNotas: quatro campos essenciais em destaque e a tributação avançada recolhida, para o caso de uso mais comum."
        acoes={
          <div className="flex gap-2">
            <Button variant="outline" disabled={processando} onClick={() => salvar(resumo)}>
              <Save className="size-4" aria-hidden /> Salvar rascunho (F9)
            </Button>
            <Button disabled={processando} onClick={() => transmitir({ resumo, problemas })}>
              {processando ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <Send className="size-4" aria-hidden />
              )}
              Emitir (simulado)
            </Button>
          </div>
        }
      />

      <ExportarDocumento rotuloPdf="DANFSe" gerar={() => gerarNfse({ cliente: clientes.find((c) => c.id === clienteId), servico: servicos.find((s) => s.id === servicoId), descricao, valor, deducoes, aliquotaIss, issRetido })} />

      {resultado ? <ResultadoAlert resultado={resultado} onFechar={limpar} /> : null}

      <div className="grid gap-5 xl:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Dados essenciais</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Documented docId="m4.cliente" className="space-y-1.5">
              <Label htmlFor="cliente">Cliente (tomador fictício)</Label>
              <Select value={clienteId} onValueChange={setClienteId}>
                <SelectTrigger id="cliente">
                  <SelectValue placeholder="Selecione o cliente" />
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

            <Documented docId="m4.servico" className="space-y-1.5">
              <Label htmlFor="servico">Serviço</Label>
              <Select value={servicoId} onValueChange={setServicoId}>
                <SelectTrigger id="servico">
                  <SelectValue placeholder="Selecione o serviço" />
                </SelectTrigger>
                <SelectContent>
                  {servicos.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.codigoInterno} — {s.descricao}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Códigos internos fictícios. A lista oficial de serviços do município precisa ser
                confirmada antes da integração real.
              </p>
            </Documented>

            <Documented docId="m4.valor" className="space-y-1.5">
              <Label htmlFor="valor">Valor do serviço</Label>
              <Input
                id="valor"
                type="number"
                step="0.01"
                value={valor}
                onChange={(e) => setValor(Number(e.target.value))}
              />
            </Documented>

            <Documented docId="m4.descricao" className="space-y-1.5">
              <Label htmlFor="descricao">Descrição do serviço</Label>
              <Textarea
                id="descricao"
                rows={4}
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder="Descreva o serviço prestado (conteúdo fictício)"
              />
            </Documented>

            <Documented docId="m4.avancada">
              <Accordion type="single" collapsible>
                <AccordionItem value="avancada">
                  <AccordionTrigger className="text-sm">
                    Tributação avançada (opcional)
                  </AccordionTrigger>
                  <AccordionContent className="space-y-4 pt-1">
                    <p className="text-xs text-muted-foreground">
                      Campos recolhidos porque a maioria das emissões não precisa deles. Os valores
                      abaixo são de cenário; retenções e alíquotas reais dependem do município e de
                      regras versionadas no back-end.
                    </p>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label htmlFor="aliquota">Alíquota de ISS (cenário) %</Label>
                        <Input
                          id="aliquota"
                          type="number"
                          step="0.01"
                          value={aliquotaIss}
                          onChange={(e) => setAliquotaIss(Number(e.target.value))}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="deducoes">Deduções</Label>
                        <Input
                          id="deducoes"
                          type="number"
                          step="0.01"
                          value={deducoes}
                          onChange={(e) => setDeducoes(Number(e.target.value))}
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="iss-retido"
                        checked={issRetido}
                        onCheckedChange={(v) => setIssRetido(v === true)}
                      />
                      <Label htmlFor="iss-retido" className="font-normal">
                        ISS retido pelo tomador (cenário)
                      </Label>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="obs">Observações</Label>
                      <Textarea
                        id="obs"
                        rows={3}
                        value={observacoes}
                        onChange={(e) => setObservacoes(e.target.value)}
                      />
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </Documented>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              Prévia
              <Badge variant="outline">Estimativa simulada</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Valor do serviço</span>
              <span>{brl(valor)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Deduções</span>
              <span>{brl(deducoes)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Base de cálculo (cenário)</span>
              <span>{brl(baseCalculo)}</span>
            </div>
            <div className="flex justify-between font-medium">
              <span>ISS estimado ({aliquotaIss}%)</span>
              <span>{brl(issEstimado)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Líquido estimado</span>
              <span>{brl(issRetido ? valor - issEstimado : valor)}</span>
            </div>
            <p className="pt-2 text-xs text-muted-foreground">
              Prévia simulada, não é apuração. O município de incidência, a retenção e a alíquota
              aplicável precisam ser resolvidos pelo back-end.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
