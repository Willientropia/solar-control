/**
 * Primitivas de gráfico do dashboard.
 *
 * Concentra paleta, formatadores e chrome (eixo, grade, tooltip, legenda) para
 * que todos os gráficos leiam como um sistema só. As cores vêm das variáveis
 * --viz-* do index.css, que trocam sozinhas entre claro e escuro.
 */
import { cn, formatCurrency, formatNumber } from "@/lib/utils";

/**
 * Ordem fixa das séries. O índice acompanha a entidade (a usina), nunca a
 * posição num ranking — assim filtrar uma série não repinta as outras.
 */
export const VIZ_SERIES = [
  "var(--viz-1)",
  "var(--viz-2)",
  "var(--viz-3)",
  "var(--viz-4)",
  "var(--viz-5)",
] as const;

export const VIZ_NEUTRAL = "var(--viz-neutral)";

/** Reservadas para estado — nunca usadas como "série 6". */
export const VIZ_STATUS = {
  good: "var(--viz-good)",
  warning: "var(--viz-warning)",
  serious: "var(--viz-serious)",
  critical: "var(--viz-critical)",
} as const;

export const MAX_SERIES = VIZ_SERIES.length;

/** Acima de MAX_SERIES o excedente vira "Outras" em cinza; nunca uma cor nova. */
export function seriesColor(index: number): string {
  return index < MAX_SERIES ? VIZ_SERIES[index] : VIZ_NEUTRAL;
}

// ---------- Formatadores ----------

export function formatKwh(value: number, casas = 0): string {
  return `${value.toLocaleString("pt-BR", {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  })} kWh`;
}

/** Eixos precisam de rótulos curtos: 12500 -> "12,5 mil". */
export function compactNumber(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${(value / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mi`;
  if (abs >= 1_000) return `${(value / 1_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil`;
  return value.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
}

export function compactCurrency(value: number): string {
  return `R$ ${compactNumber(value)}`;
}

/** Preço por kWh precisa de 3 casas — a variação mensal fica na 3ª. */
export function formatPrecoKwh(value: number): string {
  return `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 3, maximumFractionDigits: 3 })}`;
}

export function formatPercent(value: number, casas = 1): string {
  return `${value.toLocaleString("pt-BR", {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  })}%`;
}

export type VizFormat = "currency" | "kwh" | "number" | "preco" | "percent";

export function formatByKind(value: number, kind: VizFormat): string {
  switch (kind) {
    case "currency":
      return formatCurrency(value);
    case "kwh":
      return formatKwh(value);
    case "preco":
      return formatPrecoKwh(value);
    case "percent":
      return formatPercent(value);
    default:
      return formatNumber(value);
  }
}

// ---------- Chrome comum dos gráficos ----------

/** Grade e eixos: hairline sólido, um passo fora da superfície, discreto. */
export const gridProps = {
  vertical: false,
  stroke: "hsl(var(--border))",
} as const;

export const axisProps = {
  tickLine: false,
  axisLine: false,
  tick: { fill: "hsl(var(--muted-foreground))", fontSize: 11 },
} as const;

/** Marcas: barra fina com topo arredondado, quadrada na linha de base. */
export const barProps = {
  maxBarSize: 24,
  radius: [4, 4, 0, 0] as [number, number, number, number],
} as const;

/**
 * Separador entre segmentos empilhados: 2px na cor da superfície do card.
 * É o espaçamento em branco, não um contorno decorativo.
 */
export const stackGap = {
  stroke: "hsl(var(--card))",
  strokeWidth: 2,
} as const;

export const lineProps = {
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  dot: false,
};

/** Ponto ativo do hover com anel de 2px na cor da superfície. */
export const activeDot = { r: 4, strokeWidth: 2, stroke: "hsl(var(--card))" };

// ---------- Tooltip ----------

interface VizTooltipProps {
  active?: boolean;
  payload?: any[];
  label?: string;
  /** Formato por dataKey; o que não estiver no mapa cai em `defaultKind`. */
  kinds?: Record<string, VizFormat>;
  defaultKind?: VizFormat;
  labels?: Record<string, string>;
  /** Linha extra no rodapé, calculada a partir da linha inteira do gráfico. */
  footer?: (row: any) => React.ReactNode;
}

export function VizTooltip({
  active,
  payload,
  label,
  kinds,
  defaultKind = "number",
  labels,
  footer,
}: VizTooltipProps) {
  if (!active || !payload?.length) return null;

  const visiveis = payload.filter((item) => item.value !== null && item.value !== undefined);
  if (!visiveis.length) return null;

  return (
    <div className="rounded-lg border bg-background px-3 py-2 text-xs shadow-lg">
      {label && <div className="mb-1.5 font-medium">{label}</div>}
      <div className="grid gap-1">
        {visiveis.map((item) => (
          <div key={item.dataKey ?? item.name} className="flex items-center gap-2">
            <span
              aria-hidden
              className="h-2.5 w-2.5 shrink-0 rounded-[2px]"
              style={{ background: item.color || item.payload?.fill }}
            />
            <span className="text-muted-foreground">
              {labels?.[item.dataKey] ?? item.name ?? item.dataKey}
            </span>
            <span className="ml-auto pl-3 font-medium tabular-nums">
              {formatByKind(Number(item.value), kinds?.[item.dataKey] ?? defaultKind)}
            </span>
          </div>
        ))}
      </div>
      {footer && (
        <div className="mt-1.5 border-t pt-1.5 text-muted-foreground">
          {footer(visiveis[0]?.payload)}
        </div>
      )}
    </div>
  );
}

// ---------- Legenda ----------

/**
 * Com duas ou mais séries a legenda é sempre presente: a identidade nunca pode
 * depender só da cor. O texto usa tinta de texto; quem carrega a cor é o ponto.
 */
export function VizLegend({
  items,
  className,
}: {
  items: { label: string; color: string; dashed?: boolean }[];
  className?: string;
}) {
  return (
    <ul className={cn("flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs", className)}>
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-1.5">
          <span
            aria-hidden
            className={cn("h-2.5 w-2.5 shrink-0 rounded-[2px]", item.dashed && "h-0.5 w-3 rounded-none")}
            style={{ background: item.color }}
          />
          <span className="text-muted-foreground">{item.label}</span>
        </li>
      ))}
    </ul>
  );
}

/** Estado vazio padrão dentro de um card de gráfico. */
export function VizEmpty({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-[220px] items-center justify-center rounded-md border border-dashed">
      <p className="max-w-xs text-center text-sm text-muted-foreground">{children}</p>
    </div>
  );
}
