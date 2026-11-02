import SwiftUI
import QuickLook
import SolarCore

struct FaturaDetalheView: View {
    @EnvironmentObject private var app: AppState

    @State private var fatura: Fatura
    let nomeUsina: String?
    let aoAtualizar: (Fatura) -> Void

    @State private var ocupado: FaturaFluxo.Etapa?
    @State private var baixando = false
    @State private var gerando = false
    @State private var pdf: URL?
    @State private var erro: String?
    @State private var sucesso = 0

    init(fatura: Fatura, nomeUsina: String?, aoAtualizar: @escaping (Fatura) -> Void = { _ in }) {
        _fatura = State(initialValue: fatura)
        self.nomeUsina = nomeUsina
        self.aoAtualizar = aoAtualizar
    }

    private var fluxo: FaturaFluxo { FaturaFluxo(fatura: fatura, cliente: nil) }

    var body: some View {
        List {
            cabecalho
            etapas
            documentos
            valores
            energia
            if app.usuario?.isAdmin == true { statusConcessionaria }
        }
        .listStyle(.insetGrouped)
        .navigationTitle(MonthRef.normalize(fatura.mesReferencia))
        .navigationBarTitleDisplayMode(.inline)
        .quickLookPreview($pdf)
        .sensoryFeedback(.success, trigger: sucesso)
        .alert("Algo deu errado", isPresented: Binding(
            get: { erro != nil },
            set: { if !$0 { erro = nil } }
        )) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(erro ?? "")
        }
        .refreshable { await recarregar() }
    }

    // MARK: Seções

    private var cabecalho: some View {
        Section {
            VStack(alignment: .leading, spacing: 8) {
                Text(fatura.cliente?.nome ?? "Cliente")
                    .font(.title2.weight(.semibold))
                Text([fatura.cliente.map { "UC \($0.uc)" }, nomeUsina].compactMap { $0 }.joined(separator: " · "))
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                HStack(alignment: .firstTextBaseline) {
                    Text(Fmt.brl(fluxo.usoProprio ? fatura.valorTotal : fatura.valorComDesconto))
                        .font(.largeTitle.weight(.bold))
                        .monospacedDigit()
                        .minimumScaleFactor(0.6)
                        .lineLimit(1)
                    Spacer()
                    if fluxo.completa {
                        StatusPill(texto: "Completa", cor: .green)
                    } else if let proxima = fluxo.proximaEtapa {
                        StatusPill(texto: "Falta: \(proxima.titulo)", cor: Theme.cor(proxima))
                    }
                }
                .padding(.top, 4)
                if let vencimento = fatura.dataVencimento, !vencimento.isEmpty {
                    Label("Vence em \(vencimento)", systemImage: "calendar")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
            }
            .padding(.vertical, 4)
            .accessibilityElement(children: .combine)
        }
    }

    private var etapas: some View {
        Section {
            ForEach(fluxo.etapas, id: \.self) { etapa in
                EtapaLinha(
                    etapa: etapa,
                    concluida: fluxo.concluida(etapa),
                    data: data(de: etapa),
                    editavel: editavel(etapa),
                    ocupado: ocupado == etapa
                ) {
                    Task { await alternar(etapa) }
                }
            }
        } header: {
            Text("Andamento")
        } footer: {
            Text(fluxo.usoProprio
                 ? "Uso próprio: só a conta da concessionária."
                 : "PDF e Pago são da conta da concessionária. Gerada, Enviada e Recebida são da fatura com desconto do cliente.")
        }
    }

    private var documentos: some View {
        Section("Documentos") {
            Button {
                Task { await abrirOriginal() }
            } label: {
                HStack {
                    Label("Conta da concessionária", systemImage: "doc.richtext")
                    Spacer()
                    if baixando { ProgressView() }
                }
            }
            .disabled(!fluxo.temUpload || baixando)

            if !fluxo.usoProprio {
                Button {
                    Task { await gerarComDesconto() }
                } label: {
                    HStack {
                        Label("Gerar fatura com desconto", systemImage: "wand.and.stars")
                        Spacer()
                        if gerando { ProgressView() }
                    }
                }
                .disabled(gerando)
            }
        }
    }

    private var valores: some View {
        Section("Valores") {
            if !fluxo.usoProprio {
                LinhaInfo(titulo: "Cliente paga", valor: Fmt.brl(fatura.valorComDesconto), destaque: true)
                LinhaInfo(titulo: "Sem desconto", valor: Fmt.brl(fatura.valorSemDesconto))
                LinhaInfo(titulo: "Economia do cliente", valor: Fmt.brl(fatura.economia))
            }
            LinhaInfo(titulo: "Conta da concessionária", valor: Fmt.brl(fatura.valorTotal))
            if !fluxo.usoProprio {
                LinhaInfo(titulo: "Lucro", valor: Fmt.brl(fatura.lucro), destaque: true)
            }
            if let ip = fatura.contribuicaoIluminacao, ip > 0 {
                LinhaInfo(titulo: "Iluminação pública", valor: Fmt.brl(ip))
            }
        }
    }

    private var energia: some View {
        Section("Energia") {
            LinhaInfo(titulo: "Consumo compensado", valor: Fmt.kwh(fatura.consumoScee))
            LinhaInfo(titulo: "Não compensado", valor: Fmt.kwh(fatura.consumoNaoCompensado))
            if let injetada = fatura.energiaInjetada, injetada > 0 {
                LinhaInfo(titulo: "Energia injetada", valor: Fmt.kwh(injetada))
            }
            LinhaInfo(titulo: "Saldo de crédito", valor: Fmt.kwh(fatura.saldoKwh))
            if let preco = fatura.precoKwh {
                LinhaInfo(titulo: "Preço do kWh", valor: Fmt.brlKwh(preco))
            }
        }
    }

    private var statusConcessionaria: some View {
        Section {
            Picker("Status", selection: Binding(
                get: { fatura.statusConhecido ?? .aguardandoUpload },
                set: { novo in Task { await mudarStatus(novo) } }
            )) {
                ForEach(FaturaStatus.allCases, id: \.self) { status in
                    Text(status.titulo).tag(status)
                }
            }
        } header: {
            Text("Conta da concessionária")
        } footer: {
            Text("Só administradores podem marcar como Pago.")
        }
    }

    // MARK: Regras

    private func data(de etapa: FaturaFluxo.Etapa) -> String? {
        switch etapa {
        case .gerada: return Fmt.dataHora(fatura.faturaClienteGeradaAt)
        case .enviada: return Fmt.dataHora(fatura.faturaClienteEnviadaAt)
        case .recebida: return Fmt.dataHora(fatura.faturaClienteRecebidaAt)
        case .upload, .pago: return nil
        }
    }

    /// Só o fluxo B é marcado à mão, e em ordem: enviada exige gerada etc.
    private func editavel(_ etapa: FaturaFluxo.Etapa) -> Bool {
        switch etapa {
        case .upload: return false
        case .pago: return app.usuario?.isAdmin == true
        case .gerada: return !fluxo.enviada
        case .enviada: return fluxo.gerada && !fluxo.recebida
        case .recebida: return fluxo.enviada
        }
    }

    private func alternar(_ etapa: FaturaFluxo.Etapa) async {
        let feita = fluxo.concluida(etapa)
        ocupado = etapa
        defer { ocupado = nil }
        do {
            switch etapa {
            case .upload:
                return
            case .pago:
                try await aplicar(app.api.atualizarStatus(feita ? .aguardandoPagamento : .pago, faturaId: fatura.id))
            case .gerada:
                try await aplicar(app.api.executar(feita ? .desmarcarGerada : .marcarGerada, faturaId: fatura.id))
            case .enviada:
                try await aplicar(app.api.executar(feita ? .desmarcarEnviada : .marcarEnviada, faturaId: fatura.id))
            case .recebida:
                try await aplicar(app.api.executar(feita ? .desmarcarRecebida : .marcarRecebida, faturaId: fatura.id))
            }
            sucesso += 1
        } catch {
            erro = app.mensagem(para: error)
        }
    }

    private func mudarStatus(_ status: FaturaStatus) async {
        guard status != fatura.statusConhecido else { return }
        do {
            try await aplicar(app.api.atualizarStatus(status, faturaId: fatura.id))
            sucesso += 1
        } catch {
            erro = app.mensagem(para: error)
        }
    }

    private func aplicar(_ nova: Fatura) {
        var atualizada = nova
        // As rotas PATCH devolvem a fatura sem o join do cliente.
        atualizada.cliente = nova.cliente ?? fatura.cliente
        fatura = atualizada
        aoAtualizar(atualizada)
    }

    private func recarregar() async {
        do {
            let nova = try await app.api.fatura(id: fatura.id)
            aplicar(nova)
        } catch {
            erro = app.mensagem(para: error)
        }
    }

    private func abrirOriginal() async {
        baixando = true
        defer { baixando = false }
        do {
            pdf = try await app.api.baixarPdfOriginal(fatura)
        } catch {
            erro = app.mensagem(para: error)
        }
    }

    private func gerarComDesconto() async {
        gerando = true
        defer { gerando = false }
        do {
            pdf = try await app.api.gerarPdfCliente(fatura)
            sucesso += 1
        } catch {
            erro = app.mensagem(para: error)
        }
    }
}

private struct EtapaLinha: View {
    let etapa: FaturaFluxo.Etapa
    let concluida: Bool
    let data: String?
    let editavel: Bool
    let ocupado: Bool
    let alternar: () -> Void

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: concluida ? etapa.simbolo : "circle.dashed")
                .font(.title3)
                .foregroundStyle(concluida ? Theme.cor(etapa) : Color.secondary)
                .frame(width: 30)
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 2) {
                Text(titulo)
                if let data {
                    Text(data)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
            Spacer()
            if ocupado {
                ProgressView()
            } else if editavel {
                Button(concluida ? "Desfazer" : "Marcar", action: alternar)
                    .buttonStyle(.bordered)
                    .controlSize(.small)
                    .tint(concluida ? Color.secondary : Theme.cor(etapa))
            } else if concluida {
                Image(systemName: "checkmark")
                    .foregroundStyle(.secondary)
                    .accessibilityHidden(true)
            }
        }
        .accessibilityElement(children: .combine)
        .accessibilityValue(concluida ? "Concluída" : "Pendente")
    }

    private var titulo: String {
        switch etapa {
        case .upload: return "PDF da concessionária"
        case .pago: return "Conta paga"
        case .gerada: return "Fatura com desconto gerada"
        case .enviada: return "Enviada ao cliente"
        case .recebida: return "Pagamento recebido"
        }
    }
}
