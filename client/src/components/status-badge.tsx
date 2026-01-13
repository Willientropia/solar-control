import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Status = 
  | "pendente" 
  | "processada" 
  | "enviada" 
  | "ativo" 
  | "inativo"
  | "aguardando_upload"
  | "aguardando_pagamento"
  | "pagamento_pendente_confirmacao"
  | "pago";

interface StatusBadgeProps {
  status: Status | string;
  className?: string;
}

const statusConfig: Record<string, { label: string; className: string }> = {
  pendente: {
    label: "Pendente",
    className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  },
  processada: {
    label: "Processada",
    className: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  },
  enviada: {
    label: "Enviada",
    className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  },
  ativo: {
    label: "Ativo",
    className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  },
  inativo: {
    label: "Inativo",
    className: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
  },
  aguardando_upload: {
    label: "Aguardando Upload",
    className: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
  },
  aguardando_pagamento: {
    label: "Aguardando Pagamento",
    className: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
  },
  pagamento_pendente_confirmacao: {
    label: "Confirmar Pagamento",
    className: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
  },
  pago: {
    label: "Pago",
    className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  },
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status] || {
    label: status,
    className: "bg-gray-100 text-gray-800",
  };

  return (
    <Badge
      variant="secondary"
      className={cn("font-medium", config.className, className)}
    >
      {config.label}
    </Badge>
  );
}
