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
  Eye,
  Trash2,
  CheckCircle,
  Send,
} from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Fatura, Cliente } from "@shared/schema";
import { formatCurrency } from "@/lib/utils";

interface FaturaWithCliente extends Fatura {
  cliente?: Cliente;
}

export default function FaturasPage() {
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { data: faturas = [], isLoading } = useQuery<FaturaWithCliente[]>({
    queryKey: ["/api/faturas", statusFilter !== "all" ? statusFilter : undefined],
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      apiRequest("PATCH", `/api/faturas/${id}/status`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/faturas"] });
      toast({ title: "Status atualizado!" });
    },
    onError: () => {
      toast({ title: "Erro ao atualizar status", variant: "destructive" });
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

  const filteredFaturas =
    statusFilter === "all"
      ? faturas
      : faturas.filter((f) => f.status === statusFilter);

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
      key: "mesReferencia",
      header: "Mês Ref.",
      cell: (fatura: FaturaWithCliente) => (
        <span className="font-medium">{fatura.mesReferencia}</span>
      ),
    },
    {
      key: "valorOriginal",
      header: "Valor Original",
      className: "text-right",
      cell: (fatura: FaturaWithCliente) => (
        <span className="font-mono text-muted-foreground">
          {formatCurrency(fatura.valorSemDesconto)}
        </span>
      ),
    },
    {
      key: "valorFinal",
      header: "Valor Final",
      className: "text-right",
      cell: (fatura: FaturaWithCliente) => (
        <span className="font-mono font-medium">
          {formatCurrency(fatura.valorComDesconto)}
        </span>
      ),
    },
    {
      key: "economia",
      header: "Economia",
      className: "text-right",
      cell: (fatura: FaturaWithCliente) => (
        <span className="font-mono text-green-600 dark:text-green-400">
          {formatCurrency(fatura.economia)}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      cell: (fatura: FaturaWithCliente) => (
        <StatusBadge status={fatura.status as "pendente" | "processada" | "enviada"} />
      ),
    },
    {
      key: "actions",
      header: "",
      className: "w-32",
      cell: (fatura: FaturaWithCliente) => (
        <div className="flex items-center gap-1">
          {fatura.status === "pendente" && (
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.stopPropagation();
                updateStatusMutation.mutate({
                  id: fatura.id,
                  status: "processada",
                });
              }}
              title="Marcar como processada"
              data-testid={`button-process-fatura-${fatura.id}`}
            >
              <CheckCircle className="h-4 w-4 text-blue-500" />
            </Button>
          )}
          {fatura.status === "processada" && (
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.stopPropagation();
                updateStatusMutation.mutate({
                  id: fatura.id,
                  status: "enviada",
                });
              }}
              title="Marcar como enviada"
              data-testid={`button-send-fatura-${fatura.id}`}
            >
              <Send className="h-4 w-4 text-green-500" />
            </Button>
          )}
          {fatura.faturaGeradaUrl && (
            <Button
              variant="ghost"
              size="icon"
              asChild
              title="Baixar fatura"
              data-testid={`button-download-fatura-${fatura.id}`}
            >
              <a href={fatura.faturaGeradaUrl} download>
                <Download className="h-4 w-4" />
              </a>
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              if (confirm("Deseja realmente excluir esta fatura?")) {
                deleteMutation.mutate(fatura.id);
              }
            }}
            data-testid={`button-delete-fatura-${fatura.id}`}
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
          <Button asChild data-testid="button-upload-faturas">
            <Link href="/faturas/upload">
              <Upload className="h-4 w-4 mr-2" />
              Upload Faturas
            </Link>
          </Button>
        }
      />

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Filtrar por:</span>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40" data-testid="select-filter-status">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="pendente">Pendentes</SelectItem>
              <SelectItem value="processada">Processadas</SelectItem>
              <SelectItem value="enviada">Enviadas</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Badge variant="secondary">
            {filteredFaturas.length} fatura(s)
          </Badge>
        </div>
      </div>

      {faturas.length === 0 && !isLoading ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">
              Nenhuma fatura cadastrada
            </h3>
            <p className="text-muted-foreground text-center mb-4">
              Faça o upload das faturas da concessionária para começar.
            </p>
            <Button asChild>
              <Link href="/faturas/upload">
                <Upload className="h-4 w-4 mr-2" />
                Upload Faturas
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <DataTable
          columns={columns}
          data={filteredFaturas}
          isLoading={isLoading}
          getRowKey={(fatura) => fatura.id}
          emptyMessage="Nenhuma fatura encontrada"
        />
      )}
    </div>
  );
}
