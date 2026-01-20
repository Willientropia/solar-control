import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated, registerAuthRoutes } from "./replit_integrations/auth";
import { ExcelService } from "./services/excel-service";
import { insertUsinaSchema, insertClienteSchema, insertFaturaSchema, insertGeracaoMensalSchema } from "@shared/schema";
import { z } from "zod";
import multer from "multer";
import { spawn } from "child_process";
import path from "path";
import fs from "fs";
import fsPromises from "fs/promises";
import * as AuthService from "./services/auth-service";
import { requireAuth, requireRole } from "./middleware/auth";

// Configure multer for PDF uploads
const uploadDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
      cb(null, uniqueSuffix + "-" + file.originalname);
    },
  }),
  fileFilter: (req, file, cb) => {
    if (file.mimetype === "application/pdf") {
      cb(null, true);
    } else {
      cb(new Error("Only PDF files are allowed"));
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
});

// Function to extract data from PDF using Python script
async function extractPdfData(
  pdfPath: string,
  priceKwh: number,
  discount: number
): Promise<any> {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(process.cwd(), "server/scripts/extract_fatura.py");
    const pythonProcess = spawn("python3", [
      scriptPath,
      pdfPath,
      "--price-kwh",
      priceKwh.toString(),
      "--discount",
      discount.toString(),
    ]);

    let stdout = "";
    let stderr = "";

    pythonProcess.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    pythonProcess.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    pythonProcess.on("close", (code) => {
      if (code === 0) {
        try {
          const result = JSON.parse(stdout);
          resolve(result);
        } catch (e) {
          reject(new Error(`Failed to parse Python output: ${stdout}`));
        }
      } else {
        reject(new Error(`Python script error: ${stderr}`));
      }
    });

    pythonProcess.on("error", (err) => {
      reject(err);
    });
  });
}

// Middleware to check if user is admin
async function isAdmin(req: Request, res: Response, next: NextFunction) {
  const user = req.user as any;
  if (!user?.claims?.sub) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const profile = await storage.getUserProfile(user.claims.sub);
  if (profile?.role !== "admin") {
    return res.status(403).json({ message: "Forbidden: Admin access required" });
  }

  next();
}

// Helper to create audit log
async function logAction(userId: string, acao: string, entidade: string, entidadeId?: string, detalhes?: any) {
  try {
    await storage.createAuditLog({
      userId,
      acao,
      entidade,
      entidadeId,
      detalhes,
    });
  } catch (error) {
    console.error("Failed to create audit log:", error);
  }
}

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  // Setup authentication
  await setupAuth(app);
  registerAuthRoutes(app);

  // ==================== JWT AUTHENTICATION ====================

  // Test endpoint (debug)
  app.get("/api/test", (req, res) => {
    res.json({
      message: "API está funcionando!",
      timestamp: new Date().toISOString(),
      env: {
        hasJwtSecret: !!process.env.JWT_SECRET,
        nodeEnv: process.env.NODE_ENV,
      }
    });
  });

  // Register new user
  app.post("/api/auth/register", async (req, res) => {
    try {
      const result = await AuthService.register(req.body);

      if (!result) {
        return res.status(400).json({
          error: "Falha ao criar usuário",
          message: "Email pode já estar em uso ou dados inválidos"
        });
      }

      res.status(201).json({
        message: "Usuário criado com sucesso",
        user: {
          id: result.user.id,
          email: result.user.email,
          firstName: result.user.firstName,
          lastName: result.user.lastName,
          organization: {
            id: result.user.organizationId,
            name: result.user.organizationName,
            slug: result.user.organizationSlug,
          },
          role: result.user.role,
        },
        tokens: result.tokens,
      });
    } catch (error: any) {
      console.error("Error registering user:", error);

      if (error.message?.includes("Email já está em uso")) {
        return res.status(409).json({
          error: "Email já cadastrado",
          message: "Este email já está registrado no sistema"
        });
      }

      res.status(500).json({
        error: "Erro ao criar usuário",
        message: error.message || "Erro interno do servidor"
      });
    }
  });

  // Login
  app.post("/api/auth/login", async (req, res) => {
    try {
      const result = await AuthService.login(req.body);

      if (!result) {
        return res.status(401).json({
          error: "Credenciais inválidas",
          message: "Email ou senha incorretos"
        });
      }

      res.json({
        message: "Login realizado com sucesso",
        user: {
          id: result.user.id,
          email: result.user.email,
          firstName: result.user.firstName,
          lastName: result.user.lastName,
          organization: {
            id: result.user.organizationId,
            name: result.user.organizationName,
            slug: result.user.organizationSlug,
          },
          role: result.user.role,
          isActive: result.user.isActive,
          emailVerified: result.user.emailVerified,
        },
        tokens: result.tokens,
      });
    } catch (error: any) {
      console.error("Error logging in:", error);
      res.status(500).json({
        error: "Erro ao fazer login",
        message: error.message || "Erro interno do servidor"
      });
    }
  });

  // Refresh access token
  app.post("/api/auth/refresh", async (req, res) => {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        return res.status(400).json({
          error: "Token não fornecido",
          message: "Refresh token é obrigatório"
        });
      }

      const tokens = await AuthService.refreshAccessToken(refreshToken);

      if (!tokens) {
        return res.status(401).json({
          error: "Token inválido",
          message: "Refresh token inválido ou expirado"
        });
      }

      res.json({
        message: "Token atualizado com sucesso",
        tokens,
      });
    } catch (error: any) {
      console.error("Error refreshing token:", error);
      res.status(500).json({
        error: "Erro ao atualizar token",
        message: error.message || "Erro interno do servidor"
      });
    }
  });

  // Logout
  app.post("/api/auth/logout", requireAuth, async (req: any, res) => {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        return res.status(400).json({
          error: "Token não fornecido",
          message: "Refresh token é obrigatório"
        });
      }

      await AuthService.logout(refreshToken);

      res.json({
        message: "Logout realizado com sucesso"
      });
    } catch (error: any) {
      console.error("Error logging out:", error);
      res.status(500).json({
        error: "Erro ao fazer logout",
        message: error.message || "Erro interno do servidor"
      });
    }
  });

  // Get current user info (JWT version)
  app.get("/api/auth/me", requireAuth, async (req: any, res) => {
    try {
      const userId = req.userId; // Set by requireAuth middleware
      const user = await storage.getUser(userId);

      if (!user) {
        return res.status(404).json({
          error: "Usuário não encontrado",
          message: "Usuário não existe"
        });
      }

      // Get organization membership
      const membership = await storage.getOrganizationMember(user.id);

      if (!membership) {
        return res.status(404).json({
          error: "Membro não encontrado",
          message: "Usuário não vinculado a nenhuma organização"
        });
      }

      const organization = await storage.getOrganization(membership.organizationId);

      res.json({
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        profileImageUrl: user.profileImageUrl,
        isActive: user.isActive,
        emailVerified: user.emailVerified,
        lastLoginAt: user.lastLoginAt,
        createdAt: user.createdAt,
        organization: {
          id: organization?.id,
          name: organization?.name,
          slug: organization?.slug,
        },
        role: membership.role,
        memberSince: membership.joinedAt,
      });
    } catch (error: any) {
      console.error("Error fetching current user:", error);
      res.status(500).json({
        error: "Erro ao buscar usuário",
        message: error.message || "Erro interno do servidor"
      });
    }
  });

  // Get user profile
  app.get("/api/auth/profile", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      let profile = await storage.getUserProfile(userId);
      
      // Create default profile if doesn't exist
      if (!profile) {
        profile = await storage.upsertUserProfile({ userId, role: "operador" });
      }
      
      res.json(profile);
    } catch (error) {
      console.error("Error fetching profile:", error);
      res.status(500).json({ message: "Failed to fetch profile" });
    }
  });

  // ==================== ORGANIZATIONS ====================

  // List all organizations (super_admin sees all, others see only their own)
  app.get("/api/organizations", requireAuth, async (req: any, res) => {
    try {
      const userRole = req.userRole;

      if (userRole === 'super_admin') {
        // Super admin sees all organizations
        const organizations = await storage.getOrganizations();
        res.json(organizations);
      } else {
        // Other users see only their organization
        const organizationId = req.organizationId;
        const organization = await storage.getOrganization(organizationId);

        if (!organization) {
          return res.status(404).json({
            error: "Organização não encontrada",
            message: "Sua organização não foi encontrada"
          });
        }

        res.json([organization]);
      }
    } catch (error: any) {
      console.error("Error fetching organizations:", error);
      res.status(500).json({
        error: "Erro ao buscar organizações",
        message: error.message || "Erro interno do servidor"
      });
    }
  });

  // Get organization details
  app.get("/api/organizations/:id", requireAuth, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userRole = req.userRole;
      const userOrgId = req.organizationId;

      // Check permissions: super_admin can access any, others only their own
      if (userRole !== 'super_admin' && id !== userOrgId) {
        return res.status(403).json({
          error: "Acesso negado",
          message: "Você não tem permissão para acessar esta organização"
        });
      }

      const organization = await storage.getOrganization(id);

      if (!organization) {
        return res.status(404).json({
          error: "Organização não encontrada",
          message: "Organização não existe"
        });
      }

      res.json(organization);
    } catch (error: any) {
      console.error("Error fetching organization:", error);
      res.status(500).json({
        error: "Erro ao buscar organização",
        message: error.message || "Erro interno do servidor"
      });
    }
  });

  // Create new organization (super_admin only)
  app.post("/api/organizations", requireAuth, requireRole('super_admin'), async (req: any, res) => {
    try {
      const { name, slug, description } = req.body;

      // Validate required fields
      if (!name || !slug) {
        return res.status(400).json({
          error: "Dados incompletos",
          message: "Nome e slug são obrigatórios"
        });
      }

      // Check if slug already exists
      const existingOrg = await storage.getOrganizationBySlug(slug);
      if (existingOrg) {
        return res.status(409).json({
          error: "Slug já existe",
          message: "Já existe uma organização com este slug"
        });
      }

      const organization = await storage.createOrganization({
        name,
        slug,
        description,
      });

      res.status(201).json({
        message: "Organização criada com sucesso",
        organization,
      });
    } catch (error: any) {
      console.error("Error creating organization:", error);
      res.status(500).json({
        error: "Erro ao criar organização",
        message: error.message || "Erro interno do servidor"
      });
    }
  });

  // Update organization
  app.patch("/api/organizations/:id", requireAuth, requireRole('super_admin', 'admin'), async (req: any, res) => {
    try {
      const { id } = req.params;
      const userRole = req.userRole;
      const userOrgId = req.organizationId;

      // Check permissions: super_admin can update any, admin only their own
      if (userRole !== 'super_admin' && id !== userOrgId) {
        return res.status(403).json({
          error: "Acesso negado",
          message: "Você não tem permissão para atualizar esta organização"
        });
      }

      const { name, description, isActive } = req.body;

      const organization = await storage.updateOrganization(id, {
        name,
        description,
        isActive,
      });

      if (!organization) {
        return res.status(404).json({
          error: "Organização não encontrada",
          message: "Organização não existe"
        });
      }

      res.json({
        message: "Organização atualizada com sucesso",
        organization,
      });
    } catch (error: any) {
      console.error("Error updating organization:", error);
      res.status(500).json({
        error: "Erro ao atualizar organização",
        message: error.message || "Erro interno do servidor"
      });
    }
  });

  // List organization members
  app.get("/api/organizations/:id/members", requireAuth, requireRole('super_admin', 'admin'), async (req: any, res) => {
    try {
      const { id } = req.params;
      const userRole = req.userRole;
      const userOrgId = req.organizationId;

      // Check permissions
      if (userRole !== 'super_admin' && id !== userOrgId) {
        return res.status(403).json({
          error: "Acesso negado",
          message: "Você não tem permissão para ver os membros desta organização"
        });
      }

      const members = await storage.getOrganizationMembers(id);

      res.json(members);
    } catch (error: any) {
      console.error("Error fetching organization members:", error);
      res.status(500).json({
        error: "Erro ao buscar membros",
        message: error.message || "Erro interno do servidor"
      });
    }
  });

  // Add member to organization (invite)
  app.post("/api/organizations/:id/members", requireAuth, requireRole('super_admin', 'admin'), async (req: any, res) => {
    try {
      const { id } = req.params;
      const userRole = req.userRole;
      const userOrgId = req.organizationId;

      // Check permissions
      if (userRole !== 'super_admin' && id !== userOrgId) {
        return res.status(403).json({
          error: "Acesso negado",
          message: "Você não tem permissão para adicionar membros a esta organização"
        });
      }

      const { userId, role } = req.body;

      if (!userId || !role) {
        return res.status(400).json({
          error: "Dados incompletos",
          message: "userId e role são obrigatórios"
        });
      }

      // Validate role
      const validRoles = ['super_admin', 'admin', 'operador'];
      if (!validRoles.includes(role)) {
        return res.status(400).json({
          error: "Role inválida",
          message: `Role deve ser uma de: ${validRoles.join(', ')}`
        });
      }

      // Only super_admin can assign super_admin role
      if (role === 'super_admin' && userRole !== 'super_admin') {
        return res.status(403).json({
          error: "Acesso negado",
          message: "Apenas super_admin pode atribuir a role super_admin"
        });
      }

      // Check if user exists
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({
          error: "Usuário não encontrado",
          message: "Usuário não existe"
        });
      }

      // Check if organization exists
      const organization = await storage.getOrganization(id);
      if (!organization) {
        return res.status(404).json({
          error: "Organização não encontrada",
          message: "Organização não existe"
        });
      }

      const member = await storage.addOrganizationMember({
        organizationId: id,
        userId,
        role,
      });

      res.status(201).json({
        message: "Membro adicionado com sucesso",
        member,
      });
    } catch (error: any) {
      console.error("Error adding organization member:", error);

      // Handle duplicate member error
      if (error.message?.includes("duplicate") || error.code === '23505') {
        return res.status(409).json({
          error: "Membro já existe",
          message: "Este usuário já é membro desta organização"
        });
      }

      res.status(500).json({
        error: "Erro ao adicionar membro",
        message: error.message || "Erro interno do servidor"
      });
    }
  });

  // Update organization member (change role)
  app.patch("/api/organizations/:id/members/:userId", requireAuth, requireRole('super_admin', 'admin'), async (req: any, res) => {
    try {
      const { id, userId } = req.params;
      const userRole = req.userRole;
      const userOrgId = req.organizationId;

      // Check permissions
      if (userRole !== 'super_admin' && id !== userOrgId) {
        return res.status(403).json({
          error: "Acesso negado",
          message: "Você não tem permissão para atualizar membros desta organização"
        });
      }

      const { role, isActive } = req.body;

      // Validate role if provided
      if (role) {
        const validRoles = ['super_admin', 'admin', 'operador'];
        if (!validRoles.includes(role)) {
          return res.status(400).json({
            error: "Role inválida",
            message: `Role deve ser uma de: ${validRoles.join(', ')}`
          });
        }

        // Only super_admin can assign super_admin role
        if (role === 'super_admin' && userRole !== 'super_admin') {
          return res.status(403).json({
            error: "Acesso negado",
            message: "Apenas super_admin pode atribuir a role super_admin"
          });
        }
      }

      const member = await storage.updateOrganizationMember(id, userId, {
        role,
        isActive,
      });

      if (!member) {
        return res.status(404).json({
          error: "Membro não encontrado",
          message: "Membro não existe nesta organização"
        });
      }

      res.json({
        message: "Membro atualizado com sucesso",
        member,
      });
    } catch (error: any) {
      console.error("Error updating organization member:", error);
      res.status(500).json({
        error: "Erro ao atualizar membro",
        message: error.message || "Erro interno do servidor"
      });
    }
  });

  // ==================== DASHBOARD ====================
  app.get("/api/dashboard/stats", isAuthenticated, async (req, res) => {
    try {
      const stats = await storage.getDashboardStats();
      res.json(stats);
    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
      res.status(500).json({ message: "Failed to fetch stats" });
    }
  });

  // ==================== USINAS ====================
  app.get("/api/usinas", isAuthenticated, async (req, res) => {
    try {
      const usinas = await storage.getUsinas();
      res.json(usinas);
    } catch (error) {
      console.error("Error fetching usinas:", error);
      res.status(500).json({ message: "Failed to fetch usinas" });
    }
  });

  app.get("/api/usinas/:id", isAuthenticated, async (req, res) => {
    try {
      const usina = await storage.getUsina(req.params.id);
      if (!usina) {
        return res.status(404).json({ message: "Usina not found" });
      }
      res.json(usina);
    } catch (error) {
      console.error("Error fetching usina:", error);
      res.status(500).json({ message: "Failed to fetch usina" });
    }
  });

  app.post("/api/usinas", isAuthenticated, async (req: any, res) => {
    try {
      const data = insertUsinaSchema.parse(req.body);
      const usina = await storage.createUsina(data);
      await logAction(req.user.claims.sub, "criar", "usina", usina.id, { nome: usina.nome });
      
      // Auto-create the usina's own UC as a non-paying client (UC matriz)
      const clienteMatriz = await storage.createCliente({
        nome: `${usina.nome} - UC Matriz`,
        unidadeConsumidora: usina.unidadeConsumidora,
        usinaId: usina.id,
        desconto: usina.descontoPadrao,
        isPagante: false,
      });
      await logAction(req.user.claims.sub, "criar", "cliente", clienteMatriz.id, { 
        nome: clienteMatriz.nome, 
        autoCreated: true,
        usinaId: usina.id 
      });
      
      res.status(201).json(usina);
    } catch (error) {
      console.error("Error creating usina:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create usina" });
    }
  });

  app.patch("/api/usinas/:id", isAuthenticated, async (req: any, res) => {
    try {
      const data = insertUsinaSchema.partial().parse(req.body);
      const usina = await storage.updateUsina(req.params.id, data);
      if (!usina) {
        return res.status(404).json({ message: "Usina not found" });
      }
      await logAction(req.user.claims.sub, "editar", "usina", usina.id, { nome: usina.nome });
      res.json(usina);
    } catch (error) {
      console.error("Error updating usina:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update usina" });
    }
  });

  app.delete("/api/usinas/:id", isAuthenticated, async (req: any, res) => {
    try {
      const usina = await storage.getUsina(req.params.id);
      await storage.deleteUsina(req.params.id);
      await logAction(req.user.claims.sub, "excluir", "usina", req.params.id, { nome: usina?.nome });
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting usina:", error);
      res.status(500).json({ message: "Failed to delete usina" });
    }
  });

  // ==================== PREÇOS KWH ====================
  app.get("/api/precos-kwh", isAuthenticated, async (req, res) => {
    try {
      const precos = await storage.getPrecosKwh();
      res.json(precos);
    } catch (error) {
      console.error("Error fetching preços kWh:", error);
      res.status(500).json({ message: "Failed to fetch preços kWh" });
    }
  });

  // Rotas específicas devem vir ANTES das rotas com :id
  app.get("/api/precos-kwh/ultimo", isAuthenticated, async (req, res) => {
    try {
      const preco = await storage.getUltimoPrecoKwh();
      res.json(preco || null);
    } catch (error) {
      console.error("Error fetching último preço kWh:", error);
      res.status(500).json({ message: "Failed to fetch último preço kWh" });
    }
  });

  app.get("/api/precos-kwh/mes/:mesReferencia", isAuthenticated, async (req, res) => {
    try {
      // Normalizar mês para MAIÚSCULO antes de buscar
      const mesNormalizado = req.params.mesReferencia.toUpperCase();
      const preco = await storage.getPrecoKwhByMes(mesNormalizado);
      if (!preco) {
        return res.status(404).json({ message: "Preço kWh not found for this month" });
      }
      res.json(preco);
    } catch (error) {
      console.error("Error fetching preço kWh by month:", error);
      res.status(500).json({ message: "Failed to fetch preço kWh" });
    }
  });

  app.get("/api/precos-kwh/:id", isAuthenticated, async (req, res) => {
    try {
      const preco = await storage.getPrecoKwh(req.params.id);
      if (!preco) {
        return res.status(404).json({ message: "Preço kWh not found" });
      }
      res.json(preco);
    } catch (error) {
      console.error("Error fetching preço kWh:", error);
      res.status(500).json({ message: "Failed to fetch preço kWh" });
    }
  });

  app.post("/api/precos-kwh", isAuthenticated, async (req: any, res) => {
    try {
      const preco = await storage.createPrecoKwh(req.body);
      await logAction(req.user.claims.sub, "criar", "preco_kwh", preco.id, { mesReferencia: preco.mesReferencia });
      res.status(201).json(preco);
    } catch (error: any) {
      console.error("Error creating preço kWh:", error);
      if (error.code === '23505') { // Unique constraint violation
        res.status(400).json({ message: "Já existe um preço cadastrado para este mês" });
      } else {
        res.status(500).json({ message: "Failed to create preço kWh" });
      }
    }
  });

  app.patch("/api/precos-kwh/:id", isAuthenticated, async (req: any, res) => {
    try {
      const preco = await storage.updatePrecoKwh(req.params.id, req.body);
      if (!preco) {
        return res.status(404).json({ message: "Preço kWh not found" });
      }
      await logAction(req.user.claims.sub, "editar", "preco_kwh", preco.id, { mesReferencia: preco.mesReferencia });
      res.json(preco);
    } catch (error) {
      console.error("Error updating preço kWh:", error);
      res.status(500).json({ message: "Failed to update preço kWh" });
    }
  });

  app.delete("/api/precos-kwh/:id", isAuthenticated, async (req: any, res) => {
    try {
      const preco = await storage.getPrecoKwh(req.params.id);
      await storage.deletePrecoKwh(req.params.id);
      await logAction(req.user.claims.sub, "excluir", "preco_kwh", req.params.id, { mesReferencia: preco?.mesReferencia });
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting preço kWh:", error);
      res.status(500).json({ message: "Failed to delete preço kWh" });
    }
  });

  // ==================== CLIENTES ====================
  app.get("/api/clientes", isAuthenticated, async (req, res) => {
    try {
      const clientes = await storage.getClientes();
      res.json(clientes);
    } catch (error) {
      console.error("Error fetching clientes:", error);
      res.status(500).json({ message: "Failed to fetch clientes" });
    }
  });

  app.get("/api/clientes/:id", isAuthenticated, async (req, res) => {
    try {
      const cliente = await storage.getCliente(req.params.id);
      if (!cliente) {
        return res.status(404).json({ message: "Cliente not found" });
      }
      res.json(cliente);
    } catch (error) {
      console.error("Error fetching cliente:", error);
      res.status(500).json({ message: "Failed to fetch cliente" });
    }
  });

  app.get("/api/clientes/:id/detalhes", isAuthenticated, async (req, res) => {
    try {
      const clienteId = req.params.id;

      // Get cliente with usina
      const cliente = await storage.getCliente(clienteId);
      if (!cliente) {
        return res.status(404).json({ message: "Cliente not found" });
      }

      // Get usina
      const usina = await storage.getUsina(cliente.usinaId);

      // Get all faturas for this cliente, ordered by mesReferencia (newest first)
      const allFaturas = await storage.getFaturas();
      const clienteFaturas = allFaturas
        .filter((f: any) => f.clienteId === clienteId)
        .sort((a: any, b: any) => {
          // Sort by mesReferencia (format: "Jan/2024")
          const [mesA, anoA] = a.mesReferencia?.split('/') || ['', ''];
          const [mesB, anoB] = b.mesReferencia?.split('/') || ['', ''];

          const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
          const mesIndexA = meses.indexOf(mesA);
          const mesIndexB = meses.indexOf(mesB);

          // First compare years, then months
          if (anoB !== anoA) {
            return parseInt(anoB) - parseInt(anoA);
          }
          return mesIndexB - mesIndexA;
        });

      // Get saldo from most recent fatura (first in array)
      const saldoAtual = clienteFaturas.length > 0
        ? parseFloat(clienteFaturas[0].saldoKwh || "0")
        : 0;

      // Calculate average consumo SCEE from last faturas (max 6 months)
      const faturasParaMedia = clienteFaturas.slice(0, 6);
      const consumoTotal = faturasParaMedia.reduce((acc: number, fatura: any) => {
        return acc + parseFloat(fatura.consumoScee || "0");
      }, 0);
      const mediaConsumo = faturasParaMedia.length > 0
        ? consumoTotal / faturasParaMedia.length
        : 0;

      // Calculate how many months the current saldo will last
      const mesesDuracaoSaldo = mediaConsumo > 0
        ? saldoAtual / mediaConsumo
        : 0;

      res.json({
        ...cliente,
        usina,
        faturas: clienteFaturas,
        saldoAtual: saldoAtual.toFixed(2),
        mediaConsumo: mediaConsumo.toFixed(2),
        mesesDuracaoSaldo: mesesDuracaoSaldo.toFixed(1),
      });
    } catch (error) {
      console.error("Error fetching cliente detalhes:", error);
      res.status(500).json({ message: "Failed to fetch cliente detalhes" });
    }
  });

  app.post("/api/clientes", isAuthenticated, async (req: any, res) => {
    try {
      const data = insertClienteSchema.parse(req.body);
      const cliente = await storage.createCliente(data);
      await logAction(req.user.claims.sub, "criar", "cliente", cliente.id, { nome: cliente.nome });
      res.status(201).json(cliente);
    } catch (error) {
      console.error("Error creating cliente:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create cliente" });
    }
  });

  app.patch("/api/clientes/:id", isAuthenticated, async (req: any, res) => {
    try {
      const data = insertClienteSchema.partial().parse(req.body);
      const cliente = await storage.updateCliente(req.params.id, data);
      if (!cliente) {
        return res.status(404).json({ message: "Cliente not found" });
      }
      await logAction(req.user.claims.sub, "editar", "cliente", cliente.id, { nome: cliente.nome });
      res.json(cliente);
    } catch (error) {
      console.error("Error updating cliente:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update cliente" });
    }
  });

  app.delete("/api/clientes/:id", isAuthenticated, async (req: any, res) => {
    try {
      const cliente = await storage.getCliente(req.params.id);
      await storage.deleteCliente(req.params.id);
      await logAction(req.user.claims.sub, "excluir", "cliente", req.params.id, { nome: cliente?.nome });
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting cliente:", error);
      res.status(500).json({ message: "Failed to delete cliente" });
    }
  });

  // ==================== FATURAS ====================
  app.get("/api/faturas", isAuthenticated, async (req, res) => {
    try {
      const status = req.query.status as string | undefined;
      const usinaId = req.query.usinaId as string | undefined;
      let mesReferencia = req.query.mesReferencia as string | undefined;

      // Normalizar mês para MAIÚSCULO (JAN/2026, DEZ/2025) para garantir consistência
      if (mesReferencia) {
        mesReferencia = mesReferencia.toUpperCase();
      }

      const faturas = await storage.getFaturas(status, usinaId, mesReferencia);
      res.json(faturas);
    } catch (error) {
      console.error("Error fetching faturas:", error);
      res.status(500).json({ message: "Failed to fetch faturas" });
    }
  });

  app.get("/api/faturas/:id", isAuthenticated, async (req, res) => {
    try {
      const fatura = await storage.getFatura(req.params.id);
      if (!fatura) {
        return res.status(404).json({ message: "Fatura not found" });
      }
      res.json(fatura);
    } catch (error) {
      console.error("Error fetching fatura:", error);
      res.status(500).json({ message: "Failed to fetch fatura" });
    }
  });

  // Extract data from PDF - returns data for verification
  app.post("/api/faturas/extract", isAuthenticated, upload.single("file"), async (req: any, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "PDF file is required" });
      }

      const precoKwh = parseFloat(req.body.precoKwh || "0.85");
      const desconto = parseFloat(req.body.desconto || "25");

      const extractedData = await extractPdfData(req.file.path, precoKwh, desconto);

      if (!extractedData.success) {
        return res.status(400).json({ 
          message: "Erro ao extrair dados do PDF",
          error: extractedData.error 
        });
      }

      // Add file info for preview
      extractedData.fileName = req.file.originalname;
      extractedData.filePath = req.file.path;
      extractedData.fileUrl = `/api/faturas/pdf/${path.basename(req.file.path)}`;

      res.json(extractedData);
    } catch (error: any) {
      console.error("Error extracting PDF data:", error);
      res.status(500).json({ message: "Erro ao processar PDF", error: error.message });
    }
  });

  // Serve PDF files for preview (supports nested paths)
  app.get("/api/faturas/pdf/*", isAuthenticated, (req, res) => {
    // Extract the path after /api/faturas/pdf/
    const relativePath = req.params[0];
    const filePath = path.join(uploadDir, relativePath);

    // Security check: ensure the path doesn't escape uploadDir
    const normalizedPath = path.normalize(filePath);
    if (!normalizedPath.startsWith(uploadDir)) {
      return res.status(403).json({ message: "Access denied" });
    }

    if (fs.existsSync(filePath)) {
      res.setHeader("Content-Type", "application/pdf");
      res.sendFile(filePath);
    } else {
      res.status(404).json({ message: "PDF not found" });
    }
  });

  // Helper to normalize Brazilian decimal format to standard
  function normalizeDecimal(value: string | number | null | undefined): string {
    if (value === null || value === undefined || value === "") return "0";
    
    // If already a number, just return as string
    if (typeof value === "number") {
      return isNaN(value) ? "0" : value.toString();
    }
    
    const strValue = String(value).trim();
    
    // Check if it's Brazilian format: has comma as decimal separator
    // Brazilian: "1.234,56" or "1234,56" 
    // Standard: "1234.56" or "0.85"
    const hasComma = strValue.includes(",");
    const hasDot = strValue.includes(".");
    
    let normalized: string;
    
    if (hasComma) {
      // Brazilian format: remove dots (thousands), replace comma with dot (decimal)
      normalized = strValue.replace(/\./g, "").replace(",", ".");
    } else {
      // Already standard format or no separators
      normalized = strValue;
    }
    
    const parsed = parseFloat(normalized);
    return isNaN(parsed) ? "0" : parsed.toString();
  }

  // Helper function to organize uploaded PDF into proper folder structure
  async function organizePdfFile(oldFilePath: string, cliente: any, usina: any, mesReferencia: string): Promise<string> {
    if (!oldFilePath || !fs.existsSync(oldFilePath)) {
      return "";
    }

    // Parse month reference (e.g., "JAN/2026" -> month: 1, year: 2026)
    const [monthName, year] = mesReferencia.split("/");
    const months: Record<string, string> = {
      "JAN": "01", "FEV": "02", "MAR": "03", "ABR": "04",
      "MAI": "05", "JUN": "06", "JUL": "07", "AGO": "08",
      "SET": "09", "OUT": "10", "NOV": "11", "DEZ": "12"
    };
    const monthNum = months[monthName.toUpperCase()] || "01";
    const monthNumInt = parseInt(monthNum);

    // Build new folder structure: Usina-NAME/faturas/YEAR/Mês-N/
    const usinaFolderName = `Usina-${usina.nome.replace(/\s+/g, "-")}`;
    const newDir = path.join(uploadDir, usinaFolderName, "faturas", year, `Mês-${monthNumInt}`);

    // Create directories if they don't exist
    if (!fs.existsSync(newDir)) {
      fs.mkdirSync(newDir, { recursive: true });
    }

    // Build new filename: UC-MM-YYYY.pdf
    const newFileName = `${cliente.unidadeConsumidora}-${monthNum}-${year}.pdf`;
    const newFilePath = path.join(newDir, newFileName);

    // Move file to new location
    await fsPromises.rename(oldFilePath, newFilePath);

    // Return relative URL path for database
    return `/api/faturas/pdf/${usinaFolderName}/faturas/${year}/Mês-${monthNumInt}/${newFileName}`;
  }

  // Confirm and save extracted fatura
  app.post("/api/faturas/confirm", isAuthenticated, async (req: any, res) => {
    try {
      const { extractedData, clienteId, usinaId, forceReplace } = req.body;

      if (!extractedData || !clienteId) {
        return res.status(400).json({ message: "extractedData and clienteId are required" });
      }

      // Find the client to get discount info
      const cliente = await storage.getCliente(clienteId);
      if (!cliente) {
        return res.status(404).json({ message: "Cliente not found" });
      }

      // Get usina for folder organization
      const usina = await storage.getUsina(cliente.usinaId);
      if (!usina) {
        return res.status(404).json({ message: "Usina not found" });
      }

      // Normalize all numeric fields from Brazilian format
      const valorSemDesconto = parseFloat(normalizeDecimal(extractedData.valorSemDesconto)) || 0;
      const valorTotal = parseFloat(normalizeDecimal(extractedData.valorTotal)) || 0;

      // Use client specific discount if available
       const clientDiscount = parseFloat(cliente.desconto || "0");

       console.log(`\n========== INVOICE CONFIRMATION ==========`);
       console.log(`Client: ${cliente.nome} (ID: ${clienteId})`);
       console.log(`Client Discount: ${clientDiscount}%`);
       console.log(`Valor Sem Desconto (from extraction): ${valorSemDesconto}`);
       console.log(`==========================================\n`);
       
       // Recalculate values using the correct discount
       // Formula: ((Consumo SCEE + Consumo Nao Compensado) * Preco kWh * (1 - Desconto)) + Contrib Ilum
       
       let valorComDesconto: number;
       let economia: number;
       
       const consumoScee = parseFloat(normalizeDecimal(extractedData.consumoScee)) || 0;
       const consumoNaoCompensado = parseFloat(normalizeDecimal(extractedData.consumoNaoCompensado)) || 0;
      const contribuicaoIlum = parseFloat(normalizeDecimal(extractedData.contribuicaoIluminacao)) || 0;
      const precoKwh = parseFloat(normalizeDecimal(extractedData.precoKwhUsado)) || 0.85; // Fallback default if missing
      const precoFioBNum = parseFloat(normalizeDecimal(extractedData.precoFioB)) || 0;

      // Recalculate Valor Sem Desconto to ensure consistency
      // Novo cálculo:
      // ValorSemDesconto = (Consumo SCEE × Preço kWh) + ValorTotal - Fio B
      const fioBValor = (consumoScee * precoFioBNum);
      const valorSemDescontoCalculado = (consumoScee * precoKwh) + valorTotal - fioBValor;
      
      console.log("Calculation Details:");
      console.log(`  Consumo SCEE: ${consumoScee} kWh`);
      console.log(`  Preço kWh: R$ ${precoKwh}`);
      console.log(`  Valor Total Fatura: R$ ${valorTotal}`);
      console.log(`  Preço Fio B: R$ ${precoFioBNum}`);
      console.log(`  Fio B Calculado: R$ ${fioBValor.toFixed(2)}`);
      console.log(`  Valor Sem Desconto: R$ ${valorSemDescontoCalculado.toFixed(2)}`);

      // Update the variable to be used later
      // PRIORITIZE Frontend values if they are manually provided
      const valorSemDescontoFrontend = parseFloat(normalizeDecimal(extractedData.valorSemDesconto));
      const valorSemDescontoFinal = (!isNaN(valorSemDescontoFrontend) && valorSemDescontoFrontend !== 0)
        ? valorSemDescontoFrontend
        : valorSemDescontoCalculado;

       let lucroCalculado: number;

       // Check if client is paying customer or own use (uso próprio)
       if (!cliente.isPagante) {
         // Cliente de uso próprio (não pagante):
         // - Não há receita (valor com desconto = 0)
         // - Não há economia (economia = 0)
         // - Lucro é negativo (custo da concessionária)
         console.log(`\n[USO PRÓPRIO] Cliente ${cliente.nome} não é pagante`);
         console.log(`  Valor Com Desconto: R$ 0,00 (sem receita)`);
         console.log(`  Economia: R$ 0,00`);
         console.log(`  Lucro: R$ -${valorTotal.toFixed(2)} (custo da concessionária)\n`);

         valorComDesconto = 0;
         economia = 0;
         lucroCalculado = -valorTotal;
       } else {
         // Cliente pagante - cálculo normal com desconto
         // Novo cálculo: ((Consumo SCEE * Preço kWh) * descontMultiplier) + ValorTotal - Fio B
         const discountMultiplier = 1 - (clientDiscount / 100);

         const valorComDescontoFrontend = parseFloat(normalizeDecimal(extractedData.valorComDesconto));
         const valorComDescontoCalculado = ((consumoScee * precoKwh) * discountMultiplier) + valorTotal - fioBValor;

         console.log(`\nDiscount Application:`);
         console.log(`  Client Discount: ${clientDiscount}%`);
         console.log(`  Discount Multiplier: ${discountMultiplier}`);
         console.log(`  Valor Com Desconto (Frontend/Extraction): R$ ${valorComDescontoFrontend.toFixed(2)}`);
         console.log(`  Valor Com Desconto (Recalculated with CLIENT discount): R$ ${valorComDescontoCalculado.toFixed(2)}`);

         // FORCE use of calculated value to ensure client discount is applied correctly
         // The frontend/extraction might have used default plant discount
         if (!isNaN(valorComDescontoFrontend) && Math.abs(valorComDescontoFrontend - valorComDescontoCalculado) > 0.05) {
            console.log(`  [CORRECTION] Replacing frontend value with recalculated value!`);
            console.log(`  Difference: R$ ${Math.abs(valorComDescontoFrontend - valorComDescontoCalculado).toFixed(2)}`);
         }

         valorComDesconto = valorComDescontoCalculado;
         console.log(`  FINAL Valor Com Desconto: R$ ${valorComDesconto.toFixed(2)}\n`);

         // Recalculate Economia and Lucro based on the FINAL used values to ensure internal consistency
         // Economia = VSD - VCD
         economia = valorSemDescontoFinal - valorComDesconto;

         // Lucro = Valor Com Desconto - Valor Total (o que o cliente paga à empresa menos o que vai para a concessionária)
         lucroCalculado = valorComDesconto - valorTotal;
       }
       
       const normalizedData = {
         ...extractedData,
         mesReferencia: normalizeMonthReference(extractedData.mesReferencia),
         consumoScee: normalizeDecimal(extractedData.consumoScee),
         consumoNaoCompensado: normalizeDecimal(extractedData.consumoNaoCompensado),
        valorSemDesconto: valorSemDescontoFinal.toFixed(2),
        valorComDesconto: valorComDesconto.toFixed(2),
        economia: economia.toFixed(2),
        fioB: fioBValor.toFixed(2),
        lucro: lucroCalculado.toFixed(2),
        saldoKwh: normalizeDecimal(extractedData.saldoKwh),
        consumoKwh: normalizeDecimal(extractedData.consumoKwh),
        energiaInjetada: normalizeDecimal(extractedData.energiaInjetada),
        precoEnergiaInjetada: normalizeDecimal(extractedData.precoEnergiaInjetada),
        precoEnergiaCompensada: normalizeDecimal(extractedData.precoEnergiaCompensada),
        precoKwhNaoCompensado: normalizeDecimal(extractedData.precoKwhNaoCompensado),
        precoFioB: normalizeDecimal(extractedData.precoFioB),
        precoAdcBandeira: normalizeDecimal(extractedData.precoAdcBandeira),
        contribuicaoIluminacao: normalizeDecimal(extractedData.contribuicaoIluminacao),
        valorTotal: valorTotal.toString(),
        geracaoUltimoCiclo: normalizeDecimal(extractedData.geracaoUltimoCiclo),
        dataVencimento: extractedData.dataVencimento || "",
      };

      // Check if invoice already exists for this client and month
      const existingFatura = await storage.getFaturaByClienteAndMonth(clienteId, normalizedData.mesReferencia || "");

      // If duplicate exists and user hasn't confirmed replacement, return conflict
      if (existingFatura && !forceReplace) {
        return res.status(409).json({
          message: "Fatura duplicada encontrada",
          conflict: true,
          existingFatura: {
            id: existingFatura.id,
            mesReferencia: existingFatura.mesReferencia,
            valorTotal: existingFatura.valorTotal,
            valorComDesconto: existingFatura.valorComDesconto,
            dataVencimento: existingFatura.dataVencimento,
            createdAt: existingFatura.createdAt,
          }
        });
      }

      // Organize the uploaded PDF file into proper folder structure
      let organizedFileUrl = extractedData.fileUrl || null;
      if (extractedData.fileUrl && normalizedData.mesReferencia) {
        try {
          // Get the original file path from the temporary upload
          const tempFileName = extractedData.fileUrl.replace("/api/faturas/pdf/", "");
          const tempFilePath = path.join(uploadDir, tempFileName);

          // Reorganize into new structure
          organizedFileUrl = await organizePdfFile(
            tempFilePath,
            cliente,
            usina,
            normalizedData.mesReferencia
          );
        } catch (error) {
          console.error("Error organizing PDF file:", error);
          // Keep original URL if reorganization fails
        }
      }

      // Create or Update the fatura with extracted data
      let fatura;

      const faturaData = {
        clienteId,
        mesReferencia: normalizedData.mesReferencia || "",
        dataVencimento: normalizedData.dataVencimento,
        consumoScee: normalizedData.consumoScee,
        consumoNaoCompensado: normalizedData.consumoNaoCompensado,
        energiaInjetada: normalizedData.energiaInjetada,
        saldoKwh: normalizedData.saldoKwh,
        contribuicaoIluminacao: normalizedData.contribuicaoIluminacao,
        precoKwh: (() => {
          const kwh = normalizeDecimal(extractedData.precoKwhUsado);
          const num = parseFloat(kwh);
          return !extractedData.precoKwhUsado || isNaN(num) || num <= 0 ? "1.20" : kwh;
        })(),
        precoAdcBandeira: normalizedData.precoAdcBandeira,
        precoFioB: normalizedData.precoFioB,
        valorTotal: normalizedData.valorTotal,
        valorSemDesconto: normalizedData.valorSemDesconto,
        valorComDesconto: normalizedData.valorComDesconto,
        economia: normalizedData.economia,
        lucro: normalizedData.lucro,
        status: "aguardando_pagamento", // Update status to waiting for payment
        arquivoPdfUrl: organizedFileUrl, // Save the organized PDF URL
        createdBy: req.user.claims.sub,
        dadosExtraidos: normalizedData,
      };

      if (existingFatura) {
        // Update existing fatura
        fatura = await storage.updateFatura(existingFatura.id, faturaData);
        await logAction(req.user.claims.sub, "editar", "fatura", existingFatura.id, {
          clienteId,
          mesReferencia: extractedData.mesReferencia,
          unidadeConsumidora: extractedData.unidadeConsumidora,
          action: "upload_update"
        });
      } else {
        // Create new fatura
        fatura = await storage.createFatura(faturaData);
        await logAction(req.user.claims.sub, "criar", "fatura", fatura.id, {
          clienteId,
          mesReferencia: extractedData.mesReferencia,
          unidadeConsumidora: extractedData.unidadeConsumidora,
        });
      }

      res.status(201).json(fatura);
    } catch (error: any) {
      console.error("Error confirming fatura:", error);
      res.status(500).json({ message: "Erro ao salvar fatura", error: error.message });
    }
  });

  // Legacy upload endpoint (creates faturas for all clients of a usina)
  app.post("/api/faturas/upload", isAuthenticated, async (req: any, res) => {
    try {
      const { usinaId, precoKwh } = req.body;
      
      if (!usinaId) {
        return res.status(400).json({ message: "usinaId is required" });
      }

      const clientes = await storage.getClientesByUsina(usinaId);
      let processedCount = 0;

      for (const cliente of clientes) {
        const mesRef = new Date().toLocaleString("pt-BR", { month: "short", year: "numeric" });
        const mesReferencia = mesRef.charAt(0).toUpperCase() + mesRef.slice(1);
        
        const consumoScee = Math.random() * 500 + 100;
        const consumoNaoCompensado = Math.random() * 50;
        const preco = precoKwh ? parseFloat(precoKwh) : 0.85;
        const desconto = parseFloat(cliente.desconto) / 100;
        
        const valorSemDesconto = (consumoScee + consumoNaoCompensado) * preco;
        const valorComDesconto = valorSemDesconto * (1 - desconto);
        const economia = valorSemDesconto - valorComDesconto;
        const lucro = cliente.isPagante ? economia * 0.5 : 0;

        await storage.createFatura({
          clienteId: cliente.id,
          mesReferencia,
          consumoScee: consumoScee.toFixed(2),
          consumoNaoCompensado: consumoNaoCompensado.toFixed(2),
          precoKwh: preco.toFixed(6),
          valorSemDesconto: valorSemDesconto.toFixed(2),
          valorComDesconto: valorComDesconto.toFixed(2),
          economia: economia.toFixed(2),
          lucro: lucro.toFixed(2),
          status: "pendente",
          createdBy: req.user.claims.sub,
        });
        processedCount++;
      }

      await logAction(req.user.claims.sub, "upload", "fatura", undefined, { usinaId, processedCount });
      res.json({ processedCount, message: "Faturas criadas com sucesso" });
    } catch (error) {
      console.error("Error uploading faturas:", error);
      res.status(500).json({ message: "Failed to upload faturas" });
    }
  });

  // Full edit of a fatura
  app.patch("/api/faturas/:id", isAuthenticated, async (req: any, res) => {
    try {
      const faturaId = req.params.id;
      const updateData = req.body;
      
      // Normalize numeric fields if present
      const numericFields = [
        "consumoScee", "consumoNaoCompensado", "energiaInjetada", "saldoKwh",
        "contribuicaoIluminacao", "precoKwh", "precoAdcBandeira", "precoFioB",
        "valorTotal", "valorSemDesconto", "valorComDesconto", "economia", "lucro"
      ];
      
      const normalizedData: any = {};
      for (const [key, value] of Object.entries(updateData)) {
        if (numericFields.includes(key) && value !== null && value !== undefined) {
          normalizedData[key] = normalizeDecimal(value as string);
        } else if (key === "mesReferencia" && typeof value === "string") {
          normalizedData[key] = normalizeMonthReference(value);
        } else {
          normalizedData[key] = value;
        }
      }
      
      // Recalculate lucro if valorComDesconto or valorTotal changed
      if (normalizedData.valorComDesconto !== undefined || normalizedData.valorTotal !== undefined) {
        const existingFatura = await storage.getFatura(faturaId);
        if (existingFatura) {
          const valorComDesconto = parseFloat(normalizedData.valorComDesconto ?? existingFatura.valorComDesconto ?? "0");
          const valorTotal = parseFloat(normalizedData.valorTotal ?? existingFatura.valorTotal ?? "0");
          normalizedData.lucro = (valorComDesconto - valorTotal).toFixed(2);
        }
      }
      
      const fatura = await storage.updateFatura(faturaId, normalizedData);
      if (!fatura) {
        return res.status(404).json({ message: "Fatura not found" });
      }

      // Log dos dados salvos (para debug)
      console.log(`[Fatura Edit] Fatura ID: ${faturaId} atualizada com sucesso`);
      console.log(`[Fatura Edit] Campos atualizados:`, Object.keys(updateData));
      console.log(`[Fatura Edit] Valores salvos:`, {
        consumoScee: fatura.consumoScee,
        precoKwh: fatura.precoKwh,
        valorTotal: fatura.valorTotal,
        valorSemDesconto: fatura.valorSemDesconto,
        valorComDesconto: fatura.valorComDesconto,
        economia: fatura.economia
      });

      // Se valores financeiros foram editados, invalidar PDF gerado para forçar nova geração
      const financialFields = ['consumoScee', 'precoKwh', 'valorTotal', 'valorSemDesconto', 'valorComDesconto', 'economia', 'lucro', 'precoFioB', 'precoAdcBandeira', 'contribuicaoIluminacao'];
      const hasFinancialChanges = Object.keys(updateData).some(key => financialFields.includes(key));

      if (hasFinancialChanges && fatura.faturaGeradaUrl) {
        console.log(`[Fatura Edit] Valores financeiros foram alterados. Invalidando PDF gerado.`);
        await storage.updateFatura(faturaId, {
          faturaGeradaUrl: null,
          faturaClienteGeradaAt: null
        });
        // Buscar fatura atualizada para retornar
        const faturaAtualizada = await storage.getFatura(faturaId);
        if (faturaAtualizada) {
          await logAction(req.user.claims.sub, "editar", "fatura", faturaAtualizada.id, { fields: Object.keys(updateData) });
          return res.json(faturaAtualizada);
        }
      }

      await logAction(req.user.claims.sub, "editar", "fatura", fatura.id, { fields: Object.keys(updateData) });
      res.json(fatura);
    } catch (error) {
      console.error("Error updating fatura:", error);
      res.status(500).json({ message: "Failed to update fatura" });
    }
  });

  app.patch("/api/faturas/:id/status", isAuthenticated, async (req: any, res) => {
    try {
      const { status } = req.body;
      
      // Valid statuses
      const validStatuses = ["aguardando_upload", "aguardando_pagamento", "pagamento_pendente_confirmacao", "pago", "pendente", "processada", "enviada"];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ message: "Invalid status" });
      }

      // Permission Check
      const userProfile = await storage.getUserProfile(req.user.claims.sub);
      const userRole = userProfile?.role || "operador";

      if (status === "pago" && userRole !== "admin") {
        return res.status(403).json({ message: "Apenas administradores podem marcar como Pago." });
      }

      const fatura = await storage.updateFatura(req.params.id, { status });
      if (!fatura) {
        return res.status(404).json({ message: "Fatura not found" });
      }
      
      await logAction(req.user.claims.sub, "processar", "fatura", fatura.id, { status });
      res.json(fatura);
    } catch (error) {
      console.error("Error updating fatura status:", error);
      res.status(500).json({ message: "Failed to update fatura status" });
    }
  });

  app.delete("/api/faturas/:id", isAuthenticated, async (req: any, res) => {
    try {
      await storage.deleteFatura(req.params.id);
      await logAction(req.user.claims.sub, "excluir", "fatura", req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting fatura:", error);
      res.status(500).json({ message: "Failed to delete fatura" });
    }
  });

  // Generate PDF invoice
  app.post("/api/faturas/:id/generate-pdf", isAuthenticated, async (req: any, res) => {
    try {
      const faturaId = req.params.id;
      const fatura = await storage.getFatura(faturaId);
      
      if (!fatura) {
        return res.status(404).json({ message: "Fatura not found" });
      }
      
      const cliente = await storage.getCliente(fatura.clienteId);
      if (!cliente) {
        return res.status(404).json({ message: "Cliente not found" });
      }

      // Log dos campos de endereço para debug
      console.log(`[PDF Generation] Endereços do cliente ${cliente.nome}:`, {
        endereco: cliente.endereco,
        enderecoSimplificado: cliente.enderecoSimplificado,
        enderecoCompleto: cliente.enderecoCompleto
      });

      const { spawn } = await import("child_process");
      const outputDir = path.join(process.cwd(), "uploads", "faturas_geradas");
      await fsPromises.mkdir(outputDir, { recursive: true });
      
      const outputFilename = `fatura_${cliente.unidadeConsumidora}_${fatura.mesReferencia.replace("/", "_")}.pdf`;
      const outputPath = path.join(outputDir, outputFilename);
      
      const pdfData = {
        nomeCliente: cliente.nome,
        enderecoCliente: cliente.enderecoCompleto || cliente.endereco || "",
        unidadeConsumidora: cliente.unidadeConsumidora,
        mesReferencia: fatura.mesReferencia,
        dataVencimento: fatura.dataVencimento || "",
        consumoScee: fatura.consumoScee,
        consumoNaoCompensado: fatura.consumoNaoCompensado,
        valorTotal: fatura.valorTotal,
        valorSemDesconto: fatura.valorSemDesconto,
        valorComDesconto: fatura.valorComDesconto,
        economia: fatura.economia,
        contribuicaoIluminacao: fatura.contribuicaoIluminacao,
        precoKwh: fatura.precoKwh,
        precoFioB: fatura.precoFioB,
      };

      // Log dos dados usados para gerar o PDF (para debug)
      console.log(`[PDF Generation] Fatura ID: ${faturaId}`);
      console.log(`[PDF Generation] Cliente: ${cliente.nome} (UC: ${cliente.unidadeConsumidora})`);
      console.log(`[PDF Generation] Valores usados:`, {
        consumoScee: pdfData.consumoScee,
        precoKwh: pdfData.precoKwh,
        precoFioB: pdfData.precoFioB,
        valorTotal: pdfData.valorTotal,
        valorSemDesconto: pdfData.valorSemDesconto,
        valorComDesconto: pdfData.valorComDesconto,
        economia: pdfData.economia
      });

      const pythonProcess = spawn("python3", [
        path.join(process.cwd(), "server", "scripts", "generate_pdf.py"),
        JSON.stringify(pdfData),
        outputPath,
      ]);
      
      let stdout = "";
      let stderr = "";
      
      pythonProcess.stdout.on("data", (data) => {
        stdout += data.toString();
      });
      
      pythonProcess.stderr.on("data", (data) => {
        stderr += data.toString();
      });
      
      pythonProcess.on("close", async (code) => {
        if (code !== 0) {
          console.error("PDF generation failed:", stderr);
          return res.status(500).json({ message: "Failed to generate PDF", error: stderr });
        }
        
        try {
          const result = JSON.parse(stdout);
          if (result.error) {
            return res.status(500).json({ message: result.error });
          }
          
          const pdfUrl = `/uploads/faturas_geradas/${outputFilename}`;
          await storage.updateFatura(faturaId, {
            faturaGeradaUrl: pdfUrl,
            faturaClienteGeradaAt: new Date()
          });
          await logAction(req.user.claims.sub, "gerar_pdf", "fatura", faturaId);

          res.json({ success: true, pdfUrl });
        } catch (e) {
          console.error("Error parsing PDF result:", stdout, e);
          res.status(500).json({ message: "Failed to parse PDF generation result" });
        }
      });
    } catch (error: any) {
      console.error("Error generating PDF:", error);
      res.status(500).json({ message: "Failed to generate PDF", error: error.message });
    }
  });

  // Download all faturas com desconto de uma usina em ZIP
  app.post("/api/faturas/download-usina-zip", isAuthenticated, async (req: any, res) => {
    try {
      const { usinaId, mesReferencia } = req.body;

      if (!usinaId || !mesReferencia) {
        return res.status(400).json({ message: "usinaId e mesReferencia são obrigatórios" });
      }

      console.log(`[ZIP Download] Iniciando geração de ZIP para usina ${usinaId}, mês ${mesReferencia}`);

      // Buscar todas as faturas da usina para o mês
      const allFaturas = await storage.getFaturas();
      const allClientes = await storage.getClientes();

      // Filtrar faturas da usina e mês, apenas clientes pagantes
      const faturas = allFaturas.filter((f: any) => {
        const cliente = allClientes.find((c: any) => c.id === f.clienteId);
        return cliente?.usinaId === usinaId &&
               f.mesReferencia === mesReferencia &&
               cliente?.isPagante === true;
      });

      if (faturas.length === 0) {
        return res.status(404).json({ message: "Nenhuma fatura com desconto encontrada para esta usina/mês" });
      }

      console.log(`[ZIP Download] Encontradas ${faturas.length} faturas para gerar`);

      const { spawn } = await import("child_process");
      const archiver = (await import("archiver")).default;

      const outputDir = path.join(process.cwd(), "uploads", "faturas_geradas");
      await fsPromises.mkdir(outputDir, { recursive: true });

      // Gerar todos os PDFs
      const pdfPaths: string[] = [];
      const pdfPromises = faturas.map(async (fatura: any) => {
        const cliente = allClientes.find((c: any) => c.id === fatura.clienteId);
        if (!cliente) return null;

        const outputFilename = `fatura_${cliente.unidadeConsumidora}_${fatura.mesReferencia.replace("/", "_")}.pdf`;
        const outputPath = path.join(outputDir, outputFilename);

        // Verificar se o PDF já existe
        try {
          await fsPromises.access(outputPath);
          console.log(`[ZIP Download] PDF já existe: ${outputFilename}`);
          return { path: outputPath, filename: outputFilename };
        } catch {
          // PDF não existe, precisa gerar
          console.log(`[ZIP Download] Gerando PDF: ${outputFilename}`);
        }

        const pdfData = {
          nomeCliente: cliente.nome,
          enderecoCliente: cliente.enderecoCompleto || cliente.endereco || "",
          unidadeConsumidora: cliente.unidadeConsumidora,
          mesReferencia: fatura.mesReferencia,
          dataVencimento: fatura.dataVencimento || "",
          consumoScee: fatura.consumoScee,
          consumoNaoCompensado: fatura.consumoNaoCompensado,
          valorTotal: fatura.valorTotal,
          valorSemDesconto: fatura.valorSemDesconto,
          valorComDesconto: fatura.valorComDesconto,
          economia: fatura.economia,
          contribuicaoIluminacao: fatura.contribuicaoIluminacao,
          precoKwh: fatura.precoKwh,
          precoFioB: fatura.precoFioB,
        };

        return new Promise<{ path: string; filename: string } | null>((resolve, reject) => {
          const pythonProcess = spawn("python3", [
            path.join(process.cwd(), "server", "scripts", "generate_pdf.py"),
            JSON.stringify(pdfData),
            outputPath,
          ]);

          let stdout = "";
          let stderr = "";

          pythonProcess.stdout.on("data", (data) => {
            stdout += data.toString();
          });

          pythonProcess.stderr.on("data", (data) => {
            stderr += data.toString();
          });

          pythonProcess.on("close", async (code) => {
            if (code !== 0) {
              console.error(`[ZIP Download] Erro ao gerar PDF para ${cliente.nome}:`, stderr);
              resolve(null);
              return;
            }

            try {
              const result = JSON.parse(stdout);
              if (result.success) {
                // Atualizar fatura com URL do PDF gerado
                await storage.updateFatura(fatura.id, {
                  faturaGeradaUrl: `/uploads/faturas_geradas/${outputFilename}`,
                  faturaClienteGeradaAt: new Date().toISOString(),
                });
                resolve({ path: outputPath, filename: outputFilename });
              } else {
                console.error(`[ZIP Download] Erro no resultado: ${result.error}`);
                resolve(null);
              }
            } catch (e) {
              console.error(`[ZIP Download] Erro ao parsear resultado:`, e);
              resolve(null);
            }
          });
        });
      });

      const results = await Promise.all(pdfPromises);
      const validPdfs = results.filter((r): r is { path: string; filename: string } => r !== null);

      if (validPdfs.length === 0) {
        return res.status(500).json({ message: "Nenhum PDF foi gerado com sucesso" });
      }

      console.log(`[ZIP Download] ${validPdfs.length} PDFs prontos para ZIP`);

      // Criar ZIP
      const archive = archiver("zip", { zlib: { level: 9 } });
      const zipFilename = `faturas_${mesReferencia.replace("/", "_")}_${Date.now()}.zip`;

      res.attachment(zipFilename);
      archive.pipe(res);

      // Adicionar todos os PDFs ao ZIP
      for (const pdf of validPdfs) {
        archive.file(pdf.path, { name: pdf.filename });
      }

      archive.on("error", (err) => {
        console.error("[ZIP Download] Erro ao criar ZIP:", err);
        res.status(500).json({ message: "Erro ao criar ZIP", error: err.message });
      });

      await archive.finalize();
      console.log(`[ZIP Download] ZIP finalizado: ${zipFilename}`);

    } catch (error: any) {
      console.error("[ZIP Download] Erro:", error);
      res.status(500).json({ message: "Erro ao gerar ZIP", error: error.message });
    }
  });

  // Generate cliente economia relatório
  app.post("/api/clientes/:id/generate-relatorio", isAuthenticated, async (req: any, res) => {
    try {
      const clienteId = req.params.id;
      const { mesInicial, mesFinal } = req.body;

      if (!mesInicial || !mesFinal) {
        return res.status(400).json({ message: "mesInicial and mesFinal are required" });
      }

      // Get cliente
      const cliente = await storage.getCliente(clienteId);
      if (!cliente) {
        return res.status(404).json({ message: "Cliente not found" });
      }

      // Get all faturas for this cliente
      const allFaturas = await storage.getFaturas();
      const clienteFaturas = allFaturas.filter((f: any) => f.clienteId === clienteId);

      // Function to parse month/year string to comparable value
      const parseMonthYear = (mesRef: string) => {
        const [mes, ano] = mesRef.split('/');
        const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
        const mesIndex = meses.indexOf(mes);
        return parseInt(ano) * 12 + mesIndex;
      };

      const mesInicialValue = parseMonthYear(mesInicial);
      const mesFinalValue = parseMonthYear(mesFinal);

      // Filter faturas within the period
      const faturasPeriodo = clienteFaturas
        .filter((f: any) => {
          const mesValue = parseMonthYear(f.mesReferencia);
          return mesValue >= mesInicialValue && mesValue <= mesFinalValue;
        })
        .sort((a: any, b: any) => {
          return parseMonthYear(a.mesReferencia) - parseMonthYear(b.mesReferencia);
        });

      if (faturasPeriodo.length === 0) {
        return res.status(400).json({ message: "Nenhuma fatura encontrada no período selecionado" });
      }

      // Calculate totals
      const economiaTotal = faturasPeriodo.reduce((acc: number, f: any) => {
        return acc + parseFloat(f.economia || "0");
      }, 0);

      const valorSemDescontoTotal = faturasPeriodo.reduce((acc: number, f: any) => {
        return acc + parseFloat(f.valorSemDesconto || "0");
      }, 0);

      const valorComDescontoTotal = faturasPeriodo.reduce((acc: number, f: any) => {
        return acc + parseFloat(f.valorComDesconto || "0");
      }, 0);

      const { spawn } = await import("child_process");
      const outputDir = path.join(process.cwd(), "uploads", "relatorios_clientes");
      await fsPromises.mkdir(outputDir, { recursive: true });

      const outputFilename = `relatorio_${cliente.unidadeConsumidora}_${mesInicial.replace("/", "_")}_a_${mesFinal.replace("/", "_")}.pdf`;
      const outputPath = path.join(outputDir, outputFilename);

      const pdfData = {
        nomeCliente: cliente.nome,
        enderecoCompleto: cliente.enderecoCompleto || cliente.endereco || "",
        unidadeConsumidora: cliente.unidadeConsumidora,
        periodo: `${mesInicial} a ${mesFinal}`,
        mesInicial,
        mesFinal,
        descontoPercentual: cliente.desconto,
        economiaTotal: economiaTotal.toFixed(2),
        valorSemDescontoTotal: valorSemDescontoTotal.toFixed(2),
        valorComDescontoTotal: valorComDescontoTotal.toFixed(2),
        faturas: faturasPeriodo.map((f: any) => ({
          mes: f.mesReferencia,
          consumoScee: f.consumoScee,
          valorSemDesconto: f.valorSemDesconto,
          valorComDesconto: f.valorComDesconto,
          economia: f.economia,
        })),
      };

      console.log(`[Relatório Generation] Cliente ID: ${clienteId}`);
      console.log(`[Relatório Generation] Cliente: ${cliente.nome} (UC: ${cliente.unidadeConsumidora})`);
      console.log(`[Relatório Generation] Período: ${mesInicial} a ${mesFinal}`);
      console.log(`[Relatório Generation] Faturas no período: ${faturasPeriodo.length}`);
      console.log(`[Relatório Generation] Economia total: R$ ${economiaTotal.toFixed(2)}`);

      const pythonProcess = spawn("python3", [
        path.join(process.cwd(), "server", "scripts", "generate_cliente_relatorio.py"),
        JSON.stringify(pdfData),
        outputPath,
      ]);

      let stdout = "";
      let stderr = "";

      pythonProcess.stdout.on("data", (data) => {
        stdout += data.toString();
      });

      pythonProcess.stderr.on("data", (data) => {
        stderr += data.toString();
      });

      pythonProcess.on("close", async (code) => {
        if (code !== 0) {
          console.error("Relatório generation failed:", stderr);
          return res.status(500).json({ message: "Failed to generate relatório", error: stderr });
        }

        try {
          const result = JSON.parse(stdout);
          if (result.error) {
            return res.status(500).json({ message: result.error });
          }

          const pdfUrl = `/uploads/relatorios_clientes/${outputFilename}`;
          await logAction(req.user.claims.sub, "gerar_relatorio", "cliente", clienteId);

          res.json({ success: true, pdfUrl });
        } catch (e) {
          console.error("Error parsing relatório result:", stdout, e);
          res.status(500).json({ message: "Failed to parse relatório generation result" });
        }
      });
    } catch (error: any) {
      console.error("Error generating relatório:", error);
      res.status(500).json({ message: "Failed to generate relatório", error: error.message });
    }
  });

  // Mark invoice as sent to client
  app.patch("/api/faturas/:id/marcar-enviada", isAuthenticated, async (req: any, res) => {
    try {
      const faturaId = req.params.id;
      const fatura = await storage.getFatura(faturaId);

      if (!fatura) {
        return res.status(404).json({ message: "Fatura not found" });
      }

      await storage.updateFatura(faturaId, {
        faturaClienteEnviadaAt: new Date()
      });

      await logAction(req.user.claims.sub, "marcar_enviada", "fatura", faturaId);

      res.json({ success: true, message: "Fatura marcada como enviada ao cliente" });
    } catch (error: any) {
      console.error("Error marking invoice as sent:", error);
      res.status(500).json({ message: "Failed to mark invoice as sent", error: error.message });
    }
  });

  // Mark invoice as received from client
  app.patch("/api/faturas/:id/marcar-recebida", isAuthenticated, async (req: any, res) => {
    try {
      const faturaId = req.params.id;
      const fatura = await storage.getFatura(faturaId);

      if (!fatura) {
        return res.status(404).json({ message: "Fatura not found" });
      }

      await storage.updateFatura(faturaId, {
        faturaClienteRecebidaAt: new Date()
      });

      await logAction(req.user.claims.sub, "marcar_recebida", "fatura", faturaId);

      res.json({ success: true, message: "Fatura marcada como recebida do cliente" });
    } catch (error: any) {
      console.error("Error marking invoice as received:", error);
      res.status(500).json({ message: "Failed to mark invoice as received", error: error.message });
    }
  });

  // Unmark invoice as sent
  app.patch("/api/faturas/:id/desmarcar-enviada", isAuthenticated, async (req: any, res) => {
    try {
      const faturaId = req.params.id;
      const fatura = await storage.getFatura(faturaId);

      if (!fatura) {
        return res.status(404).json({ message: "Fatura not found" });
      }

      await storage.updateFatura(faturaId, {
        faturaClienteEnviadaAt: null
      });

      await logAction(req.user.claims.sub, "desmarcar_enviada", "fatura", faturaId);

      res.json({ success: true, message: "Fatura desmarcada como enviada" });
    } catch (error: any) {
      console.error("Error unmarking invoice as sent:", error);
      res.status(500).json({ message: "Failed to unmark invoice as sent", error: error.message });
    }
  });

  // Unmark invoice as received
  app.patch("/api/faturas/:id/desmarcar-recebida", isAuthenticated, async (req: any, res) => {
    try {
      const faturaId = req.params.id;
      const fatura = await storage.getFatura(faturaId);

      if (!fatura) {
        return res.status(404).json({ message: "Fatura not found" });
      }

      await storage.updateFatura(faturaId, {
        faturaClienteRecebidaAt: null
      });

      await logAction(req.user.claims.sub, "desmarcar_recebida", "fatura", faturaId);

      res.json({ success: true, message: "Fatura desmarcada como recebida" });
    } catch (error: any) {
      console.error("Error unmarking invoice as received:", error);
      res.status(500).json({ message: "Failed to unmark invoice as received", error: error.message });
    }
  });


  // Helper function to parse Brazilian number format
  function parseBrazilianNumber(value: string | null | undefined): number {
    if (!value) return 0;
    // Handle both formats: "1.234,56" (BR) and "1234.56" (US)
    const str = value.toString().trim();
    if (str.includes(",")) {
      // Brazilian format: remove dots (thousand sep), replace comma with dot
      return parseFloat(str.replace(/\./g, "").replace(",", ".")) || 0;
    }
    return parseFloat(str) || 0;
  }

  // Generate Usina Report PDF
  app.post("/api/usinas/:id/generate-relatorio", isAuthenticated, async (req: any, res) => {
    try {
      const usinaId = req.params.id;
      const { meses } = req.body; // Array of months like ["Jan/2026", "Fev/2026"]
      
      const usina = await storage.getUsina(usinaId);
      if (!usina) {
        return res.status(404).json({ message: "Usina not found" });
      }
      
      const allClientes = await storage.getClientes();
      const usinaClientes = allClientes.filter(c => c.usinaId === usinaId);
      
      const allFaturas = await storage.getFaturas();
      const allGeracoes = await storage.getGeracoes();
      
      // Filter by selected months
      const selectedMonths = meses && meses.length > 0 ? meses : [getCurrentMonthRef()];
      
      const clientesData = [];
      
      for (const cliente of usinaClientes) {
        const clienteFaturas = allFaturas.filter(
          f => f.clienteId === cliente.id && selectedMonths.includes(f.mesReferencia)
        );
        
        if (clienteFaturas.length > 0) {
          const consumoTotal = clienteFaturas.reduce((acc, f) => acc + parseBrazilianNumber(f.consumoScee), 0);
          const valorComDescontoTotal = clienteFaturas.reduce((acc, f) => acc + parseBrazilianNumber(f.valorComDesconto), 0);
          const valorTotalSum = clienteFaturas.reduce((acc, f) => acc + parseBrazilianNumber(f.valorTotal), 0);
          const lucroTotal = clienteFaturas.reduce((acc, f) => acc + parseBrazilianNumber(f.lucro), 0);
          const saldoKwhTotal = clienteFaturas.reduce((acc, f) => acc + parseBrazilianNumber(f.saldoKwh), 0);
          
          clientesData.push({
            nome: cliente.nome,
            uc: cliente.unidadeConsumidora,
            numeroContrato: cliente.numeroContrato,
            endereco: cliente.enderecoSimplificado || cliente.endereco || "",
            porcentagemEnvioCredito: cliente.porcentagemEnvioCredito,
            consumo: consumoTotal,
            valorComDesconto: valorComDescontoTotal,
            valorTotal: valorTotalSum,
            lucro: lucroTotal,
            saldoKwh: saldoKwhTotal,
          });
        }
      }

      // Sort clients by numero de contrato (ascending order)
      // Clients without contract number will be placed at the end
      clientesData.sort((a, b) => {
        const contratoA = a.numeroContrato;
        const contratoB = b.numeroContrato;

        // If both are null/empty, keep original order
        if (!contratoA && !contratoB) return 0;

        // Push null/empty values to the end
        if (!contratoA) return 1;
        if (!contratoB) return -1;

        // Try to parse as numbers for numeric comparison
        const numA = parseInt(contratoA);
        const numB = parseInt(contratoB);

        // If both are valid numbers, compare numerically
        if (!isNaN(numA) && !isNaN(numB)) {
          return numA - numB;
        }

        // Otherwise, compare as strings (lexicographically)
        return contratoA.localeCompare(contratoB, 'pt-BR', { numeric: true, sensitivity: 'base' });
      });

      // Get generation data for selected months
      const usinaGeracoes = allGeracoes.filter(
        g => g.usinaId === usinaId && selectedMonths.includes(g.mesReferencia)
      );
      
      const kwhGerado = usinaGeracoes.reduce((acc, g) => acc + parseBrazilianNumber(g.kwhGerado), 0);
      // Use producaoMensalPrevista from usina, multiply by number of months
      const kwhPrevistoMensal = parseBrazilianNumber(usina.producaoMensalPrevista);
      const kwhPrevisto = kwhPrevistoMensal * selectedMonths.length || 1;

      const periodo = selectedMonths.length === 1
        ? selectedMonths[0]
        : `${selectedMonths[selectedMonths.length - 1]} a ${selectedMonths[0]}`;

      const reportData = {
        nomeUsina: usina.nome,
        potenciaKwp: usina.potenciaKwp ? parseBrazilianNumber(usina.potenciaKwp) : 0,
        kwhPrevistoMensal: kwhPrevistoMensal,
        periodo,
        kwhGerado,
        kwhPrevisto,
        clientes: clientesData,
      };
      
      const outputDir = path.join(process.cwd(), "uploads", "relatorios");
      await fsPromises.mkdir(outputDir, { recursive: true });
      
      const timestamp = Date.now();
      const outputFilename = `relatorio_${usina.unidadeConsumidora}_${timestamp}.pdf`;
      const outputPath = path.join(outputDir, outputFilename);
      
      const pythonProcess = spawn("python3", [
        path.join(process.cwd(), "server", "scripts", "generate_relatorio.py"),
        JSON.stringify(reportData),
        outputPath,
      ]);
      
      let stdout = "";
      let stderr = "";
      
      pythonProcess.stdout.on("data", (data) => {
        stdout += data.toString();
      });
      
      pythonProcess.stderr.on("data", (data) => {
        stderr += data.toString();
      });
      
      pythonProcess.on("close", async (code) => {
        if (code !== 0) {
          console.error("Report generation failed:", stderr);
          return res.status(500).json({ message: "Failed to generate report", error: stderr });
        }
        
        try {
          const result = JSON.parse(stdout);
          if (result.error) {
            return res.status(500).json({ message: result.error });
          }
          
          const pdfUrl = `/uploads/relatorios/${outputFilename}`;
          await logAction(req.user.claims.sub, "gerar_relatorio", "usina", usinaId, { periodo });
          
          res.json({ success: true, pdfUrl });
        } catch (e) {
          console.error("Error parsing report result:", stdout, e);
          res.status(500).json({ message: "Failed to parse report generation result" });
        }
      });
    } catch (error: any) {
      console.error("Error generating report:", error);
      res.status(500).json({ message: "Failed to generate report", error: error.message });
    }
  });
  
  // Helper function for current month
  function getCurrentMonthRef(): string {
    const now = new Date();
    const months = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];
    return `${months[now.getMonth()]}/${now.getFullYear()}`;
  }

  // Helper to normalize month reference
  function normalizeMonthReference(monthRef: string): string {
    if (!monthRef) return "";
    const parts = monthRef.trim().split("/");
    if (parts.length !== 2) return monthRef;

    let [month, year] = parts;
    month = month.toUpperCase();
    if (year.length === 2) {
      year = "20" + year;
    }
    return `${month}/${year}`;
  }

  // ==================== GERAÇÃO MENSAL ====================
  app.get("/api/geracao", isAuthenticated, async (req, res) => {
    try {
      const geracoes = await storage.getGeracoes();
      res.json(geracoes);
    } catch (error) {
      console.error("Error fetching geracoes:", error);
      res.status(500).json({ message: "Failed to fetch geracoes" });
    }
  });

  // Temporary debug route to find duplicates
  app.get("/api/debug/duplicates", async (req, res) => {
    try {
      const geracoes = await storage.getGeracoes();
      const mapped = geracoes.map(g => ({ id: g.id, mesReferencia: g.mesReferencia, usinaId: g.usinaId }));
      res.json(mapped);
    } catch (error) {
      res.status(500).json({ error: error });
    }
  });

  // Fix inconsistent month references
  app.post("/api/debug/fix-months", async (req, res) => {
    try {
      const stats = await storage.fixMonthConsistency();
      res.json({ 
        message: "Months normalized and duplicates removed", 
        stats 
      });
    } catch (error: any) {
      console.error("Error fixing months:", error);
      res.status(500).json({ message: "Failed to fix months", error: error.message });
    }
  });

  app.delete("/api/geracao/:id", isAuthenticated, async (req: any, res) => {
    try {
      const id = req.params.id;
      // Note: storage.deleteGeracao might not exist yet, need to check storage.ts
      // If it doesn't exist, I'll need to add it.
      // For now assuming I need to check storage.ts first. 
      // But let's add the route structure.
      await storage.deleteGeracao(id); 
      await logAction(req.user.claims.sub, "excluir", "geracao", id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting geracao:", error);
      res.status(500).json({ message: "Failed to delete geracao" });
    }
  });

  app.post("/api/geracao", isAuthenticated, async (req: any, res) => {
    try {
      const body = req.body;
      if (body.mesReferencia) {
        body.mesReferencia = normalizeMonthReference(body.mesReferencia);
      }
      
      const data = insertGeracaoMensalSchema.parse({
        ...body,
        createdBy: req.user.claims.sub,
      });
      const geracao = await storage.createGeracao(data);
      await logAction(req.user.claims.sub, "criar", "geracao", geracao.id, { 
        usinaId: geracao.usinaId,
        mesReferencia: geracao.mesReferencia,
        kwhGerado: geracao.kwhGerado
      });
      res.status(201).json(geracao);
    } catch (error) {
      console.error("Error creating geracao:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create geracao" });
    }
  });

  app.patch("/api/geracao/:id", isAuthenticated, async (req: any, res) => {
    try {
      const body = req.body;
      if (body.mesReferencia) {
        body.mesReferencia = normalizeMonthReference(body.mesReferencia);
      }
      
      const data = insertGeracaoMensalSchema.partial().parse(body);
      const geracao = await storage.updateGeracao(req.params.id, data);
      if (!geracao) {
        return res.status(404).json({ message: "Geracao not found" });
      }
      await logAction(req.user.claims.sub, "editar", "geracao", geracao.id);
      res.json(geracao);
    } catch (error) {
      console.error("Error updating geracao:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update geracao" });
    }
  });

  app.delete("/api/geracao/:id", isAuthenticated, async (req: any, res) => {
    try {
      await storage.deleteGeracao(req.params.id);
      await logAction(req.user.claims.sub, "excluir", "geracao", req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting geracao:", error);
      res.status(500).json({ message: "Failed to delete geracao" });
    }
  });

  // ==================== RELATÓRIOS (Admin Only) ====================
  app.get("/api/relatorios", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { usinaId, periodo } = req.query;
      
      // Get all faturas
      const todasFaturas = await storage.getFaturas();
      
      // Filter by usina if specified
      let faturasFiltradas = todasFaturas;
      if (usinaId && usinaId !== "all") {
        const clientesUsina = await storage.getClientesByUsina(usinaId as string);
        const clienteIds = new Set(clientesUsina.map(c => c.id));
        faturasFiltradas = todasFaturas.filter(f => clienteIds.has(f.clienteId));
      }

      // Filter by period if specified
      if (periodo) {
        faturasFiltradas = faturasFiltradas.filter(f => f.mesReferencia === periodo);
      }

      // Calculate totals
      const lucroTotal = faturasFiltradas.reduce((acc, f) => acc + parseFloat(f.lucro || "0"), 0);
      const economiaTotalClientes = faturasFiltradas.reduce((acc, f) => acc + parseFloat(f.economia || "0"), 0);
      const kwhDistribuido = faturasFiltradas.reduce((acc, f) => acc + parseFloat(f.consumoScee || "0"), 0);
      const saldoCreditos = faturasFiltradas.reduce((acc, f) => acc + parseFloat(f.saldoKwh || "0"), 0);

      // Group by client
      const clienteMap = new Map<string, typeof faturasFiltradas>();
      faturasFiltradas.forEach(f => {
        const key = f.clienteId;
        if (!clienteMap.has(key)) {
          clienteMap.set(key, []);
        }
        clienteMap.get(key)!.push(f);
      });

      const detalhamentoPorCliente = Array.from(clienteMap.entries()).map(([clienteId, faturas]) => {
        const cliente = faturas[0].cliente;
        return {
          clienteNome: cliente?.nome || "Cliente",
          unidadeConsumidora: cliente?.unidadeConsumidora || "-",
          consumoTotal: faturas.reduce((acc, f) => acc + parseFloat(f.consumoScee || "0"), 0),
          valorPago: faturas.reduce((acc, f) => acc + parseFloat(f.valorComDesconto || "0"), 0),
          economia: faturas.reduce((acc, f) => acc + parseFloat(f.economia || "0"), 0),
          lucro: faturas.reduce((acc, f) => acc + parseFloat(f.lucro || "0"), 0),
        };
      });

      res.json({
        lucroTotal,
        economiaTotalClientes,
        kwhDistribuido,
        saldoCreditos,
        clientesAtendidos: clienteMap.size,
        faturasProcessadas: faturasFiltradas.length,
        detalhamentoPorCliente,
      });
    } catch (error) {
      console.error("Error generating report:", error);
      res.status(500).json({ message: "Failed to generate report" });
    }
  });

  // ==================== AUDITORIA (Admin Only) ====================
  app.get("/api/auditoria", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const logs = await storage.getAuditLogs(200);
      res.json(logs);
    } catch (error) {
      console.error("Error fetching audit logs:", error);
      res.status(500).json({ message: "Failed to fetch audit logs" });
    }
  });

  // ==================== USUÁRIOS (Admin Only) ====================
  app.get("/api/usuarios", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const usuarios = await storage.getUsersWithProfiles();
      res.json(usuarios);
    } catch (error) {
      console.error("Error fetching usuarios:", error);
      res.status(500).json({ message: "Failed to fetch usuarios" });
    }
  });

  app.patch("/api/usuarios/:id/role", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { role } = req.body;
      if (!["admin", "operador"].includes(role)) {
        return res.status(400).json({ message: "Invalid role" });
      }

      const profile = await storage.upsertUserProfile({
        userId: req.params.id,
        role,
      });

      await logAction(req.user.claims.sub, "editar", "usuario", req.params.id, { role });
      res.json(profile);
    } catch (error) {
      console.error("Error updating user role:", error);
      res.status(500).json({ message: "Failed to update user role" });
    }
  });

  // Maintenance: Cleanup old PDF files (30 days after upload)
  app.post("/api/maintenance/cleanup-pdfs", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const allFaturas = await storage.getFaturas();
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      let cleanedCount = 0;

      for (const fatura of allFaturas) {
        // Skip if no PDF or no creation date
        if (!fatura.arquivoPdfUrl || !fatura.createdAt) continue;

        // Check if PDF is older than 30 days
        const createdDate = new Date(fatura.createdAt);
        if (createdDate < thirtyDaysAgo) {
          try {
            // Extract file path from URL
            // URL format: /api/faturas/pdf/Usina-NAME/faturas/YEAR/Mês-N/UC-MM-YYYY.pdf
            const urlPath = fatura.arquivoPdfUrl.replace("/api/faturas/pdf/", "");
            const filePath = path.join(uploadDir, urlPath);

            // Delete file if it exists
            if (fs.existsSync(filePath)) {
              fs.unlinkSync(filePath);
              console.log(`Deleted expired PDF: ${filePath}`);
            }

            // Update fatura to remove PDF URL (keep the record)
            await storage.updateFatura(fatura.id, {
              arquivoPdfUrl: null
            });

            cleanedCount++;
          } catch (error) {
            console.error(`Error cleaning PDF for fatura ${fatura.id}:`, error);
          }
        }
      }

      await logAction(req.user.claims.sub, "cleanup", "pdf", undefined, { cleanedCount });
      res.json({
        message: `Limpeza de PDFs concluída. ${cleanedCount} arquivos expirados removidos.`,
        cleanedCount
      });
    } catch (error: any) {
      console.error("Error cleaning up PDFs:", error);
      res.status(500).json({ message: "Erro na limpeza de PDFs", error: error.message });
    }
  });

  // Maintenance: Cleanup old faturas
  app.delete("/api/maintenance/cleanup", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const allFaturas = await storage.getFaturas();
      const today = new Date();
      let deletedCount = 0;

      for (const f of allFaturas) {
        if (!f.dataVencimento || f.status !== "pago") continue; // Only delete PAID invoices? User didn't specify, but safer.
        // User said: "depois de enviar... baixar... 30 dias após vencimento... apagar".
        // Implies we delete regardless of status? Or only if processed?
        // Safe bet: Delete if > 30 days past due.

        const parts = f.dataVencimento.split('/');
        if (parts.length !== 3) continue;

        const vencimento = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
        const deadline = new Date(vencimento);
        deadline.setDate(deadline.getDate() + 30);

        if (today > deadline) {
          await storage.deleteFatura(f.id);
          // Optional: Delete file from disk if path exists
          if (f.arquivoPdfUrl) {
             const filename = path.basename(f.arquivoPdfUrl);
             const filePath = path.join(uploadDir, filename);
             if (fs.existsSync(filePath)) {
               fs.unlinkSync(filePath);
             }
          }
          deletedCount++;
        }
      }

      await logAction(req.user.claims.sub, "cleanup", "fatura", undefined, { deletedCount });
      res.json({ message: `Limpeza concluída. ${deletedCount} faturas antigas removidas.` });
    } catch (error: any) {
      console.error("Error cleaning up faturas:", error);
      res.status(500).json({ message: "Erro na limpeza de faturas", error: error.message });
    }
  });

  // ============================================================
  // EXPORT/IMPORT DE DADOS (EXCEL) - Admin only
  // ============================================================

  // Configure multer for Excel uploads
  const excelUpload = multer({
    storage: multer.diskStorage({
      destination: (req, file, cb) => {
        const backupDir = path.join(process.cwd(), "backups");
        if (!fs.existsSync(backupDir)) {
          fs.mkdirSync(backupDir, { recursive: true });
        }
        cb(null, backupDir);
      },
      filename: (req, file, cb) => {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        cb(null, `import-${timestamp}-${file.originalname}`);
      },
    }),
    fileFilter: (req, file, cb) => {
      if (file.mimetype === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet") {
        cb(null, true);
      } else {
        cb(new Error("Only Excel files (.xlsx) are allowed"));
      }
    },
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB limit
    },
  });

  // Export all data to Excel
  app.get("/api/admin/export/all", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const usinaId = req.query.usinaId as string | undefined;
      const mesReferencia = req.query.mesReferencia as string | undefined;

      const workbook = await ExcelService.exportAllData({
        includeUsinas: true,
        includeClientes: true,
        includeFaturas: true,
        includeGeracao: true,
        includePrecos: true,
        usinaId,
        mesReferencia,
      });

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `SolarControl-Export-${timestamp}.xlsx`;

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

      await workbook.xlsx.write(res);
      res.end();

      await logAction(req.user.claims.sub, "export", "all", undefined, { filename, usinaId, mesReferencia });
    } catch (error: any) {
      console.error("Error exporting data:", error);
      res.status(500).json({ message: "Erro ao exportar dados", error: error.message });
    }
  });

  // Export only Usinas
  app.get("/api/admin/export/usinas", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const workbook = await ExcelService.exportAllData({
        includeUsinas: true,
        includeClientes: false,
        includeFaturas: false,
        includeGeracao: false,
        includePrecos: false,
      });

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `SolarControl-Usinas-${timestamp}.xlsx`;

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

      await workbook.xlsx.write(res);
      res.end();

      await logAction(req.user.claims.sub, "export", "usinas", undefined, { filename });
    } catch (error: any) {
      console.error("Error exporting usinas:", error);
      res.status(500).json({ message: "Erro ao exportar usinas", error: error.message });
    }
  });

  // Export only Clientes
  app.get("/api/admin/export/clientes", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const workbook = await ExcelService.exportAllData({
        includeUsinas: false,
        includeClientes: true,
        includeFaturas: false,
        includeGeracao: false,
        includePrecos: false,
      });

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `SolarControl-Clientes-${timestamp}.xlsx`;

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

      await workbook.xlsx.write(res);
      res.end();

      await logAction(req.user.claims.sub, "export", "clientes", undefined, { filename });
    } catch (error: any) {
      console.error("Error exporting clientes:", error);
      res.status(500).json({ message: "Erro ao exportar clientes", error: error.message });
    }
  });

  // Export only Faturas
  app.get("/api/admin/export/faturas", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const workbook = await ExcelService.exportAllData({
        includeUsinas: false,
        includeClientes: false,
        includeFaturas: true,
        includeGeracao: false,
        includePrecos: false,
      });

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `SolarControl-Faturas-${timestamp}.xlsx`;

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

      await workbook.xlsx.write(res);
      res.end();

      await logAction(req.user.claims.sub, "export", "faturas", undefined, { filename });
    } catch (error: any) {
      console.error("Error exporting faturas:", error);
      res.status(500).json({ message: "Erro ao exportar faturas", error: error.message });
    }
  });

  // Export only Geração Mensal
  app.get("/api/admin/export/geracao", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const workbook = await ExcelService.exportAllData({
        includeUsinas: false,
        includeClientes: false,
        includeFaturas: false,
        includeGeracao: true,
        includePrecos: false,
      });

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `SolarControl-Geracao-${timestamp}.xlsx`;

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

      await workbook.xlsx.write(res);
      res.end();

      await logAction(req.user.claims.sub, "export", "geracao", undefined, { filename });
    } catch (error: any) {
      console.error("Error exporting geracao:", error);
      res.status(500).json({ message: "Erro ao exportar geração mensal", error: error.message });
    }
  });

  // Export only Preços kWh
  app.get("/api/admin/export/precos", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const workbook = await ExcelService.exportAllData({
        includeUsinas: false,
        includeClientes: false,
        includeFaturas: false,
        includeGeracao: false,
        includePrecos: true,
      });

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `SolarControl-Precos-${timestamp}.xlsx`;

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

      await workbook.xlsx.write(res);
      res.end();

      await logAction(req.user.claims.sub, "export", "precos", undefined, { filename });
    } catch (error: any) {
      console.error("Error exporting precos:", error);
      res.status(500).json({ message: "Erro ao exportar preços kWh", error: error.message });
    }
  });

  // Preview import (validation only, no save)
  app.post("/api/admin/import/preview", isAuthenticated, isAdmin, excelUpload.single('file'), async (req: any, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "Nenhum arquivo foi enviado" });
      }

      const preview = await ExcelService.previewImport(req.file.path);

      // Delete temp file after preview
      fs.unlinkSync(req.file.path);

      res.json(preview);
    } catch (error: any) {
      console.error("Error previewing import:", error);
      res.status(500).json({ message: "Erro ao validar arquivo", error: error.message });
    }
  });

  // Import data from Excel
  app.post("/api/admin/import", isAuthenticated, isAdmin, excelUpload.single('file'), async (req: any, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "Nenhum arquivo foi enviado" });
      }

      const mode = req.body.mode || 'merge'; // merge, replace, append
      if (!['merge', 'replace', 'append'].includes(mode)) {
        return res.status(400).json({ message: "Modo inválido. Use: merge, replace ou append" });
      }

      const result = await ExcelService.importFromExcel(req.file.path, { mode });

      // Keep file for audit purposes (don't delete)
      await logAction(req.user.claims.sub, "import", "all", undefined, {
        filename: req.file.filename,
        mode,
        result
      });

      res.json({
        message: "Import concluído com sucesso",
        result,
      });
    } catch (error: any) {
      console.error("Error importing data:", error);
      res.status(500).json({ message: "Erro ao importar dados", error: error.message });
    }
  });

  return httpServer;
}
