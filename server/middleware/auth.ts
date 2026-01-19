import type { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/auth-service';
import type { TokenPayload } from '../services/auth-service';
import { db } from '../db';
import { users, organizationMembers } from '../../shared/schema';
import { eq, and } from 'drizzle-orm';

/**
 * Middlewares de Autenticação e Autorização
 *
 * - requireAuth: Requer token JWT válido
 * - requireRole: Requer role específica (admin, operador, super_admin)
 * - requireOrganization: Garante acesso apenas aos dados da organização do usuário
 */

// ============ TIPOS ============

// Extender Request do Express para incluir dados do usuário
declare global {
  namespace Express {
    interface Request {
      user?: TokenPayload;
      userId?: string;
      organizationId?: string;
      userRole?: string;
    }
  }
}

// ============ MIDDLEWARE DE AUTENTICAÇÃO ============

/**
 * Middleware: Requer autenticação JWT
 *
 * Verifica se o header Authorization contém um token JWT válido.
 * Se válido, adiciona os dados do usuário ao request.
 *
 * Uso:
 *   app.get('/api/protected', requireAuth, (req, res) => { ... });
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  try {
    // Extrair token do header Authorization
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        error: 'Não autorizado',
        message: 'Token de autenticação não fornecido',
      });
      return;
    }

    const token = authHeader.substring(7); // Remove "Bearer "

    // Verificar token
    const payload = AuthService.verifyAccessToken(token);

    if (!payload) {
      res.status(401).json({
        error: 'Não autorizado',
        message: 'Token inválido ou expirado',
      });
      return;
    }

    // Adicionar dados do usuário ao request
    req.user = payload;
    req.userId = payload.userId;
    req.organizationId = payload.organizationId;
    req.userRole = payload.role;

    next();
  } catch (error) {
    console.error('Erro no middleware de autenticação:', error);
    res.status(500).json({
      error: 'Erro interno',
      message: 'Erro ao verificar autenticação',
    });
  }
}

// ============ MIDDLEWARE DE AUTORIZAÇÃO (ROLES) ============

/**
 * Middleware: Requer role específica
 *
 * Uso:
 *   app.get('/api/admin-only', requireAuth, requireRole('admin'), ...);
 *   app.get('/api/super-admin', requireAuth, requireRole('super_admin'), ...);
 */
export function requireRole(...allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.userRole) {
      res.status(401).json({
        error: 'Não autorizado',
        message: 'Autenticação necessária',
      });
      return;
    }

    // Super admin tem acesso a tudo
    if (req.userRole === 'super_admin') {
      next();
      return;
    }

    // Verificar se role do usuário está na lista de permitidos
    if (!allowedRoles.includes(req.userRole)) {
      res.status(403).json({
        error: 'Acesso negado',
        message: `Acesso restrito a: ${allowedRoles.join(', ')}`,
      });
      return;
    }

    next();
  };
}

/**
 * Atalhos para roles comuns
 */
export const requireAdmin = requireRole('admin', 'super_admin');
export const requireSuperAdmin = requireRole('super_admin');

// ============ MIDDLEWARE DE ISOLAMENTO POR ORGANIZAÇÃO ============

/**
 * Middleware: Garante isolamento de dados por organização
 *
 * Adiciona filtro automático por organizationId em todas as queries.
 * Super admins podem acessar qualquer organização se especificarem o query param.
 *
 * Uso:
 *   app.get('/api/usinas', requireAuth, requireOrganization, ...);
 */
export function requireOrganization(req: Request, res: Response, next: NextFunction): void {
  if (!req.organizationId) {
    res.status(401).json({
      error: 'Não autorizado',
      message: 'OrganizationId não encontrado',
    });
    return;
  }

  // Super admin pode acessar qualquer organização via query param
  if (req.userRole === 'super_admin' && req.query.organizationId) {
    req.organizationId = req.query.organizationId as string;
  }

  next();
}

// ============ MIDDLEWARE DE VALIDAÇÃO DE MEMBERSHIP ============

/**
 * Middleware: Valida se usuário ainda pertence à organização
 *
 * Uso:
 *   app.get('/api/data', requireAuth, validateMembership, ...);
 */
export async function validateMembership(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.userId || !req.organizationId) {
      res.status(401).json({
        error: 'Não autorizado',
        message: 'Dados de autenticação incompletos',
      });
      return;
    }

    // Verificar se usuário ainda está ativo
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, req.userId))
      .limit(1);

    if (!user || !user.isActive) {
      res.status(403).json({
        error: 'Acesso negado',
        message: 'Usuário desativado',
      });
      return;
    }

    // Verificar se usuário ainda pertence à organização
    const [membership] = await db
      .select()
      .from(organizationMembers)
      .where(
        and(
          eq(organizationMembers.userId, req.userId),
          eq(organizationMembers.organizationId, req.organizationId),
          eq(organizationMembers.isActive, true)
        )
      )
      .limit(1);

    if (!membership) {
      res.status(403).json({
        error: 'Acesso negado',
        message: 'Você não pertence mais a esta organização',
      });
      return;
    }

    // Atualizar role se mudou
    if (membership.role !== req.userRole) {
      req.userRole = membership.role;
    }

    next();
  } catch (error) {
    console.error('Erro ao validar membership:', error);
    res.status(500).json({
      error: 'Erro interno',
      message: 'Erro ao validar acesso',
    });
  }
}

// ============ RATE LIMITING (prevenir brute force) ============

const loginAttempts = new Map<string, { count: number; resetAt: number }>();

/**
 * Middleware: Rate limiting para login
 *
 * Máximo de 5 tentativas por IP a cada 15 minutos
 */
export function rateLimitLogin(req: Request, res: Response, next: NextFunction): void {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();

  const attempt = loginAttempts.get(ip);

  // Reset se passou o tempo
  if (attempt && now > attempt.resetAt) {
    loginAttempts.delete(ip);
  }

  // Verificar limite
  if (attempt && attempt.count >= 5) {
    const waitTime = Math.ceil((attempt.resetAt - now) / 1000 / 60);
    res.status(429).json({
      error: 'Muitas tentativas',
      message: `Aguarde ${waitTime} minuto(s) antes de tentar novamente`,
    });
    return;
  }

  // Incrementar contador
  if (attempt) {
    attempt.count++;
  } else {
    loginAttempts.set(ip, {
      count: 1,
      resetAt: now + 15 * 60 * 1000, // 15 minutos
    });
  }

  next();
}

/**
 * Limpar rate limit após login bem-sucedido
 */
export function clearRateLimit(req: Request): void {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  loginAttempts.delete(ip);
}

// ============ EXPORT ============

export default {
  requireAuth,
  requireRole,
  requireAdmin,
  requireSuperAdmin,
  requireOrganization,
  validateMembership,
  rateLimitLogin,
  clearRateLimit,
};
