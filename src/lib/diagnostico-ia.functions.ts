import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { campos } from "@/knowledge/campos";
import { regras } from "@/knowledge/regras";
import { fontes } from "@/knowledge/fontes";
import { statusLabel } from "@/knowledge/types";

export interface DiagnosticoIA {
  resumo: string;
  campo: { caminho: string; tag: string; linha: number | null; valorEncontrado: string; valorEsperado: string };
  causaProvavel: string;
  correcaoDesenvolvimento: string;
  correcaoSuporte: string;
  confianca: "alta" | "media" | "baixa";
  campoBaseId: string | null;
  regraBaseId: string | null;
  fontesIds: string[];
  pendencias: string[];
}

const schema = {
  type: "object",
  additionalProperties: false,
  required: ["resumo", "campo", "causaProvavel", "correcaoDesenvolvimento", "correcaoSuporte", "confianca", "campoBaseId", "regraBaseId", "fontesIds", "pendencias"],
  properties: {
    resumo: { type: "string" },
    campo: {
      type: "object",
      additionalProperties: false,
      required: ["caminho", "tag", "linha", "valorEncontrado", "valorEsperado"],
      properties: {
        caminho: { type: "string" },
        tag: { type: "string" },
        linha: { type: ["integer", "null"] },
        valorEncontrado: { type: "string" },
        valorEsperado: { type: "string" },
      },
    },
    causaProvavel: { type: "string" },
    correcaoDesenvolvimento: { type: "string" },
    correcaoSuporte: { type: "string" },
    confianca: { type: "string", enum: ["alta", "media", "baixa"] },
    campoBaseId: { type: ["string", "null"] },
    regraBaseId: { type: ["string", "null"] },
    fontesIds: { type: "array", items: { type: "string" } },
    pendencias: { type: "array", items: { type: "string" } },
  },
};

const entrada = z.object({
  xml: z.string().min(20).max(400_000),
  descricao: z.string().min(5).max(4000),
  achadosLocais: z.string().max(20_000),
});

export const diagnosticarNfe = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => entrada.parse(d))
  .handler(async ({ data }): Promise<{ ok: true; diagnostico: DiagnosticoIA } | { ok: false; erro: string }> => {
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) return { ok: false, erro: "Chave do serviço de IA não configurada." };

    const baseCampos = campos.filter((c) => c.documento === "nfe55").map((c) => `${c.id} | ${c.grupoXml}/${c.tagXml} | ${c.nome} | status: ${statusLabel[c.procedencia.status]} | fonte: ${c.procedencia.fonteId}`).join("\n");
    const baseRegras = regras.filter((r) => r.documento === "nfe55").map((r) => `${r.id} | ${r.titulo} | ${r.condicaoTecnica} | status: ${statusLabel[r.procedencia.status]} | fonte: ${r.procedencia.fonteId}`).join("\n");
    const baseFontes = fontes.map((f) => `${f.id} | ${f.categoria} | ${f.nome}`).join("\n");
    const linhas = data.xml.split(/\r?\n/).map((l, i) => `${i + 1}: ${l}`).join("\n").slice(0, 120_000);

    const instrucoes = `Você é um especialista em NF-e modelo 55 ajudando desenvolvedores e suporte de um ERP brasileiro, em Ambiente de Simulação.
Responda em português do Brasil. Aponte o campo exato (caminho XPath, tag e número da linha do XML numerado).
REGRAS INEGOCIÁVEIS:
- Nunca invente código de rejeição (cStat), alíquota, leiaute ou regra oficial. Se citar algo não confirmado, coloque em "pendencias" como "Pendente de validação".
- campoBaseId e regraBaseId devem ser EXATAMENTE um id da base abaixo, ou null.
- fontesIds deve conter apenas ids da lista de fontes abaixo.
- Priorize os achados determinísticos da conferência local; eles são cálculos exatos.

BASE DE CAMPOS (id | caminho | nome | status | fonte):
${baseCampos}

BASE DE REGRAS (id | título | condição | status | fonte):
${baseRegras}

FONTES CADASTRADAS (id | categoria | nome):
${baseFontes}`;

    const input = `Descrição do erro relatada:\n${data.descricao}\n\nAchados da conferência local:\n${data.achadosLocais || "(nenhum)"}\n\nXML numerado:\n${linhas}`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": key, "X-Lovable-AIG-SDK": "fetch" },
      body: JSON.stringify({
        model: "openai/gpt-6-astra",
        instructions: instrucoes,
        input,
        stream: true,
        store: false,
        reasoning: { effort: "low" },
        text: { format: { type: "json_schema", name: "diagnostico", strict: true, schema } },
      }),
    });
    if (!res.ok || !res.body) {
      const t = await res.text().catch(() => "");
      if (res.status === 429) return { ok: false, erro: "Muitas solicitações. Tente de novo em instantes." };
      if (res.status === 402) return { ok: false, erro: "Créditos de IA esgotados no workspace." };
      return { ok: false, erro: `Serviço de IA respondeu ${res.status}. ${t.slice(0, 300)}` };
    }

    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = "";
    let texto = "";
    let recusa = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const partes = buf.split("\n");
      buf = partes.pop() ?? "";
      for (const l of partes) {
        if (!l.startsWith("data:")) continue;
        const p = l.slice(5).trim();
        if (!p || p === "[DONE]") continue;
        try {
          const ev = JSON.parse(p) as { type?: string; delta?: string; error?: { message?: string } };
          if (ev.type === "response.output_text.delta" && ev.delta) texto += ev.delta;
          if (ev.type === "response.refusal.delta" && ev.delta) recusa += ev.delta;
          if (ev.type === "error" || ev.type === "response.failed") return { ok: false, erro: ev.error?.message ?? "Falha no serviço de IA." };
        } catch { /* frame parcial */ }
      }
    }
    if (recusa) return { ok: false, erro: `O modelo recusou a solicitação: ${recusa}` };
    try {
      const d = JSON.parse(texto) as DiagnosticoIA;
      const idsCampo = new Set(campos.map((c) => c.id));
      const idsRegra = new Set(regras.map((r) => r.id));
      const idsFonte = new Set(fontes.map((f) => f.id));
      if (d.campoBaseId && !idsCampo.has(d.campoBaseId)) d.campoBaseId = null;
      if (d.regraBaseId && !idsRegra.has(d.regraBaseId)) d.regraBaseId = null;
      d.fontesIds = d.fontesIds.filter((f) => idsFonte.has(f));
      return { ok: true, diagnostico: d };
    } catch {
      return { ok: false, erro: "O modelo não devolveu um diagnóstico legível." };
    }
  });
