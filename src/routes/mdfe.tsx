import { createFileRoute } from "@tanstack/react-router";
import { ModuloPendente } from "@/components/layout/ModuloPendente";

export const Route = createFileRoute("/mdfe")({
  head: () => ({
    meta: [
      { title: "Emissão de MDF-e modelo 58 — Simulador Fiscal" },
      {
        name: "description",
        content:
          "Simulação de montagem de manifesto eletrônico com documentos, motorista, veículo e totais dinâmicos.",
      },
      { property: "og:title", content: "Emissão de MDF-e modelo 58 — Simulador Fiscal" },
      {
        property: "og:description",
        content: "Montagem simulada do manifesto com seleção de documentos e percurso.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <ModuloPendente
      titulo="Emissão de MDF-e — modelo 58"
      descricao="Montagem simulada do manifesto a partir de documentos fictícios já emitidos."
      escopo={[
        "Lista de CT-e e NF-e fictícios com seleção por checkbox",
        "Escolha de motorista e de veículo por placa",
        "Inclusão demonstrativa de reboques a partir do cadastro do veículo",
        "Totais dinâmicos de documentos, valores e pesos",
        "Resumo de percurso e UFs, com cálculo de rota marcado como pendente de validação",
      ]}
    />
  ),
});
