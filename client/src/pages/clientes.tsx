import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { PageHeader } from "@/components/page-header";
import { DataTable } from "@/components/data-table";
import { StatusBadge } from "@/components/status-badge";
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
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Users, Edit, Trash2 } from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Cliente, Usina } from "@shared/schema";
import { formatNumber, parseToNumber } from "@/lib/utils";

const clienteFormSchema = z.object({
  nome: z.string().min(1, "Nome é obrigatório"),
  cpfCnpj: z.string().optional(),
  endereco: z.string().optional(),
  unidadeConsumidora: z.string().min(1, "UC é obrigatória"),
  usinaId: z.string().min(1, "Usina é obrigatória"),
  desconto: z.string().default("15"),
  isPagante: z.boolean().default(true),
});

type ClienteFormData = z.infer<typeof clienteFormSchema>;

interface ClienteWithUsina extends Cliente {
  usina?: Usina;
}

export default function ClientesPage() {
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCliente, setEditingCliente] = useState<ClienteWithUsina | null>(null);

  const { data: clientes = [], isLoading } = useQuery<ClienteWithUsina[]>({
    queryKey: ["/api/clientes"],
  });

  const { data: usinas = [] } = useQuery<Usina[]>({
    queryKey: ["/api/usinas"],
  });

  const form = useForm<ClienteFormData>({
    resolver: zodResolver(clienteFormSchema),
    defaultValues: {
      nome: "",
      cpfCnpj: "",
      endereco: "",
      unidadeConsumidora: "",
      usinaId: "",
      desconto: "15",
      isPagante: true,
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: ClienteFormData) =>
      apiRequest("POST", "/api/clientes", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clientes"] });
      setIsDialogOpen(false);
      form.reset();
      toast({ title: "Cliente criado com sucesso!" });
    },
    onError: () => {
      toast({ title: "Erro ao criar cliente", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: ClienteFormData & { id: string }) =>
      apiRequest("PATCH", `/api/clientes/${data.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clientes"] });
      setIsDialogOpen(false);
      setEditingCliente(null);
      form.reset();
      toast({ title: "Cliente atualizado com sucesso!" });
    },
    onError: () => {
      toast({ title: "Erro ao atualizar cliente", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/clientes/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clientes"] });
      toast({ title: "Cliente removido com sucesso!" });
    },
    onError: () => {
      toast({ title: "Erro ao remover cliente", variant: "destructive" });
    },
  });

  const handleSubmit = (data: ClienteFormData) => {
    const formattedData = {
      ...data,
      desconto: parseToNumber(data.desconto).toFixed(2),
    };

    if (editingCliente) {
      updateMutation.mutate({ ...formattedData, id: editingCliente.id });
    } else {
      createMutation.mutate(formattedData);
    }
  };

  const handleEdit = (cliente: ClienteWithUsina) => {
    setEditingCliente(cliente);
    form.reset({
      nome: cliente.nome,
      cpfCnpj: cliente.cpfCnpj || "",
      endereco: cliente.endereco || "",
      unidadeConsumidora: cliente.unidadeConsumidora,
      usinaId: cliente.usinaId,
      desconto: formatNumber(cliente.desconto),
      isPagante: cliente.isPagante,
    });
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingCliente(null);
    form.reset();
  };

  const columns = [
    {
      key: "nome",
      header: "Cliente",
      cell: (cliente: ClienteWithUsina) => (
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Users className="h-4 w-4" />
          </div>
          <div>
            <p className="font-medium">{cliente.nome}</p>
            <p className="text-sm text-muted-foreground">
              UC: {cliente.unidadeConsumidora}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: "usina",
      header: "Usina",
      cell: (cliente: ClienteWithUsina) => (
        <span className="text-sm">{cliente.usina?.nome || "-"}</span>
      ),
    },
    {
      key: "desconto",
      header: "Desconto",
      cell: (cliente: ClienteWithUsina) => (
        <span className="font-mono">{cliente.desconto}%</span>
      ),
    },
    {
      key: "tipo",
      header: "Tipo",
      cell: (cliente: ClienteWithUsina) => (
        <Badge variant={cliente.isPagante ? "default" : "secondary"}>
          {cliente.isPagante ? "Pagante" : "Próprio"}
        </Badge>
      ),
    },
    {
      key: "status",
      header: "Status",
      cell: (cliente: ClienteWithUsina) => (
        <StatusBadge status={cliente.ativo ? "ativo" : "inativo"} />
      ),
    },
    {
      key: "actions",
      header: "",
      className: "w-24",
      cell: (cliente: ClienteWithUsina) => (
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              handleEdit(cliente);
            }}
            data-testid={`button-edit-cliente-${cliente.id}`}
          >
            <Edit className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              if (confirm("Deseja realmente excluir este cliente?")) {
                deleteMutation.mutate(cliente.id);
              }
            }}
            data-testid={`button-delete-cliente-${cliente.id}`}
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
        title="Clientes"
        description="Gerencie os clientes das suas usinas de energia solar"
        actions={
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-new-cliente">
                <Plus className="h-4 w-4 mr-2" />
                Novo Cliente
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>
                  {editingCliente ? "Editar Cliente" : "Novo Cliente"}
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
                        <FormLabel>Nome do Cliente</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Ex: João da Silva"
                            {...field}
                            data-testid="input-cliente-nome"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="cpfCnpj"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>CPF/CNPJ (opcional)</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Ex: 123.456.789-00"
                            {...field}
                            data-testid="input-cliente-cpf"
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
                            data-testid="input-cliente-uc"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
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
                            <SelectTrigger data-testid="select-cliente-usina">
                              <SelectValue placeholder="Selecione uma usina" />
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
                    name="desconto"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Desconto (%)</FormLabel>
                        <FormControl>
                          <Input
                            type="text"
                            placeholder="Ex: 15,00"
                            {...field}
                            data-testid="input-cliente-desconto"
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
                            data-testid="input-cliente-endereco"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="isPagante"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded-lg border p-3">
                        <div className="space-y-0.5">
                          <FormLabel>Cliente Pagante</FormLabel>
                          <p className="text-sm text-muted-foreground">
                            Marque se este cliente paga pelo crédito de energia
                          </p>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            data-testid="switch-cliente-pagante"
                          />
                        </FormControl>
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
                      data-testid="button-submit-cliente"
                    >
                      {editingCliente ? "Salvar" : "Criar"}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        }
      />

      {clientes.length === 0 && !isLoading ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Users className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">
              Nenhum cliente cadastrado
            </h3>
            <p className="text-muted-foreground text-center mb-4">
              Comece cadastrando seu primeiro cliente de energia solar.
            </p>
            <Button onClick={() => setIsDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Cadastrar Cliente
            </Button>
          </CardContent>
        </Card>
      ) : (
        <DataTable
          columns={columns}
          data={clientes}
          isLoading={isLoading}
          getRowKey={(cliente) => cliente.id}
          emptyMessage="Nenhum cliente encontrado"
        />
      )}
    </div>
  );
}
