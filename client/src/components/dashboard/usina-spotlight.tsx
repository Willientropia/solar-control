import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import {
  AlertTriangle,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Clock,
  Pause,
  Play,
  TrendingDown,
  TrendingUp,
  Zap,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn, formatCurrency } from "@/lib/utils";
import { shortMonthLabel } from "@shared/month-utils";
import type { DashboardUsina } from "@shared/dashboard-types";
import {
  VIZ_STATUS,
  VizTooltip,
  axisProps,
  formatKwh,
  formatPercent,
  seriesColor,
} from "./viz";

/** Tempo em cada usina antes de trocar sozinho. */
const INTERVALO_MS = 8000;

/**
 * Meta batida = verde; perto = amarelo; longe = vermelho. A cor vem sempre
 * acompanhada do número e do rótulo, nunca sozinha.
 */
function severidade(performance: number) {
  if (performance >= 95) return { cor: VIZ_STATUS.good, rotulo: "no alvo" };
  if (performance >= 80) return { cor: VIZ_STATUS.warning, rotulo: "abaixo da meta" };
  return { cor: VIZ_STATUS.critical, rotulo: "muito abaixo da meta" };
}

function Variacao({ valor }: { valor: number | null }) {
  if (valor === null) return <span className="text-xs text-muted-foreground">sem base anterior</span>;

  const positivo = valor >= 0;
  const Icon = positivo ? TrendingUp : TrendingDown;

  return (
    <span
      className={cn(
        "flex items-center gap-1 text-xs",
        positivo ? "text-green-600 dark:text-green-400" : "text-destructive",
      )}
    >
      <Icon className="h-3 w-3" aria-hidden />
      {positivo ? "+" : ""}
      {formatPercent(valor)} vs mês anterior
    </span>
  );
}

function MiniStat({
  label,
  value,
  children,
}: {
  label: string;
  value: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="rounded-md border bg-background/50 p-3">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
      {children}
    </div>
  );
}

interface UsinaSpotlightProps {
  usinas: DashboardUsina[];
  mesReferencia: string;
  /** Índice de cada usina na ordem global, para a cor não mudar entre gráficos. */
  corPorUsina: Record<string, number>;
}

export function UsinaSpotlight({ usinas, mesReferencia, corPorUsina }: UsinaSpotlightProps) {
  const [indice, setIndice] = useState(0);
  const [rodando, setRodando] = useState(true);
  const [pausadoPorInteracao, setPausadoPorInteracao] = useState(false);
  const regiaoRef = useRef<HTMLDivElement>(null);

  const total = usinas.length;

  const ir = useCallback(
    (delta: number) => setIndice((i) => (total ? (i + delta + total) % total : 0)),
    [total],
  );

  // Se uma usina for removida enquanto o carrossel está numa posição alta.
  useEffect(() => {
    if (indice >= total && total > 0) setIndice(0);
  }, [indice, total]);

  useEffect(() => {
    if (!rodando || pausadoPorInteracao || total <= 1) return;
    const timer = window.setInterval(() => ir(1), INTERVALO_MS);
    return () => window.clearInterval(timer);
  }, [rodando, pausadoPorInteracao, total, ir]);

  if (!total) return null;

  const usina = usinas[Math.min(indice, total - 1)];
  const cor = seriesColor(corPorUsina[usina.id] ?? 0);
  const meta = severidade(usina.performance);
  const progressoFaturas = usina.faturasEsperadas
    ? (usina.faturasRecebidas / usina.faturasEsperadas) * 100
    : 0;

  return (
    <Card
      ref={regiaoRef}
      role="region"
      aria-roledescription="carrossel"
      aria-label="Destaque por usina"
      className="overflow-hidden"
      onMouseEnter={() => setPausadoPorInteracao(true)}
      onMouseLeave={() => setPausadoPorInteracao(false)}
      onFocusCapture={() => setPausadoPorInteracao(true)}
      onBlurCapture={(e) => {
        if (!regiaoRef.current?.contains(e.relatedTarget as Node)) setPausadoPorInteracao(false);
      }}
    >
      {/* Faixa de cor da usina — reforça a identidade que os gráficos usam */}
      <div className="h-1 w-full" style={{ background: cor }} aria-hidden />

      <CardContent className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-md"
              style={{ background: cor, color: "#fff" }}
              aria-hidden
            >
              <Zap className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-semibold leading-tight">{usina.nome}</h3>
              <p className="text-sm text-muted-foreground">
                UC {usina.unidadeConsumidora}
                {usina.potenciaKwp > 0 && ` · ${usina.potenciaKwp.toLocaleString("pt-BR")} kWp`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" asChild>
              <Link href={`/usinas/${usina.id}`}>
                Ver usina
                <ArrowRight className="ml-1.5 h-4 w-4" />
              </Link>
            </Button>
            {total > 1 && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setRodando((r) => !r)}
                  aria-label={rodando ? "Pausar troca automática" : "Retomar troca automática"}
                >
                  {rodando ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                </Button>
                <Button variant="ghost" size="icon" onClick={() => ir(-1)} aria-label="Usina anterior">
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => ir(1)} aria-label="Próxima usina">
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
        </div>

        <div
          key={usina.id}
          className="mt-5 space-y-5 duration-300 animate-in fade-in-0 slide-in-from-right-2 motion-reduce:animate-none"
        >
          {/* Geração vs meta */}
          <div>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Geração em {mesReferencia}
              </p>
              <p className="text-sm text-muted-foreground">
                meta {formatKwh(usina.geracaoPrevista)}
              </p>
            </div>
            <div className="mt-1 flex flex-wrap items-baseline gap-3">
              <span className="text-3xl font-semibold">{formatKwh(usina.geracao)}</span>
              <span className="text-sm font-medium" style={{ color: meta.cor }}>
                {formatPercent(usina.performance)} da meta
              </span>
              <span className="text-sm text-muted-foreground">({meta.rotulo})</span>
            </div>
            {/* Trilho = tom claro da própria cor da usina; preenchimento = severidade */}
            <div
              className="mt-2 h-2 w-full overflow-hidden rounded-full"
              style={{ background: `color-mix(in srgb, ${cor} 18%, transparent)` }}
              aria-hidden
            >
              <div
                className="h-full rounded-full transition-[width] duration-500 motion-reduce:transition-none"
                style={{
                  width: `${Math.min(usina.performance, 100)}%`,
                  background: meta.cor,
                }}
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MiniStat label="Lucro do mês" value={formatCurrency(usina.lucro)}>
              <Variacao valor={usina.variacaoLucro} />
            </MiniStat>
            <MiniStat label="Receita do mês" value={formatCurrency(usina.receita)}>
              <span className="text-xs text-muted-foreground">
                custo {formatCurrency(usina.custo)}
              </span>
            </MiniStat>
            <MiniStat label="Clientes" value={`${usina.clientesAtivos}`}>
              <span className="text-xs text-muted-foreground">
                de {usina.clientes} cadastrados
              </span>
            </MiniStat>
            <MiniStat label="Saldo de créditos" value={formatKwh(usina.saldoKwh)}>
              <span className="text-xs text-muted-foreground">
                {formatKwh(usina.kwhDistribuido)} compensados
              </span>
            </MiniStat>
          </div>

          {/* Faturas do mês */}
          <div>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Faturas de {mesReferencia}
              </p>
              <p className="text-sm">
                <span className="font-semibold">{usina.faturasRecebidas}</span>
                <span className="text-muted-foreground"> de {usina.faturasEsperadas} recebidas</span>
              </p>
            </div>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted" aria-hidden>
              <div
                className="h-full rounded-full bg-foreground/70 transition-[width] duration-500 motion-reduce:transition-none"
                style={{ width: `${Math.min(progressoFaturas, 100)}%` }}
              />
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {usina.faturasFaltando > 0 && (
                <Badge variant="outline" className="gap-1">
                  <AlertTriangle className="h-3 w-3" style={{ color: VIZ_STATUS.warning }} aria-hidden />
                  {usina.faturasFaltando} faltando
                </Badge>
              )}
              {usina.faturasPendentesPagamento > 0 && (
                <Badge variant="outline" className="gap-1">
                  <Clock className="h-3 w-3" style={{ color: VIZ_STATUS.serious }} aria-hidden />
                  {usina.faturasPendentesPagamento} a pagar
                </Badge>
              )}
              {usina.faturasEmAtraso > 0 && (
                <Badge variant="outline" className="gap-1">
                  <AlertTriangle className="h-3 w-3" style={{ color: VIZ_STATUS.critical }} aria-hidden />
                  {usina.faturasEmAtraso} vencida{usina.faturasEmAtraso > 1 ? "s" : ""}
                </Badge>
              )}
              {usina.faturasFaltando === 0 &&
                usina.faturasPendentesPagamento === 0 &&
                usina.faturasEmAtraso === 0 && (
                  <Badge variant="outline" className="gap-1">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ background: VIZ_STATUS.good }}
                      aria-hidden
                    />
                    Mês fechado
                  </Badge>
                )}
            </div>
          </div>

          {/* Geração dos últimos 6 meses */}
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Geração — últimos 6 meses
            </p>
            <div className="mt-1 h-[92px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={usina.serieGeracao} margin={{ top: 6, right: 4, bottom: 0, left: 4 }}>
                  <defs>
                    <linearGradient id={`spark-${usina.id}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={cor} stopOpacity={0.18} />
                      <stop offset="100%" stopColor={cor} stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="mes"
                    {...axisProps}
                    tickFormatter={shortMonthLabel}
                    interval="preserveStartEnd"
                  />
                  <Tooltip
                    cursor={{ stroke: "hsl(var(--border))" }}
                    content={
                      <VizTooltip
                        defaultKind="kwh"
                        labels={{ kwh: "Gerado", previsto: "Meta" }}
                      />
                    }
                  />
                  <Area
                    type="monotone"
                    dataKey="kwh"
                    stroke={cor}
                    strokeWidth={2}
                    fill={`url(#spark-${usina.id})`}
                    dot={false}
                    activeDot={{ r: 4, strokeWidth: 2, stroke: "hsl(var(--card))" }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {total > 1 && (
          <div className="mt-4 flex items-center justify-center gap-2">
            {usinas.map((u, i) => (
              <button
                key={u.id}
                onClick={() => setIndice(i)}
                aria-label={`Mostrar ${u.nome}`}
                aria-current={i === indice}
                className={cn(
                  "h-1.5 rounded-full transition-all",
                  i === indice ? "w-6" : "w-1.5 bg-muted-foreground/30 hover:bg-muted-foreground/60",
                )}
                style={i === indice ? { background: seriesColor(corPorUsina[u.id] ?? i) } : undefined}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
