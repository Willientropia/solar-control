import SwiftUI
import UIKit
import SolarCore

enum Theme {
    /// Laranja do sol do logo, um pouco mais escuro para contraste com texto branco.
    static let accent = Color(red: 0.96, green: 0.55, blue: 0.10)
    static let receita = Color.blue
    static let custo = Color.secondary
    static let lucro = Color.green
    static let geracao = Color.orange
    static let previsto = Color.gray.opacity(0.6)
    /// Fundo de tela e de cartão no estilo das listas agrupadas do iOS.
    static let fundo = Color(uiColor: .systemGroupedBackground)
    static let cartao = Color(uiColor: .secondarySystemGroupedBackground)

    static func cor(_ etapa: FaturaFluxo.Etapa) -> Color {
        switch etapa {
        case .upload: return .indigo
        case .pago: return .green
        case .gerada: return .orange
        case .enviada: return .blue
        case .recebida: return .teal
        }
    }

    static func cor(_ tipo: PendenciaTipo?) -> Color {
        switch tipo {
        case .vencida: return .red
        case .naoPago: return .orange
        case .semPdf: return .indigo
        case .semFatura: return .gray
        case nil: return .gray
        }
    }

    static func simbolo(_ tipo: PendenciaTipo?) -> String {
        switch tipo {
        case .vencida: return "exclamationmark.triangle.fill"
        case .naoPago: return "dollarsign.circle"
        case .semPdf: return "doc.badge.ellipsis"
        case .semFatura: return "tray"
        case nil: return "questionmark.circle"
        }
    }

    static func corPerformance(_ valor: Double) -> Color {
        if valor >= 95 { return .green }
        if valor >= 80 { return .orange }
        return .red
    }
}

// MARK: - Estado de carregamento

enum Carregamento<Valor> {
    case carregando
    case pronto(Valor)
    case falhou(String)

    var valor: Valor? {
        if case .pronto(let v) = self { return v }
        return nil
    }
}

/// Mostra spinner, erro com "Tentar de novo" ou o conteúdo.
struct CarregamentoView<Valor, Conteudo: View>: View {
    let estado: Carregamento<Valor>
    let tentarDeNovo: () async -> Void
    @ViewBuilder let conteudo: (Valor) -> Conteudo

    var body: some View {
        switch estado {
        case .carregando:
            ProgressView()
                .frame(maxWidth: .infinity, maxHeight: .infinity)
        case .falhou(let mensagem):
            ContentUnavailableView {
                Label("Não foi possível carregar", systemImage: "wifi.exclamationmark")
            } description: {
                Text(mensagem)
            } actions: {
                Button("Tentar de novo") {
                    Task { await tentarDeNovo() }
                }
                .buttonStyle(.borderedProminent)
            }
        case .pronto(let valor):
            conteudo(valor)
        }
    }
}

// MARK: - Cartões

/// Cartão de indicador: rótulo, valor grande e variação opcional.
struct KPICard: View {
    let titulo: String
    let valor: String
    var simbolo: String? = nil
    var cor: Color = .primary
    var variacao: Double? = nil
    var rodape: String? = nil
    /// Para custos, subir é ruim.
    var inverterVariacao = false

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 6) {
                if let simbolo {
                    Image(systemName: simbolo)
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(cor)
                        .accessibilityHidden(true)
                }
                Text(titulo)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }
            Text(valor)
                .font(.title2.weight(.semibold))
                .monospacedDigit()
                .lineLimit(1)
                .minimumScaleFactor(0.6)
            if let variacao {
                VariacaoBadge(valor: variacao, inverter: inverterVariacao)
            } else if let rodape {
                Text(rodape)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding()
        .background(Theme.cartao, in: .rect(cornerRadius: 16))
        .accessibilityElement(children: .combine)
    }
}

struct VariacaoBadge: View {
    let valor: Double
    var inverter = false

    private var bom: Bool { inverter ? valor < 0 : valor > 0 }

    var body: some View {
        Label {
            Text(Fmt.variacao(valor) + " vs. mês anterior")
        } icon: {
            Image(systemName: valor >= 0 ? "arrow.up.right" : "arrow.down.right")
        }
        .font(.caption.weight(.medium))
        .foregroundStyle(valor == 0 ? Color.secondary : (bom ? Color.green : Color.red))
        .labelStyle(.titleAndIcon)
        .lineLimit(1)
        .minimumScaleFactor(0.8)
    }
}

/// Seção com título em estilo de cabeçalho de lista, para ScrollViews.
struct Secao<Conteudo: View>: View {
    let titulo: String
    var acao: (titulo: String, executar: () -> Void)? = nil
    @ViewBuilder let conteudo: () -> Conteudo

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .firstTextBaseline) {
                Text(titulo)
                    .font(.title3.weight(.semibold))
                Spacer()
                if let acao {
                    Button(acao.titulo, action: acao.executar)
                        .font(.subheadline)
                }
            }
            .accessibilityAddTraits(.isHeader)
            conteudo()
        }
    }
}

// MARK: - Fluxo da fatura

/// Pontos compactos de cada etapa, para linhas de lista.
struct FluxoDots: View {
    let fluxo: FaturaFluxo

    var body: some View {
        HStack(spacing: 4) {
            ForEach(fluxo.etapas, id: \.self) { etapa in
                Image(systemName: fluxo.concluida(etapa) ? etapa.simbolo : "circle")
                    .font(.caption2)
                    .foregroundStyle(fluxo.concluida(etapa) ? Theme.cor(etapa) : Color.secondary.opacity(0.5))
            }
        }
        .accessibilityElement()
        .accessibilityLabel("\(fluxo.concluidas) de \(fluxo.etapas.count) etapas concluídas")
    }
}

struct StatusPill: View {
    let texto: String
    let cor: Color

    var body: some View {
        Text(texto)
            .font(.caption.weight(.semibold))
            .padding(.horizontal, 8)
            .padding(.vertical, 3)
            .foregroundStyle(cor)
            .background(cor.opacity(0.14), in: .capsule)
    }
}

/// Barra horizontal de progresso com rótulo, para performance de usina.
struct BarraPerformance: View {
    let valor: Double

    var body: some View {
        Gauge(value: min(max(valor, 0), 120), in: 0...120) {
            EmptyView()
        }
        .gaugeStyle(.accessoryLinearCapacity)
        .tint(Theme.corPerformance(valor))
        .accessibilityLabel("Performance \(Fmt.percent(valor))")
    }
}

// MARK: - Seletor de mês

struct SeletorMes: View {
    let meses: [String]
    @Binding var selecionado: String?

    var body: some View {
        Menu {
            Picker("Mês de referência", selection: $selecionado) {
                ForEach(meses, id: \.self) { mes in
                    Text(MonthRef.long(mes)).tag(Optional(mes))
                }
            }
        } label: {
            Label(selecionado.map(MonthRef.short) ?? "Mês", systemImage: "calendar")
                .labelStyle(.titleAndIcon)
        }
        .disabled(meses.isEmpty)
        .accessibilityLabel("Mês de referência")
        .accessibilityValue(selecionado.map(MonthRef.long) ?? "")
    }
}

// MARK: - Linha de informação

struct LinhaInfo: View {
    let titulo: String
    let valor: String
    var destaque = false

    var body: some View {
        LabeledContent(titulo) {
            Text(valor)
                .monospacedDigit()
                .fontWeight(destaque ? .semibold : .regular)
                .foregroundStyle(destaque ? .primary : .secondary)
        }
    }
}
