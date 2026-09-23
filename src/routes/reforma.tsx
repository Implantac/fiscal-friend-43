import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/layout/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ProcedenciaNota } from "@/components/knowledge/StatusBadge";
import { conceitoReforma, comparacao, procedenciaReforma } from "@/knowledge/reforma";

export const Route = createFileRoute("/reforma")({
  head: () => ({
    meta: [
      { title: "Reforma tributária: IBS, CBS e IS — Fiscal Friend" },
      {
        name: "description",
        content:
          "Conceito, transição, documentos afetados, classificação e impactos no ERP do novo modelo de tributos sobre consumo, com status pendente de validação.",
      },
      { property: "og:title", content: "Reforma tributária: IBS, CBS e IS — Fiscal Friend" },
      {
        property: "og:description",
        content: "Modelo atual × novo modelo, campo a campo, sem tratar cronograma como imutável.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Reforma,
});

function Reforma() {
  return (
    <div className="space-y-5">
      <PageHeader
        titulo="Reforma tributária"
        descricao="Área dedicada ao novo modelo de tributos sobre consumo. Nada aqui é cronograma fechado nem alíquota oficial: toda informação depende de confirmação na legislação e nas notas técnicas vigentes."
      />

      <ProcedenciaNota p={procedenciaReforma} />

      <div className="grid gap-4 md:grid-cols-2">
        {conceitoReforma.map((t) => (
          <Card key={t.titulo}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{t.titulo}</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="list-disc space-y-1.5 pl-4 text-sm">
                {t.conteudo.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Modelo atual × novo modelo</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[220px]">Aspecto</TableHead>
                <TableHead>Modelo atual</TableHead>
                <TableHead>Novo modelo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {comparacao.map((c) => (
                <TableRow key={c.aspecto}>
                  <TableCell className="font-medium">{c.aspecto}</TableCell>
                  <TableCell className="text-muted-foreground">{c.atual}</TableCell>
                  <TableCell>{c.reforma}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <p className="mt-3 text-xs text-muted-foreground">
            Comparação conceitual. Antes de implementar qualquer campo novo no ERP, confirme leiaute,
            grupo XML, classificação e vigência na nota técnica correspondente.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
