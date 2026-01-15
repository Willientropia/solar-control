import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { PageHeader } from "@/components/page-header";
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
import { UsinaSection } from "@/components/usina-section";
import { useToast } from "@/hooks/use-toast";
import {
  Upload,
  PlusCircle,
  Loader2,
  CheckCircle,
  Clock,
  AlertCircle,
  FileText,
} from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Fatura, Cliente, Usina } from "@shared/schema";
import { formatCurrency } from "@/lib/utils";

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

export default function FaturasNewPage() {
  const { toast } = useToast();

  const [selectedMonth, setSelectedMonth] = useState<string>(getCurrentMonthRef());
  const [selectedUsinaId, setSelectedUsinaId] = useState<string>("all");

  const { data: usinas = [] } = useQuery<Usina[]>({
    queryKey: ["/api/usinas"],
  });

  const { data: clientes = [] } = useQuery<Cliente[]>({
    queryKey: ["/api/clientes"],
  });

  const { data: faturas = [], isLoading, refetch } = useQuery<FaturaWithCliente[]>({
    queryKey: ["/api/faturas", selectedUsinaId, selectedMonth],
    queryFn: () => apiRequest("GET", `/api/faturas?usinaId=${selectedUsinaId !== "all" ? selectedUsinaId : ""}&mesReferencia=${selectedMonth !== "all" ? selectedMonth : ""}`).then(r => r.json())
  });

  const generatePlaceholdersMutation = useMutation({
    mutationFn: (mesReferencia: string) =>
      apiRequest("POST", "/api/faturas/generate-placeholders", { mesReferencia }),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/faturas"] });
      toast({ title: "Faturas geradas!", description: data.message });
      refetch();
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao gerar faturas", description: error.message, variant: "destructive" });
    }
  });

  // Filter usinas based on selection
  const filteredUsinas = selectedUsinaId === "all"
    ? usinas
    : usinas.filter(u => u.id === selectedUsinaId);

  // Calculate overall statistics
  const totalClientes = clientes.length;
  const totalFaturas = faturas.length;

  const faturasCompletas = faturas.filter(f => {
    const hasUpload = !!f.arquivoPdfUrl;
    const isPaid = f.status === "pago";
    const cliente = clientes.find(c => c.id === f.clienteId);

    if (cliente?.isPagante) {
      return hasUpload && isPaid && f.faturaClienteRecebidaAt;
    } else {
      return hasUpload && isPaid;
    }
  }).length;

  const faturasPendentes = faturas.filter(f => {
    const hasUpload = !!f.arquivoPdfUrl;
    const isPaid = f.status === "pago";
    const cliente = clientes.find(c => c.id === f.clienteId);

    if (cliente?.isPagante) {
      return !hasUpload || !isPaid || !f.faturaClienteRecebidaAt;
    } else {
      return !hasUpload || !isPaid;
    }
  }).length;

  const valorTotal = faturas.reduce((sum, f) => sum + parseFloat(String(f.valorTotal || 0)), 0);

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Faturas"
        description="Gerencie as faturas de energia dos seus clientes de forma organizada por usina"
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

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row items-center gap-4">
            <div className="flex items-center gap-2 w-full md:w-auto">
              <span className="text-sm font-medium whitespace-nowrap">Mês:</span>
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
              <span className="text-sm font-medium whitespace-nowrap">Usina:</span>
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

            {selectedMonth !== "all" && (
              <Badge variant="outline" className="ml-auto">
                Visualizando: {selectedMonth}
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Summary Statistics */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total de Faturas</p>
                <p className="text-2xl font-bold">{totalFaturas}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-500/10 text-green-600 dark:text-green-400">
                <CheckCircle className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Completas</p>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">{faturasCompletas}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-500/10 text-orange-600 dark:text-orange-400">
                <Clock className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Pendentes</p>
                <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">{faturasPendentes}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Clientes</p>
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{totalClientes}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Usinas sections */}
      <div className="space-y-4">
        {isLoading ? (
          <Card>
            <CardContent className="p-12 flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </CardContent>
          </Card>
        ) : filteredUsinas.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                Nenhuma usina cadastrada. Cadastre uma usina para começar.
              </p>
            </CardContent>
          </Card>
        ) : (
          filteredUsinas.map((usina) => {
            const usinaFaturas = faturas.filter(f => {
              const cliente = clientes.find(c => c.id === f.clienteId);
              return cliente?.usinaId === usina.id;
            });

            const usinaClientes = clientes.filter(c => c.usinaId === usina.id);

            return (
              <UsinaSection
                key={usina.id}
                usina={usina}
                faturas={usinaFaturas}
                clientes={usinaClientes}
                onRefresh={refetch}
              />
            );
          })
        )}
      </div>

      {/* Empty state */}
      {!isLoading && filteredUsinas.length > 0 && faturas.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-lg font-medium mb-2">Nenhuma fatura encontrada</p>
            <p className="text-muted-foreground mb-4">
              {selectedMonth !== "all"
                ? `Não há faturas para o mês de ${selectedMonth}.`
                : "Não há faturas cadastradas."}
            </p>
            <Button
              onClick={() => generatePlaceholdersMutation.mutate(selectedMonth)}
              disabled={generatePlaceholdersMutation.isPending || selectedMonth === "all"}
            >
              {generatePlaceholdersMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <PlusCircle className="h-4 w-4 mr-2" />
              )}
              Gerar Pendências
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
