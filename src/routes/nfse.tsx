import { createFileRoute } from "@tanstack/react-router";
import { ModuloPendente } from "@/components/layout/ModuloPendente";

export const Route = createFileRoute("/nfse")({
  head: () => ({
    meta: [
      { title: "Emissão de NFS-e — Simulador Fiscal" },
      {
        name: "description",
        content:
          "Simulação de emissão de NFS-e com mapeamento de prestador, tomador e serviço marcado por estado de validação.",
      },
      { property: "og:title", content: "Emissão de NFS-e — Simulador Fiscal" },
      {
        property: "og:description",
        content: "Tela simplificada de NFS-e com tributação avançada colapsada.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <ModuloPendente
      titulo="Emissão de NFS-e"
      descricao="Tela operacional simplificada de serviços, com tributação avançada em accordion colapsado."
      escopo={[
        "Campos principais: Cliente, Serviço Prestado, Valor e Descrição",
        "Accordion colapsado de Tributação Avançada",
        "Mapeamento de prestador, tomador e serviço no painel técnico",
        "Retenção de ISS modelada como regra configurável, nunca deduzida automaticamente",
        "Pendências explícitas quando faltarem dados para concluir uma regra",
      ]}
    />
  ),
});
