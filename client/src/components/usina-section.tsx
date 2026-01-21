import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { ChevronDown, ChevronUp, Zap, CheckCircle, Clock, XCircle, Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FaturaStatusCard } from "./fatura-status-card";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, authenticatedFetch } from "@/lib/queryClient";
import type { Usina, Cliente, Fatura } from "@shared/schema";

interface UsinaSectionProps {
  usina: Usina;
  faturas: Array<Fatura & { cliente?: Cliente }>;
  clientes: Cliente[];
  onRefresh?: () => void;
  onEditFatura?: (fatura: Fatura & { cliente?: Cliente }) => void;
}

export function UsinaSection({ usina, faturas, clientes, onRefresh, onEditFatura }: UsinaSectionProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const { toast } = useToast();

  // Get mesReferencia from first fatura (all faturas in this view should be from the same month)
  const mesReferencia = faturas.length > 0 ? faturas[0].mesReferencia : null;

  // Count faturas com desconto (clientes pagantes)
  const faturasComDesconto = faturas.filter(f => {
    const cliente = clientes.find(c => c.id === f.clienteId);
    return cliente?.isPagante === true;
  }).length;

  // Mutation to download ZIP
  const downloadZipMutation = useMutation({
    mutationFn: async () => {
      if (!mesReferencia) {
        throw new Error("Nenhuma fatura encontrada para baixar");
      }

      const response = await authenticatedFetch('/api/faturas/download-usina-zip', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          usinaId: usina.id,
          mesReferencia: mesReferencia,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Erro ao gerar ZIP');
      }

      // Get the blob from response
      const blob = await response.blob();

      // Create download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `faturas_${mesReferencia.replace('/', '_')}.zip`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    },
    onSuccess: () => {
      toast({
        title: "ZIP gerado com sucesso!",
        description: "As faturas foram baixadas em um arquivo ZIP."
      });
      onRefresh?.();
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao gerar ZIP",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Get unique clients for this usina with their faturas
  const clientesData = clientes
    .filter(c => c.usinaId === usina.id)
    .sort((a, b) => {
      // Sort by contract number
      const aNum = a.numeroContrato || "";
      const bNum = b.numeroContrato || "";
      return aNum.localeCompare(bNum, undefined, { numeric: true });
    })
    .map(cliente => {
      const clienteFaturas = faturas.filter(f => f.clienteId === cliente.id);
      return { cliente, faturas: clienteFaturas };
    });

  // Calculate stats
  const totalClientes = clientesData.length;
  const totalFaturas = faturas.length;

  const faturasCompletas = faturas.filter(f => {
    const hasUpload = !!f.arquivoPdfUrl;
    const isPaid = f.status === "pago";
    const cliente = clientes.find(c => c.id === f.clienteId);

    if (cliente?.isPagante) {
      // Para clientes pagantes, precisa ter upload, pago à concessionária e recebido do cliente
      return hasUpload && isPaid && f.faturaClienteRecebidaAt;
    } else {
      // Para uso próprio, apenas upload e pago à concessionária
      return hasUpload && isPaid;
    }
  }).length;

  const faturasComPendencia = faturas.filter(f => {
    const hasUpload = !!f.arquivoPdfUrl;
    const isPaid = f.status === "pago";
    const cliente = clientes.find(c => c.id === f.clienteId);

    if (cliente?.isPagante) {
      return !hasUpload || !isPaid || !f.faturaClienteRecebidaAt;
    } else {
      return !hasUpload || !isPaid;
    }
  }).length;

  return (
    <div className="space-y-2">
      <Card className="border-l-4 border-l-primary">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full p-4 flex items-center justify-between hover:bg-accent/50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Zap className="h-5 w-5" />
            </div>

            <div className="text-left">
              <h2 className="text-lg font-semibold">{usina.nome}</h2>
              <p className="text-sm text-muted-foreground">
                UC: {usina.unidadeConsumidora}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Stats badges */}
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="gap-1">
                <span className="text-muted-foreground">Total:</span>
                <span className="font-semibold">{totalClientes}</span>
              </Badge>

              {faturasCompletas > 0 && (
                <Badge variant="outline" className="gap-1 border-green-500/50 text-green-600 dark:text-green-400">
                  <CheckCircle className="h-3 w-3" />
                  <span>{faturasCompletas}</span>
                </Badge>
              )}

              {faturasComPendencia > 0 && (
                <Badge variant="outline" className="gap-1 border-orange-500/50 text-orange-600 dark:text-orange-400">
                  <Clock className="h-3 w-3" />
                  <span>{faturasComPendencia}</span>
                </Badge>
              )}
            </div>

            {/* Download ZIP button */}
            {faturasComDesconto > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  downloadZipMutation.mutate();
                }}
                disabled={downloadZipMutation.isPending}
              >
                {downloadZipMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Gerando ZIP...
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4 mr-2" />
                    Baixar Todas ({faturasComDesconto})
                  </>
                )}
              </Button>
            )}

            <Button variant="ghost" size="icon">
              {isExpanded ? (
                <ChevronUp className="h-5 w-5" />
              ) : (
                <ChevronDown className="h-5 w-5" />
              )}
            </Button>
          </div>
        </button>
      </Card>

      {/* Cliente cards */}
      {isExpanded && (
        <div className="pl-4 space-y-2">
          {clientesData.length === 0 ? (
            <Card className="p-8 text-center">
              <p className="text-muted-foreground">
                Nenhum cliente cadastrado para esta usina
              </p>
            </Card>
          ) : (
            clientesData.map(({ cliente, faturas: clienteFaturas }) => (
              <div key={cliente.id}>
                {clienteFaturas.length > 0 ? (
                  clienteFaturas.map(fatura => (
                    <FaturaStatusCard
                      key={fatura.id}
                      fatura={fatura}
                      cliente={cliente}
                      onRefresh={onRefresh}
                      onEdit={onEditFatura}
                    />
                  ))
                ) : (
                  <Card className="p-4 border-dashed">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{cliente.nome}</p>
                        <p className="text-sm text-muted-foreground">
                          UC: {cliente.unidadeConsumidora}
                        </p>
                      </div>
                      <Badge variant="secondary">Sem fatura</Badge>
                    </div>
                  </Card>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
