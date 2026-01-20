import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { UsinaSection } from "@/components/usina-section";
import { useToast } from "@/hooks/use-toast";
import {
  Upload,
  Loader2,
  CheckCircle,
  Clock,
  AlertCircle,
  FileText,
  Save,
  X,
  Calculator,
  Info,
} from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Fatura, Cliente, Usina } from "@shared/schema";
import { formatCurrency, parseToNumber, formatNumber, getCurrentMonthRef, normalizeMonth, cn } from "@/lib/utils";
import { MonthPicker } from "@/components/month-picker";

interface FaturaWithCliente extends Fatura {
  cliente?: Cliente;
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

function getRecentMonths(count = 12): string[] {
  const months = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];
  const result = [];
  const now = new Date();

  // Start from next month
  let currentMonth = now.getMonth() + 1;
  let currentYear = now.getFullYear();

  if (currentMonth > 11) {
    currentMonth = 0;
    currentYear++;
  }

  for (let i = 0; i < count; i++) {
    result.push(`${months[currentMonth]}/${currentYear}`);
    currentMonth--;
    if (currentMonth < 0) {
      currentMonth = 11;
      currentYear--;
    }
  }
  return result;
}

export default function FaturasNewPage() {
  const { toast } = useToast();

  const [selectedMonth, setSelectedMonth] = useState<string>(getCurrentMonthRef()); // Iniciar com o mês atual
  const [selectedUsinaId, setSelectedUsinaId] = useState<string>("all");
  const [editingFatura, setEditingFatura] = useState<FaturaWithCliente | null>(null);
  const [editFormData, setEditFormData] = useState<Record<string, string>>({});

  const { data: usinas = [] } = useQuery<Usina[]>({
    queryKey: ["/api/usinas"],
  });

  const { data: clientes = [] } = useQuery<Cliente[]>({
    queryKey: ["/api/clientes"],
  });

  // O backend já faz o filtro por mês e usina, então não precisamos filtrar novamente no frontend
  const { data: faturas = [], isLoading, refetch } = useQuery<FaturaWithCliente[]>({
    queryKey: ["/api/faturas", selectedUsinaId, selectedMonth],
    queryFn: () => {
      const url = `/api/faturas?usinaId=${selectedUsinaId !== "all" ? selectedUsinaId : ""}&mesReferencia=${selectedMonth !== "all" ? selectedMonth : ""}`;
      return apiRequest("GET", url).then(r => r.json());
    }
  });

  const editFaturaMutation = useMutation({
    mutationFn: async (data: { id: string; updates: Record<string, any> }) => {
      const response = await apiRequest("PATCH", `/api/faturas/${data.id}`, data.updates);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/faturas"] });
      toast({ title: "Fatura atualizada!", description: "As alterações foram salvas com sucesso." });
      setEditingFatura(null);
      setEditFormData({});
      refetch();
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    }
  });

  const handleEditFatura = (fatura: FaturaWithCliente) => {
    setEditingFatura(fatura);

    // Calculate Fio B from existing values (use toFixed for number input)
    const consumoScee = parseToNumber(fatura.consumoScee || "0");
    const precoFioB = parseToNumber(fatura.precoFioB || "0");
    const fioBCalculado = consumoScee * precoFioB;

    // Populate form with current values
    setEditFormData({
      cpfCnpj: fatura.dadosExtraidos?.cpfCnpj || "",
      nomeCliente: fatura.dadosExtraidos?.nomeCliente || "",
      endereco: fatura.dadosExtraidos?.endereco || "",
      unidadeConsumidora: fatura.dadosExtraidos?.unidadeConsumidora || "",
      mesReferencia: fatura.mesReferencia || "",
      dataVencimento: fatura.dataVencimento || "",
      leituraAnterior: fatura.dadosExtraidos?.leituraAnterior || "",
      leituraAtual: fatura.dadosExtraidos?.leituraAtual || "",
      quantidadeDias: fatura.dadosExtraidos?.quantidadeDias || "",
      consumoKwh: fatura.dadosExtraidos?.consumoKwh || "",
      consumoScee: fatura.consumoScee || "",
      consumoNaoCompensado: fatura.consumoNaoCompensado || "",
      energiaInjetada: fatura.energiaInjetada || "",
      precoKwhNaoCompensado: fatura.dadosExtraidos?.precoKwhNaoCompensado || "",
      precoFioB: fatura.precoFioB || "",
      fioB: fioBCalculado.toFixed(2),
      precoAdcBandeira: fatura.precoAdcBandeira || "",
      contribuicaoIluminacao: fatura.contribuicaoIluminacao || "",
      valorTotal: fatura.valorTotal || "",
      saldoKwh: fatura.saldoKwh || "",
      cicloGeracao: fatura.dadosExtraidos?.cicloGeracao || "",
      ucGeradora: fatura.dadosExtraidos?.ucGeradora || "",
      geracaoUltimoCiclo: fatura.dadosExtraidos?.geracaoUltimoCiclo || "",
      valorSemDesconto: fatura.valorSemDesconto || "",
      valorComDesconto: fatura.valorComDesconto || "",
      economia: fatura.economia || "",
      lucro: fatura.lucro || "",
      precoKwh: fatura.precoKwh || "",
    });
  };

  const handleSaveEdit = () => {
    if (!editingFatura) return;

    const updates = {
      mesReferencia: normalizeMonth(editFormData.mesReferencia), // Normalizar para MAIÚSCULO
      dataVencimento: editFormData.dataVencimento,
      consumoScee: editFormData.consumoScee,
      consumoNaoCompensado: editFormData.consumoNaoCompensado,
      energiaInjetada: editFormData.energiaInjetada,
      precoKwh: editFormData.precoKwh,
      precoFioB: editFormData.precoFioB,
      precoAdcBandeira: editFormData.precoAdcBandeira,
      contribuicaoIluminacao: editFormData.contribuicaoIluminacao,
      valorTotal: editFormData.valorTotal,
      valorSemDesconto: editFormData.valorSemDesconto,
      valorComDesconto: editFormData.valorComDesconto,
      economia: editFormData.economia,
      lucro: editFormData.lucro,
      saldoKwh: editFormData.saldoKwh,
    };

    editFaturaMutation.mutate({ id: editingFatura.id, updates });
  };

  const updateEditFormField = (field: string, value: string) => {
    setEditFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleRecalculate = () => {
    if (!editingFatura?.cliente) return;

    const consumoScee = parseToNumber(editFormData.consumoScee || "0");
    const precoKwh = parseToNumber(editFormData.precoKwh || "0");
    const valorTotal = parseToNumber(editFormData.valorTotal || "0");
    const precoFioB = parseToNumber(editFormData.precoFioB || "0");

    console.log("=== RECÁLCULO ===");
    console.log("Consumo SCEE:", consumoScee);
    console.log("Preço kWh:", precoKwh);
    console.log("Valor Total:", valorTotal);
    console.log("Preço Fio B:", precoFioB);

    // Calculate Fio B
    const fioBValor = consumoScee * precoFioB;

    // Calculate valorSemDesconto
    const valorSemDesconto = (consumoScee * precoKwh) + valorTotal - fioBValor;

    let valorComDesconto: number;
    let economia: number;
    let lucro: number;

    // Check if client is paying customer or own use (uso próprio)
    if (!editingFatura.cliente.isPagante) {
      // Cliente de uso próprio (não pagante):
      valorComDesconto = 0;
      economia = 0;
      lucro = -valorTotal;
      console.log(`Cliente ${editingFatura.cliente.nome} é USO PRÓPRIO - sem receita, lucro = -${valorTotal.toFixed(2)}`);
    } else {
      // Cliente pagante - cálculo normal com desconto
      const clientDiscount = parseFloat(editingFatura.cliente.desconto || "0");
      const discountMultiplier = 1 - (clientDiscount / 100);
      valorComDesconto = ((consumoScee * precoKwh) * discountMultiplier) + valorTotal - fioBValor;
      economia = valorSemDesconto - valorComDesconto;
      lucro = valorComDesconto - valorTotal;
      console.log(`Cliente ${editingFatura.cliente.nome} PAGANTE - ${clientDiscount}% desconto`);
    }

    console.log("Fio B:", fioBValor);
    console.log("Valor Sem Desconto:", valorSemDesconto);
    console.log("Valor Com Desconto:", valorComDesconto);
    console.log("Economia:", economia);
    console.log("Lucro:", lucro);
    console.log("================");

    // Update form with recalculated values (use toFixed for number inputs)
    setEditFormData(prev => ({
      ...prev,
      fioB: fioBValor.toFixed(2),
      valorSemDesconto: valorSemDesconto.toFixed(2),
      valorComDesconto: valorComDesconto.toFixed(2),
      economia: economia.toFixed(2),
      lucro: lucro.toFixed(2),
    }));

    toast({
      title: "Recalculado!",
      description: "Os campos foram recalculados com sucesso.",
    });
  };

  // Filter usinas based on selection
  const filteredUsinas = selectedUsinaId === "all"
    ? usinas
    : usinas.filter(u => u.id === selectedUsinaId);

  // Calculate overall statistics
  const totalClientes = clientes.length;
  const totalFaturas = faturas.length;

  const faturasCompletas = faturas.filter(f => {
    const hasUpload = !!f.arquivoPdfUrl;
    const isPaid = f.status === "pago";
    const cliente = clientes.find(c => c.id === f.clienteId);

    if (cliente?.isPagante) {
      return hasUpload && isPaid && f.faturaClienteRecebidaAt;
    } else {
      return hasUpload && isPaid;
    }
  }).length;

  const faturasPendentes = faturas.filter(f => {
    const hasUpload = !!f.arquivoPdfUrl;
    const isPaid = f.status === "pago";
    const cliente = clientes.find(c => c.id === f.clienteId);

    if (cliente?.isPagante) {
      return !hasUpload || !isPaid || !f.faturaClienteRecebidaAt;
    } else {
      return !hasUpload || !isPaid;
    }
  }).length;

  const valorTotal = faturas.reduce((sum, f) => sum + parseFloat(String(f.valorTotal || 0)), 0);

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Faturas"
        description="Gerencie as faturas de energia dos seus clientes de forma organizada por usina"
        actions={
          <Button asChild>
            <Link href="/faturas/upload">
              <Upload className="h-4 w-4 mr-2" />
              Upload Faturas
            </Link>
          </Button>
        }
      />

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row items-center gap-4">
            <div className="flex items-center gap-2 w-full md:w-auto">
              <span className="text-sm font-medium whitespace-nowrap">Mês:</span>
              <div className="flex gap-2">
                {selectedMonth === "all" ? (
                  <Button
                    variant="outline"
                    onClick={() => setSelectedMonth(getCurrentMonthRef())}
                  >
                    Selecionar mês
                  </Button>
                ) : (
                  <MonthPicker
                    value={selectedMonth}
                    onChange={setSelectedMonth}
                    placeholder="Selecione o mês"
                  />
                )}
                {selectedMonth !== "all" && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedMonth("all")}
                  >
                    Limpar
                  </Button>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto">
              <span className="text-sm font-medium whitespace-nowrap">Usina:</span>
              <Select value={selectedUsinaId} onValueChange={setSelectedUsinaId}>
                <SelectTrigger className="w-[200px] bg-background">
                  <SelectValue placeholder="Todas as Usinas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as Usinas</SelectItem>
                  {usinas.map((usina) => (
                    <SelectItem key={usina.id} value={usina.id}>
                      {usina.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedMonth !== "all" && (
              <Badge variant="outline" className="ml-auto">
                Visualizando: {selectedMonth}
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Summary Statistics */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total de Faturas</p>
                <p className="text-2xl font-bold">{totalFaturas}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-500/10 text-green-600 dark:text-green-400">
                <CheckCircle className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Completas</p>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">{faturasCompletas}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-500/10 text-orange-600 dark:text-orange-400">
                <Clock className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Pendentes</p>
                <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">{faturasPendentes}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Clientes</p>
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{totalClientes}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Usinas sections */}
      <div className="space-y-4">
        {isLoading ? (
          <Card>
            <CardContent className="p-12 flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </CardContent>
          </Card>
        ) : filteredUsinas.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                Nenhuma usina cadastrada. Cadastre uma usina para começar.
              </p>
            </CardContent>
          </Card>
        ) : (
          filteredUsinas.map((usina) => {
            const usinaFaturas = faturas.filter(f => {
              const cliente = clientes.find(c => c.id === f.clienteId);
              return cliente?.usinaId === usina.id;
            });

            const usinaClientes = clientes.filter(c => c.usinaId === usina.id);

            return (
              <UsinaSection
                key={usina.id}
                usina={usina}
                faturas={usinaFaturas}
                clientes={usinaClientes}
                onRefresh={refetch}
                onEditFatura={handleEditFatura}
              />
            );
          })
        )}
      </div>

      {/* Empty state */}
      {!isLoading && filteredUsinas.length > 0 && faturas.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-lg font-medium mb-2">Nenhuma fatura encontrada</p>
            <p className="text-muted-foreground mb-4">
              {selectedMonth !== "all"
                ? `Não há faturas para o mês de ${selectedMonth}.`
                : "Não há faturas cadastradas."}
            </p>
            <Button asChild>
              <Link href="/faturas/upload">
                <Upload className="h-4 w-4 mr-2" />
                Fazer Upload de Faturas
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Edit Modal */}
      <Dialog open={!!editingFatura} onOpenChange={(open) => !open && setEditingFatura(null)}>
        <DialogContent className="max-w-7xl h-[95vh] flex flex-col p-0">
          <DialogHeader className="p-6 pb-4 border-b">
            <DialogTitle>Editar Fatura</DialogTitle>
            <p className="text-sm text-muted-foreground">
              Cliente: {editingFatura?.cliente?.nome || "N/A"} • UC: {editingFatura?.cliente?.unidadeConsumidora || "N/A"}
            </p>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-4 p-6 flex-1 overflow-hidden">
            {/* Left side - Form */}
            <ScrollArea className="h-full pr-4">
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
                              <Label>{label}</Label>
                              {readonly && formula && (
                                <Tooltip>
                                  <TooltipTrigger>
                                    <Info className="h-3 w-3 text-muted-foreground" />
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p className="text-xs">{formula}</p>
                                  </TooltipContent>
                                </Tooltip>
                              )}
                            </div>
                            <Input
                              type="text"
                              placeholder={`Ex: 100,00`}
                              value={editFormData[key] || ""}
                              onChange={(e) => updateEditFormField(key, e.target.value)}
                              disabled={readonly}
                              className={readonly ? "bg-muted" : ""}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}

                  <Button
                    type="button"
                    variant="secondary"
                    onClick={handleRecalculate}
                    className="w-full"
                  >
                    <Calculator className="h-4 w-4 mr-2" />
                    Recalcular Valores
                  </Button>
                </div>
              </TooltipProvider>
            </ScrollArea>

            {/* Right side - PDF Preview */}
            <div className="border rounded-lg overflow-hidden bg-muted/30">
              {editingFatura?.arquivoPdfUrl ? (
                <iframe
                  src={editingFatura.arquivoPdfUrl}
                  className="w-full h-full"
                  title="PDF Preview"
                />
              ) : (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
                    <p className="text-muted-foreground">Nenhum PDF disponível</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="p-6 pt-4 border-t">
            <Button variant="outline" onClick={() => setEditingFatura(null)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveEdit} disabled={editFaturaMutation.isPending}>
              {editFaturaMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Salvar Alterações
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
