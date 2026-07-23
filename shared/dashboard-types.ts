/**
 * Contrato de GET /api/dashboard/overview.
 *
 * Fica em shared/ para o serviço que monta o payload (server) e a página que
 * o consome (client) não saírem de sincronia.
 */

export interface DashboardFinanceiro {
  /** Soma de valorComDesconto — o que os clientes pagam. */
  receita: number;
  /** Soma de valorTotal — o que a concessionária cobra. */
  custo: number;
  lucro: number;
  /** Quanto o cliente deixou de pagar em relação à tarifa cheia. */
  economia: number;
  /** Soma de consumoScee — energia compensada pelas usinas. */
  kwhDistribuido: number;
}

export interface DashboardTotais extends DashboardFinanceiro {
  usinas: number;
  clientes: number;
  clientesAtivos: number;
  geracao: number;
  geracaoPrevista: number;
  performance: number;
  saldoTotalKwh: number;
  faturasEsperadas: number;
  faturasRecebidas: number;
  faturasSemPdf: number;
  clientesSemFatura: number;
  faturasFaltando: number;
  faturasPendentesPagamento: number;
  faturasEmAtraso: number;
  aguardandoConfirmacao: number;
}

export interface DashboardUsina extends DashboardFinanceiro {
  id: string;
  nome: string;
  unidadeConsumidora: string;
  potenciaKwp: number;
  clientes: number;
  clientesAtivos: number;
  geracao: number;
  geracaoPrevista: number;
  performance: number;
  saldoKwh: number;
  faturasEsperadas: number;
  faturasRecebidas: number;
  faturasFaltando: number;
  faturasPendentesPagamento: number;
  faturasEmAtraso: number;
  variacaoLucro: number | null;
  serieGeracao: { mes: string; kwh: number; previsto: number }[];
}

export interface DashboardSaldoUC {
  clienteId: string;
  clienteNome: string;
  uc: string;
  usinaId: string;
  usinaNome: string;
  saldo: number;
  /** Mês da fatura de onde o saldo foi lido. */
  mes: string;
}

/**
 * Preço do kWh de um mês, em R$/kWh.
 *
 * `liquido` é o que sobra por faixa de contrato depois do desconto e do fio B
 * (repassado à concessionária): `tabela × (1 − desconto) − fioB`. A chave é o
 * percentual de desconto em texto — "25" para 25%.
 */
export interface DashboardPrecoMes {
  mes: string;
  /** Tarifa calculada na página Preços kWh a partir de TUSD, TE e impostos. */
  tabela: number | null;
  /** Mediana do fio B das faturas do mês. */
  fioB: number | null;
  /** true quando o mês não tinha fatura e o fio B veio do mês anterior. */
  fioBHerdado: boolean;
  liquido: Record<string, number>;
}

export type DashboardPendenciaTipo = "sem_fatura" | "sem_pdf" | "nao_pago" | "vencida";

export interface DashboardPendencia {
  clienteId: string;
  clienteNome: string;
  uc: string;
  usinaId: string;
  usinaNome: string;
  tipo: DashboardPendenciaTipo;
  detalhe: string;
  faturaId: string | null;
}

export interface DashboardOverview {
  mesReferencia: string;
  mesAnterior: string;
  mesesDisponiveis: string[];
  atualizadoEm: string;
  totais: DashboardTotais;
  variacoes: {
    lucro: number | null;
    receita: number | null;
    geracao: number | null;
    economia: number | null;
  };
  usinas: DashboardUsina[];
  /** Faixas de desconto praticadas nos contratos ativos, da menor para a maior. */
  descontos: { percentual: number; clientes: number }[];
  precoKwh: DashboardPrecoMes[];
  historico: {
    mes: string;
    geracao: number;
    receita: number;
    custo: number;
    lucro: number;
    economia: number;
    faturas: number;
  }[];
  /** Uma linha por mês; cada usina é uma chave com o kWh gerado. */
  geracaoPorUsina: Record<string, string | number>[];
  saldos: {
    maiores: DashboardSaldoUC[];
    /** Vazio quando há poucas UCs — seria só o ranking de maiores invertido. */
    menores: DashboardSaldoUC[];
    total: number;
    ucsComSaldo: number;
  };
  pendencias: DashboardPendencia[];
}
