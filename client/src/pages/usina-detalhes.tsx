import { useState, useEffect, useRef } from "react";
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
  Info,
  Calculator,
} from "lucide-react";
import type { Usina, Cliente, Fatura, GeracaoMensal } from "@shared/schema";
import { formatCurrency, formatNumber, parseToNumber, getCurrentMonthRef, cn } from "@/lib/utils";
import { MonthPicker } from "@/components/month-picker";
import { FaturaFlowIndicators } from "@/components/fatura-flow-indicators";
import { useAuth } from "@/hooks/use-auth";

function getAvailableMonths(faturas: Fatura[], geracoes: GeracaoMensal[]): string[] {
  const months = new Set([
    ...faturas.map((f) => f.mesReferencia),
    ...geracoes.map((g) => g.mesReferencia)
  ]);
  return Array.from(months).sort((a, b) => {
    const [mesA, anoA] = a.split("/");
    const [mesB, anoB] = b.split("/");
    if (anoA !== anoB) return parseInt(anoB) - parseInt(anoA);
    const monthOrder = ["DEZ", "NOV", "OUT", "SET", "AGO", "JUL", "JUN", "MAI", "ABR", "MAR", "FEV", "JAN"];
    return monthOrder.indexOf(mesA.toUpperCase()) - monthOrder.indexOf(mesB.toUpperCase());
  });
}

// Field categories for organized display in edit modal
const FIELD_CATEGORIES = [
  {
    name: "Informações Gerais",
    color: "blue",
    bgClass: "bg-blue-50 dark:bg-blue-950/30",
    borderClass: "border-blue-200 dark:border-blue-800",
    textClass: "text-blue-700 dark:text-blue-300",
    fields: [
      { key: "mesReferencia", label: "Mês Referência", type: "text" as const },
      { key: "dataVencimento", label: "Data Vencimento", type: "text" as const },
    ]
  },
  {
    name: "Consumo e Geração (kWh)",
    color: "amber",
    bgClass: "bg-amber-50 dark:bg-amber-950/30",
    borderClass: "border-amber-200 dark:border-amber-800",
    textClass: "text-amber-700 dark:text-amber-300",
    fields: [
      { key: "consumoScee", label: "Consumo SCEE (kWh)", type: "text" as const },
      { key: "consumoNaoCompensado", label: "Consumo Não Compensado (kWh)", type: "text" as const },
      { key: "energiaInjetada", label: "Energia Injetada (kWh)", type: "text" as const },
      { key: "saldoKwh", label: "Saldo (kWh)", type: "text" as const },
    ]
  },
  {
    name: "Valores Monetários (R$)",
    color: "green",
    bgClass: "bg-green-50 dark:bg-green-950/30",
    borderClass: "border-green-200 dark:border-green-800",
    textClass: "text-green-700 dark:text-green-300",
    fields: [
      { key: "valorTotal", label: "Valor Total Fatura (R$)", type: "text" as const },
      { key: "valorSemDesconto", label: "Valor Sem Desconto (R$)", type: "text" as const },
      { key: "valorComDesconto", label: "Valor Com Desconto (R$)", type: "text" as const },
      {
        key: "economia",
        label: "Economia (R$)",
        type: "text" as const,
        readonly: true,
        formula: "Economia = Valor Sem Desconto - Valor Com Desconto"
      },
      {
        key: "lucro",
        label: "Lucro (R$)",
        type: "text" as const,
        readonly: true,
        formula: "Lucro = Valor Com Desconto - Valor Total Fatura"
      },
    ]
  }
];

export default function UsinaDetalhesPage() {
  const params = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const currentMonth = getCurrentMonthRef();

  const userRole = (user?.role as "super_admin" | "admin" | "operador") || "operador";
  const isOperador = userRole === "operador";

  const [editingFatura, setEditingFatura] = useState<(Fatura & { cliente?: Cliente }) | null>(null);
  const [editFormData, setEditFormData] = useState<Record<string, string>>({});
  const [generatingPdfId, setGeneratingPdfId] = useState<string | null>(null);
  const [selectedReportMonths, setSelectedReportMonths] = useState<string[]>([]);
  const [generatingReport, setGeneratingReport] = useState(false);
  const [selectedFaturasMonth, setSelectedFaturasMonth] = useState<string>(currentMonth);
  const [precoKwhInfo, setPrecoKwhInfo] = useState<{
    valor: string;
    mesOrigem: string;
    mesReferencia: string;
    usandoFallback: boolean;
  } | null>(null);

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
    const months = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];
    return `${months[now.getMonth()]}/${now.getFullYear()}`;
  };
  const previousMonth = getPreviousMonthRef();

  // Faturas logic - filter by selected month
  const faturas = selectedFaturasMonth === "all"
    ? allUsinaFaturas
    : allUsinaFaturas.filter(f => f.mesReferencia.toUpperCase() === selectedFaturasMonth.toUpperCase());
  
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
    const meses = selectedReportMonths.length > 0 
      ? selectedReportMonths 
      : (availableMonths.length > 0 ? [availableMonths[0]] : [currentMonth]);
    generateReportMutation.mutate(meses);
  };
  
  const openEditModal = (fatura: Fatura) => {
    setEditingFatura(fatura);
    setPrecoKwhInfo(null); // Reset price info when opening modal

    // Determine status da fatura com desconto
    let statusFaturaDesconto = "pendente";
    if (fatura.faturaClienteRecebidaAt) {
      statusFaturaDesconto = "recebida";
    } else if (fatura.faturaClienteEnviadaAt) {
      statusFaturaDesconto = "enviada";
    } else if (fatura.faturaClienteGeradaAt) {
      statusFaturaDesconto = "gerada";
    }

    setEditFormData({
      mesReferencia: fatura.mesReferencia || "",
      dataVencimento: fatura.dataVencimento || "",
      consumoScee: formatNumber(fatura.consumoScee),
      consumoNaoCompensado: formatNumber(fatura.consumoNaoCompensado),
      energiaInjetada: formatNumber(fatura.energiaInjetada),
      saldoKwh: formatNumber(fatura.saldoKwh),
      valorTotal: formatNumber(fatura.valorTotal),
      valorSemDesconto: formatNumber(fatura.valorSemDesconto),
      valorComDesconto: formatNumber(fatura.valorComDesconto),
      economia: formatNumber(fatura.economia),
      lucro: formatNumber(fatura.lucro),
      status: fatura.status || "pendente",
      statusFaturaDesconto,
    });
  };
  
  const handleEditFieldChange = (key: string, value: string) => {
    setEditFormData((prev) => {
      const newData = { ...prev, [key]: value };

      // Recalculate Lucro if dependent fields change
      if (key === "valorComDesconto" || key === "valorTotal") {
        const valComDesconto = parseToNumber(key === "valorComDesconto" ? value : prev.valorComDesconto || "0");
        const valTotal = parseToNumber(key === "valorTotal" ? value : prev.valorTotal || "0");
        const lucro = valComDesconto - valTotal;
        newData.lucro = formatNumber(lucro);
      }

      return newData;
    });
  };
  
  const handleSaveEdit = () => {
    if (!editingFatura) return;

    const updates = { ...editFormData };
    const numericFields = [
      "consumoScee", "consumoNaoCompensado", "energiaInjetada", "saldoKwh",
      "valorTotal", "valorSemDesconto", "valorComDesconto", "economia", "lucro"
    ];

    numericFields.forEach((field) => {
      if (updates[field]) {
        const num = parseToNumber(updates[field]);
        updates[field] = num.toFixed(2);
      }
    });

    // Convert statusFaturaDesconto to timestamps
    if (updates.statusFaturaDesconto) {
      const now = new Date().toISOString();
      switch (updates.statusFaturaDesconto) {
        case "pendente":
          updates.faturaClienteGeradaAt = "";
          updates.faturaClienteEnviadaAt = "";
          updates.faturaClienteRecebidaAt = "";
          break;
        case "gerada":
          updates.faturaClienteGeradaAt = editingFatura.faturaClienteGeradaAt || now;
          updates.faturaClienteEnviadaAt = "";
          updates.faturaClienteRecebidaAt = "";
          break;
        case "enviada":
          updates.faturaClienteGeradaAt = editingFatura.faturaClienteGeradaAt || now;
          updates.faturaClienteEnviadaAt = editingFatura.faturaClienteEnviadaAt || now;
          updates.faturaClienteRecebidaAt = "";
          break;
        case "recebida":
          updates.faturaClienteGeradaAt = editingFatura.faturaClienteGeradaAt || now;
          updates.faturaClienteEnviadaAt = editingFatura.faturaClienteEnviadaAt || now;
          updates.faturaClienteRecebidaAt = editingFatura.faturaClienteRecebidaAt || now;
          break;
      }
      delete updates.statusFaturaDesconto;
    }

    updateFaturaMutation.mutate({ id: editingFatura.id, updates });
  };

  const handleRecalculate = async () => {
    if (!editFormData.mesReferencia) {
      toast({
        title: "Erro",
        description: "Mês de referência não informado",
        variant: "destructive",
      });
      return;
    }

    try {
      // Fetch price for the month
      const mesEncoded = encodeURIComponent(editFormData.mesReferencia);
      const response = await apiRequest("GET", `/api/precos-kwh/mes/${mesEncoded}`);
      const precoResponse = await response.json();

      let fetchedPrecoKwh = "0";
      let precoInfo: typeof precoKwhInfo = null;

      if (precoResponse.precoKwhCalculado) {
        // Price found for this month
        fetchedPrecoKwh = precoResponse.precoKwhCalculado;
        precoInfo = {
          valor: fetchedPrecoKwh,
          mesOrigem: editFormData.mesReferencia,
          mesReferencia: editFormData.mesReferencia,
          usandoFallback: false
        };
      } else {
        // Fallback: use most recent price
        const allPrecosResponse = await apiRequest("GET", "/api/precos-kwh");
        const allPrecos = await allPrecosResponse.json();

        if (allPrecos.length === 0) {
          toast({
            title: "Erro",
            description: "Nenhum preço kWh cadastrado no sistema",
            variant: "destructive",
          });
          return;
        }

        const ultimoPreco = allPrecos.sort((a: any, b: any) => {
          const [mesA, anoA] = a.mesReferencia.split("/");
          const [mesB, anoB] = b.mesReferencia.split("/");
          if (anoA !== anoB) return parseInt(anoB) - parseInt(anoA);
          const monthOrder = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];
          return monthOrder.indexOf(mesB) - monthOrder.indexOf(mesA);
        })[0];

        fetchedPrecoKwh = ultimoPreco.precoKwhCalculado;
        precoInfo = {
          valor: fetchedPrecoKwh,
          mesOrigem: ultimoPreco.mesReferencia,
          mesReferencia: editFormData.mesReferencia,
          usandoFallback: true
        };

        toast({
          title: "Preço não encontrado",
          description: `Usando preço de ${ultimoPreco.mesReferencia}: R$ ${parseFloat(fetchedPrecoKwh).toFixed(4)}/kWh`,
          variant: "default",
        });
      }

      setPrecoKwhInfo(precoInfo);

      // Recalculate all values
      const precoKwh = parseFloat(fetchedPrecoKwh);
      const consumoScee = parseToNumber(editFormData.consumoScee || "0");
      const energiaInjetada = parseToNumber(editFormData.energiaInjetada || "0");
      const valorTotal = parseToNumber(editFormData.valorTotal || "0");

      const valorSemDesconto = consumoScee * precoKwh;
      const economia = energiaInjetada * precoKwh;
      const valorComDesconto = valorSemDesconto - economia;
      const lucro = valorComDesconto - valorTotal;

      setEditFormData(prev => ({
        ...prev,
        valorSemDesconto: formatNumber(valorSemDesconto),
        economia: formatNumber(economia),
        valorComDesconto: formatNumber(valorComDesconto),
        lucro: formatNumber(lucro),
      }));

      toast({
        title: "Valores recalculados",
        description: `Preço kWh: R$ ${precoKwh.toFixed(4)}`,
      });
    } catch (error) {
      console.error("Error recalculating:", error);
      toast({
        title: "Erro ao recalcular",
        description: "Não foi possível buscar o preço kWh",
        variant: "destructive",
      });
    }
  };

  // Get available months for report selection
  const availableMonths = getAvailableMonths(allUsinaFaturas, geracoes);
  
  // Sort clients by contract number
  const clientesOrdenados = [...clientes].sort((a, b) => {
    const aNum = a.numeroContrato || "";
    const bNum = b.numeroContrato || "";
    return aNum.localeCompare(bNum, undefined, { numeric: true });
  });

  // Sort faturas by client contract number
  const faturasOrdenadas = [...faturas].sort((a, b) => {
    const clienteA = clientes.find(c => c.id === a.clienteId);
    const clienteB = clientes.find(c => c.id === b.clienteId);
    const aNum = clienteA?.numeroContrato || "";
    const bNum = clienteB?.numeroContrato || "";
    return aNum.localeCompare(bNum, undefined, { numeric: true });
  });

  // Calculate monthly status (case-insensitive comparison for compatibility)
  const faturasDoMes = faturas.filter((f) => f.mesReferencia.toUpperCase() === currentMonth.toUpperCase());
  const clientesComFatura = new Set(faturasDoMes.map((f) => f.clienteId));
  const clientesSemFatura = clientesOrdenados.filter((c) => !clientesComFatura.has(c.id));
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
          {!isOperador && (
            <TabsTrigger value="relatorios" className="gap-2">
              <BarChart3 className="h-4 w-4" />
              Relatórios
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="faturas" className="space-y-4">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <h3 className="text-lg font-medium">Faturas da Usina</h3>
              <Button asChild>
                <Link href="/faturas/upload">
                  <Upload className="h-4 w-4 mr-2" />
                  Importar
                </Link>
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground whitespace-nowrap">Filtrar por mês:</span>
              <MonthPicker
                value={selectedFaturasMonth}
                onChange={setSelectedFaturasMonth}
                placeholder="Selecione o mês"
                allowAll={true}
              />
            </div>
          </div>

          {loadingFaturas ? (
            <Skeleton className="h-64 w-full" />
          ) : faturas.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  Nenhuma fatura encontrada
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Contrato</TableHead>
                    <TableHead>UC</TableHead>
                    <TableHead>Mês Ref.</TableHead>
                    <TableHead className="text-right">Consumo SCEE</TableHead>
                    <TableHead className="text-right">Valor c/ Desconto</TableHead>
                    {!isOperador && <TableHead className="text-right">Lucro</TableHead>}
                    <TableHead>Fatura Concessionária</TableHead>
                    <TableHead>Fatura c/ Desconto</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {faturasOrdenadas.slice(0, 50).map((fatura) => {
                    const hasUpload = !!fatura.arquivoPdfUrl;
                    const isPaidToConcessionaria = fatura.status === "pago" || fatura.status === "pagamento_pendente_confirmacao";
                    const faturaClienteGerada = !!fatura.faturaClienteGeradaAt;
                    const faturaClienteEnviada = !!fatura.faturaClienteEnviadaAt;
                    const faturaClienteRecebida = !!fatura.faturaClienteRecebidaAt;
                    const isUsoProprio = !fatura.cliente?.isPagante;

                    return (
                    <TableRow key={fatura.id}>
                      <TableCell>{fatura.cliente?.nome || "-"}</TableCell>
                      <TableCell className="font-mono text-sm">
                        {fatura.cliente?.numeroContrato || "-"}
                      </TableCell>
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
                      {!isOperador && (
                        <TableCell className="text-right font-mono text-green-600">
                          {formatCurrency(fatura.lucro)}
                        </TableCell>
                      )}
                      <TableCell>
                        {isPaidToConcessionaria ? (
                          <Badge variant="default" className="bg-green-600">
                            Pago
                          </Badge>
                        ) : hasUpload ? (
                          <Badge variant="default" className="bg-blue-600">
                            Aguardando Pagamento
                          </Badge>
                        ) : (
                          <Badge variant="secondary">
                            Sem Upload
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {isUsoProprio ? (
                          <Badge variant="outline">Não aplicável</Badge>
                        ) : faturaClienteRecebida ? (
                          <Badge variant="default" className="bg-green-600">
                            Recebida
                          </Badge>
                        ) : faturaClienteEnviada ? (
                          <Badge variant="default" className="bg-blue-600">
                            Enviada
                          </Badge>
                        ) : faturaClienteGerada ? (
                          <Badge variant="default" className="bg-amber-600">
                            Gerada
                          </Badge>
                        ) : (
                          <Badge variant="secondary">
                            Pendente
                          </Badge>
                        )}
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
                    );
                  })}
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
                    <TableHead>Contrato</TableHead>
                    <TableHead>UC</TableHead>
                    <TableHead>Desconto</TableHead>
                    <TableHead>Pagante</TableHead>
                    <TableHead>Status Mês</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clientesOrdenados.map((cliente) => {
                    const temFaturaMes = clientesComFatura.has(cliente.id);
                    return (
                      <TableRow key={cliente.id}>
                        <TableCell className="font-medium">{cliente.nome}</TableCell>
                        <TableCell className="font-mono text-sm">
                          {cliente.numeroContrato || "-"}
                        </TableCell>
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

        {!isOperador && (
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
                      <TableHead>Contrato</TableHead>
                      <TableHead className="text-right">Faturas</TableHead>
                      <TableHead className="text-right">Total Pago</TableHead>
                      <TableHead className="text-right">Economia</TableHead>
                      {!isOperador && <TableHead className="text-right">Lucro</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {clientesOrdenados.map((cliente) => {
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
                          <TableCell className="font-mono text-sm">
                            {cliente.numeroContrato || "-"}
                          </TableCell>
                          <TableCell className="text-right">{clienteFaturas.length}</TableCell>
                          <TableCell className="text-right font-mono">
                            {formatCurrency(totalPago)}
                          </TableCell>
                          <TableCell className="text-right font-mono text-blue-600">
                            {formatCurrency(totalEconomia)}
                          </TableCell>
                          {!isOperador && (
                            <TableCell className="text-right font-mono text-green-600">
                              {formatCurrency(totalLucro)}
                            </TableCell>
                          )}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
          </TabsContent>
        )}
      </Tabs>
      
      <Dialog open={!!editingFatura} onOpenChange={(open) => !open && setEditingFatura(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Editar Fatura</DialogTitle>
            <DialogDescription>
              Edite os dados da fatura de {editingFatura?.cliente?.nome || "cliente"} - {editingFatura?.mesReferencia}
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="max-h-[55vh] pr-4">
            <TooltipProvider>
              <div className="space-y-6">
                {FIELD_CATEGORIES.map((category) => (
                  <div key={category.name} className="space-y-3">
                    <h4 className={cn(
                      "font-medium text-sm uppercase tracking-wide px-2 py-1 rounded-md border",
                      category.bgClass,
                      category.borderClass,
                      category.textClass
                    )}>
                      {category.name}
                    </h4>
                    <div className="grid gap-3 md:grid-cols-2 pl-2">
                      {category.fields.map(({ key, label, readonly, formula }) => (
                        <div key={key} className="space-y-2">
                          <div className="flex items-center gap-2">
                            <Label htmlFor={`edit-${key}`} className="text-sm">
                              {label}
                            </Label>
                            {(readonly && formula) && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Info className="h-3.5 w-3.5 text-muted-foreground/60 cursor-help" />
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p className="text-xs">{formula}</p>
                                </TooltipContent>
                              </Tooltip>
                            )}
                          </div>
                          <Input
                            id={`edit-${key}`}
                            value={editFormData[key] || ""}
                            onChange={(e) => handleEditFieldChange(key, e.target.value)}
                            className={cn(readonly && "bg-muted")}
                            disabled={readonly}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}

                {/* Status fields */}
                <div className="space-y-4 pt-2 border-t">
                  {/* Fatura da Concessionária */}
                  <div className="space-y-3">
                    <h4 className="font-medium text-sm uppercase tracking-wide px-2 py-1 rounded-md border bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300">
                      Fatura da Concessionária
                    </h4>
                    <div className="space-y-2 pl-2">
                      <Label htmlFor="edit-status">Status de Pagamento</Label>
                      <Select
                        value={editFormData.status || "pendente"}
                        onValueChange={(value) => handleEditFieldChange("status", value)}
                      >
                        <SelectTrigger id="edit-status">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pendente">Pendente</SelectItem>
                          <SelectItem value="pagamento_pendente_confirmacao">Pagamento Pendente Confirmação</SelectItem>
                          <SelectItem value="pago">Pago</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Fatura com Desconto - apenas para clientes pagantes */}
                  {editingFatura?.cliente?.isPagante && (
                    <div className="space-y-3">
                      <h4 className="font-medium text-sm uppercase tracking-wide px-2 py-1 rounded-md border bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800 text-green-700 dark:text-green-300">
                        Fatura com Desconto
                      </h4>
                      <div className="space-y-2 pl-2">
                        <Label htmlFor="edit-statusFaturaDesconto">Status da Fatura</Label>
                        <Select
                          value={editFormData.statusFaturaDesconto || "pendente"}
                          onValueChange={(value) => handleEditFieldChange("statusFaturaDesconto", value)}
                        >
                          <SelectTrigger id="edit-statusFaturaDesconto">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pendente">Pendente</SelectItem>
                            <SelectItem value="gerada">Gerada</SelectItem>
                            <SelectItem value="enviada">Enviada ao Cliente</SelectItem>
                            <SelectItem value="recebida">Pagamento Recebido</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </TooltipProvider>
          </ScrollArea>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <div className="flex-1 flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleRecalculate}
                className="gap-2"
              >
                <Calculator className="h-4 w-4" />
                Recalcular Valores
              </Button>
              {precoKwhInfo && (
                <div className={cn(
                  "flex items-center gap-1 text-xs px-2 py-1 rounded-md border",
                  precoKwhInfo.usandoFallback
                    ? "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300"
                    : "bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800 text-green-700 dark:text-green-300"
                )}>
                  {precoKwhInfo.usandoFallback && "⚠️ "}
                  Preço: R$ {parseFloat(precoKwhInfo.valor).toFixed(4)}/kWh
                  {precoKwhInfo.usandoFallback && ` (${precoKwhInfo.mesOrigem})`}
                </div>
              )}
            </div>
            <div className="flex gap-2">
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
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
