import SwiftUI
import SolarCore

struct PerfilView: View {
    @EnvironmentObject private var app: AppState
    @Environment(\.dismiss) private var dismiss
    @State private var confirmandoSaida = false

    private var versao: String {
        let info = Bundle.main.infoDictionary
        let curta = info?["CFBundleShortVersionString"] as? String ?? "—"
        let build = info?["CFBundleVersion"] as? String
        return build.map { "\(curta) (\($0))" } ?? curta
    }

    var body: some View {
        NavigationStack {
            List {
                if let usuario = app.usuario {
                    Section {
                        HStack(spacing: 14) {
                            Text(usuario.iniciais)
                                .font(.title3.weight(.semibold))
                                .foregroundStyle(.white)
                                .frame(width: 56, height: 56)
                                .background(Theme.accent.gradient, in: .circle)
                            VStack(alignment: .leading, spacing: 2) {
                                Text(usuario.nomeCompleto)
                                    .font(.headline)
                                Text(usuario.email)
                                    .font(.subheadline)
                                    .foregroundStyle(.secondary)
                            }
                        }
                        .padding(.vertical, 4)
                    }

                    Section {
                        LinhaInfo(titulo: "Função", valor: usuario.roleConhecida.titulo)
                        if let org = usuario.organization?.name {
                            LinhaInfo(titulo: "Organização", valor: org)
                        }
                    }
                }

                Section("Servidor") {
                    LinhaInfo(titulo: "Endereço", valor: app.servidorURL?.host ?? app.servidor)
                    if let url = app.servidorURL {
                        Link(destination: url) {
                            Label("Abrir no Safari", systemImage: "safari")
                        }
                    }
                }

                Section {
                    LinhaInfo(titulo: "Versão", valor: versao)
                }

                Section {
                    Button("Sair", role: .destructive) {
                        confirmandoSaida = true
                    }
                    .frame(maxWidth: .infinity)
                }
            }
            .navigationTitle("Conta")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("OK") { dismiss() }
                }
            }
            .confirmationDialog("Sair do Solar Control?", isPresented: $confirmandoSaida, titleVisibility: .visible) {
                Button("Sair", role: .destructive) {
                    Task {
                        dismiss()
                        await app.sair()
                    }
                }
            } message: {
                Text("Você vai precisar do e-mail e da senha para entrar de novo.")
            }
        }
        .presentationDragIndicator(.visible)
    }
}
