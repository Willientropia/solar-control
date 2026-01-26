import { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * ErrorBoundary component that catches JavaScript errors in child components
 * and displays a fallback UI instead of crashing the entire application.
 *
 * This prevents "white screen of death" errors like:
 * - "Failed to execute 'removeChild' on 'Node'"
 * - "Failed to execute 'insertBefore' on 'Node'"
 *
 * These errors typically occur when:
 * - Browser extensions modify the DOM
 * - Navigation happens during async DOM operations
 * - React's virtual DOM gets out of sync with the actual DOM
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error details for debugging
    console.error("ErrorBoundary caught an error:", error);
    console.error("Error info:", errorInfo);

    this.setState({ errorInfo });

    // Check if this is a DOM manipulation error that can be recovered from
    const isDOMError =
      error.message?.includes("removeChild") ||
      error.message?.includes("insertBefore") ||
      error.message?.includes("appendChild") ||
      error.message?.includes("Node");

    if (isDOMError) {
      console.warn(
        "DOM manipulation error detected. This may be caused by browser extensions or navigation timing issues."
      );
    }
  }

  handleReload = () => {
    window.location.reload();
  };

  handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render() {
    if (this.state.hasError) {
      // If a custom fallback is provided, use it
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const isDOMError =
        this.state.error?.message?.includes("removeChild") ||
        this.state.error?.message?.includes("insertBefore") ||
        this.state.error?.message?.includes("Node");

      // Default fallback UI
      return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-background">
          <Card className="max-w-md w-full">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
                <AlertTriangle className="h-6 w-6 text-destructive" />
              </div>
              <CardTitle>Algo deu errado</CardTitle>
              <CardDescription>
                {isDOMError ? (
                  <>
                    Ocorreu um erro de renderização. Isso pode ser causado por
                    extensões do navegador ou uma navegação rápida.
                  </>
                ) : (
                  <>
                    Ocorreu um erro inesperado na aplicação.
                  </>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {this.state.error && (
                <div className="p-3 rounded-md bg-muted text-xs font-mono overflow-auto max-h-32">
                  {this.state.error.message}
                </div>
              )}

              <div className="flex flex-col gap-2">
                <Button onClick={this.handleRetry} variant="default" className="w-full">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Tentar novamente
                </Button>
                <Button onClick={this.handleReload} variant="outline" className="w-full">
                  Recarregar página
                </Button>
              </div>

              {isDOMError && (
                <p className="text-xs text-muted-foreground text-center">
                  Dica: Se o erro persistir, tente desativar extensões do navegador
                  como bloqueadores de anúncios ou tradutores.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
