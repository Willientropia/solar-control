import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ClipboardList, User, FileText, Building2, Zap, Settings } from "lucide-react";
import { useState } from "react";
import type { AuditLog } from "@shared/schema";
import type { User as AuthUser } from "@shared/models/auth";

interface AuditLogWithUser extends AuditLog {
  user?: AuthUser;
}

const entidadeIcons: Record<string, typeof ClipboardList> = {
  usina: Building2,
  cliente: User,
  fatura: FileText,
  geracao: Zap,
  configuracao: Settings,
};

const acaoColors: Record<string, string> = {
  criar: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  editar: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  excluir: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  upload: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
  processar: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
};

function formatDate(date: Date | string | null) {
  if (!date) return "-";
  const d = new Date(date);
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AuditoriaPage() {
  const [filterEntidade, setFilterEntidade] = useState<string>("all");

  const { data: logs = [], isLoading } = useQuery<AuditLogWithUser[]>({
    queryKey: ["/api/auditoria"],
  });

  const filteredLogs =
    filterEntidade === "all"
      ? logs
      : logs.filter((log) => log.entidade === filterEntidade);

  const getInitials = (user?: AuthUser) => {
    const first = user?.firstName?.charAt(0) || "";
    const last = user?.lastName?.charAt(0) || "";
    return (first + last).toUpperCase() || "U";
  };

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Auditoria"
        description="Histórico de ações realizadas no sistema"
      />

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Filtrar por:</span>
          <Select value={filterEntidade} onValueChange={setFilterEntidade}>
            <SelectTrigger className="w-40" data-testid="select-audit-filter">
              <SelectValue placeholder="Todas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="usina">Usinas</SelectItem>
              <SelectItem value="cliente">Clientes</SelectItem>
              <SelectItem value="fatura">Faturas</SelectItem>
              <SelectItem value="geracao">Geração</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex-1" />
        <Badge variant="secondary">{filteredLogs.length} registros</Badge>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                  <Skeleton className="h-4 w-24" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredLogs.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <ClipboardList className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">
              Nenhum registro de auditoria
            </h3>
            <p className="text-muted-foreground text-center">
              As ações realizadas no sistema aparecerão aqui.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredLogs.map((log) => {
            const IconComponent = entidadeIcons[log.entidade] || ClipboardList;
            const acaoClass = acaoColors[log.acao] || "bg-gray-100 text-gray-800";

            return (
              <Card key={log.id} className="hover-elevate">
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={log.user?.profileImageUrl || undefined} />
                      <AvatarFallback className="bg-primary/10 text-primary text-sm">
                        {getInitials(log.user)}
                      </AvatarFallback>
                    </Avatar>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">
                          {log.user?.firstName} {log.user?.lastName}
                        </span>
                        <Badge variant="secondary" className={acaoClass}>
                          {log.acao}
                        </Badge>
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <IconComponent className="h-3 w-3" />
                          <span className="text-sm capitalize">{log.entidade}</span>
                        </div>
                      </div>
                      {log.detalhes && (
                        <p className="text-sm text-muted-foreground mt-1 truncate">
                          {typeof log.detalhes === "object"
                            ? JSON.stringify(log.detalhes)
                            : String(log.detalhes)}
                        </p>
                      )}
                    </div>

                    <span className="text-sm text-muted-foreground whitespace-nowrap">
                      {formatDate(log.createdAt)}
                    </span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
