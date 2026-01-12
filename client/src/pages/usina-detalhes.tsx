import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useLocation, Link } from "wouter";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
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
  Pencil,
  ChevronLeft,
  ChevronRight,
  Loader2,
  FileDown,
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

function getAvailableMonths(faturas: Fatura[]): string[] {
  const months = new Set(faturas.map((f) => f.mesReferencia));
  return Array.from(months).sort((a, b) => {
    const [mesA, anoA] = a.split("/");
    const [mesB, anoB] = b.split("/");
    if (anoA !== anoB) return parseInt(anoB) - parseInt(anoA);
    const monthOrder = ["Dez", "Nov", "Out", "Set", "Ago", "Jul", "Jun", "Mai", "Abr", "Mar", "Fev", "Jan"];
    return monthOrder.indexOf(mesA) - monthOrder.indexOf(mesB);
  });
}

type MonthFilter = "current" | "previous" | "all";

export default function UsinaDetalhesPage() {
  const params = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const currentMonth = getCurrentMonthRef();
  
  const [monthFilter, setMonthFilter] = useState<MonthFilter>("all");
  const [editingFatura, setEditingFatura] = useState<(Fatura & { cliente?: Cliente }) | null>(null);
  const [editFormData, setEditFormData] = useState<Record<string, string>>({});
  const [generatingPdfId, setGeneratingPdfId] = useState<string | null>(null);
  const [selectedReportMonths, setSelectedReportMonths] = useState<string[]>([]);
  const [generatingReport, setGeneratingReport] = useState(false);

  const { data: allUsinas = [], isLoading: loadingUsina } = useQuery<Usina[]>({
    queryKey: ["/api/usinas"],
  });

  const usina = allUsinas.find((u) => u.id === params.id);

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
  const allUsinaFaturas = allFaturas.filter((f) => clientes.some((c) => c.id === f.clienteId));
  const geracoes = allGeracoes.filter((g) => g.usinaId === params.id);
  
  // Get previous month reference
  const getPreviousMonthRef = (): string => {
    const now = new Date();
    now.setMonth(now.getMonth() - 1);
    const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    return `${months[now.getMonth()]}/${now.getFullYear()}`;
  };
  const previousMonth = getPreviousMonthRef();
  
  // Filter faturas by month
  const faturas = allUsinaFaturas.filter((f) => {
    if (monthFilter === "current") return f.mesReferencia === currentMonth;
    if (monthFilter === "previous") return f.mesReferencia === previousMonth;
    return true;
  });
  
  // Update fatura mutation
  const updateFaturaMutation = useMutation({
    mutationFn: async (data: { id: string; updates: Record<string, string> }) => {
      const response = await apiRequest("PATCH", `/api/faturas/${data.id}`, data.updates);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/faturas"] });
      toast({
        title: "Fatura atualizada!",
        description: "Os dados foram salvos com sucesso.",
      });
      setEditingFatura(null);
      setEditFormData({});
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao salvar",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  const generatePdfMutation = useMutation({
    mutationFn: async (faturaId: string) => {
      setGeneratingPdfId(faturaId);
      const response = await apiRequest("POST", `/api/faturas/${faturaId}/generate-pdf`);
      return response.json();
    },
    onSuccess: (data) => {
      setGeneratingPdfId(null);
      queryClient.invalidateQueries({ queryKey: ["/api/faturas"] });
      toast({
        title: "PDF gerado!",
        description: "A fatura foi gerada com sucesso.",
      });
      if (data.pdfUrl) {
        window.open(data.pdfUrl, "_blank");
      }
    },
    onError: (error: Error) => {
      setGeneratingPdfId(null);
      toast({
        title: "Erro ao gerar PDF",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  const generateReportMutation = useMutation({
    mutationFn: async (meses: string[]) => {
      setGeneratingReport(true);
      const response = await apiRequest("POST", `/api/usinas/${params.id}/generate-relatorio`, { meses });
      return response.json();
    },
    onSuccess: (data) => {
      setGeneratingReport(false);
      toast({
        title: "Relatório gerado!",
        description: "O relatório foi gerado com sucesso.",
      });
      if (data.pdfUrl) {
        window.open(data.pdfUrl, "_blank");
      }
    },
    onError: (error: Error) => {
      setGeneratingReport(false);
      toast({
        title: "Erro ao gerar relatório",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  const toggleReportMonth = (month: string) => {
    setSelectedReportMonths((prev) => 
      prev.includes(month) 
        ? prev.filter((m) => m !== month)
        : [...prev, month]
    );
  };
  
  const handleGenerateReport = () => {
    const meses = selectedReportMonths.length > 0 ? selectedReportMonths : [currentMonth];
    generateReportMutation.mutate(meses);
  };
  
  const openEditModal = (fatura: Fatura) => {
    setEditingFatura(fatura);
    setEditFormData({
      mesReferencia: fatura.mesReferencia || "",
      dataVencimento: fatura.dataVencimento || "",
      consumoScee: fatura.consumoScee || "",
      consumoNaoCompensado: fatura.consumoNaoCompensado || "",
      energiaInjetada: fatura.energiaInjetada || "",
      saldoKwh: fatura.saldoKwh || "",
      valorTotal: fatura.valorTotal || "",
      valorSemDesconto: fatura.valorSemDesconto || "",
      valorComDesconto: fatura.valorComDesconto || "",
      economia: fatura.economia || "",
      lucro: fatura.lucro || "",
      status: fatura.status || "pendente",
    });
  };
  
  const handleEditFieldChange = (key: string, value: string) => {
    setEditFormData((prev) => ({ ...prev, [key]: value }));
  };
  
  const handleSaveEdit = () => {
    if (!editingFatura) return;
    updateFaturaMutation.mutate({ id: editingFatura.id, updates: editFormData });
  };

  // Get available months for report selection
  const availableMonths = getAvailableMonths(allUsinaFaturas);
  
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
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <h3 className="text-lg font-medium">Faturas da Usina</h3>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center border rounded-lg overflow-hidden">
                <Button
                  variant={monthFilter === "previous" ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setMonthFilter("previous")}
                  className="rounded-none"
                  data-testid="button-filter-previous"
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  {previousMonth}
                </Button>
                <Button
                  variant={monthFilter === "current" ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setMonthFilter("current")}
                  className="rounded-none border-x"
                  data-testid="button-filter-current"
                >
                  {currentMonth}
                </Button>
                <Button
                  variant={monthFilter === "all" ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setMonthFilter("all")}
                  className="rounded-none"
                  data-testid="button-filter-all"
                >
                  Todos
                </Button>
              </div>
              <Button asChild>
                <Link href="/faturas/upload">
                  <Upload className="h-4 w-4 mr-2" />
                  Importar
                </Link>
              </Button>
            </div>
          </div>

          {loadingFaturas ? (
            <Skeleton className="h-64 w-full" />
          ) : faturas.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  {monthFilter === "all" 
                    ? "Nenhuma fatura encontrada" 
                    : `Nenhuma fatura em ${monthFilter === "current" ? currentMonth : previousMonth}`}
                </p>
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
                    <TableHead className="text-right">Lucro</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {faturas.slice(0, 50).map((fatura) => (
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
                        {formatCurrency(fatura.lucro)}
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
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditModal(fatura)}
                            data-testid={`button-edit-fatura-${fatura.id}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => generatePdfMutation.mutate(fatura.id)}
                            disabled={generatingPdfId === fatura.id}
                            data-testid={`button-generate-pdf-${fatura.id}`}
                            title="Gerar fatura PDF"
                          >
                            {generatingPdfId === fatura.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <FileDown className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
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
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h3 className="text-lg font-medium">Resumo Financeiro</h3>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Período:</span>
              <div className="flex flex-wrap gap-1">
                {availableMonths.map((month) => (
                  <Badge 
                    key={month}
                    variant={selectedReportMonths.includes(month) ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => toggleReportMonth(month)}
                    data-testid={`badge-month-${month.replace("/", "-")}`}
                  >
                    {month}
                  </Badge>
                ))}
              </div>
              <Button 
                onClick={handleGenerateReport}
                disabled={generatingReport}
                data-testid="button-generate-report"
              >
                {generatingReport ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <FileDown className="h-4 w-4 mr-2" />
                )}
                Gerar PDF
              </Button>
            </div>
          </div>

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
      
      <Dialog open={!!editingFatura} onOpenChange={(open) => !open && setEditingFatura(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Editar Fatura</DialogTitle>
            <DialogDescription>
              Edite os dados da fatura de {editingFatura?.cliente?.nome || "cliente"} - {editingFatura?.mesReferencia}
            </DialogDescription>
          </DialogHeader>
          
          <ScrollArea className="max-h-[60vh] pr-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="edit-mesReferencia">Mês Referência</Label>
                <Input
                  id="edit-mesReferencia"
                  value={editFormData.mesReferencia || ""}
                  onChange={(e) => handleEditFieldChange("mesReferencia", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-dataVencimento">Data Vencimento</Label>
                <Input
                  id="edit-dataVencimento"
                  value={editFormData.dataVencimento || ""}
                  onChange={(e) => handleEditFieldChange("dataVencimento", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-consumoScee">Consumo SCEE (kWh)</Label>
                <Input
                  id="edit-consumoScee"
                  value={editFormData.consumoScee || ""}
                  onChange={(e) => handleEditFieldChange("consumoScee", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-consumoNaoCompensado">Consumo Não Compensado (kWh)</Label>
                <Input
                  id="edit-consumoNaoCompensado"
                  value={editFormData.consumoNaoCompensado || ""}
                  onChange={(e) => handleEditFieldChange("consumoNaoCompensado", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-energiaInjetada">Energia Injetada (kWh)</Label>
                <Input
                  id="edit-energiaInjetada"
                  value={editFormData.energiaInjetada || ""}
                  onChange={(e) => handleEditFieldChange("energiaInjetada", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-saldoKwh">Saldo (kWh)</Label>
                <Input
                  id="edit-saldoKwh"
                  value={editFormData.saldoKwh || ""}
                  onChange={(e) => handleEditFieldChange("saldoKwh", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-valorTotal">Valor Total Fatura (R$)</Label>
                <Input
                  id="edit-valorTotal"
                  value={editFormData.valorTotal || ""}
                  onChange={(e) => handleEditFieldChange("valorTotal", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-valorSemDesconto">Valor Sem Desconto (R$)</Label>
                <Input
                  id="edit-valorSemDesconto"
                  value={editFormData.valorSemDesconto || ""}
                  onChange={(e) => handleEditFieldChange("valorSemDesconto", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-valorComDesconto">Valor Com Desconto (R$)</Label>
                <Input
                  id="edit-valorComDesconto"
                  value={editFormData.valorComDesconto || ""}
                  onChange={(e) => handleEditFieldChange("valorComDesconto", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-economia">Economia (R$)</Label>
                <Input
                  id="edit-economia"
                  value={editFormData.economia || ""}
                  onChange={(e) => handleEditFieldChange("economia", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-lucro">Lucro (R$)</Label>
                <Input
                  id="edit-lucro"
                  value={editFormData.lucro || ""}
                  onChange={(e) => handleEditFieldChange("lucro", e.target.value)}
                  className="bg-muted"
                  disabled
                />
                <p className="text-xs text-muted-foreground">Calculado automaticamente</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-status">Status</Label>
                <Select
                  value={editFormData.status || "pendente"}
                  onValueChange={(value) => handleEditFieldChange("status", value)}
                >
                  <SelectTrigger id="edit-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pendente">Pendente</SelectItem>
                    <SelectItem value="processada">Processada</SelectItem>
                    <SelectItem value="enviada">Enviada</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </ScrollArea>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingFatura(null)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveEdit} disabled={updateFaturaMutation.isPending}>
              {updateFaturaMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                "Salvar Alterações"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
