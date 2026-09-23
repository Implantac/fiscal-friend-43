import { createFileRoute } from "@tanstack/react-router";
import { ModuloPendente } from "@/components/layout/ModuloPendente";

export const Route = createFileRoute("/nfce")({
  head: () => ({
    meta: [
      { title: "Emissão de NFC-e modelo 65 — Simulador Fiscal" },
      {
        name: "description",
        content:
          "Simulação de PDV para NFC-e de varejo, com fila offline e transmissão simulada.",
      },
      { property: "og:title", content: "Emissão de NFC-e modelo 65 — Simulador Fiscal" },
      {
        property: "og:description",
        content: "PDV simulado com atalhos, pagamentos e contingência demonstrativa.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <ModuloPendente
      titulo="Emissão de NFC-e de Varejo — modelo 65"
      descricao="PDV simulado com entrada rápida, pagamentos, atalhos e fila de contingência demonstrativa."
      escopo={[
        "Entrada rápida por código de barras e busca de produtos",
        "Grade compacta de itens",
        "Pagamento em Dinheiro, Pix e Cartão",
        "Atalhos de teclado visíveis e funcionais",
        "Rascunho e transmissão simulada",
        "Conectividade simulada com fila de documentos pendentes e falhas recuperáveis",
      ]}
    />
  ),
});
