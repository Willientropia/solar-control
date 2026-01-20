import { useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Shield, UserCog, Download, Upload, FileSpreadsheet, AlertTriangle, Check, Loader2, Info, Database } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useMutation } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

interface ImportPreviewData {
  usinas: { criar: number; atualizar: number; erros: string[] };
  clientes: { criar: number; atualizar: number; erros: string[] };
  faturas: { criar: number; atualizar: number; erros: string[] };
  geracao: { criar: number; atualizar: number; erros: string[] };
  precos: { criar: number; atualizar: number; erros: string[] };
}

export default function ConfiguracoesPage() {
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [importMode, setImportMode] = useState<"merge" | "replace" | "append">("merge");
  const [previewData, setPreviewData] = useState<ImportPreviewData | null>(null);
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
      // Reset preview when file changes
      setPreviewData(null);
    }
  };

  const previewMutation = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("Selecione um arquivo");

      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/admin/import/preview", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Erro ao gerar preview");
      }

      return response.json();
    },
    onSuccess: (data) => {
      setPreviewData(data);
      setShowPreviewDialog(true);
    },
    onError: (error: Error) => {
      toast({
        title: "Erro no Preview",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const importMutation = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("Selecione um arquivo");

      const formData = new FormData();
      formData.append("file", file);
      formData.append("mode", importMode);

      const response = await fetch("/api/admin/import", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Erro na importação");
      }

      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Importação Concluída",
        description: `Importação realizada com sucesso. ${data.summary || ""}`,
      });
      setShowPreviewDialog(false);
      setFile(null);
      setPreviewData(null);
      // Reset file input
      const fileInput = document.getElementById("excel-upload") as HTMLInputElement;
      if (fileInput) fileInput.value = "";
    },
    onError: (error: Error) => {
      toast({
        title: "Erro na Importação",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleExport = () => {
    window.location.href = "/api/admin/export/all";
    toast({
      title: "Download iniciado",
      description: "O backup completo do sistema está sendo baixado.",
    });
  };

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Configurações"
        description="Gerenciamento do sistema, backups e permissões"
      />

      {/* Seção de Backup e Restauração */}
      <Card className="border-blue-200 dark:border-blue-800 bg-blue-50/30 dark:bg-blue-950/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            Backup e Restauração de Dados
          </CardTitle>
          <CardDescription>
            Exporte todos os dados para segurança ou importe para migração e atualizações em massa.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid md:grid-cols-2 gap-8">
            {/* Exportar */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 font-medium text-lg">
                <div className="h-8 w-8 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
                  <Download className="h-4 w-4 text-green-600 dark:text-green-400" />
                </div>
                Exportar Dados (Backup)
              </div>
              <p className="text-sm text-muted-foreground">
                Gera um arquivo Excel (.xlsx) contendo todos os dados do sistema: Usinas, Clientes, Faturas e Histórico.
                Ideal para backup de segurança.
              </p>
              <Button onClick={handleExport} className="w-full sm:w-auto" variant="outline">
                <FileSpreadsheet className="mr-2 h-4 w-4" />
                Baixar Backup Completo
              </Button>
            </div>

            {/* Importar */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 font-medium text-lg">
                <div className="h-8 w-8 rounded-full bg-amber-100 dark:bg-amber-900 flex items-center justify-center">
                  <Upload className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                </div>
                Importar Dados
              </div>
              <p className="text-sm text-muted-foreground">
                Carregue um arquivo de backup (.xlsx) para restaurar dados ou atualizar informações em massa.
              </p>
              
              <div className="space-y-4 p-4 border rounded-lg bg-background">
                <div className="space-y-2">
                  <Label htmlFor="excel-upload">Arquivo de Backup (.xlsx)</Label>
                  <Input 
                    id="excel-upload" 
                    type="file" 
                    accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                    onChange={handleFileSelect}
                  />
                </div>

                {file && (
                  <div className="space-y-3 pt-2">
                    <Label>Modo de Importação</Label>
                    <RadioGroup 
                      value={importMode} 
                      onValueChange={(v) => setImportMode(v as any)}
                      className="grid gap-2"
                    >
                      <div className="flex items-center space-x-2 border p-3 rounded-md hover:bg-muted/50 transition-colors">
                        <RadioGroupItem value="merge" id="mode-merge" />
                        <Label htmlFor="mode-merge" className="flex-1 cursor-pointer">
                          <span className="font-medium block">Mesclar (Recomendado)</span>
                          <span className="text-xs text-muted-foreground font-normal">
                            Atualiza registros existentes e cria novos. Mantém dados não mencionados no arquivo.
                          </span>
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2 border p-3 rounded-md hover:bg-muted/50 transition-colors">
                        <RadioGroupItem value="append" id="mode-append" />
                        <Label htmlFor="mode-append" className="flex-1 cursor-pointer">
                          <span className="font-medium block">Apenas Adicionar</span>
                          <span className="text-xs text-muted-foreground font-normal">
                            Ignora registros que já existem (pelo ID ou chave única). Apenas cria novos.
                          </span>
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2 border border-red-200 dark:border-red-900/30 bg-red-50/30 dark:bg-red-950/10 p-3 rounded-md hover:bg-red-50/50 transition-colors">
                        <RadioGroupItem value="replace" id="mode-replace" />
                        <Label htmlFor="mode-replace" className="flex-1 cursor-pointer">
                          <span className="font-medium block text-red-600 dark:text-red-400">Substituir Tudo (Cuidado!)</span>
                          <span className="text-xs text-muted-foreground font-normal">
                            Apaga TODOS os dados atuais e recria conforme o arquivo. Irreversível.
                          </span>
                        </Label>
                      </div>
                    </RadioGroup>

                    <Button 
                      className="w-full" 
                      onClick={() => previewMutation.mutate()}
                      disabled={previewMutation.isPending}
                    >
                      {previewMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Analisando arquivo...
                        </>
                      ) : (
                        <>
                          <Upload className="mr-2 h-4 w-4" />
                          Analisar e Importar
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Separator />

      <h3 className="text-lg font-medium mt-6 mb-4">Permissões do Sistema</h3>
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Shield className="h-4 w-4 text-blue-500" />
              Administrador
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-green-500" />
                Acesso a todas as funcionalidades
              </li>
              <li className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-green-500" />
                Visualizar relatórios financeiros
              </li>
              <li className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-green-500" />
                Acessar logs de auditoria
              </li>
              <li className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-green-500" />
                Gerenciar usuários e suas funções
              </li>
              <li className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-green-500" />
                Realizar Backup e Restore
              </li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <UserCog className="h-4 w-4 text-gray-500" />
              Operador
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-green-500" />
                Cadastrar usinas e clientes
              </li>
              <li className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-green-500" />
                Upload e processamento de faturas
              </li>
              <li className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-green-500" />
                Registrar geração mensal
              </li>
              <li className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-red-500" />
                Sem acesso a relatórios financeiros
              </li>
              <li className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-red-500" />
                Sem acesso a backup/restore
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>

      {/* Dialog de Confirmação de Importação */}
      <Dialog open={showPreviewDialog} onOpenChange={setShowPreviewDialog}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Confirmar Importação</DialogTitle>
            <DialogDescription>
              Resumo das alterações que serão realizadas no banco de dados.
            </DialogDescription>
          </DialogHeader>

          {previewData && (
            <div className="grid gap-4 py-4">
              <div className="flex items-center justify-between p-4 bg-muted rounded-lg border">
                <div>
                  <p className="font-medium">Modo Selecionado</p>
                  <p className="text-sm text-muted-foreground">
                    {importMode === "merge" && "Mesclar (Atualizar + Criar)"}
                    {importMode === "append" && "Apenas Adicionar (Ignorar Existentes)"}
                    {importMode === "replace" && "Substituir Tudo (Apagar + Criar)"}
                  </p>
                </div>
                {importMode === "replace" && (
                  <div className="flex items-center gap-2 text-red-600 bg-red-50 px-3 py-1 rounded-full text-xs font-bold uppercase border border-red-200">
                    <AlertTriangle className="h-3 w-3" />
                    Destrutivo
                  </div>
                )}
              </div>

              <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
                {Object.entries(previewData).map(([key, data]: [string, any]) => (
                  <Card key={key} className={cn(
                    "border-l-4", 
                    data.erros && data.erros.length > 0 ? "border-l-red-500" : 
                    data.criar > 0 || data.atualizar > 0 ? "border-l-green-500" : "border-l-gray-300"
                  )}>
                    <CardHeader className="p-3 pb-2">
                      <CardTitle className="text-sm capitalize font-bold text-muted-foreground">
                        {key}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-3 pt-0 text-sm">
                      <div className="flex justify-between">
                        <span>Novos:</span>
                        <span className="font-mono font-bold text-green-600">+{data.criar}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Atualizados:</span>
                        <span className="font-mono font-bold text-blue-600">~{data.atualizar}</span>
                      </div>
                      {data.erros && data.erros.length > 0 && (
                        <div className="mt-2 text-xs text-red-600 bg-red-50 p-1 rounded">
                          {data.erros.length} erros encontrados
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Lista de erros se houver */}
              {Object.values(previewData).some((d: any) => d.erros && d.erros.length > 0) && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Erros de Validação</AlertTitle>
                  <AlertDescription className="max-h-32 overflow-y-auto mt-2">
                    <ul className="list-disc pl-4 text-xs space-y-1">
                      {Object.entries(previewData).flatMap(([key, data]: [string, any]) => 
                        data.erros.map((erro: string, i: number) => (
                          <li key={`${key}-${i}`}><strong>{key}:</strong> {erro}</li>
                        ))
                      )}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}
              
              <Alert className="bg-blue-50 border-blue-200 dark:bg-blue-950/20 dark:border-blue-900">
                <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <AlertTitle className="text-blue-800 dark:text-blue-300">Confirmação Necessária</AlertTitle>
                <AlertDescription className="text-blue-700 dark:text-blue-400 text-xs mt-1">
                  Verifique os números acima. Ao confirmar, as alterações serão aplicadas permanentemente ao banco de dados.
                </AlertDescription>
              </Alert>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPreviewDialog(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={() => importMutation.mutate()} 
              disabled={importMutation.isPending || (previewData && Object.values(previewData).some((d: any) => d.erros && d.erros.length > 0))}
              className={importMode === "replace" ? "bg-red-600 hover:bg-red-700" : ""}
            >
              {importMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Importando...
                </>
              ) : (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  Confirmar Importação
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
