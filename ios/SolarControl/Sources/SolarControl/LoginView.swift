import SwiftUI
import UIKit
import SolarCore

struct LoginView: View {
    @EnvironmentObject private var app: AppState

    @State private var servidor = ""
    @State private var email = ""
    @State private var senha = ""
    @State private var entrando = false
    @State private var erro: String?
    @State private var editandoServidor = false
    @FocusState private var foco: Campo?

    enum Campo { case servidor, email, senha }

    private var podeEntrar: Bool {
        APIClient.normalizarServidor(servidor) != nil && !email.isEmpty && !senha.isEmpty && !entrando
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    VStack(spacing: 12) {
                        LogoView()
                            .frame(width: 96, height: 96)
                        Text("Solar Control")
                            .font(.largeTitle.bold())
                        Text("Gestão das usinas, clientes e faturas")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                            .multilineTextAlignment(.center)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 8)
                    .listRowBackground(Color.clear)
                }

                if let aviso = app.avisoLogin {
                    Section {
                        Label(aviso, systemImage: "clock.badge.exclamationmark")
                            .foregroundStyle(.orange)
                    }
                }

                Section {
                    TextField("E-mail", text: $email)
                        .textContentType(.username)
                        .keyboardType(.emailAddress)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .focused($foco, equals: .email)
                        .submitLabel(.next)
                        .onSubmit { foco = .senha }
                    SecureField("Senha", text: $senha)
                        .textContentType(.password)
                        .focused($foco, equals: .senha)
                        .submitLabel(.go)
                        .onSubmit { Task { await entrar() } }
                }

                Section {
                    if editandoServidor || servidor.isEmpty {
                        TextField("https://solar.suaempresa.com.br", text: $servidor)
                            .keyboardType(.URL)
                            .textContentType(.URL)
                            .textInputAutocapitalization(.never)
                            .autocorrectionDisabled()
                            .focused($foco, equals: .servidor)
                            .submitLabel(.next)
                            .onSubmit { foco = .email }
                    } else {
                        Button {
                            editandoServidor = true
                            foco = .servidor
                        } label: {
                            LabeledContent("Servidor") {
                                Text(APIClient.normalizarServidor(servidor)?.host ?? servidor)
                                    .foregroundStyle(.secondary)
                            }
                        }
                        .tint(.primary)
                    }
                } header: {
                    Text("Servidor")
                } footer: {
                    Text("Endereço do Solar Control, o mesmo que você abre no navegador.")
                }

                if let erro {
                    Section {
                        Label(erro, systemImage: "exclamationmark.triangle.fill")
                            .foregroundStyle(.red)
                    }
                }

                Section {
                    Button {
                        Task { await entrar() }
                    } label: {
                        HStack {
                            Spacer()
                            if entrando {
                                ProgressView()
                            } else {
                                Text("Entrar").fontWeight(.semibold)
                            }
                            Spacer()
                        }
                    }
                    .disabled(!podeEntrar)
                }
            }
            .scrollDismissesKeyboard(.interactively)
            .sensoryFeedback(.error, trigger: erro) { _, novo in novo != nil }
        }
        .onAppear {
            servidor = app.servidor
            email = app.ultimoEmail
            foco = servidor.isEmpty ? .servidor : (email.isEmpty ? .email : .senha)
        }
    }

    private func entrar() async {
        guard podeEntrar else { return }
        foco = nil
        entrando = true
        erro = nil
        defer { entrando = false }
        do {
            try await app.entrar(servidor: servidor, email: email, senha: senha)
        } catch {
            self.erro = app.mensagem(para: error)
        }
    }
}

/// Logo do app (Recursos/logo.png). Sem o arquivo, desenha um sol.
struct LogoView: View {
    private static let imagem: UIImage? = {
        guard let caminho = Bundle.main.path(forResource: "logo", ofType: "png") else { return nil }
        return UIImage(contentsOfFile: caminho)
    }()

    var body: some View {
        if let imagem = Self.imagem {
            Image(uiImage: imagem)
                .resizable()
                .scaledToFit()
                .clipShape(.circle)
                .accessibilityHidden(true)
        } else {
            Image(systemName: "sun.max.fill")
                .resizable()
                .scaledToFit()
                .foregroundStyle(Theme.accent)
                .padding(12)
                .accessibilityHidden(true)
        }
    }
}
