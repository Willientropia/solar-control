import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { PageHeader } from "@/components/page-header";
import { DataTable } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, DollarSign, Edit, Trash2, Calculator } from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { PrecoKwh } from "@shared/schema";
import { parseToNumber } from "@/lib/utils";

const precoFormSchema = z.object({
  mesReferencia: z.string().min(1, "Mês de referência é obrigatório"),
  tusd: z.string().min(1, "TUSD é obrigatório"),
  te: z.string().min(1, "TE é obrigatória"),
  icms: z.string().min(1, "ICMS é obrigatório"),
  pis: z.string().min(1, "PIS é obrigatório"),
  cofins: z.string().min(1, "COFINS é obrigatório"),
});

type PrecoFormData = z.infer<typeof precoFormSchema>;

export default function PrecosKwhPage() {
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPreco, setEditingPreco] = useState<PrecoKwh | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [precoToDelete, setPrecoToDelete] = useState<PrecoKwh | null>(null);
  const [precoCalculado, setPrecoCalculado] = useState<number | null>(null);

  const { data: precos = [], isLoading } = useQuery<PrecoKwh[]>({
    queryKey: ["/api/precos-kwh"],
  });

  const { data: ultimoPreco } = useQuery<PrecoKwh | null>({
    queryKey: ["/api/precos-kwh/ultimo"],
  });

  const form = useForm<PrecoFormData>({
    resolver: zodResolver(precoFormSchema),
    defaultValues: {
      mesReferencia: "",
      tusd: "",
      te: "",
      icms: "18",
      pis: "1.65",
      cofins: "7.6",
    },
  });

  // Watch form values to calculate preview
  const watchedValues = form.watch();

  useEffect(() => {
    const { tusd, te, icms, pis, cofins } = watchedValues;

    if (tusd && te && icms && pis && cofins) {
      try {
        const tusdNum = parseToNumber(tusd);
        const teNum = parseToNumber(te);
        const icmsNum = parseToNumber(icms) / 100;
        const pisNum = parseToNumber(pis) / 100;
        const cofinsNum = parseToNumber(cofins) / 100;

        const resultado = ((teNum + tusdNum) / ((1 - icmsNum) * (1 - (pisNum + cofinsNum)))) / 1000;
        setPrecoCalculado(resultado);
      } catch {
        setPrecoCalculado(null);
      }
    } else {
      setPrecoCalculado(null);
    }
  }, [watchedValues]);

  const createMutation = useMutation({
    mutationFn: (data: PrecoFormData) =>
      apiRequest("POST", "/api/precos-kwh", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/precos-kwh"] });
      queryClient.invalidateQueries({ queryKey: ["/api/precos-kwh/ultimo"] });
      setIsDialogOpen(false);
      form.reset();
      setPrecoCalculado(null);
      toast({ title: "Preço criado com sucesso!" });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao criar preço",
        description: error.message || "Já existe um preço para este mês",
        variant: "destructive"
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: PrecoFormData & { id: string }) =>
      apiRequest("PATCH", `/api/precos-kwh/${data.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/precos-kwh"] });
      queryClient.invalidateQueries({ queryKey: ["/api/precos-kwh/ultimo"] });
      setIsDialogOpen(false);
      setEditingPreco(null);
      form.reset();
      setPrecoCalculado(null);
      toast({ title: "Preço atualizado com sucesso!" });
    },
    onError: () => {
      toast({ title: "Erro ao atualizar preço", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/precos-kwh/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/precos-kwh"] });
      queryClient.invalidateQueries({ queryKey: ["/api/precos-kwh/ultimo"] });
      setDeleteDialogOpen(false);
      setPrecoToDelete(null);
      toast({ title: "Preço removido com sucesso!" });
    },
    onError: () => {
      toast({ title: "Erro ao remover preço", variant: "destructive" });
    },
  });

  const handleSubmit = (data: PrecoFormData) => {
    const formattedData = {
      ...data,
      tusd: parseToNumber(data.tusd).toFixed(6),
      te: parseToNumber(data.te).toFixed(6),
      icms: parseToNumber(data.icms).toFixed(2),
      pis: parseToNumber(data.pis).toFixed(2),
      cofins: parseToNumber(data.cofins).toFixed(2),
    };

    if (editingPreco) {
      updateMutation.mutate({ ...formattedData, id: editingPreco.id });
    } else {
      createMutation.mutate(formattedData);
    }
  };

  const handleEdit = (preco: PrecoKwh) => {
    setEditingPreco(preco);
    form.reset({
      mesReferencia: preco.mesReferencia,
      tusd: String(preco.tusd),
      te: String(preco.te),
      icms: String(preco.icms),
      pis: String(preco.pis),
      cofins: String(preco.cofins),
    });
    setIsDialogOpen(true);
  };

  const handleNewPreco = () => {
    setEditingPreco(null);

    // Se existe um preço anterior, preencher TUSD e TE com os valores anteriores
    if (ultimoPreco) {
      form.reset({
        mesReferencia: "",
        tusd: String(ultimoPreco.tusd),
        te: String(ultimoPreco.te),
        icms: String(ultimoPreco.icms),
        pis: String(ultimoPreco.pis),
        cofins: String(ultimoPreco.cofins),
      });
    } else {
      form.reset({
        mesReferencia: "",
        tusd: "",
        te: "",
        icms: "18",
        pis: "1.65",
        cofins: "7.6",
      });
    }

    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingPreco(null);
    form.reset();
    setPrecoCalculado(null);
  };

  const columns = [
    {
      key: "mesReferencia",
      header: "Mês",
      cell: (preco: PrecoKwh) => (
        <span className="font-medium">{preco.mesReferencia}</span>
      ),
    },
    {
      key: "tusd",
      header: "TUSD (R$/MWh)",
      cell: (preco: PrecoKwh) => (
        <span className="font-mono text-sm">{parseFloat(preco.tusd).toFixed(2)}</span>
      ),
    },
    {
      key: "te",
      header: "TE (R$/MWh)",
      cell: (preco: PrecoKwh) => (
        <span className="font-mono text-sm">{parseFloat(preco.te).toFixed(2)}</span>
      ),
    },
    {
      key: "icms",
      header: "ICMS (%)",
      cell: (preco: PrecoKwh) => (
        <span className="font-mono text-sm">{preco.icms}%</span>
      ),
    },
    {
      key: "pis",
      header: "PIS (%)",
      cell: (preco: PrecoKwh) => (
        <span className="font-mono text-sm">{preco.pis}%</span>
      ),
    },
    {
      key: "cofins",
      header: "COFINS (%)",
      cell: (preco: PrecoKwh) => (
        <span className="font-mono text-sm">{preco.cofins}%</span>
      ),
    },
    {
      key: "precoKwhCalculado",
      header: "Preço kWh (R$)",
      cell: (preco: PrecoKwh) => (
        <span className="font-mono font-bold text-primary">
          R$ {parseFloat(preco.precoKwhCalculado).toFixed(6)}
        </span>
      ),
    },
    {
      key: "actions",
      header: "Ações",
      cell: (preco: PrecoKwh) => (
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleEdit(preco)}
          >
            <Edit className="h-4 w-4 text-blue-600" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setPrecoToDelete(preco);
              setDeleteDialogOpen(true);
            }}
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
        title="Preços kWh"
        description="Gerencie o cálculo de preços de kWh por mês com base nas tarifas"
        actions={
          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            if (open) {
              handleNewPreco();
            } else {
              handleCloseDialog();
            }
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Novo Preço
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>
                  {editingPreco ? "Editar Preço" : "Novo Preço"}
                </DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="mesReferencia"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Mês de Referência</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Ex: Jan/2026"
                            {...field}
                            disabled={!!editingPreco}
                          />
                        </FormControl>
                        <FormDescription>
                          Formato: Jan/2026, Fev/2026, etc.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="tusd"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>TUSD (R$/MWh)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.000001"
                              placeholder="Ex: 181,23"
                              {...field}
                            />
                          </FormControl>
                          <FormDescription>
                            Tarifa de Uso do Sistema de Distribuição
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="te"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>TE (R$/MWh)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.000001"
                              placeholder="Ex: 374,18"
                              {...field}
                            />
                          </FormControl>
                          <FormDescription>
                            Tarifa de Energia
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <FormField
                      control={form.control}
                      name="icms"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>ICMS (%)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.01"
                              placeholder="Ex: 18"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="pis"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>PIS (%)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.01"
                              placeholder="Ex: 1,65"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="cofins"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>COFINS (%)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.01"
                              placeholder="Ex: 7,6"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {precoCalculado !== null && (
                    <Card className="bg-primary/5 border-primary/20">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <Calculator className="h-4 w-4" />
                          Preço Calculado
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold text-primary">
                          R$ {precoCalculado.toFixed(6)} /kWh
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          Fórmula: (TE+TUSD) / ((1-ICMS) × (1-(PIS+COFINS))) / 1000
                        </p>
                      </CardContent>
                    </Card>
                  )}

                  <DialogFooter>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleCloseDialog}
                    >
                      Cancelar
                    </Button>
                    <Button
                      type="submit"
                      disabled={createMutation.isPending || updateMutation.isPending}
                    >
                      {editingPreco ? "Atualizar" : "Salvar"}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Histórico de Preços</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={precos}
            isLoading={isLoading}
            emptyMessage="Nenhum preço cadastrado"
          />
        </CardContent>
      </Card>

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Exclusão</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Tem certeza que deseja excluir o preço do mês{" "}
            <strong>{precoToDelete?.mesReferencia}</strong>?
          </p>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => precoToDelete && deleteMutation.mutate(precoToDelete.id)}
              disabled={deleteMutation.isPending}
            >
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
