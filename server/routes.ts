import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated, registerAuthRoutes } from "./replit_integrations/auth";
import { insertUsinaSchema, insertClienteSchema, insertFaturaSchema, insertGeracaoMensalSchema } from "@shared/schema";
import { z } from "zod";

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
      const faturas = await storage.getFaturas(status);
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

  // Upload faturas (simplified - in production would handle PDF parsing)
  app.post("/api/faturas/upload", isAuthenticated, async (req: any, res) => {
    try {
      // For MVP, we'll create a sample fatura entry
      // In production, this would parse the PDF and extract data
      const { usinaId, precoKwh } = req.body;
      
      if (!usinaId) {
        return res.status(400).json({ message: "usinaId is required" });
      }

      // Get clients for this usina
      const clientes = await storage.getClientesByUsina(usinaId);
      let processedCount = 0;

      // Create sample faturas for each client (in production, this would parse PDFs)
      for (const cliente of clientes) {
        const mesRef = new Date().toLocaleString("pt-BR", { month: "short", year: "numeric" });
        const mesReferencia = mesRef.charAt(0).toUpperCase() + mesRef.slice(1);
        
        // Sample calculation (in production, extract from PDF)
        const consumoScee = Math.random() * 500 + 100;
        const consumoNaoCompensado = Math.random() * 50;
        const preco = precoKwh ? parseFloat(precoKwh) : 0.85;
        const desconto = parseFloat(cliente.desconto) / 100;
        
        const valorSemDesconto = (consumoScee + consumoNaoCompensado) * preco;
        const valorComDesconto = valorSemDesconto * (1 - desconto);
        const economia = valorSemDesconto - valorComDesconto;
        const lucro = cliente.isPagante ? economia * 0.5 : 0; // 50% margin example

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

      await logAction(req.user.claims.sub, "upload", "fatura", undefined, { 
        usinaId, 
        processedCount 
      });

      res.json({ processedCount, message: "Faturas criadas com sucesso" });
    } catch (error) {
      console.error("Error uploading faturas:", error);
      res.status(500).json({ message: "Failed to upload faturas" });
    }
  });

  app.patch("/api/faturas/:id/status", isAuthenticated, async (req: any, res) => {
    try {
      const { status } = req.body;
      if (!["pendente", "processada", "enviada"].includes(status)) {
        return res.status(400).json({ message: "Invalid status" });
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

  app.post("/api/geracao", isAuthenticated, async (req: any, res) => {
    try {
      const data = insertGeracaoMensalSchema.parse({
        ...req.body,
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
      const data = insertGeracaoMensalSchema.partial().parse(req.body);
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

  return httpServer;
}
