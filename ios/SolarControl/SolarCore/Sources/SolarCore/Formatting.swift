import Foundation

/// Formatação fixa em pt-BR, independente do idioma do aparelho: os valores
/// são reais e kWh brasileiros e precisam bater com os relatórios em PDF.
public enum Fmt {
    static let locale = Locale(identifier: "pt_BR")

    private static func numberFormatter(min: Int, max: Int) -> NumberFormatter {
        let f = NumberFormatter()
        f.locale = locale
        f.numberStyle = .decimal
        f.minimumFractionDigits = min
        f.maximumFractionDigits = max
        f.roundingMode = .halfUp
        f.usesGroupingSeparator = true
        f.groupingSeparator = "."
        f.decimalSeparator = ","
        return f
    }

    private static let fInteiro = numberFormatter(min: 0, max: 0)
    private static let fDuasCasas = numberFormatter(min: 2, max: 2)
    private static let fUmaCasa = numberFormatter(min: 0, max: 1)
    private static let fQuatroCasas = numberFormatter(min: 4, max: 4)

    private static func format(_ f: NumberFormatter, _ value: Double) -> String {
        // -0 aparece como "-0,00" no NumberFormatter.
        let v = value == 0 ? 0 : value
        return f.string(from: NSNumber(value: v)) ?? String(v)
    }

    /// 1234.5 -> "R$ 1.234,50"
    public static func brl(_ value: Double?) -> String {
        guard let value else { return "—" }
        let texto = format(fDuasCasas, abs(value))
        return value < 0 ? "-R$ \(texto)" : "R$ \(texto)"
    }

    /// Valores grandes em painéis: "R$ 12,3 mil", "R$ 1,2 mi".
    public static func brlCompacto(_ value: Double?) -> String {
        guard let value else { return "—" }
        let absoluto = abs(value)
        let sinal = value < 0 ? "-" : ""
        if absoluto >= 1_000_000 { return "\(sinal)R$ \(format(fUmaCasa, absoluto / 1_000_000)) mi" }
        if absoluto >= 10_000 { return "\(sinal)R$ \(format(fUmaCasa, absoluto / 1_000)) mil" }
        return brl(value)
    }

    /// Preço por kWh com 4 casas: "R$ 0,8123"
    public static func brlKwh(_ value: Double?) -> String {
        guard let value else { return "—" }
        return "R$ \(format(fQuatroCasas, value))"
    }

    /// 12345.6 -> "12.346 kWh"
    public static func kwh(_ value: Double?) -> String {
        guard let value else { return "—" }
        return "\(format(fInteiro, value)) kWh"
    }

    public static func kwhCompacto(_ value: Double?) -> String {
        guard let value else { return "—" }
        if abs(value) >= 1_000_000 { return "\(format(fUmaCasa, value / 1_000_000)) GWh" }
        if abs(value) >= 10_000 { return "\(format(fUmaCasa, value / 1_000)) MWh" }
        return kwh(value)
    }

    public static func inteiro(_ value: Double?) -> String {
        guard let value else { return "—" }
        return format(fInteiro, value)
    }

    /// 87.25 -> "87,3%"
    public static func percent(_ value: Double?) -> String {
        guard let value else { return "—" }
        return "\(format(fUmaCasa, value))%"
    }

    /// Variação com sinal: "+12,5%", "-3%"
    public static func variacao(_ value: Double?) -> String {
        guard let value else { return "—" }
        let texto = format(fUmaCasa, abs(value))
        if value > 0 { return "+\(texto)%" }
        if value < 0 { return "-\(texto)%" }
        return "0%"
    }

    /// Meses de duração do saldo: "3,5 meses"
    public static func meses(_ value: Double) -> String {
        let texto = format(fUmaCasa, value)
        return value == 1 ? "\(texto) mês" : "\(texto) meses"
    }

    // MARK: Datas

    private static let isoComFracao: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f
    }()

    private static let isoSemFracao: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime]
        return f
    }()

    public static func parseISO(_ text: String?) -> Date? {
        guard let text, !text.isEmpty else { return nil }
        return isoComFracao.date(from: text) ?? isoSemFracao.date(from: text)
    }

    private static let fDataCurta: DateFormatter = {
        let f = DateFormatter()
        f.locale = locale
        f.timeZone = TimeZone(identifier: "America/Sao_Paulo")
        f.dateFormat = "dd/MM/yyyy"
        return f
    }()

    private static let fDataHora: DateFormatter = {
        let f = DateFormatter()
        f.locale = locale
        f.timeZone = TimeZone(identifier: "America/Sao_Paulo")
        f.dateFormat = "dd/MM/yyyy 'às' HH:mm"
        return f
    }()

    public static func data(_ iso: String?) -> String? {
        parseISO(iso).map { fDataCurta.string(from: $0) }
    }

    public static func dataHora(_ iso: String?) -> String? {
        parseISO(iso).map { fDataHora.string(from: $0) }
    }
}
