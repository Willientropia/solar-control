import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { PageHeader } from "@/components/page-header";
import { DataTable } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Zap, AlertTriangle, Edit, Trash2 } from "lucide-react";
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

const meses = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez",
];

const currentYear = new Date().getFullYear();
const years = [currentYear - 1, currentYear, currentYear + 1];

export default function GeracaoPage() {
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingGeracao, setEditingGeracao] = useState<GeracaoWithUsina | null>(null);

  const { data: geracoes = [], isLoading } = useQuery<GeracaoWithUsina[]>({
    queryKey: ["/api/geracao"],
  });

  const { data: usinas = [] } = useQuery<Usina[]>({
    queryKey: ["/api/usinas"],
  });

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
    if (editingGeracao) {
      updateMutation.mutate({ ...data, id: editingGeracao.id });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleEdit = (geracao: GeracaoWithUsina) => {
    setEditingGeracao(geracao);
    form.reset({
      usinaId: geracao.usinaId,
      mesReferencia: geracao.mesReferencia,
      kwhGerado: geracao.kwhGerado,
      observacoes: geracao.observacoes || "",
    });
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingGeracao(null);
    form.reset();
  };

  const columns = [
    {
      key: "usina",
      header: "Usina",
      cell: (geracao: GeracaoWithUsina) => (
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
            <Zap className="h-4 w-4" />
          </div>
          <span className="font-medium">{geracao.usina?.nome || "-"}</span>
        </div>
      ),
    },
    {
      key: "mesReferencia",
      header: "Mês Ref.",
      cell: (geracao: GeracaoWithUsina) => (
        <span className="font-medium">{geracao.mesReferencia}</span>
      ),
    },
    {
      key: "kwhGerado",
      header: "Geração (kWh)",
      className: "text-right",
      cell: (geracao: GeracaoWithUsina) => (
        <span className="font-mono">
          {parseFloat(geracao.kwhGerado).toLocaleString("pt-BR")} kWh
        </span>
      ),
    },
    {
      key: "previsao",
      header: "% da Previsão",
      className: "text-right",
      cell: (geracao: GeracaoWithUsina) => {
        const previsao = parseFloat(geracao.usina?.producaoMensalPrevista || "0");
        const gerado = parseFloat(geracao.kwhGerado);
        const percentual = previsao > 0 ? (gerado / previsao) * 100 : 0;
        const isLow = percentual < 90;

        return (
          <div className="flex items-center justify-end gap-2">
            <span
              className={`font-mono ${isLow ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"}`}
            >
              {percentual.toFixed(1)}%
            </span>
            {isLow && <AlertTriangle className="h-4 w-4 text-yellow-500" />}
          </div>
        );
      },
    },
    {
      key: "alerta",
      header: "Status",
      cell: (geracao: GeracaoWithUsina) =>
        geracao.alertaBaixaGeracao ? (
          <Badge variant="destructive" className="gap-1">
            <AlertTriangle className="h-3 w-3" />
            Baixa Geração
          </Badge>
        ) : (
          <Badge variant="secondary">Normal</Badge>
        ),
    },
    {
      key: "actions",
      header: "",
      className: "w-24",
      cell: (geracao: GeracaoWithUsina) => (
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              handleEdit(geracao);
            }}
            data-testid={`button-edit-geracao-${geracao.id}`}
          >
            <Edit className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              if (confirm("Deseja realmente excluir este registro?")) {
                deleteMutation.mutate(geracao.id);
              }
            }}
            data-testid={`button-delete-geracao-${geracao.id}`}
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
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger data-testid="select-geracao-mes">
                              <SelectValue placeholder="Selecione o mês" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {years.map((year) =>
                              meses.map((mes, index) => (
                                <SelectItem
                                  key={`${mes}/${year}`}
                                  value={`${mes}/${year}`}
                                >
                                  {mes}/{year}
                                </SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>
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
                            type="number"
                            placeholder="Ex: 10000"
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

      {geracoes.length === 0 && !isLoading ? (
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
      ) : (
        <DataTable
          columns={columns}
          data={geracoes}
          isLoading={isLoading}
          getRowKey={(geracao) => geracao.id}
          emptyMessage="Nenhum registro encontrado"
        />
      )}
    </div>
  );
}
