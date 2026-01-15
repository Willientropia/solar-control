import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  Edit,
  TrendingUp,
  Percent,
  Zap,
  Calendar,
  CheckCircle,
  XCircle,
  FileText,
} from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Cliente, Usina, Fatura } from "@shared/schema";
import { formatCurrency, formatNumber, parseToNumber } from "@/lib/utils";

interface ClienteDetalhes extends Cliente {
  usina?: Usina;
  faturas?: Fatura[];
  saldoTotal?: string;
}

export default function ClienteDetalhesPage() {
  const { toast } = useToast();
  const [, params] = useRoute("/clientes/:id");
  const clienteId = params?.id || "";

  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editFormData, setEditFormData] = useState<Record<string, any>>({});

  // Fetch cliente details
  const { data: cliente, isLoading } = useQuery<ClienteDetalhes>({
    queryKey: [`/api/clientes/${clienteId}/detalhes`],
    enabled: !!clienteId,
  });

  const { data: usinas = [] } = useQuery<Usina[]>({
    queryKey: ["/api/usinas"],
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: (data: Record<string, any>) =>
      apiRequest("PATCH", `/api/clientes/${clienteId}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/clientes/${clienteId}/detalhes`] });
      queryClient.invalidateQueries({ queryKey: ["/api/clientes"] });
      setIsEditDialogOpen(false);
      toast({ title: "Cliente atualizado com sucesso!" });
    },
    onError: () => {
      toast({ title: "Erro ao atualizar cliente", variant: "destructive" });
    },
  });

  const handleOpenEditDialog = () => {
    if (cliente) {
      setEditFormData({
        nome: cliente.nome,
        cpfCnpj: cliente.cpfCnpj || "",
        enderecoSimplificado: cliente.enderecoSimplificado || "",
        enderecoCompleto: cliente.enderecoCompleto || "",
        unidadeConsumidora: cliente.unidadeConsumidora,
        usinaId: cliente.usinaId,
        desconto: formatNumber(cliente.desconto),
        isPagante: cliente.isPagante,
        numeroContrato: cliente.numeroContrato || "",
        valorContratadoKwh: cliente.valorContratadoKwh ? formatNumber(cliente.valorContratadoKwh) : "",
        porcentagemEnvioCredito: cliente.porcentagemEnvioCredito ? formatNumber(cliente.porcentagemEnvioCredito) : "",
      });
      setIsEditDialogOpen(true);
    }
  };

  const handleSaveEdit = () => {
    const formattedData = {
      ...editFormData,
      desconto: parseToNumber(editFormData.desconto).toFixed(2),
      valorContratadoKwh: editFormData.valorContratadoKwh ? parseToNumber(editFormData.valorContratadoKwh).toFixed(2) : null,
      porcentagemEnvioCredito: editFormData.porcentagemEnvioCredito ? parseToNumber(editFormData.porcentagemEnvioCredito).toFixed(2) : null,
    };
    updateMutation.mutate(formattedData);
  };

  const updateEditFormField = (field: string, value: any) => {
    setEditFormData(prev => ({ ...prev, [field]: value }));
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/3"></div>
          <div className="h-32 bg-muted rounded"></div>
        </div>
      </div>
    );
  }

  if (!cliente) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-12 text-center">
            <p className="text-muted-foreground">Cliente não encontrado</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const faturas = cliente.faturas || [];
  const saldoTotal = parseToNumber(cliente.saldoTotal || "0");

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title={cliente.nome}
        description={`UC: ${cliente.unidadeConsumidora} • ${cliente.usina?.nome || "Usina não encontrada"}`}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link href="/clientes">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Voltar
              </Link>
            </Button>
            <Button onClick={handleOpenEditDialog}>
              <Edit className="h-4 w-4 mr-2" />
              Editar Cliente
            </Button>
          </div>
        }
      />

      {/* Métricas principais */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Status</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Badge variant={cliente.ativo ? "default" : "secondary"}>
                {cliente.ativo ? "Ativo" : "Inativo"}
              </Badge>
              <Badge variant={cliente.isPagante ? "default" : "outline"}>
                {cliente.isPagante ? "Pagante" : "Uso Próprio"}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Desconto</CardTitle>
            <Percent className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{cliente.desconto}%</div>
            <p className="text-xs text-muted-foreground">
              Aplicado nas faturas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Envio Crédito</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {cliente.porcentagemEnvioCredito || "N/A"}
              {cliente.porcentagemEnvioCredito && "%"}
            </div>
            <p className="text-xs text-muted-foreground">
              Porcentagem configurada
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Saldo Atual</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatNumber(saldoTotal)} kWh
            </div>
            <p className="text-xs text-muted-foreground">
              Créditos acumulados
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Histórico de Faturas */}
      <Card>
        <CardHeader>
          <CardTitle>Histórico de Faturas</CardTitle>
        </CardHeader>
        <CardContent>
          {faturas.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>Nenhuma fatura encontrada para este cliente</p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Mês</TableHead>
                    <TableHead>Vencimento</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Consumo SCEE</TableHead>
                    <TableHead className="text-right">Valor Total</TableHead>
                    <TableHead className="text-right">Valor s/ Desc.</TableHead>
                    <TableHead className="text-right">Valor c/ Desc.</TableHead>
                    <TableHead className="text-right">Economia</TableHead>
                    <TableHead className="text-right">Saldo kWh</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {faturas.map((fatura) => (
                    <TableRow key={fatura.id}>
                      <TableCell className="font-medium">{fatura.mesReferencia}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3 text-muted-foreground" />
                          {fatura.dataVencimento || "N/A"}
                        </div>
                      </TableCell>
                      <TableCell>
                        {fatura.status === "pago" ? (
                          <Badge variant="default" className="gap-1">
                            <CheckCircle className="h-3 w-3" />
                            Pago
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="gap-1">
                            <XCircle className="h-3 w-3" />
                            Pendente
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatNumber(fatura.consumoScee || "0")} kWh
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(fatura.valorTotal || "0")}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(fatura.valorSemDesconto || "0")}
                      </TableCell>
                      <TableCell className="text-right font-mono text-green-600 dark:text-green-400">
                        {formatCurrency(fatura.valorComDesconto || "0")}
                      </TableCell>
                      <TableCell className="text-right font-mono text-green-600 dark:text-green-400 font-semibold">
                        {formatCurrency(fatura.economia || "0")}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatNumber(fatura.saldoKwh || "0")} kWh
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal de Edição */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Editar Cliente</DialogTitle>
          </DialogHeader>
          <ScrollArea className="flex-1 px-6">
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label>Nome do Cliente</Label>
                  <Input
                    value={editFormData.nome || ""}
                    onChange={(e) => updateEditFormField("nome", e.target.value)}
                  />
                </div>
                <div>
                  <Label>CPF/CNPJ</Label>
                  <Input
                    value={editFormData.cpfCnpj || ""}
                    onChange={(e) => updateEditFormField("cpfCnpj", e.target.value)}
                  />
                </div>
                <div>
                  <Label>Unidade Consumidora</Label>
                  <Input
                    value={editFormData.unidadeConsumidora || ""}
                    onChange={(e) => updateEditFormField("unidadeConsumidora", e.target.value)}
                  />
                </div>
                <div>
                  <Label>Endereço Simplificado</Label>
                  <Input
                    value={editFormData.enderecoSimplificado || ""}
                    onChange={(e) => updateEditFormField("enderecoSimplificado", e.target.value)}
                    placeholder="Ex: SLMB"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Usado em relatórios de usina
                  </p>
                </div>
                <div>
                  <Label>Endereço Completo</Label>
                  <Input
                    value={editFormData.enderecoCompleto || ""}
                    onChange={(e) => updateEditFormField("enderecoCompleto", e.target.value)}
                    placeholder="Ex: Av. Principal, Q. 41, L. 17..."
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Usado em faturas geradas
                  </p>
                </div>
                <div>
                  <Label>Usina</Label>
                  <Select
                    value={editFormData.usinaId || ""}
                    onValueChange={(value) => updateEditFormField("usinaId", value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione uma usina" />
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
                <div>
                  <Label>Número do Contrato</Label>
                  <Input
                    value={editFormData.numeroContrato || ""}
                    onChange={(e) => updateEditFormField("numeroContrato", e.target.value)}
                  />
                </div>
                <div>
                  <Label>Valor Contratado (kWh)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={editFormData.valorContratadoKwh || ""}
                    onChange={(e) => updateEditFormField("valorContratadoKwh", e.target.value)}
                  />
                </div>
                <div>
                  <Label>% Envio Crédito</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={editFormData.porcentagemEnvioCredito || ""}
                    onChange={(e) => updateEditFormField("porcentagemEnvioCredito", e.target.value)}
                  />
                </div>
                <div>
                  <Label>Desconto (%)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={editFormData.desconto || ""}
                    onChange={(e) => updateEditFormField("desconto", e.target.value)}
                    disabled={!editFormData.isPagante}
                  />
                  {!editFormData.isPagante && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Clientes de uso próprio não têm desconto
                    </p>
                  )}
                </div>
                <div className="col-span-2 flex items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <Label>Cliente Pagante</Label>
                    <p className="text-sm text-muted-foreground">
                      Marque se este cliente paga pelo crédito de energia
                    </p>
                  </div>
                  <Switch
                    checked={editFormData.isPagante || false}
                    onCheckedChange={(checked) => {
                      updateEditFormField("isPagante", checked);
                      if (!checked) {
                        updateEditFormField("desconto", "0");
                      }
                    }}
                  />
                </div>
              </div>
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveEdit} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? "Salvando..." : "Salvar Alterações"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
