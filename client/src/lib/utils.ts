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
