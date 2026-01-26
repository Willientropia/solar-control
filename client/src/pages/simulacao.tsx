import { useState, useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Calculator,
  Info,
  Sparkles,
  User,
  Percent,
  Trash2,
  TrendingUp,
  TrendingDown,
  DollarSign,
} from "lucide-react";
import { authenticatedFetch } from "@/lib/queryClient";
import { cn, parseToNumber, formatNumber } from "@/lib/utils";

interface ExtractedData {
  success: boolean;
  fileName?: string;
  extractionErrors?: string[];
  cpfCnpj?: string;
  nomeCliente?: string;
  endereco?: string;
  unidadeConsumidora?: string;
  mesReferencia?: string;
  dataVencimento?: string;
  consumoKwh?: string;
  consumoScee?: string;
  consumoNaoCompensado?: string;
  energiaInjetada?: string;
  precoFioB?: string;
  precoAdcBandeira?: string;
  contribuicaoIluminacao?: string;
  valorTotal?: string;
  saldoKwh?: string;
}

interface SimulacaoFatura {
  id: string;
  fileName: string;
  extractedData: ExtractedData;
  // Valores calculados da simulação
  consumoTotal: number;
  energiaInjetadaSimulada: number; // consumoNaoCompensado vira energia injetada
  valorSemDesconto: number;
  valorComDesconto: number;
  economia: number;
}

interface UploadedFile {
  file: File;
  status: "pending" | "uploading" | "success" | "error";
  error?: string;
}

// Configuração de campos para exibição
const FIELD_CONFIG = [
  { key: "cpfCnpj", label: "CPF/CNPJ" },
  { key: "nomeCliente", label: "Nome do Cliente" },
  { key: "unidadeConsumidora", label: "Unidade Consumidora" },
  { key: "mesReferencia", label: "Mês de Referência" },
  { key: "dataVencimento", label: "Data de Vencimento" },
  { key: "consumoKwh", label: "Consumo Total (kWh)" },
  { key: "consumoScee", label: "Consumo SCEE (kWh)" },
  { key: "consumoNaoCompensado", label: "Consumo Não Compensado (kWh)" },
  { key: "energiaInjetada", label: "Energia Injetada Original (kWh)" },
  { key: "precoFioB", label: "Preço Fio B (R$)" },
  { key: "contribuicaoIluminacao", label: "Contribuição Iluminação (R$)" },
  { key: "valorTotal", label: "Valor Total da Fatura (R$)" },
];

export default function SimulacaoPage() {
  const { toast } = useToast();

  // Estado do cliente fictício
  const [clienteNome, setClienteNome] = useState("");
  const [clienteDesconto, setClienteDesconto] = useState("25");
  const [precoKwh, setPrecoKwh] = useState("");

  // Estado dos arquivos e faturas
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [simulacaoFaturas, setSimulacaoFaturas] = useState<SimulacaoFatura[]>([]);
  const [showResultDialog, setShowResultDialog] = useState(false);
  const [selectedFatura, setSelectedFatura] = useState<SimulacaoFatura | null>(null);

  // Mutation para extrair dados do PDF
  const extractMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("precoKwh", precoKwh || "0");
      formData.append("desconto", clienteDesconto || "25");

      const response = await authenticatedFetch("/api/simulacao/extract", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Erro ao extrair dados");
      }

      const data = await response.json();
      return { file, data };
    },
    onSuccess: ({ file, data }: { file: File; data: ExtractedData }) => {
      // Calcular valores da simulação
      const consumoNaoCompensado = parseToNumber(data.consumoNaoCompensado || "0");
      const consumoScee = parseToNumber(data.consumoScee || "0");
      const energiaInjetadaOriginal = parseToNumber(data.energiaInjetada || "0");
      const valorTotal = parseToNumber(data.valorTotal || "0");
      const precoFioBNum = parseToNumber(data.precoFioB || "0");
      const precoKwhNum = parseFloat(precoKwh || "0");
      const desconto = parseFloat(clienteDesconto || "25");

      // Na simulação: consumo não compensado vira energia injetada
      // Isso significa que TODA a energia consumida será compensada
      const energiaInjetadaSimulada = energiaInjetadaOriginal + consumoNaoCompensado;
      const consumoTotal = consumoScee + consumoNaoCompensado;

      // Cálculo do Fio B
      const fioBValor = consumoScee * precoFioBNum;

      // Valor sem desconto (como se fosse pagar tudo pela concessionária)
      const valorSemDesconto = (consumoTotal * precoKwhNum) + valorTotal - fioBValor;

      // Valor com desconto aplicado
      const discountMultiplier = 1 - (desconto / 100);
      const valorComDesconto = ((consumoTotal * precoKwhNum) * discountMultiplier) + valorTotal - fioBValor;

      // Economia gerada
      const economia = valorSemDesconto - valorComDesconto;

      const simulacao: SimulacaoFatura = {
        id: crypto.randomUUID(),
        fileName: file.name,
        extractedData: data,
        consumoTotal,
        energiaInjetadaSimulada,
        valorSemDesconto,
        valorComDesconto,
        economia,
      };

      setSimulacaoFaturas((prev) => [...prev, simulacao]);

      // Atualizar status do arquivo
      setFiles((prev) =>
        prev.map((f) =>
          f.file.name === file.name ? { ...f, status: "success" as const } : f
        )
      );
    },
    onError: (error: Error, file: File) => {
      toast({
        title: "Erro na extração",
        description: error.message,
        variant: "destructive",
      });
      setFiles((prev) =>
        prev.map((f) =>
          f.file.name === file.name
            ? { ...f, status: "error" as const, error: error.message }
            : f
        )
      );
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
      setFiles((prev) => [
        ...prev,
        ...droppedFiles.map((file) => ({ file, status: "pending" as const })),
      ]);
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const fileArray = Array.from(e.target.files);
      setFiles((prev) => [
        ...prev,
        ...fileArray.map((file) => ({ file, status: "pending" as const })),
      ]);
    }
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const clearAllFiles = () => {
    setFiles([]);
    setSimulacaoFaturas([]);
  };

  const handleSimular = async () => {
    if (!clienteNome.trim()) {
      toast({
        title: "Nome obrigatório",
        description: "Informe o nome do cliente fictício.",
        variant: "destructive",
      });
      return;
    }

    if (!precoKwh || parseFloat(precoKwh) <= 0) {
      toast({
        title: "Preço kWh obrigatório",
        description: "Informe o preço do kWh para a simulação.",
        variant: "destructive",
      });
      return;
    }

    if (files.length === 0) {
      toast({
        title: "Selecione arquivos",
        description: "Adicione pelo menos um arquivo PDF para simular.",
        variant: "destructive",
      });
      return;
    }

    // Limpar simulações anteriores
    setSimulacaoFaturas([]);

    // Marcar arquivos como uploading
    setFiles((prev) =>
      prev.map((f) => ({ ...f, status: "uploading" as const }))
    );

    // Processar todos os arquivos
    for (const fileObj of files) {
      if (fileObj.status === "pending" || fileObj.status === "uploading") {
        extractMutation.mutate(fileObj.file);
      }
    }
  };

  const removeFatura = (id: string) => {
    setSimulacaoFaturas((prev) => prev.filter((f) => f.id !== id));
  };

  // Calcular totais
  const totais = simulacaoFaturas.reduce(
    (acc, f) => ({
      consumoTotal: acc.consumoTotal + f.consumoTotal,
      energiaInjetada: acc.energiaInjetada + f.energiaInjetadaSimulada,
      valorSemDesconto: acc.valorSemDesconto + f.valorSemDesconto,
      valorComDesconto: acc.valorComDesconto + f.valorComDesconto,
      economia: acc.economia + f.economia,
    }),
    { consumoTotal: 0, energiaInjetada: 0, valorSemDesconto: 0, valorComDesconto: 0, economia: 0 }
  );

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Simulação"
        description="Simule a economia de um cliente potencial com energia solar"
      />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Coluna da esquerda - Configuração */}
        <div className="space-y-6">
          {/* Cliente Fictício */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <User className="h-4 w-4 text-primary" />
                Cliente Fictício
              </CardTitle>
              <CardDescription>
                Configure os dados do cliente para simulação
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="cliente-nome">Nome do Cliente</Label>
                <Input
                  id="cliente-nome"
                  placeholder="Ex: João da Silva"
                  value={clienteNome}
                  onChange={(e) => setClienteNome(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="cliente-desconto" className="flex items-center gap-1">
                  Desconto (%)
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <Info className="h-3 w-3 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="text-xs">Desconto aplicado sobre o valor da energia</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </Label>
                <div className="relative">
                  <Input
                    id="cliente-desconto"
                    type="number"
                    min="0"
                    max="100"
                    placeholder="25"
                    value={clienteDesconto}
                    onChange={(e) => setClienteDesconto(e.target.value)}
                    className="pr-8"
                  />
                  <Percent className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="preco-kwh" className="flex items-center gap-1">
                  Preço do kWh (R$)
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <Info className="h-3 w-3 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="text-xs">Preço do kWh usado para calcular economia</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </Label>
                <Input
                  id="preco-kwh"
                  type="number"
                  step="0.000001"
                  placeholder="0.85"
                  value={precoKwh}
                  onChange={(e) => setPrecoKwh(e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          {/* Botão de Simular */}
          <Button
            className="w-full"
            size="lg"
            onClick={handleSimular}
            disabled={extractMutation.isPending || files.length === 0}
          >
            {extractMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Processando...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Simular Economia
              </>
            )}
          </Button>
        </div>

        {/* Coluna do meio - Upload de arquivos */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Faturas para Simulação</CardTitle>
              <CardDescription>
                Envie as faturas da concessionária para simular a economia
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div
                className={cn(
                  "border-2 border-dashed rounded-lg p-6 text-center transition-colors",
                  isDragging
                    ? "border-primary bg-primary/5"
                    : "border-muted-foreground/25 hover:border-primary/50"
                )}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
                <p className="text-sm font-medium mb-1">
                  Arraste os PDFs aqui
                </p>
                <p className="text-xs text-muted-foreground mb-3">
                  ou clique para selecionar
                </p>
                <input
                  type="file"
                  accept=".pdf"
                  multiple
                  onChange={handleFileSelect}
                  className="hidden"
                  id="simulacao-file-upload"
                />
                <Button variant="outline" size="sm" asChild>
                  <label htmlFor="simulacao-file-upload" className="cursor-pointer">
                    Selecionar Arquivos
                  </label>
                </Button>
              </div>

              {files.length > 0 && (
                <div className="mt-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">
                      {files.length} arquivo{files.length > 1 ? "s" : ""}
                    </p>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={clearAllFiles}
                      className="h-7 text-xs text-destructive"
                    >
                      Limpar todos
                    </Button>
                  </div>
                  <ScrollArea className="max-h-48">
                    {files.map((fileObj, index) => (
                      <div
                        key={index}
                        className="flex items-center gap-2 p-2 rounded-lg bg-muted/50 mb-1"
                      >
                        <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="flex-1 text-xs truncate">
                          {fileObj.file.name}
                        </span>
                        {fileObj.status === "uploading" && (
                          <Loader2 className="h-3 w-3 animate-spin text-primary" />
                        )}
                        {fileObj.status === "success" && (
                          <CheckCircle className="h-3 w-3 text-green-500" />
                        )}
                        {fileObj.status === "error" && (
                          <AlertCircle className="h-3 w-3 text-destructive" />
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => removeFile(index)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </ScrollArea>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Coluna da direita - Resultados */}
        <div className="space-y-6">
          {simulacaoFaturas.length > 0 && (
            <>
              {/* Resumo Total */}
              <Card className="border-green-200 dark:border-green-800 bg-green-50/30 dark:bg-green-950/10">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Calculator className="h-4 w-4 text-green-600" />
                    Resumo da Simulação
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Cliente:</span>
                    <span className="font-medium">{clienteNome}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Desconto:</span>
                    <span className="font-medium">{clienteDesconto}%</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Consumo Total:</span>
                    <span className="font-mono">{totais.consumoTotal.toFixed(0)} kWh</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Energia Injetada:</span>
                    <span className="font-mono">{totais.energiaInjetada.toFixed(0)} kWh</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <TrendingDown className="h-3 w-3 text-red-500" />
                      Sem Solar:
                    </span>
                    <span className="font-mono text-red-600">
                      R$ {totais.valorSemDesconto.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <TrendingUp className="h-3 w-3 text-green-500" />
                      Com Solar:
                    </span>
                    <span className="font-mono text-green-600">
                      R$ {totais.valorComDesconto.toFixed(2)}
                    </span>
                  </div>
                  <Separator />
                  <div className="flex justify-between items-center">
                    <span className="font-medium flex items-center gap-1">
                      <DollarSign className="h-4 w-4 text-green-600" />
                      Economia Total:
                    </span>
                    <span className="text-xl font-bold text-green-600">
                      R$ {totais.economia.toFixed(2)}
                    </span>
                  </div>
                </CardContent>
              </Card>

              {/* Lista de Faturas Simuladas */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Faturas Processadas</CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="max-h-64">
                    {simulacaoFaturas.map((fatura) => (
                      <div
                        key={fatura.id}
                        className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 mb-1"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate">
                            {fatura.extractedData.mesReferencia || fatura.fileName}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Economia: R$ {fatura.economia.toFixed(2)}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => {
                              setSelectedFatura(fatura);
                              setShowResultDialog(true);
                            }}
                          >
                            <Eye className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive"
                            onClick={() => removeFatura(fatura.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </ScrollArea>
                </CardContent>
              </Card>
            </>
          )}

          {simulacaoFaturas.length === 0 && (
            <Card className="border-dashed">
              <CardContent className="py-8 text-center">
                <Sparkles className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
                <p className="text-sm text-muted-foreground">
                  Configure o cliente e envie as faturas para ver a simulação
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Dialog de Detalhes da Fatura */}
      <Dialog open={showResultDialog} onOpenChange={setShowResultDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detalhes da Simulação</DialogTitle>
            <DialogDescription>
              {selectedFatura?.fileName}
            </DialogDescription>
          </DialogHeader>

          {selectedFatura && (
            <div className="space-y-4">
              {/* Dados Extraídos */}
              <div className="grid grid-cols-2 gap-3">
                {FIELD_CONFIG.map(({ key, label }) => {
                  const value = (selectedFatura.extractedData as any)[key];
                  if (!value) return null;
                  return (
                    <div key={key} className="text-sm">
                      <span className="text-muted-foreground">{label}:</span>
                      <span className="ml-2 font-mono">{value}</span>
                    </div>
                  );
                })}
              </div>

              <Separator />

              {/* Valores da Simulação */}
              <div className="p-4 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800">
                <h4 className="font-medium mb-3 flex items-center gap-2">
                  <Calculator className="h-4 w-4 text-green-600" />
                  Cálculo da Simulação
                </h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-muted-foreground">Consumo Total:</span>
                    <span className="ml-2 font-mono font-bold">
                      {selectedFatura.consumoTotal.toFixed(0)} kWh
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Energia Injetada (simulada):</span>
                    <span className="ml-2 font-mono font-bold">
                      {selectedFatura.energiaInjetadaSimulada.toFixed(0)} kWh
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Valor Sem Solar:</span>
                    <span className="ml-2 font-mono text-red-600">
                      R$ {selectedFatura.valorSemDesconto.toFixed(2)}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Valor Com Solar:</span>
                    <span className="ml-2 font-mono text-green-600">
                      R$ {selectedFatura.valorComDesconto.toFixed(2)}
                    </span>
                  </div>
                </div>
                <Separator className="my-3" />
                <div className="flex justify-between items-center">
                  <span className="font-medium">Economia:</span>
                  <span className="text-xl font-bold text-green-600">
                    R$ {selectedFatura.economia.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Nota explicativa */}
              <div className="text-xs text-muted-foreground p-3 bg-muted rounded-lg">
                <Info className="h-3 w-3 inline mr-1" />
                Na simulação, o consumo não compensado é tratado como se fosse energia injetada,
                simulando que toda a energia consumida pelo cliente seria compensada pela geração solar.
              </div>
            </div>
          )}

          <DialogFooter>
            <Button onClick={() => setShowResultDialog(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
