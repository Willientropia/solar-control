import { useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Shield, UserCog, Download, Upload, FileSpreadsheet, AlertTriangle, Check, Loader2, Info, Database, History, Table } from "lucide-react";
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
import { authenticatedFetch } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";

interface ImportPreviewData {
  usinas: { criar: number; atualizar: number; erros: string[] };
  clientes: { criar: number; atualizar: number; erros: string[] };
  faturas: { criar: number; atualizar: number; erros: string[] };
  geracao: { criar: number; atualizar: number; erros: string[] };
  precos: { criar: number; atualizar: number; erros: string[] };
}

interface HistoricoImportResult {
  message: string;
  sucesso: number;
  duplicados: number;
  erros: string[];
  totalErros: number;
  clientesNaoEncontrados: string[];
}

export default function ConfiguracoesPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';

  const [file, setFile] = useState<File | null>(null);
  const [importMode, setImportMode] = useState<"merge" | "replace" | "append">("merge");
  const [previewData, setPreviewData] = useState<ImportPreviewData | null>(null);
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);

  // Estados para importação de histórico
  const [historicoFile, setHistoricoFile] = useState<File | null>(null);
  const [showHistoricoResultDialog, setShowHistoricoResultDialog] = useState(false);
  const [historicoResult, setHistoricoResult] = useState<HistoricoImportResult | null>(null);

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

      const response = await authenticatedFetch("/api/admin/import/preview", {
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

      const response = await authenticatedFetch("/api/admin/import", {
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

  // Mutation para importação de histórico de faturas
  const historicoImportMutation = useMutation({
    mutationFn: async () => {
      if (!historicoFile) throw new Error("Selecione um arquivo");

      const formData = new FormData();
      formData.append("file", historicoFile);

      const response = await authenticatedFetch("/api/admin/import/historico-faturas", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Erro na importação");
      }

      return response.json();
    },
    onSuccess: (data: HistoricoImportResult) => {
      setHistoricoResult(data);
      setShowHistoricoResultDialog(true);

      if (data.sucesso > 0) {
        toast({
          title: "Importação Concluída",
          description: `${data.sucesso} faturas importadas com sucesso.`,
        });
      }

      // Reset file input
      setHistoricoFile(null);
      const fileInput = document.getElementById("historico-upload") as HTMLInputElement;
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

  const handleHistoricoFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setHistoricoFile(e.target.files[0]);
    }
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

      {/* Seção de Importação de Histórico de Faturas - Apenas Admin */}
      {isAdmin && (
        <>
          <Separator />

          <Card className="border-purple-200 dark:border-purple-800 bg-purple-50/30 dark:bg-purple-950/10">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                Importar Histórico de Faturas
              </CardTitle>
              <CardDescription>
                Importe dados históricos de faturas já calculadas a partir de uma planilha Excel.
                Ideal para migração de sistemas anteriores.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert className="bg-purple-50 border-purple-200 dark:bg-purple-950/20 dark:border-purple-900">
                <Table className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                <AlertTitle className="text-purple-800 dark:text-purple-300">Formato Esperado da Planilha</AlertTitle>
                <AlertDescription className="text-purple-700 dark:text-purple-400 text-xs mt-1">
                  <p className="mb-2">A planilha deve conter as seguintes colunas (os nomes podem variar):</p>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-1 text-[10px] font-mono">
                    <span>• Unidade Consumidora *</span>
                    <span>• Mês de Referência *</span>
                    <span>• Valor Total</span>
                    <span>• Consumo SCEE</span>
                    <span>• Consumo Não Compensado</span>
                    <span>• Energia Injetada</span>
                    <span>• Saldo (kWh)</span>
                    <span>• Data de Vencimento</span>
                    <span>• Contribuição Iluminação</span>
                    <span>• Preço do Fio B</span>
                    <span>• Sem a Solar (Valor Sem Desconto)</span>
                    <span>• Com Desconto (Valor Com Desconto)</span>
                    <span>• Desconto em R$ (Economia)</span>
                  </div>
                  <p className="mt-2 text-purple-600 dark:text-purple-300">* Campos obrigatórios. O cliente deve estar cadastrado no sistema.</p>
                </AlertDescription>
              </Alert>

              <div className="space-y-4 p-4 border rounded-lg bg-background">
                <div className="space-y-2">
                  <Label htmlFor="historico-upload">Arquivo de Histórico (.xlsx)</Label>
                  <Input
                    id="historico-upload"
                    type="file"
                    accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                    onChange={handleHistoricoFileSelect}
                  />
                </div>

                {historicoFile && (
                  <div className="space-y-3 pt-2">
                    <div className="flex items-center gap-2 text-sm">
                      <FileSpreadsheet className="h-4 w-4 text-purple-500" />
                      <span className="font-medium">{historicoFile.name}</span>
                      <span className="text-muted-foreground">
                        ({(historicoFile.size / 1024).toFixed(1)} KB)
                      </span>
                    </div>

                    <Alert>
                      <Info className="h-4 w-4" />
                      <AlertDescription className="text-xs">
                        <ul className="list-disc pl-4 space-y-1">
                          <li>Faturas duplicadas (mesmo cliente + mês) serão ignoradas</li>
                          <li>Clientes não cadastrados serão reportados como erro</li>
                          <li>Os dados importados serão marcados como "Pago" e "Recebida"</li>
                          <li>Os valores já calculados serão mantidos (sem recálculo)</li>
                        </ul>
                      </AlertDescription>
                    </Alert>

                    <Button
                      className="w-full"
                      onClick={() => historicoImportMutation.mutate()}
                      disabled={historicoImportMutation.isPending}
                    >
                      {historicoImportMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Importando histórico...
                        </>
                      ) : (
                        <>
                          <Upload className="mr-2 h-4 w-4" />
                          Importar Histórico de Faturas
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </>
      )}

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

      {/* Dialog de Resultado da Importação de Histórico */}
      <Dialog open={showHistoricoResultDialog} onOpenChange={setShowHistoricoResultDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Resultado da Importação de Histórico</DialogTitle>
            <DialogDescription>
              Resumo da importação de faturas históricas.
            </DialogDescription>
          </DialogHeader>

          {historicoResult && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-3 gap-4">
                <Card className="border-l-4 border-l-green-500">
                  <CardContent className="p-4">
                    <div className="text-2xl font-bold text-green-600">{historicoResult.sucesso}</div>
                    <div className="text-sm text-muted-foreground">Importadas com sucesso</div>
                  </CardContent>
                </Card>
                <Card className="border-l-4 border-l-yellow-500">
                  <CardContent className="p-4">
                    <div className="text-2xl font-bold text-yellow-600">{historicoResult.duplicados}</div>
                    <div className="text-sm text-muted-foreground">Duplicadas (ignoradas)</div>
                  </CardContent>
                </Card>
                <Card className="border-l-4 border-l-red-500">
                  <CardContent className="p-4">
                    <div className="text-2xl font-bold text-red-600">{historicoResult.totalErros}</div>
                    <div className="text-sm text-muted-foreground">Erros encontrados</div>
                  </CardContent>
                </Card>
              </div>

              {historicoResult.clientesNaoEncontrados.length > 0 && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Clientes Não Encontrados</AlertTitle>
                  <AlertDescription className="max-h-24 overflow-y-auto mt-2">
                    <p className="text-xs mb-2">
                      Os seguintes clientes (UC ou CPF) não foram encontrados no sistema.
                      Cadastre-os antes de importar novamente:
                    </p>
                    <ul className="list-disc pl-4 text-xs space-y-1">
                      {historicoResult.clientesNaoEncontrados.map((cliente, i) => (
                        <li key={i}>{cliente}</li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}

              {historicoResult.erros.length > 0 && (
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertTitle>Detalhes dos Erros</AlertTitle>
                  <AlertDescription className="max-h-32 overflow-y-auto mt-2">
                    <ul className="list-disc pl-4 text-xs space-y-1">
                      {historicoResult.erros.map((erro, i) => (
                        <li key={i}>{erro}</li>
                      ))}
                    </ul>
                    {historicoResult.totalErros > historicoResult.erros.length && (
                      <p className="mt-2 text-muted-foreground">
                        ... e mais {historicoResult.totalErros - historicoResult.erros.length} erros
                      </p>
                    )}
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          <DialogFooter>
            <Button onClick={() => setShowHistoricoResultDialog(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
