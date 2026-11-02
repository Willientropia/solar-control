import SwiftUI
import Charts
import SolarCore

struct ClientesView: View {
    @EnvironmentObject private var app: AppState

    @State private var estado: Carregamento<[Cliente]> = .carregando
    @State private var busca = ""
    @State private var mostrarInativos = false
    @State private var usinaId: String?

    var body: some View {
        NavigationStack {
            CarregamentoView(estado: estado, tentarDeNovo: carregar) { clientes in
                lista(clientes)
            }
            .navigationTitle("Clientes")
            .searchable(text: $busca, prompt: "Nome, UC ou contrato")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    filtros(estado.valor ?? [])
                }
            }
            .refreshable { await carregar() }
            .navigationDestination(for: ClienteRef.self) { ref in
                ClienteDetalheView(clienteId: ref.id, nome: ref.nome)
            }
        }
        .task {
            if estado.valor == nil { await carregar() }
        }
    }

    @ViewBuilder
    private func lista(_ clientes: [Cliente]) -> some View {
        let grupos = agrupar(filtrar(clientes))
        List {
            ForEach(grupos, id: \.nome) { grupo in
                Section {
                    ForEach(grupo.clientes) { cliente in
                        NavigationLink(value: ClienteRef(id: cliente.id, nome: cliente.nome)) {
                            ClienteLinha(cliente: cliente)
                        }
                    }
                } header: {
                    HStack {
                        Text(grupo.nome)
                        Spacer()
                        Text("\(grupo.clientes.count)").monospacedDigit()
                    }
                }
            }
        }
        .listStyle(.insetGrouped)
        .overlay {
            if grupos.isEmpty {
                if busca.isEmpty {
                    ContentUnavailableView("Nenhum cliente", systemImage: "person.2.slash")
                } else {
                    ContentUnavailableView.search(text: busca)
                }
            }
        }
    }

    private func filtros(_ clientes: [Cliente]) -> some View {
        let usinas = Dictionary(clientes.compactMap { c in c.usina.map { ($0.id, $0.nome) } }, uniquingKeysWith: { a, _ in a })
            .sorted { $0.value.localizedStandardCompare($1.value) == .orderedAscending }
        return Menu {
            Toggle("Mostrar inativos", isOn: $mostrarInativos)
            Picker("Usina", selection: $usinaId) {
                Text("Todas as usinas").tag(String?.none)
                ForEach(usinas, id: \.key) { par in
                    Text(par.value).tag(Optional(par.key))
                }
            }
        } label: {
            Label("Filtrar", systemImage: (usinaId == nil && !mostrarInativos)
                  ? "line.3.horizontal.decrease.circle"
                  : "line.3.horizontal.decrease.circle.fill")
        }
    }

    private func carregar() async {
        if estado.valor == nil { estado = .carregando }
        do {
            estado = .pronto(try await app.api.clientes())
        } catch {
            if let mensagem = app.mensagem(para: error) { estado = .falhou(mensagem) }
        }
    }

    private func filtrar(_ clientes: [Cliente]) -> [Cliente] {
        let termo = busca.trimmingCharacters(in: .whitespaces)
        return clientes.filter { c in
            if !mostrarInativos && !c.ativo { return false }
            if let usinaId, c.usinaId != usinaId { return false }
            guard !termo.isEmpty else { return true }
            return c.nome.localizedStandardContains(termo)
                || c.uc.contains(termo)
                || (c.unidadeConsumidora ?? "").contains(termo)
                || (c.numeroContrato ?? "").localizedStandardContains(termo)
        }
    }

    private struct Grupo {
        let nome: String
        let clientes: [Cliente]
    }

    private func agrupar(_ clientes: [Cliente]) -> [Grupo] {
        Dictionary(grouping: clientes) { $0.usina?.nome ?? "Sem usina" }
            .map { nome, itens in
                Grupo(nome: nome, clientes: itens.sorted { $0.nome.localizedStandardCompare($1.nome) == .orderedAscending })
            }
            .sorted { $0.nome.localizedStandardCompare($1.nome) == .orderedAscending }
    }
}

struct ClienteLinha: View {
    let cliente: Cliente

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text(cliente.nome)
                    .font(.body.weight(.medium))
                    .lineLimit(1)
                if !cliente.ativo {
                    StatusPill(texto: "Inativo", cor: .gray)
                }
            }
            HStack(spacing: 4) {
                Text("UC \(cliente.uc)")
                if cliente.isUsoProprio {
                    Text("· uso próprio")
                } else if let desconto = cliente.desconto {
                    Text("· \(Fmt.inteiro(desconto))% de desconto")
                }
            }
            .font(.caption)
            .foregroundStyle(.secondary)
        }
        .padding(.vertical, 2)
    }
}

// MARK: - Detalhe

struct ClienteDetalheView: View {
    @EnvironmentObject private var app: AppState
    let clienteId: String
    let nome: String

    @State private var estado: Carregamento<ClienteDetalhes> = .carregando

    var body: some View {
        CarregamentoView(estado: estado, tentarDeNovo: carregar) { detalhes in
            conteudo(detalhes)
        }
        .navigationTitle(nome)
        .navigationBarTitleDisplayMode(.inline)
        .refreshable { await carregar() }
        .task {
            if estado.valor == nil { await carregar() }
        }
        .navigationDestination(for: Fatura.self) { fatura in
            FaturaDetalheView(fatura: fatura, nomeUsina: estado.valor?.usina?.nome) { atualizada in
                substituir(atualizada)
            }
        }
    }

    @ViewBuilder
    private func conteudo(_ d: ClienteDetalhes) -> some View {
        let cliente = d.cliente
        List {
            Section {
                VStack(alignment: .leading, spacing: 4) {
                    Text(cliente.nome)
                        .font(.title2.weight(.semibold))
                    Text([("UC \(cliente.uc)"), d.usina?.nome].compactMap { $0 }.joined(separator: " · "))
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
                .padding(.vertical, 4)

                Grid(horizontalSpacing: 12, verticalSpacing: 12) {
                    GridRow {
                        mini("Saldo", Fmt.kwh(d.saldoAtual), "battery.75percent", .teal)
                        mini("Média de consumo", Fmt.kwh(d.mediaConsumo), "bolt.fill", .orange)
                    }
                    GridRow {
                        mini("Saldo dura", d.mediaConsumo > 0 ? Fmt.meses(d.mesesDuracaoSaldo) : "—", "hourglass", .indigo)
                        mini("Desconto", cliente.isUsoProprio ? "Uso próprio" : Fmt.percent(cliente.desconto), "percent", .green)
                    }
                }
                .padding(.vertical, 4)
            }

            if d.faturas.count > 1 {
                Section("Consumo compensado") {
                    graficoConsumo(d.faturas)
                }
            }

            Section("Contrato") {
                if let contrato = cliente.numeroContrato, !contrato.isEmpty {
                    LinhaInfo(titulo: "Número", valor: contrato)
                }
                if let kwh = cliente.valorContratadoKwh {
                    LinhaInfo(titulo: "kWh contratado", valor: Fmt.kwh(kwh))
                }
                if let envio = cliente.porcentagemEnvioCredito {
                    LinhaInfo(titulo: "Envio de crédito", valor: Fmt.percent(envio))
                }
                if let doc = cliente.cpfCnpj, !doc.isEmpty {
                    LinhaInfo(titulo: "CPF/CNPJ", valor: doc)
                }
                if let antiga = cliente.unidadeConsumidora, !antiga.isEmpty, antiga != cliente.uc {
                    LinhaInfo(titulo: "UC antiga", valor: antiga)
                }
                LinhaInfo(titulo: "Situação", valor: cliente.ativo ? "Ativo" : "Inativo")
            }

            if let endereco = cliente.enderecoCompleto ?? cliente.enderecoSimplificado, !endereco.isEmpty {
                Section("Endereço") {
                    Text(endereco)
                        .textSelection(.enabled)
                }
            }

            Section("Faturas") {
                if d.faturas.isEmpty {
                    Text("Nenhuma fatura lançada.")
                        .foregroundStyle(.secondary)
                }
                ForEach(d.faturas) { fatura in
                    NavigationLink(value: comCliente(fatura, cliente)) {
                        FaturaLinha(fatura: comCliente(fatura, cliente), mostrarMes: true)
                    }
                }
            }
        }
        .listStyle(.insetGrouped)
    }

    private func mini(_ titulo: String, _ valor: String, _ simbolo: String, _ cor: Color) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Label(titulo, systemImage: simbolo)
                .font(.caption)
                .foregroundStyle(.secondary)
                .labelStyle(TituloComIconeColorido(cor: cor))
            Text(valor)
                .font(.headline)
                .monospacedDigit()
                .lineLimit(1)
                .minimumScaleFactor(0.7)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityElement(children: .combine)
    }

    private func graficoConsumo(_ faturas: [Fatura]) -> some View {
        let pontos = faturas
            .sorted { MonthRef.sortKey($0.mesReferencia) < MonthRef.sortKey($1.mesReferencia) }
            .suffix(12)
        return Chart(Array(pontos)) { f in
            BarMark(
                x: .value("Mês", MonthRef.short(f.mesReferencia)),
                y: .value("kWh", f.consumoScee ?? 0)
            )
            .foregroundStyle(Theme.geracao.gradient)
            .cornerRadius(4)
        }
        .chartYAxis {
            AxisMarks { valor in
                AxisGridLine()
                AxisValueLabel {
                    if let v = valor.as(Double.self) { Text(Fmt.inteiro(v)) }
                }
            }
        }
        .frame(height: 180)
        .padding(.vertical, 8)
        .accessibilityLabel("Consumo compensado dos últimos \(pontos.count) meses")
    }

    /// As faturas do detalhe vêm sem o join; o fluxo precisa saber se é uso próprio.
    private func comCliente(_ fatura: Fatura, _ cliente: Cliente) -> Fatura {
        var f = fatura
        f.cliente = f.cliente ?? cliente
        return f
    }

    private func carregar() async {
        if estado.valor == nil { estado = .carregando }
        do {
            estado = .pronto(try await app.api.clienteDetalhes(id: clienteId))
        } catch {
            if let mensagem = app.mensagem(para: error) { estado = .falhou(mensagem) }
        }
    }

    private func substituir(_ fatura: Fatura) {
        guard var d = estado.valor, let i = d.faturas.firstIndex(where: { $0.id == fatura.id }) else { return }
        d.faturas[i] = fatura
        estado = .pronto(d)
    }
}

struct TituloComIconeColorido: LabelStyle {
    let cor: Color

    func makeBody(configuration: Configuration) -> some View {
        HStack(spacing: 4) {
            configuration.icon.foregroundStyle(cor)
            configuration.title
        }
    }
}
