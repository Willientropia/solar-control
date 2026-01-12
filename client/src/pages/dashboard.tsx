import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/page-header";
import { MetricCard } from "@/components/metric-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Building2,
  Users,
  FileText,
  Zap,
  Upload,
  Plus,
  BarChart3,
  AlertTriangle,
} from "lucide-react";
import { Link } from "wouter";
import { formatNumber, formatCurrency } from "@/lib/utils";

interface DashboardStats {
  totalUsinas: number;
  totalClientes: number;
  faturasPendentes: number;
  faturasProcessadas: number;
  faturasEmAtraso: number;
  lucroMensal: number;
  economiaTotalClientes: number;
  kwhGeradoMes: number;
  saldoTotalKwh: number;
}

export default function DashboardPage() {
  const { data: stats, isLoading } = useQuery<DashboardStats>({
    queryKey: ["/api/dashboard/stats"],
  });

  return (
    <div className="p-6 space-y-8">
      <PageHeader
        title="Dashboard"
        description="Visão geral do seu sistema de gestão de energia solar"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" asChild>
              <Link href="/faturas/upload">
                <Upload className="h-4 w-4 mr-2" />
                Upload Faturas
              </Link>
            </Button>
            <Button asChild data-testid="button-new-client">
              <Link href="/clientes/novo">
                <Plus className="h-4 w-4 mr-2" />
                Novo Cliente
              </Link>
            </Button>
          </div>
        }
      />

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
              title="Usinas"
              value={stats?.totalUsinas?.toString() || "0"}
              subtitle="Total cadastradas"
              icon={<Building2 className="h-5 w-5" />}
            />
            <MetricCard
              title="Clientes"
              value={stats?.totalClientes?.toString() || "0"}
              subtitle="Ativos no sistema"
              icon={<Users className="h-5 w-5" />}
            />
            <MetricCard
              title="Faturas Pendentes"
              value={stats?.faturasPendentes?.toString() || "0"}
              subtitle={
                (stats?.faturasEmAtraso || 0) > 0 
                  ? <span className="text-destructive flex items-center gap-1"><AlertTriangle className="h-3 w-3" />{stats?.faturasEmAtraso} em atraso</span>
                  : "Aguardando processamento"
              }
              icon={<FileText className="h-5 w-5" />}
            />
            <MetricCard
              title="Geração Mensal"
              value={`${formatNumber(stats?.kwhGeradoMes)} kWh`}
              subtitle="Total gerado este mês"
              icon={<Zap className="h-5 w-5" />}
            />
          </>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4 pb-2">
            <CardTitle className="text-base font-medium">
              Resumo Financeiro
            </CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/relatorios">
                <BarChart3 className="h-4 w-4 mr-2" />
                Ver Relatório
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex justify-between">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-24" />
                </div>
              ))
            ) : (
              <>
                <div className="flex items-center justify-between py-2 border-b">
                  <span className="text-muted-foreground">Lucro do Mês</span>
                  <span className="text-lg font-semibold font-mono text-green-600 dark:text-green-400">
                    {formatCurrency(stats?.lucroMensal)}
                  </span>
                </div>
                <div className="flex items-center justify-between py-2 border-b">
                  <span className="text-muted-foreground">
                    Economia Total dos Clientes
                  </span>
                  <span className="text-lg font-semibold font-mono">
                    {formatCurrency(stats?.economiaTotalClientes)}
                  </span>
                </div>
                <div className="flex items-center justify-between py-2">
                  <span className="text-muted-foreground">Saldo de Créditos</span>
                  <span className="text-lg font-semibold font-mono">
                    {formatNumber(stats?.saldoTotalKwh)} kWh
                  </span>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium">Ações Rápidas</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            <Button
              variant="outline"
              className="h-auto py-4 flex-col gap-2"
              asChild
            >
              <Link href="/faturas/upload" data-testid="button-quick-upload">
                <Upload className="h-5 w-5" />
                <span>Upload Faturas</span>
              </Link>
            </Button>
            <Button
              variant="outline"
              className="h-auto py-4 flex-col gap-2"
              asChild
            >
              <Link href="/usinas/nova" data-testid="button-quick-usina">
                <Building2 className="h-5 w-5" />
                <span>Nova Usina</span>
              </Link>
            </Button>
            <Button
              variant="outline"
              className="h-auto py-4 flex-col gap-2"
              asChild
            >
              <Link href="/clientes/novo" data-testid="button-quick-cliente">
                <Users className="h-5 w-5" />
                <span>Novo Cliente</span>
              </Link>
            </Button>
            <Button
              variant="outline"
              className="h-auto py-4 flex-col gap-2"
              asChild
            >
              <Link href="/geracao" data-testid="button-quick-geracao">
                <Zap className="h-5 w-5" />
                <span>Registrar Geração</span>
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
