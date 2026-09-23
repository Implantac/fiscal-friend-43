import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Copy, Download, Eye, History, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/layout/AppShell";
import { Documented } from "@/components/blueprint/Documented";
import { useSimulator } from "@/blueprint/SimulatorProvider";
import { rotuloManifestacao } from "@/simulation/fiscal-gateway";
import { brl, dateBR, dateTimeBR, formatChave, formatCnpj } from "@/lib/format";
import type { ManifestacaoTipo, NotaRecebida, ResultadoSimulado } from "@/domain/types";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Central de Manifestação — Simulador Fiscal" },
      {
        name: "description",
        content:
          "Simulação da manifestação do destinatário sobre notas recebidas, com blueprint técnico de integração para ERP.",
      },
      { property: "og:title", content: "Central de Manifestação — Simulador Fiscal" },
      {
        property: "og:description",
        content:
          "Ambiente de simulação: manifestação de notas recebidas e documentação de integração para a equipe de desenvolvimento.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Manifestacao,
});

const statusBadge: Record<NotaRecebida["status"], { label: string; className: string }> = {
  sem_manifestacao: { label: "Sem manifestação", className: "bg-muted text-muted-foreground" },
  ciencia: { label: "Ciência", className: "bg-accent text-accent-foreground" },
  confirmacao: {
    label: "Confirmada",
    className: "bg-[var(--auto-surface)] text-[var(--auto-foreground)]",
  },
  nao_realizada: { label: "Não realizada", className: "bg-sim-surface text-sim-foreground" },
  desconhecimento: {
    label: "Desconhecida",
    className: "bg-destructive/10 text-destructive",
  },
};

const tipos: ManifestacaoTipo[] = ["ciencia", "confirmacao", "nao_realizada", "desconhecimento"];
const exigeJustificativa = (t: ManifestacaoTipo) =>
  t === "nao_realizada" || t === "desconhecimento";

function Manifestacao() {
  const { notas, manifestar, baixarXml, selectDoc, devMode } = useSimulator();
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [resultado, setResultado] = useState<ResultadoSimulado | null>(null);
  const [danfe, setDanfe] = useState<NotaRecebida | null>(null);
  const [historico, setHistorico] = useState<NotaRecebida | null>(null);
  const [pedido, setPedido] = useState<{ nota: NotaRecebida; tipo: ManifestacaoTipo } | null>(null);
  const [justificativa, setJustificativa] = useState("");

  const executar = async (nota: NotaRecebida, tipo: ManifestacaoTipo, just?: string) => {
    setOcupado(nota.id);
    const r = await manifestar(nota.id, tipo, just);
    setOcupado(null);
    setResultado(r);
    if (r.tipo === "sucesso") toast.success(r.titulo);
    else toast.error(r.titulo);
    return r;
  };

  const escolher = (nota: NotaRecebida, tipo: ManifestacaoTipo) => {
    if (exigeJustificativa(tipo)) {
      setJustificativa("");
      setPedido({ nota, tipo });
      return;
    }
    void executar(nota, tipo);
  };

  const copiarChave = async (chave: string) => {
    try {
      await navigator.clipboard.writeText(chave);
      toast.success("Chave de acesso copiada");
    } catch {
      toast.error("Não foi possível copiar a chave neste navegador");
    }
  };

  const xml = async (nota: NotaRecebida) => {
    setOcupado(nota.id);
    const r = await baixarXml(nota.id);
    setOcupado(null);
    setResultado(r);
    if (r.tipo === "sucesso") toast.success(r.titulo);
    else toast.error(r.titulo);
  };

  return (
    <>
      <PageHeader
        titulo="Central de Manifestação de Notas"
        descricao="Documentos fictícios destinados ao CNPJ da empresa simulada. Todas as ações executam fluxos simulados: nenhum evento é transmitido à SEFAZ."
      />

      {resultado && (
        <Alert
          className="mb-4"
          variant={resultado.tipo === "sucesso" ? "default" : "destructive"}
        >
          <AlertTitle className="flex items-center gap-2">
            {resultado.titulo}
            <Badge variant="outline" className="text-[11px]">
              {resultado.tipo === "sucesso"
                ? "Resultado simulado"
                : resultado.tipo === "rejeicao_fiscal"
                  ? "Rejeição fiscal (simulada)"
                  : resultado.tipo === "erro_provedor"
                    ? "Erro do provedor (simulado)"
                    : "Erro local"}
            </Badge>
          </AlertTitle>
          <AlertDescription className="space-y-1">
            <p>{resultado.explicacao}</p>
            <p className="font-medium">Ação sugerida: {resultado.acaoSugerida}</p>
            <p className="font-mono text-xs opacity-80">{resultado.mensagemTecnica}</p>
            <div className="flex gap-2 pt-1">
              {resultado.docId && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => selectDoc(resultado.docId ?? null)}
                >
                  Abrir documentação {devMode ? "" : "(ative o Modo Desenvolvedor)"}
                </Button>
              )}
              <Button size="sm" variant="ghost" onClick={() => setResultado(null)}>
                Fechar
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      <Documented docId="m1.tabela" className="rounded-lg border bg-surface shadow-panel">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[100px]">Emissão</TableHead>
              <TableHead>Emitente</TableHead>
              <TableHead className="w-[170px]">CNPJ (fictício)</TableHead>
              <TableHead className="w-[130px] text-right">Valor</TableHead>
              <TableHead className="w-[260px]">Chave de acesso</TableHead>
              <TableHead className="w-[150px]">Status</TableHead>
              <TableHead className="w-[300px] text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {notas.map((nota) => (
              <TableRow key={nota.id}>
                <TableCell className="font-mono text-xs">{dateBR(nota.emissaoISO)}</TableCell>
                <TableCell>
                  <span className="font-medium">{nota.emitente}</span>
                  <span className="block text-xs text-muted-foreground">{nota.natureza}</span>
                </TableCell>
                <TableCell className="font-mono text-xs">{formatCnpj(nota.cnpj)}</TableCell>
                <TableCell className="text-right font-medium">{brl(nota.valor)}</TableCell>
                <TableCell>
                  <Documented docId="m1.chave" inline>
                    <span className="flex items-center gap-1">
                      <code className="font-mono text-[11px] leading-tight text-muted-foreground">
                        {formatChave(nota.chave)}
                      </code>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-6 shrink-0"
                        aria-label={`Copiar chave de acesso da nota de ${nota.emitente}`}
                        onClick={() => void copiarChave(nota.chave)}
                      >
                        <Copy className="size-3.5" />
                      </Button>
                    </span>
                  </Documented>
                </TableCell>
                <TableCell>
                  <Badge className={statusBadge[nota.status].className} variant="secondary">
                    {statusBadge[nota.status].label}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-end gap-1">
                    <Documented docId="m1.manifestar" inline>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="sm" variant="default" disabled={ocupado === nota.id}>
                            {ocupado === nota.id ? (
                              <Loader2 className="size-4 animate-spin" />
                            ) : (
                              <ShieldCheck className="size-4" />
                            )}
                            Manifestar
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Evento do destinatário (simulado)</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          {tipos.map((t) => (
                            <DropdownMenuItem key={t} onSelect={() => escolher(nota, t)}>
                              {rotuloManifestacao[t]}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </Documented>

                    <Documented docId="m1.danfe" inline>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setDanfe(nota)}
                        aria-label={`Ver DANFE demonstrativo de ${nota.emitente}`}
                      >
                        <Eye className="size-4" />
                      </Button>
                    </Documented>

                    <Documented docId="m1.xml" inline>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => void xml(nota)}
                        disabled={ocupado === nota.id}
                        title={
                          nota.xmlDisponivel
                            ? "Download simulado do XML"
                            : "XML indisponível neste cenário"
                        }
                        aria-label={`Baixar XML simulado de ${nota.emitente}`}
                      >
                        <Download className="size-4" />
                      </Button>
                    </Documented>

                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setHistorico(nota)}
                      aria-label={`Ver histórico de ações de ${nota.emitente}`}
                    >
                      <History className="size-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Documented>

      {/* Justificativa para eventos de recusa */}
      <Dialog open={!!pedido} onOpenChange={(o) => !o && setPedido(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {pedido ? rotuloManifestacao[pedido.tipo] : ""} — justificativa
            </DialogTitle>
            <DialogDescription>
              No cenário configurado deste protótipo, este evento exige justificativa. A regra real
              deve ser versionada no back-end.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="just">Justificativa</Label>
            <Textarea
              id="just"
              value={justificativa}
              onChange={(e) => setJustificativa(e.target.value)}
              rows={4}
              placeholder="Descreva o motivo com pelo menos 15 caracteres"
            />
            <p className="text-xs text-muted-foreground">{justificativa.trim().length} caractere(s)</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPedido(null)}>
              Cancelar
            </Button>
            <Button
              onClick={async () => {
                if (!pedido) return;
                const alvo = pedido;
                const r = await executar(alvo.nota, alvo.tipo, justificativa);
                if (r.tipo !== "erro_local") setPedido(null);
              }}
            >
              Enviar evento simulado
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DANFE demonstrativo */}
      <Dialog open={!!danfe} onOpenChange={(o) => !o && setDanfe(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>DANFE demonstrativo — documento fictício</DialogTitle>
            <DialogDescription>
              Representação ilustrativa montada com dados sintéticos. Não corresponde a nenhum
              documento autorizado.
            </DialogDescription>
          </DialogHeader>
          {danfe && (
            <div className="space-y-3 rounded-md border p-4 text-sm">
              <div className="flex justify-between gap-4">
                <div>
                  <p className="font-semibold">{danfe.emitente}</p>
                  <p className="text-xs text-muted-foreground">
                    CNPJ fictício {formatCnpj(danfe.cnpj)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Emissão</p>
                  <p className="font-medium">{dateBR(danfe.emissaoISO)}</p>
                </div>
              </div>
              <div className="rounded bg-muted p-2">
                <p className="text-[11px] uppercase text-muted-foreground">Chave de acesso</p>
                <code className="font-mono text-xs">{formatChave(danfe.chave)}</code>
              </div>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-1">Descrição</th>
                    <th className="py-1 text-right">Qtd.</th>
                    <th className="py-1 text-right">Unitário</th>
                    <th className="py-1 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {danfe.itensDemo.map((i) => (
                    <tr key={i.descricao} className="border-b last:border-0">
                      <td className="py-1">{i.descricao}</td>
                      <td className="py-1 text-right">{i.quantidade}</td>
                      <td className="py-1 text-right">{brl(i.unitario)}</td>
                      <td className="py-1 text-right">{brl(i.quantidade * i.unitario)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="text-right font-semibold">Total do documento: {brl(danfe.valor)}</p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Histórico de ações */}
      <Dialog open={!!historico} onOpenChange={(o) => !o && setHistorico(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Histórico de ações simuladas</DialogTitle>
            <DialogDescription>{historico?.emitente}</DialogDescription>
          </DialogHeader>
          {historico && historico.historico.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhuma ação registrada para este documento nesta sessão.
            </p>
          ) : (
            <ul className="space-y-2">
              {historico?.historico.map((h) => (
                <li key={h.id} className="rounded-md border p-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{h.titulo}</span>
                    <Badge variant="outline" className="text-[11px]">
                      {h.origem === "local"
                        ? "Local"
                        : h.origem === "provedor_simulado"
                          ? "Provedor"
                          : "SEFAZ simulada"}
                    </Badge>
                  </div>
                  <p className="mt-1 font-mono text-xs text-muted-foreground">{h.detalhe}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{dateTimeBR(h.em)}</p>
                </li>
              ))}
            </ul>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
