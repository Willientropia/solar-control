import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Label,
  LabelList,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { TrendingDown, TrendingUp } from "lucide-react";
import { shortMonthLabel } from "@shared/month-utils";
import type { DashboardOverview, DashboardUsina } from "@shared/dashboard-types";
import { cn, formatCurrency } from "@/lib/utils";
import { ChartCard } from "./chart-card";
import {
  VIZ_NEUTRAL,
  VIZ_SERIES,
  VizEmpty,
  VizTooltip,
  activeDot,
  axisProps,
  barProps,
  compactCurrency,
  compactNumber,
  formatKwh,
  formatPercent,
  formatPrecoKwh,
  gridProps,
  lineProps,
  seriesColor,
  stackGap,
} from "./viz";

const ALTURA = "h-[260px]";

/** Só entra no gráfico o mês que tem algum dado — zero à esquerda é ruído. */
function recortarSerie<T extends Record<string, any>>(
  serie: T[],
  temDado: (item: T) => boolean,
): T[] {
  const primeiro = serie.findIndex(temDado);
  return primeiro === -1 ? [] : serie.slice(primeiro);
}

// ============ Preço do kWh ============

/**
 * A pergunta que este gráfico responde é "por quanto estou vendendo o kWh
 * hoje, para cada faixa de contrato" — não só qual é a tarifa da tabela.
 * Todas as séries estão em R$/kWh, então dividem um eixo só.
 */
export function PrecoKwhChart({
  dados,
  descontos,
}: {
  dados: DashboardOverview["precoKwh"];
  descontos: DashboardOverview["descontos"];
}) {
  // Recharts precisa das chaves no topo da linha: liquido["25"] vira d25.
  const serie = useMemo(
    () =>
      recortarSerie(dados, (d) => d.tabela !== null).map((d) => ({
        ...d,
        ...Object.fromEntries(
          Object.entries(d.liquido).map(([percentual, valor]) => [`d${percentual}`, valor]),
        ),
      })),
    [dados],
  );

  const comTabela = serie.filter((d) => d.tabela !== null);
  const ultimo = comTabela[comTabela.length - 1];
  const penultimo = comTabela[comTabela.length - 2];

  const variacao =
    ultimo?.tabela && penultimo?.tabela
      ? ((ultimo.tabela - penultimo.tabela) / penultimo.tabela) * 100
      : null;

  // Tarifa subindo aperta a margem — o ícone e o texto dizem a direção, a cor
  // só reforça.
  const subiu = (variacao ?? 0) >= 0;
  const Icon = subiu ? TrendingUp : TrendingDown;

  const rotuloFaixa = (percentual: number) =>
    percentual === 0 ? "Sem desconto" : `−${formatPercent(percentual, 0)}`;

  const tabela = {
    headers: [
      "Mês",
      "Tabela",
      "Fio B",
      ...descontos.map((d) => rotuloFaixa(d.percentual)),
    ],
    rows: serie.map((d) => [
      d.mes,
      d.tabela !== null ? formatPrecoKwh(d.tabela) : "—",
      d.fioB !== null ? `${formatPrecoKwh(d.fioB)}${d.fioBHerdado ? " *" : ""}` : "—",
      ...descontos.map((f) => {
        const valor = d.liquido[String(f.percentual)];
        return valor === undefined ? "—" : formatPrecoKwh(valor);
      }),
    ]),
  };

  return (
    <ChartCard
      title="Preço do kWh comercializado"
      description="Tarifa da tabela e o preço líquido por faixa de contrato: tabela × (1 − desconto) − fio B"
      legend={[
        { label: "Tabela (bruto)", color: VIZ_SERIES[0] },
        ...descontos.map((d, i) => ({
          label: `${rotuloFaixa(d.percentual)} · ${d.clientes} UC${d.clientes > 1 ? "s" : ""}`,
          color: seriesColor(i + 1),
        })),
      ]}
      headline={
        ultimo?.tabela != null && (
          <div className="text-right">
            <p className="text-xl font-semibold leading-none">{formatPrecoKwh(ultimo.tabela)}</p>
            {variacao !== null && (
              <p
                className={cn(
                  "mt-1 flex items-center justify-end gap-1 text-xs",
                  subiu ? "text-destructive" : "text-green-600 dark:text-green-400",
                )}
              >
                <Icon className="h-3 w-3" aria-hidden />
                {subiu ? "+" : ""}
                {formatPercent(variacao)} no mês
              </p>
            )}
          </div>
        )
      }
      tabela={tabela}
    >
      {serie.length < 2 ? (
        <VizEmpty>
          Cadastre pelo menos dois meses em <strong>Preços kWh</strong> para ver a curva da tarifa.
        </VizEmpty>
      ) : (
        <>
          <div className={cn(ALTURA, "w-full")}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={serie} margin={{ top: 12, right: 68, bottom: 0, left: 0 }}>
                <CartesianGrid {...gridProps} />
                <XAxis dataKey="mes" {...axisProps} tickFormatter={shortMonthLabel} />
                {/* Largura folgada: o Recharts quebra o texto do tick quando ele
                    não cabe na faixa reservada ao eixo. */}
                <YAxis
                  {...axisProps}
                  width={72}
                  domain={["auto", "auto"]}
                  tickFormatter={(v: number) =>
                    `R$ ${v.toLocaleString("pt-BR", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}`
                  }
                />
                <Tooltip
                  cursor={{ stroke: "hsl(var(--border))" }}
                  content={
                    <VizTooltip
                      defaultKind="preco"
                      labels={{
                        tabela: "Tabela (bruto)",
                        ...Object.fromEntries(
                          descontos.map((d) => [`d${d.percentual}`, rotuloFaixa(d.percentual)]),
                        ),
                      }}
                      footer={(row) =>
                        row?.fioB != null
                          ? `Fio B descontado: ${formatPrecoKwh(row.fioB)}${
                              row.fioBHerdado ? " (herdado do mês anterior)" : ""
                            }`
                          : null
                      }
                    />
                  }
                />

                <Line
                  {...lineProps}
                  type="monotone"
                  dataKey="tabela"
                  name="Tabela (bruto)"
                  stroke={VIZ_SERIES[0]}
                  connectNulls
                  activeDot={activeDot}
                >
                  <LabelList dataKey="tabela" content={rotuloDePonta(serie.length)} />
                </Line>

                {descontos.map((d, i) => (
                  <Line
                    key={d.percentual}
                    {...lineProps}
                    type="monotone"
                    dataKey={`d${d.percentual}`}
                    name={rotuloFaixa(d.percentual)}
                    stroke={seriesColor(i + 1)}
                    connectNulls
                    activeDot={activeDot}
                  >
                    <LabelList
                      dataKey={`d${d.percentual}`}
                      content={rotuloDePonta(serie.length)}
                    />
                  </Line>
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>

          {ultimo?.fioB != null && (
            <p className="mt-2 text-xs text-muted-foreground">
              Fio B de {ultimo.mes}: {formatPrecoKwh(ultimo.fioB)}
              {ultimo.fioBHerdado
                ? " — herdado do mês anterior, ainda sem fatura neste mês"
                : " — mediana das faturas do mês"}
            </p>
          )}
        </>
      )}
    </ChartCard>
  );
}

/**
 * Rótulo direto só na última ponta de cada linha: é ali que está a resposta
 * ("estou vendendo por tanto hoje"). O resto dos pontos fica com o eixo e o
 * tooltip — um número em cada ponto vira ruído.
 */
function rotuloDePonta(totalPontos: number) {
  return ({ x, y, value, index }: any) => {
    if (index !== totalPontos - 1 || value === null || value === undefined) return null;
    return (
      <text x={Number(x) + 8} y={Number(y)} dy={4} className="fill-foreground text-[11px]">
        {formatPrecoKwh(Number(value))}
      </text>
    );
  };
}

// ============ Geração por usina ============

export function GeracaoPorUsinaChart({
  dados,
  usinas,
  corPorUsina,
}: {
  dados: DashboardOverview["geracaoPorUsina"];
  usinas: DashboardUsina[];
  corPorUsina: Record<string, number>;
}) {
  const serie = useMemo(
    () => recortarSerie(dados, (linha) => usinas.some((u) => Number(linha[u.id]) > 0)),
    [dados, usinas],
  );

  const tabela = {
    headers: ["Mês", ...usinas.map((u) => u.nome), "Total", "Meta"],
    rows: serie.map((linha) => {
      const total = usinas.reduce((acc, u) => acc + Number(linha[u.id] || 0), 0);
      return [
        String(linha.mes),
        ...usinas.map((u) => formatKwh(Number(linha[u.id] || 0))),
        formatKwh(total),
        formatKwh(Number(linha.previsto || 0)),
      ];
    }),
  };

  return (
    <ChartCard
      title="Geração mensal por usina"
      description="kWh gerado empilhado por usina, contra a meta somada do parque"
      legend={[
        ...usinas.map((u) => ({ label: u.nome, color: seriesColor(corPorUsina[u.id] ?? 0) })),
        { label: "Meta total", color: VIZ_NEUTRAL, dashed: true },
      ]}
      tabela={tabela}
    >
      {serie.length === 0 ? (
        <VizEmpty>
          Nenhuma geração lançada ainda. Registre em <strong>Geração Mensal</strong>.
        </VizEmpty>
      ) : (
        <div className={cn(ALTURA, "w-full")}>
          <ResponsiveContainer width="100%" height="100%">
            {/* ComposedChart porque a meta é uma linha sobre as barras
                empilhadas — mesma unidade (kWh), um eixo só. */}
            <ComposedChart data={serie} margin={{ top: 12, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid {...gridProps} />
              <XAxis dataKey="mes" {...axisProps} tickFormatter={shortMonthLabel} />
              <YAxis {...axisProps} width={54} tickFormatter={compactNumber} />
              <Tooltip
                cursor={{ fill: "hsl(var(--muted))" }}
                content={
                  <VizTooltip
                    defaultKind="kwh"
                    labels={{
                      ...Object.fromEntries(usinas.map((u) => [u.id, u.nome])),
                      previsto: "Meta total",
                    }}
                  />
                }
              />
              {usinas.map((u, i) => (
                <Bar
                  key={u.id}
                  dataKey={u.id}
                  name={u.nome}
                  stackId="geracao"
                  fill={seriesColor(corPorUsina[u.id] ?? i)}
                  {...stackGap}
                  maxBarSize={barProps.maxBarSize}
                  // Só o segmento do topo recebe o arredondamento da ponta
                  radius={i === usinas.length - 1 ? barProps.radius : undefined}
                />
              ))}
              <Line
                {...lineProps}
                type="monotone"
                dataKey="previsto"
                name="Meta total"
                stroke={VIZ_NEUTRAL}
                strokeDasharray="4 4"
                activeDot={{ r: 4, strokeWidth: 2, stroke: "hsl(var(--card))" }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </ChartCard>
  );
}

// ============ Resultado financeiro ============

export function FinanceiroChart({ dados }: { dados: DashboardOverview["historico"] }) {
  const serie = useMemo(
    () => recortarSerie(dados, (d) => d.receita !== 0 || d.custo !== 0 || d.lucro !== 0),
    [dados],
  );

  const tabela = {
    headers: ["Mês", "Receita", "Custo concessionária", "Lucro", "Economia dos clientes"],
    rows: serie.map((d) => [
      d.mes,
      formatCurrency(d.receita),
      formatCurrency(d.custo),
      formatCurrency(d.lucro),
      formatCurrency(d.economia),
    ]),
  };

  return (
    <ChartCard
      title="Resultado financeiro"
      description="A receita de cada mês repartida entre o custo da concessionária e o lucro"
      legend={[
        { label: "Custo concessionária", color: VIZ_SERIES[2] },
        { label: "Lucro", color: VIZ_SERIES[3] },
      ]}
      tabela={tabela}
    >
      {serie.length === 0 ? (
        <VizEmpty>Nenhuma fatura com valores lançada ainda.</VizEmpty>
      ) : (
        <div className={cn(ALTURA, "w-full")}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={serie} margin={{ top: 12, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid {...gridProps} />
              <XAxis dataKey="mes" {...axisProps} tickFormatter={shortMonthLabel} />
              <YAxis {...axisProps} width={62} tickFormatter={compactCurrency} />
              <Tooltip
                cursor={{ fill: "hsl(var(--muted))" }}
                content={
                  <VizTooltip
                    defaultKind="currency"
                    labels={{ custo: "Custo concessionária", lucro: "Lucro" }}
                    footer={(row) =>
                      row ? `Receita total: ${formatCurrency(row.receita)}` : null
                    }
                  />
                }
              />
              <Bar
                dataKey="custo"
                name="Custo concessionária"
                stackId="financeiro"
                fill={VIZ_SERIES[2]}
                {...stackGap}
                maxBarSize={barProps.maxBarSize}
              />
              <Bar
                dataKey="lucro"
                name="Lucro"
                stackId="financeiro"
                fill={VIZ_SERIES[3]}
                {...stackGap}
                maxBarSize={barProps.maxBarSize}
                radius={barProps.radius}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </ChartCard>
  );
}

// ============ Participação por usina ============

export function ReceitaPorUsinaChart({
  usinas,
  corPorUsina,
  mesReferencia,
}: {
  usinas: DashboardUsina[];
  corPorUsina: Record<string, number>;
  mesReferencia: string;
}) {
  const dados = usinas.filter((u) => u.receita > 0);
  const total = dados.reduce((acc, u) => acc + u.receita, 0);

  const tabela = {
    headers: ["Usina", "Receita", "Participação", "Lucro"],
    rows: dados.map((u) => [
      u.nome,
      formatCurrency(u.receita),
      formatPercent(total ? (u.receita / total) * 100 : 0),
      formatCurrency(u.lucro),
    ]),
  };

  return (
    <ChartCard
      title="Receita por usina"
      description={`Participação de cada usina no faturamento de ${mesReferencia}`}
      // Sem legenda separada: a lista de valores ao lado do donut já traz
      // cor + nome + número de cada usina.
      tabela={tabela}
    >
      {dados.length < 2 ? (
        <VizEmpty>
          {dados.length === 0
            ? `Nenhuma receita lançada em ${mesReferencia}.`
            : `Só uma usina faturou em ${mesReferencia} — a divisão aparece quando houver mais de uma.`}
        </VizEmpty>
      ) : (
        <div className="flex flex-col items-center gap-4 sm:flex-row">
          <div className="h-[220px] w-full sm:w-[220px] shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Tooltip
                  content={
                    <VizTooltip
                      defaultKind="currency"
                      labels={Object.fromEntries(dados.map((u) => [u.id, u.nome]))}
                    />
                  }
                />
                <Pie
                  data={dados}
                  dataKey="receita"
                  nameKey="nome"
                  innerRadius={58}
                  outerRadius={88}
                  paddingAngle={2}
                  stroke="hsl(var(--card))"
                  strokeWidth={2}
                >
                  {dados.map((u, i) => (
                    <Cell key={u.id} fill={seriesColor(corPorUsina[u.id] ?? i)} />
                  ))}
                  <Label
                    position="center"
                    content={({ viewBox }: any) => (
                      <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle">
                        <tspan
                          x={viewBox.cx}
                          dy="-0.2em"
                          className="fill-foreground text-lg font-semibold"
                        >
                          {compactCurrency(total)}
                        </tspan>
                        <tspan x={viewBox.cx} dy="1.5em" className="fill-muted-foreground text-xs">
                          receita total
                        </tspan>
                      </text>
                    )}
                  />
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Valores ao lado: a fatia dá a proporção, a lista dá o número */}
          <ul className="w-full space-y-2">
            {dados.map((u, i) => (
              <li key={u.id} className="flex items-center gap-2 text-sm">
                <span
                  aria-hidden
                  className="h-2.5 w-2.5 shrink-0 rounded-[2px]"
                  style={{ background: seriesColor(corPorUsina[u.id] ?? i) }}
                />
                <span className="min-w-0 flex-1 truncate">{u.nome}</span>
                <span className="tabular-nums">{formatCurrency(u.receita)}</span>
                <span className="w-14 text-right text-xs tabular-nums text-muted-foreground">
                  {formatPercent(total ? (u.receita / total) * 100 : 0, 0)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </ChartCard>
  );
}
