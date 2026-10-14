import { useCallback, useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertTriangle,
  ArrowRight,
  Database,
  FileText,
  Loader2,
  Lock,
  RefreshCw,
  ShieldAlert,
} from "lucide-react";

import { PageHeader } from "@/components/layout/AppShell";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  avancarDocumento,
  criarDocumento,
  listarDocumentos,
  type DocumentoDto,
} from "@/fiscal/servidor/documento.functions";
import type { EstadoDocumento, FamiliaDocumental } from "@/fiscal/ciclo-vida";

export const Route = createFileRoute("/documentos")({
  head: () => ({
    meta: [
      { title: "Documentos fiscais — Simulador Fiscal" },
      {
        name: "description",
        content:
          "Documentos fiscais persistidos, com ciclo de vida controlado, numeração reservada e isolamento por tenant. Nenhum documento desta tela está autorizado.",
      },
      { property: "og:title", content: "Documentos fiscais — Simulador Fiscal" },
      {
        property: "og:description",
        content:
          "Ciclo de vida de documentos fiscais com estados separados e sem transmissão real.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DocumentosPage,
});

const FAMILIAS: { valor: FamiliaDocumental; rotulo: string }[] = [
  { valor: "nfe55", rotulo: "NF-e 55" },
  { valor: "nfce65", rotulo: "NFC-e 65" },
  { valor: "nfse", rotulo: "NFS-e" },
  { valor: "cte57", rotulo: "CT-e 57" },
  { valor: "cteos67", rotulo: "CT-e OS 67" },
  { valor: "mdfe58", rotulo: "MDF-e 58" },
];

const ROTULO_ESTADO: Record<EstadoDocumento, string> = {
  simulacao: "Simulação",
  pre_validacao: "Pré-validação",
  documento_gerado: "Documento gerado",
  xml_validado: "XML validado",
  assinado: "Assinado",
  transmitido: "Transmitido",
  autorizado: "Autorizado",
  rejeitado: "Rejeitado",
  pendente_consulta: "Pendente de consulta",
  cancelado_ou_encerrado: "Cancelado / encerrado",
  indisponivel_ou_contingencia: "Indisponível / contingência",
};

/** Cor do selo de estado. Nunca sugere "autorizado" sem protocolo oficial. */
function varianteEstado(
  estado: EstadoDocumento,
): "default" | "secondary" | "outline" | "destructive" {
  if (estado === "simulacao" || estado === "pre_validacao") return "secondary";
  if (estado === "rejeitado") return "destructive";
  if (estado === "autorizado") return "default";
  return "outline";
}

function DocumentosPage() {
  const listar = useServerFn(listarDocumentos);
  const criar = useServerFn(criarDocumento);
  const avancar = useServerFn(avancarDocumento);

  const [documentos, setDocumentos] = useState<DocumentoDto[]>([]);
  const [memoria, setMemoria] = useState<boolean | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const [familia, setFamilia] = useState<FamiliaDocumental>("nfe55");
  const [serie, setSerie] = useState("1");
  const [ambiente, setAmbiente] = useState<"1" | "2">("2");
  const [totalCentavos, setTotalCentavos] = useState("");
  const [criando, setCriando] = useState(false);

  const recarregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const r = await listar({ data: {} });
      if (!r.ok) {
        setErro(r.erro);
        setDocumentos([]);
        return;
      }
      setDocumentos(r.dados.documentos);
      setMemoria(r.dados.memoria);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha inesperada ao listar documentos.");
    } finally {
      setCarregando(false);
    }
  }, [listar]);

  useEffect(() => {
    void recarregar();
  }, [recarregar]);

  async function enviarCriacao(e: React.FormEvent) {
    e.preventDefault();
    setCriando(true);
    setErro(null);
    setAviso(null);
    try {
      const digitado = totalCentavos.replace(/\D/g, "");
      const r = await criar({
        data: {
          id: crypto.randomUUID(),
          familia,
          serie,
          ambiente: ambiente === "1" ? 1 : 2,
          valorTotalCentavos: digitado === "" ? "0" : digitado,
          idempotencia: crypto.randomUUID(),
        },
      });
      if (!r.ok) {
        setErro(r.erro);
        return;
      }
      setAviso(
        `Documento ${r.dados.modelo}/${r.dados.serie}/${r.dados.numero} criado em "${ROTULO_ESTADO[r.dados.estado]}". ` +
          `Número reservado de forma atômica. Isto não é transmissão nem autorização.`,
      );
      setTotalCentavos("");
      await recarregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha inesperada ao criar documento.");
    } finally {
      setCriando(false);
    }
  }

  async function enviarTransicao(doc: DocumentoDto, para: EstadoDocumento) {
    setErro(null);
    setAviso(null);
    try {
      const r = await avancar({ data: { id: doc.id, para } });
      if (!r.ok) {
        setErro(r.erro);
        return;
      }
      setAviso(
        `Documento ${r.dados.modelo}/${r.dados.serie}/${r.dados.numero}: "${ROTULO_ESTADO[doc.estado]}" → "${ROTULO_ESTADO[r.dados.estado]}".`,
      );
      await recarregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha inesperada ao avançar o documento.");
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        titulo="Documentos fiscais"
        descricao="Documentos persistidos com ciclo de vida controlado, numeração reservada atomicamente e isolamento por tenant. Esta é a camada real de documentos — não a simulação."
      />

      <Alert variant="destructive">
        <ShieldAlert className="size-4" aria-hidden />
        <AlertTitle>Nenhum documento desta tela está autorizado</AlertTitle>
        <AlertDescription>
          <p>
            Todos os documentos abaixo estão em <strong>simulação</strong> ou{" "}
            <strong>pré-validação</strong>: não têm XML gerado, não foram assinados, não foram
            transmitidos e não têm protocolo fiscal. Um selo "autorizado" só pode aparecer aqui
            depois de uma resposta oficial do SEFAZ ou do provedor, com protocolo próprio — e
            nenhuma integração dessas está conectada.
          </p>
          <p className="mt-2">
            As telas de emissão (NF-e, NFC-e, NFS-e, CT-e, MDF-e) continuam sendo{" "}
            <strong>simuladores</strong>: calculam e montam XML de demonstração, sem tocar no
            serviço fiscal. Esta tela é o caminho real, e por isso exige sessão.
          </p>
        </AlertDescription>
      </Alert>

      {memoria === true ? (
        <Alert>
          <Database className="size-4" aria-hidden />
          <AlertTitle>Persistência em memória do processo</AlertTitle>
          <AlertDescription>
            Nenhuma string de conexão foi encontrada (<code>SUPABASE_DB_URL</code> ou{" "}
            <code>DATABASE_URL</code>), então os documentos ficam na memória do servidor e somem ao
            reiniciar. O número reservado também. Isto é aceitável em desenvolvimento e não é
            persistência.
          </AlertDescription>
        </Alert>
      ) : null}

      {erro ? (
        <Alert variant="destructive">
          <AlertTriangle className="size-4" aria-hidden />
          <AlertTitle>Não foi possível concluir</AlertTitle>
          <AlertDescription>{erro}</AlertDescription>
        </Alert>
      ) : null}

      {aviso ? (
        <Alert>
          <FileText className="size-4" aria-hidden />
          <AlertTitle>Operação registrada</AlertTitle>
          <AlertDescription>{aviso}</AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Criar documento</CardTitle>
          <CardDescription>
            Reserva o próximo número da série de forma atômica e cria o documento em simulação. O
            total é informado em <strong>centavos</strong>, como inteiro exato — nunca ponto
            flutuante.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={enviarCriacao} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1.5">
              <Label htmlFor="familia">Família</Label>
              <Select value={familia} onValueChange={(v) => setFamilia(v as FamiliaDocumental)}>
                <SelectTrigger id="familia">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FAMILIAS.map((f) => (
                    <SelectItem key={f.valor} value={f.valor}>
                      {f.rotulo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="serie">Série</Label>
              <Input
                id="serie"
                value={serie}
                onChange={(e) => setSerie(e.target.value)}
                maxLength={3}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ambiente">Ambiente</Label>
              <Select value={ambiente} onValueChange={(v) => setAmbiente(v as "1" | "2")}>
                <SelectTrigger id="ambiente">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="2">2 — homologação</SelectItem>
                  <SelectItem value="1">1 — produção</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="total">Total (centavos)</Label>
              <Input
                id="total"
                value={totalCentavos}
                onChange={(e) => setTotalCentavos(e.target.value)}
                inputMode="numeric"
                placeholder="12345"
              />
            </div>

            <div className="sm:col-span-2 lg:col-span-4">
              <Button type="submit" disabled={criando}>
                {criando ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : (
                  <FileText className="size-4" aria-hidden />
                )}
                Criar em simulação
              </Button>
              <p className="mt-2 text-xs text-muted-foreground">
                Ambiente 1 (produção) só deve ser usado com credenciamento e certificado válidos —
                nenhum dos dois está configurado neste ambiente.
              </p>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <div>
              <CardTitle>Documentos do tenant</CardTitle>
              <CardDescription>
                Somente documentos do tenant da sessão. Documento de outro tenant devolve "não
                encontrado" — a existência do recurso também é dado protegido.
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void recarregar()}
              disabled={carregando}
            >
              <RefreshCw className="size-4" aria-hidden /> Atualizar
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {carregando ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" aria-hidden /> Carregando…
            </p>
          ) : documentos.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum documento. Crie o primeiro acima — ele nasce em simulação, sem valor fiscal.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Documento</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Valor fiscal</TableHead>
                  <TableHead>Criado</TableHead>
                  <TableHead className="text-right">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {documentos.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell className="font-medium">
                      {d.familia} {d.modelo}/{d.serie}/{d.numero}
                      <div className="text-xs text-muted-foreground">
                        ambiente {d.ambiente} · {d.eventos.length} evento(s)
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={varianteEstado(d.estado)}>{ROTULO_ESTADO[d.estado]}</Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{d.valorFormatado}</TableCell>
                    <TableCell>
                      {d.semValorFiscal ? (
                        <span className="text-xs text-muted-foreground">sem valor fiscal</span>
                      ) : (
                        <Badge variant="default">com protocolo</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{d.criadoEm}</TableCell>
                    <TableCell className="text-right">
                      {d.transicoes.permitidas.length === 0 ? (
                        <span className="text-xs text-muted-foreground">nenhuma ação</span>
                      ) : (
                        d.transicoes.permitidas.map((p) => (
                          <Button
                            key={p}
                            variant="outline"
                            size="sm"
                            onClick={() => void enviarTransicao(d, p)}
                          >
                            <ArrowRight className="size-4" aria-hidden /> {ROTULO_ESTADO[p]}
                          </Button>
                        ))
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {documentos.some((d) => d.transicoes.bloqueadas.length > 0) ? (
            <div className="mt-4 space-y-2">
              <p className="text-sm font-medium">Estados indisponíveis e por quê</p>
              {documentos
                .filter((d) => d.transicoes.bloqueadas.length > 0)
                .map((d) => (
                  <div key={d.id} className="rounded-md border p-3 text-xs">
                    <p className="font-medium">
                      {d.familia} {d.modelo}/{d.serie}/{d.numero}
                    </p>
                    <ul className="mt-1 space-y-1 text-muted-foreground">
                      {d.transicoes.bloqueadas.map((b) => (
                        <li key={b.estado}>
                          <strong>{ROTULO_ESTADO[b.estado]}</strong>: {b.motivo}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Alert>
        <Lock className="size-4" aria-hidden />
        <AlertTitle>Autorização verificada no servidor</AlertTitle>
        <AlertDescription>
          Toda operação passa por <code>exigirContexto()</code> e pela verificação de papel.
          Esconder um botão na interface não é controle de acesso — a regra vale no servidor, e a
          tentativa negada fica na trilha de auditoria.{" "}
          <Link to="/entrar" className="underline">
            Gerenciar sessão
          </Link>
          .
        </AlertDescription>
      </Alert>
    </div>
  );
}
