/**
 * Utilitários para as referências de mês ("Jan/2026").
 *
 * O formato é texto livre no banco, e os dados legados aparecem em várias
 * grafias ("DEZ/2025", "dez/25", "Dez/2025"). Tudo que compara, ordena ou
 * agrupa mês passa por aqui para não depender da grafia gravada.
 */

export const MESES_ABREV = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez",
] as const;

const MONTH_INDEX: Record<string, number> = {
  JAN: 0, FEV: 1, MAR: 2, ABR: 3, MAI: 4, JUN: 5,
  JUL: 6, AGO: 7, SET: 8, OUT: 9, NOV: 10, DEZ: 11,
};

/** "DEZ/25" -> "Dez/2025". Devolve o valor original se não for reconhecível. */
export function normalizeMonthRef(ref: string | null | undefined): string {
  if (!ref) return "";
  const parts = ref.trim().split("/");
  if (parts.length !== 2) return ref.trim();

  const [mes, ano] = parts;
  if (!mes) return ref.trim();

  const titleCase = mes.charAt(0).toUpperCase() + mes.slice(1).toLowerCase();
  const fullYear = ano.length === 2 ? `20${ano}` : ano;
  return `${titleCase}/${fullYear}`;
}

/**
 * Chave numérica (ano * 12 + índice do mês) para ordenar cronologicamente.
 * Retorna -1 para referências não reconhecíveis, que ficam no fim da ordenação.
 */
export function monthSortKey(ref: string | null | undefined): number {
  if (!ref) return -1;
  const parts = ref.trim().split("/");
  if (parts.length !== 2) return -1;

  const idx = MONTH_INDEX[parts[0].toUpperCase()];
  if (idx === undefined) return -1;

  const ano = parts[1].length === 2 ? Number(`20${parts[1]}`) : Number(parts[1]);
  if (!Number.isFinite(ano)) return -1;

  return ano * 12 + idx;
}

/** Compara duas referências ignorando grafia ("DEZ/2025" === "Dez/2025"). */
export function sameMonthRef(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  return normalizeMonthRef(a).toUpperCase() === normalizeMonthRef(b).toUpperCase();
}

export function currentMonthRef(date = new Date()): string {
  return `${MESES_ABREV[date.getMonth()]}/${date.getFullYear()}`;
}

/** Soma (ou subtrai, com delta negativo) meses a uma referência. */
export function addMonths(ref: string, delta: number): string {
  const key = monthSortKey(ref);
  if (key < 0) return ref;
  const total = key + delta;
  return `${MESES_ABREV[((total % 12) + 12) % 12]}/${Math.floor(total / 12)}`;
}

/** Últimos N meses terminando em `ate` (inclusive), do mais antigo ao mais recente. */
export function lastNMonths(n: number, ate = currentMonthRef()): string[] {
  const base = monthSortKey(ate) >= 0 ? ate : currentMonthRef();
  return Array.from({ length: n }, (_, i) => addMonths(base, i - (n - 1)));
}

/** "Jan/2026" -> "Jan/26", para eixos de gráfico onde o espaço é curto. */
export function shortMonthLabel(ref: string): string {
  const norm = normalizeMonthRef(ref);
  const parts = norm.split("/");
  if (parts.length !== 2) return norm;
  return `${parts[0]}/${parts[1].slice(-2)}`;
}

/** Ordena referências de mês da mais antiga para a mais recente. */
export function sortMonthRefs(refs: string[]): string[] {
  return [...refs].sort((a, b) => monthSortKey(a) - monthSortKey(b));
}
