import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Search } from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { buscar, type ItemBusca, type TipoResultado } from "@/knowledge/search";

const ORDEM: TipoResultado[] = [
  "Documento",
  "Campo",
  "Tag XML",
  "Regra",
  "Rejeição",
  "Cálculo",
  "Cenário",
  "Aula",
  "Desafio",
];

/** Busca global fiscal: documentos, campos, tags, regras, rejeições, cálculos, cenários e aulas. */
export function GlobalSearch() {
  const [aberto, setAberto] = useState(false);
  const [consulta, setConsulta] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setAberto((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const resultados = buscar(consulta);
  const grupos = ORDEM.map((tipo) => ({
    tipo,
    itens: resultados.filter((r) => r.tipo === tipo),
  })).filter((g) => g.itens.length > 0);

  const ir = (item: ItemBusca) => {
    setAberto(false);
    setConsulta("");
    navigate({ to: item.rota });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="flex items-center gap-2 rounded-md border bg-background px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent"
      >
        <Search className="size-3.5" aria-hidden />
        Buscar campo, regra, tag, rejeição…
        <kbd className="ml-2 rounded border px-1 text-[10px]">Ctrl K</kbd>
      </button>

      <CommandDialog open={aberto} onOpenChange={setAberto} shouldFilter={false}>
        <CommandInput
          placeholder="Ex.: CFOP, vICMS, DIFAL, tomador, REGRA-ICMS-VALOR"
          value={consulta}
          onValueChange={setConsulta}
        />
        <CommandList>
          <CommandEmpty>
            {consulta ? "Nada encontrado na base de conhecimento." : "Digite para pesquisar."}
          </CommandEmpty>
          {grupos.map((g) => (
            <CommandGroup key={g.tipo} heading={g.tipo}>
              {g.itens.map((item) => (
                <CommandItem key={item.id} value={item.id} onSelect={() => ir(item)}>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{item.titulo}</p>
                    <p className="truncate text-xs text-muted-foreground">{item.descricao}</p>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          ))}
        </CommandList>
      </CommandDialog>
    </>
  );
}
