import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Sun, Zap, TrendingUp, FileText, Shield, BarChart3 } from "lucide-react";

const features = [
  {
    icon: Zap,
    title: "Gestão de Usinas",
    description:
      "Cadastre e acompanhe a geração de energia das suas usinas solares em tempo real.",
  },
  {
    icon: FileText,
    title: "Processamento de Faturas",
    description:
      "Envie faturas da concessionária e gere automaticamente as faturas com desconto.",
  },
  {
    icon: TrendingUp,
    title: "Relatórios Financeiros",
    description:
      "Acompanhe lucros, economia dos clientes e saldo de créditos por período.",
  },
  {
    icon: Shield,
    title: "Controle de Acesso",
    description:
      "Gerencie operadores e administradores com diferentes níveis de permissão.",
  },
  {
    icon: BarChart3,
    title: "Histórico Completo",
    description:
      "Mantenha o histórico de todas as faturas e transações para auditoria.",
  },
  {
    icon: Sun,
    title: "Alertas Inteligentes",
    description:
      "Receba alertas quando a geração estiver abaixo do previsto.",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="fixed top-0 left-0 right-0 z-50 border-b bg-background/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Sun className="h-6 w-6" />
            </div>
            <span className="text-xl font-semibold">Sol Tech Energia</span>
          </div>
          <Button asChild data-testid="button-login-header">
            <a href="/api/login">Entrar</a>
          </Button>
        </div>
      </header>

      <main>
        <section className="pt-32 pb-20 px-4">
          <div className="max-w-7xl mx-auto">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <div className="space-y-8">
                <div className="space-y-4">
                  <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight">
                    Gestão inteligente de{" "}
                    <span className="text-primary">energia solar</span>
                  </h1>
                  <p className="text-xl text-muted-foreground max-w-lg">
                    Simplifique a gestão de faturas, acompanhe a geração das
                    suas usinas e maximize o retorno dos seus clientes.
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row gap-4">
                  <Button size="lg" asChild data-testid="button-login-hero">
                    <a href="/api/login">Começar Agora</a>
                  </Button>
                  <Button size="lg" variant="outline">
                    Saiba Mais
                  </Button>
                </div>
                <div className="flex items-center gap-6 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-green-500" />
                    Gratuito para começar
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-green-500" />
                    Sem cartão de crédito
                  </div>
                </div>
              </div>

              <div className="relative hidden lg:block">
                <div className="absolute -inset-4 bg-gradient-to-r from-primary/20 to-chart-3/20 rounded-3xl blur-3xl" />
                <Card className="relative bg-card/80 backdrop-blur border-2">
                  <CardContent className="p-8">
                    <div className="space-y-6">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground uppercase tracking-wider">
                          Resumo Mensal
                        </span>
                        <span className="text-sm font-medium">Jan/2026</span>
                      </div>
                      <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-1">
                          <p className="text-sm text-muted-foreground">
                            Energia Gerada
                          </p>
                          <p className="text-2xl font-bold font-mono text-primary">
                            12.450 kWh
                          </p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm text-muted-foreground">
                            Lucro Total
                          </p>
                          <p className="text-2xl font-bold font-mono text-green-600 dark:text-green-400">
                            R$ 4.280,00
                          </p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm text-muted-foreground">
                            Clientes Ativos
                          </p>
                          <p className="text-2xl font-bold font-mono">12</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm text-muted-foreground">
                            Faturas Processadas
                          </p>
                          <p className="text-2xl font-bold font-mono">48</p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </section>

        <section className="py-20 px-4 bg-muted/30">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold mb-4">
                Tudo que você precisa para gerenciar suas usinas
              </h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                Uma plataforma completa para gestão de créditos de energia solar,
                desde o cadastro de clientes até a geração de relatórios financeiros.
              </p>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {features.map((feature, index) => (
                <Card
                  key={index}
                  className="hover-elevate transition-all duration-200"
                >
                  <CardContent className="p-6">
                    <div className="flex h-12 w-12 items-center justify-center rounded-md bg-primary/10 text-primary mb-4">
                      <feature.icon className="h-6 w-6" />
                    </div>
                    <h3 className="text-lg font-semibold mb-2">
                      {feature.title}
                    </h3>
                    <p className="text-muted-foreground text-sm">
                      {feature.description}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section className="py-20 px-4">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl font-bold mb-4">
              Pronto para começar?
            </h2>
            <p className="text-muted-foreground mb-8">
              Cadastre-se gratuitamente e comece a gerenciar suas usinas e
              clientes de energia solar.
            </p>
            <Button size="lg" asChild data-testid="button-login-cta">
              <a href="/api/login">Criar Conta Gratuita</a>
            </Button>
          </div>
        </section>
      </main>

      <footer className="border-t py-8 px-4">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Sun className="h-5 w-5 text-primary" />
            <span className="font-medium">Sol Tech Energia</span>
          </div>
          <p className="text-sm text-muted-foreground">
            2026 Sol Tech Energia. Todos os direitos reservados.
          </p>
        </div>
      </footer>
    </div>
  );
}
