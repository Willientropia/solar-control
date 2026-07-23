import { storage } from "../storage";
import {
  lastNMonths,
  monthSortKey,
  normalizeMonthRef,
  sameMonthRef,
  currentMonthRef,
} from "@shared/month-utils";
import type { Cliente, Fatura } from "@shared/schema";
import type {
  DashboardFinanceiro,
  DashboardOverview,
  DashboardPendencia,
  DashboardSaldoUC,
  DashboardUsina,
} from "@shared/dashboard-types";

export type { DashboardOverview };

/** Quantos meses de histórico os gráficos mostram. */
const HISTORICO_MESES = 12;
/** Quantas UCs entram nos rankings de saldo. */
const TOP_SALDOS = 5;
/** Faixas de desconto no gráfico de preço; acima disso as linhas se confundem. */
const MAX_FAIXAS_DESCONTO = 4;

const num = (v: string | number | null | undefined): number => {
  if (v === null || v === undefined || v === "") return 0;
  const n = typeof v === "number" ? v : parseFloat(v);
  return Number.isFinite(n) ? n : 0;
};

/** Fatura só é considerada quitada no status final; o resto é pendência. */
const isPaga = (f: Fatura) => f.status === "pago";

/** dataVencimento vem como texto "DD/MM/AAAA" da extração do PDF. */
function isVencida(f: Fatura, hoje: Date): boolean {
  if (!f.dataVencimento) return false;
  const parts = f.dataVencimento.split("/");
  if (parts.length !== 3) return false;

  const [dia, mes, ano] = parts.map(Number);
  if (!dia || !mes || !ano) return false;

  return new Date(ano, mes - 1, dia) < hoje;
}

function pct(parte: number, total: number): number {
  return total > 0 ? (parte / total) * 100 : 0;
}

function mediana(valores: number[]): number | null {
  if (!valores.length) return null;
  const ordenados = [...valores].sort((a, b) => a - b);
  const meio = Math.floor(ordenados.length / 2);
  return ordenados.length % 2
    ? ordenados[meio]
    : (ordenados[meio - 1] + ordenados[meio]) / 2;
}

/** Variação percentual entre dois períodos; null quando não há base de comparação. */
function variacao(atual: number, anterior: number): number | null {
  if (!anterior) return null;
  return ((atual - anterior) / Math.abs(anterior)) * 100;
}

function somaFinanceira(faturas: Fatura[]): DashboardFinanceiro {
  return {
    receita: faturas.reduce((acc, f) => acc + num(f.valorComDesconto), 0),
    custo: faturas.reduce((acc, f) => acc + num(f.valorTotal), 0),
    lucro: faturas.reduce((acc, f) => acc + num(f.lucro), 0),
    economia: faturas.reduce((acc, f) => acc + num(f.economia), 0),
    kwhDistribuido: faturas.reduce((acc, f) => acc + num(f.consumoScee), 0),
  };
}

/**
 * Monta tudo que o dashboard mostra numa consulta só.
 *
 * O mês de referência default é o mês mais recente que tem fatura ou geração
 * lançada — não o mês do calendário. As faturas de um mês só entram no sistema
 * semanas depois, então usar `new Date()` deixaria o dashboard zerado a maior
 * parte do tempo (era o que acontecia em /api/dashboard/stats).
 */
export async function buildDashboardOverview(mesSolicitado?: string): Promise<DashboardOverview> {
  const [usinas, clientes, todasFaturas, geracoes, precos] = await Promise.all([
    storage.getUsinas(),
    storage.getClientes(),
    storage.getFaturas(),
    storage.getGeracoes(),
    storage.getPrecosKwh(),
  ]);

  const hoje = new Date();

  // Meses que aparecem no seletor: tudo que tem fatura ou geração, do mais novo
  // ao mais antigo.
  const mesesComDados = Array.from(
    new Set([
      ...todasFaturas.map((f) => normalizeMonthRef(f.mesReferencia)),
      ...geracoes.map((g) => normalizeMonthRef(g.mesReferencia)),
    ]),
  )
    .filter((m) => monthSortKey(m) >= 0)
    .sort((a, b) => monthSortKey(b) - monthSortKey(a));

  const mesReferencia =
    (mesSolicitado && mesesComDados.find((m) => sameMonthRef(m, mesSolicitado))) ||
    mesesComDados[0] ||
    currentMonthRef(hoje);

  const mesAnterior = mesesComDados.find((m) => monthSortKey(m) < monthSortKey(mesReferencia)) || "";

  const usinaPorId = new Map(usinas.map((u) => [u.id, u]));
  const clientesAtivos = clientes.filter((c) => c.ativo);

  // A fatura carrega usinaId, mas registros antigos vieram sem ele — o cliente
  // é a fonte de verdade nesse caso.
  const usinaDaFatura = (f: Fatura & { cliente?: Cliente }): string =>
    f.usinaId || f.cliente?.usinaId || "";

  const faturasDoMes = todasFaturas.filter((f) => sameMonthRef(f.mesReferencia, mesReferencia));
  const faturasMesAnterior = mesAnterior
    ? todasFaturas.filter((f) => sameMonthRef(f.mesReferencia, mesAnterior))
    : [];

  const geracaoDoMes = geracoes.filter((g) => sameMonthRef(g.mesReferencia, mesReferencia));
  const geracaoMesAnterior = mesAnterior
    ? geracoes.filter((g) => sameMonthRef(g.mesReferencia, mesAnterior))
    : [];

  // ---- Saldo de créditos por UC ----
  // Vale o saldo da fatura mais recente até o mês selecionado; faturas mais
  // novas que o mês em tela não contam.
  const limite = monthSortKey(mesReferencia);
  const saldoPorCliente = new Map<string, { saldo: number; mes: string }>();

  for (const f of todasFaturas) {
    if (f.saldoKwh === null || f.saldoKwh === undefined) continue;
    const key = monthSortKey(f.mesReferencia);
    if (key < 0 || key > limite) continue;

    const atual = saldoPorCliente.get(f.clienteId);
    if (!atual || key > monthSortKey(atual.mes)) {
      saldoPorCliente.set(f.clienteId, {
        saldo: num(f.saldoKwh),
        mes: normalizeMonthRef(f.mesReferencia),
      });
    }
  }

  const saldosUC: DashboardSaldoUC[] = clientesAtivos
    .map((c) => {
      const registro = saldoPorCliente.get(c.id);
      if (!registro) return null;
      const usina = usinaPorId.get(c.usinaId);
      return {
        clienteId: c.id,
        clienteNome: c.nome,
        uc: c.unidadeConsumidoraNova || c.unidadeConsumidora || "—",
        usinaId: c.usinaId,
        usinaNome: usina?.nome || "Sem usina",
        saldo: registro.saldo,
        mes: registro.mes,
      };
    })
    .filter((s): s is DashboardSaldoUC => s !== null);

  const saldosOrdenados = [...saldosUC].sort((a, b) => b.saldo - a.saldo);

  // ---- Pendências do mês ----
  const pendencias: DashboardPendencia[] = [];

  for (const cliente of clientesAtivos) {
    const usina = usinaPorId.get(cliente.usinaId);
    const base = {
      clienteId: cliente.id,
      clienteNome: cliente.nome,
      uc: cliente.unidadeConsumidoraNova || cliente.unidadeConsumidora || "—",
      usinaId: cliente.usinaId,
      usinaNome: usina?.nome || "Sem usina",
    };

    const fatura = faturasDoMes.find((f) => f.clienteId === cliente.id);

    if (!fatura) {
      pendencias.push({
        ...base,
        tipo: "sem_fatura",
        detalhe: `Nenhuma fatura lançada em ${mesReferencia}`,
        faturaId: null,
      });
      continue;
    }

    if (!fatura.arquivoPdfUrl) {
      pendencias.push({
        ...base,
        tipo: "sem_pdf",
        detalhe: "Fatura lançada sem o PDF da concessionária",
        faturaId: fatura.id,
      });
    } else if (!isPaga(fatura)) {
      const vencida = isVencida(fatura, hoje);
      pendencias.push({
        ...base,
        tipo: vencida ? "vencida" : "nao_pago",
        detalhe: vencida
          ? `Vencida em ${fatura.dataVencimento}`
          : `Aguardando pagamento${fatura.dataVencimento ? ` · vence ${fatura.dataVencimento}` : ""}`,
        faturaId: fatura.id,
      });
    }
  }

  // ---- Agregados por usina ----
  const usinasOverview: DashboardUsina[] = usinas.map((usina) => {
    const clientesDaUsina = clientes.filter((c) => c.usinaId === usina.id);
    const ativosDaUsina = clientesDaUsina.filter((c) => c.ativo);
    const faturasUsina = faturasDoMes.filter((f) => usinaDaFatura(f) === usina.id);
    const faturasUsinaAnterior = faturasMesAnterior.filter((f) => usinaDaFatura(f) === usina.id);

    const geracao = geracaoDoMes
      .filter((g) => g.usinaId === usina.id)
      .reduce((acc, g) => acc + num(g.kwhGerado), 0);
    const previsto = num(usina.producaoMensalPrevista);

    const financeiro = somaFinanceira(faturasUsina);
    const comPdf = faturasUsina.filter((f) => !!f.arquivoPdfUrl).length;

    return {
      id: usina.id,
      nome: usina.nome,
      unidadeConsumidora: usina.unidadeConsumidora,
      potenciaKwp: num(usina.potenciaKwp),
      clientes: clientesDaUsina.length,
      clientesAtivos: ativosDaUsina.length,
      geracao,
      geracaoPrevista: previsto,
      performance: pct(geracao, previsto),
      ...financeiro,
      saldoKwh: saldosUC
        .filter((s) => s.usinaId === usina.id)
        .reduce((acc, s) => acc + s.saldo, 0),
      faturasEsperadas: ativosDaUsina.length,
      faturasRecebidas: comPdf,
      faturasFaltando: Math.max(ativosDaUsina.length - comPdf, 0),
      faturasPendentesPagamento: faturasUsina.filter((f) => !isPaga(f)).length,
      faturasEmAtraso: faturasUsina.filter((f) => !isPaga(f) && isVencida(f, hoje)).length,
      variacaoLucro: variacao(
        financeiro.lucro,
        faturasUsinaAnterior.reduce((acc, f) => acc + num(f.lucro), 0),
      ),
      serieGeracao: lastNMonths(6, mesReferencia).map((mes) => ({
        mes,
        kwh: geracoes
          .filter((g) => g.usinaId === usina.id && sameMonthRef(g.mesReferencia, mes))
          .reduce((acc, g) => acc + num(g.kwhGerado), 0),
        previsto,
      })),
    };
  });

  // ---- Histórico de 12 meses ----
  const janela = lastNMonths(HISTORICO_MESES, mesReferencia);

  const historico = janela.map((mes) => {
    const faturasMes = todasFaturas.filter((f) => sameMonthRef(f.mesReferencia, mes));
    return {
      mes,
      geracao: geracoes
        .filter((g) => sameMonthRef(g.mesReferencia, mes))
        .reduce((acc, g) => acc + num(g.kwhGerado), 0),
      ...somaFinanceira(faturasMes),
      faturas: faturasMes.length,
    };
  }).map(({ kwhDistribuido, ...resto }) => resto);

  const geracaoPorUsina = janela.map((mes) => {
    const linha: Record<string, string | number> = { mes };
    for (const usina of usinas) {
      linha[usina.id] = geracoes
        .filter((g) => g.usinaId === usina.id && sameMonthRef(g.mesReferencia, mes))
        .reduce((acc, g) => acc + num(g.kwhGerado), 0);
    }
    linha.previsto = usinas.reduce((acc, u) => acc + num(u.producaoMensalPrevista), 0);
    return linha;
  });

  // ---- Preço do kWh ----
  // Faixas de desconto realmente praticadas, tiradas dos contratos ativos —
  // criar um contrato novo com outro percentual faz a faixa aparecer sozinha.
  const contagemPorDesconto = new Map<number, number>();
  for (const cliente of clientesAtivos) {
    if (!cliente.isPagante) continue;
    const percentual = num(cliente.desconto);
    contagemPorDesconto.set(percentual, (contagemPorDesconto.get(percentual) ?? 0) + 1);
  }

  const descontos = Array.from(contagemPorDesconto.entries())
    .sort(([, a], [, b]) => b - a) // as faixas com mais UCs ganham a vaga
    .slice(0, MAX_FAIXAS_DESCONTO)
    .map(([percentual, clientes]) => ({ percentual, clientes }))
    .sort((a, b) => a.percentual - b.percentual);

  // O fio B é tarifa regulada: vale o mesmo para todas as faturas do mês, então
  // a mediana absorve alguma extração torta sem depender de qual fatura veio
  // primeiro. Meses sem fatura herdam o último valor conhecido — a tarifa não
  // deixa de existir só porque os PDFs ainda não subiram.
  let ultimoFioB: number | null = null;

  const precoKwh = janela.map((mes) => {
    const linhaTabela = precos.find((p) => sameMonthRef(p.mesReferencia, mes));
    const tabela = linhaTabela ? num(linhaTabela.precoKwhCalculado) : null;

    const fioBDoMes = mediana(
      todasFaturas
        .filter((f) => sameMonthRef(f.mesReferencia, mes) && num(f.precoFioB) > 0)
        .map((f) => num(f.precoFioB)),
    );
    if (fioBDoMes !== null) ultimoFioB = fioBDoMes;
    const fioB = fioBDoMes ?? ultimoFioB;

    // Preço líquido por faixa: o que sobra depois do desconto do contrato e do
    // fio B, que é repassado à concessionária.
    const liquido: Record<string, number> = {};
    if (tabela !== null && fioB !== null) {
      for (const { percentual } of descontos) {
        liquido[String(percentual)] = tabela * (1 - percentual / 100) - fioB;
      }
    }

    return {
      mes,
      tabela,
      fioB,
      fioBHerdado: fioBDoMes === null && fioB !== null,
      liquido,
    };
  });

  const financeiroMes = somaFinanceira(faturasDoMes);
  const financeiroAnterior = somaFinanceira(faturasMesAnterior);

  const geracaoTotal = geracaoDoMes.reduce((acc, g) => acc + num(g.kwhGerado), 0);
  const geracaoPrevistaTotal = usinas.reduce((acc, u) => acc + num(u.producaoMensalPrevista), 0);

  const faturasComPdf = faturasDoMes.filter((f) => !!f.arquivoPdfUrl).length;
  const clientesSemFatura = pendencias.filter((p) => p.tipo === "sem_fatura").length;
  const faturasSemPdf = pendencias.filter((p) => p.tipo === "sem_pdf").length;

  return {
    mesReferencia,
    mesAnterior,
    mesesDisponiveis: mesesComDados,
    atualizadoEm: hoje.toISOString(),
    totais: {
      usinas: usinas.length,
      clientes: clientes.length,
      clientesAtivos: clientesAtivos.length,
      geracao: geracaoTotal,
      geracaoPrevista: geracaoPrevistaTotal,
      performance: pct(geracaoTotal, geracaoPrevistaTotal),
      ...financeiroMes,
      saldoTotalKwh: saldosUC.reduce((acc, s) => acc + s.saldo, 0),
      faturasEsperadas: clientesAtivos.length,
      faturasRecebidas: faturasComPdf,
      faturasSemPdf,
      clientesSemFatura,
      faturasFaltando: clientesSemFatura + faturasSemPdf,
      faturasPendentesPagamento: faturasDoMes.filter((f) => !isPaga(f)).length,
      faturasEmAtraso: faturasDoMes.filter((f) => !isPaga(f) && isVencida(f, hoje)).length,
      aguardandoConfirmacao: faturasDoMes.filter(
        (f) => f.status === "pagamento_pendente_confirmacao",
      ).length,
    },
    variacoes: {
      lucro: variacao(financeiroMes.lucro, financeiroAnterior.lucro),
      receita: variacao(financeiroMes.receita, financeiroAnterior.receita),
      economia: variacao(financeiroMes.economia, financeiroAnterior.economia),
      geracao: variacao(
        geracaoTotal,
        geracaoMesAnterior.reduce((acc, g) => acc + num(g.kwhGerado), 0),
      ),
    },
    usinas: usinasOverview,
    descontos,
    precoKwh,
    historico,
    geracaoPorUsina,
    saldos: {
      maiores: saldosOrdenados.slice(0, TOP_SALDOS),
      // Com poucas UCs os dois rankings seriam a mesma lista invertida — nesse
      // caso só o de maiores tem informação.
      menores:
        saldosOrdenados.length > TOP_SALDOS
          ? saldosOrdenados.slice(-TOP_SALDOS).reverse()
          : [],
      total: saldosUC.reduce((acc, s) => acc + s.saldo, 0),
      ucsComSaldo: saldosUC.length,
    },
    pendencias,
  };
}
