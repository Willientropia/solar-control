import { useEffect, useState } from "react";

/**
 * Lê um parâmetro de abertura da URL (ex: `/clientes?novo=1`) para que links de
 * fora da página — como os atalhos do dashboard — consigam abrir o diálogo de
 * cadastro, que só existe como estado interno da página de listagem.
 *
 * O parâmetro é removido da URL logo depois, para um F5 não reabrir o
 * formulário sem o usuário pedir.
 */
export function useOpenOnQuery(param: string): boolean {
  const [aberto] = useState(
    () =>
      typeof window !== "undefined" &&
      new URLSearchParams(window.location.search).get(param) === "1",
  );

  useEffect(() => {
    if (!aberto) return;
    const url = new URL(window.location.href);
    url.searchParams.delete(param);
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
  }, [aberto, param]);

  return aberto;
}
