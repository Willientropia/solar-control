import SwiftUI
import SolarCore

@main
struct SolarControlApp: App {
    @StateObject private var app = AppState()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(app)
                .tint(Theme.accent)
        }
    }
}

struct RootView: View {
    @EnvironmentObject private var app: AppState

    var body: some View {
        Group {
            switch app.fase {
            case .iniciando:
                ProgressView()
                    .controlSize(.large)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            case .login:
                LoginView()
                    .transition(.opacity)
            case .logado:
                MainTabView()
                    .transition(.opacity)
            }
        }
        .animation(.smooth(duration: 0.3), value: app.fase)
        .task { await app.iniciar() }
    }
}

struct MainTabView: View {
    @EnvironmentObject private var app: AppState
    @StateObject private var painel = PainelStore()

    var body: some View {
        TabView(selection: $app.abaSelecionada) {
            PainelView()
                .tabItem { Label("Painel", systemImage: "chart.bar.xaxis") }
                .tag(Aba.painel)

            FaturasView()
                .tabItem { Label("Faturas", systemImage: "doc.text") }
                .tag(Aba.faturas)

            ClientesView()
                .tabItem { Label("Clientes", systemImage: "person.2") }
                .tag(Aba.clientes)

            UsinasView()
                .tabItem { Label("Usinas", systemImage: "sun.max") }
                .tag(Aba.usinas)

            SimuladorView()
                .tabItem { Label("Simular", systemImage: "percent") }
                .tag(Aba.simular)
        }
        .environmentObject(painel)
    }
}
