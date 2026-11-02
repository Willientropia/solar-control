import SwiftUI
import Charts
import SolarCore

/// Dados do dashboard, compartilhados entre as abas Painel e Usinas.
@MainActor
final class PainelStore: ObservableObject {
    @Published private(set) var estado: Carregamento<DashboardOverview> = .carregando
    /// nil = mês mais recente com dados (o servidor escolhe).
    @Published var mes: String?

    private var carregado = false

    func carregarSeNecessario(_ app: AppState) async {
        guard !carregado else { return }
        await carregar(app)
    }

    func carregar(_ app: AppState) async {
        if estado.valor == nil { estado = .carregando }
        do {
            let overview = try await app.api.dashboard(mes: mes)
            estado = .pronto(overview)
            carregado = true
            if mes == nil { mes = overview.mesReferencia }
        } catch {
            if let mensagem = app.mensagem(para: error) {
                // Mantém os dados antigos na tela se já havia algo.
                if estado.valor == nil { estado = .falhou(mensagem) }
            }
        }
    }

    func trocarMes(_ novo: String?, _ app: AppState) async {
        guard novo != estado.valor?.mesReferencia else { return }
        mes = novo
        estado = .carregando
        await carregar(app)
    }
}

struct PainelView: View {
    @EnvironmentObject private var app: AppState
    @EnvironmentObject private var store: PainelStore
    @State private var mostrandoPerfil = false

    var body: some View {
        NavigationStack {
            CarregamentoView(estado: store.estado, tentarDeNovo: { await store.carregar(app) }) { overview in
                PainelConteudo(overview: overview)
            }
            .background(Theme.fundo)
            .navigationTitle("Painel")
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
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        mostrandoPerfil = true
                    } label: {
                        AvatarView(texto: app.usuario?.iniciais ?? "?")
                    }
                    .accessibilityLabel("Conta")
                }
            }
            .refreshable { await store.carregar(app) }
            .sheet(isPresented: $mostrandoPerfil) { PerfilView() }
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

/// Navegação para um cliente a partir de pendências e rankings.
struct ClienteRef: Hashable {
    let id: String
    let nome: String
}

struct AvatarView: View {
    let texto: String

    var body: some View {
        Text(texto)
            .font(.caption.weight(.semibold))
            .foregroundStyle(.white)
            .frame(width: 30, height: 30)
            .background(Theme.accent.gradient, in: .circle)
    }
}

// MARK: - Conteúdo

private struct PainelConteudo: View {
    let overview: DashboardOverview
    @Environment(\.horizontalSizeClass) private var sizeClass

    private var colunas: [GridItem] {
        Array(repeating: GridItem(.flexible(), spacing: 12), count: sizeClass == .regular ? 4 : 2)
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 28) {
                cabecalho
                indicadores
                if overview.totais.faturasEsperadas > 0 { progressoFaturas }
                if !overview.pendencias.isEmpty { pendencias }
                if overview.historico.count > 1 { graficoFinanceiro }
                if !overview.usinas.isEmpty { usinas }
                if !overview.saldos.maiores.isEmpty { saldos }
                if let preco = overview.precoKwh.last, preco.tabela != nil { precoKwh(preco) }
                if let atualizado = Fmt.dataHora(overview.atualizadoEm) {
                    Text("Atualizado em \(atualizado)")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                        .frame(maxWidth: .infinity)
                }
            }
            .padding()
        }
    }

    private var cabecalho: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(MonthRef.long(overview.mesReferencia))
                .font(.headline)
            Text("\(Fmt.inteiro(overview.totais.usinas)) usinas · \(Fmt.inteiro(overview.totais.clientesAtivos)) clientes ativos")
                .font(.subheadline)
                .foregroundStyle(.secondary)
        }
    }

    private var indicadores: some View {
        let t = overview.totais
        let v = overview.variacoes
        return LazyVGrid(columns: colunas, spacing: 12) {
            KPICard(titulo: "Lucro", valor: Fmt.brlCompacto(t.lucro), simbolo: "chart.line.uptrend.xyaxis",
                    cor: Theme.lucro, variacao: v.lucro,
                    rodape: overview.margem.map { "Margem de \(Fmt.percent($0))" })
            KPICard(titulo: "Receita", valor: Fmt.brlCompacto(t.receita), simbolo: "banknote",
                    cor: Theme.receita, variacao: v.receita)
            KPICard(titulo: "Geração", valor: Fmt.kwhCompacto(t.geracao), simbolo: "sun.max.fill",
                    cor: Theme.geracao, variacao: v.geracao,
                    rodape: "Performance de \(Fmt.percent(t.performance))")
            KPICard(titulo: "Economia dos clientes", valor: Fmt.brlCompacto(t.economia), simbolo: "leaf.fill",
                    cor: .mint, variacao: v.economia)
            KPICard(titulo: "Custo concessionária", valor: Fmt.brlCompacto(t.custo), simbolo: "building.columns",
                    cor: .secondary, rodape: "\(Fmt.kwhCompacto(t.kwhDistribuido)) compensados")
            KPICard(titulo: "Saldo acumulado", valor: Fmt.kwhCompacto(t.saldoTotalKwh), simbolo: "battery.75percent",
                    cor: .teal, rodape: "\(Fmt.inteiro(overview.saldos.ucsComSaldo)) UCs com saldo")
        }
    }

    private var progressoFaturas: some View {
        let t = overview.totais
        return Secao(titulo: "Faturas do mês") {
            VStack(alignment: .leading, spacing: 12) {
                HStack(alignment: .firstTextBaseline) {
                    Text("\(Fmt.inteiro(t.faturasRecebidas)) de \(Fmt.inteiro(t.faturasEsperadas))")
                        .font(.title3.weight(.semibold))
                        .monospacedDigit()
                    Text("recebidas")
                        .foregroundStyle(.secondary)
                }
                ProgressView(value: min(t.faturasRecebidas, t.faturasEsperadas), total: max(t.faturasEsperadas, 1))
                    .tint(Theme.accent)
                HStack(spacing: 8) {
                    if t.faturasFaltando > 0 {
                        StatusPill(texto: "\(Fmt.inteiro(t.faturasFaltando)) faltando", cor: .gray)
                    }
                    if t.faturasPendentesPagamento > 0 {
                        StatusPill(texto: "\(Fmt.inteiro(t.faturasPendentesPagamento)) a pagar", cor: .orange)
                    }
                    if t.faturasEmAtraso > 0 {
                        StatusPill(texto: "\(Fmt.inteiro(t.faturasEmAtraso)) vencidas", cor: .red)
                    }
                    if t.faturasSemPdf > 0 {
                        StatusPill(texto: "\(Fmt.inteiro(t.faturasSemPdf)) sem PDF", cor: .indigo)
                    }
                }
            }
            .padding()
            .background(Theme.cartao, in: .rect(cornerRadius: 16))
        }
    }

    private var pendencias: some View {
        Secao(titulo: "Pendências") {
            VStack(spacing: 0) {
                ForEach(Array(overview.pendencias.prefix(6).enumerated()), id: \.element.id) { indice, p in
                    NavigationLink(value: ClienteRef(id: p.clienteId, nome: p.clienteNome)) {
                        PendenciaLinha(pendencia: p)
                    }
                    .buttonStyle(.plain)
                    if indice < min(overview.pendencias.count, 6) - 1 {
                        Divider().padding(.leading, 52)
                    }
                }
                if overview.pendencias.count > 6 {
                    Divider()
                    NavigationLink {
                        PendenciasView(pendencias: overview.pendencias)
                    } label: {
                        HStack {
                            Text("Ver todas as \(overview.pendencias.count)")
                            Spacer()
                            Image(systemName: "chevron.right")
                                .font(.footnote.weight(.semibold))
                                .foregroundStyle(.tertiary)
                        }
                        .padding()
                    }
                }
            }
            .background(Theme.cartao, in: .rect(cornerRadius: 16))
        }
    }

    private var graficoFinanceiro: some View {
        Secao(titulo: "Receita e lucro") {
            Chart(overview.historico) { ponto in
                BarMark(
                    x: .value("Mês", MonthRef.short(ponto.mes)),
                    y: .value("Valor", ponto.receita)
                )
                .foregroundStyle(by: .value("Série", "Receita"))
                .cornerRadius(4)

                LineMark(
                    x: .value("Mês", MonthRef.short(ponto.mes)),
                    y: .value("Valor", ponto.lucro)
                )
                .foregroundStyle(by: .value("Série", "Lucro"))
                .symbol(.circle)
                .interpolationMethod(.catmullRom)
            }
            .chartForegroundStyleScale(["Receita": Theme.receita.opacity(0.35), "Lucro": Theme.lucro])
            .chartYAxis {
                AxisMarks { valor in
                    AxisGridLine()
                    AxisValueLabel {
                        if let v = valor.as(Double.self) { Text(Fmt.brlCompacto(v)) }
                    }
                }
            }
            .chartLegend(position: .top, alignment: .leading)
            .frame(height: 220)
            .padding()
            .background(Theme.cartao, in: .rect(cornerRadius: 16))
            .accessibilityLabel("Gráfico de receita e lucro dos últimos \(overview.historico.count) meses")
        }
    }

    private var usinas: some View {
        Secao(titulo: "Usinas") {
            VStack(spacing: 12) {
                ForEach(overview.usinas) { usina in
                    NavigationLink(value: usina) {
                        UsinaCard(usina: usina)
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    private var saldos: some View {
        Secao(titulo: "Maiores saldos de crédito") {
            VStack(spacing: 0) {
                ForEach(Array(overview.saldos.maiores.prefix(5).enumerated()), id: \.element.id) { indice, saldo in
                    NavigationLink(value: ClienteRef(id: saldo.clienteId, nome: saldo.clienteNome)) {
                        HStack {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(saldo.clienteNome).lineLimit(1)
                                Text("UC \(saldo.uc) · \(saldo.usinaNome)")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                                    .lineLimit(1)
                            }
                            Spacer()
                            Text(Fmt.kwh(saldo.saldo))
                                .monospacedDigit()
                                .foregroundStyle(.secondary)
                        }
                        .padding(.horizontal)
                        .padding(.vertical, 10)
                        .contentShape(.rect)
                    }
                    .buttonStyle(.plain)
                    if indice < min(overview.saldos.maiores.count, 5) - 1 {
                        Divider().padding(.leading)
                    }
                }
            }
            .background(Theme.cartao, in: .rect(cornerRadius: 16))
        }
    }

    private func precoKwh(_ preco: DashboardPrecoMes) -> some View {
        Secao(titulo: "Preço do kWh") {
            VStack(spacing: 0) {
                LinhaInfo(titulo: "Tarifa de tabela", valor: Fmt.brlKwh(preco.tabela))
                    .padding(.horizontal).padding(.vertical, 10)
                Divider().padding(.leading)
                LinhaInfo(titulo: preco.fioBHerdado == true ? "Fio B (mês anterior)" : "Fio B", valor: Fmt.brlKwh(preco.fioB))
                    .padding(.horizontal).padding(.vertical, 10)
                ForEach(overview.descontos, id: \.percentual) { faixa in
                    if let liquido = preco.liquido(desconto: faixa.percentual) {
                        Divider().padding(.leading)
                        LinhaInfo(titulo: "Líquido com \(Fmt.inteiro(faixa.percentual))% de desconto",
                                  valor: Fmt.brlKwh(liquido), destaque: true)
                            .padding(.horizontal).padding(.vertical, 10)
                    }
                }
            }
            .background(Theme.cartao, in: .rect(cornerRadius: 16))
        }
    }
}

// MARK: - Componentes do painel

struct PendenciaLinha: View {
    let pendencia: DashboardPendencia
    /// Dentro de List o espaçamento vem da própria célula.
    var emLista = false

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: Theme.simbolo(pendencia.tipoConhecido))
                .font(.body.weight(.semibold))
                .foregroundStyle(Theme.cor(pendencia.tipoConhecido))
                .frame(width: 28)
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 2) {
                Text(pendencia.clienteNome)
                    .lineLimit(1)
                Text(pendencia.detalhe)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(2)
            }
            Spacer(minLength: 8)
            StatusPill(texto: pendencia.tipoConhecido?.titulo ?? pendencia.tipo,
                       cor: Theme.cor(pendencia.tipoConhecido))
        }
        .padding(.horizontal, emLista ? 0 : 16)
        .padding(.vertical, emLista ? 2 : 10)
        .contentShape(.rect)
    }
}

struct PendenciasView: View {
    let pendencias: [DashboardPendencia]
    @State private var tipo: PendenciaTipo?

    private var filtradas: [DashboardPendencia] {
        guard let tipo else { return pendencias }
        return pendencias.filter { $0.tipoConhecido == tipo }
    }

    private var porUsina: [(String, [DashboardPendencia])] {
        Dictionary(grouping: filtradas, by: \.usinaNome)
            .sorted { $0.key.localizedStandardCompare($1.key) == .orderedAscending }
    }

    var body: some View {
        List {
            ForEach(porUsina, id: \.0) { grupo in
                Section(grupo.0) {
                    ForEach(grupo.1) { p in
                        NavigationLink(value: ClienteRef(id: p.clienteId, nome: p.clienteNome)) {
                            PendenciaLinha(pendencia: p, emLista: true)
                        }
                    }
                }
            }
        }
        .overlay {
            if filtradas.isEmpty {
                ContentUnavailableView("Nada pendente", systemImage: "checkmark.circle")
            }
        }
        .navigationTitle("Pendências")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            Menu {
                Picker("Tipo", selection: $tipo) {
                    Text("Todas").tag(PendenciaTipo?.none)
                    ForEach(PendenciaTipo.allCases, id: \.self) { t in
                        Label(t.titulo, systemImage: Theme.simbolo(t)).tag(Optional(t))
                    }
                }
            } label: {
                Label("Filtrar", systemImage: tipo == nil
                      ? "line.3.horizontal.decrease.circle"
                      : "line.3.horizontal.decrease.circle.fill")
            }
        }
    }
}

struct UsinaCard: View {
    let usina: DashboardUsina

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .firstTextBaseline) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(usina.nome)
                        .font(.headline)
                        .lineLimit(1)
                    Text("\(Fmt.inteiro(usina.clientesAtivos)) clientes · \(Fmt.inteiro(usina.potenciaKwp)) kWp")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                Spacer()
                Image(systemName: "chevron.right")
                    .font(.footnote.weight(.semibold))
                    .foregroundStyle(.tertiary)
            }

            HStack(alignment: .top) {
                metrica("Lucro", Fmt.brlCompacto(usina.lucro))
                Spacer()
                metrica("Geração", Fmt.kwhCompacto(usina.geracao))
                Spacer()
                metrica("Faturas", "\(Fmt.inteiro(usina.faturasRecebidas))/\(Fmt.inteiro(usina.faturasEsperadas))")
            }

            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Text("Performance")
                    Spacer()
                    Text(Fmt.percent(usina.performance))
                        .monospacedDigit()
                        .foregroundStyle(Theme.corPerformance(usina.performance))
                }
                .font(.caption)
                .foregroundStyle(.secondary)
                BarraPerformance(valor: usina.performance)
            }
        }
        .padding()
        .background(Theme.cartao, in: .rect(cornerRadius: 16))
        .contentShape(.rect(cornerRadius: 16))
        .accessibilityElement(children: .combine)
    }

    private func metrica(_ titulo: String, _ valor: String) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(titulo)
                .font(.caption)
                .foregroundStyle(.secondary)
            Text(valor)
                .font(.subheadline.weight(.semibold))
                .monospacedDigit()
        }
    }
}
