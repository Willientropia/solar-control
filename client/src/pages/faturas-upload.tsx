import { useState, useCallback, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import {
  Upload,
  FileText,
  X,
  CheckCircle,
  AlertCircle,
  Loader2,
  Eye,
  Check,
  Calculator,
  Info,
  Save,
} from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Cliente, Usina } from "@shared/schema";
import { cn, parseToNumber, formatNumber, normalizeMonth } from "@/lib/utils";

interface ExtractedData {
  success: boolean;
  fileName?: string;
  fileUrl?: string;
  filePath?: string;
  extractionErrors?: string[];
  cpfCnpj?: string;
  nomeCliente?: string;
  endereco?: string;
  unidadeConsumidora?: string;
  mesReferencia?: string;
  dataVencimento?: string;
  leituraAnterior?: string;
  leituraAtual?: string;
  quantidadeDias?: string;
  consumoKwh?: string;
  consumoScee?: string;
  consumoNaoCompensado?: string;
  energiaInjetada?: string;
  precoEnergiaInjetada?: string;
  precoEnergiaCompensada?: string;
  precoKwhNaoCompensado?: string;
  precoFioB?: string;
  precoAdcBandeira?: string;
  contribuicaoIluminacao?: string;
  valorTotal?: string;
  saldoKwh?: string;
  cicloGeracao?: string;
  ucGeradora?: string;
  geracaoUltimoCiclo?: string;
  valorSemDesconto?: number | string;
  valorComDesconto?: number | string;
  economia?: number | string;
  lucro?: number | string;
  precoKwhUsado?: number | string;
  descontoUsado?: number | string;
  fioB?: number | string;
}

interface UploadedFile {
  file: File;
  status: "pending" | "uploading" | "success" | "error";
  error?: string;
  extractedData?: ExtractedData;
}

interface PendingFatura {
  id: string;
  fileName: string;
  formData: Record<string, string>;
  pdfUrl: string;
  selectedClienteId: string;
  saved: boolean;
}

const FIELD_CONFIG: {
  key: keyof ExtractedData | "fioB";
  label: string;
  type: "text" | "number";
  readonly?: boolean;
  formula?: string;
}[] = [
  { key: "cpfCnpj", label: "CPF/CNPJ", type: "text" },
  { key: "nomeCliente", label: "Nome do Cliente", type: "text" },
  { key: "endereco", label: "Endereço", type: "text" },
  { key: "unidadeConsumidora", label: "Unidade Consumidora", type: "text" },
  { key: "mesReferencia", label: "Mês de Referência", type: "text" },
  { key: "precoKwhUsado", label: "Preço kWh Usado nos Cálculos (R$)", type: "text" },
  { key: "dataVencimento", label: "Data de Vencimento", type: "text" },
  { key: "leituraAnterior", label: "Leitura Anterior", type: "text" },
  { key: "leituraAtual", label: "Leitura Atual", type: "text" },
  { key: "quantidadeDias", label: "Quantidade de Dias", type: "text" },
  { key: "consumoKwh", label: "Consumo Total (kWh)", type: "text" },
  { key: "consumoScee", label: "Consumo SCEE (kWh)", type: "text" },
  { key: "consumoNaoCompensado", label: "Consumo Não Compensado (kWh)", type: "text" },
  { key: "precoKwhNaoCompensado", label: "Preço kWh Não Compensado (R$)", type: "text" },
  { key: "precoFioB", label: "Preço Fio B (R$)", type: "text" },
  {
    key: "fioB",
    label: "Fio B (R$)",
    type: "text",
    readonly: true,
    formula: "Consumo SCEE × Preço Fio B"
  },
  { key: "precoAdcBandeira", label: "Preço ADC Bandeira (R$)", type: "text" },
  { key: "contribuicaoIluminacao", label: "Contribuição Iluminação Pública (R$)", type: "text" },
  { key: "valorTotal", label: "Valor Total Fatura (R$)", type: "text" },
  { key: "saldoKwh", label: "Saldo (kWh)", type: "text" },
  { key: "cicloGeracao", label: "Ciclo de Geração", type: "text" },
  { key: "ucGeradora", label: "UC Geradora", type: "text" },
  { key: "geracaoUltimoCiclo", label: "Geração Último Ciclo (kWh)", type: "text" },
  {
    key: "valorSemDesconto",
    label: "Valor Sem Desconto (R$)",
    type: "text",
    readonly: true,
    formula: "(Consumo SCEE × Preço kWh) + Valor Total - Fio B"
  },
  {
    key: "valorComDesconto",
    label: "Valor Com Desconto (R$)",
    type: "text",
    readonly: true,
    formula: "((Consumo SCEE × Preço kWh) × (1 - Desconto%)) + Valor Total - Fio B"
  },
  {
    key: "economia",
    label: "Economia (R$)",
    type: "text",
    readonly: true,
    formula: "Valor Sem Desconto - Valor Com Desconto"
  },
  {
    key: "lucro",
    label: "Lucro Estimado (R$)",
    type: "text",
    readonly: true,
    formula: "Valor Com Desconto - Valor Total"
  },
];

export default function FaturasUploadPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [selectedUsinaId, setSelectedUsinaId] = useState<string>("");
  const [precoKwh, setPrecoKwh] = useState<string>("");
  const [isDragging, setIsDragging] = useState(false);
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [pendingFaturas, setPendingFaturas] = useState<PendingFatura[]>([]);
  const [currentFaturaIndex, setCurrentFaturaIndex] = useState<number>(0);
  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false);
  const [duplicateInfo, setDuplicateInfo] = useState<any>(null);
  const [pendingConfirmData, setPendingConfirmData] = useState<any>(null);
  const [showSaveAllDialog, setShowSaveAllDialog] = useState(false);
  const [isSavingAll, setIsSavingAll] = useState(false);
  const [saveAllProgress, setSaveAllProgress] = useState({ current: 0, total: 0 });
  const [replaceAllDuplicates, setReplaceAllDuplicates] = useState(true);

  const { data: usinas = [] } = useQuery<Usina[]>({
    queryKey: ["/api/usinas"],
  });

  const { data: clientes = [] } = useQuery<Cliente[]>({
    queryKey: ["/api/clientes"],
  });

  // Se uma usina foi selecionada, filtrar apenas clientes dela
  // Caso contrário, mostrar todos os clientes
  const filteredClientes = selectedUsinaId
    ? clientes.filter((c) => c.usinaId === selectedUsinaId)
    : clientes;
  const selectedUsina = usinas.find((u) => u.id === selectedUsinaId);

  // Get current fatura data
  const currentFatura = pendingFaturas[currentFaturaIndex];
  const formData = currentFatura?.formData || {};
  const pdfUrl = currentFatura?.pdfUrl || "";
  const selectedClienteId = currentFatura?.selectedClienteId || "";
  const selectedCliente = clientes.find((c) => c.id === selectedClienteId);

  // Helper to update current fatura
  const updateCurrentFatura = (updates: Partial<PendingFatura>) => {
    setPendingFaturas((prev) =>
      prev.map((f, i) => (i === currentFaturaIndex ? { ...f, ...updates } : f))
    );
  };

  const extractMutation = useMutation({
    mutationFn: async (file: File) => {
      const formDataToSend = new FormData();
      formDataToSend.append("file", file);
      formDataToSend.append("precoKwh", precoKwh || "0");
      formDataToSend.append("desconto", selectedUsina?.descontoPadrao || "25");

      const response = await fetch("/api/faturas/extract", {
        method: "POST",
        body: formDataToSend,
        credentials: "include",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Erro ao extrair dados");
      }

      const data = await response.json();
      return { file, data };
    },
    onSuccess: async ({ file, data }: { file: File; data: ExtractedData }) => {
      const initialFormData: Record<string, string> = {};
      FIELD_CONFIG.forEach(({ key }) => {
        const value = data[key];
        initialFormData[key] = value !== null && value !== undefined ? String(value) : "";
      });

      // Buscar cliente pela UC em TODOS os clientes (não apenas os filtrados)
      const matchedCliente = clientes.find(
        (c) => c.unidadeConsumidora === data.unidadeConsumidora
      );

      // Se encontrou o cliente e não há usina selecionada, definir automaticamente
      if (matchedCliente && !selectedUsinaId) {
        setSelectedUsinaId(matchedCliente.usinaId);
      }

      // Tentar buscar o preço do kWh automaticamente pelo mês de referência
      let fetchedPrecoKwh = precoKwh;
      if (data.mesReferencia) {
        try {
          // Codificar o mês para URL (DEZ/2025 -> DEZ%2F2025)
          const mesEncoded = encodeURIComponent(data.mesReferencia);
          console.log("🔍 [UPLOAD] Buscando preço para o mês:", data.mesReferencia, "->", mesEncoded);

          const response = await apiRequest("GET", `/api/precos-kwh/mes/${mesEncoded}`);
          const precoResponse = await response.json();
          console.log("📦 [UPLOAD] Resposta da API de preço (JSON parseado):", precoResponse);

          if (precoResponse.precoKwhCalculado) {
            // Garantir que o valor mantém todos os decimais
            fetchedPrecoKwh = precoResponse.precoKwhCalculado;
            console.log("✅ [UPLOAD] Preço buscado do banco:", fetchedPrecoKwh, "tipo:", typeof fetchedPrecoKwh);

            // Atualizar o estado global do preço
            setPrecoKwh(fetchedPrecoKwh);

            toast({
              title: "Preço detectado automaticamente",
              description: `Preço de R$ ${Number(fetchedPrecoKwh).toFixed(6)}/kWh encontrado para ${data.mesReferencia}`,
            });
          } else {
            console.warn("⚠️ [UPLOAD] API retornou resposta mas sem precoKwhCalculado:", precoResponse);
          }
        } catch (error) {
          console.error("❌ [UPLOAD] Erro ao buscar preço para o mês:", data.mesReferencia, error);
        }
      } else {
        console.warn("⚠️ [UPLOAD] Mês de referência não detectado na fatura");
      }

      // Recalcular valores com o preço correto
      const consumoScee = parseToNumber(initialFormData.consumoScee || "0");
      const precoKwhNum = parseFloat(fetchedPrecoKwh || "0");
      const valorTotal = parseToNumber(initialFormData.valorTotal || "0");
      const precoFioBNum = parseToNumber(initialFormData.precoFioB || "0");
      const desconto = parseFloat(matchedCliente?.desconto || selectedUsina?.descontoPadrao || "25");

      console.log("💰 [UPLOAD - CÁLCULOS INICIAIS]");
      console.log("  Cliente:", matchedCliente?.nome || "NÃO ENCONTRADO");
      console.log("  isPagante:", matchedCliente?.isPagante);
      console.log("  Consumo SCEE:", consumoScee);
      console.log("  Preço kWh usado:", precoKwhNum, "(fetchedPrecoKwh:", fetchedPrecoKwh, ")");
      console.log("  Valor Total da fatura:", valorTotal);
      console.log("  Preço Fio B:", precoFioBNum);
      console.log("  Desconto:", desconto, "%");

      // Calculate Fio B
      const fioBValor = consumoScee * precoFioBNum;
      console.log("  → Fio B calculado:", fioBValor, "=", consumoScee, "×", precoFioBNum);

      // Calculate valorSemDesconto
      const valorSemDesconto = (consumoScee * precoKwhNum) + valorTotal - fioBValor;
      console.log("  → Valor Sem Desconto:", valorSemDesconto, "= (", consumoScee, "×", precoKwhNum, ") +", valorTotal, "-", fioBValor);

      let valorComDesconto: number;
      let economia: number;
      let lucro: number;

      if (matchedCliente && !matchedCliente.isPagante) {
        valorComDesconto = 0;
        economia = 0;
        lucro = -valorTotal;
        console.log("  → Cliente NÃO PAGANTE: valorComDesconto=0, economia=0, lucro=-", valorTotal);
      } else {
        const discountMultiplier = 1 - (desconto / 100);
        valorComDesconto = ((consumoScee * precoKwhNum) * discountMultiplier) + valorTotal - fioBValor;
        economia = valorSemDesconto - valorComDesconto;
        lucro = valorComDesconto - valorTotal;
        console.log("  → Cliente PAGANTE:");
        console.log("    Multiplicador desconto:", discountMultiplier, "= 1 - (", desconto, "/ 100)");
        console.log("    Valor Com Desconto:", valorComDesconto);
        console.log("    Economia:", economia);
        console.log("    Lucro:", lucro);
      }

      // Atualizar formData com valores recalculados
      initialFormData["precoKwhUsado"] = fetchedPrecoKwh;
      console.log("💾 [UPLOAD] Preço kWh armazenado no formData:", initialFormData["precoKwhUsado"]);
      initialFormData["fioB"] = formatNumber(fioBValor);
      initialFormData["valorSemDesconto"] = formatNumber(valorSemDesconto);
      initialFormData["valorComDesconto"] = formatNumber(valorComDesconto);
      initialFormData["economia"] = formatNumber(economia);
      initialFormData["lucro"] = formatNumber(lucro);
      console.log("✅ [UPLOAD] FormData final:", {
        precoKwhUsado: initialFormData["precoKwhUsado"],
        fioB: initialFormData["fioB"],
        valorSemDesconto: initialFormData["valorSemDesconto"],
        valorComDesconto: initialFormData["valorComDesconto"],
        economia: initialFormData["economia"],
        lucro: initialFormData["lucro"]
      });

      // Add to pending faturas
      setPendingFaturas((prev) => {
        const newFaturas = [
          ...prev,
          {
            id: crypto.randomUUID(),
            fileName: file.name,
            formData: initialFormData,
            pdfUrl: data.fileUrl || "",
            selectedClienteId: matchedCliente?.id || "",
            saved: false,
          },
        ];

        // Open modal when we have faturas
        if (newFaturas.length > 0) {
          setShowVerificationModal(true);
        }

        return newFaturas;
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro na extração",
        description: error.message,
        variant: "destructive",
      });
      setFiles((prev) =>
        prev.map((f) => ({ ...f, status: "error" as const }))
      );
    },
  });

  const confirmMutation = useMutation({
    mutationFn: async (data: { extractedData: Record<string, string>; clienteId: string; fileUrl: string; forceReplace?: boolean }) => {
      const normalizedData: Record<string, string> = {};

      const numericFields = [
        "consumoKwh", "consumoScee", "consumoNaoCompensado", "energiaInjetada",
        "precoEnergiaInjetada", "precoEnergiaCompensada", "precoKwhNaoCompensado",
        "precoFioB", "precoAdcBandeira", "contribuicaoIluminacao", "valorTotal",
        "saldoKwh", "geracaoUltimoCiclo", "valorSemDesconto", "valorComDesconto",
        "economia", "lucro", "leituraAnterior", "leituraAtual", "quantidadeDias",
        "precoKwhUsado"
      ];

      // Campos de preço/tarifa que devem manter até 6 casas decimais
      const priceFields = [
        "precoFioB", "precoAdcBandeira", "precoKwhNaoCompensado",
        "precoEnergiaInjetada", "precoEnergiaCompensada", "precoKwhUsado"
      ];

      Object.entries(data.extractedData).forEach(([key, value]) => {
        if (numericFields.includes(key)) {
          const num = parseToNumber(value);
          if (isNaN(num)) {
            normalizedData[key] = priceFields.includes(key) ? "0.000000" : "0.00";
          } else {
            // Aplicar precisão adequada: 6 decimais para preços, 2 para valores monetários
            normalizedData[key] = priceFields.includes(key) ? num.toFixed(6) : num.toFixed(2);
          }
        } else if (key === "mesReferencia") {
          // Normalizar mês para MAIÚSCULO (JAN/2026, DEZ/2025)
          normalizedData[key] = normalizeMonth(value);
        } else {
          normalizedData[key] = value;
        }
      });

      // Use fetch directly to handle 409 conflicts without throwing
      const response = await fetch("/api/faturas/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          extractedData: { ...normalizedData, fileUrl: data.fileUrl },
          clienteId: data.clienteId,
          forceReplace: data.forceReplace || false,
        }),
        credentials: "include",
      });

      // Check if response is conflict (409)
      if (!response.ok) {
        const errorData = await response.json();
        if (response.status === 409 && errorData.conflict) {
          throw { conflict: true, data: errorData };
        }
        throw new Error(errorData.message || "Erro ao salvar fatura");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/faturas"] });

      // Mark current fatura as saved
      updateCurrentFatura({ saved: true });

      toast({
        title: "Fatura salva!",
        description: "Os dados foram salvos com sucesso.",
      });

      // Check if all faturas are saved
      const allSaved = pendingFaturas.every((f, i) =>
        i === currentFaturaIndex ? true : f.saved
      );

      if (allSaved) {
        // All done, close modal and reset
        setShowVerificationModal(false);
        setPendingFaturas([]);
        setCurrentFaturaIndex(0);
        setFiles([]);
      } else {
        // Move to next unsaved fatura
        const nextIndex = pendingFaturas.findIndex((f, i) =>
          i > currentFaturaIndex && !f.saved
        );
        if (nextIndex !== -1) {
          setCurrentFaturaIndex(nextIndex);
        }
      }

      setPendingConfirmData(null);
    },
    onError: (error: any) => {
      if (error.conflict) {
        // Show duplicate confirmation dialog
        setDuplicateInfo(error.data.existingFatura);
        setShowDuplicateDialog(true);
      } else {
        toast({
          title: "Erro ao salvar",
          description: error.message || "Ocorreu um erro ao salvar a fatura.",
          variant: "destructive",
        });
      }
    },
  });

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFiles = Array.from(e.dataTransfer.files).filter(
      (file) => file.type === "application/pdf"
    );
    if (droppedFiles.length > 0) {
      setFiles(droppedFiles.map(file => ({ file, status: "pending" as const })));
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const fileArray = Array.from(e.target.files);
      setFiles(fileArray.map(file => ({ file, status: "pending" as const })));
    }
  };

  const removeFile = () => {
    setFiles([]);
  };

  const handleExtract = async () => {
    if (files.length === 0) {
      toast({
        title: "Selecione um arquivo",
        description: "Adicione pelo menos um arquivo PDF para continuar.",
        variant: "destructive",
      });
      return;
    }

    // Clear previous pending faturas and reset state
    setPendingFaturas([]);
    setCurrentFaturaIndex(0);

    setFiles((prev) =>
      prev.map((f) => ({ ...f, status: "uploading" as const }))
    );

    // Process all files
    files.forEach((fileObj) => {
      extractMutation.mutate(fileObj.file);
    });
  };

  const handleFieldChange = (key: string, value: string) => {
    updateCurrentFatura({
      formData: { ...formData, [key]: value },
    });
  };

  const handleClienteChange = (clienteId: string) => {
    updateCurrentFatura({ selectedClienteId: clienteId });
  };

  // Function to recalculate all calculated fields based on current form values
  const handleRecalculate = () => {
    if (!selectedClienteId || !selectedCliente) {
      toast({
        title: "Selecione um cliente",
        description: "É necessário selecionar um cliente antes de recalcular.",
        variant: "destructive",
      });
      return;
    }

    // Get values from current form data
    const currentFormData = formData;
    const consumoScee = parseToNumber(currentFormData.consumoScee || "0");
    const precoKwhUsado = parseToNumber(currentFormData.precoKwhUsado || precoKwh);
    const valorTotal = parseToNumber(currentFormData.valorTotal || "0");
    const precoFioB = parseToNumber(currentFormData.precoFioB || "0");

    console.log("🔄 [RECALCULAR] ===================");
    console.log("  Cliente:", selectedCliente.nome);
    console.log("  isPagante:", selectedCliente.isPagante);
    console.log("  Desconto do cliente:", selectedCliente.desconto, "%");
    console.log("  Consumo SCEE:", consumoScee);
    console.log("  Preço kWh do formData:", currentFormData.precoKwhUsado);
    console.log("  Preço kWh parseado:", precoKwhUsado);
    console.log("  Preço kWh do estado global:", precoKwh);
    console.log("  Valor Total:", valorTotal);
    console.log("  Preço Fio B:", precoFioB);

    // Calculate Fio B
    const fioBValor = consumoScee * precoFioB;
    console.log("  → Fio B:", fioBValor, "=", consumoScee, "×", precoFioB);

    // Calculate valorSemDesconto
    const valorSemDesconto = (consumoScee * precoKwhUsado) + valorTotal - fioBValor;
    console.log("  → Valor Sem Desconto:", valorSemDesconto, "= (", consumoScee, "×", precoKwhUsado, ") +", valorTotal, "-", fioBValor);

    let valorComDesconto: number;
    let economia: number;
    let lucro: number;

    // Check if client is paying customer or own use (uso próprio)
    if (!selectedCliente.isPagante) {
      // Cliente de uso próprio (não pagante):
      // - Não há receita (valor com desconto = 0)
      // - Não há economia (economia = 0)
      // - Lucro é negativo (custo da concessionária)
      valorComDesconto = 0;
      economia = 0;
      lucro = -valorTotal;
      console.log(`  → Cliente ${selectedCliente.nome} é USO PRÓPRIO - sem receita, lucro = -${valorTotal.toFixed(2)}`);
    } else {
      // Cliente pagante - cálculo normal com desconto
      const clientDiscount = parseFloat(selectedCliente.desconto || "0");
      const discountMultiplier = 1 - (clientDiscount / 100);
      valorComDesconto = ((consumoScee * precoKwhUsado) * discountMultiplier) + valorTotal - fioBValor;
      economia = valorSemDesconto - valorComDesconto;
      lucro = valorComDesconto - valorTotal;
      console.log(`  → Cliente ${selectedCliente.nome} PAGANTE - ${clientDiscount}% desconto`);
      console.log("    Multiplicador desconto:", discountMultiplier);
      console.log("    Valor Com Desconto:", valorComDesconto);
      console.log("    Economia:", economia);
      console.log("    Lucro:", lucro);
    }

    console.log("✅ [RECALCULAR] Resultados finais:");
    console.log("  Fio B:", fioBValor);
    console.log("  Valor Sem Desconto:", valorSemDesconto);
    console.log("  Valor Com Desconto:", valorComDesconto);
    console.log("  Economia:", economia);
    console.log("  Lucro:", lucro);
    console.log("==================================");

    // Update current fatura with recalculated values
    updateCurrentFatura({
      formData: {
        ...currentFormData,
        fioB: formatNumber(fioBValor),
        valorSemDesconto: formatNumber(valorSemDesconto),
        valorComDesconto: formatNumber(valorComDesconto),
        economia: formatNumber(economia),
        lucro: formatNumber(lucro),
      },
    });

    toast({
      title: "Recalculado!",
      description: "Os campos foram recalculados com sucesso.",
    });
  };

  // Auto-recalculate values when client is selected
  useEffect(() => {
    if (selectedClienteId && selectedCliente && formData.consumoScee) {
      console.log("🔄 [AUTO-RECALCULAR] Cliente foi selecionado, disparando recálculo automático...");
      handleRecalculate();
    } else {
      console.log("⏸️ [AUTO-RECALCULAR] Condições não atendidas:", {
        selectedClienteId,
        selectedCliente: !!selectedCliente,
        consumoScee: formData.consumoScee
      });
    }
  }, [selectedClienteId, selectedCliente]);

  const handleConfirm = () => {
    if (!selectedClienteId) {
      toast({
        title: "Selecione o cliente",
        description: "Escolha o cliente para vincular esta fatura.",
        variant: "destructive",
      });
      return;
    }

    const confirmData = {
      extractedData: formData,
      clienteId: selectedClienteId,
      fileUrl: pdfUrl,
    };

    // Store for possible duplicate confirmation
    setPendingConfirmData(confirmData);

    confirmMutation.mutate(confirmData);
  };

  const handleConfirmReplace = () => {
    if (pendingConfirmData) {
      confirmMutation.mutate({
        ...pendingConfirmData,
        forceReplace: true,
      });
      setShowDuplicateDialog(false);
      setDuplicateInfo(null);
    }
  };

  const handleCancelReplace = () => {
    setShowDuplicateDialog(false);
    setDuplicateInfo(null);
    setPendingConfirmData(null);
  };

  const handleRemoveFatura = (indexToRemove: number) => {
    setPendingFaturas((prev) => {
      const newFaturas = prev.filter((_, i) => i !== indexToRemove);

      // If we removed the current fatura, adjust the index
      if (indexToRemove === currentFaturaIndex) {
        // Move to previous fatura if possible, otherwise to 0
        setCurrentFaturaIndex(Math.max(0, indexToRemove - 1));
      } else if (indexToRemove < currentFaturaIndex) {
        // If we removed a fatura before the current one, adjust index
        setCurrentFaturaIndex(currentFaturaIndex - 1);
      }

      // If no faturas left, close modal
      if (newFaturas.length === 0) {
        setShowVerificationModal(false);
        setFiles([]);
      }

      return newFaturas;
    });

    toast({
      title: "Fatura removida",
      description: "A fatura foi removida da lista.",
    });
  };

  const handleSaveAll = async () => {
    // Validate that all faturas have a client selected
    const faturasWithoutCliente = pendingFaturas.filter(f => !f.selectedClienteId);

    if (faturasWithoutCliente.length > 0) {
      toast({
        title: "Faturas sem cliente",
        description: `${faturasWithoutCliente.length} fatura(s) não possuem cliente vinculado. Por favor, vincule todos os clientes antes de salvar em lote.`,
        variant: "destructive",
      });
      return;
    }

    setShowSaveAllDialog(false);
    setIsSavingAll(true);

    const unsavedFaturas = pendingFaturas
      .map((f, index) => ({ ...f, originalIndex: index }))
      .filter(f => !f.saved);

    setSaveAllProgress({ current: 0, total: unsavedFaturas.length });

    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < unsavedFaturas.length; i++) {
      const fatura = unsavedFaturas[i];
      setSaveAllProgress({ current: i + 1, total: unsavedFaturas.length });

      try {
        const normalizedData: Record<string, string> = {};

        const numericFields = [
          "consumoKwh", "consumoScee", "consumoNaoCompensado", "energiaInjetada",
          "precoEnergiaInjetada", "precoEnergiaCompensada", "precoKwhNaoCompensado",
          "precoFioB", "precoAdcBandeira", "contribuicaoIluminacao", "valorTotal",
          "saldoKwh", "geracaoUltimoCiclo", "valorSemDesconto", "valorComDesconto",
          "economia", "lucro", "leituraAnterior", "leituraAtual", "quantidadeDias",
          "precoKwhUsado"
        ];

        // Campos de preço/tarifa que devem manter até 6 casas decimais
        const priceFields = [
          "precoFioB", "precoAdcBandeira", "precoKwhNaoCompensado",
          "precoEnergiaInjetada", "precoEnergiaCompensada", "precoKwhUsado"
        ];

        Object.entries(fatura.formData).forEach(([key, value]) => {
          if (numericFields.includes(key)) {
            const num = parseToNumber(value);
            if (isNaN(num)) {
              normalizedData[key] = priceFields.includes(key) ? "0.000000" : "0.00";
            } else {
              // Aplicar precisão adequada: 6 decimais para preços, 2 para valores monetários
              normalizedData[key] = priceFields.includes(key) ? num.toFixed(6) : num.toFixed(2);
            }
          } else {
            normalizedData[key] = value;
          }
        });

        const response = await fetch("/api/faturas/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            extractedData: { ...normalizedData, fileUrl: fatura.pdfUrl },
            clienteId: fatura.selectedClienteId,
            forceReplace: replaceAllDuplicates,
          }),
          credentials: "include",
        });

        if (!response.ok) {
          const errorData = await response.json();

          // If it's a duplicate (409) and we're not auto-replacing, stop the batch process
          if (response.status === 409 && errorData.conflict && !replaceAllDuplicates) {
            setIsSavingAll(false);
            setCurrentFaturaIndex(fatura.originalIndex);
            setDuplicateInfo(errorData.existingFatura);
            setPendingConfirmData({
              extractedData: fatura.formData,
              clienteId: fatura.selectedClienteId,
              fileUrl: fatura.pdfUrl,
            });
            setShowDuplicateDialog(true);

            toast({
              title: "Duplicata encontrada",
              description: `A fatura "${fatura.fileName}" já existe. Por favor, decida se deseja substituir.`,
              variant: "destructive",
            });

            return; // Stop the batch process
          }

          throw new Error(errorData.message || "Erro ao salvar fatura");
        }

        // Mark this fatura as saved
        setPendingFaturas((prev) =>
          prev.map((f, idx) =>
            idx === fatura.originalIndex ? { ...f, saved: true } : f
          )
        );

        successCount++;
      } catch (error: any) {
        console.error(`Erro ao salvar ${fatura.fileName}:`, error);
        errorCount++;

        toast({
          title: "Erro ao salvar",
          description: `Erro ao salvar "${fatura.fileName}": ${error.message}`,
          variant: "destructive",
        });
      }
    }

    // Invalidate queries after all saves
    queryClient.invalidateQueries({ queryKey: ["/api/faturas"] });

    setIsSavingAll(false);
    setSaveAllProgress({ current: 0, total: 0 });

    // Check if all are now saved
    const allSaved = pendingFaturas.every((f, i) => {
      const wasJustSaved = unsavedFaturas.some(uf => uf.originalIndex === i);
      return wasJustSaved || f.saved;
    });

    if (allSaved && errorCount === 0) {
      toast({
        title: "Sucesso!",
        description: `Todas as ${successCount} faturas foram salvas com sucesso.`,
      });

      // Close modal and reset
      setShowVerificationModal(false);
      setPendingFaturas([]);
      setCurrentFaturaIndex(0);
      setFiles([]);
    } else if (successCount > 0) {
      toast({
        title: "Salvamento parcial",
        description: `${successCount} fatura(s) salva(s) com sucesso. ${errorCount} erro(s).`,
      });
    }
  };

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Upload de Faturas"
        description="Envie as faturas da concessionária para processamento automático"
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Arquivo PDF</CardTitle>
            </CardHeader>
            <CardContent>
              <div
                className={cn(
                  "border-2 border-dashed rounded-lg p-8 text-center transition-colors",
                  isDragging
                    ? "border-primary bg-primary/5"
                    : "border-muted-foreground/25 hover:border-primary/50"
                )}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-4" />
                <p className="text-lg font-medium mb-2">
                  Arraste os PDFs aqui
                </p>
                <p className="text-sm text-muted-foreground mb-4">
                  ou clique para selecionar os arquivos
                </p>
                <input
                  type="file"
                  accept=".pdf"
                  multiple
                  onChange={handleFileSelect}
                  className="hidden"
                  id="file-upload"
                  data-testid="input-file-upload"
                />
                <Button variant="outline" asChild>
                  <label htmlFor="file-upload" className="cursor-pointer">
                    Selecionar Arquivos
                  </label>
                </Button>
              </div>

              {files.length > 0 && (
                <div className="mt-6 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">
                      {files.length} arquivo{files.length > 1 ? "s" : ""} selecionado{files.length > 1 ? "s" : ""}
                    </p>
                    {files.some(f => f.status === "pending") && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={removeFile}
                        className="h-7 text-xs"
                      >
                        Limpar todos
                      </Button>
                    )}
                  </div>
                  {files.map((fileObj, index) => (
                    <div key={index} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                      <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
                      <span className="flex-1 text-sm truncate">
                        {fileObj.file.name}
                      </span>
                      {fileObj.status === "uploading" && (
                        <Loader2 className="h-4 w-4 animate-spin text-primary" />
                      )}
                      {fileObj.status === "success" && (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      )}
                      {fileObj.status === "error" && (
                        <AlertCircle className="h-4 w-4 text-destructive" />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Button
            className="w-full"
            size="lg"
            onClick={handleExtract}
            disabled={
              files.length === 0 ||
              extractMutation.isPending
            }
            data-testid="button-process-upload"
          >
            {extractMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Extraindo dados...
              </>
            ) : (
              <>
                <Eye className="h-4 w-4 mr-2" />
                Extrair e Verificar
              </>
            )}
          </Button>
        </div>
      </div>

      <Dialog open={showVerificationModal} onOpenChange={setShowVerificationModal}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle>Verificar Dados Extraídos</DialogTitle>
            <DialogDescription>
              Confira e edite os dados extraídos da fatura antes de salvar.
              {pendingFaturas.length > 1 && (
                <span className="ml-2 font-medium">
                  ({pendingFaturas.length} faturas carregadas)
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          {pendingFaturas.length > 1 && (
            <div className="border-b overflow-x-auto">
              <Tabs value={currentFaturaIndex.toString()} onValueChange={(v) => setCurrentFaturaIndex(parseInt(v))}>
                <TabsList className="inline-flex w-max h-auto p-1 mb-2">
                  {pendingFaturas.map((fatura, index) => (
                    <TabsTrigger
                      key={fatura.id}
                      value={index.toString()}
                      className="text-xs relative group pr-8 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground whitespace-nowrap"
                    >
                      <span className="max-w-[120px] truncate inline-block">
                        {fatura.fileName}
                      </span>
                      {fatura.saved && <Check className="ml-1 h-3 w-3 text-green-500 inline-block" />}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveFatura(index);
                        }}
                        className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity p-0.5 hover:bg-destructive/20 rounded"
                        title="Remover esta fatura"
                      >
                        <X className="h-3 w-3 text-destructive" />
                      </button>
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
            </div>
          )}

          <div className="grid gap-6 lg:grid-cols-2">
            <ScrollArea className="h-[550px] pr-4">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Vincular ao Cliente</Label>
                  <Select
                    value={selectedClienteId}
                    onValueChange={handleClienteChange}
                  >
                    <SelectTrigger data-testid="select-cliente-fatura">
                      <SelectValue placeholder="Selecione o cliente" />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredClientes.map((cliente) => (
                        <SelectItem key={cliente.id} value={cliente.id}>
                          {cliente.nome} (UC: {cliente.unidadeConsumidora})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedCliente && selectedCliente.isPagante && (
                    <div className="mt-2 p-2 rounded-md bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800">
                      <p className="text-sm text-blue-900 dark:text-blue-100">
                        <strong>Desconto aplicado:</strong> {selectedCliente.desconto}%
                        {selectedUsina && parseFloat(selectedCliente.desconto || "0") !== parseFloat(selectedUsina.descontoPadrao || "0") && (
                          <span className="ml-2 text-xs text-blue-700 dark:text-blue-300">
                            (diferente do padrão da usina: {selectedUsina.descontoPadrao}%)
                          </span>
                        )}
                      </p>
                    </div>
                  )}
                  {selectedCliente && !selectedCliente.isPagante && (
                    <div className="mt-2 p-2 rounded-md bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800">
                      <p className="text-sm text-yellow-900 dark:text-yellow-100">
                        <strong>Cliente de uso próprio</strong> - Sem receita (apenas custo da concessionária)
                      </p>
                    </div>
                  )}
                </div>

                <Separator />

                <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
                  Dados Extraídos
                </h4>

                <TooltipProvider>
                  <div className="grid gap-3">
                    {FIELD_CONFIG.map(({ key, label, readonly, formula }) => {
                      // Log para debug do campo precoKwhUsado
                      if (key === "precoKwhUsado") {
                        console.log("🎨 [MODAL] Renderizando campo precoKwhUsado:", formData[key]);
                      }
                      return (
                      <div key={key} className="space-y-1">
                        <div className="flex items-center gap-1">
                          <Label htmlFor={`field-${key}`} className="text-xs text-muted-foreground">
                            {label}
                          </Label>
                          {readonly && formula && (
                            <Tooltip delayDuration={200}>
                              <TooltipTrigger asChild>
                                <Info className="h-3.5 w-3.5 text-muted-foreground/60 hover:text-muted-foreground transition-colors cursor-help" />
                              </TooltipTrigger>
                              <TooltipContent side="right" className="max-w-xs">
                                <p className="text-xs font-mono">{formula}</p>
                              </TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                        <Input
                          id={`field-${key}`}
                          value={formData[key] || ""}
                          onChange={(e) => handleFieldChange(key, e.target.value)}
                          placeholder={`Informe ${label.toLowerCase()}`}
                          className={cn(
                            "h-8 text-sm",
                            readonly && "bg-muted/50 cursor-not-allowed text-muted-foreground"
                          )}
                          readOnly={readonly}
                          disabled={readonly}
                          data-testid={`input-field-${key}`}
                        />
                      </div>
                      );
                    })}
                  </div>
                </TooltipProvider>
              </div>
            </ScrollArea>

            <div className="space-y-4">
              <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
                Visualização do PDF
              </h4>
              {pdfUrl ? (
                <div className="border rounded-lg overflow-hidden h-[520px]">
                  <iframe
                    src={pdfUrl}
                    className="w-full h-full"
                    title="PDF Preview"
                  />
                </div>
              ) : (
                <div className="border rounded-lg h-[520px] flex items-center justify-center bg-muted/50">
                  <p className="text-muted-foreground">PDF não disponível</p>
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="flex justify-between items-center">
            <Button
              variant="secondary"
              onClick={handleRecalculate}
              disabled={!selectedClienteId}
              className="mr-auto"
            >
              <Calculator className="h-4 w-4 mr-2" />
              Recalcular
            </Button>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setShowVerificationModal(false)}
              >
                Cancelar
              </Button>
              {pendingFaturas.length > 1 && (
                <Button
                  onClick={() => setShowSaveAllDialog(true)}
                  disabled={confirmMutation.isPending || isSavingAll}
                  variant="secondary"
                >
                  <Save className="h-4 w-4 mr-2" />
                  Salvar Todas ({pendingFaturas.length})
                </Button>
              )}
              <Button
                onClick={handleConfirm}
                disabled={!selectedClienteId || confirmMutation.isPending || isSavingAll}
                data-testid="button-confirm-save"
              >
                {confirmMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    {pendingFaturas.length > 1 ? "Salvar Esta" : "Confirmar e Salvar"}
                  </>
                )}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Duplicate Fatura Confirmation Dialog */}
      <Dialog open={showDuplicateDialog} onOpenChange={setShowDuplicateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Fatura Duplicada Encontrada</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Já existe uma fatura salva para este cliente no mês de referência{" "}
              <strong className="text-foreground">{duplicateInfo?.mesReferencia}</strong>.
            </p>
            {duplicateInfo && (
              <div className="p-4 bg-muted rounded-lg space-y-2">
                <h4 className="font-medium text-sm">Dados da Fatura Existente:</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="text-muted-foreground">Mês:</div>
                  <div className="font-mono">{duplicateInfo.mesReferencia}</div>
                  <div className="text-muted-foreground">Valor Total:</div>
                  <div className="font-mono">R$ {duplicateInfo.valorTotal}</div>
                  <div className="text-muted-foreground">Valor c/ Desconto:</div>
                  <div className="font-mono">R$ {duplicateInfo.valorComDesconto}</div>
                  <div className="text-muted-foreground">Data Vencimento:</div>
                  <div className="font-mono">{duplicateInfo.dataVencimento}</div>
                </div>
              </div>
            )}
            <p className="text-sm text-yellow-600 dark:text-yellow-500 font-medium">
              ⚠️ Se confirmar, os dados anteriores serão substituídos pelos novos dados e a fatura antiga será removida permanentemente.
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={handleCancelReplace}
              disabled={confirmMutation.isPending}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmReplace}
              disabled={confirmMutation.isPending}
            >
              {confirmMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Substituindo...
                </>
              ) : (
                <>Confirmar Substituição</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Save All Confirmation Dialog */}
      <Dialog open={showSaveAllDialog} onOpenChange={setShowSaveAllDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Salvamento em Lote</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {isSavingAll ? (
              <div className="p-4 bg-primary/10 rounded-lg border border-primary/20">
                <div className="flex items-center gap-3">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">
                      Salvando faturas...
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Progresso: {saveAllProgress.current} de {saveAllProgress.total}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Você está prestes a salvar <strong className="text-foreground">{pendingFaturas.length} faturas</strong> de uma vez.
              </p>
            )}
            <div className="p-4 bg-muted rounded-lg space-y-2 max-h-60 overflow-y-auto">
              <h4 className="font-medium text-sm mb-2">Faturas a serem salvas:</h4>
              {pendingFaturas.map((fatura, index) => {
                const cliente = clientes.find((c) => c.id === fatura.selectedClienteId);
                return (
                  <div key={fatura.id} className="text-sm flex items-center justify-between py-1 border-b last:border-0">
                    <div className="flex items-center gap-2">
                      {fatura.saved && <Check className="h-4 w-4 text-green-500" />}
                      <span className={cn(fatura.saved && "text-muted-foreground")}>
                        {index + 1}. {fatura.fileName}
                      </span>
                    </div>
                    {cliente ? (
                      <span className="text-xs text-muted-foreground">
                        {cliente.nome}
                      </span>
                    ) : (
                      <span className="text-xs text-destructive">
                        Sem cliente
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="flex items-start gap-2 p-3 bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800 rounded-lg">
              <input
                type="checkbox"
                id="replace-duplicates"
                checked={replaceAllDuplicates}
                onChange={(e) => setReplaceAllDuplicates(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
              />
              <label htmlFor="replace-duplicates" className="text-sm text-orange-900 dark:text-orange-100 cursor-pointer">
                <strong>Substituir automaticamente faturas duplicadas</strong>
                <p className="text-xs mt-1 text-orange-700 dark:text-orange-300">
                  Se marcado, faturas com mesmo mês de referência serão substituídas automaticamente. Caso contrário, o processo será interrompido para confirmação manual.
                </p>
              </label>
            </div>
            <p className="text-sm text-yellow-600 dark:text-yellow-500 font-medium">
              ⚠️ Certifique-se de que todas as faturas estão vinculadas aos clientes corretos antes de prosseguir.
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowSaveAllDialog(false)}
              disabled={isSavingAll}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSaveAll}
              disabled={isSavingAll}
            >
              {isSavingAll ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Salvando {saveAllProgress.current}/{saveAllProgress.total}...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Confirmar e Salvar Todas
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
