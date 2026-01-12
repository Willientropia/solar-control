import { useQuery } from "@tanstack/react-query";
import { useParams, useLocation, Link } from "wouter";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft,
  Users,
  FileText,
  BarChart3,
  AlertTriangle,
  CheckCircle,
  Upload,
  Plus,
  MapPin,
  Zap,
  Calendar,
} from "lucide-react";
import type { Usina, Cliente, Fatura, GeracaoMensal } from "@shared/schema";

function getCurrentMonthRef(): string {
  const now = new Date();
  const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  return `${months[now.getMonth()]}/${now.getFullYear()}`;
}

function formatCurrency(value: string | number | null | undefined): string {
  if (!value) return "R$ 0,00";
  const num = typeof value === "string" ? parseFloat(value) : value;
  return num.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatNumber(value: string | number | null | undefined): string {
  if (!value) return "0";
  const num = typeof value === "string" ? parseFloat(value) : value;
  return num.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
}

export default function UsinaDetalhesPage() {
  const params = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const currentMonth = getCurrentMonthRef();

  const { data: usina, isLoading: loadingUsina } = useQuery<Usina>({
    queryKey: ["/api/usinas", params.id],
  });

  const { data: allClientes = [], isLoading: loadingClientes } = useQuery<Cliente[]>({
    queryKey: ["/api/clientes"],
  });

  const { data: allFaturas = [], isLoading: loadingFaturas } = useQuery<(Fatura & { cliente?: Cliente })[]>({
    queryKey: ["/api/faturas"],
  });

  const { data: allGeracoes = [] } = useQuery<(GeracaoMensal & { usina?: Usina })[]>({
    queryKey: ["/api/geracao"],
  });

  const clientes = allClientes.filter((c) => c.usinaId === params.id);
  const faturas = allFaturas.filter((f) => clientes.some((c) => c.id === f.clienteId));
  const geracoes = allGeracoes.filter((g) => g.usinaId === params.id);

  // Calculate monthly status
  const faturasDoMes = faturas.filter((f) => f.mesReferencia === currentMonth);
  const clientesComFatura = new Set(faturasDoMes.map((f) => f.clienteId));
  const clientesSemFatura = clientes.filter((c) => !clientesComFatura.has(c.id));
  const todasFaturasImportadas = clientesSemFatura.length === 0 && clientes.length > 0;

  // Calculate totals
  const lucroTotal = faturas.reduce((acc, f) => acc + parseFloat(f.lucro || "0"), 0);
  const economiaTotal = faturas.reduce((acc, f) => acc + parseFloat(f.economia || "0"), 0);
  const kwhDistribuido = faturas.reduce((acc, f) => acc + parseFloat(f.consumoScee || "0"), 0);

  if (loadingUsina) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!usina) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Usina não encontrada</p>
            <Button variant="outline" className="mt-4" onClick={() => navigate("/usinas")}>
              Voltar para Usinas
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/usinas")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <PageHeader
          title={usina.nome}
          description={`UC: ${usina.unidadeConsumidora}`}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
            <CardTitle className="text-sm font-medium">Status do Mês</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold">{currentMonth}</div>
            {clientes.length === 0 ? (
              <Badge variant="secondary" className="mt-2">Sem clientes</Badge>
            ) : todasFaturasImportadas ? (
              <Badge className="mt-2 bg-green-500">
                <CheckCircle className="h-3 w-3 mr-1" />
                Todas importadas
              </Badge>
            ) : (
              <Badge variant="destructive" className="mt-2">
                <AlertTriangle className="h-3 w-3 mr-1" />
                {clientesSemFatura.length} faltando
              </Badge>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
            <CardTitle className="text-sm font-medium">Clientes</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{clientes.length}</div>
            <p className="text-xs text-muted-foreground">
              Desconto padrão: {usina.descontoPadrao}%
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
            <CardTitle className="text-sm font-medium">Produção Prevista</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(usina.producaoMensalPrevista)}</div>
            <p className="text-xs text-muted-foreground">kWh/mês</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
            <CardTitle className="text-sm font-medium">Lucro Total</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{formatCurrency(lucroTotal)}</div>
            <p className="text-xs text-muted-foreground">
              Economia: {formatCurrency(economiaTotal)}
            </p>
          </CardContent>
        </Card>
      </div>

      {usina.endereco && (
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4" />
              {usina.endereco}
            </div>
          </CardContent>
        </Card>
      )}

      {clientesSemFatura.length > 0 && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Faturas Pendentes - {currentMonth}
            </CardTitle>
            <CardDescription>
              Os seguintes clientes ainda não tiveram suas faturas importadas este mês.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {clientesSemFatura.map((cliente) => (
                <Badge key={cliente.id} variant="outline">
                  {cliente.nome} (UC: {cliente.unidadeConsumidora})
                </Badge>
              ))}
            </div>
            <Button className="mt-4" asChild>
              <Link href="/faturas/upload">
                <Upload className="h-4 w-4 mr-2" />
                Importar Faturas
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="faturas" className="space-y-4">
        <TabsList>
          <TabsTrigger value="faturas" className="gap-2">
            <FileText className="h-4 w-4" />
            Faturas
          </TabsTrigger>
          <TabsTrigger value="clientes" className="gap-2">
            <Users className="h-4 w-4" />
            Clientes
          </TabsTrigger>
          <TabsTrigger value="geracao" className="gap-2">
            <Zap className="h-4 w-4" />
            Geração
          </TabsTrigger>
          <TabsTrigger value="relatorios" className="gap-2">
            <BarChart3 className="h-4 w-4" />
            Relatórios
          </TabsTrigger>
        </TabsList>

        <TabsContent value="faturas" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-medium">Faturas da Usina</h3>
            <Button asChild>
              <Link href="/faturas/upload">
                <Upload className="h-4 w-4 mr-2" />
                Importar Fatura
              </Link>
            </Button>
          </div>

          {loadingFaturas ? (
            <Skeleton className="h-64 w-full" />
          ) : faturas.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Nenhuma fatura encontrada</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>UC</TableHead>
                    <TableHead>Mês Ref.</TableHead>
                    <TableHead className="text-right">Consumo SCEE</TableHead>
                    <TableHead className="text-right">Valor c/ Desconto</TableHead>
                    <TableHead className="text-right">Economia</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {faturas.slice(0, 20).map((fatura) => (
                    <TableRow key={fatura.id}>
                      <TableCell>{fatura.cliente?.nome || "-"}</TableCell>
                      <TableCell className="font-mono text-sm">
                        {fatura.cliente?.unidadeConsumidora || "-"}
                      </TableCell>
                      <TableCell>{fatura.mesReferencia}</TableCell>
                      <TableCell className="text-right font-mono">
                        {formatNumber(fatura.consumoScee)} kWh
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(fatura.valorComDesconto)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-green-600">
                        {formatCurrency(fatura.economia)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            fatura.status === "processada"
                              ? "default"
                              : fatura.status === "enviada"
                              ? "secondary"
                              : "outline"
                          }
                        >
                          {fatura.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="clientes" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-medium">Clientes da Usina</h3>
            <Button asChild>
              <Link href="/clientes">
                <Plus className="h-4 w-4 mr-2" />
                Adicionar Cliente
              </Link>
            </Button>
          </div>

          {loadingClientes ? (
            <Skeleton className="h-64 w-full" />
          ) : clientes.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Nenhum cliente cadastrado</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>UC</TableHead>
                    <TableHead>Desconto</TableHead>
                    <TableHead>Pagante</TableHead>
                    <TableHead>Status Mês</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clientes.map((cliente) => {
                    const temFaturaMes = clientesComFatura.has(cliente.id);
                    return (
                      <TableRow key={cliente.id}>
                        <TableCell className="font-medium">{cliente.nome}</TableCell>
                        <TableCell className="font-mono text-sm">
                          {cliente.unidadeConsumidora}
                        </TableCell>
                        <TableCell>{cliente.desconto}%</TableCell>
                        <TableCell>
                          <Badge variant={cliente.isPagante ? "default" : "secondary"}>
                            {cliente.isPagante ? "Sim" : "Não"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {temFaturaMes ? (
                            <Badge className="bg-green-500">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              OK
                            </Badge>
                          ) : (
                            <Badge variant="destructive">
                              <AlertTriangle className="h-3 w-3 mr-1" />
                              Pendente
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="geracao" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-medium">Histórico de Geração</h3>
            <Button asChild>
              <Link href="/geracao">
                <Plus className="h-4 w-4 mr-2" />
                Registrar Geração
              </Link>
            </Button>
          </div>

          {geracoes.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Zap className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Nenhum registro de geração</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Mês Referência</TableHead>
                    <TableHead className="text-right">kWh Gerado</TableHead>
                    <TableHead className="text-right">% do Previsto</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {geracoes.map((geracao) => {
                    const percentual = usina.producaoMensalPrevista
                      ? (parseFloat(geracao.kwhGerado) / parseFloat(usina.producaoMensalPrevista)) * 100
                      : 0;
                    return (
                      <TableRow key={geracao.id}>
                        <TableCell>{geracao.mesReferencia}</TableCell>
                        <TableCell className="text-right font-mono">
                          {formatNumber(geracao.kwhGerado)} kWh
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {percentual.toFixed(1)}%
                        </TableCell>
                        <TableCell>
                          {geracao.alertaBaixaGeracao ? (
                            <Badge variant="destructive">
                              <AlertTriangle className="h-3 w-3 mr-1" />
                              Baixa Geração
                            </Badge>
                          ) : (
                            <Badge className="bg-green-500">Normal</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="relatorios" className="space-y-4">
          <h3 className="text-lg font-medium">Resumo Financeiro</h3>

          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Lucro Total
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-green-600">
                  {formatCurrency(lucroTotal)}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Economia dos Clientes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-blue-600">
                  {formatCurrency(economiaTotal)}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  kWh Distribuído
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  {formatNumber(kwhDistribuido)}
                </div>
                <p className="text-sm text-muted-foreground">kWh total</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Detalhamento por Cliente</CardTitle>
            </CardHeader>
            <CardContent>
              {clientes.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  Nenhum cliente cadastrado
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cliente</TableHead>
                      <TableHead className="text-right">Faturas</TableHead>
                      <TableHead className="text-right">Total Pago</TableHead>
                      <TableHead className="text-right">Economia</TableHead>
                      <TableHead className="text-right">Lucro</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {clientes.map((cliente) => {
                      const clienteFaturas = faturas.filter((f) => f.clienteId === cliente.id);
                      const totalPago = clienteFaturas.reduce(
                        (acc, f) => acc + parseFloat(f.valorComDesconto || "0"),
                        0
                      );
                      const totalEconomia = clienteFaturas.reduce(
                        (acc, f) => acc + parseFloat(f.economia || "0"),
                        0
                      );
                      const totalLucro = clienteFaturas.reduce(
                        (acc, f) => acc + parseFloat(f.lucro || "0"),
                        0
                      );

                      return (
                        <TableRow key={cliente.id}>
                          <TableCell className="font-medium">{cliente.nome}</TableCell>
                          <TableCell className="text-right">{clienteFaturas.length}</TableCell>
                          <TableCell className="text-right font-mono">
                            {formatCurrency(totalPago)}
                          </TableCell>
                          <TableCell className="text-right font-mono text-blue-600">
                            {formatCurrency(totalEconomia)}
                          </TableCell>
                          <TableCell className="text-right font-mono text-green-600">
                            {formatCurrency(totalLucro)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
