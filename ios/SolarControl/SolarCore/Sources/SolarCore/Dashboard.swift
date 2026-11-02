import Foundation

// Contrato de GET /api/dashboard/overview — espelha shared/dashboard-types.ts.

public struct DashboardTotais: Codable, Hashable, Sendable {
    @Number public var receita: Double
    @Number public var custo: Double
    @Number public var lucro: Double
    @Number public var economia: Double
    @Number public var kwhDistribuido: Double
    @Number public var usinas: Double
    @Number public var clientes: Double
    @Number public var clientesAtivos: Double
    @Number public var geracao: Double
    @Number public var geracaoPrevista: Double
    @Number public var performance: Double
    @Number public var saldoTotalKwh: Double
    @Number public var faturasEsperadas: Double
    @Number public var faturasRecebidas: Double
    @Number public var faturasSemPdf: Double
    @Number public var clientesSemFatura: Double
    @Number public var faturasFaltando: Double
    @Number public var faturasPendentesPagamento: Double
    @Number public var faturasEmAtraso: Double
    @Number public var aguardandoConfirmacao: Double
}

public struct DashboardVariacoes: Codable, Hashable, Sendable {
    @OptionalNumber public var lucro: Double?
    @OptionalNumber public var receita: Double?
    @OptionalNumber public var geracao: Double?
    @OptionalNumber public var economia: Double?

    public init(lucro: Double?, receita: Double?, geracao: Double?, economia: Double?) {
        self.lucro = lucro
        self.receita = receita
        self.geracao = geracao
        self.economia = economia
    }
}

public struct DashboardSeriePonto: Codable, Hashable, Sendable {
    public var mes: String
    @Number public var kwh: Double
    @Number public var previsto: Double
}

public struct DashboardUsina: Codable, Identifiable, Hashable, Sendable {
    public var id: String
    public var nome: String
    public var unidadeConsumidora: String
    @Number public var potenciaKwp: Double
    @Number public var receita: Double
    @Number public var custo: Double
    @Number public var lucro: Double
    @Number public var economia: Double
    @Number public var kwhDistribuido: Double
    @Number public var clientes: Double
    @Number public var clientesAtivos: Double
    @Number public var geracao: Double
    @Number public var geracaoPrevista: Double
    @Number public var performance: Double
    @Number public var saldoKwh: Double
    @Number public var faturasEsperadas: Double
    @Number public var faturasRecebidas: Double
    @Number public var faturasFaltando: Double
    @Number public var faturasPendentesPagamento: Double
    @Number public var faturasEmAtraso: Double
    @OptionalNumber public var variacaoLucro: Double?
    public var serieGeracao: [DashboardSeriePonto]
}

public struct DashboardSaldoUC: Codable, Hashable, Sendable, Identifiable {
    public var clienteId: String
    public var clienteNome: String
    public var uc: String
    public var usinaId: String
    public var usinaNome: String
    @Number public var saldo: Double
    public var mes: String

    public var id: String { clienteId + uc }
}

public struct DashboardPrecoMes: Codable, Hashable, Sendable {
    public var mes: String
    @OptionalNumber public var tabela: Double?
    @OptionalNumber public var fioB: Double?
    public var fioBHerdado: Bool?
    /// Chave = percentual de desconto em texto ("25"), valor em R$/kWh.
    public var liquido: [String: Double]?

    /// O servidor usa `String(percentual)` do JavaScript como chave: "25", "12.5".
    public func liquido(desconto: Double) -> Double? {
        let chave = desconto.rounded() == desconto ? String(Int(desconto)) : String(desconto)
        return liquido?[chave]
    }
}

public enum PendenciaTipo: String, Codable, Sendable, CaseIterable {
    case semFatura = "sem_fatura"
    case semPdf = "sem_pdf"
    case naoPago = "nao_pago"
    case vencida

    public var titulo: String {
        switch self {
        case .semFatura: return "Sem fatura"
        case .semPdf: return "Sem PDF"
        case .naoPago: return "Não pago"
        case .vencida: return "Vencida"
        }
    }
}

public struct DashboardPendencia: Codable, Hashable, Sendable, Identifiable {
    public var clienteId: String
    public var clienteNome: String
    public var uc: String
    public var usinaId: String
    public var usinaNome: String
    public var tipo: String
    public var detalhe: String
    public var faturaId: String?

    public var id: String { "\(clienteId)-\(tipo)-\(faturaId ?? "")" }
    public var tipoConhecido: PendenciaTipo? { PendenciaTipo(rawValue: tipo) }
}

public struct DashboardHistorico: Codable, Hashable, Sendable, Identifiable {
    public var mes: String
    @Number public var geracao: Double
    @Number public var receita: Double
    @Number public var custo: Double
    @Number public var lucro: Double
    @Number public var economia: Double
    @Number public var faturas: Double

    public var id: String { mes }
}

public struct DashboardSaldos: Codable, Hashable, Sendable {
    public var maiores: [DashboardSaldoUC]
    public var menores: [DashboardSaldoUC]
    @Number public var total: Double
    @Number public var ucsComSaldo: Double

    public init(maiores: [DashboardSaldoUC], menores: [DashboardSaldoUC], total: Double, ucsComSaldo: Double) {
        self.maiores = maiores
        self.menores = menores
        self.total = total
        self.ucsComSaldo = ucsComSaldo
    }
}

public struct DashboardDesconto: Codable, Hashable, Sendable {
    @Number public var percentual: Double
    @Number public var clientes: Double
}

public struct DashboardOverview: Codable, Hashable, Sendable {
    public var mesReferencia: String
    public var mesAnterior: String
    public var mesesDisponiveis: [String]
    public var atualizadoEm: String
    public var totais: DashboardTotais
    public var variacoes: DashboardVariacoes
    public var usinas: [DashboardUsina]
    public var descontos: [DashboardDesconto]
    public var precoKwh: [DashboardPrecoMes]
    public var historico: [DashboardHistorico]
    public var saldos: DashboardSaldos
    public var pendencias: [DashboardPendencia]

    enum CodingKeys: String, CodingKey {
        case mesReferencia, mesAnterior, mesesDisponiveis, atualizadoEm, totais, variacoes
        case usinas, descontos, precoKwh, historico, saldos, pendencias
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        mesReferencia = try c.decode(String.self, forKey: .mesReferencia)
        mesAnterior = try c.decodeIfPresent(String.self, forKey: .mesAnterior) ?? ""
        mesesDisponiveis = try c.decodeIfPresent([String].self, forKey: .mesesDisponiveis) ?? []
        atualizadoEm = try c.decodeIfPresent(String.self, forKey: .atualizadoEm) ?? ""
        totais = try c.decode(DashboardTotais.self, forKey: .totais)
        variacoes = try c.decodeIfPresent(DashboardVariacoes.self, forKey: .variacoes)
            ?? DashboardVariacoes(lucro: nil, receita: nil, geracao: nil, economia: nil)
        // Seções acrescentadas ao longo do tempo: um servidor mais antigo não
        // as manda, e o app mostra o resto em vez de falhar.
        usinas = try c.decodeIfPresent([DashboardUsina].self, forKey: .usinas) ?? []
        descontos = try c.decodeIfPresent([DashboardDesconto].self, forKey: .descontos) ?? []
        precoKwh = try c.decodeIfPresent([DashboardPrecoMes].self, forKey: .precoKwh) ?? []
        historico = try c.decodeIfPresent([DashboardHistorico].self, forKey: .historico) ?? []
        saldos = try c.decodeIfPresent(DashboardSaldos.self, forKey: .saldos)
            ?? DashboardSaldos(maiores: [], menores: [], total: 0, ucsComSaldo: 0)
        pendencias = try c.decodeIfPresent([DashboardPendencia].self, forKey: .pendencias) ?? []
    }

    /// Margem do mês (lucro sobre receita), em %.
    public var margem: Double? {
        totais.receita > 0 ? totais.lucro / totais.receita * 100 : nil
    }
}
