import { useState, useCallback, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import {
  Upload,
  FileText,
  X,
  CheckCircle,
  AlertCircle,
  Loader2,
  Eye,
  Check,
  Calculator,
  Info,
} from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Cliente, Usina } from "@shared/schema";
import { cn, parseToNumber, formatNumber } from "@/lib/utils";

interface ExtractedData {
  success: boolean;
  fileName?: string;
  fileUrl?: string;
  filePath?: string;
  extractionErrors?: string[];
  cpfCnpj?: string;
  nomeCliente?: string;
  endereco?: string;
  unidadeConsumidora?: string;
  mesReferencia?: string;
  dataVencimento?: string;
  leituraAnterior?: string;
  leituraAtual?: string;
  quantidadeDias?: string;
  consumoKwh?: string;
  consumoScee?: string;
  consumoNaoCompensado?: string;
  energiaInjetada?: string;
  precoEnergiaInjetada?: string;
  precoEnergiaCompensada?: string;
  precoKwhNaoCompensado?: string;
  precoFioB?: string;
  precoAdcBandeira?: string;
  contribuicaoIluminacao?: string;
  valorTotal?: string;
  saldoKwh?: string;
  cicloGeracao?: string;
  ucGeradora?: string;
  geracaoUltimoCiclo?: string;
  valorSemDesconto?: number | string;
  valorComDesconto?: number | string;
  economia?: number | string;
  lucro?: number | string;
  precoKwhUsado?: number | string;
  descontoUsado?: number | string;
  fioB?: number | string;
}

interface UploadedFile {
  file: File;
  status: "pending" | "uploading" | "success" | "error";
  error?: string;
  extractedData?: ExtractedData;
}

const FIELD_CONFIG: {
  key: keyof ExtractedData | "fioB";
  label: string;
  type: "text" | "number";
  readonly?: boolean;
  formula?: string;
}[] = [
  { key: "cpfCnpj", label: "CPF/CNPJ", type: "text" },
  { key: "nomeCliente", label: "Nome do Cliente", type: "text" },
  { key: "endereco", label: "Endereço", type: "text" },
  { key: "unidadeConsumidora", label: "Unidade Consumidora", type: "text" },
  { key: "mesReferencia", label: "Mês de Referência", type: "text" },
  { key: "dataVencimento", label: "Data de Vencimento", type: "text" },
  { key: "leituraAnterior", label: "Leitura Anterior", type: "text" },
  { key: "leituraAtual", label: "Leitura Atual", type: "text" },
  { key: "quantidadeDias", label: "Quantidade de Dias", type: "text" },
  { key: "consumoKwh", label: "Consumo Total (kWh)", type: "text" },
  { key: "consumoScee", label: "Consumo SCEE (kWh)", type: "text" },
  { key: "consumoNaoCompensado", label: "Consumo Não Compensado (kWh)", type: "text" },
  { key: "precoKwhNaoCompensado", label: "Preço kWh Não Compensado (R$)", type: "text" },
  { key: "precoFioB", label: "Preço Fio B (R$)", type: "text" },
  {
    key: "fioB",
    label: "Fio B (R$)",
    type: "text",
    readonly: true,
    formula: "Consumo SCEE × Preço Fio B"
  },
  { key: "precoAdcBandeira", label: "Preço ADC Bandeira (R$)", type: "text" },
  { key: "contribuicaoIluminacao", label: "Contribuição Iluminação Pública (R$)", type: "text" },
  { key: "valorTotal", label: "Valor Total Fatura (R$)", type: "text" },
  { key: "saldoKwh", label: "Saldo (kWh)", type: "text" },
  { key: "cicloGeracao", label: "Ciclo de Geração", type: "text" },
  { key: "ucGeradora", label: "UC Geradora", type: "text" },
  { key: "geracaoUltimoCiclo", label: "Geração Último Ciclo (kWh)", type: "text" },
  {
    key: "valorSemDesconto",
    label: "Valor Sem Desconto (R$)",
    type: "text",
    readonly: true,
    formula: "(Consumo SCEE × Preço kWh) + Valor Total - Fio B"
  },
  {
    key: "valorComDesconto",
    label: "Valor Com Desconto (R$)",
    type: "text",
    readonly: true,
    formula: "((Consumo SCEE × Preço kWh) × (1 - Desconto%)) + Valor Total - Fio B"
  },
  {
    key: "economia",
    label: "Economia (R$)",
    type: "text",
    readonly: true,
    formula: "Valor Sem Desconto - Valor Com Desconto"
  },
  {
    key: "lucro",
    label: "Lucro Estimado (R$)",
    type: "text",
    readonly: true,
    formula: "Valor Com Desconto - Valor Total"
  },
];

export default function FaturasUploadPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [selectedUsinaId, setSelectedUsinaId] = useState<string>("");
  const [precoKwh, setPrecoKwh] = useState<string>("1.20");
  const [isDragging, setIsDragging] = useState(false);
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [pdfUrl, setPdfUrl] = useState<string>("");
  const [selectedClienteId, setSelectedClienteId] = useState<string>("");
  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false);
  const [duplicateInfo, setDuplicateInfo] = useState<any>(null);
  const [pendingConfirmData, setPendingConfirmData] = useState<any>(null);

  const { data: usinas = [] } = useQuery<Usina[]>({
    queryKey: ["/api/usinas"],
  });

  const { data: clientes = [] } = useQuery<Cliente[]>({
    queryKey: ["/api/clientes"],
  });

  const filteredClientes = clientes.filter((c) => c.usinaId === selectedUsinaId);
  const selectedUsina = usinas.find((u) => u.id === selectedUsinaId);
  const selectedCliente = clientes.find((c) => c.id === selectedClienteId);

  const extractMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("precoKwh", precoKwh);
      formData.append("desconto", selectedUsina?.descontoPadrao || "25");

      const response = await fetch("/api/faturas/extract", {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Erro ao extrair dados");
      }

      return response.json();
    },
    onSuccess: (data: ExtractedData) => {
      const initialFormData: Record<string, string> = {};
      FIELD_CONFIG.forEach(({ key }) => {
        const value = data[key];
        initialFormData[key] = value !== null && value !== undefined ? String(value) : "";
      });
      // Garantir que o preço do kWh usado na extração siga para a confirmação
      initialFormData["precoKwhUsado"] = String(
        data.precoKwhUsado !== undefined && data.precoKwhUsado !== null
          ? data.precoKwhUsado
          : precoKwh
      );
      setFormData(initialFormData);
      setPdfUrl(data.fileUrl || "");
      
      const matchedCliente = filteredClientes.find(
        (c) => c.unidadeConsumidora === data.unidadeConsumidora
      );
      if (matchedCliente) {
        setSelectedClienteId(matchedCliente.id);
      } else {
        setSelectedClienteId("");
      }
      
      setShowVerificationModal(true);
    },
    onError: (error: Error) => {
      toast({
        title: "Erro na extração",
        description: error.message,
        variant: "destructive",
      });
      setFiles((prev) =>
        prev.map((f) => ({ ...f, status: "error" as const }))
      );
    },
  });

  const confirmMutation = useMutation({
    mutationFn: async (data: { extractedData: Record<string, string>; clienteId: string; fileUrl: string; forceReplace?: boolean }) => {
      const normalizedData: Record<string, string> = {};

      const numericFields = [
        "consumoKwh", "consumoScee", "consumoNaoCompensado", "energiaInjetada",
        "precoEnergiaInjetada", "precoEnergiaCompensada", "precoKwhNaoCompensado",
        "precoFioB", "precoAdcBandeira", "contribuicaoIluminacao", "valorTotal",
        "saldoKwh", "geracaoUltimoCiclo", "valorSemDesconto", "valorComDesconto",
        "economia", "lucro", "leituraAnterior", "leituraAtual", "quantidadeDias",
        "precoKwhUsado"
      ];

      Object.entries(data.extractedData).forEach(([key, value]) => {
        if (numericFields.includes(key)) {
          const num = parseToNumber(value);
          normalizedData[key] = isNaN(num) ? "0.00" : num.toFixed(2);
        } else {
          normalizedData[key] = value;
        }
      });

      // Use fetch directly to handle 409 conflicts without throwing
      const response = await fetch("/api/faturas/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          extractedData: { ...normalizedData, fileUrl: data.fileUrl },
          clienteId: data.clienteId,
          forceReplace: data.forceReplace || false,
        }),
        credentials: "include",
      });

      // Check if response is conflict (409)
      if (!response.ok) {
        const errorData = await response.json();
        if (response.status === 409 && errorData.conflict) {
          throw { conflict: true, data: errorData };
        }
        throw new Error(errorData.message || "Erro ao salvar fatura");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/faturas"] });
      toast({
        title: "Fatura salva!",
        description: "Os dados foram salvos com sucesso.",
      });
      setShowVerificationModal(false);
      setFormData({});
      setPdfUrl("");
      setFiles([]);
      setSelectedClienteId("");
      setPendingConfirmData(null);
    },
    onError: (error: any) => {
      if (error.conflict) {
        // Show duplicate confirmation dialog
        setDuplicateInfo(error.data.existingFatura);
        setShowDuplicateDialog(true);
      } else {
        toast({
          title: "Erro ao salvar",
          description: error.message || "Ocorreu um erro ao salvar a fatura.",
          variant: "destructive",
        });
      }
    },
  });

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFiles = Array.from(e.dataTransfer.files).filter(
      (file) => file.type === "application/pdf"
    );
    if (droppedFiles.length > 0) {
      setFiles(droppedFiles.map(file => ({ file, status: "pending" as const })));
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const fileArray = Array.from(e.target.files);
      setFiles(fileArray.map(file => ({ file, status: "pending" as const })));
    }
  };

  const removeFile = () => {
    setFiles([]);
  };

  const handleExtract = async () => {
    if (files.length === 0) {
      toast({
        title: "Selecione um arquivo",
        description: "Adicione pelo menos um arquivo PDF para continuar.",
        variant: "destructive",
      });
      return;
    }

    if (!selectedUsinaId) {
      toast({
        title: "Selecione a usina",
        description: "Escolha uma usina antes de fazer o upload.",
        variant: "destructive",
      });
      return;
    }

    setFiles((prev) =>
      prev.map((f) => ({ ...f, status: "uploading" as const }))
    );

    // Process all files
    files.forEach((fileObj) => {
      extractMutation.mutate(fileObj.file);
    });
  };

  const handleFieldChange = (key: string, value: string) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  // Function to recalculate all calculated fields based on current form values
  const handleRecalculate = () => {
    if (!selectedClienteId || !selectedCliente) {
      toast({
        title: "Selecione um cliente",
        description: "É necessário selecionar um cliente antes de recalcular.",
        variant: "destructive",
      });
      return;
    }

    // Get values from form - using setFormData callback to ensure we get the latest values
    setFormData((currentFormData) => {
      // Get values from current form state
      const consumoScee = parseToNumber(currentFormData.consumoScee || "0");
      const precoKwhUsado = parseToNumber(currentFormData.precoKwhUsado || precoKwh);
      const valorTotal = parseToNumber(currentFormData.valorTotal || "0");
      const precoFioB = parseToNumber(currentFormData.precoFioB || "0");

      console.log("=== RECÁLCULO ===");
      console.log("Consumo SCEE:", consumoScee);
      console.log("Preço kWh:", precoKwhUsado);
      console.log("Valor Total:", valorTotal);
      console.log("Preço Fio B:", precoFioB);

      // Calculate Fio B
      const fioBValor = consumoScee * precoFioB;

      // Calculate valorSemDesconto
      const valorSemDesconto = (consumoScee * precoKwhUsado) + valorTotal - fioBValor;

      let valorComDesconto: number;
      let economia: number;
      let lucro: number;

      // Check if client is paying customer or own use (uso próprio)
      if (!selectedCliente.isPagante) {
        // Cliente de uso próprio (não pagante):
        // - Não há receita (valor com desconto = 0)
        // - Não há economia (economia = 0)
        // - Lucro é negativo (custo da concessionária)
        valorComDesconto = 0;
        economia = 0;
        lucro = -valorTotal;
        console.log(`Cliente ${selectedCliente.nome} é USO PRÓPRIO - sem receita, lucro = -${valorTotal.toFixed(2)}`);
      } else {
        // Cliente pagante - cálculo normal com desconto
        const clientDiscount = parseFloat(selectedCliente.desconto || "0");
        const discountMultiplier = 1 - (clientDiscount / 100);
        valorComDesconto = ((consumoScee * precoKwhUsado) * discountMultiplier) + valorTotal - fioBValor;
        economia = valorSemDesconto - valorComDesconto;
        lucro = valorComDesconto - valorTotal;
        console.log(`Cliente ${selectedCliente.nome} PAGANTE - ${clientDiscount}% desconto`);
      }

      console.log("Fio B:", fioBValor);
      console.log("Valor Sem Desconto:", valorSemDesconto);
      console.log("Valor Com Desconto:", valorComDesconto);
      console.log("Economia:", economia);
      console.log("Lucro:", lucro);
      console.log("================");

      // Return updated form data with recalculated values
      return {
        ...currentFormData,
        fioB: formatNumber(fioBValor),
        valorSemDesconto: formatNumber(valorSemDesconto),
        valorComDesconto: formatNumber(valorComDesconto),
        economia: formatNumber(economia),
        lucro: formatNumber(lucro),
      };
    });

    toast({
      title: "Recalculado!",
      description: "Os campos foram recalculados com sucesso.",
    });
  };

  // Auto-recalculate values when client is selected
  useEffect(() => {
    if (selectedClienteId && selectedCliente && formData.consumoScee) {
      handleRecalculate();
    }
  }, [selectedClienteId, selectedCliente]);

  const handleConfirm = () => {
    if (!selectedClienteId) {
      toast({
        title: "Selecione o cliente",
        description: "Escolha o cliente para vincular esta fatura.",
        variant: "destructive",
      });
      return;
    }

    const confirmData = {
      extractedData: formData,
      clienteId: selectedClienteId,
      fileUrl: pdfUrl,
    };

    // Store for possible duplicate confirmation
    setPendingConfirmData(confirmData);

    confirmMutation.mutate(confirmData);
  };

  const handleConfirmReplace = () => {
    if (pendingConfirmData) {
      confirmMutation.mutate({
        ...pendingConfirmData,
        forceReplace: true,
      });
      setShowDuplicateDialog(false);
      setDuplicateInfo(null);
    }
  };

  const handleCancelReplace = () => {
    setShowDuplicateDialog(false);
    setDuplicateInfo(null);
    setPendingConfirmData(null);
  };

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Upload de Faturas"
        description="Envie as faturas da concessionária para processamento automático"
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Arquivo PDF</CardTitle>
            </CardHeader>
            <CardContent>
              <div
                className={cn(
                  "border-2 border-dashed rounded-lg p-8 text-center transition-colors",
                  isDragging
                    ? "border-primary bg-primary/5"
                    : "border-muted-foreground/25 hover:border-primary/50"
                )}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-4" />
                <p className="text-lg font-medium mb-2">
                  Arraste os PDFs aqui
                </p>
                <p className="text-sm text-muted-foreground mb-4">
                  ou clique para selecionar os arquivos
                </p>
                <input
                  type="file"
                  accept=".pdf"
                  multiple
                  onChange={handleFileSelect}
                  className="hidden"
                  id="file-upload"
                  data-testid="input-file-upload"
                />
                <Button variant="outline" asChild>
                  <label htmlFor="file-upload" className="cursor-pointer">
                    Selecionar Arquivos
                  </label>
                </Button>
              </div>

              {files.length > 0 && (
                <div className="mt-6 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">
                      {files.length} arquivo{files.length > 1 ? "s" : ""} selecionado{files.length > 1 ? "s" : ""}
                    </p>
                    {files.some(f => f.status === "pending") && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={removeFile}
                        className="h-7 text-xs"
                      >
                        Limpar todos
                      </Button>
                    )}
                  </div>
                  {files.map((fileObj, index) => (
                    <div key={index} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                      <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
                      <span className="flex-1 text-sm truncate">
                        {fileObj.file.name}
                      </span>
                      {fileObj.status === "uploading" && (
                        <Loader2 className="h-4 w-4 animate-spin text-primary" />
                      )}
                      {fileObj.status === "success" && (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      )}
                      {fileObj.status === "error" && (
                        <AlertCircle className="h-4 w-4 text-destructive" />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Configurações</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Usina</Label>
                <Select
                  value={selectedUsinaId}
                  onValueChange={setSelectedUsinaId}
                >
                  <SelectTrigger data-testid="select-upload-usina">
                    <SelectValue placeholder="Selecione a usina" />
                  </SelectTrigger>
                  <SelectContent>
                    {usinas.map((usina) => (
                      <SelectItem key={usina.id} value={usina.id}>
                        {usina.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Preço do kWh (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="Ex: 0.85"
                  value={precoKwh}
                  onChange={(e) => setPrecoKwh(e.target.value)}
                  data-testid="input-preco-kwh"
                />
                <p className="text-xs text-muted-foreground">
                  Preço do kWh no mercado cativo para cálculos.
                </p>
              </div>

              {selectedUsina && (
                <div className="pt-4 border-t">
                  <p className="text-sm text-muted-foreground">
                    Desconto padrão: <strong>{selectedUsina.descontoPadrao}%</strong>
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Clientes: <strong>{filteredClientes.length}</strong>
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <Button
            className="w-full"
            size="lg"
            onClick={handleExtract}
            disabled={
              files.length === 0 ||
              !selectedUsinaId ||
              extractMutation.isPending
            }
            data-testid="button-process-upload"
          >
            {extractMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Extraindo dados...
              </>
            ) : (
              <>
                <Eye className="h-4 w-4 mr-2" />
                Extrair e Verificar
              </>
            )}
          </Button>
        </div>
      </div>

      <Dialog open={showVerificationModal} onOpenChange={setShowVerificationModal}>
        <DialogContent className="max-w-6xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Verificar Dados Extraídos</DialogTitle>
            <DialogDescription>
              Confira e edite os dados extraídos da fatura antes de salvar.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-6 lg:grid-cols-2">
            <ScrollArea className="h-[550px] pr-4">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Vincular ao Cliente</Label>
                  <Select
                    value={selectedClienteId}
                    onValueChange={setSelectedClienteId}
                  >
                    <SelectTrigger data-testid="select-cliente-fatura">
                      <SelectValue placeholder="Selecione o cliente" />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredClientes.map((cliente) => (
                        <SelectItem key={cliente.id} value={cliente.id}>
                          {cliente.nome} (UC: {cliente.unidadeConsumidora})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedCliente && selectedCliente.isPagante && (
                    <div className="mt-2 p-2 rounded-md bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800">
                      <p className="text-sm text-blue-900 dark:text-blue-100">
                        <strong>Desconto aplicado:</strong> {selectedCliente.desconto}%
                        {selectedUsina && parseFloat(selectedCliente.desconto || "0") !== parseFloat(selectedUsina.descontoPadrao || "0") && (
                          <span className="ml-2 text-xs text-blue-700 dark:text-blue-300">
                            (diferente do padrão da usina: {selectedUsina.descontoPadrao}%)
                          </span>
                        )}
                      </p>
                    </div>
                  )}
                  {selectedCliente && !selectedCliente.isPagante && (
                    <div className="mt-2 p-2 rounded-md bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800">
                      <p className="text-sm text-yellow-900 dark:text-yellow-100">
                        <strong>Cliente de uso próprio</strong> - Sem receita (apenas custo da concessionária)
                      </p>
                    </div>
                  )}
                </div>

                <Separator />

                <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
                  Dados Extraídos
                </h4>

                <TooltipProvider>
                  <div className="grid gap-3">
                    {FIELD_CONFIG.map(({ key, label, readonly, formula }) => (
                      <div key={key} className="space-y-1">
                        <div className="flex items-center gap-1">
                          <Label htmlFor={`field-${key}`} className="text-xs text-muted-foreground">
                            {label}
                          </Label>
                          {readonly && formula && (
                            <Tooltip delayDuration={200}>
                              <TooltipTrigger asChild>
                                <Info className="h-3.5 w-3.5 text-muted-foreground/60 hover:text-muted-foreground transition-colors cursor-help" />
                              </TooltipTrigger>
                              <TooltipContent side="right" className="max-w-xs">
                                <p className="text-xs font-mono">{formula}</p>
                              </TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                        <Input
                          id={`field-${key}`}
                          value={formData[key] || ""}
                          onChange={(e) => handleFieldChange(key, e.target.value)}
                          placeholder={`Informe ${label.toLowerCase()}`}
                          className={cn(
                            "h-8 text-sm",
                            readonly && "bg-muted/50 cursor-not-allowed text-muted-foreground"
                          )}
                          readOnly={readonly}
                          disabled={readonly}
                          data-testid={`input-field-${key}`}
                        />
                      </div>
                    ))}
                  </div>
                </TooltipProvider>
              </div>
            </ScrollArea>

            <div className="space-y-4">
              <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
                Visualização do PDF
              </h4>
              {pdfUrl ? (
                <div className="border rounded-lg overflow-hidden h-[520px]">
                  <iframe
                    src={pdfUrl}
                    className="w-full h-full"
                    title="PDF Preview"
                  />
                </div>
              ) : (
                <div className="border rounded-lg h-[520px] flex items-center justify-center bg-muted/50">
                  <p className="text-muted-foreground">PDF não disponível</p>
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="flex justify-between items-center">
            <Button
              variant="secondary"
              onClick={handleRecalculate}
              disabled={!selectedClienteId}
              className="mr-auto"
            >
              <Calculator className="h-4 w-4 mr-2" />
              Recalcular
            </Button>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setShowVerificationModal(false)}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleConfirm}
                disabled={!selectedClienteId || confirmMutation.isPending}
                data-testid="button-confirm-save"
              >
                {confirmMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    Confirmar e Salvar
                  </>
                )}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Duplicate Fatura Confirmation Dialog */}
      <Dialog open={showDuplicateDialog} onOpenChange={setShowDuplicateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Fatura Duplicada Encontrada</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Já existe uma fatura salva para este cliente no mês de referência{" "}
              <strong className="text-foreground">{duplicateInfo?.mesReferencia}</strong>.
            </p>
            {duplicateInfo && (
              <div className="p-4 bg-muted rounded-lg space-y-2">
                <h4 className="font-medium text-sm">Dados da Fatura Existente:</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="text-muted-foreground">Mês:</div>
                  <div className="font-mono">{duplicateInfo.mesReferencia}</div>
                  <div className="text-muted-foreground">Valor Total:</div>
                  <div className="font-mono">R$ {duplicateInfo.valorTotal}</div>
                  <div className="text-muted-foreground">Valor c/ Desconto:</div>
                  <div className="font-mono">R$ {duplicateInfo.valorComDesconto}</div>
                  <div className="text-muted-foreground">Data Vencimento:</div>
                  <div className="font-mono">{duplicateInfo.dataVencimento}</div>
                </div>
              </div>
            )}
            <p className="text-sm text-yellow-600 dark:text-yellow-500 font-medium">
              ⚠️ Se confirmar, os dados anteriores serão substituídos pelos novos dados e a fatura antiga será removida permanentemente.
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={handleCancelReplace}
              disabled={confirmMutation.isPending}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmReplace}
              disabled={confirmMutation.isPending}
            >
              {confirmMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Substituindo...
                </>
              ) : (
                <>Confirmar Substituição</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
