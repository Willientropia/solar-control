import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { PageHeader } from "@/components/page-header";
import { DataTable } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Building2, Edit, Trash2 } from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Usina } from "@shared/schema";
import { formatNumber, parseToNumber } from "@/lib/utils";

const usinaFormSchema = z.object({
  nome: z.string().min(1, "Nome é obrigatório"),
  unidadeConsumidora: z.string().min(1, "UC é obrigatória"),
  producaoMensalPrevista: z.string().min(1, "Produção prevista é obrigatória"),
  potenciaKwp: z.string().optional(),
  descontoPadrao: z.string().default("15"),
  endereco: z.string().optional(),
});

type UsinaFormData = z.infer<typeof usinaFormSchema>;

export default function UsinasPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingUsina, setEditingUsina] = useState<Usina | null>(null);

  const { data: usinas = [], isLoading } = useQuery<Usina[]>({
    queryKey: ["/api/usinas"],
  });

  const form = useForm<UsinaFormData>({
    resolver: zodResolver(usinaFormSchema),
    defaultValues: {
      nome: "",
      unidadeConsumidora: "",
      producaoMensalPrevista: "",
      potenciaKwp: "",
      descontoPadrao: "15",
      endereco: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: UsinaFormData) =>
      apiRequest("POST", "/api/usinas", {
        ...data,
        producaoMensalPrevista: data.producaoMensalPrevista,
        potenciaKwp: data.potenciaKwp,
        descontoPadrao: data.descontoPadrao,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/usinas"] });
      setIsDialogOpen(false);
      form.reset();
      toast({ title: "Usina criada com sucesso!" });
    },
    onError: () => {
      toast({ title: "Erro ao criar usina", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: UsinaFormData & { id: string }) =>
      apiRequest("PATCH", `/api/usinas/${data.id}`, {
        nome: data.nome,
        unidadeConsumidora: data.unidadeConsumidora,
        producaoMensalPrevista: data.producaoMensalPrevista,
        potenciaKwp: data.potenciaKwp,
        descontoPadrao: data.descontoPadrao,
        endereco: data.endereco,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/usinas"] });
      setIsDialogOpen(false);
      setEditingUsina(null);
      form.reset();
      toast({ title: "Usina atualizada com sucesso!" });
    },
    onError: () => {
      toast({ title: "Erro ao atualizar usina", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/usinas/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/usinas"] });
      toast({ title: "Usina removida com sucesso!" });
    },
    onError: () => {
      toast({ title: "Erro ao remover usina", variant: "destructive" });
    },
  });

  const handleSubmit = (data: UsinaFormData) => {
    const formattedData = {
      ...data,
      producaoMensalPrevista: parseToNumber(data.producaoMensalPrevista).toFixed(2),
      potenciaKwp: data.potenciaKwp ? parseToNumber(data.potenciaKwp).toFixed(3) : undefined,
      descontoPadrao: parseToNumber(data.descontoPadrao).toFixed(2),
    };

    if (editingUsina) {
      updateMutation.mutate({ ...formattedData, id: editingUsina.id });
    } else {
      createMutation.mutate(formattedData);
    }
  };

  const handleEdit = (usina: Usina) => {
    setEditingUsina(usina);
    form.reset({
      nome: usina.nome,
      unidadeConsumidora: usina.unidadeConsumidora,
      producaoMensalPrevista: formatNumber(usina.producaoMensalPrevista),
      potenciaKwp: usina.potenciaKwp ? formatNumber(usina.potenciaKwp) : "",
      descontoPadrao: formatNumber(usina.descontoPadrao),
      endereco: usina.endereco || "",
    });
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingUsina(null);
    form.reset();
  };

  const columns = [
    {
      key: "nome",
      header: "Nome",
      cell: (usina: Usina) => (
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
            <Building2 className="h-4 w-4" />
          </div>
          <div>
            <p className="font-medium">{usina.nome}</p>
            <p className="text-sm text-muted-foreground">
              UC: {usina.unidadeConsumidora}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: "producao",
      header: "Produção Prevista",
      cell: (usina: Usina) => (
        <span className="font-mono">
          {formatNumber(usina.producaoMensalPrevista)} kWh
        </span>
      ),
    },
    {
      key: "potencia",
      header: "Potência",
      cell: (usina: Usina) => (
        <span className="font-mono">
          {usina.potenciaKwp ? `${formatNumber(usina.potenciaKwp)} kWp` : "-"}
        </span>
      ),
    },
    {
      key: "desconto",
      header: "Desconto Padrão",
      cell: (usina: Usina) => (
        <span className="font-mono">{usina.descontoPadrao}%</span>
      ),
    },
    {
      key: "actions",
      header: "",
      className: "w-24",
      cell: (usina: Usina) => (
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              handleEdit(usina);
            }}
            data-testid={`button-edit-usina-${usina.id}`}
          >
            <Edit className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              if (confirm("Deseja realmente excluir esta usina?")) {
                deleteMutation.mutate(usina.id);
              }
            }}
            data-testid={`button-delete-usina-${usina.id}`}
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
        title="Usinas"
        description="Gerencie suas usinas geradoras de energia solar"
        actions={
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-new-usina">
                <Plus className="h-4 w-4 mr-2" />
                Nova Usina
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editingUsina ? "Editar Usina" : "Nova Usina"}
                </DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form
                  onSubmit={form.handleSubmit(handleSubmit)}
                  className="space-y-4"
                >
                  <FormField
                    control={form.control}
                    name="nome"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nome da Usina</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Ex: Usina Sol Tech"
                            {...field}
                            data-testid="input-usina-nome"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="unidadeConsumidora"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Unidade Consumidora (UC)</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Ex: 1234567890"
                            {...field}
                            data-testid="input-usina-uc"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="producaoMensalPrevista"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Produção Mensal Prevista (kWh)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            placeholder="Ex: 10000"
                            {...field}
                            data-testid="input-usina-producao"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="potenciaKwp"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Potência (kWp) - opcional</FormLabel>
                        <FormControl>
                          <Input
                            type="text"
                            placeholder="Ex: 50,5"
                            {...field}
                            data-testid="input-usina-potencia"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="descontoPadrao"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Desconto Padrão (%)</FormLabel>
                        <FormControl>
                          <Input
                            type="text"
                            placeholder="Ex: 15,00"
                            {...field}
                            data-testid="input-usina-desconto"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="endereco"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Endereço (opcional)</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Ex: Rua das Flores, 123"
                            {...field}
                            data-testid="input-usina-endereco"
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
                      data-testid="button-submit-usina"
                    >
                      {editingUsina ? "Salvar" : "Criar"}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        }
      />

      {usinas.length === 0 && !isLoading ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Nenhuma usina cadastrada</h3>
            <p className="text-muted-foreground text-center mb-4">
              Comece cadastrando sua primeira usina geradora de energia solar.
            </p>
            <Button onClick={() => setIsDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Cadastrar Usina
            </Button>
          </CardContent>
        </Card>
      ) : (
        <DataTable
          columns={columns}
          data={usinas}
          isLoading={isLoading}
          getRowKey={(usina) => usina.id}
          emptyMessage="Nenhuma usina encontrada"
          onRowClick={(usina) => navigate(`/usinas/${usina.id}`)}
        />
      )}
    </div>
  );
}
