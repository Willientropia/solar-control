import { useState, useCallback } from "react";
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
import { Badge } from "@/components/ui/badge";
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
} from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Cliente, Usina } from "@shared/schema";
import { cn } from "@/lib/utils";

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
  valorSemDesconto?: number;
  valorComDesconto?: number;
  economia?: number;
  lucro?: number;
  precoKwhUsado?: number;
  descontoUsado?: number;
}

interface UploadedFile {
  file: File;
  status: "pending" | "uploading" | "success" | "error";
  error?: string;
  extractedData?: ExtractedData;
}

const FIELD_LABELS: Record<string, string> = {
  cpfCnpj: "CPF/CNPJ",
  nomeCliente: "Nome do Cliente",
  endereco: "Endereço",
  unidadeConsumidora: "Unidade Consumidora",
  mesReferencia: "Mês de Referência",
  dataVencimento: "Data de Vencimento",
  leituraAnterior: "Leitura Anterior",
  leituraAtual: "Leitura Atual",
  quantidadeDias: "Quantidade de Dias",
  consumoKwh: "Consumo Total (kWh)",
  consumoScee: "Consumo SCEE (kWh)",
  consumoNaoCompensado: "Consumo Não Compensado (kWh)",
  energiaInjetada: "Energia Injetada (kWh)",
  precoEnergiaInjetada: "Preço Energia Injetada (R$)",
  precoEnergiaCompensada: "Preço Energia Compensada (R$)",
  precoKwhNaoCompensado: "Preço kWh Não Compensado (R$)",
  precoFioB: "Preço Fio B (R$)",
  precoAdcBandeira: "Preço ADC Bandeira (R$)",
  contribuicaoIluminacao: "Contribuição Iluminação Pública (R$)",
  valorTotal: "Valor Total Fatura (R$)",
  saldoKwh: "Saldo (kWh)",
  cicloGeracao: "Ciclo de Geração",
  ucGeradora: "UC Geradora",
  geracaoUltimoCiclo: "Geração Último Ciclo (kWh)",
  valorSemDesconto: "Valor Sem Desconto (R$)",
  valorComDesconto: "Valor Com Desconto (R$)",
  economia: "Economia (R$)",
  lucro: "Lucro Estimado (R$)",
};

export default function FaturasUploadPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [selectedUsinaId, setSelectedUsinaId] = useState<string>("");
  const [precoKwh, setPrecoKwh] = useState<string>("0.85");
  const [isDragging, setIsDragging] = useState(false);
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [currentExtractedData, setCurrentExtractedData] = useState<ExtractedData | null>(null);
  const [selectedClienteId, setSelectedClienteId] = useState<string>("");

  const { data: usinas = [] } = useQuery<Usina[]>({
    queryKey: ["/api/usinas"],
  });

  const { data: clientes = [] } = useQuery<Cliente[]>({
    queryKey: ["/api/clientes"],
  });

  const filteredClientes = clientes.filter((c) => c.usinaId === selectedUsinaId);
  const selectedUsina = usinas.find((u) => u.id === selectedUsinaId);

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
      setCurrentExtractedData(data);
      
      // Try to match client by UC
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
    },
  });

  const confirmMutation = useMutation({
    mutationFn: async (data: { extractedData: ExtractedData; clienteId: string }) => {
      const response = await apiRequest("POST", "/api/faturas/confirm", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/faturas"] });
      toast({
        title: "Fatura salva!",
        description: "Os dados foram salvos com sucesso.",
      });
      setShowVerificationModal(false);
      setCurrentExtractedData(null);
      setFiles([]);
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao salvar",
        description: error.message,
        variant: "destructive",
      });
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
      setFiles([{ file: droppedFiles[0], status: "pending" }]);
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFiles([{ file: e.target.files[0], status: "pending" }]);
    }
  };

  const removeFile = () => {
    setFiles([]);
  };

  const handleExtract = async () => {
    if (files.length === 0) {
      toast({
        title: "Selecione um arquivo",
        description: "Adicione um arquivo PDF para continuar.",
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

    extractMutation.mutate(files[0].file);
  };

  const handleConfirm = () => {
    if (!currentExtractedData || !selectedClienteId) {
      toast({
        title: "Selecione o cliente",
        description: "Escolha o cliente para vincular esta fatura.",
        variant: "destructive",
      });
      return;
    }

    confirmMutation.mutate({
      extractedData: currentExtractedData,
      clienteId: selectedClienteId,
    });
  };

  const renderFieldValue = (key: string, value: any) => {
    if (value === null || value === undefined || value === "") {
      return <Badge variant="outline" className="text-muted-foreground">Não encontrado</Badge>;
    }
    if (typeof value === "number") {
      return <span className="font-mono">{value.toFixed(2)}</span>;
    }
    return <span className="font-mono">{value}</span>;
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
                  Arraste o PDF aqui
                </p>
                <p className="text-sm text-muted-foreground mb-4">
                  ou clique para selecionar o arquivo
                </p>
                <input
                  type="file"
                  accept=".pdf"
                  onChange={handleFileSelect}
                  className="hidden"
                  id="file-upload"
                  data-testid="input-file-upload"
                />
                <Button variant="outline" asChild>
                  <label htmlFor="file-upload" className="cursor-pointer">
                    Selecionar Arquivo
                  </label>
                </Button>
              </div>

              {files.length > 0 && (
                <div className="mt-6">
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                    <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
                    <span className="flex-1 text-sm truncate">
                      {files[0].file.name}
                    </span>
                    {files[0].status === "pending" && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={removeFile}
                        className="h-7 w-7"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                    {files[0].status === "uploading" && (
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    )}
                    {files[0].status === "success" && (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    )}
                    {files[0].status === "error" && (
                      <AlertCircle className="h-4 w-4 text-destructive" />
                    )}
                  </div>
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
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Verificar Dados Extraídos</DialogTitle>
            <DialogDescription>
              Confira os dados extraídos da fatura antes de salvar.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 lg:grid-cols-2">
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
                {currentExtractedData?.unidadeConsumidora && (
                  <p className="text-xs text-muted-foreground">
                    UC detectada na fatura: <strong>{currentExtractedData.unidadeConsumidora}</strong>
                  </p>
                )}
              </div>

              {currentExtractedData?.fileUrl && (
                <div className="border rounded-lg overflow-hidden h-[400px]">
                  <iframe
                    src={currentExtractedData.fileUrl}
                    className="w-full h-full"
                    title="PDF Preview"
                  />
                </div>
              )}
            </div>

            <ScrollArea className="h-[500px] pr-4">
              <div className="space-y-3">
                <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
                  Dados Identificados
                </h4>
                <Separator />
                
                {currentExtractedData && Object.entries(FIELD_LABELS).map(([key, label]) => {
                  const value = (currentExtractedData as any)[key];
                  return (
                    <div key={key} className="flex justify-between items-center py-1">
                      <span className="text-sm text-muted-foreground">{label}</span>
                      {renderFieldValue(key, value)}
                    </div>
                  );
                })}

                {currentExtractedData?.extractionErrors && currentExtractedData.extractionErrors.length > 0 && (
                  <>
                    <Separator className="my-4" />
                    <div className="space-y-2">
                      <h4 className="font-medium text-sm text-destructive uppercase tracking-wide">
                        Campos não encontrados
                      </h4>
                      {currentExtractedData.extractionErrors.map((error, idx) => (
                        <Badge key={idx} variant="destructive" className="mr-1">
                          {error}
                        </Badge>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </ScrollArea>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowVerificationModal(false)}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={!selectedClienteId || confirmMutation.isPending}
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
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
