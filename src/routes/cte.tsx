import { createFileRoute } from "@tanstack/react-router";
import { ModuloPendente } from "@/components/layout/ModuloPendente";

export const Route = createFileRoute("/cte")({
  head: () => ({
    meta: [
      { title: "Emissão de CT-e modelo 57 — Simulador Fiscal" },
      {
        name: "description",
        content:
          "Simulação de CT-e de carga com leitura demonstrativa de XML de NF-e e revisão de dados da carga.",
      },
      { property: "og:title", content: "Emissão de CT-e modelo 57 — Simulador Fiscal" },
      {
        property: "og:description",
        content: "Importação demonstrativa de XML e montagem simulada do CT-e de carga.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <ModuloPendente
      titulo="Emissão de CT-e de Carga — modelo 57"
      descricao="Importação demonstrativa de XML de NF-e para montar o transporte, sem envio de arquivos a serviços externos."
      escopo={[
        "Área de arrastar e soltar XML com alternativa acessível de seleção de arquivo",
        "Validação de tipo e estrutura mínima do arquivo",
        "Extração demonstrativa dos dados e indicação da origem de cada campo",
        "Revisão de remetente, destinatário, peso, cubagem e valor da carga",
        "Valor do frete preenchido pelo operador",
        "Seguro da carga tratado como regra configurável pendente de validação",
      ]}
    />
  ),
});
