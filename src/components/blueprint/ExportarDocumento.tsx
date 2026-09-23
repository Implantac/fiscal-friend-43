import { useState } from "react";
import { FileCode2, FileText, Eye } from "lucide-react";
import { toast } from "sonner";
import type { DocumentoGerado } from "@/simulation/documento-saida";
import { baixarPdf, baixarXml } from "@/simulation/documento-pdf";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

/**
 * Gera o XML (leiaute oficial vigente) e a representação impressa em PDF,
 * ambos SEM VALOR FISCAL, a partir dos dados preenchidos na tela.
 */
export function ExportarDocumento({
  gerar,
  rotuloPdf,
}: {
  gerar: () => DocumentoGerado;
  rotuloPdf: string;
}) {
  const [previa, setPrevia] = useState<string | null>(null);

  const acao = async (tipo: "xml" | "pdf" | "ver") => {
    try {
      const d = gerar();
      if (tipo === "xml") baixarXml(d.xml, d.nomeBase);
      else if (tipo === "pdf") await baixarPdf(d.pdf, d.nomeBase);
      else setPrevia((p) => (p ? null : d.xml));
    } catch (e) {
      toast.error("Não foi possível gerar o arquivo", {
        description: e instanceof Error ? e.message : String(e),
      });
    }
  };

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium">Gerar arquivos</span>
          <Badge variant="outline">Sem valor fiscal</Badge>
          <div className="ml-auto flex flex-wrap gap-2">
            <Button size="sm" variant="ghost" onClick={() => acao("ver")}>
              <Eye className="size-4" aria-hidden /> {previa ? "Ocultar XML" : "Ver XML"}
            </Button>
            <Button size="sm" variant="outline" onClick={() => acao("xml")}>
              <FileCode2 className="size-4" aria-hidden /> Baixar XML
            </Button>
            <Button size="sm" variant="outline" onClick={() => acao("pdf")}>
              <FileText className="size-4" aria-hidden /> Baixar {rotuloPdf} (PDF)
            </Button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          XML no leiaute oficial vigente, em ambiente de homologação, sem assinatura digital e sem
          protocolo. Os tributos são calculados com percentuais de cenário do simulador (não oficiais) e a conferência contra
          os schemas oficiais ainda está pendente.
        </p>
        {previa ? (
          <pre className="max-h-96 overflow-auto rounded-md border bg-muted/40 p-3 font-mono text-xs">
            {previa}
          </pre>
        ) : null}
      </CardContent>
    </Card>
  );
}
