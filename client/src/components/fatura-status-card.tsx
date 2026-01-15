import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { formatCurrency } from "@/lib/utils";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Fatura, Cliente } from "@shared/schema";
import { Link } from "wouter";

interface FaturaStatusCardProps {
  fatura: Fatura;
  cliente: Cliente;
  onRefresh?: () => void;
}

export function FaturaStatusCard({ fatura, cliente, onRefresh }: FaturaStatusCardProps) {
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

  // Mutations
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
      queryClient.invalidateQueries({ queryKey: ["/api/faturas"] });

      // Download the PDF
      if (data.pdfUrl) {
        window.open(data.pdfUrl, "_blank");
      }

      toast({ title: "PDF gerado com sucesso" });
      onRefresh?.();
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

  return (
    <Card className="hover:border-primary/50 transition-colors">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          {/* Left side - Cliente info and indicators */}
          <div className="flex-1 space-y-3">
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

              {/* Actions dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {/* Fatura Original */}
                  {fatura.arquivoPdfUrl && (
                    <DropdownMenuItem asChild>
                      <a href={fatura.arquivoPdfUrl} download target="_blank" rel="noopener noreferrer">
                        <Download className="h-4 w-4 mr-2" />
                        Baixar Fatura Original
                      </a>
                    </DropdownMenuItem>
                  )}

                  {/* Fatura com Desconto */}
                  {!isUsoProprio && (
                    <>
                      <DropdownMenuSeparator />

                      {fatura.faturaGeradaUrl ? (
                        <DropdownMenuItem asChild>
                          <a href={fatura.faturaGeradaUrl} download target="_blank" rel="noopener noreferrer">
                            <Download className="h-4 w-4 mr-2" />
                            Baixar Fatura com Desconto
                          </a>
                        </DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem onClick={() => generatePdfMutation.mutate()} disabled={isGenerating}>
                          <FileText className="h-4 w-4 mr-2" />
                          {isGenerating ? "Gerando..." : "Gerar Fatura com Desconto"}
                        </DropdownMenuItem>
                      )}

                      {/* Marcar/Desmarcar Enviada */}
                      {fatura.faturaClienteGeradaAt && (
                        <>
                          {fatura.faturaClienteEnviadaAt ? (
                            <DropdownMenuItem onClick={() => desmarcarEnviadaMutation.mutate()}>
                              <XCircle className="h-4 w-4 mr-2" />
                              Desmarcar como Enviada
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem onClick={() => marcarEnviadaMutation.mutate()}>
                              <Send className="h-4 w-4 mr-2" />
                              Marcar como Enviada
                            </DropdownMenuItem>
                          )}
                        </>
                      )}

                      {/* Marcar/Desmarcar Recebida */}
                      {fatura.faturaClienteEnviadaAt && (
                        <>
                          {fatura.faturaClienteRecebidaAt ? (
                            <DropdownMenuItem onClick={() => desmarcarRecebidaMutation.mutate()}>
                              <XCircle className="h-4 w-4 mr-2" />
                              Desmarcar como Recebida
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem onClick={() => marcarRecebidaMutation.mutate()}>
                              <CheckCheck className="h-4 w-4 mr-2" />
                              Marcar como Recebida
                            </DropdownMenuItem>
                          )}
                        </>
                      )}
                    </>
                  )}

                  <DropdownMenuSeparator />

                  {fatura.status === "aguardando_upload" && (
                    <DropdownMenuItem asChild>
                      <Link href="/faturas/upload">
                        <FileText className="h-4 w-4 mr-2" />
                        Fazer Upload
                      </Link>
                    </DropdownMenuItem>
                  )}

                  <DropdownMenuItem onClick={handleDelete} className="text-destructive">
                    <Trash2 className="h-4 w-4 mr-2" />
                    Excluir
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Flow indicators */}
            <FaturaFlowIndicators fatura={fatura} cliente={cliente} compact />

            {/* Due date and quick actions */}
            <div className="flex items-center gap-2 pt-2">
              {/* Due date badge */}
              {vencimentoStatus && (
                <Badge
                  variant="outline"
                  className={cn(
                    "flex items-center gap-1 text-xs",
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

              {/* Quick action buttons */}
              <div className="flex items-center gap-1 ml-auto">
                {fatura.arquivoPdfUrl && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2"
                    asChild
                    title="Baixar fatura original"
                  >
                    <a href={fatura.arquivoPdfUrl} download target="_blank" rel="noopener noreferrer">
                      <Download className="h-4 w-4" />
                    </a>
                  </Button>
                )}

                {fatura.arquivoPdfUrl && expirationInfo && expirationInfo.daysLeft > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2"
                    asChild
                    title="Editar fatura"
                  >
                    <Link href={`/faturas/upload?edit=${fatura.id}`}>
                      <Edit className="h-4 w-4" />
                    </Link>
                  </Button>
                )}
              </div>
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

              {/* Expiration warning */}
              {expirationInfo && expirationInfo.daysLeft <= 7 && expirationInfo.daysLeft > 0 && (
                <div className="ml-auto flex items-center gap-1 text-orange-600 dark:text-orange-400">
                  <Clock className="h-4 w-4" />
                  <span className="text-xs font-medium">
                    Expira em {expirationInfo.daysLeft}d
                  </span>
                </div>
              )}

              {expirationInfo && expirationInfo.daysLeft <= 0 && (
                <div className="ml-auto flex items-center gap-1 text-destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <span className="text-xs font-medium">
                    PDF expirado
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
