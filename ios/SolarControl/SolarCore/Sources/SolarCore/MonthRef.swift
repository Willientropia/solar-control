import Foundation

/// Referências de mês ("Jan/2026"). Porta de shared/month-utils.ts: o banco
/// guarda texto livre, com grafias legadas ("DEZ/2025", "dez/25").
public enum MonthRef {
    public static let abreviacoes = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
                                     "Jul", "Ago", "Set", "Out", "Nov", "Dez"]

    static let nomesCompletos = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
                                 "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"]

    private static func partes(_ ref: String) -> (mes: Int, ano: Int)? {
        let pedacos = ref.trimmingCharacters(in: .whitespaces).split(separator: "/")
        guard pedacos.count == 2 else { return nil }
        let mesTexto = pedacos[0].uppercased()
        guard let indice = abreviacoes.firstIndex(where: { $0.uppercased() == mesTexto }) else { return nil }
        let anoTexto = String(pedacos[1])
        guard let anoBruto = Int(anoTexto) else { return nil }
        let ano = anoTexto.count == 2 ? 2000 + anoBruto : anoBruto
        return (indice, ano)
    }

    /// "DEZ/25" -> "Dez/2025". Devolve o original se não reconhecer.
    public static func normalize(_ ref: String?) -> String {
        guard let ref, !ref.isEmpty else { return "" }
        guard let p = partes(ref) else { return ref.trimmingCharacters(in: .whitespaces) }
        return "\(abreviacoes[p.mes])/\(p.ano)"
    }

    /// ano * 12 + mês, para ordenar. -1 quando não reconhece.
    public static func sortKey(_ ref: String?) -> Int {
        guard let ref, let p = partes(ref) else { return -1 }
        return p.ano * 12 + p.mes
    }

    public static func same(_ a: String?, _ b: String?) -> Bool {
        guard let a, let b, !a.isEmpty, !b.isEmpty else { return false }
        return normalize(a).uppercased() == normalize(b).uppercased()
    }

    public static func current(_ date: Date = Date(), calendar: Calendar = .init(identifier: .gregorian)) -> String {
        let comps = calendar.dateComponents([.year, .month], from: date)
        return "\(abreviacoes[(comps.month ?? 1) - 1])/\(comps.year ?? 2000)"
    }

    public static func add(_ ref: String, _ delta: Int) -> String {
        let key = sortKey(ref)
        guard key >= 0 else { return ref }
        let total = key + delta
        let mes = ((total % 12) + 12) % 12
        let ano = Int((Double(total) / 12).rounded(.down))
        return "\(abreviacoes[mes])/\(ano)"
    }

    /// "Jan/2026" -> "Jan/26", para eixos de gráfico.
    public static func short(_ ref: String) -> String {
        let norm = normalize(ref)
        let p = norm.split(separator: "/")
        guard p.count == 2 else { return norm }
        return "\(p[0])/\(p[1].suffix(2))"
    }

    /// "Jan/2026" -> "Janeiro de 2026", para títulos.
    public static func long(_ ref: String) -> String {
        guard let p = partes(ref) else { return ref }
        return "\(nomesCompletos[p.mes]) de \(p.ano)"
    }

    /// Ordena do mais recente para o mais antigo, sem repetir grafias.
    public static func sortedDescending(_ refs: [String]) -> [String] {
        var vistos = Set<String>()
        return refs
            .map { normalize($0) }
            .filter { vistos.insert($0.uppercased()).inserted }
            .sorted { sortKey($0) > sortKey($1) }
    }
}
