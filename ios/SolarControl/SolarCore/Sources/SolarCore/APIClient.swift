import Foundation
#if canImport(FoundationNetworking)
import FoundationNetworking
#endif

// MARK: - Erros

public enum APIError: Error, LocalizedError, Equatable {
    case servidorNaoConfigurado
    case urlInvalida
    case sessaoExpirada
    case credenciaisInvalidas
    case semPermissao(String?)
    case naoEncontrado
    case servidor(status: Int, mensagem: String?)
    case resposta(String)
    case rede(String)
    case httpsObrigatorio

    public var errorDescription: String? {
        switch self {
        case .servidorNaoConfigurado:
            return "Informe o endereço do servidor."
        case .urlInvalida:
            return "Endereço do servidor inválido."
        case .sessaoExpirada:
            return "Sua sessão expirou. Entre de novo."
        case .credenciaisInvalidas:
            return "E-mail ou senha incorretos."
        case .semPermissao(let mensagem):
            return mensagem ?? "Você não tem permissão para esta ação."
        case .naoEncontrado:
            return "Registro não encontrado."
        case .servidor(let status, let mensagem):
            return mensagem ?? "O servidor respondeu com erro \(status)."
        case .resposta(let detalhe):
            return "Resposta inesperada do servidor. \(detalhe)"
        case .rede(let detalhe):
            return "Sem conexão com o servidor. \(detalhe)"
        case .httpsObrigatorio:
            return "O iPhone só aceita servidores com HTTPS. Use o endereço https:// do Solar Control."
        }
    }
}

// MARK: - Dependências injetáveis

/// Onde os tokens ficam. No app é o Keychain; nos testes, memória.
public protocol TokenStore: AnyObject {
    func load() -> AuthTokens?
    func save(_ tokens: AuthTokens?)
}

public final class MemoryTokenStore: TokenStore {
    private var tokens: AuthTokens?
    public init(_ tokens: AuthTokens? = nil) { self.tokens = tokens }
    public func load() -> AuthTokens? { tokens }
    public func save(_ tokens: AuthTokens?) { self.tokens = tokens }
}

/// Camada de transporte, para testar o cliente sem rede.
public protocol HTTPTransport {
    func send(_ request: URLRequest) async throws -> (Data, HTTPURLResponse)
}

public struct URLSessionTransport: HTTPTransport {
    let session: URLSession

    public init(session: URLSession = .shared) {
        self.session = session
    }

    public func send(_ request: URLRequest) async throws -> (Data, HTTPURLResponse) {
        // dataTask + continuation funciona igual no iOS e no Linux.
        try await withCheckedThrowingContinuation { continuation in
            let task = session.dataTask(with: request) { data, response, error in
                if let error {
                    // -1022: o App Transport Security bloqueou um http:// fora da rede local.
                    if (error as NSError).code == -1022 {
                        continuation.resume(throwing: APIError.httpsObrigatorio)
                    } else {
                        continuation.resume(throwing: APIError.rede(error.localizedDescription))
                    }
                    return
                }
                guard let http = response as? HTTPURLResponse else {
                    continuation.resume(throwing: APIError.resposta("Sem resposta HTTP."))
                    return
                }
                continuation.resume(returning: (data ?? Data(), http))
            }
            task.resume()
        }
    }
}

// MARK: - Cliente

/// Cliente da API do Solar Control.
///
/// Autentica com o JWT de /api/auth/login. Quando o access token (15 min)
/// expira, troca pelo refresh token uma única vez e repete a chamada; se o
/// refresh também falhar, apaga os tokens e lança `.sessaoExpirada`.
public actor APIClient {
    public private(set) var baseURL: URL?
    private let transport: HTTPTransport
    private let tokenStore: TokenStore
    private var refreshEmAndamento: Task<AuthTokens?, Never>?

    public init(baseURL: URL?, tokenStore: TokenStore, transport: HTTPTransport = URLSessionTransport()) {
        self.baseURL = baseURL
        self.tokenStore = tokenStore
        self.transport = transport
    }

    public func setBaseURL(_ url: URL?) {
        baseURL = url
    }

    public var temSessao: Bool { tokenStore.load() != nil }

    /// "solar.exemplo.com" -> "https://solar.exemplo.com". Tira a barra final.
    public static func normalizarServidor(_ texto: String) -> URL? {
        var t = texto.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !t.isEmpty else { return nil }
        if !t.lowercased().hasPrefix("http://") && !t.lowercased().hasPrefix("https://") {
            t = "https://" + t
        }
        while t.hasSuffix("/") { t.removeLast() }
        guard let url = URL(string: t), let host = url.host, !host.isEmpty else { return nil }
        return url
    }

    // MARK: Autenticação

    public func login(email: String, senha: String) async throws -> AuthUser {
        struct Body: Encodable { let email: String; let password: String }
        let body = try JSONEncoder().encode(Body(email: email.trimmingCharacters(in: .whitespaces), password: senha))
        let request = try makeRequest("/api/auth/login", method: "POST", body: body, autenticado: false)
        let (data, response) = try await transport.send(request)
        if response.statusCode == 401 { throw APIError.credenciaisInvalidas }
        try checar(response, data)
        let login: LoginResponse = try decodificar(data)
        tokenStore.save(login.tokens)
        return login.user
    }

    /// Invalida o refresh token no servidor (melhor esforço) e apaga local.
    public func logout() async {
        if let tokens = tokenStore.load() {
            struct Body: Encodable { let refreshToken: String }
            if let body = try? JSONEncoder().encode(Body(refreshToken: tokens.refreshToken)),
               var request = try? makeRequest("/api/auth/logout", method: "POST", body: body, autenticado: false) {
                request.setValue("Bearer \(tokens.accessToken)", forHTTPHeaderField: "Authorization")
                _ = try? await transport.send(request)
            }
        }
        tokenStore.save(nil)
    }

    public func me() async throws -> AuthUser {
        try await get("/api/auth/me")
    }

    // MARK: Leitura

    public func dashboard(mes: String? = nil) async throws -> DashboardOverview {
        var query: [URLQueryItem] = []
        if let mes, !mes.isEmpty { query.append(URLQueryItem(name: "mes", value: mes)) }
        return try await get("/api/dashboard/overview", query: query)
    }

    public func usinas() async throws -> [Usina] {
        try await get("/api/usinas")
    }

    public func clientes() async throws -> [Cliente] {
        try await get("/api/clientes")
    }

    public func clienteDetalhes(id: String) async throws -> ClienteDetalhes {
        try await get("/api/clientes/\(id)/detalhes")
    }

    public func faturas(mes: String? = nil, usinaId: String? = nil, status: String? = nil) async throws -> [Fatura] {
        var query: [URLQueryItem] = []
        if let mes, !mes.isEmpty { query.append(URLQueryItem(name: "mesReferencia", value: mes)) }
        if let usinaId, !usinaId.isEmpty { query.append(URLQueryItem(name: "usinaId", value: usinaId)) }
        if let status, !status.isEmpty { query.append(URLQueryItem(name: "status", value: status)) }
        return try await get("/api/faturas", query: query)
    }

    public func fatura(id: String) async throws -> Fatura {
        try await get("/api/faturas/\(id)")
    }

    public func geracoes() async throws -> [GeracaoMensal] {
        try await get("/api/geracao")
    }

    // MARK: Escrita

    /// Avança ou desfaz uma etapa do fluxo B (gerada, enviada, recebida).
    @discardableResult
    public func executar(_ acao: FaturaAcao, faturaId: String) async throws -> Fatura {
        try await send("/api/faturas/\(faturaId)/\(acao.rawValue)", method: "PATCH", body: nil)
    }

    /// Muda o status da conta da concessionária. "pago" só para admin.
    @discardableResult
    public func atualizarStatus(_ status: FaturaStatus, faturaId: String) async throws -> Fatura {
        struct Body: Encodable { let status: String }
        let body = try JSONEncoder().encode(Body(status: status.rawValue))
        return try await send("/api/faturas/\(faturaId)/status", method: "PATCH", body: body)
    }

    // MARK: Arquivos

    /// Baixa o PDF original da concessionária para um arquivo temporário.
    public func baixarPdfOriginal(_ fatura: Fatura) async throws -> URL {
        guard let caminho = fatura.arquivoPdfUrl, !caminho.isEmpty else { throw APIError.naoEncontrado }
        let nome = "Fatura \(fatura.cliente?.nome ?? fatura.clienteId) \(MonthRef.normalize(fatura.mesReferencia))"
        return try await baixar(caminho, nomeArquivo: nome)
    }

    /// Gera no servidor a fatura com desconto e baixa o PDF.
    public func gerarPdfCliente(_ fatura: Fatura) async throws -> URL {
        let request = try makeRequest("/api/faturas/\(fatura.id)/generate-pdf", method: "POST", body: nil)
        let data = try await executarComRefresh(request)
        let resposta: GeneratePdfResponse = try decodificar(data)
        guard let pdfUrl = resposta.pdfUrl, let arquivo = pdfUrl.split(separator: "/").last else {
            throw APIError.resposta("O servidor não devolveu o PDF.")
        }
        let nome = "Fatura com desconto \(fatura.cliente?.nome ?? "") \(MonthRef.normalize(fatura.mesReferencia))"
        return try await baixar("/api/faturas/generated/\(arquivo)", nomeArquivo: nome)
    }

    func baixar(_ caminho: String, nomeArquivo: String) async throws -> URL {
        let request = try makeRequest(caminho, method: "GET", body: nil)
        let data = try await executarComRefresh(request)
        let seguro = nomeArquivo
            .replacingOccurrences(of: "/", with: "-")
            .replacingOccurrences(of: ":", with: "-")
            .trimmingCharacters(in: .whitespaces)
        let pasta = FileManager.default.temporaryDirectory.appendingPathComponent("pdfs", isDirectory: true)
        try? FileManager.default.createDirectory(at: pasta, withIntermediateDirectories: true)
        let destino = pasta.appendingPathComponent(seguro.isEmpty ? "fatura" : seguro).appendingPathExtension("pdf")
        try? FileManager.default.removeItem(at: destino)
        try data.write(to: destino, options: .atomic)
        return destino
    }

    // MARK: Infra

    private func get<T: Decodable>(_ path: String, query: [URLQueryItem] = []) async throws -> T {
        let request = try makeRequest(path, method: "GET", query: query, body: nil)
        return try decodificar(try await executarComRefresh(request))
    }

    private func send<T: Decodable>(_ path: String, method: String, body: Data?) async throws -> T {
        let request = try makeRequest(path, method: method, body: body)
        return try decodificar(try await executarComRefresh(request))
    }

    func makeRequest(_ path: String, method: String, query: [URLQueryItem] = [], body: Data?, autenticado: Bool = true) throws -> URLRequest {
        guard let baseURL else { throw APIError.servidorNaoConfigurado }
        guard var comps = URLComponents(url: baseURL, resolvingAgainstBaseURL: false) else { throw APIError.urlInvalida }

        // `path` pode vir do banco já com %20; desfaz antes para não codificar duas vezes.
        let caminho = path.removingPercentEncoding ?? path
        let base = comps.path.hasSuffix("/") ? String(comps.path.dropLast()) : comps.path
        comps.path = base + (caminho.hasPrefix("/") ? caminho : "/" + caminho)
        comps.queryItems = query.isEmpty ? nil : query
        guard let url = comps.url else { throw APIError.urlInvalida }

        var request = URLRequest(url: url, timeoutInterval: 60)
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        if let body {
            request.httpBody = body
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        }
        if autenticado, let token = tokenStore.load()?.accessToken {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        return request
    }

    private func executarComRefresh(_ request: URLRequest) async throws -> Data {
        guard tokenStore.load() != nil else { throw APIError.sessaoExpirada }

        var (data, response) = try await transport.send(request)
        if response.statusCode == 401 {
            guard let novos = await renovarTokens() else {
                tokenStore.save(nil)
                throw APIError.sessaoExpirada
            }
            var repetida = request
            repetida.setValue("Bearer \(novos.accessToken)", forHTTPHeaderField: "Authorization")
            (data, response) = try await transport.send(repetida)
            if response.statusCode == 401 {
                tokenStore.save(nil)
                throw APIError.sessaoExpirada
            }
        }
        try checar(response, data)
        return data
    }

    /// Chamadas paralelas que recebem 401 compartilham um único refresh.
    private func renovarTokens() async -> AuthTokens? {
        if let emAndamento = refreshEmAndamento {
            return await emAndamento.value
        }
        guard let refreshToken = tokenStore.load()?.refreshToken else { return nil }

        let task = Task<AuthTokens?, Never> { [transport] in
            struct Body: Encodable { let refreshToken: String }
            guard let body = try? JSONEncoder().encode(Body(refreshToken: refreshToken)),
                  let request = try? self.makeRequest("/api/auth/refresh", method: "POST", body: body, autenticado: false),
                  let resultado = try? await transport.send(request),
                  resultado.1.statusCode == 200,
                  let decoded = try? JSONDecoder().decode(RefreshResponse.self, from: resultado.0)
            else { return nil }
            return decoded.tokens
        }
        refreshEmAndamento = task
        let novos = await task.value
        refreshEmAndamento = nil
        if let novos { tokenStore.save(novos) }
        return novos
    }

    private func checar(_ response: HTTPURLResponse, _ data: Data) throws {
        guard !(200..<300).contains(response.statusCode) else { return }
        let mensagem = Self.mensagemDeErro(data)
        switch response.statusCode {
        case 401: throw APIError.sessaoExpirada
        case 403: throw APIError.semPermissao(mensagem)
        case 404: throw APIError.naoEncontrado
        default: throw APIError.servidor(status: response.statusCode, mensagem: mensagem)
        }
    }

    static func mensagemDeErro(_ data: Data) -> String? {
        struct Corpo: Decodable { let message: String?; let error: String? }
        guard let corpo = try? JSONDecoder().decode(Corpo.self, from: data) else { return nil }
        return corpo.message ?? corpo.error
    }

    private func decodificar<T: Decodable>(_ data: Data) throws -> T {
        do {
            return try JSONDecoder().decode(T.self, from: data)
        } catch let DecodingError.keyNotFound(key, ctx) {
            throw APIError.resposta("Campo ausente: \(Self.caminho(ctx.codingPath + [key])).")
        } catch let DecodingError.typeMismatch(_, ctx) {
            throw APIError.resposta("Tipo inesperado em \(Self.caminho(ctx.codingPath)).")
        } catch let DecodingError.valueNotFound(_, ctx) {
            throw APIError.resposta("Valor nulo em \(Self.caminho(ctx.codingPath)).")
        } catch {
            throw APIError.resposta(error.localizedDescription)
        }
    }

    private static func caminho(_ keys: [CodingKey]) -> String {
        keys.map { $0.intValue.map { "[\($0)]" } ?? $0.stringValue }.joined(separator: ".")
    }
}
