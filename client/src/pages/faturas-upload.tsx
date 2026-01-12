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
import { useToast } from "@/hooks/use-toast";
import {
  Upload,
  FileText,
  X,
  CheckCircle,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Cliente, Usina } from "@shared/schema";
import { cn } from "@/lib/utils";

interface UploadedFile {
  file: File;
  status: "pending" | "uploading" | "success" | "error";
  error?: string;
  extractedData?: any;
}

export default function FaturasUploadPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [selectedUsinaId, setSelectedUsinaId] = useState<string>("");
  const [precoKwh, setPrecoKwh] = useState<string>("");
  const [isDragging, setIsDragging] = useState(false);

  const { data: usinas = [] } = useQuery<Usina[]>({
    queryKey: ["/api/usinas"],
  });

  const { data: clientes = [] } = useQuery<Cliente[]>({
    queryKey: ["/api/clientes"],
    enabled: !!selectedUsinaId,
  });

  const filteredClientes = clientes.filter((c) => c.usinaId === selectedUsinaId);

  const uploadMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const response = await fetch("/api/faturas/upload", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Erro no upload");
      }
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/faturas"] });
      toast({
        title: "Upload realizado!",
        description: `${data.processedCount || 1} fatura(s) processada(s) com sucesso.`,
      });
      navigate("/faturas");
    },
    onError: () => {
      toast({
        title: "Erro no upload",
        description: "Ocorreu um erro ao processar as faturas.",
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
    addFiles(droppedFiles);
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files).filter(
        (file) => file.type === "application/pdf"
      );
      addFiles(selectedFiles);
    }
  };

  const addFiles = (newFiles: File[]) => {
    const uploadedFiles: UploadedFile[] = newFiles.map((file) => ({
      file,
      status: "pending",
    }));
    setFiles((prev) => [...prev, ...uploadedFiles]);
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (files.length === 0) {
      toast({
        title: "Selecione arquivos",
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

    const formData = new FormData();
    files.forEach((f, index) => {
      formData.append(`files`, f.file);
    });
    formData.append("usinaId", selectedUsinaId);
    if (precoKwh) {
      formData.append("precoKwh", precoKwh);
    }

    setFiles((prev) =>
      prev.map((f) => ({ ...f, status: "uploading" as const }))
    );

    uploadMutation.mutate(formData);
  };

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Upload de Faturas"
        description="Envie as faturas da concessionária para processamento"
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Arquivos PDF</CardTitle>
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
                  ou clique para selecionar arquivos
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
                  <p className="text-sm font-medium">
                    {files.length} arquivo(s) selecionado(s)
                  </p>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {files.map((f, index) => (
                      <div
                        key={index}
                        className="flex items-center gap-3 p-3 rounded-lg bg-muted/50"
                      >
                        <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
                        <span className="flex-1 text-sm truncate">
                          {f.file.name}
                        </span>
                        {f.status === "pending" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeFile(index)}
                            className="h-7 w-7"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                        {f.status === "uploading" && (
                          <Loader2 className="h-4 w-4 animate-spin text-primary" />
                        )}
                        {f.status === "success" && (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        )}
                        {f.status === "error" && (
                          <AlertCircle className="h-4 w-4 text-destructive" />
                        )}
                      </div>
                    ))}
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
                  Opcional. Se não informado, será extraído da fatura.
                </p>
              </div>

              {selectedUsinaId && filteredClientes.length > 0 && (
                <div className="pt-4 border-t">
                  <p className="text-sm font-medium mb-2">
                    Clientes desta usina:
                  </p>
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {filteredClientes.map((cliente) => (
                      <div
                        key={cliente.id}
                        className="text-sm text-muted-foreground"
                      >
                        {cliente.nome} (UC: {cliente.unidadeConsumidora})
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Button
            className="w-full"
            size="lg"
            onClick={handleUpload}
            disabled={
              files.length === 0 ||
              !selectedUsinaId ||
              uploadMutation.isPending
            }
            data-testid="button-process-upload"
          >
            {uploadMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Processando...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Processar Faturas
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
