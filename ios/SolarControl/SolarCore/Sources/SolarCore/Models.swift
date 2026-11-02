import Foundation

// Espelham shared/schema.ts. Só os campos que o app usa: o JSONDecoder
// ignora o resto, então colunas novas no servidor não quebram o app.

// MARK: - Usina

public struct Usina: Codable, Identifiable, Hashable, Sendable {
    public var id: String
    public var nome: String
    public var unidadeConsumidora: String
    @OptionalNumber public var producaoMensalPrevista: Double?
    @OptionalNumber public var potenciaKwp: Double?
    @OptionalNumber public var descontoPadrao: Double?
    public var endereco: String?
}

// MARK: - Cliente

public struct Cliente: Codable, Identifiable, Hashable, Sendable {
    public var id: String
    public var nome: String
    public var cpfCnpj: String?
    public var enderecoSimplificado: String?
    public var enderecoCompleto: String?
    public var unidadeConsumidora: String?
    public var unidadeConsumidoraNova: String?
    public var usinaId: String
    @OptionalNumber public var desconto: Double?
    public var isPagante: Bool
    public var numeroContrato: String?
    @OptionalNumber public var valorContratadoKwh: Double?
    @OptionalNumber public var porcentagemEnvioCredito: Double?
    public var ativo: Bool
    /// Vem preenchida em GET /api/clientes (join com a usina).
    public var usina: Usina?

    enum CodingKeys: String, CodingKey {
        case id, nome, cpfCnpj, enderecoSimplificado, enderecoCompleto
        case unidadeConsumidora, unidadeConsumidoraNova, usinaId, desconto
        case isPagante, numeroContrato, valorContratadoKwh, porcentagemEnvioCredito
        case ativo, usina
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        nome = try c.decode(String.self, forKey: .nome)
        cpfCnpj = try c.decodeIfPresent(String.self, forKey: .cpfCnpj)
        enderecoSimplificado = try c.decodeIfPresent(String.self, forKey: .enderecoSimplificado)
        enderecoCompleto = try c.decodeIfPresent(String.self, forKey: .enderecoCompleto)
        unidadeConsumidora = try c.decodeIfPresent(String.self, forKey: .unidadeConsumidora)
        unidadeConsumidoraNova = try c.decodeIfPresent(String.self, forKey: .unidadeConsumidoraNova)
        usinaId = try c.decodeIfPresent(String.self, forKey: .usinaId) ?? ""
        _desconto = try c.decode(OptionalNumber.self, forKey: .desconto)
        isPagante = try c.decodeIfPresent(Bool.self, forKey: .isPagante) ?? true
        numeroContrato = try c.decodeIfPresent(String.self, forKey: .numeroContrato)
        _valorContratadoKwh = try c.decode(OptionalNumber.self, forKey: .valorContratadoKwh)
        _porcentagemEnvioCredito = try c.decode(OptionalNumber.self, forKey: .porcentagemEnvioCredito)
        ativo = try c.decodeIfPresent(Bool.self, forKey: .ativo) ?? true
        usina = try c.decodeIfPresent(Usina.self, forKey: .usina)
    }

    /// UC exibida: a nova (formato 2026+) quando existe, senão a legada.
    public var uc: String {
        if let nova = unidadeConsumidoraNova, !nova.isEmpty { return nova }
        if let antiga = unidadeConsumidora, !antiga.isEmpty { return antiga }
        return "—"
    }

    /// Cliente de uso próprio não recebe fatura com desconto (fluxo B).
    public var isUsoProprio: Bool { !isPagante }
}

// MARK: - Fatura

public enum FaturaStatus: String, Codable, CaseIterable, Sendable {
    case aguardandoUpload = "aguardando_upload"
    case aguardandoPagamento = "aguardando_pagamento"
    case pagamentoPendenteConfirmacao = "pagamento_pendente_confirmacao"
    case pago

    public var titulo: String {
        switch self {
        case .aguardandoUpload: return "Aguardando upload"
        case .aguardandoPagamento: return "Aguardando pagamento"
        case .pagamentoPendenteConfirmacao: return "Pagamento a confirmar"
        case .pago: return "Pago"
        }
    }
}

public struct Fatura: Codable, Identifiable, Hashable, Sendable {
    public var id: String
    public var clienteId: String
    public var usinaId: String?
    public var mesReferencia: String
    public var dataVencimento: String?

    @OptionalNumber public var consumoScee: Double?
    @OptionalNumber public var consumoNaoCompensado: Double?
    @OptionalNumber public var energiaInjetada: Double?
    @OptionalNumber public var saldoKwh: Double?
    @OptionalNumber public var contribuicaoIluminacao: Double?
    @OptionalNumber public var precoKwh: Double?
    @OptionalNumber public var precoFioB: Double?
    @OptionalNumber public var valorTotal: Double?
    @OptionalNumber public var valorSemDesconto: Double?
    @OptionalNumber public var valorComDesconto: Double?
    @OptionalNumber public var economia: Double?
    @OptionalNumber public var lucro: Double?

    /// Texto livre no banco: há valores legados ("pendente", "processada").
    public var status: String
    public var arquivoPdfUrl: String?
    public var faturaGeradaUrl: String?
    public var faturaClienteGeradaAt: String?
    public var faturaClienteEnviadaAt: String?
    public var faturaClienteRecebidaAt: String?
    public var createdAt: String?

    /// Vem preenchido em GET /api/faturas (join com o cliente).
    public var cliente: Cliente?

    public var statusConhecido: FaturaStatus? { FaturaStatus(rawValue: status) }
}

// MARK: - Geração

public struct GeracaoMensal: Codable, Identifiable, Hashable, Sendable {
    public var id: String
    public var usinaId: String
    public var mesReferencia: String
    @Number public var kwhGerado: Double
    public var alertaBaixaGeracao: Bool?
    public var observacoes: String?
    public var usina: Usina?
}

// MARK: - Detalhes do cliente (GET /api/clientes/:id/detalhes)

public struct ClienteDetalhes: Decodable, Sendable {
    public var cliente: Cliente
    public var usina: Usina?
    /// Do mais recente para o mais antigo.
    public var faturas: [Fatura]
    public var saldoAtual: Double
    public var mediaConsumo: Double
    public var mesesDuracaoSaldo: Double

    enum CodingKeys: String, CodingKey {
        case usina, faturas, saldoAtual, mediaConsumo, mesesDuracaoSaldo
    }

    public init(from decoder: Decoder) throws {
        // O servidor achata o cliente no nível de cima e soma os extras.
        cliente = try Cliente(from: decoder)
        let c = try decoder.container(keyedBy: CodingKeys.self)
        usina = try c.decodeIfPresent(Usina.self, forKey: .usina)
        faturas = try c.decodeIfPresent([Fatura].self, forKey: .faturas) ?? []
        saldoAtual = try c.decode(Number.self, forKey: .saldoAtual).wrappedValue
        mediaConsumo = try c.decode(Number.self, forKey: .mediaConsumo).wrappedValue
        mesesDuracaoSaldo = try c.decode(Number.self, forKey: .mesesDuracaoSaldo).wrappedValue
    }
}

// MARK: - Autenticação

public struct AuthTokens: Codable, Hashable, Sendable {
    public var accessToken: String
    public var refreshToken: String
    public var expiresIn: Int?

    public init(accessToken: String, refreshToken: String, expiresIn: Int? = nil) {
        self.accessToken = accessToken
        self.refreshToken = refreshToken
        self.expiresIn = expiresIn
    }
}

public enum UserRole: String, Codable, Sendable {
    case superAdmin = "super_admin"
    case admin
    case operador

    public var titulo: String {
        switch self {
        case .superAdmin: return "Super admin"
        case .admin: return "Administrador"
        case .operador: return "Operador"
        }
    }
}

public struct AuthUser: Codable, Hashable, Sendable {
    public struct Organization: Codable, Hashable, Sendable {
        public var id: String?
        public var name: String?
        public var slug: String?
    }

    public var id: String
    public var email: String
    public var firstName: String?
    public var lastName: String?
    public var organization: Organization?
    public var role: String

    public var roleConhecida: UserRole { UserRole(rawValue: role) ?? .operador }
    public var isAdmin: Bool { roleConhecida != .operador }

    public var nomeCompleto: String {
        let partes = [firstName, lastName].compactMap { $0?.trimmingCharacters(in: .whitespaces) }.filter { !$0.isEmpty }
        return partes.isEmpty ? email : partes.joined(separator: " ")
    }

    public var iniciais: String {
        let partes = nomeCompleto.split(separator: " ").prefix(2)
        let letras = partes.compactMap { $0.first.map(String.init) }.joined()
        return letras.isEmpty ? "?" : letras.uppercased()
    }
}

struct LoginResponse: Decodable {
    var user: AuthUser
    var tokens: AuthTokens
}

struct RefreshResponse: Decodable {
    var tokens: AuthTokens
}

struct GeneratePdfResponse: Decodable {
    var pdfUrl: String?
}
