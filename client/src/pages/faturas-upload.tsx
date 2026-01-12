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
  valorSemDesconto?: number | string;
  valorComDesconto?: number | string;
  economia?: number | string;
  lucro?: number | string;
  precoKwhUsado?: number | string;
  descontoUsado?: number | string;
}

interface UploadedFile {
  file: File;
  status: "pending" | "uploading" | "success" | "error";
  error?: string;
  extractedData?: ExtractedData;
}

const FIELD_CONFIG: { key: keyof ExtractedData; label: string; type: "text" | "number" }[] = [
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
  { key: "energiaInjetada", label: "Energia Injetada (kWh)", type: "text" },
  { key: "precoEnergiaInjetada", label: "Preço Energia Injetada (R$)", type: "text" },
  { key: "precoEnergiaCompensada", label: "Preço Energia Compensada (R$)", type: "text" },
  { key: "precoKwhNaoCompensado", label: "Preço kWh Não Compensado (R$)", type: "text" },
  { key: "precoFioB", label: "Preço Fio B (R$)", type: "text" },
  { key: "precoAdcBandeira", label: "Preço ADC Bandeira (R$)", type: "text" },
  { key: "contribuicaoIluminacao", label: "Contribuição Iluminação Pública (R$)", type: "text" },
  { key: "valorTotal", label: "Valor Total Fatura (R$)", type: "text" },
  { key: "saldoKwh", label: "Saldo (kWh)", type: "text" },
  { key: "cicloGeracao", label: "Ciclo de Geração", type: "text" },
  { key: "ucGeradora", label: "UC Geradora", type: "text" },
  { key: "geracaoUltimoCiclo", label: "Geração Último Ciclo (kWh)", type: "text" },
  { key: "valorSemDesconto", label: "Valor Sem Desconto (R$)", type: "text" },
  { key: "valorComDesconto", label: "Valor Com Desconto (R$)", type: "text" },
  { key: "economia", label: "Economia (R$)", type: "text" },
  { key: "lucro", label: "Lucro Estimado (R$)", type: "text" },
];

function normalizeDecimal(value: string | number | undefined | null): string {
  if (value === null || value === undefined || value === "") return "";
  const strValue = String(value);
  return strValue.replace(/\./g, "").replace(",", ".");
}

export default function FaturasUploadPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [selectedUsinaId, setSelectedUsinaId] = useState<string>("");
  const [precoKwh, setPrecoKwh] = useState<string>("0.85");
  const [isDragging, setIsDragging] = useState(false);
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [pdfUrl, setPdfUrl] = useState<string>("");
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
      const initialFormData: Record<string, string> = {};
      FIELD_CONFIG.forEach(({ key }) => {
        const value = data[key];
        initialFormData[key] = value !== null && value !== undefined ? String(value) : "";
      });
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
    mutationFn: async (data: { extractedData: Record<string, string>; clienteId: string; fileUrl: string }) => {
      const normalizedData: Record<string, string> = {};
      
      const numericFields = [
        "consumoKwh", "consumoScee", "consumoNaoCompensado", "energiaInjetada",
        "precoEnergiaInjetada", "precoEnergiaCompensada", "precoKwhNaoCompensado",
        "precoFioB", "precoAdcBandeira", "contribuicaoIluminacao", "valorTotal",
        "saldoKwh", "geracaoUltimoCiclo", "valorSemDesconto", "valorComDesconto",
        "economia", "lucro", "leituraAnterior", "leituraAtual", "quantidadeDias"
      ];

      Object.entries(data.extractedData).forEach(([key, value]) => {
        if (numericFields.includes(key)) {
          normalizedData[key] = normalizeDecimal(value);
        } else {
          normalizedData[key] = value;
        }
      });

      const response = await apiRequest("POST", "/api/faturas/confirm", {
        extractedData: { ...normalizedData, fileUrl: data.fileUrl },
        clienteId: data.clienteId,
      });
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

  const handleFieldChange = (key: string, value: string) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const handleConfirm = () => {
    if (!selectedClienteId) {
      toast({
        title: "Selecione o cliente",
        description: "Escolha o cliente para vincular esta fatura.",
        variant: "destructive",
      });
      return;
    }

    confirmMutation.mutate({
      extractedData: formData,
      clienteId: selectedClienteId,
      fileUrl: pdfUrl,
    });
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
                </div>

                <Separator />

                <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
                  Dados Extraídos
                </h4>

                <div className="grid gap-3">
                  {FIELD_CONFIG.map(({ key, label }) => (
                    <div key={key} className="space-y-1">
                      <Label htmlFor={`field-${key}`} className="text-xs text-muted-foreground">
                        {label}
                      </Label>
                      <Input
                        id={`field-${key}`}
                        value={formData[key] || ""}
                        onChange={(e) => handleFieldChange(key, e.target.value)}
                        placeholder={`Informe ${label.toLowerCase()}`}
                        className="h-8 text-sm"
                        data-testid={`input-field-${key}`}
                      />
                    </div>
                  ))}
                </div>
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
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
