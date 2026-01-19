import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { AuthProvider } from "@/contexts/AuthContext";
import { useAuth } from "@/hooks/use-auth";
import { Skeleton } from "@/components/ui/skeleton";

import LoginPage from "@/pages/login";
import DashboardPage from "@/pages/dashboard";
import UsinasPage from "@/pages/usinas";
import UsinaDetalhesPage from "@/pages/usina-detalhes";
import ClientesPage from "@/pages/clientes";
import ClienteDetalhesPage from "@/pages/cliente-detalhes";
import FaturasPage from "@/pages/faturas";
import FaturasUploadPage from "@/pages/faturas-upload";
import GeracaoPage from "@/pages/geracao";
import PrecosKwhPage from "@/pages/precos-kwh";
import RelatoriosPage from "@/pages/relatorios";
import AuditoriaPage from "@/pages/auditoria";
import ConfiguracoesPage from "@/pages/configuracoes";
import NotFound from "@/pages/not-found";

function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();

  // Usar role do JWT
  const userRole = (user?.role as "super_admin" | "admin" | "operador") || "operador";

  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar userRole={userRole} />
        <div className="flex flex-col flex-1 min-w-0">
          <header className="flex items-center justify-between gap-4 px-4 h-14 border-b bg-background shrink-0">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
            <ThemeToggle />
          </header>
          <main className="flex-1 overflow-auto">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function ProtectedRoute({
  component: Component,
  adminOnly = false,
}: {
  component: React.ComponentType;
  adminOnly?: boolean;
}) {
  const { user, isLoading, isAuthenticated } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="space-y-4 w-64">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Redirect to="/login" />;
  }

  // Verificar se é admin ou super_admin
  const isAdmin = user?.role === "admin" || user?.role === "super_admin";

  if (adminOnly && !isAdmin) {
    return (
      <AuthenticatedLayout>
        <div className="flex flex-col items-center justify-center h-full p-6">
          <h1 className="text-2xl font-semibold mb-2">Acesso Restrito</h1>
          <p className="text-muted-foreground">
            Você não tem permissão para acessar esta página.
          </p>
        </div>
      </AuthenticatedLayout>
    );
  }

  return (
    <AuthenticatedLayout>
      <Component />
    </AuthenticatedLayout>
  );
}

function Router() {
  return (
    <Switch>
      {/* Rota de Login */}
      <Route path="/login" component={LoginPage} />

      {/* Rotas Protegidas */}
      <Route path="/">
        <ProtectedRoute component={DashboardPage} />
      </Route>
      <Route path="/usinas">
        <ProtectedRoute component={UsinasPage} />
      </Route>
      <Route path="/usinas/:id">
        <ProtectedRoute component={UsinaDetalhesPage} />
      </Route>
      <Route path="/clientes/:id">
        <ProtectedRoute component={ClienteDetalhesPage} />
      </Route>
      <Route path="/clientes">
        <ProtectedRoute component={ClientesPage} />
      </Route>
      <Route path="/faturas">
        <ProtectedRoute component={FaturasPage} />
      </Route>
      <Route path="/faturas/upload">
        <ProtectedRoute component={FaturasUploadPage} />
      </Route>
      <Route path="/geracao">
        <ProtectedRoute component={GeracaoPage} />
      </Route>
      <Route path="/precos-kwh">
        <ProtectedRoute component={PrecosKwhPage} />
      </Route>
      <Route path="/relatorios">
        <ProtectedRoute component={RelatoriosPage} adminOnly />
      </Route>
      <Route path="/auditoria">
        <ProtectedRoute component={AuditoriaPage} adminOnly />
      </Route>
      <Route path="/configuracoes">
        <ProtectedRoute component={ConfiguracoesPage} adminOnly />
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
