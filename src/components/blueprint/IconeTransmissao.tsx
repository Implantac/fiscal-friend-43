import { Loader2, Send } from "lucide-react";

/**
 * Ícone do botão de ação das telas de emissão.
 *
 * ============================================================================
 * POR QUE ESTE COMPONENTE EXISTE — E O QUE ELE NÃO RESOLVE
 * ============================================================================
 * Este é o **único** bloco semântico genuinamente idêntico nas seis telas de
 * emissão (`nfe`, `nfce`, `nfse`, `cte`, `cte-os`, `mdfe`): o spinner enquanto
 * processa, o ícone de envio quando parado.
 *
 * A medição do que sobrou de duplicação entre as seis rotas é de **56 linhas
 * normalizadas**, e a maior parte é tag de fechamento de JSX
 * (`</CardContent>`, `</div>`, `/>`). Uma estimativa anterior de "~400 linhas de
 * cromo compartilhado" estava errada: media a soma da duplicação aos pares, não
 * o que é extraível. O cromo de verdade — `PageHeader`, `Documented`,
 * `ResultadoAlert`, `ExportarDocumento`, `useEmissao`, `brl` e os primitivos de
 * `ui/` — **já estava extraído em componentes**.
 *
 * Ou seja: isto não é uma rearquitetura das seis telas. É a extração de cinco
 * linhas que se repetiam literalmente, feita porque garante que o tratamento do
 * spinner seja idêntico nas seis — uma propriedade de consistência visual que
 * vale a pena travar com teste.
 *
 * **O que continua fora daqui, de propósito:** o `variant`, o `className`, o
 * `onClick`, o texto do botão ("Transmitir (simulado)", "Emitir (simulado)",
 * "Finalizar venda (F10 simulado)", "Encerrar montagem e transmitir (simulado)")
 * e o wrapper `<Documented docId="m2.transmitir">`. Cada família tem o seu
 * `docId` (`m2.*` NF-e, `m3.*` NFC-e, `m4.*` NFS-e, `m5.*` CT-e, `m6.*` CT-e OS,
 * `m7.*` MDF-e) e o seu texto. Fundir isso apagaria documentação específica de
 * módulo.
 *
 * `aria-hidden` está nos dois ícones porque o texto do botão já carrega o
 * significado; o ícone é decoração para leitor de tela.
 */
export function IconeTransmissao({ processando }: { processando: boolean }) {
  return processando ? (
    <Loader2 className="size-4 animate-spin" aria-hidden />
  ) : (
    <Send className="size-4" aria-hidden />
  );
}
