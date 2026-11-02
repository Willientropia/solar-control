import Foundation
import SwiftUI
import SolarCore

enum Aba: Hashable {
    case painel, faturas, clientes, usinas, simular
}

/// Estado global: servidor, sessão e usuário logado.
@MainActor
final class AppState: ObservableObject {
    enum Fase: Equatable {
        case iniciando, login, logado
    }

    @Published private(set) var fase: Fase = .iniciando
    @Published private(set) var usuario: AuthUser?
    @Published var abaSelecionada: Aba = .painel
    /// Mensagem mostrada na tela de login quando a sessão cai.
    @Published var avisoLogin: String?

    @Published var servidor: String {
        didSet { UserDefaults.standard.set(servidor, forKey: "servidor") }
    }
    @Published var ultimoEmail: String {
        didSet { UserDefaults.standard.set(ultimoEmail, forKey: "ultimoEmail") }
    }

    let api: APIClient
    private let tokens: KeychainTokenStore

    init() {
        let salvo = UserDefaults.standard.string(forKey: "servidor") ?? ""
        let store = KeychainTokenStore()
        servidor = salvo
        ultimoEmail = UserDefaults.standard.string(forKey: "ultimoEmail") ?? ""
        tokens = store
        api = APIClient(baseURL: APIClient.normalizarServidor(salvo), tokenStore: store)
    }

    var servidorURL: URL? { APIClient.normalizarServidor(servidor) }

    /// Com tokens no Keychain, valida a sessão em /api/auth/me.
    func iniciar() async {
        guard fase == .iniciando else { return }
        guard tokens.load() != nil, servidorURL != nil else {
            fase = .login
            return
        }
        do {
            usuario = try await api.me()
            fase = .logado
        } catch APIError.sessaoExpirada {
            fase = .login
        } catch {
            // Sem rede na abertura: entra mesmo assim, cada tela mostra o erro
            // e tenta de novo no pull-to-refresh.
            fase = .logado
        }
    }

    func entrar(servidor texto: String, email: String, senha: String) async throws {
        guard let url = APIClient.normalizarServidor(texto) else {
            throw APIError.urlInvalida
        }
        await api.setBaseURL(url)
        let user = try await api.login(email: email, senha: senha)
        servidor = url.absoluteString
        ultimoEmail = email.trimmingCharacters(in: .whitespaces)
        usuario = user
        avisoLogin = nil
        abaSelecionada = .painel
        fase = .logado
    }

    func sair() async {
        await api.logout()
        usuario = nil
        fase = .login
    }

    /// Converte um erro em texto para a tela. Sessão expirada volta ao login.
    func mensagem(para erro: Error) -> String? {
        if erro is CancellationError { return nil }
        if let api = erro as? APIError {
            if api == .sessaoExpirada {
                avisoLogin = api.errorDescription
                usuario = nil
                fase = .login
                return nil
            }
            return api.errorDescription
        }
        return erro.localizedDescription
    }
}
