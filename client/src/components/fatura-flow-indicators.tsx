import { CheckCircle, Circle, Upload, DollarSign, FileText, Send, CheckCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Fatura, Cliente } from "@shared/schema";

interface FaturaFlowIndicatorsProps {
  fatura: Fatura;
  cliente: Cliente;
  compact?: boolean;
}

export function FaturaFlowIndicators({ fatura, cliente, compact = false }: FaturaFlowIndicatorsProps) {
  const hasUpload = !!fatura.arquivoPdfUrl;
  const isPaidToConcessionaria = fatura.status === "pago" || fatura.status === "pagamento_pendente_confirmacao";

  // Cliente flow (fatura com desconto)
  const faturaClienteGerada = !!fatura.faturaClienteGeradaAt;
  const faturaClienteEnviada = !!fatura.faturaClienteEnviadaAt;
  const faturaClienteRecebida = !!fatura.faturaClienteRecebidaAt;

  // Cliente de uso próprio não tem fluxo B
  const isUsoProprio = !cliente.isPagante;

  if (compact) {
    return (
      <div className="flex items-center gap-3">
        {/* Fluxo A - Concessionária */}
        <div className="flex items-center gap-2">
          <StatusIcon status={hasUpload ? "done" : "pending"} icon={Upload} size="sm" />
          <StatusIcon status={isPaidToConcessionaria ? "done" : "pending"} icon={DollarSign} size="sm" />
        </div>

        {/* Separador */}
        {!isUsoProprio && <div className="h-4 w-px bg-border" />}

        {/* Fluxo B - Cliente (apenas se não for uso próprio) */}
        {!isUsoProprio && (
          <div className="flex items-center gap-2">
            <StatusIcon status={faturaClienteGerada ? "done" : "pending"} icon={FileText} size="sm" />
            <StatusIcon status={faturaClienteEnviada ? "done" : "pending"} icon={Send} size="sm" />
            <StatusIcon status={faturaClienteRecebida ? "done" : "pending"} icon={CheckCheck} size="sm" />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Fluxo A - Fatura da Concessionária */}
      <div className="space-y-2">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Fatura da Concessionária
        </h4>
        <div className="flex items-center gap-3">
          <FlowStep
            icon={Upload}
            label="Upload"
            status={hasUpload ? "done" : "pending"}
          />
          <FlowArrow />
          <FlowStep
            icon={DollarSign}
            label="Pago"
            status={isPaidToConcessionaria ? "done" : "pending"}
          />
        </div>
      </div>

      {/* Fluxo B - Fatura do Cliente (apenas se não for uso próprio) */}
      {!isUsoProprio && (
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Fatura com Desconto
          </h4>
          <div className="flex items-center gap-3">
            <FlowStep
              icon={FileText}
              label="Gerada"
              status={faturaClienteGerada ? "done" : "pending"}
            />
            <FlowArrow />
            <FlowStep
              icon={Send}
              label="Enviada"
              status={faturaClienteEnviada ? "done" : "pending"}
            />
            <FlowArrow />
            <FlowStep
              icon={CheckCheck}
              label="Recebida"
              status={faturaClienteRecebida ? "done" : "pending"}
            />
          </div>
        </div>
      )}
    </div>
  );
}

interface FlowStepProps {
  icon: React.ElementType;
  label: string;
  status: "done" | "pending" | "error";
}

function FlowStep({ icon: Icon, label, status }: FlowStepProps) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className={cn(
          "flex h-10 w-10 items-center justify-center rounded-full border-2 transition-colors",
          status === "done" && "border-green-500 bg-green-50 dark:bg-green-950/30",
          status === "pending" && "border-muted-foreground/30 bg-muted/30",
          status === "error" && "border-destructive bg-destructive/10"
        )}
      >
        <Icon
          className={cn(
            "h-5 w-5",
            status === "done" && "text-green-600 dark:text-green-400",
            status === "pending" && "text-muted-foreground",
            status === "error" && "text-destructive"
          )}
        />
      </div>
      <span
        className={cn(
          "text-xs font-medium",
          status === "done" && "text-foreground",
          status === "pending" && "text-muted-foreground",
          status === "error" && "text-destructive"
        )}
      >
        {label}
      </span>
    </div>
  );
}

function FlowArrow() {
  return (
    <div className="flex-1 min-w-[20px] max-w-[40px]">
      <div className="h-0.5 bg-muted-foreground/20 relative">
        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-0 h-0 border-t-[4px] border-t-transparent border-b-[4px] border-b-transparent border-l-[6px] border-l-muted-foreground/20" />
      </div>
    </div>
  );
}

interface StatusIconProps {
  status: "done" | "pending" | "error";
  icon: React.ElementType;
  size?: "sm" | "md";
}

function StatusIcon({ status, icon: Icon, size = "md" }: StatusIconProps) {
  const sizeClasses = size === "sm" ? "h-5 w-5" : "h-6 w-6";
  const iconSizeClasses = size === "sm" ? "h-3 w-3" : "h-4 w-4";

  const getTooltipText = () => {
    if (Icon === Upload) return status === "done" ? "Fatura enviada" : "Aguardando upload";
    if (Icon === DollarSign) return status === "done" ? "Pago à concessionária" : "Pagamento pendente";
    if (Icon === FileText) return status === "done" ? "Fatura gerada" : "Fatura não gerada";
    if (Icon === Send) return status === "done" ? "Enviada ao cliente" : "Não enviada";
    if (Icon === CheckCheck) return status === "done" ? "Recebida do cliente" : "Não recebida";
    return status === "done" ? "Concluído" : "Pendente";
  };

  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-full border-2 cursor-help",
        sizeClasses,
        status === "done" && "border-green-500 bg-green-50 dark:bg-green-950/30",
        status === "pending" && "border-muted-foreground/30 bg-muted/30",
        status === "error" && "border-destructive bg-destructive/10"
      )}
      title={getTooltipText()}
    >
      <Icon
        className={cn(
          iconSizeClasses,
          status === "done" && "text-green-600 dark:text-green-400",
          status === "pending" && "text-muted-foreground",
          status === "error" && "text-destructive"
        )}
      />
    </div>
  );
}
