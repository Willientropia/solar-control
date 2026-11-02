import Foundation

/// Os dois fluxos de uma fatura, como em fatura-flow-indicators.tsx:
///
/// - **A (concessionária):** PDF enviado → conta paga.
/// - **B (cliente, só para pagantes):** fatura com desconto gerada → enviada → recebida.
public struct FaturaFluxo: Hashable, Sendable {
    public enum Etapa: String, CaseIterable, Sendable {
        case upload, pago, gerada, enviada, recebida

        public var titulo: String {
            switch self {
            case .upload: return "PDF"
            case .pago: return "Pago"
            case .gerada: return "Gerada"
            case .enviada: return "Enviada"
            case .recebida: return "Recebida"
            }
        }

        /// SF Symbol de cada etapa.
        public var simbolo: String {
            switch self {
            case .upload: return "doc.fill"
            case .pago: return "dollarsign.circle.fill"
            case .gerada: return "doc.text.fill"
            case .enviada: return "paperplane.fill"
            case .recebida: return "checkmark.seal.fill"
            }
        }
    }

    public let temUpload: Bool
    public let pagoConcessionaria: Bool
    public let gerada: Bool
    public let enviada: Bool
    public let recebida: Bool
    public let usoProprio: Bool

    public init(fatura: Fatura, cliente: Cliente?) {
        temUpload = !(fatura.arquivoPdfUrl ?? "").isEmpty
        pagoConcessionaria = fatura.status == FaturaStatus.pago.rawValue
            || fatura.status == FaturaStatus.pagamentoPendenteConfirmacao.rawValue
        gerada = fatura.faturaClienteGeradaAt != nil
        enviada = fatura.faturaClienteEnviadaAt != nil
        recebida = fatura.faturaClienteRecebidaAt != nil
        usoProprio = (cliente ?? fatura.cliente)?.isUsoProprio ?? false
    }

    public var etapas: [Etapa] {
        usoProprio ? [.upload, .pago] : Etapa.allCases
    }

    public func concluida(_ etapa: Etapa) -> Bool {
        switch etapa {
        case .upload: return temUpload
        case .pago: return pagoConcessionaria
        case .gerada: return gerada
        case .enviada: return enviada
        case .recebida: return recebida
        }
    }

    public var concluidas: Int { etapas.filter(concluida).count }

    /// Tudo feito: mesma regra de "faturas completas" da página de faturas.
    public var completa: Bool { concluidas == etapas.count }

    /// Próxima etapa em aberto, na ordem do fluxo.
    public var proximaEtapa: Etapa? { etapas.first { !concluida($0) } }
}

/// Ações de PATCH /api/faturas/:id/<acao> do fluxo B.
public enum FaturaAcao: String, CaseIterable, Sendable {
    case marcarGerada = "marcar-gerada"
    case desmarcarGerada = "desmarcar-gerada"
    case marcarEnviada = "marcar-enviada"
    case desmarcarEnviada = "desmarcar-enviada"
    case marcarRecebida = "marcar-recebida"
    case desmarcarRecebida = "desmarcar-recebida"

    public var titulo: String {
        switch self {
        case .marcarGerada: return "Marcar como gerada"
        case .desmarcarGerada: return "Desmarcar gerada"
        case .marcarEnviada: return "Marcar como enviada"
        case .desmarcarEnviada: return "Desmarcar enviada"
        case .marcarRecebida: return "Marcar como recebida"
        case .desmarcarRecebida: return "Desmarcar recebida"
        }
    }
}

/// Filtro rápido da lista de faturas.
public enum FaturaFiltro: String, CaseIterable, Identifiable, Sendable {
    case todas, pendentes, completas

    public var id: String { rawValue }

    public var titulo: String {
        switch self {
        case .todas: return "Todas"
        case .pendentes: return "Pendentes"
        case .completas: return "Completas"
        }
    }

    public func aceita(_ fatura: Fatura) -> Bool {
        switch self {
        case .todas: return true
        case .pendentes: return !FaturaFluxo(fatura: fatura, cliente: nil).completa
        case .completas: return FaturaFluxo(fatura: fatura, cliente: nil).completa
        }
    }
}
