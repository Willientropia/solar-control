import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Download,
  MoreVertical,
  FileText,
  Send,
  CheckCheck,
  XCircle,
  Trash2,
  Clock,
  AlertTriangle,
  Edit,
  Calendar,
} from "lucide-react";
import { FaturaFlowIndicators } from "./fatura-flow-indicators";
import { formatCurrency, cn } from "@/lib/utils";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Fatura, Cliente } from "@shared/schema";
import { Link } from "wouter";

interface FaturaStatusCardProps {
  fatura: Fatura;
  cliente: Cliente;
  onRefresh?: () => void;
  onEdit?: (fatura: Fatura & { cliente?: Cliente }) => void;
}

export function FaturaStatusCard({ fatura, cliente, onRefresh, onEdit }: FaturaStatusCardProps) {
  const { toast } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);

  const isUsoProprio = !cliente.isPagante;

  // Calculate days until PDF expires (30 days)
  const getDaysUntilExpiration = () => {
    if (!fatura.createdAt) return null;
    const createdDate = new Date(fatura.createdAt);
    const expirationDate = new Date(createdDate.getTime() + 30 * 24 * 60 * 60 * 1000);
    const now = new Date();
    const daysLeft = Math.ceil((expirationDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
    return { daysLeft, expirationDate };
  };

  const expirationInfo = getDaysUntilExpiration();

  // Check payment due date
  const getVencimentoStatus = () => {
    if (!fatura.dataVencimento) return null;

    try {
      // Parse DD/MM/YYYY format
      const [day, month, year] = fatura.dataVencimento.split('/');
      const dueDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      dueDate.setHours(0, 0, 0, 0);

      const diffTime = dueDate.getTime() - now.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      const isPaid = fatura.status === "pago";

      if (isPaid) {
        return { status: "paid", days: diffDays, text: "Pago" };
      } else if (diffDays < 0) {
        return { status: "overdue", days: Math.abs(diffDays), text: `Atrasado há ${Math.abs(diffDays)}d` };
      } else if (diffDays === 0) {
        return { status: "today", days: 0, text: "Vence hoje" };
      } else if (diffDays <= 3) {
        return { status: "urgent", days: diffDays, text: `Vence em ${diffDays}d` };
      } else if (diffDays <= 7) {
        return { status: "soon", days: diffDays, text: `Vence em ${diffDays}d` };
      } else {
        return { status: "normal", days: diffDays, text: `Vence em ${diffDays}d` };
      }
    } catch (e) {
      return null;
    }
  };

  const vencimentoStatus = getVencimentoStatus();

  // Get status for dropdowns
  const getClienteStatus = () => {
    if (!fatura.faturaClienteGeradaAt) return "nao_gerada";
    if (!fatura.faturaClienteEnviadaAt) return "gerada";
    if (!fatura.faturaClienteRecebidaAt) return "enviada";
    return "recebida";
  };

  // Mutations
  const updateStatusMutation = useMutation({
    mutationFn: (status: string) => apiRequest("PATCH", `/api/faturas/${fatura.id}/status`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/faturas"] });
      toast({ title: "Status atualizado" });
      onRefresh?.();
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao atualizar status", description: error.message, variant: "destructive" });
    },
  });

  const marcarEnviadaMutation = useMutation({
    mutationFn: () => apiRequest("PATCH", `/api/faturas/${fatura.id}/marcar-enviada`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/faturas"] });
      toast({ title: "Fatura marcada como enviada" });
      onRefresh?.();
    },
  });

  const desmarcarEnviadaMutation = useMutation({
    mutationFn: () => apiRequest("PATCH", `/api/faturas/${fatura.id}/desmarcar-enviada`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/faturas"] });
      toast({ title: "Envio desmarcado" });
      onRefresh?.();
    },
  });

  const marcarRecebidaMutation = useMutation({
    mutationFn: () => apiRequest("PATCH", `/api/faturas/${fatura.id}/marcar-recebida`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/faturas"] });
      toast({ title: "Fatura marcada como recebida" });
      onRefresh?.();
    },
  });

  const desmarcarRecebidaMutation = useMutation({
    mutationFn: () => apiRequest("PATCH", `/api/faturas/${fatura.id}/desmarcar-recebida`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/faturas"] });
      toast({ title: "Recebimento desmarcado" });
      onRefresh?.();
    },
  });

  const generatePdfMutation = useMutation({
    mutationFn: async () => {
      setIsGenerating(true);

      // Debug: Mostrar valores da fatura antes de gerar PDF
      const consumoScee = parseFloat(fatura.consumoScee || '0');
      const consumoNaoCompensado = parseFloat(fatura.consumoNaoCompensado || '0');
      const valorTotal = parseFloat(fatura.valorTotal || '0');
      const precoKwh = parseFloat(fatura.precoKwh || '0');
      const precoFioB = parseFloat(fatura.precoFioB || '0');
      const contribuicaoIluminacao = parseFloat(fatura.contribuicaoIluminacao || '0');

      console.log('============================================================');
      console.log('DEBUG - CÁLCULO DA TAXA MÍNIMA (FRONTEND)');
      console.log('============================================================');
      console.log('Valores da fatura:');
      console.log('  Consumo SCEE:', consumoScee, 'kWh');
      console.log('  Consumo Não Compensado:', consumoNaoCompensado, 'kWh');
      console.log('  Valor Total:', `R$ ${valorTotal.toFixed(2)}`);
      console.log('  Preço kWh:', `R$ ${precoKwh.toFixed(6)}`);
      console.log('  Preço Fio B:', `R$ ${precoFioB.toFixed(6)}`);
      console.log('  Contribuição Iluminação:', `R$ ${contribuicaoIluminacao.toFixed(2)}`);
      console.log('');
      console.log('Cálculos intermediários:');
      const fiobValor = consumoScee * precoFioB;
      const consumoNaoCompensadoValor = consumoNaoCompensado * precoKwh;
      console.log('  FIOB = Consumo SCEE × Preço Fio B');
      console.log(`  FIOB = ${consumoScee} × ${precoFioB.toFixed(6)} = R$ ${fiobValor.toFixed(2)}`);
      console.log(`  Consumo Não Compensado × Preço kWh = ${consumoNaoCompensado} × ${precoKwh.toFixed(6)} = R$ ${consumoNaoCompensadoValor.toFixed(2)}`);
      console.log('');
      console.log('Fórmula da Taxa Mínima:');
      console.log('  Taxa Mínima = Valor Total - (Consumo Não Compensado × Preço kWh + FIOB)');
      const taxaMinima = valorTotal - (consumoNaoCompensadoValor + fiobValor);
      console.log(`  Taxa Mínima = ${valorTotal.toFixed(2)} - (${consumoNaoCompensadoValor.toFixed(2)} + ${fiobValor.toFixed(2)})`);
      console.log(`  Taxa Mínima = ${valorTotal.toFixed(2)} - ${(consumoNaoCompensadoValor + fiobValor).toFixed(2)}`);
      console.log(`  Taxa Mínima = R$ ${taxaMinima.toFixed(2)}`);
      console.log('============================================================');
      console.log('');

      const response = await fetch(`/api/faturas/${fatura.id}/generate-pdf`, {
        method: "POST",
        credentials: "include",
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Erro ao gerar PDF");
      }
      return response.json();
    },
    onSuccess: (data) => {
      setIsGenerating(false);

      console.log('PDF gerado com sucesso:', data);

      // Download the PDF (always opens in new tab)
      if (data.pdfUrl) {
        window.open(data.pdfUrl, "_blank");
      }

      toast({ title: "PDF baixado com sucesso" });
      // Não precisa invalidar queries ou refresh, pois não salvamos no DB
    },
    onError: (error: Error) => {
      setIsGenerating(false);
      toast({
        title: "Erro ao gerar PDF",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", `/api/faturas/${fatura.id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/faturas"] });
      toast({ title: "Fatura removida" });
      onRefresh?.();
    },
    onError: () => {
      toast({ title: "Erro ao remover fatura", variant: "destructive" });
    },
  });

  const handleDelete = () => {
    if (confirm("Deseja realmente excluir esta fatura?")) {
      deleteMutation.mutate();
    }
  };

  const handleClienteStatusChange = (newStatus: string) => {
    // Handle status changes for cliente fatura
    switch (newStatus) {
      case "nao_gerada":
        // Clear all timestamps
        if (fatura.faturaClienteGeradaAt) desmarcarEnviadaMutation.mutate();
        if (fatura.faturaClienteEnviadaAt) desmarcarEnviadaMutation.mutate();
        if (fatura.faturaClienteRecebidaAt) desmarcarRecebidaMutation.mutate();
        break;
      case "gerada":
        if (!fatura.faturaClienteGeradaAt) {
          toast({ title: "Gere a fatura primeiro" });
        }
        if (fatura.faturaClienteEnviadaAt) desmarcarEnviadaMutation.mutate();
        if (fatura.faturaClienteRecebidaAt) desmarcarRecebidaMutation.mutate();
        break;
      case "enviada":
        if (!fatura.faturaClienteGeradaAt) {
          toast({ title: "Gere a fatura primeiro" });
        } else if (!fatura.faturaClienteEnviadaAt) {
          marcarEnviadaMutation.mutate();
        }
        if (fatura.faturaClienteRecebidaAt) desmarcarRecebidaMutation.mutate();
        break;
      case "recebida":
        if (!fatura.faturaClienteGeradaAt) {
          toast({ title: "Gere a fatura primeiro" });
        } else if (!fatura.faturaClienteEnviadaAt) {
          toast({ title: "Marque como enviada primeiro" });
        } else if (!fatura.faturaClienteRecebidaAt) {
          marcarRecebidaMutation.mutate();
        }
        break;
    }
  };

  return (
    <Card className="hover:border-primary/50 transition-colors">
      <CardContent className="p-4">
        <div className="space-y-4">
          {/* Header - Cliente info */}
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-lg">{cliente.nome}</h3>
                {isUsoProprio && (
                  <Badge variant="secondary" className="text-xs">
                    Uso Próprio
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                UC: {cliente.unidadeConsumidora}
                {cliente.numeroContrato && ` • Contrato: ${cliente.numeroContrato}`}
              </p>
            </div>

            {/* Delete button */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleDelete} className="text-destructive">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Excluir Fatura
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Flow indicators */}
          <FaturaFlowIndicators fatura={fatura} cliente={cliente} compact />

          {/* Due date */}
          {vencimentoStatus && (
            <Badge
              variant="outline"
              className={cn(
                "flex items-center gap-1 text-xs w-fit",
                vencimentoStatus.status === "paid" && "border-green-500 text-green-600 dark:text-green-400",
                vencimentoStatus.status === "overdue" && "border-destructive text-destructive bg-destructive/10",
                vencimentoStatus.status === "today" && "border-orange-500 text-orange-600 dark:text-orange-400 animate-pulse",
                vencimentoStatus.status === "urgent" && "border-red-500 text-red-600 dark:text-red-400",
                vencimentoStatus.status === "soon" && "border-orange-500 text-orange-600 dark:text-orange-400",
                vencimentoStatus.status === "normal" && "border-muted-foreground/30"
              )}
            >
              <Calendar className="h-3 w-3" />
              {fatura.dataVencimento} • {vencimentoStatus.text}
            </Badge>
          )}

          {/* Action buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Download original - always visible, dimmed if expired */}
            {fatura.arquivoPdfUrl && (
              <Button
                variant="outline"
                size="sm"
                asChild
                className={cn(
                  expirationInfo && expirationInfo.daysLeft <= 0 && "opacity-50"
                )}
              >
                <a href={fatura.arquivoPdfUrl} download target="_blank" rel="noopener noreferrer">
                  <Download className="h-4 w-4 mr-2" />
                  Baixar Original
                </a>
              </Button>
            )}

            {/* Edit button - always visible, dimmed if expired */}
            {fatura.arquivoPdfUrl && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onEdit?.({ ...fatura, cliente })}
                disabled={expirationInfo && expirationInfo.daysLeft <= 0}
                className={cn(
                  expirationInfo && expirationInfo.daysLeft <= 0 && "opacity-50"
                )}
              >
                <Edit className="h-4 w-4 mr-2" />
                Editar
              </Button>
            )}

            {/* Generate discounted fatura (always on-demand) */}
            {!isUsoProprio && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => generatePdfMutation.mutate()}
                disabled={isGenerating}
              >
                <Download className="h-4 w-4 mr-2" />
                {isGenerating ? "Gerando..." : "Baixar c/ Desconto"}
              </Button>
            )}

            {/* Expiration warning */}
            {expirationInfo && expirationInfo.daysLeft <= 7 && expirationInfo.daysLeft > 0 && (
              <Badge variant="outline" className="border-orange-500 text-orange-600 dark:text-orange-400">
                <Clock className="h-3 w-3 mr-1" />
                PDF expira em {expirationInfo.daysLeft}d
              </Badge>
            )}

            {expirationInfo && expirationInfo.daysLeft <= 0 && (
              <Badge variant="outline" className="border-destructive text-destructive">
                <AlertTriangle className="h-3 w-3 mr-1" />
                PDF expirado
              </Badge>
            )}
          </div>

          {/* Status dropdowns */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t">
            {/* Status da Concessionária */}
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Fatura da Concessionária</Label>
              <Select
                value={fatura.status}
                onValueChange={(value) => updateStatusMutation.mutate(value)}
              >
                <SelectTrigger className="h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="aguardando_upload">Aguardando Upload</SelectItem>
                  <SelectItem value="aguardando_pagamento">Aguardando Pagamento</SelectItem>
                  <SelectItem value="pagamento_pendente_confirmacao">Pagamento Pendente</SelectItem>
                  <SelectItem value="pago">Pago</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Status da Fatura do Cliente (apenas se não for uso próprio) */}
            {!isUsoProprio && (
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Fatura do Cliente</Label>
                <Select
                  value={getClienteStatus()}
                  onValueChange={handleClienteStatusChange}
                >
                  <SelectTrigger className="h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nao_gerada">Não Gerada</SelectItem>
                    <SelectItem value="gerada">Gerada</SelectItem>
                    <SelectItem value="enviada">Enviada</SelectItem>
                    <SelectItem value="recebida">Recebida</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* Values */}
          <div className="flex items-center gap-4 pt-2 border-t">
            <div>
              <p className="text-xs text-muted-foreground">Valor Total</p>
              <p className="text-sm font-mono font-semibold">
                {formatCurrency(fatura.valorTotal || "0")}
              </p>
            </div>

            {!isUsoProprio && fatura.valorComDesconto && (
              <div>
                <p className="text-xs text-muted-foreground">Valor c/ Desconto</p>
                <p className="text-sm font-mono font-semibold text-green-600 dark:text-green-400">
                  {formatCurrency(fatura.valorComDesconto)}
                </p>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
