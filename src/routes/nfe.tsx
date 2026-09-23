import { createFileRoute } from "@tanstack/react-router";
import { ModuloPendente } from "@/components/layout/ModuloPendente";

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
  component: () => (
    <ModuloPendente
      titulo="Emissão de NF-e de Produtos — modelo 55"
      descricao="Tela de emissão simulada, com grade de itens e prévia tributária apresentada sempre como estimativa."
      escopo={[
        "Identificação do destinatário e dados básicos da operação",
        "Grade de itens com autocomplete de produtos fictícios",
        "Quantidade, preço, desconto e totais por item",
        "Resumo de totais atualizado conforme os itens mudam",
        "Sugestão de CFOP contextual, marcada como heurística do protótipo",
        "Prévia dos principais grupos tributários, identificada como simulação",
      ]}
    />
  ),
});
