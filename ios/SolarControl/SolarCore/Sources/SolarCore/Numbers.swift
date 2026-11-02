import Foundation

// O Postgres devolve colunas `decimal` como texto ("123.45") pelo drizzle,
// enquanto o dashboard manda números de verdade. Estes wrappers aceitam os
// dois formatos, e também `null` ou a chave ausente, para que um campo vazio
// não derrube a decodificação da tela inteira.

/// Número opcional: texto, número, `null` ou ausente.
@propertyWrapper
public struct OptionalNumber: Codable, Hashable, Sendable {
    public var wrappedValue: Double?

    public init(wrappedValue: Double?) {
        self.wrappedValue = wrappedValue
    }

    public init(from decoder: Decoder) throws {
        wrappedValue = Self.decodeLenient(from: decoder)
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        try container.encode(wrappedValue)
    }

    static func decodeLenient(from decoder: Decoder) -> Double? {
        guard let container = try? decoder.singleValueContainer() else { return nil }
        if container.decodeNil() { return nil }
        if let value = try? container.decode(Double.self) { return value.isFinite ? value : nil }
        if let text = try? container.decode(String.self) {
            return parseDecimalText(text)
        }
        return nil
    }
}

/// Número obrigatório: `null` ou ausente viram 0.
@propertyWrapper
public struct Number: Codable, Hashable, Sendable {
    public var wrappedValue: Double

    public init(wrappedValue: Double) {
        self.wrappedValue = wrappedValue
    }

    public init(from decoder: Decoder) throws {
        wrappedValue = OptionalNumber.decodeLenient(from: decoder) ?? 0
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        try container.encode(wrappedValue)
    }
}

extension KeyedDecodingContainer {
    public func decode(_ type: OptionalNumber.Type, forKey key: Key) throws -> OptionalNumber {
        try decodeIfPresent(type, forKey: key) ?? OptionalNumber(wrappedValue: nil)
    }

    public func decode(_ type: Number.Type, forKey key: Key) throws -> Number {
        try decodeIfPresent(type, forKey: key) ?? Number(wrappedValue: 0)
    }
}

/// "123.45" -> 123.45. Aceita vírgula decimal ("123,45") de dados digitados.
func parseDecimalText(_ text: String) -> Double? {
    let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !trimmed.isEmpty else { return nil }
    if let value = Double(trimmed) { return value.isFinite ? value : nil }
    if !trimmed.contains("."), let value = Double(trimmed.replacingOccurrences(of: ",", with: ".")) {
        return value.isFinite ? value : nil
    }
    return nil
}
