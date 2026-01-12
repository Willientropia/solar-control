import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { useAuth } from "@/hooks/use-auth";
import { Skeleton } from "@/components/ui/skeleton";
import type { UserProfile } from "@shared/schema";

import LandingPage from "@/pages/landing";
import DashboardPage from "@/pages/dashboard";
import UsinasPage from "@/pages/usinas";
import UsinaDetalhesPage from "@/pages/usina-detalhes";
import ClientesPage from "@/pages/clientes";
import FaturasPage from "@/pages/faturas";
import FaturasUploadPage from "@/pages/faturas-upload";
import GeracaoPage from "@/pages/geracao";
import RelatoriosPage from "@/pages/relatorios";
import AuditoriaPage from "@/pages/auditoria";
import ConfiguracoesPage from "@/pages/configuracoes";
import NotFound from "@/pages/not-found";

function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const { data: profile } = useQuery<UserProfile>({
    queryKey: ["/api/auth/profile"],
  });

  const userRole = (profile?.role as "admin" | "operador") || "operador";

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
  const { data: profile, isLoading: profileLoading } = useQuery<UserProfile>({
    queryKey: ["/api/auth/profile"],
    enabled: isAuthenticated,
  });

  if (isLoading || (isAuthenticated && profileLoading)) {
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
    return <LandingPage />;
  }

  if (adminOnly && profile?.role !== "admin") {
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
      <Route path="/">
        <ProtectedRoute component={DashboardPage} />
      </Route>
      <Route path="/usinas">
        <ProtectedRoute component={UsinasPage} />
      </Route>
      <Route path="/usinas/:id">
        <ProtectedRoute component={UsinaDetalhesPage} />
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
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
