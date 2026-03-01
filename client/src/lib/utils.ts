import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(value: number | string | undefined | null): string {
  if (value === undefined || value === null || value === "") return "R$ 0,00";
  
  const numValue = typeof value === "string" ? parseToNumber(value) : value;

  if (isNaN(numValue)) return "R$ 0,00";

  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(numValue);
}

export function formatNumber(value: number | string | undefined | null): string {
  if (value === undefined || value === null || value === "") return "0,00";
  
  const numValue = typeof value === "string" ? parseToNumber(value) : value;

  if (isNaN(numValue)) return "0,00";

  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(numValue);
}

export function parseToNumber(value: string | number): number {
  if (typeof value === "number") return value;
  if (!value) return 0;
  
  // Remove tudo que não for número, ponto ou vírgula
  const cleanValue = value.replace(/[^\d.,-]/g, "");
  
  // Se tiver vírgula como separador decimal (formato BR)
  if (cleanValue.includes(",") && !cleanValue.includes(".")) {
     return parseFloat(cleanValue.replace(",", "."));
  }
  
  // Se tiver ponto e vírgula
  if (cleanValue.includes(".") && cleanValue.includes(",")) {
    // Se o último for vírgula (1.000,00)
    if (cleanValue.lastIndexOf(",") > cleanValue.lastIndexOf(".")) {
      return parseFloat(cleanValue.replace(/\./g, "").replace(",", "."));
    }
    // Se o último for ponto (1,000.00)
    else {
      return parseFloat(cleanValue.replace(/,/g, ""));
    }
  }
  
  // Se tiver apenas ponto, assume que é decimal se não tiver cara de milhar
  // Mas no BR, ponto é milhar.
  // Vamos assumir padrão BR para input do usuário se ambíguo, mas a função deve ser robusta.
  // Para inputs controlados, usamos formato BR.
  
  return parseFloat(cleanValue.replace(",", ".")); // Fallback simples
}

export function getCurrentMonthRef(): string {
  const now = new Date();
  const months = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];
  return `${months[now.getMonth()]}/${now.getFullYear()}`;
}

/**
 * Normaliza o formato do mês para MAIÚSCULO (JAN/2026, DEZ/2025)
 * Garante consistência em todo o sistema
 */
export function normalizeMonth(month: string): string {
  if (!month) return "";
  return month.toUpperCase();
}

// ── Constantes de Mês ────────────────────────────────────────────────────────
// Fonte canônica de nomes de meses PT-BR em maiúsculas.
// Formato de mesReferencia no sistema: "JAN/2026"

export const MONTHS_PT = [
  "JAN", "FEV", "MAR", "ABR", "MAI", "JUN",
  "JUL", "AGO", "SET", "OUT", "NOV", "DEZ",
] as const;

export type MonthPT = typeof MONTHS_PT[number];

/** Mapa de mês abreviado → número ordinal (1-12). Útil para ordenação. */
export const MONTH_ORDER: Record<string, number> = {
  JAN: 1, FEV: 2, MAR: 3, ABR: 4, MAI: 5, JUN: 6,
  JUL: 7, AGO: 8, SET: 9, OUT: 10, NOV: 11, DEZ: 12,
};

/**
 * Retorna lista de referências de mês recentes (ex: ["ABR/2026", "MAR/2026", ...]).
 * Começa do mês seguinte ao atual e vai N meses para trás.
 */
export function getRecentMonths(count = 12): string[] {
  const result: string[] = [];
  let currentMonth = new Date().getMonth() + 1; // começa no próximo mês
  let currentYear = new Date().getFullYear();

  if (currentMonth > 11) {
    currentMonth = 0;
    currentYear++;
  }

  for (let i = 0; i < count; i++) {
    result.push(`${MONTHS_PT[currentMonth]}/${currentYear}`);
    currentMonth--;
    if (currentMonth < 0) {
      currentMonth = 11;
      currentYear--;
    }
  }
  return result;
}

/**
 * Compara dois mesReferencia no formato "JAN/2026".
 * Retorna negativo se a < b, positivo se a > b, zero se iguais.
 */
export function compareMonths(a: string, b: string): number {
  if (!a || !b) return 0;
  const [mesA, anoA] = a.split("/");
  const [mesB, anoB] = b.split("/");
  const yearDiff = parseInt(anoA) - parseInt(anoB);
  if (yearDiff !== 0) return yearDiff;
  return (MONTH_ORDER[mesA.toUpperCase()] ?? 0) - (MONTH_ORDER[mesB.toUpperCase()] ?? 0);
}

/**
 * Converte "JAN/2026" em número ordenável (ex: 202601).
 * Permite ordenação simples com sort().
 */
export function parseMonthRef(ref: string): number {
  if (!ref) return 0;
  const [mes, ano] = ref.split("/");
  return parseInt(ano) * 100 + (MONTH_ORDER[mes?.toUpperCase()] ?? 0);
}

/**
 * Formata um timestamp (Date | string | null) para exibição BR.
 * Ex: "01/03/2026 14:30"
 */
export function formatDateBR(date: Date | string | null | undefined): string {
  if (!date) return "-";
  const d = new Date(date);
  if (isNaN(d.getTime())) return "-";
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
