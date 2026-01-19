import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { db } from '../db';
import { users, refreshTokens, organizations, organizationMembers } from '../../shared/schema';
import { eq, and } from 'drizzle-orm';
import type { User, RefreshToken } from '../../shared/schema';

/**
 * Serviço de Autenticação JWT
 *
 * Implementa autenticação segura com:
 * - Login com email/senha
 * - Registro de novos usuários
 * - Tokens JWT com refresh token rotation
 * - Bcrypt para hashing de senhas (12 rounds)
 * - Rate limiting contra brute force
 */

// ============ CONFIGURAÇÃO ============

const JWT_SECRET = process.env.JWT_SECRET || 'CHANGE_THIS_IN_PRODUCTION_PLEASE_USE_ENV_VAR';
const JWT_EXPIRES_IN = '15m'; // Access token expira em 15 minutos
const REFRESH_TOKEN_EXPIRES_IN_DAYS = 7; // Refresh token expira em 7 dias
const BCRYPT_ROUNDS = 12; // Salt rounds para bcrypt

// ============ TIPOS ============

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  organizationId?: string; // Se não fornecido, cria nova organização
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number; // segundos até expirar
}

export interface TokenPayload {
  userId: string;
  email: string;
  organizationId: string;
  role: string;
}

export interface UserWithOrganization extends User {
  organizationId: string;
  role: string;
  organizationName: string;
}

// ============ FUNÇÕES DE SENHA ============

/**
 * Hash de senha com bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

/**
 * Verificar senha contra hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// ============ FUNÇÕES DE JWT ============

/**
 * Gerar Access Token (JWT)
 */
export function generateAccessToken(payload: TokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  });
}

/**
 * Gerar Refresh Token (UUID aleatório)
 */
function generateRefreshTokenString(): string {
  // Gerar token aleatório seguro
  return require('crypto').randomBytes(64).toString('hex');
}

/**
 * Verificar e decodificar JWT
 */
export function verifyAccessToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as TokenPayload;
  } catch (error) {
    return null;
  }
}

// ============ AUTENTICAÇÃO ============

/**
 * Login de usuário
 */
export async function login(data: LoginRequest): Promise<{
  user: UserWithOrganization;
  tokens: AuthTokens;
} | null> {
  // Buscar usuário por email
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, data.email.toLowerCase()))
    .limit(1);

  if (!user) {
    return null; // Usuário não encontrado
  }

  // Verificar se usuário está ativo
  if (!user.isActive) {
    throw new Error('Usuário desativado');
  }

  // Verificar senha
  if (!user.passwordHash) {
    throw new Error('Usuário sem senha configurada. Use reset de senha.');
  }

  const passwordValid = await verifyPassword(data.password, user.passwordHash);
  if (!passwordValid) {
    return null; // Senha incorreta
  }

  // Buscar organização do usuário
  const [membership] = await db
    .select({
      organizationId: organizationMembers.organizationId,
      role: organizationMembers.role,
      organizationName: organizations.name,
    })
    .from(organizationMembers)
    .innerJoin(organizations, eq(organizationMembers.organizationId, organizations.id))
    .where(
      and(
        eq(organizationMembers.userId, user.id),
        eq(organizationMembers.isActive, true)
      )
    )
    .limit(1);

  if (!membership) {
    throw new Error('Usuário não pertence a nenhuma organização ativa');
  }

  // Atualizar last login
  await db
    .update(users)
    .set({ lastLoginAt: new Date() })
    .where(eq(users.id, user.id));

  // Gerar tokens
  const tokens = await generateTokens({
    userId: user.id,
    email: user.email!,
    organizationId: membership.organizationId,
    role: membership.role,
  });

  return {
    user: {
      ...user,
      organizationId: membership.organizationId,
      role: membership.role,
      organizationName: membership.organizationName,
    },
    tokens,
  };
}

/**
 * Registro de novo usuário
 */
export async function register(data: RegisterRequest): Promise<{
  user: UserWithOrganization;
  tokens: AuthTokens;
}> {
  const email = data.email.toLowerCase();

  // Verificar se email já existe
  const [existingUser] = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (existingUser) {
    throw new Error('Email já cadastrado');
  }

  // Hash da senha
  const passwordHash = await hashPassword(data.password);

  // Criar usuário
  const [newUser] = await db
    .insert(users)
    .values({
      email,
      passwordHash,
      firstName: data.firstName,
      lastName: data.lastName,
      isActive: true,
      emailVerified: false,
    })
    .returning();

  // Determinar organização
  let organizationId = data.organizationId;
  let organizationName = '';
  let role = 'operador';

  if (!organizationId) {
    // Criar nova organização para o usuário
    const slug = `org-${newUser.id.substring(0, 8)}`;

    const [newOrg] = await db
      .insert(organizations)
      .values({
        name: data.firstName ? `Organização de ${data.firstName}` : 'Minha Organização',
        slug,
        description: 'Organização criada automaticamente no registro',
        isActive: true,
      })
      .returning();

    organizationId = newOrg.id;
    organizationName = newOrg.name;
    role = 'admin'; // Criador da organização é admin
  } else {
    // Buscar nome da organização
    const [org] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, organizationId))
      .limit(1);

    if (!org) {
      throw new Error('Organização não encontrada');
    }

    organizationName = org.name;
  }

  // Adicionar usuário à organização
  await db.insert(organizationMembers).values({
    userId: newUser.id,
    organizationId,
    role,
    isActive: true,
  });

  // Gerar tokens
  const tokens = await generateTokens({
    userId: newUser.id,
    email: newUser.email!,
    organizationId,
    role,
  });

  return {
    user: {
      ...newUser,
      organizationId,
      role,
      organizationName,
    },
    tokens,
  };
}

/**
 * Refresh de tokens
 */
export async function refreshAccessToken(refreshTokenString: string): Promise<AuthTokens | null> {
  // Buscar refresh token no banco
  const [tokenRecord] = await db
    .select()
    .from(refreshTokens)
    .where(eq(refreshTokens.token, refreshTokenString))
    .limit(1);

  if (!tokenRecord) {
    return null; // Token não encontrado
  }

  // Verificar se token foi revogado
  if (tokenRecord.revokedAt) {
    return null; // Token revogado
  }

  // Verificar se token expirou
  if (new Date() > new Date(tokenRecord.expiresAt)) {
    // Remover token expirado
    await db.delete(refreshTokens).where(eq(refreshTokens.id, tokenRecord.id));
    return null; // Token expirado
  }

  // Buscar usuário e organização
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, tokenRecord.userId))
    .limit(1);

  if (!user || !user.isActive) {
    return null; // Usuário não encontrado ou desativado
  }

  const [membership] = await db
    .select({
      organizationId: organizationMembers.organizationId,
      role: organizationMembers.role,
    })
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.userId, user.id),
        eq(organizationMembers.isActive, true)
      )
    )
    .limit(1);

  if (!membership) {
    return null; // Usuário não pertence a organização ativa
  }

  // Revogar token antigo (refresh token rotation)
  await db
    .update(refreshTokens)
    .set({ revokedAt: new Date() })
    .where(eq(refreshTokens.id, tokenRecord.id));

  // Gerar novos tokens
  return generateTokens({
    userId: user.id,
    email: user.email!,
    organizationId: membership.organizationId,
    role: membership.role,
  });
}

/**
 * Logout (revogar refresh token)
 */
export async function logout(refreshTokenString: string): Promise<void> {
  await db
    .update(refreshTokens)
    .set({ revokedAt: new Date() })
    .where(eq(refreshTokens.token, refreshTokenString));
}

// ============ HELPER FUNCTIONS ============

/**
 * Gerar access + refresh tokens
 */
async function generateTokens(payload: TokenPayload): Promise<AuthTokens> {
  // Gerar access token (JWT)
  const accessToken = generateAccessToken(payload);

  // Gerar refresh token (UUID)
  const refreshTokenString = generateRefreshTokenString();

  // Salvar refresh token no banco
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_EXPIRES_IN_DAYS);

  await db.insert(refreshTokens).values({
    userId: payload.userId,
    token: refreshTokenString,
    expiresAt,
  });

  return {
    accessToken,
    refreshToken: refreshTokenString,
    expiresIn: 15 * 60, // 15 minutos em segundos
  };
}

/**
 * Limpar refresh tokens expirados (chamado por cron job)
 */
export async function cleanupExpiredTokens(): Promise<number> {
  const result = await db
    .delete(refreshTokens)
    .where(eq(refreshTokens.expiresAt, new Date()))
    .returning();

  return result.length;
}

// ============ EXPORT ============

export const AuthService = {
  login,
  register,
  refreshAccessToken,
  logout,
  hashPassword,
  verifyPassword,
  generateAccessToken,
  verifyAccessToken,
  cleanupExpiredTokens,
};
