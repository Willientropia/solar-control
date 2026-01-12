import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/page-header";
import { MetricCard } from "@/components/metric-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  BarChart3,
  Download,
  TrendingUp,
  Wallet,
  Zap,
  Users,
} from "lucide-react";
import { MonthYearPicker } from "@/components/ui/month-year-picker";
import type { Usina } from "@shared/schema";
import { formatNumber, formatCurrency, getCurrentMonthRef } from "@/lib/utils";

interface ReportData {
  lucroTotal: number;
  economiaTotalClientes: number;
  kwhDistribuido: number;
  saldoCreditos: number;
  clientesAtendidos: number;
  faturasProcessadas: number;
  detalhamentoPorCliente: {
    clienteNome: string;
    unidadeConsumidora: string;
    consumoTotal: number;
    valorPago: number;
    economia: number;
    lucro: number;
  }[];
}

export default function RelatoriosPage() {
  const [selectedUsinaId, setSelectedUsinaId] = useState<string>("all");
  const [selectedPeriodo, setSelectedPeriodo] = useState<string>(getCurrentMonthRef());

  const { data: usinas = [] } = useQuery<Usina[]>({
    queryKey: ["/api/usinas"],
  });

  const { data: report, isLoading } = useQuery<ReportData>({
    queryKey: ["/api/relatorios", selectedUsinaId, selectedPeriodo],
  });

  const handleExportCSV = () => {
    if (!report?.detalhamentoPorCliente) return;

    const headers = ["Cliente", "UC", "Consumo (kWh)", "Valor Pago", "Economia", "Lucro"];
    const rows = report.detalhamentoPorCliente.map((row) => [
      row.clienteNome,
      row.unidadeConsumidora,
      row.consumoTotal,
      row.valorPago.toFixed(2),
      row.economia.toFixed(2),
      row.lucro.toFixed(2),
    ]);

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `relatorio_${selectedPeriodo.replace("/", "_")}.csv`;
    link.click();
  };

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Relatórios"
        description="Análise financeira e de desempenho das suas usinas"
        actions={
          <Button onClick={handleExportCSV} variant="outline" data-testid="button-export-csv">
            <Download className="h-4 w-4 mr-2" />
            Exportar CSV
          </Button>
        }
      />

      <div className="flex flex-wrap gap-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Usina:</span>
          <Select value={selectedUsinaId} onValueChange={setSelectedUsinaId}>
            <SelectTrigger className="w-48" data-testid="select-report-usina">
              <SelectValue placeholder="Todas as usinas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as usinas</SelectItem>
              {usinas.map((usina) => (
                <SelectItem key={usina.id} value={usina.id}>
                  {usina.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Período:</span>
          <MonthYearPicker
            value={selectedPeriodo}
            onChange={setSelectedPeriodo}
            className="w-auto"
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-4 w-24 mb-2" />
                <Skeleton className="h-8 w-32 mb-2" />
                <Skeleton className="h-4 w-20" />
              </CardContent>
            </Card>
          ))
        ) : (
          <>
            <MetricCard
              title="Lucro Total"
              value={formatCurrency(report?.lucroTotal)}
              icon={<Wallet className="h-5 w-5" />}
            />
            <MetricCard
              title="Economia Clientes"
              value={formatCurrency(report?.economiaTotalClientes)}
              icon={<TrendingUp className="h-5 w-5" />}
            />
            <MetricCard
              title="kWh Distribuído"
              value={`${formatNumber(report?.kwhDistribuido)} kWh`}
              icon={<Zap className="h-5 w-5" />}
            />
            <MetricCard
              title="Clientes Atendidos"
              value={(report?.clientesAtendidos || 0).toString()}
              subtitle={`${report?.faturasProcessadas || 0} faturas`}
              icon={<Users className="h-5 w-5" />}
            />
          </>
        )}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4 pb-2">
          <CardTitle className="text-base font-medium">
            Detalhamento por Cliente
          </CardTitle>
          <BarChart3 className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : report?.detalhamentoPorCliente &&
            report.detalhamentoPorCliente.length > 0 ? (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>UC</TableHead>
                    <TableHead className="text-right">Consumo (kWh)</TableHead>
                    <TableHead className="text-right">Valor Pago</TableHead>
                    <TableHead className="text-right">Economia</TableHead>
                    <TableHead className="text-right">Lucro</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.detalhamentoPorCliente.map((row, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">
                        {row.clienteNome}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {row.unidadeConsumidora}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatNumber(row.consumoTotal)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(row.valorPago)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-green-600 dark:text-green-400">
                        {formatCurrency(row.economia)}
                      </TableCell>
                      <TableCell className="text-right font-mono font-medium">
                        {formatCurrency(row.lucro)}
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="border-t-2 font-semibold">
                    <TableCell colSpan={3}>Total</TableCell>
                    <TableCell className="text-right font-mono">
                      {formatCurrency(
                        report.detalhamentoPorCliente.reduce(
                          (acc, row) => acc + row.valorPago,
                          0
                        )
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono text-green-600 dark:text-green-400">
                      {formatCurrency(
                        report.detalhamentoPorCliente.reduce(
                          (acc, row) => acc + row.economia,
                          0
                        )
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatCurrency(
                        report.detalhamentoPorCliente.reduce(
                          (acc, row) => acc + row.lucro,
                          0
                        )
                      )}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              Nenhum dado disponível para o período selecionado.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
