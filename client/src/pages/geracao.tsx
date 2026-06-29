import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { MonthPicker } from "@/components/month-picker";
import { formatNumber, parseToNumber, normalizeMonth } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Zap, AlertTriangle, Edit, Trash2, CalendarDays } from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { GeracaoMensal, Usina } from "@shared/schema";

const geracaoFormSchema = z.object({
  usinaId: z.string().min(1, "Usina é obrigatória"),
  mesReferencia: z.string().min(1, "Mês de referência é obrigatório"),
  kwhGerado: z.string().min(1, "Geração é obrigatória"),
  observacoes: z.string().optional(),
});

type GeracaoFormData = z.infer<typeof geracaoFormSchema>;

interface GeracaoWithUsina extends GeracaoMensal {
  usina?: Usina;
}

const MONTH_INDEX: Record<string, number> = {
  JAN: 0, FEV: 1, MAR: 2, ABR: 3, MAI: 4, JUN: 5,
  JUL: 6, AGO: 7, SET: 8, OUT: 9, NOV: 10, DEZ: 11,
};

// Chave numérica para ordenar "Mes/Ano" de forma cronológica
function monthSortKey(ref: string): number {
  const [mes, ano] = ref.split("/");
  const year = parseInt(ano) || 0;
  const monthIdx = MONTH_INDEX[(mes || "").toUpperCase()] ?? 0;
  return year * 12 + monthIdx;
}

function calcPercentual(geracao: GeracaoWithUsina): number {
  const previsao = parseFloat(geracao.usina?.producaoMensalPrevista || "0");
  const gerado = parseFloat(geracao.kwhGerado || "0");
  return previsao > 0 ? (gerado / previsao) * 100 : 0;
}

export default function GeracaoPage() {
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingGeracao, setEditingGeracao] = useState<GeracaoWithUsina | null>(null);

  // Filtros
  const [usinaFilter, setUsinaFilter] = useState<string>("all");
  const [monthFilter, setMonthFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { data: geracoes = [], isLoading } = useQuery<GeracaoWithUsina[]>({
    queryKey: ["/api/geracao"],
  });

  const { data: usinas = [] } = useQuery<Usina[]>({
    queryKey: ["/api/usinas"],
  });

  // Meses disponíveis (normalizados e ordenados do mais recente ao mais antigo)
  const availableMonths = useMemo(() => {
    const map = new Map<string, string>();
    geracoes.forEach((g) => {
      const norm = normalizeMonth(g.mesReferencia);
      if (norm) map.set(norm.toUpperCase(), norm);
    });
    return Array.from(map.values()).sort((a, b) => monthSortKey(b) - monthSortKey(a));
  }, [geracoes]);

  // Aplica filtros e agrupa por mês
  const groupedByMonth = useMemo(() => {
    const filtered = geracoes.filter((g) => {
      if (usinaFilter !== "all" && g.usinaId !== usinaFilter) return false;
      if (monthFilter !== "all" && normalizeMonth(g.mesReferencia).toUpperCase() !== monthFilter.toUpperCase()) return false;
      if (statusFilter === "baixa" && !g.alertaBaixaGeracao) return false;
      if (statusFilter === "normal" && g.alertaBaixaGeracao) return false;
      return true;
    });

    const groups = new Map<string, GeracaoWithUsina[]>();
    filtered.forEach((g) => {
      const key = normalizeMonth(g.mesReferencia);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(g);
    });

    return Array.from(groups.entries())
      .sort(([a], [b]) => monthSortKey(b) - monthSortKey(a))
      .map(([mes, items]) => {
        const sorted = [...items].sort((a, b) =>
          (a.usina?.nome || "").localeCompare(b.usina?.nome || "", "pt-BR"),
        );
        const totalGerado = sorted.reduce((acc, g) => acc + parseFloat(g.kwhGerado || "0"), 0);
        const totalPrevisto = sorted.reduce(
          (acc, g) => acc + parseFloat(g.usina?.producaoMensalPrevista || "0"),
          0,
        );
        const percentual = totalPrevisto > 0 ? (totalGerado / totalPrevisto) * 100 : 0;
        return { mes, items: sorted, totalGerado, totalPrevisto, percentual };
      });
  }, [geracoes, usinaFilter, monthFilter, statusFilter]);

  const hasFiltrosAtivos = usinaFilter !== "all" || monthFilter !== "all" || statusFilter !== "all";

  const form = useForm<GeracaoFormData>({
    resolver: zodResolver(geracaoFormSchema),
    defaultValues: {
      usinaId: "",
      mesReferencia: "",
      kwhGerado: "",
      observacoes: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: GeracaoFormData) =>
      apiRequest("POST", "/api/geracao", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/geracao"] });
      setIsDialogOpen(false);
      form.reset();
      toast({ title: "Geração registrada com sucesso!" });
    },
    onError: () => {
      toast({ title: "Erro ao registrar geração", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: GeracaoFormData & { id: string }) =>
      apiRequest("PATCH", `/api/geracao/${data.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/geracao"] });
      setIsDialogOpen(false);
      setEditingGeracao(null);
      form.reset();
      toast({ title: "Geração atualizada!" });
    },
    onError: () => {
      toast({ title: "Erro ao atualizar", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/geracao/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/geracao"] });
      toast({ title: "Registro removido!" });
    },
    onError: () => {
      toast({ title: "Erro ao remover", variant: "destructive" });
    },
  });

  const handleSubmit = (data: GeracaoFormData) => {
    const formattedData = {
      ...data,
      mesReferencia: normalizeMonth(data.mesReferencia),
      kwhGerado: parseToNumber(data.kwhGerado).toFixed(2),
    };

    if (editingGeracao) {
      updateMutation.mutate({ ...formattedData, id: editingGeracao.id });
    } else {
      createMutation.mutate(formattedData);
    }
  };

  const handleEdit = (geracao: GeracaoWithUsina) => {
    setEditingGeracao(geracao);
    form.reset({
      usinaId: geracao.usinaId,
      mesReferencia: geracao.mesReferencia,
      kwhGerado: formatNumber(geracao.kwhGerado),
      observacoes: geracao.observacoes || "",
    });
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingGeracao(null);
    form.reset();
  };

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Geração Mensal"
        description="Registre a geração mensal das suas usinas"
        actions={
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-new-geracao">
                <Plus className="h-4 w-4 mr-2" />
                Registrar Geração
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editingGeracao ? "Editar Geração" : "Registrar Geração"}
                </DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form
                  onSubmit={form.handleSubmit(handleSubmit)}
                  className="space-y-4"
                >
                  <FormField
                    control={form.control}
                    name="usinaId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Usina</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger data-testid="select-geracao-usina">
                              <SelectValue placeholder="Selecione a usina" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {usinas.map((usina) => (
                              <SelectItem key={usina.id} value={usina.id}>
                                {usina.nome}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="mesReferencia"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Mês de Referência</FormLabel>
                        <FormControl>
                          <MonthPicker
                            value={field.value}
                            onChange={field.onChange}
                            placeholder="Selecione o mês"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="kwhGerado"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Energia Gerada (kWh)</FormLabel>
                        <FormControl>
                          <Input
                            type="text"
                            placeholder="Ex: 10.000,00"
                            {...field}
                            data-testid="input-geracao-kwh"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="observacoes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Observações (opcional)</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Ex: Manutenção realizada no dia 15"
                            className="resize-none"
                            {...field}
                            data-testid="input-geracao-obs"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="flex justify-end gap-2 pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleCloseDialog}
                    >
                      Cancelar
                    </Button>
                    <Button
                      type="submit"
                      disabled={
                        createMutation.isPending || updateMutation.isPending
                      }
                      data-testid="button-submit-geracao"
                    >
                      {editingGeracao ? "Salvar" : "Registrar"}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        }
      />

      {/* Barra de filtros */}
      {geracoes.length > 0 && (
        <Card>
          <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:flex-wrap">
            <div className="flex flex-col gap-1 sm:w-56">
              <span className="text-xs text-muted-foreground">Usina</span>
              <Select value={usinaFilter} onValueChange={setUsinaFilter}>
                <SelectTrigger data-testid="filter-usina">
                  <SelectValue placeholder="Todas as usinas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as usinas</SelectItem>
                  {usinas.map((usina) => (
                    <SelectItem key={usina.id} value={usina.id}>
                      {usina.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1 sm:w-44">
              <span className="text-xs text-muted-foreground">Mês</span>
              <Select value={monthFilter} onValueChange={setMonthFilter}>
                <SelectTrigger data-testid="filter-mes">
                  <SelectValue placeholder="Todos os meses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os meses</SelectItem>
                  {availableMonths.map((mes) => (
                    <SelectItem key={mes} value={mes}>
                      {mes}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1 sm:w-44">
              <span className="text-xs text-muted-foreground">Status</span>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger data-testid="filter-status">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="baixa">Baixa geração</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {hasFiltrosAtivos && (
              <Button
                variant="ghost"
                size="sm"
                className="sm:ml-auto sm:self-end"
                onClick={() => {
                  setUsinaFilter("all");
                  setMonthFilter("all");
                  setStatusFilter("all");
                }}
                data-testid="button-limpar-filtros"
              >
                Limpar filtros
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Estado vazio: nenhuma geração cadastrada */}
      {geracoes.length === 0 && !isLoading && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Zap className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">
              Nenhuma geração registrada
            </h3>
            <p className="text-muted-foreground text-center mb-4">
              Comece registrando a geração mensal das suas usinas.
            </p>
            <Button onClick={() => setIsDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Registrar Geração
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Nenhum resultado para os filtros */}
      {geracoes.length > 0 && groupedByMonth.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <CalendarDays className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Nenhum registro encontrado</h3>
            <p className="text-muted-foreground text-center">
              Ajuste os filtros para ver as gerações registradas.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Seções por mês */}
      <div className="space-y-8">
        {groupedByMonth.map(({ mes, items, totalGerado, totalPrevisto, percentual }) => {
          const sectionLow = percentual > 0 && percentual < 90;
          return (
            <section key={mes} className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-2">
                <div className="flex items-center gap-2">
                  <CalendarDays className="h-5 w-5 text-primary" />
                  <h2 className="text-lg font-semibold">{mes}</h2>
                  <Badge variant="secondary">
                    {items.length} {items.length === 1 ? "usina" : "usinas"}
                  </Badge>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-muted-foreground">
                    Total:{" "}
                    <span className="font-mono font-medium text-foreground">
                      {formatNumber(totalGerado)} kWh
                    </span>
                  </span>
                  {totalPrevisto > 0 && (
                    <span
                      className={`font-mono font-medium ${sectionLow ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"}`}
                    >
                      {percentual.toFixed(1)}% da previsão
                    </span>
                  )}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((geracao) => {
                  const pct = calcPercentual(geracao);
                  const isLow = pct > 0 && pct < 90;
                  const temPrevisao = parseFloat(geracao.usina?.producaoMensalPrevista || "0") > 0;
                  return (
                    <Card key={geracao.id} className="flex flex-col" data-testid={`card-geracao-${geracao.id}`}>
                      <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0 pb-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                            <Zap className="h-4 w-4" />
                          </div>
                          <CardTitle className="text-base truncate">
                            {geracao.usina?.nome || "-"}
                          </CardTitle>
                        </div>
                        {geracao.alertaBaixaGeracao ? (
                          <Badge variant="destructive" className="gap-1 shrink-0">
                            <AlertTriangle className="h-3 w-3" />
                            Baixa
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="shrink-0">Normal</Badge>
                        )}
                      </CardHeader>
                      <CardContent className="flex flex-1 flex-col gap-3">
                        <div>
                          <div className="text-2xl font-bold font-mono">
                            {formatNumber(geracao.kwhGerado)}
                            <span className="text-sm font-normal text-muted-foreground"> kWh</span>
                          </div>
                          {temPrevisao && (
                            <div className="flex items-center gap-1.5 mt-1">
                              <span
                                className={`text-sm font-mono ${isLow ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"}`}
                              >
                                {pct.toFixed(1)}% da previsão
                              </span>
                              {isLow && <AlertTriangle className="h-3.5 w-3.5 text-yellow-500" />}
                            </div>
                          )}
                          <p className="text-xs text-muted-foreground mt-1">
                            Previsto: {formatNumber(geracao.usina?.producaoMensalPrevista || "0")} kWh
                          </p>
                        </div>

                        {geracao.observacoes && (
                          <p className="text-sm text-muted-foreground border-l-2 border-muted pl-2">
                            {geracao.observacoes}
                          </p>
                        )}

                        <div className="mt-auto flex items-center justify-end gap-1 pt-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(geracao)}
                            data-testid={`button-edit-geracao-${geracao.id}`}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              if (confirm("Deseja realmente excluir este registro?")) {
                                deleteMutation.mutate(geracao.id);
                              }
                            }}
                            data-testid={`button-delete-geracao-${geracao.id}`}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
