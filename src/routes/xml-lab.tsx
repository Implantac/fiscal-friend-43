import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/layout/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusBadge, EtiquetaDidatica } from "@/components/knowledge/StatusBadge";
import { XmlViewer, XmlDiff, formatarXml } from "@/components/knowledge/XmlViewer";
import { campos, campoById } from "@/knowledge/campos";
import { regraById } from "@/knowledge/regras";
import { cstatByCodigo } from "@/knowledge/cstats";

export const Route = createFileRoute("/xml-lab")({
  validateSearch: (s: Record<string, unknown>) => ({
    campo: typeof s["campo"] === "string" ? s["campo"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Laboratório de XML — Fiscal Friend" },
      {
        name: "description",
        content:
          "Formate e pesquise o XML de exemplo, clique numa tag e veja o campo fiscal correspondente, suas regras, validações e rejeições relacionadas.",
      },
      { property: "og:title", content: "Laboratório de XML — Fiscal Friend" },
      { property: "og:description", content: "Tag XML → campo → regra → validação → rejeição." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: XmlLab,
});

const XML_EXEMPLO = `<infNFe versao="4.00"><ide><cUF>35</cUF><natOp>Venda de mercadoria</natOp><mod>55</mod><serie>1</serie><nNF>123</nNF><idDest>2</idDest></ide><emit><CNPJ>00000000000191</CNPJ><xNome>Aurora Distribuidora de Materiais Ltda (fictício)</xNome></emit><dest><CPF>11144477735</CPF><xNome>Consumidor final (fictício)</xNome></dest><det nItem="1"><prod><cProd>P-001</cProd><xProd>Cabo de aço 3/8</xProd><NCM>73269090</NCM><CFOP>6102</CFOP><qCom>10.0000</qCom><vUnCom>250.00</vUnCom><vProd>2500.00</vProd><vDesc>100.00</vDesc><vFrete>80.00</vFrete></prod><imposto><ICMS><ICMS00><CST>00</CST><vBC>2480.00</vBC><pICMS>12.00</pICMS><vICMS>297.60</vICMS></ICMS00></ICMS></imposto></det><total><ICMSTot><vBC>2480.00</vBC><vICMS>297.60</vICMS><vNF>2480.00</vNF></ICMSTot></total></infNFe>`;

const XML_INCORRETO = XML_EXEMPLO.replace("<CFOP>6102</CFOP>", "<CFOP>5102</CFOP>").replace(
  "<vICMS>297.60</vICMS></ICMS00>",
  "<vICMS>290.00</vICMS></ICMS00>",
);

function XmlLab() {
  const { campo } = Route.useSearch();
  const [xml, setXml] = useState(XML_EXEMPLO);
  const [busca, setBusca] = useState("");
  const [tag, setTag] = useState<string | undefined>(
    campo ? campoById.get(campo)?.tagXml : undefined,
  );

  const campoDaTag = useMemo(
    () => campos.find((c) => c.tagXml.toLowerCase() === (tag ?? "").toLowerCase()),
    [tag],
  );

  return (
    <div className="space-y-5">
      <PageHeader
        titulo="Laboratório de XML"
        descricao="Formate, pesquise e navegue o XML. Clique numa linha para descobrir o campo fiscal correspondente e sua cadeia de regras."
        acoes={<EtiquetaDidatica texto="XML de exemplo" />}
      />

      <Tabs defaultValue="explorar">
        <TabsList>
          <TabsTrigger value="explorar">Explorar</TabsTrigger>
          <TabsTrigger value="comparar">Comparar correto × incorreto</TabsTrigger>
        </TabsList>

        <TabsContent value="explorar" className="pt-4">
          <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">XML</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  <Input
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                    placeholder="Pesquisar tag ou valor"
                    className="max-w-xs"
                  />
                  <Button variant="outline" size="sm" onClick={() => setXml(formatarXml(xml))}>
                    Formatar
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setXml(XML_EXEMPLO)}>
                    Restaurar exemplo
                  </Button>
                </div>

                <XmlViewer
                  xml={xml}
                  destaque={busca}
                  tagSelecionada={tag}
                  onSelecionarTag={setTag}
                  className="max-h-[420px] overflow-y-auto"
                />

                <details>
                  <summary className="cursor-pointer text-xs text-muted-foreground">
                    Colar outro XML de exemplo
                  </summary>
                  <Textarea
                    value={xml}
                    onChange={(e) => setXml(e.target.value)}
                    rows={6}
                    className="mt-2 font-mono text-xs"
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    Use apenas conteúdo fictício. Nada é transmitido: a leitura acontece no
                    navegador.
                  </p>
                </details>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">
                  {tag ? `Tag ${tag}` : "Selecione uma tag"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {!tag && (
                  <p className="text-muted-foreground">
                    Clique numa linha do XML para seguir o caminho tag → campo → regra → validação →
                    rejeição.
                  </p>
                )}
                {tag && !campoDaTag && (
                  <p className="text-muted-foreground">
                    Esta tag ainda não tem ficha cadastrada na base de conhecimento.
                  </p>
                )}
                {campoDaTag && (
                  <>
                    <div className="space-y-1">
                      <p className="text-[11px] uppercase text-muted-foreground">
                        {campoDaTag.grupoXml}
                      </p>
                      <p className="text-base font-semibold">{campoDaTag.nome}</p>
                      <StatusBadge status={campoDaTag.procedencia.status} />
                    </div>
                    <p>{campoDaTag.conceito}</p>
                    <p className="text-xs text-muted-foreground">{campoDaTag.obrigatoriedade}</p>

                    <div>
                      <p className="text-[11px] font-semibold uppercase text-muted-foreground">
                        Regras
                      </p>
                      <ul className="space-y-1 pt-1">
                        {campoDaTag.regras.map((r) => (
                          <li key={r}>
                            <Link
                              to="/debugger"
                              search={{ regra: r }}
                              className="font-mono text-xs text-primary hover:underline"
                            >
                              {r}
                            </Link>
                            <span className="ml-2 text-xs text-muted-foreground">
                              {regraById.get(r)?.explicacaoSimples}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div>
                      <p className="text-[11px] font-semibold uppercase text-muted-foreground">
                        Rejeições
                      </p>
                      <ul className="space-y-1 pt-1">
                        {campoDaTag.cstats.map((c) => (
                          <li key={c}>
                            <Link
                              to="/cstat"
                              search={{ codigo: c }}
                              className="text-xs text-primary hover:underline"
                            >
                              {cstatByCodigo.get(c)?.situacao ?? c}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <Link
                      to="/conhecimento"
                      search={{ doc: campoDaTag.documento, campo: campoDaTag.id }}
                      className="inline-block text-sm text-primary hover:underline"
                    >
                      Abrir ficha completa do campo
                    </Link>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="comparar" className="space-y-3 pt-4">
          <p className="text-sm text-muted-foreground">
            À direita, o mesmo documento com dois problemas propositais: CFOP incompatível com a UF
            de destino e valor de ICMS divergente da base × alíquota.
          </p>
          <XmlDiff correto={XML_EXEMPLO} incorreto={XML_INCORRETO} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
