import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { PageHeader } from "@/components/page-header";
import { DataTable } from "@/components/data-table";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  Download,
  Trash2,
  CheckCircle,
  Clock,
  DollarSign,
  AlertCircle,
  PlusCircle,
  Loader2
} from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Fatura, Cliente, Usina } from "@shared/schema";
import { formatCurrency } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";

interface FaturaWithCliente extends Fatura {
  cliente?: Cliente;
}

function getCurrentMonthRef(): string {
  const now = new Date();
  const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  return `${months[now.getMonth()]}/${now.getFullYear()}`;
}

function getRecentMonths(count = 12): string[] {
  const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
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

export default function FaturasPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const isAdmin = user?.profile?.role === "admin";
  
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedUsinaId, setSelectedUsinaId] = useState<string>("all");
  const [selectedMonth, setSelectedMonth] = useState<string>(getCurrentMonthRef());

  const { data: usinas = [] } = useQuery<Usina[]>({
    queryKey: ["/api/usinas"],
  });

  const { data: faturas = [], isLoading } = useQuery<FaturaWithCliente[]>({
    queryKey: ["/api/faturas", statusFilter, selectedUsinaId, selectedMonth],
    // Construct URL with query params
    queryFn: () => apiRequest("GET", `/api/faturas?status=${statusFilter !== "all" ? statusFilter : ""}&usinaId=${selectedUsinaId !== "all" ? selectedUsinaId : ""}&mesReferencia=${selectedMonth !== "all" ? selectedMonth : ""}`).then(r => r.json())
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      apiRequest("PATCH", `/api/faturas/${id}/status`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/faturas"] });
      toast({ title: "Status atualizado!" });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao atualizar status", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/faturas/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/faturas"] });
      toast({ title: "Fatura removida!" });
    },
    onError: () => {
      toast({ title: "Erro ao remover fatura", variant: "destructive" });
    },
  });

  const generatePlaceholdersMutation = useMutation({
    mutationFn: (mesReferencia: string) => 
      apiRequest("POST", "/api/faturas/generate-placeholders", { mesReferencia }),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/faturas"] });
      toast({ title: "Faturas geradas!", description: data.message });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao gerar faturas", description: error.message, variant: "destructive" });
    }
  });

  const columns = [
    {
      key: "cliente",
      header: "Cliente",
      cell: (fatura: FaturaWithCliente) => (
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
            <FileText className="h-4 w-4" />
          </div>
          <div>
            <p className="font-medium">{fatura.cliente?.nome || "Cliente"}</p>
            <p className="text-sm text-muted-foreground">
              UC: {fatura.cliente?.unidadeConsumidora || "-"}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: "usina",
      header: "Usina",
      cell: (fatura: FaturaWithCliente) => {
        const usinaId = fatura.usinaId || fatura.cliente?.usinaId;
        const usina = usinas.find(u => u.id === usinaId);
        return <span className="text-sm">{usina?.nome || "-"}</span>;
      }
    },
    {
      key: "mesReferencia",
      header: "Mês Ref.",
      cell: (fatura: FaturaWithCliente) => (
        <span className="font-medium">{fatura.mesReferencia}</span>
      ),
    },
    {
      key: "dataVencimento",
      header: "Vencimento",
      cell: (fatura: FaturaWithCliente) => (
        <span className={fatura.dataVencimento ? "" : "text-muted-foreground italic"}>
          {fatura.dataVencimento || "-"}
        </span>
      ),
    },
    {
      key: "valorFinal",
      header: "Valor",
      className: "text-right",
      cell: (fatura: FaturaWithCliente) => (
        <span className="font-mono font-medium">
          {formatCurrency(fatura.valorTotal || "0")}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      cell: (fatura: FaturaWithCliente) => (
        <StatusBadge status={fatura.status} />
      ),
    },
    {
      key: "actions",
      header: "",
      className: "w-32",
      cell: (fatura: FaturaWithCliente) => (
        <div className="flex items-center gap-1 justify-end">
          {/* Status: Aguardando Upload */}
          {fatura.status === "aguardando_upload" && (
            <Button
              variant="ghost"
              size="icon"
              asChild
              title="Fazer Upload"
            >
              <Link href="/faturas/upload">
                <Upload className="h-4 w-4 text-blue-500" />
              </Link>
            </Button>
          )}

          {/* Status: Aguardando Pagamento */}
          {fatura.status === "aguardando_pagamento" && (
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.stopPropagation();
                updateStatusMutation.mutate({
                  id: fatura.id,
                  status: "pagamento_pendente_confirmacao",
                });
              }}
              title="Confirmar Pagamento (Operador)"
            >
              <Clock className="h-4 w-4 text-orange-500" />
            </Button>
          )}

          {/* Status: Pagamento Pendente de Confirmação */}
          {fatura.status === "pagamento_pendente_confirmacao" && isAdmin && (
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.stopPropagation();
                updateStatusMutation.mutate({
                  id: fatura.id,
                  status: "pago",
                });
              }}
              title="Marcar como Pago (Admin)"
            >
              <DollarSign className="h-4 w-4 text-green-500" />
            </Button>
          )}

          {/* Download PDF */}
          {fatura.arquivoPdfUrl && (
            <Button
              variant="ghost"
              size="icon"
              asChild
              title="Baixar Fatura"
            >
              <a href={fatura.arquivoPdfUrl} download target="_blank" rel="noopener noreferrer">
                <Download className="h-4 w-4" />
              </a>
            </Button>
          )}

          {/* Delete */}
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              if (confirm("Deseja realmente excluir esta fatura?")) {
                deleteMutation.mutate(fatura.id);
              }
            }}
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Faturas"
        description="Gerencie as faturas de energia dos seus clientes"
        actions={
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={() => generatePlaceholdersMutation.mutate(selectedMonth)}
              disabled={generatePlaceholdersMutation.isPending || selectedMonth === "all"}
            >
              {generatePlaceholdersMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <PlusCircle className="h-4 w-4 mr-2" />
              )}
              Gerar Pendências ({selectedMonth})
            </Button>
            <Button asChild>
              <Link href="/faturas/upload">
                <Upload className="h-4 w-4 mr-2" />
                Upload Faturas
              </Link>
            </Button>
          </div>
        }
      />

      <div className="flex flex-col md:flex-row items-center gap-4 bg-muted/20 p-4 rounded-lg">
        <div className="flex items-center gap-2 w-full md:w-auto">
          <span className="text-sm font-medium">Mês:</span>
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-[140px] bg-background">
              <SelectValue placeholder="Mês" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {getRecentMonths().map((month) => (
                <SelectItem key={month} value={month}>
                  {month}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <span className="text-sm font-medium">Usina:</span>
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

        <div className="flex items-center gap-2 w-full md:w-auto">
          <span className="text-sm font-medium">Status:</span>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px] bg-background">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="aguardando_upload">Aguardando Upload</SelectItem>
              <SelectItem value="aguardando_pagamento">Aguardando Pagamento</SelectItem>
              <SelectItem value="pagamento_pendente_confirmacao">Pagamento Pendente</SelectItem>
              <SelectItem value="pago">Pago</SelectItem>
              <SelectItem value="pendente">Pendente (Legado)</SelectItem>
              <SelectItem value="processada">Processada (Legado)</SelectItem>
              <SelectItem value="enviada">Enviada (Legado)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <DataTable
            columns={columns}
            data={faturas}
            isLoading={isLoading}
            getRowKey={(fatura) => fatura.id}
            emptyMessage="Nenhuma fatura encontrada com os filtros selecionados"
          />
        </CardContent>
      </Card>
    </div>
  );
}
