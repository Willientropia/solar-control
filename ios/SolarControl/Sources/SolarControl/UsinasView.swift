import SwiftUI
import Charts
import SolarCore

struct UsinasView: View {
    @EnvironmentObject private var app: AppState
    @EnvironmentObject private var store: PainelStore

    var body: some View {
        NavigationStack {
            CarregamentoView(estado: store.estado, tentarDeNovo: { await store.carregar(app) }) { overview in
                ScrollView {
                    LazyVStack(spacing: 12) {
                        ForEach(overview.usinas) { usina in
                            NavigationLink(value: usina) {
                                UsinaCard(usina: usina)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .padding()
                }
                .overlay {
                    if overview.usinas.isEmpty {
                        ContentUnavailableView("Nenhuma usina", systemImage: "sun.max",
                                               description: Text("Cadastre usinas pelo Solar Control na web."))
                    }
                }
            }
            .background(Theme.fundo)
            .navigationTitle("Usinas")
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    SeletorMes(
                        meses: store.estado.valor?.mesesDisponiveis ?? [],
                        selecionado: Binding(
                            get: { store.mes },
                            set: { novo in Task { await store.trocarMes(novo, app) } }
                        )
                    )
                }
            }
            .refreshable { await store.carregar(app) }
            .navigationDestination(for: DashboardUsina.self) { usina in
                UsinaDetalheView(usina: usina)
            }
            .navigationDestination(for: ClienteRef.self) { ref in
                ClienteDetalheView(clienteId: ref.id, nome: ref.nome)
            }
        }
        .task { await store.carregarSeNecessario(app) }
    }
}

struct UsinaDetalheView: View {
    @EnvironmentObject private var app: AppState
    @EnvironmentObject private var store: PainelStore
    let usina: DashboardUsina

    @State private var clientes: [Cliente] = []
    @Environment(\.horizontalSizeClass) private var sizeClass

    private var pendencias: [DashboardPendencia] {
        (store.estado.valor?.pendencias ?? []).filter { $0.usinaId == usina.id }
    }

    private var colunas: [GridItem] {
        Array(repeating: GridItem(.flexible(), spacing: 12), count: sizeClass == .regular ? 3 : 2)
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 28) {
                cabecalho
                LazyVGrid(columns: colunas, spacing: 12) {
                    KPICard(titulo: "Lucro", valor: Fmt.brlCompacto(usina.lucro), simbolo: "chart.line.uptrend.xyaxis",
                            cor: Theme.lucro, variacao: usina.variacaoLucro)
                    KPICard(titulo: "Receita", valor: Fmt.brlCompacto(usina.receita), simbolo: "banknote",
                            cor: Theme.receita, rodape: "Custo \(Fmt.brlCompacto(usina.custo))")
                    KPICard(titulo: "Geração", valor: Fmt.kwhCompacto(usina.geracao), simbolo: "sun.max.fill",
                            cor: Theme.geracao, rodape: "Prevista \(Fmt.kwhCompacto(usina.geracaoPrevista))")
                    KPICard(titulo: "Saldo das UCs", valor: Fmt.kwhCompacto(usina.saldoKwh), simbolo: "battery.75percent",
                            cor: .teal, rodape: "\(Fmt.kwhCompacto(usina.kwhDistribuido)) compensados")
                }

                if usina.serieGeracao.count > 1 { grafico }
                faturas
                if !pendencias.isEmpty { listaPendencias }
                if !clientes.isEmpty { listaClientes }
            }
            .padding()
        }
        .background(Theme.fundo)
        .navigationTitle(usina.nome)
        .navigationBarTitleDisplayMode(.inline)
        .task { await carregarClientes() }
    }

    private var cabecalho: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("UC \(usina.unidadeConsumidora) · \(Fmt.inteiro(usina.potenciaKwp)) kWp · \(Fmt.inteiro(usina.clientesAtivos)) clientes")
                .font(.subheadline)
                .foregroundStyle(.secondary)
            HStack {
                Text("Performance")
                    .font(.headline)
                Spacer()
                Text(Fmt.percent(usina.performance))
                    .font(.headline)
                    .monospacedDigit()
                    .foregroundStyle(Theme.corPerformance(usina.performance))
            }
            BarraPerformance(valor: usina.performance)
        }
    }

    private var grafico: some View {
        Secao(titulo: "Geração mensal") {
            Chart {
                ForEach(usina.serieGeracao, id: \.mes) { ponto in
                    BarMark(
                        x: .value("Mês", MonthRef.short(ponto.mes)),
                        y: .value("kWh", ponto.kwh)
                    )
                    .foregroundStyle(by: .value("Série", "Gerado"))
                    .cornerRadius(4)

                    LineMark(
                        x: .value("Mês", MonthRef.short(ponto.mes)),
                        y: .value("kWh", ponto.previsto)
                    )
                    .foregroundStyle(by: .value("Série", "Previsto"))
                    .lineStyle(StrokeStyle(lineWidth: 2, dash: [4, 3]))
                }
            }
            .chartForegroundStyleScale(["Gerado": Theme.geracao, "Previsto": Color.gray])
            .chartYAxis {
                AxisMarks { valor in
                    AxisGridLine()
                    AxisValueLabel {
                        if let v = valor.as(Double.self) { Text(Fmt.kwhCompacto(v)) }
                    }
                }
            }
            .chartLegend(position: .top, alignment: .leading)
            .frame(height: 220)
            .padding()
            .background(Theme.cartao, in: .rect(cornerRadius: 16))
            .accessibilityLabel("Geração mensal comparada à prevista")
        }
    }

    private var faturas: some View {
        Secao(titulo: "Faturas do mês") {
            VStack(alignment: .leading, spacing: 12) {
                HStack(alignment: .firstTextBaseline) {
                    Text("\(Fmt.inteiro(usina.faturasRecebidas)) de \(Fmt.inteiro(usina.faturasEsperadas))")
                        .font(.title3.weight(.semibold))
                        .monospacedDigit()
                    Text("recebidas").foregroundStyle(.secondary)
                }
                ProgressView(value: min(usina.faturasRecebidas, usina.faturasEsperadas),
                             total: max(usina.faturasEsperadas, 1))
                    .tint(Theme.accent)
                HStack(spacing: 8) {
                    if usina.faturasFaltando > 0 {
                        StatusPill(texto: "\(Fmt.inteiro(usina.faturasFaltando)) faltando", cor: .gray)
                    }
                    if usina.faturasPendentesPagamento > 0 {
                        StatusPill(texto: "\(Fmt.inteiro(usina.faturasPendentesPagamento)) a pagar", cor: .orange)
                    }
                    if usina.faturasEmAtraso > 0 {
                        StatusPill(texto: "\(Fmt.inteiro(usina.faturasEmAtraso)) vencidas", cor: .red)
                    }
                }
            }
            .padding()
            .background(Theme.cartao, in: .rect(cornerRadius: 16))
        }
    }

    private var listaPendencias: some View {
        Secao(titulo: "Pendências") {
            VStack(spacing: 0) {
                ForEach(Array(pendencias.enumerated()), id: \.element.id) { indice, p in
                    NavigationLink(value: ClienteRef(id: p.clienteId, nome: p.clienteNome)) {
                        PendenciaLinha(pendencia: p)
                    }
                    .buttonStyle(.plain)
                    if indice < pendencias.count - 1 {
                        Divider().padding(.leading, 52)
                    }
                }
            }
            .background(Theme.cartao, in: .rect(cornerRadius: 16))
        }
    }

    private var listaClientes: some View {
        Secao(titulo: "Clientes") {
            VStack(spacing: 0) {
                ForEach(Array(clientes.enumerated()), id: \.element.id) { indice, cliente in
                    NavigationLink(value: ClienteRef(id: cliente.id, nome: cliente.nome)) {
                        HStack {
                            ClienteLinha(cliente: cliente)
                            Spacer()
                            Image(systemName: "chevron.right")
                                .font(.footnote.weight(.semibold))
                                .foregroundStyle(.tertiary)
                        }
                        .padding(.horizontal)
                        .padding(.vertical, 8)
                        .contentShape(.rect)
                    }
                    .buttonStyle(.plain)
                    if indice < clientes.count - 1 {
                        Divider().padding(.leading)
                    }
                }
            }
            .background(Theme.cartao, in: .rect(cornerRadius: 16))
        }
    }

    private func carregarClientes() async {
        // Lista secundária: se falhar, a tela segue com os dados do painel.
        guard clientes.isEmpty, let todos = try? await app.api.clientes() else { return }
        clientes = todos
            .filter { $0.usinaId == usina.id && $0.ativo }
            .sorted { $0.nome.localizedStandardCompare($1.nome) == .orderedAscending }
    }
}
