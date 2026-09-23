import { createFileRoute } from "@tanstack/react-router";
import { ModuloPendente } from "@/components/layout/ModuloPendente";

export const Route = createFileRoute("/cte-os")({
  head: () => ({
    meta: [
      { title: "Emissão de CT-e OS modelo 67 — Simulador Fiscal" },
      {
        name: "description",
        content:
          "Simulação de CT-e OS para transporte de pessoas ou de valores, com campos condicionais.",
      },
      { property: "og:title", content: "Emissão de CT-e OS modelo 67 — Simulador Fiscal" },
      {
        property: "og:description",
        content: "Campos condicionais por tipo de serviço e grade de malotes.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <ModuloPendente
      titulo="Emissão de CT-e OS — modelo 67"
      descricao="Serviço de transporte de pessoas ou de valores, com campos que mudam conforme a escolha."
      escopo={[
        "Seletor entre Transporte de Pessoas e Transporte de Valores",
        "Campos de fretamento e data da viagem quando aplicáveis",
        "Grade dinâmica de códigos de malotes no transporte de valores",
        "Validações de ANTT, rota e viagem tratadas como condicionais e rastreáveis",
      ]}
    />
  ),
});
