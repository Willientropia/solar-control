/**
 * Utilitários de referência de mês — fonte canônica no backend.
 *
 * Formato padrão do sistema: "JAN/2026"
 * (PT-BR, 3 letras MAIÚSCULAS, barra, ano 4 dígitos)
 */

export const MONTHS = [
  "JAN", "FEV", "MAR", "ABR", "MAI", "JUN",
  "JUL", "AGO", "SET", "OUT", "NOV", "DEZ",
] as const;

/** Retorna a referência do mês atual no formato canônico. Ex: "MAR/2026" */
export function getCurrentMonthRef(): string {
  const now = new Date();
  return `${MONTHS[now.getMonth()]}/${now.getFullYear()}`;
}

/**
 * Normaliza qualquer variante de mesReferencia para o formato canônico.
 * Exemplos: "jan/2026" → "JAN/2026", "fev/26" → "FEV/2026"
 */
export function normalizeMonthRef(ref: string): string {
  if (!ref) return "";
  const parts = ref.trim().split("/");
  if (parts.length !== 2) return ref;
  let [month, year] = parts;
  month = month.toUpperCase();
  if (year.length === 2) year = "20" + year;
  return `${month}/${year}`;
}
