import UIKit
import SolarCore

/// Desenha o PDF de exemplo da simulação, em A4, no próprio aparelho.
/// Não depende do servidor: funciona sem internet depois de baixar a tarifa.
enum SimulacaoPDF {
    private static let pagina = CGRect(x: 0, y: 0, width: 595, height: 842) // A4 em pontos
    private static let margem: CGFloat = 40
    private static var largura: CGFloat { pagina.width - margem * 2 }

    private static let azul = UIColor(red: 0.04, green: 0.16, blue: 0.43, alpha: 1)
    private static let laranja = UIColor(red: 0.96, green: 0.55, blue: 0.10, alpha: 1)
    private static let verde = UIColor(red: 0.09, green: 0.52, blue: 0.27, alpha: 1)
    private static let verdeClaro = UIColor(red: 0.91, green: 0.97, blue: 0.93, alpha: 1)
    private static let cinza = UIColor(white: 0.42, alpha: 1)
    private static let cinzaClaro = UIColor(white: 0.96, alpha: 1)
    private static let borda = UIColor(white: 0.86, alpha: 1)

    static func gerar(_ s: Simulacao, em data: Date = Date()) throws -> URL {
        let formato = UIGraphicsPDFRendererFormat()
        formato.documentInfo = [
            kCGPDFContextTitle as String: "Simulação de economia",
            kCGPDFContextCreator as String: "Solar Control",
        ]
        let renderer = UIGraphicsPDFRenderer(bounds: pagina, format: formato)

        let pasta = FileManager.default.temporaryDirectory.appendingPathComponent("simulacoes", isDirectory: true)
        try FileManager.default.createDirectory(at: pasta, withIntermediateDirectories: true)
        let nome = "Simulação \(s.nomeCliente ?? Fmt.kwh(s.kwh))"
            .replacingOccurrences(of: "/", with: "-")
            .replacingOccurrences(of: ":", with: "-")
        let destino = pasta.appendingPathComponent(nome).appendingPathExtension("pdf")
        try? FileManager.default.removeItem(at: destino)

        try renderer.writePDF(to: destino) { contexto in
            contexto.beginPage()
            desenhar(s, data: data)
        }
        return destino
    }

    // MARK: Página

    private static func desenhar(_ s: Simulacao, data: Date) {
        var y = cabecalho(data: data)
        y = cliente(s, y: y + 28)
        y = destaque(s, y: y)
        y = comparacao(s, y: y + 16)
        y = tabela(s, y: y + 28)
        rodape(s)
    }

    private static func cabecalho(data: Date) -> CGFloat {
        let altura: CGFloat = 116
        azul.setFill()
        UIRectFill(CGRect(x: 0, y: 0, width: pagina.width, height: altura))
        laranja.setFill()
        UIRectFill(CGRect(x: 0, y: altura, width: pagina.width, height: 4))

        var xTexto = margem
        if let logo = logo() {
            let quadro = CGRect(x: margem, y: 22, width: 72, height: 72)
            UIGraphicsGetCurrentContext()?.saveGState()
            UIBezierPath(ovalIn: quadro).addClip()
            logo.draw(in: quadro)
            UIGraphicsGetCurrentContext()?.restoreGState()
            xTexto = quadro.maxX + 18
        }

        texto("Simulação de economia", .systemFont(ofSize: 24, weight: .bold), .white,
              CGRect(x: xTexto, y: 32, width: 330, height: 30))
        texto("Exemplo da sua conta de luz com desconto na energia", .systemFont(ofSize: 11), UIColor(white: 1, alpha: 0.8),
              CGRect(x: xTexto, y: 64, width: 330, height: 16))

        let selo = "SIMULAÇÃO"
        let fonteSelo = UIFont.systemFont(ofSize: 9, weight: .bold)
        let larguraSelo = (selo as NSString).size(withAttributes: [.font: fonteSelo, .kern: 1.2]).width + 20
        let caixaSelo = CGRect(x: pagina.width - margem - larguraSelo, y: 30, width: larguraSelo, height: 20)
        laranja.setFill()
        UIBezierPath(roundedRect: caixaSelo, cornerRadius: 10).fill()
        texto(selo, fonteSelo, .white, caixaSelo.insetBy(dx: 0, dy: 4), alinhamento: .center, kern: 1.2)

        texto(dataCurta(data), .systemFont(ofSize: 10), UIColor(white: 1, alpha: 0.8),
              CGRect(x: pagina.width - margem - 150, y: 60, width: 150, height: 14), alinhamento: .right)
        return altura + 4
    }

    private static func cliente(_ s: Simulacao, y inicio: CGFloat) -> CGFloat {
        guard s.nomeCliente != nil || s.endereco != nil else { return inicio }
        var y = inicio
        texto("PREPARADA PARA", .systemFont(ofSize: 9, weight: .semibold), cinza,
              CGRect(x: margem, y: y, width: largura, height: 12), kern: 1)
        y += 16
        if let nome = s.nomeCliente {
            y += texto(nome, .systemFont(ofSize: 15, weight: .semibold), .black,
                       CGRect(x: margem, y: y, width: largura, height: 40)) + 2
        }
        if let endereco = s.endereco {
            y += texto(endereco, .systemFont(ofSize: 11), cinza,
                       CGRect(x: margem, y: y, width: largura, height: 44))
        }
        return y + 24
    }

    private static func destaque(_ s: Simulacao, y: CGFloat) -> CGFloat {
        let caixa = CGRect(x: margem, y: y, width: largura, height: 112)
        verdeClaro.setFill()
        UIBezierPath(roundedRect: caixa, cornerRadius: 14).fill()

        let x = caixa.minX + 22
        let w = caixa.width - 44
        texto("Economia estimada", .systemFont(ofSize: 12, weight: .medium), verde,
              CGRect(x: x, y: caixa.minY + 18, width: w, height: 16))
        texto("\(Fmt.brl(s.economiaMensal)) por mês", .systemFont(ofSize: 30, weight: .bold), verde,
              CGRect(x: x, y: caixa.minY + 38, width: w, height: 38))
        texto("\(Fmt.brl(s.economiaAnual)) por ano, com \(Fmt.percent(s.desconto)) de desconto na energia",
              .systemFont(ofSize: 12), UIColor(white: 0.2, alpha: 1),
              CGRect(x: x, y: caixa.minY + 80, width: w, height: 16))
        return caixa.maxY
    }

    private static func comparacao(_ s: Simulacao, y: CGFloat) -> CGFloat {
        let espaco: CGFloat = 14
        let w = (largura - espaco) / 2
        let altura: CGFloat = 84
        caixaValor("Conta hoje", Fmt.brl(s.totalSemDesconto), "sem desconto",
                   CGRect(x: margem, y: y, width: w, height: altura), cor: cinza, riscado: true)
        caixaValor("Conta com desconto", Fmt.brl(s.totalComDesconto), "você paga",
                   CGRect(x: margem + w + espaco, y: y, width: w, height: altura), cor: laranja, riscado: false)
        return y + altura
    }

    private static func caixaValor(_ titulo: String, _ valor: String, _ legenda: String,
                                   _ caixa: CGRect, cor: UIColor, riscado: Bool) {
        let caminho = UIBezierPath(roundedRect: caixa.insetBy(dx: 0.75, dy: 0.75), cornerRadius: 12)
        caminho.lineWidth = 1.5
        cor.setStroke()
        caminho.stroke()

        let x = caixa.minX + 18
        let w = caixa.width - 36
        texto(titulo, .systemFont(ofSize: 11, weight: .semibold), cor, CGRect(x: x, y: caixa.minY + 14, width: w, height: 14))
        texto(valor, .systemFont(ofSize: 22, weight: .bold), riscado ? cinza : .black,
              CGRect(x: x, y: caixa.minY + 32, width: w, height: 28), riscado: riscado)
        texto(legenda, .systemFont(ofSize: 10), cinza, CGRect(x: x, y: caixa.minY + 60, width: w, height: 14))
    }

    private static func tabela(_ s: Simulacao, y inicio: CGFloat) -> CGFloat {
        var y = inicio
        texto("Como calculamos", .systemFont(ofSize: 14, weight: .semibold), .black,
              CGRect(x: margem, y: y, width: largura, height: 18))
        y += 26

        var linhas: [(String, String, Bool)] = [
            ("Consumo de energia", Fmt.kwh(s.kwh), false),
            ("Tarifa do kWh (\(MonthRef.long(s.mesTarifa)))", Fmt.brlKwh(s.tarifa), false),
            ("Energia (consumo × tarifa)", Fmt.brl(s.valorEnergia), false),
            ("Desconto de \(Fmt.percent(s.desconto)) na energia", "− \(Fmt.brl(s.valorDesconto))", false),
        ]
        if s.iluminacao > 0 {
            linhas.append(("Iluminação pública", Fmt.brl(s.iluminacao), false))
        }
        linhas.append(("Total com desconto", Fmt.brl(s.totalComDesconto), true))

        let alturaLinha: CGFloat = 28
        for (indice, linha) in linhas.enumerated() {
            let faixa = CGRect(x: margem, y: y, width: largura, height: alturaLinha)
            if linha.2 {
                azul.setFill()
                UIBezierPath(roundedRect: faixa, cornerRadius: 6).fill()
            } else if indice % 2 == 0 {
                cinzaClaro.setFill()
                UIBezierPath(roundedRect: faixa, cornerRadius: 6).fill()
            }
            let cor: UIColor = linha.2 ? .white : .black
            let fonte = UIFont.systemFont(ofSize: 11, weight: linha.2 ? .semibold : .regular)
            let fonteValor = UIFont.monospacedDigitSystemFont(ofSize: 11, weight: linha.2 ? .bold : .medium)
            texto(linha.0, fonte, cor, CGRect(x: faixa.minX + 12, y: faixa.minY + 7, width: largura * 0.65, height: 15))
            texto(linha.1, fonteValor, cor,
                  CGRect(x: faixa.maxX - 12 - largura * 0.33, y: faixa.minY + 7, width: largura * 0.33, height: 15),
                  alinhamento: .right)
            y += alturaLinha
        }
        return y
    }

    private static func rodape(_ s: Simulacao) {
        let y = pagina.height - margem - 52
        borda.setFill()
        UIRectFill(CGRect(x: margem, y: y, width: largura, height: 1))
        let aviso = "Simulação ilustrativa, sem valor de cobrança. Calculada com a tarifa de "
            + "\(MonthRef.long(s.mesTarifa)) (\(Fmt.brlKwh(s.tarifa)) por kWh, com impostos). "
            + "A fatura real pode variar com a bandeira tarifária, a taxa mínima da concessionária, "
            + "os impostos e o consumo de cada mês."
        texto(aviso, .systemFont(ofSize: 8.5), cinza, CGRect(x: margem, y: y + 10, width: largura, height: 44))
    }

    // MARK: Auxiliares

    /// Desenha o texto e devolve a altura ocupada.
    @discardableResult
    private static func texto(_ conteudo: String, _ fonte: UIFont, _ cor: UIColor, _ caixa: CGRect,
                              alinhamento: NSTextAlignment = .left, kern: CGFloat = 0, riscado: Bool = false) -> CGFloat {
        let paragrafo = NSMutableParagraphStyle()
        paragrafo.alignment = alinhamento
        paragrafo.lineBreakMode = .byWordWrapping
        var atributos: [NSAttributedString.Key: Any] = [
            .font: fonte,
            .foregroundColor: cor,
            .paragraphStyle: paragrafo,
        ]
        if kern != 0 { atributos[.kern] = kern }
        if riscado {
            atributos[.strikethroughStyle] = NSUnderlineStyle.single.rawValue
            atributos[.strikethroughColor] = cor
        }
        let atribuido = NSAttributedString(string: conteudo, attributes: atributos)
        let opcoes: NSStringDrawingOptions = [.usesLineFragmentOrigin, .usesFontLeading]
        atribuido.draw(with: caixa, options: opcoes, context: nil)
        let medida = atribuido.boundingRect(with: CGSize(width: caixa.width, height: .greatestFiniteMagnitude),
                                        options: opcoes, context: nil)
        return min(ceil(medida.height), caixa.height)
    }

    private static func logo() -> UIImage? {
        guard let caminho = Bundle.main.path(forResource: "logo", ofType: "png") else { return nil }
        return UIImage(contentsOfFile: caminho)
    }

    private static func dataCurta(_ data: Date) -> String {
        let f = DateFormatter()
        f.locale = Locale(identifier: "pt_BR")
        f.dateFormat = "dd/MM/yyyy"
        return "Gerada em \(f.string(from: data))"
    }
}
