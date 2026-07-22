import { useState } from "react";
import { BarChart3, Table2 } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { VizLegend } from "./viz";

export interface TabelaEquivalente {
  headers: string[];
  rows: (string | number)[][];
}

interface ChartCardProps {
  title: string;
  description?: string;
  /** Obrigatória a partir de duas séries — identidade nunca só pela cor. */
  legend?: { label: string; color: string; dashed?: boolean }[];
  /** Destaque numérico à direita do título (valor atual, variação). */
  headline?: React.ReactNode;
  /**
   * Todo gráfico tem uma tabela equivalente: é o caminho acessível para os
   * valores e a compensação para as cores que não atingem 3:1 no tema claro.
   */
  tabela: TabelaEquivalente;
  className?: string;
  children: React.ReactNode;
}

export function ChartCard({
  title,
  description,
  legend,
  headline,
  tabela,
  className,
  children,
}: ChartCardProps) {
  const [modoTabela, setModoTabela] = useState(false);

  return (
    <Card className={className}>
      <CardHeader className="gap-3 pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-medium leading-tight">{title}</h3>
            {description && (
              <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
            )}
          </div>
          <div className="flex items-center gap-3">
            {headline}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setModoTabela((v) => !v)}
              aria-label={modoTabela ? "Ver como gráfico" : "Ver como tabela"}
              title={modoTabela ? "Ver como gráfico" : "Ver como tabela"}
            >
              {modoTabela ? <BarChart3 className="h-4 w-4" /> : <Table2 className="h-4 w-4" />}
            </Button>
          </div>
        </div>
        {legend && !modoTabela && <VizLegend items={legend} />}
      </CardHeader>

      <CardContent>
        {modoTabela ? (
          <div className="max-h-[300px] overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  {tabela.headers.map((h, i) => (
                    <TableHead key={h} className={i === 0 ? "" : "text-right"}>
                      {h}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {tabela.rows.map((row, i) => (
                  <TableRow key={i}>
                    {row.map((cell, j) => (
                      <TableCell
                        key={j}
                        className={j === 0 ? "font-medium" : "text-right tabular-nums"}
                      >
                        {cell}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          children
        )}
      </CardContent>
    </Card>
  );
}
