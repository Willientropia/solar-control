import Foundation

/// Preço do kWh de um mês (GET /api/precos-kwh/...), calculado na página
/// Preços kWh a partir de TUSD, TE e impostos.
public struct PrecoKwh: Codable, Hashable, Sendable {
    public var id: String?
    public var mesReferencia: String
    @Number public var precoKwhCalculado: Double

    public init(mesReferencia: String, precoKwhCalculado: Double) {
        self.id = nil
        self.mesReferencia = mesReferencia
        self.precoKwhCalculado = precoKwhCalculado
    }
}

/// Simulação de economia para mostrar a um cliente em potencial.
///
/// A conta é a mais simples possível, de propósito:
///
///     energia      = kWh × tarifa
///     sem desconto = energia + iluminação pública
///     com desconto = energia × (1 − desconto) + iluminação pública
///     economia     = energia × desconto
public struct Simulacao: Hashable, Sendable {
    public var kwh: Double
    /// Em %, de 0 a 100.
    public var desconto: Double
    public var tarifa: Double
    public var iluminacao: Double
    public var mesTarifa: String
    public var nomeCliente: String?
    public var endereco: String?

    public init(kwh: Double, desconto: Double, tarifa: Double, iluminacao: Double = 0,
                mesTarifa: String, nomeCliente: String? = nil, endereco: String? = nil) {
        self.kwh = kwh
        self.desconto = desconto
        self.tarifa = tarifa
        self.iluminacao = iluminacao
        self.mesTarifa = mesTarifa
        self.nomeCliente = nomeCliente
        self.endereco = endereco
    }

    public var valorEnergia: Double { Self.centavos(kwh * tarifa) }
    public var valorDesconto: Double { Self.centavos(valorEnergia * desconto / 100) }
    public var energiaComDesconto: Double { valorEnergia - valorDesconto }
    public var totalSemDesconto: Double { valorEnergia + iluminacao }
    public var totalComDesconto: Double { energiaComDesconto + iluminacao }
    public var economiaMensal: Double { valorDesconto }
    public var economiaAnual: Double { valorDesconto * 12 }

    /// Pronta para gerar o PDF: consumo e tarifa positivos, desconto entre 0 e 100.
    public var valida: Bool {
        kwh > 0 && tarifa > 0 && desconto > 0 && desconto <= 100 && iluminacao >= 0
    }

    /// Arredonda como na fatura: ao centavo, metade para cima.
    static func centavos(_ valor: Double) -> Double {
        (valor * 100).rounded(.toNearestOrAwayFromZero) / 100
    }
}

/// Lê um número digitado no teclado brasileiro: "350", "350,5", "1.234,56",
/// "R$ 12,90", "25%". Devolve nil para texto vazio ou inválido.
public func numeroDigitado(_ texto: String) -> Double? {
    var t = texto
        .replacingOccurrences(of: "R$", with: "")
        .replacingOccurrences(of: "%", with: "")
        .replacingOccurrences(of: "kWh", with: "", options: .caseInsensitive)
        .trimmingCharacters(in: .whitespacesAndNewlines)
    guard !t.isEmpty else { return nil }
    if t.contains(",") {
        // Vírgula é o decimal; ponto, o separador de milhar.
        t = t.replacingOccurrences(of: ".", with: "").replacingOccurrences(of: ",", with: ".")
    } else if t.filter({ $0 == "." }).count > 1 {
        t = t.replacingOccurrences(of: ".", with: "")
    }
    guard let valor = Double(t), valor.isFinite else { return nil }
    return valor
}
