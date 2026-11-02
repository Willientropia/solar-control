# Solar Control para iOS

App nativo em SwiftUI para o iPhone (e iPad). Usa a mesma API do sistema web,
com o mesmo login. Não precisa mexer no servidor.

| Aba | O que tem |
|---|---|
| **Painel** | Lucro, receita, geração, economia, custo e saldo do mês, com variação sobre o mês anterior. Progresso das faturas, pendências, gráfico de receita e lucro, usinas, maiores saldos e preço do kWh por faixa de desconto. Troca de mês no canto superior. |
| **Faturas** | Faturas do mês agrupadas por usina, com busca por cliente ou UC e filtros *Pendentes* e *Completas*. Deslize a linha para a esquerda para marcar a próxima etapa (Gerada → Enviada → Recebida). No detalhe: andamento das 5 etapas, PDF da concessionária, gerar a fatura com desconto, valores e energia. Administradores mudam o status da conta da concessionária. |
| **Clientes** | Lista por usina, com busca por nome, UC ou contrato. No detalhe: saldo de crédito, média de consumo, quanto o saldo dura, gráfico de consumo, contrato, endereço e histórico de faturas. |
| **Usinas** | Cartões com performance, lucro, geração e faturas. No detalhe: gráfico de geração contra a prevista, pendências e clientes da usina. |
| **Simular** | Para mostrar a economia a um cliente na rua. Digite o consumo em kWh e o desconto; iluminação pública, nome e endereço são opcionais. O app aplica a tarifa do mês (página Preços kWh) e gera um PDF de exemplo, marcado como simulação, para mostrar ou mandar pelo WhatsApp. |

O botão com as iniciais, no Painel, mostra a conta, o servidor e o botão Sair.

## Estrutura

```text
ios/SolarControl/
├── Package.swift          app (xtool: um único library product)
├── xtool.yml              bundle ID, ícone e recursos
├── Info.plist             nome, versão, idioma, App Transport Security
├── Recursos/              icone.png (1024×1024) e logo.png
├── Sources/SolarControl/  telas em SwiftUI + Keychain
├── SolarCore/             modelos, cliente HTTP e regras, sem SwiftUI
│   └── Tests/             roda com `swift test` no Linux
└── instalar.sh            copia para o Ubuntu, compila e instala
```

Tudo que pode ser testado fora do iPhone fica no `SolarCore`: decodificação
dos JSON (inclusive os `decimal` que o Postgres devolve como texto), renovação
do token, formatação em pt-BR, meses ("DEZ/25" = "Dez/2025") e o fluxo da
fatura.

## Instalar no iPhone

Siga o guia `instalar-app-ios-xtool.md` para o ambiente (WSL, Swift 6.4, xtool,
SDK, `xtool setup`, iTunes e a ponte). Depois, no Ubuntu:

```bash
cd /mnt/c/caminho/do/solar-control/ios/SolarControl
bash instalar.sh test     # testes do núcleo
bash instalar.sh build    # só compila, sem iPhone
bash instalar.sh          # compila, assina e instala (iTunes aberto)
```

Sucesso é `[Installing] 100%`, `[Verifying] 100%` e `exit=0`. Na primeira
abertura, confie no desenvolvedor em *Ajustes > Geral > VPN e Gerenciamento de
Dispositivos*. Com Apple ID grátis, a assinatura vale 7 dias: rode
`bash instalar.sh` de novo para renovar.

## Primeiro acesso

Na tela de login, informe o endereço do Solar Control (o mesmo do navegador),
o e-mail e a senha. O endereço e o e-mail ficam salvos; os tokens ficam no
Keychain. O access token dura 15 minutos e o app o renova sozinho com o refresh
token (7 dias). Depois disso, pede a senha de novo.

**HTTPS:** o iOS bloqueia `http://` na internet. O app aceita HTTP só na rede
local (IP `192.168.x.x` ou nome `.local`). Se o servidor estiver em
`http://IP-do-VPS:5000`, coloque um proxy com HTTPS na frente (Caddy ou Nginx
com Let's Encrypt). O app avisa quando for esse o problema.

## Conta da simulação

```text
energia      = kWh × tarifa do mês
sem desconto = energia + iluminação pública
com desconto = energia × (1 − desconto) + iluminação pública
economia     = energia × desconto        (× 12 para o ano)
```

A tarifa é a do mês atual em Preços kWh; sem cadastro no mês, a última
cadastrada. O app guarda a última tarifa baixada e a usa sem internet. Se não
houver nenhuma, deixa digitar a tarifa à mão. O PDF é desenhado no próprio
iPhone, sem passar pelo servidor.

## Limites desta versão

- Upload de fatura (leitura do PDF), cadastro e edição de clientes e usinas,
  preços do kWh, relatórios, auditoria e usuários continuam na web.
- O app só lê e marca etapas: não apaga nada.
