import { useState } from "react";
import { ChevronDown, ChevronUp, Zap, CheckCircle, Clock, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FaturaStatusCard } from "./fatura-status-card";
import { cn } from "@/lib/utils";
import type { Usina, Cliente, Fatura } from "@shared/schema";

interface UsinaSectionProps {
  usina: Usina;
  faturas: Array<Fatura & { cliente?: Cliente }>;
  clientes: Cliente[];
  onRefresh?: () => void;
}

export function UsinaSection({ usina, faturas, clientes, onRefresh }: UsinaSectionProps) {
  const [isExpanded, setIsExpanded] = useState(true);

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
