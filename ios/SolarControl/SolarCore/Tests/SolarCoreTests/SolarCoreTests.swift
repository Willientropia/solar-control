import Foundation
#if canImport(FoundationNetworking)
import FoundationNetworking
#endif
import XCTest
@testable import SolarCore

final class NumbersTests: XCTestCase {
    struct Amostra: Decodable {
        @OptionalNumber var texto: Double?
        @OptionalNumber var numero: Double?
        @OptionalNumber var nulo: Double?
        @OptionalNumber var ausente: Double?
        @Number var obrigatorioNulo: Double
        @Number var obrigatorioAusente: Double
    }

    func testDecodificaTextoNumeroNuloEAusente() throws {
        let json = #"{"texto":"123.45","numero":7,"nulo":null,"obrigatorioNulo":null}"#
        let a = try JSONDecoder().decode(Amostra.self, from: Data(json.utf8))
        XCTAssertEqual(a.texto, 123.45)
        XCTAssertEqual(a.numero, 7)
        XCTAssertNil(a.nulo)
        XCTAssertNil(a.ausente)
        XCTAssertEqual(a.obrigatorioNulo, 0)
        XCTAssertEqual(a.obrigatorioAusente, 0)
    }

    func testTextoComVirgula() {
        XCTAssertEqual(parseDecimalText("12,5"), 12.5)
        XCTAssertNil(parseDecimalText(""))
        XCTAssertNil(parseDecimalText("abc"))
    }
}

final class ModelsTests: XCTestCase {
    func testFaturaComClienteDoJoin() throws {
        let json = #"""
        [{
          "id": "f1", "clienteId": "c1", "usinaId": "u1", "mesReferencia": "JAN/2026",
          "dataVencimento": "10/02/2026", "consumoScee": "350.00", "valorTotal": "412.90",
          "valorComDesconto": "309.68", "lucro": "120.10", "saldoKwh": null,
          "status": "aguardando_pagamento", "arquivoPdfUrl": "/api/faturas/pdf/Usina A/jan.pdf",
          "faturaGeradaUrl": null, "faturaClienteGeradaAt": "2026-02-01T12:00:00.000Z",
          "faturaClienteEnviadaAt": null, "faturaClienteRecebidaAt": null,
          "dadosExtraidos": {"qualquer": [1, 2, 3]},
          "incluirRelatorio": true, "createdAt": "2026-02-01T10:00:00.000Z",
          "cliente": {
            "id": "c1", "nome": "Maria", "unidadeConsumidora": "123",
            "unidadeConsumidoraNova": "9988", "usinaId": "u1", "desconto": "25.00",
            "isPagante": true, "ativo": true
          }
        }]
        """#
        let faturas = try JSONDecoder().decode([Fatura].self, from: Data(json.utf8))
        let f = try XCTUnwrap(faturas.first)
        XCTAssertEqual(f.consumoScee, 350)
        XCTAssertEqual(f.valorComDesconto, 309.68)
        XCTAssertNil(f.saldoKwh)
        XCTAssertNil(f.economia)
        XCTAssertEqual(f.statusConhecido, .aguardandoPagamento)
        XCTAssertEqual(f.cliente?.uc, "9988")
        XCTAssertEqual(f.cliente?.desconto, 25)

        let fluxo = FaturaFluxo(fatura: f, cliente: nil)
        XCTAssertEqual(fluxo.etapas.count, 5)
        XCTAssertTrue(fluxo.concluida(.upload))
        XCTAssertFalse(fluxo.concluida(.pago))
        XCTAssertTrue(fluxo.concluida(.gerada))
        XCTAssertEqual(fluxo.proximaEtapa, .pago)
        XCTAssertEqual(fluxo.concluidas, 2)
        XCTAssertFalse(fluxo.completa)
    }

    func testUsoProprioSoTemFluxoA() throws {
        let json = #"""
        {"id":"f2","clienteId":"c2","mesReferencia":"Fev/2026","status":"pago",
         "arquivoPdfUrl":"/x.pdf",
         "cliente":{"id":"c2","nome":"Usina própria","usinaId":"u1","isPagante":false,"ativo":true,"unidadeConsumidora":"55"}}
        """#
        let f = try JSONDecoder().decode(Fatura.self, from: Data(json.utf8))
        let fluxo = FaturaFluxo(fatura: f, cliente: nil)
        XCTAssertEqual(fluxo.etapas, [.upload, .pago])
        XCTAssertTrue(fluxo.completa)
        XCTAssertTrue(FaturaFiltro.completas.aceita(f))
        XCTAssertFalse(FaturaFiltro.pendentes.aceita(f))
    }

    func testClienteDetalhesAchatado() throws {
        let json = #"""
        {"id":"c1","nome":"Maria","usinaId":"u1","isPagante":true,"ativo":true,
         "unidadeConsumidora":"123","desconto":"20.00",
         "usina":{"id":"u1","nome":"Usina A","unidadeConsumidora":"777","producaoMensalPrevista":"5000.00","potenciaKwp":"40.500","descontoPadrao":"15.00"},
         "faturas":[],"saldoAtual":"1500.00","mediaConsumo":"300.00","mesesDuracaoSaldo":"5.0"}
        """#
        let d = try JSONDecoder().decode(ClienteDetalhes.self, from: Data(json.utf8))
        XCTAssertEqual(d.cliente.nome, "Maria")
        XCTAssertEqual(d.usina?.potenciaKwp, 40.5)
        XCTAssertEqual(d.saldoAtual, 1500)
        XCTAssertEqual(d.mesesDuracaoSaldo, 5)
    }

    func testDashboardMinimoDeServidorAntigo() throws {
        let json = #"""
        {"mesReferencia":"Jan/2026","totais":{"receita":1000,"custo":600,"lucro":400,"economia":250,
         "kwhDistribuido":3000,"usinas":2,"clientes":10,"clientesAtivos":9,"geracao":5000,
         "geracaoPrevista":5200,"performance":96.1,"saldoTotalKwh":800,"faturasEsperadas":9,
         "faturasRecebidas":8,"faturasSemPdf":1,"clientesSemFatura":1,"faturasFaltando":1,
         "faturasPendentesPagamento":2,"faturasEmAtraso":0,"aguardandoConfirmacao":null}}
        """#
        let d = try JSONDecoder().decode(DashboardOverview.self, from: Data(json.utf8))
        XCTAssertEqual(d.totais.lucro, 400)
        XCTAssertEqual(d.totais.aguardandoConfirmacao, 0)
        XCTAssertEqual(d.margem, 40)
        XCTAssertTrue(d.usinas.isEmpty)
        XCTAssertNil(d.variacoes.lucro)
    }

    func testPrecoLiquidoPorFaixa() throws {
        let json = #"{"mes":"Jan/2026","tabela":1.02,"fioB":0.12,"fioBHerdado":false,"liquido":{"25":0.645,"12.5":0.7725}}"#
        let p = try JSONDecoder().decode(DashboardPrecoMes.self, from: Data(json.utf8))
        XCTAssertEqual(p.liquido(desconto: 25), 0.645)
        XCTAssertEqual(p.liquido(desconto: 12.5), 0.7725)
        XCTAssertNil(p.liquido(desconto: 30))
    }

    func testAuthUser() throws {
        let json = #"{"id":"u","email":"a@b.com","firstName":"Pedro","lastName":"Silva","role":"admin","organization":{"id":"o","name":"Sol","slug":"sol"}}"#
        let u = try JSONDecoder().decode(AuthUser.self, from: Data(json.utf8))
        XCTAssertEqual(u.nomeCompleto, "Pedro Silva")
        XCTAssertEqual(u.iniciais, "PS")
        XCTAssertTrue(u.isAdmin)
        let semNome = try JSONDecoder().decode(AuthUser.self, from: Data(#"{"id":"u","email":"x@y.com","role":"operador"}"#.utf8))
        XCTAssertEqual(semNome.nomeCompleto, "x@y.com")
        XCTAssertFalse(semNome.isAdmin)
    }
}

final class MonthRefTests: XCTestCase {
    func testNormaliza() {
        XCTAssertEqual(MonthRef.normalize("DEZ/25"), "Dez/2025")
        XCTAssertEqual(MonthRef.normalize("jan/2026"), "Jan/2026")
        XCTAssertEqual(MonthRef.normalize("xyz"), "xyz")
        XCTAssertEqual(MonthRef.normalize(nil), "")
    }

    func testOrdenaEAvanca() {
        XCTAssertTrue(MonthRef.sortKey("Jan/2026") > MonthRef.sortKey("DEZ/2025"))
        XCTAssertEqual(MonthRef.add("Jan/2026", -1), "Dez/2025")
        XCTAssertEqual(MonthRef.add("Dez/2025", 1), "Jan/2026")
        XCTAssertEqual(MonthRef.short("Mar/2026"), "Mar/26")
        XCTAssertEqual(MonthRef.long("MAR/2026"), "Março de 2026")
        XCTAssertTrue(MonthRef.same("DEZ/2025", "Dez/25"))
        XCTAssertEqual(MonthRef.sortedDescending(["Jan/2026", "DEZ/2025", "JAN/2026", "Fev/2026"]),
                       ["Fev/2026", "Jan/2026", "Dez/2025"])
    }
}

final class FormattingTests: XCTestCase {
    func testMoedaEEnergia() {
        XCTAssertEqual(Fmt.brl(1234.5), "R$ 1.234,50")
        XCTAssertEqual(Fmt.brl(-10), "-R$ 10,00")
        XCTAssertEqual(Fmt.brl(nil), "—")
        XCTAssertEqual(Fmt.brlCompacto(12_345), "R$ 12,3 mil")
        XCTAssertEqual(Fmt.brlCompacto(2_500_000), "R$ 2,5 mi")
        XCTAssertEqual(Fmt.kwh(12345.6), "12.346 kWh")
        XCTAssertEqual(Fmt.percent(87.25), "87,3%")
        XCTAssertEqual(Fmt.variacao(12.5), "+12,5%")
        XCTAssertEqual(Fmt.variacao(-3), "-3%")
        XCTAssertEqual(Fmt.brlKwh(0.81234), "R$ 0,8123")
    }

    func testDatas() {
        XCTAssertEqual(Fmt.data("2026-02-01T12:00:00.000Z"), "01/02/2026")
        XCTAssertEqual(Fmt.dataHora("2026-02-01T12:00:00Z"), "01/02/2026 às 09:00")
        XCTAssertNil(Fmt.data(nil))
    }
}

// MARK: - Cliente HTTP

final class FakeTransport: HTTPTransport, @unchecked Sendable {
    var respostas: [(Int, String)]
    private(set) var requisicoes: [URLRequest] = []

    init(_ respostas: [(Int, String)]) { self.respostas = respostas }

    func send(_ request: URLRequest) async throws -> (Data, HTTPURLResponse) {
        requisicoes.append(request)
        let (status, corpo) = respostas.isEmpty ? (500, "{}") : respostas.removeFirst()
        let response = HTTPURLResponse(url: request.url!, statusCode: status, httpVersion: nil, headerFields: nil)!
        return (Data(corpo.utf8), response)
    }
}

final class APIClientTests: XCTestCase {
    let base = URL(string: "https://solar.exemplo.com")!

    func testNormalizaServidor() {
        XCTAssertEqual(APIClient.normalizarServidor("solar.exemplo.com/")?.absoluteString, "https://solar.exemplo.com")
        XCTAssertEqual(APIClient.normalizarServidor(" http://192.168.0.10:5000 ")?.absoluteString, "http://192.168.0.10:5000")
        XCTAssertNil(APIClient.normalizarServidor("   "))
    }

    func testLoginGuardaTokens() async throws {
        let store = MemoryTokenStore()
        let transport = FakeTransport([
            (200, #"{"user":{"id":"u","email":"a@b.com","role":"admin"},"tokens":{"accessToken":"A","refreshToken":"R","expiresIn":900}}"#),
        ])
        let api = APIClient(baseURL: base, tokenStore: store, transport: transport)
        let user = try await api.login(email: " a@b.com ", senha: "x")
        XCTAssertEqual(user.email, "a@b.com")
        XCTAssertEqual(store.load()?.accessToken, "A")
        XCTAssertEqual(transport.requisicoes.first?.url?.absoluteString, "https://solar.exemplo.com/api/auth/login")
        XCTAssertNil(transport.requisicoes.first?.value(forHTTPHeaderField: "Authorization"))
    }

    func testLoginInvalido() async {
        let api = APIClient(baseURL: base, tokenStore: MemoryTokenStore(), transport: FakeTransport([(401, #"{"error":"x"}"#)]))
        do {
            _ = try await api.login(email: "a", senha: "b")
            XCTFail("deveria falhar")
        } catch {
            XCTAssertEqual(error as? APIError, .credenciaisInvalidas)
        }
    }

    func testRenovaTokenERepete() async throws {
        let store = MemoryTokenStore(AuthTokens(accessToken: "velho", refreshToken: "R1"))
        let transport = FakeTransport([
            (401, #"{"message":"expirado"}"#),
            (200, #"{"tokens":{"accessToken":"novo","refreshToken":"R2"}}"#),
            (200, #"[{"id":"u1","nome":"Usina A","unidadeConsumidora":"1","producaoMensalPrevista":"100"}]"#),
        ])
        let api = APIClient(baseURL: base, tokenStore: store, transport: transport)
        let usinas = try await api.usinas()
        XCTAssertEqual(usinas.first?.producaoMensalPrevista, 100)
        XCTAssertEqual(store.load()?.accessToken, "novo")
        XCTAssertEqual(store.load()?.refreshToken, "R2")
        XCTAssertEqual(transport.requisicoes.count, 3)
        XCTAssertEqual(transport.requisicoes[0].value(forHTTPHeaderField: "Authorization"), "Bearer velho")
        XCTAssertEqual(transport.requisicoes[1].url?.path, "/api/auth/refresh")
        XCTAssertEqual(transport.requisicoes[2].value(forHTTPHeaderField: "Authorization"), "Bearer novo")
    }

    func testRefreshFalhoEncerraSessao() async {
        let store = MemoryTokenStore(AuthTokens(accessToken: "velho", refreshToken: "R1"))
        let transport = FakeTransport([(401, "{}"), (401, "{}")])
        let api = APIClient(baseURL: base, tokenStore: store, transport: transport)
        do {
            _ = try await api.usinas()
            XCTFail("deveria falhar")
        } catch {
            XCTAssertEqual(error as? APIError, .sessaoExpirada)
        }
        XCTAssertNil(store.load())
    }

    func testFiltrosDeFaturaEMensagemDeErro() async throws {
        let store = MemoryTokenStore(AuthTokens(accessToken: "A", refreshToken: "R"))
        let transport = FakeTransport([
            (200, "[]"),
            (403, #"{"message":"Apenas administradores podem marcar como Pago."}"#),
        ])
        let api = APIClient(baseURL: base, tokenStore: store, transport: transport)
        _ = try await api.faturas(mes: "Jan/2026", usinaId: "u1")
        let url = try XCTUnwrap(transport.requisicoes.first?.url)
        let comps = try XCTUnwrap(URLComponents(url: url, resolvingAgainstBaseURL: false))
        XCTAssertEqual(comps.queryItems?.first { $0.name == "mesReferencia" }?.value, "Jan/2026")
        XCTAssertEqual(comps.queryItems?.first { $0.name == "usinaId" }?.value, "u1")

        do {
            try await api.atualizarStatus(.pago, faturaId: "f1")
            XCTFail("deveria falhar")
        } catch {
            XCTAssertEqual(error as? APIError, .semPermissao("Apenas administradores podem marcar como Pago."))
        }
        let patch = transport.requisicoes[1]
        XCTAssertEqual(patch.httpMethod, "PATCH")
        XCTAssertEqual(patch.url?.path, "/api/faturas/f1/status")
    }

    func testCaminhoComEspacosNaoCodificaDuasVezes() async throws {
        let api = APIClient(baseURL: base, tokenStore: MemoryTokenStore(AuthTokens(accessToken: "A", refreshToken: "R")))
        let r1 = try await api.makeRequest("/api/faturas/pdf/Usina A/jan.pdf", method: "GET", body: nil)
        let r2 = try await api.makeRequest("/api/faturas/pdf/Usina%20A/jan.pdf", method: "GET", body: nil)
        XCTAssertEqual(r1.url, r2.url)
        XCTAssertEqual(r1.url?.absoluteString, "https://solar.exemplo.com/api/faturas/pdf/Usina%20A/jan.pdf")
    }
}
