/**
 * Hook useAuth - Wrapper para AuthContext
 *
 * Este hook é mantido para compatibilidade com o código existente.
 * Agora usa JWT ao invés de Replit Auth.
 */
import { useAuthContext } from '@/contexts/AuthContext';

export function useAuth() {
  const { user, isLoading, isAuthenticated, logout } = useAuthContext();

  return {
    user,
    isLoading,
    isAuthenticated,
    logout,
    isLoggingOut: false, // Mantido para compatibilidade
  };
}
