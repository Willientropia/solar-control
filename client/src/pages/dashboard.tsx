import { useMemo, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  AlertTriangle,
  Building2,
  CalendarDays,
  FileText,
  PiggyBank,
  Plus,
  RefreshCw,
  Upload,
  Users,
  Zap,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { MetricCard } from "@/components/metric-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { authenticatedFetch } from "@/lib/queryClient";
import { formatCurrency } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import type { DashboardOverview } from "@shared/dashboard-types";
import { UsinaSpotlight } from "@/components/dashboard/usina-spotlight";
import {
  FinanceiroChart,
  GeracaoPorUsinaChart,
  PrecoKwhChart,
  ReceitaPorUsinaChart,
} from "@/components/dashboard/dashboard-charts";
import { PendenciasPanel } from "@/components/dashboard/pendencias-panel";
import { SaldosPanel } from "@/components/dashboard/saldos-panel";
import { VIZ_STATUS, formatKwh, formatPercent } from "@/components/dashboard/viz";

export default function DashboardPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "super_admin";

  // Filtro único, acima de tudo que ele afeta: todos os cartões e gráficos do
  // mês respondem a esta seleção.
  const [mes, setMes] = useState<string>("");

  const { data, isLoading, isFetching, refetch, error } = useQuery<DashboardOverview>({
    queryKey: ["dashboard-overview", mes],
    queryFn: async () => {
      const url = mes
        ? `/api/dashboard/overview?mes=${encodeURIComponent(mes)}`
        : "/api/dashboard/overview";
      const res = await authenticatedFetch(url);
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    staleTime: 60_000,
    // Trocar de mês mantém o render anterior enquanto carrega, sem piscar skeleton
    placeholderData: keepPreviousData,
  });

  /**
   * A cor de cada usina é fixada aqui, uma vez, pela ordem que veio da API —
   * assim a mesma usina tem a mesma cor no destaque, nos gráficos e nas listas,
   * e filtrar um mês não repinta ninguém.
   */
  const corPorUsina = useMemo(() => {
    const mapa: Record<string, number> = {};
    data?.usinas.forEach((u, i) => (mapa[u.id] = i));
    return mapa;
  }, [data?.usinas]);

  const acoes = (
    <div className="flex flex-wrap items-center gap-2">
      {data && data.mesesDisponiveis.length > 0 && (
        <Select value={data.mesReferencia} onValueChange={setMes}>
          <SelectTrigger className="w-[160px]" aria-label="Mês de referência">
            <CalendarDays className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {data.mesesDisponiveis.map((m) => (
              <SelectItem key={m} value={m}>
                {m}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      <Button
        variant="ghost"
        size="icon"
        onClick={() => refetch()}
        disabled={isFetching}
        aria-label="Atualizar dados"
        title="Atualizar dados"
      >
        <RefreshCw className={isFetching ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
      </Button>
      <Button variant="outline" asChild>
        <Link href="/faturas/upload">
          <Upload className="mr-2 h-4 w-4" />
          Upload Faturas
        </Link>
      </Button>
      <Button asChild data-testid="button-new-client">
        <Link href="/clientes?novo=1">
          <Plus className="mr-2 h-4 w-4" />
          Novo Cliente
        </Link>
      </Button>
    </div>
  );

  if (isLoading) {
    return (
      <div className="space-y-8 p-6">
        <PageHeader title="Dashboard" description="Carregando dados do parque…" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="mb-2 h-4 w-24" />
                <Skeleton className="mb-2 h-8 w-32" />
                <Skeleton className="h-4 w-20" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Skeleton className="h-[420px] w-full" />
        <div className="grid gap-6 lg:grid-cols-2">
          <Skeleton className="h-[360px] w-full" />
          <Skeleton className="h-[360px] w-full" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6">
        <PageHeader title="Dashboard" description="Visão geral do parque solar" />
        <Card className="mt-8">
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <AlertTriangle className="h-8 w-8 text-destructive" aria-hidden />
            <p className="font-medium">Não foi possível carregar o dashboard</p>
            <p className="max-w-md text-sm text-muted-foreground">
              {error instanceof Error ? error.message : "Erro desconhecido ao consultar a API."}
            </p>
            <Button onClick={() => refetch()}>Tentar novamente</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { totais, variacoes } = data;
  const semDados = data.mesesDisponiveis.length === 0;

  return (
    // Durante o refetch o conteúdo anterior fica em opacidade reduzida, sem
    // trocar por skeleton — nada salta de lugar.
    <div
      className={
        isFetching
          ? "space-y-8 p-6 opacity-60 transition-opacity"
          : "space-y-8 p-6 transition-opacity"
      }
    >
      <PageHeader
        title="Dashboard"
        description={
          semDados
            ? "Nenhum dado lançado ainda — comece cadastrando uma usina e subindo faturas"
            : `Parque solar em ${data.mesReferencia} · ${totais.usinas} usina${
                totais.usinas > 1 ? "s" : ""
              } · ${totais.clientesAtivos} UCs ativas`
        }
        actions={acoes}
      />

      {semDados ? (
        <PrimeirosPassos />
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              title="Lucro do mês"
              value={formatCurrency(totais.lucro)}
              subtitle={`Receita ${formatCurrency(totais.receita)} − custo ${formatCurrency(
                totais.custo,
              )}`}
              icon={<PiggyBank className="h-5 w-5" />}
              trend={
                variacoes.lucro !== null
                  ? { value: Number(variacoes.lucro.toFixed(1)), label: `vs ${data.mesAnterior}` }
                  : undefined
              }
            />
            <MetricCard
              title="Geração do mês"
              value={formatKwh(totais.geracao)}
              subtitle={
                totais.geracaoPrevista > 0 ? (
                  <span>
                    {formatPercent(totais.performance)} da meta de{" "}
                    {formatKwh(totais.geracaoPrevista)}
                  </span>
                ) : (
                  "Sem meta cadastrada nas usinas"
                )
              }
              icon={<Zap className="h-5 w-5" />}
              trend={
                variacoes.geracao !== null
                  ? { value: Number(variacoes.geracao.toFixed(1)), label: `vs ${data.mesAnterior}` }
                  : undefined
              }
            />
            <MetricCard
              title="Faturas do mês"
              value={`${totais.faturasRecebidas} de ${totais.faturasEsperadas}`}
              subtitle={
                totais.faturasFaltando > 0 ? (
                  <span className="flex items-center gap-1">
                    <AlertTriangle
                      className="h-3 w-3"
                      style={{ color: VIZ_STATUS.warning }}
                      aria-hidden
                    />
                    {totais.faturasFaltando} faltando
                    {totais.faturasEmAtraso > 0 && ` · ${totais.faturasEmAtraso} vencida(s)`}
                  </span>
                ) : (
                  "Todas as UCs ativas com PDF recebido"
                )
              }
              icon={<FileText className="h-5 w-5" />}
            />
            <MetricCard
              title="Saldo de créditos"
              value={formatKwh(totais.saldoTotalKwh)}
              subtitle={`${data.saldos.ucsComSaldo} UCs com crédito acumulado`}
              icon={<Users className="h-5 w-5" />}
            />
          </div>

          <UsinaSpotlight
            usinas={data.usinas}
            mesReferencia={data.mesReferencia}
            corPorUsina={corPorUsina}
          />

          <div className="grid gap-6 xl:grid-cols-2">
            <PrecoKwhChart dados={data.precoKwh} descontos={data.descontos} />
            <GeracaoPorUsinaChart
              dados={data.geracaoPorUsina}
              usinas={data.usinas}
              corPorUsina={corPorUsina}
            />
            <FinanceiroChart dados={data.historico} />
            <ReceitaPorUsinaChart
              usinas={data.usinas}
              corPorUsina={corPorUsina}
              mesReferencia={data.mesReferencia}
            />
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <PendenciasPanel
              pendencias={data.pendencias}
              mesReferencia={data.mesReferencia}
              corPorUsina={corPorUsina}
            />
            <SaldosPanel saldos={data.saldos} corPorUsina={corPorUsina} />
          </div>

          <AcoesRapidas isAdmin={isAdmin} />
        </>
      )}
    </div>
  );
}

function PrimeirosPassos() {
  const passos = [
    {
      titulo: "1. Cadastre uma usina",
      texto: "Informe a UC geradora, a potência e a produção mensal prevista.",
      href: "/usinas?novo=1",
      icone: Building2,
    },
    {
      titulo: "2. Cadastre os clientes",
      texto: "Cada UC beneficiária ligada à usina, com o desconto do contrato.",
      href: "/clientes?novo=1",
      icone: Users,
    },
    {
      titulo: "3. Suba as faturas",
      texto: "Os PDFs da concessionária alimentam todos os números desta tela.",
      href: "/faturas/upload",
      icone: Upload,
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {passos.map((passo) => (
        <Card key={passo.titulo} className="hover-elevate">
          <CardContent className="p-6">
            <passo.icone className="h-5 w-5 text-primary" aria-hidden />
            <h3 className="mt-3 font-medium">{passo.titulo}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{passo.texto}</p>
            <Button variant="outline" size="sm" className="mt-4" asChild>
              <Link href={passo.href}>Começar</Link>
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function AcoesRapidas({ isAdmin }: { isAdmin: boolean }) {
  const acoes = [
    { href: "/faturas/upload", label: "Upload Faturas", icone: Upload, testid: "button-quick-upload" },
    { href: "/usinas?novo=1", label: "Nova Usina", icone: Building2, testid: "button-quick-usina" },
    { href: "/clientes?novo=1", label: "Novo Cliente", icone: Users, testid: "button-quick-cliente" },
    { href: "/geracao", label: "Registrar Geração", icone: Zap, testid: "button-quick-geracao" },
    { href: "/precos-kwh", label: "Preços kWh", icone: FileText, testid: "button-quick-precos" },
    // /relatorios é restrito a admin — para operador o link só levaria a um aviso
    ...(isAdmin
      ? [{ href: "/relatorios", label: "Relatórios", icone: PiggyBank, testid: "button-quick-relatorios" }]
      : []),
  ];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-medium">Ações rápidas</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {acoes.map((acao) => (
          <Button key={acao.href} variant="outline" className="h-auto flex-col gap-2 py-4" asChild>
            <Link href={acao.href} data-testid={acao.testid}>
              <acao.icone className="h-5 w-5" />
              <span className="text-center text-xs">{acao.label}</span>
            </Link>
          </Button>
        ))}
      </CardContent>
    </Card>
  );
}
