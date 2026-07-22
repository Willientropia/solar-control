import { useMemo, useState } from "react";
import { Link } from "wouter";
import { AlertTriangle, CheckCircle2, Clock, FileQuestion, FileX } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { formatUCNova } from "@shared/uc-utils";
import type { DashboardPendencia, DashboardPendenciaTipo } from "@shared/dashboard-types";
import { VIZ_STATUS, seriesColor } from "./viz";

/**
 * Cada tipo de pendência tem ícone + rótulo próprios. A cor de status só
 * reforça — nunca é o único sinal.
 */
const TIPOS: Record<
  DashboardPendenciaTipo,
  { rotulo: string; curto: string; icone: typeof FileQuestion; cor: string }
> = {
  sem_fatura: {
    rotulo: "Fatura não lançada",
    curto: "Sem fatura",
    icone: FileQuestion,
    cor: VIZ_STATUS.critical,
  },
  sem_pdf: {
    rotulo: "PDF da concessionária faltando",
    curto: "Sem PDF",
    icone: FileX,
    cor: VIZ_STATUS.warning,
  },
  vencida: {
    rotulo: "Vencida sem pagamento",
    curto: "Vencidas",
    icone: AlertTriangle,
    cor: VIZ_STATUS.critical,
  },
  nao_pago: {
    rotulo: "Aguardando pagamento",
    curto: "A pagar",
    icone: Clock,
    cor: VIZ_STATUS.serious,
  },
};

const ORDEM: DashboardPendenciaTipo[] = ["sem_fatura", "vencida", "sem_pdf", "nao_pago"];

export function PendenciasPanel({
  pendencias,
  mesReferencia,
  corPorUsina,
}: {
  pendencias: DashboardPendencia[];
  mesReferencia: string;
  corPorUsina: Record<string, number>;
}) {
  const [filtro, setFiltro] = useState<DashboardPendenciaTipo | "all">("all");

  const contagem = useMemo(() => {
    const mapa = { sem_fatura: 0, sem_pdf: 0, vencida: 0, nao_pago: 0 } as Record<
      DashboardPendenciaTipo,
      number
    >;
    pendencias.forEach((p) => (mapa[p.tipo] += 1));
    return mapa;
  }, [pendencias]);

  // Mais grave primeiro, depois agrupado por usina para o operador atacar em lote
  const lista = useMemo(() => {
    const filtradas = filtro === "all" ? pendencias : pendencias.filter((p) => p.tipo === filtro);
    return [...filtradas].sort((a, b) => {
      const porTipo = ORDEM.indexOf(a.tipo) - ORDEM.indexOf(b.tipo);
      if (porTipo !== 0) return porTipo;
      return a.usinaNome.localeCompare(b.usinaNome) || a.clienteNome.localeCompare(b.clienteNome);
    });
  }, [pendencias, filtro]);

  return (
    <Card>
      <CardHeader className="gap-3 pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="font-medium leading-tight">Pendências de {mesReferencia}</h3>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {pendencias.length === 0
                ? "Nada pendente neste mês"
                : `${pendencias.length} ${pendencias.length > 1 ? "itens" : "item"} exigindo ação`}
            </p>
          </div>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/faturas">Abrir faturas</Link>
          </Button>
        </div>

        {pendencias.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            <FiltroChip ativo={filtro === "all"} onClick={() => setFiltro("all")}>
              Todas ({pendencias.length})
            </FiltroChip>
            {ORDEM.filter((t) => contagem[t] > 0).map((tipo) => {
              const Icon = TIPOS[tipo].icone;
              return (
                <FiltroChip key={tipo} ativo={filtro === tipo} onClick={() => setFiltro(tipo)}>
                  <Icon className="h-3 w-3" style={{ color: TIPOS[tipo].cor }} aria-hidden />
                  {TIPOS[tipo].curto} ({contagem[tipo]})
                </FiltroChip>
              );
            })}
          </div>
        )}
      </CardHeader>

      <CardContent>
        {pendencias.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <CheckCircle2 className="h-8 w-8" style={{ color: VIZ_STATUS.good }} aria-hidden />
            <p className="font-medium">Tudo em dia</p>
            <p className="max-w-xs text-sm text-muted-foreground">
              Todas as UCs ativas têm fatura com PDF e pagamento registrado em {mesReferencia}.
            </p>
          </div>
        ) : (
          <ScrollArea className="h-[340px] pr-3">
            <ul className="space-y-2">
              {lista.map((p) => {
                const tipo = TIPOS[p.tipo];
                const Icon = tipo.icone;
                return (
                  <li
                    key={`${p.clienteId}-${p.tipo}`}
                    className="flex items-start gap-3 rounded-md border p-3"
                  >
                    <Icon className="mt-0.5 h-4 w-4 shrink-0" style={{ color: tipo.cor }} aria-hidden />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-x-2">
                        <Link
                          href={`/clientes/${p.clienteId}`}
                          className="font-medium hover:underline"
                        >
                          {p.clienteNome}
                        </Link>
                        <span className="text-xs text-muted-foreground">
                          UC {formatUCNova(p.uc) || p.uc}
                        </span>
                      </div>
                      <p className="mt-0.5 text-sm text-muted-foreground">
                        {tipo.rotulo} · {p.detalhe}
                      </p>
                      <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                        <span
                          aria-hidden
                          className="h-2 w-2 rounded-[2px]"
                          style={{ background: seriesColor(corPorUsina[p.usinaId] ?? 0) }}
                        />
                        {p.usinaNome}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}

function FiltroChip({
  ativo,
  onClick,
  children,
}: {
  ativo: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={ativo}
      className={cn(
        "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors",
        ativo ? "border-foreground/20 bg-accent font-medium" : "text-muted-foreground hover:bg-accent/50",
      )}
    >
      {children}
    </button>
  );
}
