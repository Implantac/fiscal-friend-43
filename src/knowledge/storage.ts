/**
 * Camada única de persistência. Hoje grava no navegador (localStorage);
 * para usar um banco compartilhado basta outra implementação de Repositorio,
 * sem alterar as telas.
 */
export interface Repositorio<T extends { id: string }> {
  listar(): T[];
  salvar(item: T): T[];
  remover(id: string): T[];
  substituir(itens: T[]): T[];
}

const temNavegador = () => typeof window !== "undefined" && !!window.localStorage;

export function repositorioLocal<T extends { id: string }>(chave: string): Repositorio<T> {
  const ler = (): T[] => {
    if (!temNavegador()) return [];
    try {
      return JSON.parse(window.localStorage.getItem(chave) ?? "[]") as T[];
    } catch {
      return [];
    }
  };
  const gravar = (itens: T[]) => {
    if (temNavegador()) window.localStorage.setItem(chave, JSON.stringify(itens));
    return itens;
  };
  return {
    listar: ler,
    salvar: (item) => gravar([item, ...ler().filter((i) => i.id !== item.id)]),
    remover: (id) => gravar(ler().filter((i) => i.id !== id)),
    substituir: gravar,
  };
}
