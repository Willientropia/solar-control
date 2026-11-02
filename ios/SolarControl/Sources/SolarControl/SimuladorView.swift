import SwiftUI
import QuickLook
import SolarCore

/// Aba Simular: o vendedor digita o consumo e o desconto, o app aplica a
/// tarifa do mês e gera um PDF de exemplo para mostrar ao cliente.
struct SimuladorView: View {
    @EnvironmentObject private var app: AppState
    @EnvironmentObject private var painel: PainelStore

    @AppStorage("simulador.desconto") private var descontoTexto = "25"
    @State private var kwhTexto = ""
    @State private var iluminacaoTexto = ""
    @State private var tarifaManualTexto = ""
    @State private var nome = ""
    @State private var endereco = ""

    @State private var tarifa: TarifaEstado = .carregando
    @State private var pdf: URL?
    @State private var gerando = false
    @State private var erro: String?
    @State private var gerados = 0
    @FocusState private var foco: Campo?

    enum Campo { case kwh, desconto, iluminacao, tarifa, nome, endereco }

    private static let descontosPadrao: [Double] = [15, 20, 25, 30]

    var body: some View {
        NavigationStack {
            Form {
                consumo
                tarifaSecao
                opcionais
                if let simulacao { resultado(simulacao) }
                botaoPdf
            }
            .navigationTitle("Simular economia")
            .scrollDismissesKeyboard(.interactively)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Limpar", action: limpar)
                        .disabled(kwhTexto.isEmpty && iluminacaoTexto.isEmpty && nome.isEmpty && endereco.isEmpty)
                }
                ToolbarItemGroup(placement: .keyboard) {
                    Spacer()
                    Button("OK") { foco = nil }
                }
            }
            .quickLookPreview($pdf)
            .sensoryFeedback(.success, trigger: gerados)
            .alert("Não foi possível gerar o PDF", isPresented: Binding(
                get: { erro != nil },
                set: { if !$0 { erro = nil } }
            )) {
                Button("OK", role: .cancel) {}
            } message: {
                Text(erro ?? "")
            }
        }
        .task { await carregarTarifa() }
    }

    // MARK: Seções

    private var consumo: some View {
        Section {
            CampoNumero(titulo: "Consumo", texto: $kwhTexto, unidade: "kWh", placeholder: "0",
                        foco: $foco, campo: .kwh)

            VStack(alignment: .leading, spacing: 10) {
                CampoNumero(titulo: "Desconto", texto: $descontoTexto, unidade: "%", placeholder: "25",
                            foco: $foco, campo: .desconto)
                HStack(spacing: 8) {
                    ForEach(faixasDesconto, id: \.self) { faixa in
                        let ativa = numeroDigitado(descontoTexto) == faixa
                        Button("\(Fmt.inteiro(faixa))%") {
                            descontoTexto = Fmt.inteiro(faixa)
                        }
                        .buttonStyle(.bordered)
                        .buttonBorderShape(.capsule)
                        .controlSize(.small)
                        .tint(ativa ? Theme.accent : Color.secondary)
                        .accessibilityAddTraits(ativa ? .isSelected : [])
                    }
                }
            }
        } header: {
            Text("Consumo do cliente")
        } footer: {
            if let aviso = avisoDesconto {
                Text(aviso).foregroundStyle(.red)
            } else {
                Text("Média mensal de kWh da conta de luz do cliente.")
            }
        }
    }

    @ViewBuilder
    private var tarifaSecao: some View {
        Section {
            switch tarifa {
            case .carregando:
                HStack {
                    Text("Tarifa do kWh")
                    Spacer()
                    ProgressView()
                }
            case .pronta(let preco, let salva):
                LabeledContent("Tarifa do kWh") {
                    Text(Fmt.brlKwh(preco.precoKwhCalculado))
                        .monospacedDigit()
                }
                if salva {
                    Label("Sem conexão: usando a tarifa salva de \(MonthRef.long(preco.mesReferencia)).",
                          systemImage: "wifi.slash")
                        .font(.footnote)
                        .foregroundStyle(.orange)
                }
            case .indisponivel(let motivo):
                CampoNumero(titulo: "Tarifa do kWh", texto: $tarifaManualTexto, unidade: "R$/kWh", placeholder: "0,9000",
                            foco: $foco, campo: .tarifa)
                Label(motivo, systemImage: "exclamationmark.triangle")
                    .font(.footnote)
                    .foregroundStyle(.orange)
                Button("Tentar buscar de novo") {
                    Task { await carregarTarifa() }
                }
            }
        } header: {
            Text("Tarifa")
        } footer: {
            if case .pronta(let preco, _) = tarifa {
                Text("Tarifa de \(MonthRef.long(preco.mesReferencia)) com impostos, cadastrada em Preços kWh.")
            }
        }
    }

    private var opcionais: some View {
        Section {
            CampoNumero(titulo: "Iluminação pública", texto: $iluminacaoTexto, unidade: "R$", placeholder: "0,00",
                        foco: $foco, campo: .iluminacao)
            TextField("Nome do cliente", text: $nome)
                .textContentType(.name)
                .textInputAutocapitalization(.words)
                .focused($foco, equals: .nome)
                .submitLabel(.next)
                .onSubmit { foco = .endereco }
            TextField("Endereço", text: $endereco, axis: .vertical)
                .textContentType(.fullStreetAddress)
                .lineLimit(1...3)
                .focused($foco, equals: .endereco)
        } header: {
            Text("Opcional")
        } footer: {
            Text("Aparecem no PDF. A iluminação pública entra igual nos dois totais.")
        }
    }

    private func resultado(_ s: Simulacao) -> some View {
        Section("Resultado") {
            VStack(alignment: .leading, spacing: 4) {
                Text("Economia por mês")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                Text(Fmt.brl(s.economiaMensal))
                    .font(.largeTitle.weight(.bold))
                    .foregroundStyle(.green)
                    .monospacedDigit()
                    .contentTransition(.numericText())
                Text("\(Fmt.brl(s.economiaAnual)) por ano")
                    .font(.subheadline.weight(.medium))
                    .foregroundStyle(.secondary)
                    .monospacedDigit()
            }
            .padding(.vertical, 4)
            .accessibilityElement(children: .combine)
            .animation(.snappy, value: s.economiaMensal)

            LinhaInfo(titulo: "Conta sem desconto", valor: Fmt.brl(s.totalSemDesconto))
            LinhaInfo(titulo: "Conta com desconto", valor: Fmt.brl(s.totalComDesconto), destaque: true)
        }
    }

    private var botaoPdf: some View {
        Section {
            Button {
                Task { await gerarPdf() }
            } label: {
                HStack {
                    Spacer()
                    if gerando {
                        ProgressView()
                    } else {
                        Label("Gerar PDF para o cliente", systemImage: "doc.richtext")
                            .fontWeight(.semibold)
                    }
                    Spacer()
                }
            }
            .disabled(simulacao == nil || gerando)
        } footer: {
            Text("O PDF abre na tela; use o botão de compartilhar para mandar pelo WhatsApp ou imprimir.")
        }
    }

    // MARK: Dados

    enum TarifaEstado {
        case carregando
        /// `salva` = veio do aparelho porque o servidor não respondeu.
        case pronta(PrecoKwh, salva: Bool)
        case indisponivel(String)
    }

    private var faixasDesconto: [Double] {
        let contratos = (painel.estado.valor?.descontos ?? []).map(\.percentual).filter { $0 > 0 }
        let faixas = contratos.isEmpty ? Self.descontosPadrao : Array(Set(contratos)).sorted()
        return Array(faixas.prefix(5))
    }

    private var avisoDesconto: String? {
        guard let d = numeroDigitado(descontoTexto) else {
            return descontoTexto.isEmpty ? nil : "Desconto inválido."
        }
        return (d <= 0 || d > 100) ? "O desconto precisa ficar entre 1% e 100%." : nil
    }

    private var tarifaAtual: (valor: Double, mes: String)? {
        switch tarifa {
        case .pronta(let preco, _):
            return (preco.precoKwhCalculado, preco.mesReferencia)
        case .indisponivel:
            guard let manual = numeroDigitado(tarifaManualTexto), manual > 0 else { return nil }
            return (manual, MonthRef.current())
        case .carregando:
            return nil
        }
    }

    private var simulacao: Simulacao? {
        guard let kwh = numeroDigitado(kwhTexto),
              let desconto = numeroDigitado(descontoTexto),
              let tarifaAtual
        else { return nil }
        let s = Simulacao(
            kwh: kwh,
            desconto: desconto,
            tarifa: tarifaAtual.valor,
            iluminacao: numeroDigitado(iluminacaoTexto) ?? 0,
            mesTarifa: MonthRef.normalize(tarifaAtual.mes),
            nomeCliente: nome.trimmingCharacters(in: .whitespacesAndNewlines).nilSeVazio,
            endereco: endereco.trimmingCharacters(in: .whitespacesAndNewlines).nilSeVazio
        )
        return s.valida ? s : nil
    }

    private func carregarTarifa() async {
        let salva = TarifaSalva.carregar()
        if case .pronta = tarifa {} else { tarifa = .carregando }
        do {
            if let preco = try await app.api.precoKwhAtual() {
                TarifaSalva.guardar(preco)
                tarifa = .pronta(preco, salva: false)
            } else {
                tarifa = .indisponivel("Nenhuma tarifa cadastrada em Preços kWh. Digite a tarifa para simular.")
            }
        } catch {
            let mensagem = app.mensagem(para: error)
            if let salva {
                tarifa = .pronta(salva, salva: true)
            } else if let mensagem {
                tarifa = .indisponivel("\(mensagem) Digite a tarifa para simular.")
            }
        }
    }

    private func gerarPdf() async {
        guard let simulacao else { return }
        foco = nil
        gerando = true
        defer { gerando = false }
        do {
            pdf = try SimulacaoPDF.gerar(simulacao)
            gerados += 1
        } catch {
            erro = error.localizedDescription
        }
    }

    private func limpar() {
        kwhTexto = ""
        iluminacaoTexto = ""
        nome = ""
        endereco = ""
        foco = .kwh
    }
}

/// Linha de formulário com rótulo à esquerda, número à direita e unidade.
private struct CampoNumero: View {
    let titulo: String
    @Binding var texto: String
    let unidade: String
    let placeholder: String
    var foco: FocusState<SimuladorView.Campo?>.Binding
    let campo: SimuladorView.Campo

    var body: some View {
        LabeledContent(titulo) {
            HStack(spacing: 4) {
                if unidade == "R$" {
                    Text("R$").foregroundStyle(.secondary)
                }
                TextField(placeholder, text: $texto)
                    .keyboardType(.decimalPad)
                    .focused(foco, equals: campo)
                    .multilineTextAlignment(.trailing)
                    .monospacedDigit()
                if unidade != "R$" {
                    Text(unidade).foregroundStyle(.secondary)
                }
            }
        }
    }
}

/// Última tarifa baixada, para simular sem internet na rua.
enum TarifaSalva {
    private static let chave = "simulador.tarifa"

    static func carregar() -> PrecoKwh? {
        guard let data = UserDefaults.standard.data(forKey: chave) else { return nil }
        return try? JSONDecoder().decode(PrecoKwh.self, from: data)
    }

    static func guardar(_ preco: PrecoKwh) {
        if let data = try? JSONEncoder().encode(preco) {
            UserDefaults.standard.set(data, forKey: chave)
        }
    }
}

extension String {
    var nilSeVazio: String? { isEmpty ? nil : self }
}
