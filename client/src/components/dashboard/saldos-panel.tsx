import { Link } from "wouter";
import type { DashboardOverview, DashboardSaldoUC } from "@shared/dashboard-types";
import { formatUCNova } from "@shared/uc-utils";
import { ChartCard } from "./chart-card";
import { VizEmpty, formatKwh, seriesColor } from "./viz";

function Ranking({
  titulo,
  itens,
  maximo,
  corPorUsina,
}: {
  titulo: string;
  itens: DashboardSaldoUC[];
  maximo: number;
  corPorUsina: Record<string, number>;
}) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{titulo}</p>
      <ul className="mt-2 space-y-3">
        {itens.map((item) => {
          const cor = seriesColor(corPorUsina[item.usinaId] ?? 0);
          const largura = maximo > 0 ? Math.max((item.saldo / maximo) * 100, 1) : 0;

          return (
            <li key={item.clienteId}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <Link
                  href={`/clientes/${item.clienteId}`}
                  className="min-w-0 flex-1 truncate hover:underline"
                >
                  {item.clienteNome}
                </Link>
                <span className="shrink-0 text-sm tabular-nums">
                  {formatKwh(item.saldo)}
                </span>
              </div>
              {/* Barra fina, ponta arredondada, crescendo de uma linha de base só */}
              <div className="mt-1 h-2 w-full rounded-sm bg-muted">
                <div
                  className="h-full rounded-sm"
                  style={{ width: `${largura}%`, background: cor }}
                  aria-hidden
                />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                UC {formatUCNova(item.uc) || item.uc} · {item.usinaNome} · saldo de {item.mes}
              </p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function SaldosPanel({
  saldos,
  corPorUsina,
}: {
  saldos: DashboardOverview["saldos"];
  corPorUsina: Record<string, number>;
}) {
  const maximo = Math.max(...saldos.maiores.map((s) => s.saldo), 0);

  const tabela = {
    headers: ["Cliente", "UC", "Usina", "Saldo (kWh)", "Mês"],
    rows: [...saldos.maiores, ...saldos.menores].map((s) => [
      s.clienteNome,
      formatUCNova(s.uc) || s.uc,
      s.usinaNome,
      formatKwh(s.saldo),
      s.mes,
    ]),
  };

  return (
    <ChartCard
      title="Saldo de créditos por UC"
      description={`${saldos.ucsComSaldo} unidades com saldo · ${formatKwh(saldos.total)} acumulados`}
      tabela={tabela}
    >
      {saldos.maiores.length === 0 ? (
        <VizEmpty>Nenhuma fatura com saldo de créditos lançada até aqui.</VizEmpty>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <Ranking
            titulo="Maiores saldos"
            itens={saldos.maiores}
            maximo={maximo}
            corPorUsina={corPorUsina}
          />
          {saldos.menores.length > 0 && (
            <Ranking
              titulo="Menores saldos"
              itens={saldos.menores}
              maximo={maximo}
              corPorUsina={corPorUsina}
            />
          )}
        </div>
      )}
    </ChartCard>
  );
}
