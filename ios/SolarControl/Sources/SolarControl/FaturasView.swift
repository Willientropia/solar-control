import SwiftUI
import SolarCore

struct FaturasView: View {
    @EnvironmentObject private var app: AppState
    @EnvironmentObject private var painel: PainelStore

    @State private var estado: Carregamento<[Fatura]> = .carregando
    @State private var usinas: [Usina] = []
    @State private var mes: String?
    @State private var filtro: FaturaFiltro = .todas
    @State private var usinaId: String?
    @State private var busca = ""
    @State private var erroAcao: String?

    private var meses: [String] {
        if let disponiveis = painel.estado.valor?.mesesDisponiveis, !disponiveis.isEmpty {
            return MonthRef.sortedDescending(disponiveis)
        }
        let atual = MonthRef.current()
        return (0..<12).map { MonthRef.add(atual, -$0) }
    }

    var body: some View {
        NavigationStack {
            CarregamentoView(estado: estado, tentarDeNovo: carregar) { faturas in
                lista(faturas)
            }
            .navigationTitle("Faturas")
            .searchable(text: $busca, prompt: "Cliente ou UC")
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    SeletorMes(meses: meses, selecionado: $mes)
                }
                ToolbarItem(placement: .topBarTrailing) {
                    filtroUsina
                }
            }
            .refreshable { await carregar() }
            .navigationDestination(for: Fatura.self) { fatura in
                FaturaDetalheView(fatura: fatura, nomeUsina: nomeUsina(fatura)) { atualizada in
                    substituir(atualizada)
                }
            }
            .alert("Não foi possível atualizar", isPresented: Binding(
                get: { erroAcao != nil },
                set: { if !$0 { erroAcao = nil } }
            )) {
                Button("OK", role: .cancel) {}
            } message: {
                Text(erroAcao ?? "")
            }
        }
        .task {
            if mes == nil { mes = painel.mes ?? meses.first }
        }
        .task(id: mes) {
            guard mes != nil else { return }
            await carregar()
        }
    }

    // MARK: Lista

    @ViewBuilder
    private func lista(_ faturas: [Fatura]) -> some View {
        let filtradas = filtrar(faturas)
        let grupos = agrupar(filtradas)
        List {
            Section {
                Picker("Filtro", selection: $filtro) {
                    ForEach(FaturaFiltro.allCases) { f in
                        Text(f.titulo).tag(f)
                    }
                }
                .pickerStyle(.segmented)
                .listRowInsets(EdgeInsets())
                .listRowBackground(Color.clear)
            } footer: {
                resumo(faturas)
            }

            ForEach(grupos, id: \.nome) { grupo in
                Section {
                    ForEach(grupo.faturas) { fatura in
                        NavigationLink(value: fatura) {
                            FaturaLinha(fatura: fatura)
                        }
                        .swipeActions(edge: .trailing, allowsFullSwipe: true) {
                            acoesRapidas(fatura)
                        }
                    }
                } header: {
                    HStack {
                        Text(grupo.nome)
                        Spacer()
                        Text("\(grupo.faturas.count)")
                            .monospacedDigit()
                    }
                }
            }
        }
        .listStyle(.insetGrouped)
        .overlay {
            if filtradas.isEmpty {
                if !busca.isEmpty {
                    ContentUnavailableView.search(text: busca)
                } else {
                    ContentUnavailableView(
                        "Nenhuma fatura",
                        systemImage: "doc.text.magnifyingglass",
                        description: Text(filtro == .todas
                                          ? "Não há faturas lançadas em \(mes.map(MonthRef.long) ?? "este mês")."
                                          : "Nenhuma fatura \(filtro.titulo.lowercased()) neste mês.")
                    )
                }
            }
        }
    }

    private func resumo(_ faturas: [Fatura]) -> some View {
        let completas = faturas.filter { FaturaFiltro.completas.aceita($0) }.count
        let total = faturas.reduce(0) { $0 + ($1.valorComDesconto ?? 0) }
        return Text("\(completas) de \(faturas.count) completas · \(Fmt.brl(total)) a receber")
            .padding(.top, 4)
    }

    @ViewBuilder
    private func acoesRapidas(_ fatura: Fatura) -> some View {
        let fluxo = FaturaFluxo(fatura: fatura, cliente: nil)
        if !fluxo.usoProprio {
            if fluxo.gerada && !fluxo.enviada {
                Button {
                    Task { await executar(.marcarEnviada, fatura) }
                } label: {
                    Label("Enviada", systemImage: "paperplane.fill")
                }
                .tint(Theme.cor(.enviada))
            } else if fluxo.enviada && !fluxo.recebida {
                Button {
                    Task { await executar(.marcarRecebida, fatura) }
                } label: {
                    Label("Recebida", systemImage: "checkmark.seal.fill")
                }
                .tint(Theme.cor(.recebida))
            } else if !fluxo.gerada {
                Button {
                    Task { await executar(.marcarGerada, fatura) }
                } label: {
                    Label("Gerada", systemImage: "doc.text.fill")
                }
                .tint(Theme.cor(.gerada))
            }
        }
    }

    private var filtroUsina: some View {
        Menu {
            Picker("Usina", selection: $usinaId) {
                Text("Todas as usinas").tag(String?.none)
                ForEach(usinas) { usina in
                    Text(usina.nome).tag(Optional(usina.id))
                }
            }
        } label: {
            Label("Usina", systemImage: usinaId == nil
                  ? "line.3.horizontal.decrease.circle"
                  : "line.3.horizontal.decrease.circle.fill")
        }
        .disabled(usinas.isEmpty)
    }

    // MARK: Dados

    private func carregar() async {
        if estado.valor == nil { estado = .carregando }
        do {
            let api = app.api
            let mesAtual = mes
            async let listaUsinas = api.usinas()
            async let listaFaturas = api.faturas(mes: mesAtual)
            let (u, f) = try await (listaUsinas, listaFaturas)
            usinas = u.sorted { $0.nome.localizedStandardCompare($1.nome) == .orderedAscending }
            estado = .pronto(f)
        } catch {
            if let mensagem = app.mensagem(para: error) { estado = .falhou(mensagem) }
        }
    }

    private func executar(_ acao: FaturaAcao, _ fatura: Fatura) async {
        do {
            var atualizada = try await app.api.executar(acao, faturaId: fatura.id)
            atualizada.cliente = atualizada.cliente ?? fatura.cliente
            substituir(atualizada)
        } catch {
            erroAcao = app.mensagem(para: error)
        }
    }

    private func substituir(_ fatura: Fatura) {
        guard var lista = estado.valor, let indice = lista.firstIndex(where: { $0.id == fatura.id }) else { return }
        var nova = fatura
        nova.cliente = nova.cliente ?? lista[indice].cliente
        lista[indice] = nova
        estado = .pronto(lista)
    }

    private func nomeUsina(_ fatura: Fatura) -> String? {
        let id = fatura.usinaId ?? fatura.cliente?.usinaId
        return usinas.first { $0.id == id }?.nome
    }

    private func filtrar(_ faturas: [Fatura]) -> [Fatura] {
        let termo = busca.trimmingCharacters(in: .whitespaces)
        return faturas.filter { f in
            guard filtro.aceita(f) else { return false }
            if let usinaId, (f.usinaId ?? f.cliente?.usinaId) != usinaId { return false }
            guard !termo.isEmpty else { return true }
            let nome = f.cliente?.nome ?? ""
            let uc = f.cliente?.uc ?? ""
            return nome.localizedStandardContains(termo) || uc.contains(termo)
        }
    }

    private struct Grupo {
        let nome: String
        let faturas: [Fatura]
    }

    private func agrupar(_ faturas: [Fatura]) -> [Grupo] {
        Dictionary(grouping: faturas) { nomeUsina($0) ?? "Sem usina" }
            .map { nome, itens in
                Grupo(nome: nome, faturas: itens.sorted {
                    ($0.cliente?.nome ?? "").localizedStandardCompare($1.cliente?.nome ?? "") == .orderedAscending
                })
            }
            .sorted { $0.nome.localizedStandardCompare($1.nome) == .orderedAscending }
    }
}

// MARK: - Linha

struct FaturaLinha: View {
    let fatura: Fatura
    /// Na tela do cliente o nome é redundante: mostra o mês no lugar.
    var mostrarMes = false

    private var fluxo: FaturaFluxo { FaturaFluxo(fatura: fatura, cliente: nil) }

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(alignment: .firstTextBaseline) {
                Text(mostrarMes ? MonthRef.long(fatura.mesReferencia) : (fatura.cliente?.nome ?? "Cliente"))
                    .font(.body.weight(.medium))
                    .lineLimit(1)
                Spacer(minLength: 8)
                Text(Fmt.brl(fluxo.usoProprio ? fatura.valorTotal : fatura.valorComDesconto))
                    .font(.body)
                    .monospacedDigit()
            }
            HStack {
                if mostrarMes {
                    Text(Fmt.kwh(fatura.consumoScee))
                } else {
                    Text("UC \(fatura.cliente?.uc ?? "—")")
                }
                if fluxo.usoProprio {
                    Text("· uso próprio")
                }
                Spacer()
                FluxoDots(fluxo: fluxo)
            }
            .font(.caption)
            .foregroundStyle(.secondary)
        }
        .padding(.vertical, 2)
    }
}
