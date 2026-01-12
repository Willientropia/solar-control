import {
  usinas,
  clientes,
  faturas,
  geracaoMensal,
  auditLogs,
  userProfiles,
  type Usina,
  type InsertUsina,
  type Cliente,
  type InsertCliente,
  type Fatura,
  type InsertFatura,
  type GeracaoMensal,
  type InsertGeracaoMensal,
  type AuditLog,
  type InsertAuditLog,
  type UserProfile,
  type InsertUserProfile,
} from "@shared/schema";
import { users, type User } from "@shared/models/auth";
import { db } from "./db";
import { eq, desc, and, sql } from "drizzle-orm";

export interface IStorage {
  // Usinas
  getUsinas(): Promise<Usina[]>;
  getUsina(id: string): Promise<Usina | undefined>;
  createUsina(data: InsertUsina): Promise<Usina>;
  updateUsina(id: string, data: Partial<InsertUsina>): Promise<Usina | undefined>;
  deleteUsina(id: string): Promise<boolean>;

  // Clientes
  getClientes(): Promise<(Cliente & { usina?: Usina })[]>;
  getCliente(id: string): Promise<Cliente | undefined>;
  getClientesByUsina(usinaId: string): Promise<Cliente[]>;
  getClienteByUC(unidadeConsumidora: string): Promise<Cliente | undefined>;
  createCliente(data: InsertCliente): Promise<Cliente>;
  updateCliente(id: string, data: Partial<InsertCliente>): Promise<Cliente | undefined>;
  deleteCliente(id: string): Promise<boolean>;

  // Faturas
  getFaturas(status?: string): Promise<(Fatura & { cliente?: Cliente })[]>;
  getFatura(id: string): Promise<Fatura | undefined>;
  getFaturasByCliente(clienteId: string): Promise<Fatura[]>;
  createFatura(data: InsertFatura): Promise<Fatura>;
  updateFatura(id: string, data: Partial<InsertFatura>): Promise<Fatura | undefined>;
  deleteFatura(id: string): Promise<boolean>;

  // Geração Mensal
  getGeracoes(): Promise<(GeracaoMensal & { usina?: Usina })[]>;
  getGeracao(id: string): Promise<GeracaoMensal | undefined>;
  getGeracaoByUsina(usinaId: string, mesReferencia?: string): Promise<GeracaoMensal[]>;
  createGeracao(data: InsertGeracaoMensal): Promise<GeracaoMensal>;
  updateGeracao(id: string, data: Partial<InsertGeracaoMensal>): Promise<GeracaoMensal | undefined>;
  deleteGeracao(id: string): Promise<boolean>;

  // Audit Logs
  getAuditLogs(limit?: number): Promise<(AuditLog & { user?: User })[]>;
  createAuditLog(data: InsertAuditLog): Promise<AuditLog>;

  // User Profiles
  getUserProfile(userId: string): Promise<UserProfile | undefined>;
  upsertUserProfile(data: InsertUserProfile): Promise<UserProfile>;
  getUsersWithProfiles(): Promise<(User & { profile?: UserProfile })[]>;

  // Dashboard Stats
  getDashboardStats(): Promise<{
    totalUsinas: number;
    totalClientes: number;
    faturasPendentes: number;
    faturasProcessadas: number;
    faturasEmAtraso: number;
    lucroMensal: number;
    economiaTotalClientes: number;
    kwhGeradoMes: number;
    saldoTotalKwh: number;
  }>;
  
  // Faturas em atraso
  getFaturasEmAtraso(): Promise<(Fatura & { cliente?: Cliente })[]>;
}

export class DatabaseStorage implements IStorage {
  // ==================== USINAS ====================
  async getUsinas(): Promise<Usina[]> {
    return db.select().from(usinas).orderBy(desc(usinas.createdAt));
  }

  async getUsina(id: string): Promise<Usina | undefined> {
    const [usina] = await db.select().from(usinas).where(eq(usinas.id, id));
    return usina;
  }

  async createUsina(data: InsertUsina): Promise<Usina> {
    const [usina] = await db.insert(usinas).values(data).returning();
    return usina;
  }

  async updateUsina(id: string, data: Partial<InsertUsina>): Promise<Usina | undefined> {
    const [usina] = await db
      .update(usinas)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(usinas.id, id))
      .returning();
    return usina;
  }

  async deleteUsina(id: string): Promise<boolean> {
    const result = await db.delete(usinas).where(eq(usinas.id, id));
    return true;
  }

  // ==================== CLIENTES ====================
  async getClientes(): Promise<(Cliente & { usina?: Usina })[]> {
    const result = await db
      .select()
      .from(clientes)
      .leftJoin(usinas, eq(clientes.usinaId, usinas.id))
      .orderBy(desc(clientes.createdAt));

    return result.map((row) => ({
      ...row.clientes,
      usina: row.usinas || undefined,
    }));
  }

  async getCliente(id: string): Promise<Cliente | undefined> {
    const [cliente] = await db.select().from(clientes).where(eq(clientes.id, id));
    return cliente;
  }

  async getClientesByUsina(usinaId: string): Promise<Cliente[]> {
    return db.select().from(clientes).where(eq(clientes.usinaId, usinaId));
  }

  async getClienteByUC(unidadeConsumidora: string): Promise<Cliente | undefined> {
    const [cliente] = await db
      .select()
      .from(clientes)
      .where(eq(clientes.unidadeConsumidora, unidadeConsumidora));
    return cliente;
  }

  async createCliente(data: InsertCliente): Promise<Cliente> {
    const [cliente] = await db.insert(clientes).values(data).returning();
    return cliente;
  }

  async updateCliente(id: string, data: Partial<InsertCliente>): Promise<Cliente | undefined> {
    const [cliente] = await db
      .update(clientes)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(clientes.id, id))
      .returning();
    return cliente;
  }

  async deleteCliente(id: string): Promise<boolean> {
    await db.delete(clientes).where(eq(clientes.id, id));
    return true;
  }

  // ==================== FATURAS ====================
  async getFaturas(status?: string): Promise<(Fatura & { cliente?: Cliente })[]> {
    let query = db
      .select()
      .from(faturas)
      .leftJoin(clientes, eq(faturas.clienteId, clientes.id))
      .orderBy(desc(faturas.createdAt));

    const result = await query;

    return result
      .filter((row) => !status || row.faturas.status === status)
      .map((row) => ({
        ...row.faturas,
        cliente: row.clientes || undefined,
      }));
  }

  async getFatura(id: string): Promise<Fatura | undefined> {
    const [fatura] = await db.select().from(faturas).where(eq(faturas.id, id));
    return fatura;
  }

  async getFaturasByCliente(clienteId: string): Promise<Fatura[]> {
    return db.select().from(faturas).where(eq(faturas.clienteId, clienteId));
  }

  async createFatura(data: InsertFatura): Promise<Fatura> {
    const [fatura] = await db.insert(faturas).values(data).returning();
    return fatura;
  }

  async updateFatura(id: string, data: Partial<InsertFatura>): Promise<Fatura | undefined> {
    const [fatura] = await db
      .update(faturas)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(faturas.id, id))
      .returning();
    return fatura;
  }

  async deleteFatura(id: string): Promise<boolean> {
    await db.delete(faturas).where(eq(faturas.id, id));
    return true;
  }

  // ==================== GERAÇÃO MENSAL ====================
  async getGeracoes(): Promise<(GeracaoMensal & { usina?: Usina })[]> {
    const result = await db
      .select()
      .from(geracaoMensal)
      .leftJoin(usinas, eq(geracaoMensal.usinaId, usinas.id))
      .orderBy(desc(geracaoMensal.createdAt));

    return result.map((row) => ({
      ...row.geracao_mensal,
      usina: row.usinas || undefined,
    }));
  }

  async getGeracao(id: string): Promise<GeracaoMensal | undefined> {
    const [geracao] = await db.select().from(geracaoMensal).where(eq(geracaoMensal.id, id));
    return geracao;
  }

  async getGeracaoByUsina(usinaId: string, mesReferencia?: string): Promise<GeracaoMensal[]> {
    if (mesReferencia) {
      return db
        .select()
        .from(geracaoMensal)
        .where(
          and(eq(geracaoMensal.usinaId, usinaId), eq(geracaoMensal.mesReferencia, mesReferencia))
        );
    }
    return db.select().from(geracaoMensal).where(eq(geracaoMensal.usinaId, usinaId));
  }

  async createGeracao(data: InsertGeracaoMensal): Promise<GeracaoMensal> {
    // Check if generation is below 90% of expected
    const usina = await this.getUsina(data.usinaId);
    const alertaBaixaGeracao =
      usina && parseFloat(data.kwhGerado) < parseFloat(usina.producaoMensalPrevista) * 0.9;

    const [geracao] = await db
      .insert(geracaoMensal)
      .values({ ...data, alertaBaixaGeracao })
      .returning();
    return geracao;
  }

  async updateGeracao(
    id: string,
    data: Partial<InsertGeracaoMensal>
  ): Promise<GeracaoMensal | undefined> {
    // Recalculate alert if kwhGerado is updated
    let alertaBaixaGeracao: boolean | undefined;
    if (data.kwhGerado && data.usinaId) {
      const usina = await this.getUsina(data.usinaId);
      alertaBaixaGeracao =
        usina && parseFloat(data.kwhGerado) < parseFloat(usina.producaoMensalPrevista) * 0.9;
    }

    const [geracao] = await db
      .update(geracaoMensal)
      .set({ ...data, ...(alertaBaixaGeracao !== undefined && { alertaBaixaGeracao }) })
      .where(eq(geracaoMensal.id, id))
      .returning();
    return geracao;
  }

  async deleteGeracao(id: string): Promise<boolean> {
    await db.delete(geracaoMensal).where(eq(geracaoMensal.id, id));
    return true;
  }

  // ==================== AUDIT LOGS ====================
  async getAuditLogs(limit = 100): Promise<(AuditLog & { user?: User })[]> {
    const result = await db
      .select()
      .from(auditLogs)
      .leftJoin(users, eq(auditLogs.userId, users.id))
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit);

    return result.map((row) => ({
      ...row.audit_logs,
      user: row.users || undefined,
    }));
  }

  async createAuditLog(data: InsertAuditLog): Promise<AuditLog> {
    const [log] = await db.insert(auditLogs).values(data).returning();
    return log;
  }

  // ==================== USER PROFILES ====================
  async getUserProfile(userId: string): Promise<UserProfile | undefined> {
    const [profile] = await db
      .select()
      .from(userProfiles)
      .where(eq(userProfiles.userId, userId));
    return profile;
  }

  async upsertUserProfile(data: InsertUserProfile): Promise<UserProfile> {
    const [profile] = await db
      .insert(userProfiles)
      .values(data)
      .onConflictDoUpdate({
        target: userProfiles.userId,
        set: { role: data.role, updatedAt: new Date() },
      })
      .returning();
    return profile;
  }

  async getUsersWithProfiles(): Promise<(User & { profile?: UserProfile })[]> {
    const result = await db
      .select()
      .from(users)
      .leftJoin(userProfiles, eq(users.id, userProfiles.userId))
      .orderBy(desc(users.createdAt));

    return result.map((row) => ({
      ...row.users,
      profile: row.user_profiles || undefined,
    }));
  }

  // ==================== DASHBOARD STATS ====================
  async getDashboardStats() {
    const [usinasCount] = await db.select({ count: sql<number>`count(*)` }).from(usinas);
    const [clientesCount] = await db.select({ count: sql<number>`count(*)` }).from(clientes);
    const [faturasPendentesCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(faturas)
      .where(eq(faturas.status, "pendente"));
    const [faturasProcessadasCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(faturas)
      .where(eq(faturas.status, "processada"));

    // Get current month stats
    const currentMonth = new Date().toLocaleString("pt-BR", { month: "short" });
    const currentYear = new Date().getFullYear();
    const mesReferencia = `${currentMonth.charAt(0).toUpperCase() + currentMonth.slice(1)}/${currentYear}`;

    const [lucroStats] = await db
      .select({
        lucro: sql<number>`COALESCE(SUM(CAST(lucro AS DECIMAL)), 0)`,
        economia: sql<number>`COALESCE(SUM(CAST(economia AS DECIMAL)), 0)`,
        saldo: sql<number>`COALESCE(SUM(CAST(saldo_kwh AS DECIMAL)), 0)`,
      })
      .from(faturas);

    const [geracaoStats] = await db
      .select({
        kwhGerado: sql<number>`COALESCE(SUM(CAST(kwh_gerado AS DECIMAL)), 0)`,
      })
      .from(geracaoMensal);

    // Get faturas em atraso (past due date and still pending)
    const today = new Date().toISOString().split('T')[0];
    const faturasEmAtrasoResult = await this.getFaturasEmAtraso();

    return {
      totalUsinas: Number(usinasCount?.count) || 0,
      totalClientes: Number(clientesCount?.count) || 0,
      faturasPendentes: Number(faturasPendentesCount?.count) || 0,
      faturasProcessadas: Number(faturasProcessadasCount?.count) || 0,
      faturasEmAtraso: faturasEmAtrasoResult.length,
      lucroMensal: Number(lucroStats?.lucro) || 0,
      economiaTotalClientes: Number(lucroStats?.economia) || 0,
      kwhGeradoMes: Number(geracaoStats?.kwhGerado) || 0,
      saldoTotalKwh: Number(lucroStats?.saldo) || 0,
    };
  }
  
  async getFaturasEmAtraso(): Promise<(Fatura & { cliente?: Cliente })[]> {
    const allFaturas = await this.getFaturas("pendente");
    const today = new Date();
    
    return allFaturas.filter((fatura) => {
      if (!fatura.dataVencimento) return false;
      
      // Parse date in DD/MM/YYYY format (Brazilian)
      const parts = fatura.dataVencimento.split('/');
      if (parts.length !== 3) return false;
      
      const vencimento = new Date(
        parseInt(parts[2]),
        parseInt(parts[1]) - 1,
        parseInt(parts[0])
      );
      
      return vencimento < today && fatura.status === "pendente";
    });
  }

  async fixMonthConsistency() {
    let updatedFaturas = 0;
    let deletedFaturas = 0;
    let updatedGeracoes = 0;
    let deletedGeracoes = 0;

    const normalizeMonthReference = (monthRef: string): string => {
      if (!monthRef) return "";
      const parts = monthRef.trim().split("/");
      if (parts.length !== 2) return monthRef;
      
      let [month, year] = parts;
      month = month.charAt(0).toUpperCase() + month.slice(1).toLowerCase();
      if (year.length === 2) {
        year = "20" + year;
      }
      return `${month}/${year}`;
    };

    // Fix Faturas
    const allFaturas = await db.select().from(faturas);
    for (const f of allFaturas) {
      if (!f.mesReferencia) continue;
      
      const normalized = normalizeMonthReference(f.mesReferencia);
      if (normalized !== f.mesReferencia) {
        // Check if collision exists
        const existing = await db.select()
          .from(faturas)
          .where(and(
            eq(faturas.clienteId, f.clienteId),
            eq(faturas.mesReferencia, normalized)
          ));
        
        // Filter out self
        const collision = existing.find(e => e.id !== f.id);

        if (collision) {
          // Duplicate exists, delete this one
          await db.delete(faturas).where(eq(faturas.id, f.id));
          deletedFaturas++;
        } else {
          // No collision, update format
          await db.update(faturas)
            .set({ mesReferencia: normalized })
            .where(eq(faturas.id, f.id));
          updatedFaturas++;
        }
      }
    }

    // Fix Geracoes
    const allGeracoes = await db.select().from(geracaoMensal);
    for (const g of allGeracoes) {
      if (!g.mesReferencia) continue;
      
      const normalized = normalizeMonthReference(g.mesReferencia);
      if (normalized !== g.mesReferencia) {
        // Check if collision exists
        const existing = await db.select()
          .from(geracaoMensal)
          .where(and(
            eq(geracaoMensal.usinaId, g.usinaId),
            eq(geracaoMensal.mesReferencia, normalized)
          ));
        
        const collision = existing.find(e => e.id !== g.id);

        if (collision) {
          // Duplicate exists, delete this one
          await db.delete(geracaoMensal).where(eq(geracaoMensal.id, g.id));
          deletedGeracoes++;
        } else {
          // No collision, update format
          await db.update(geracaoMensal)
            .set({ mesReferencia: normalized })
            .where(eq(geracaoMensal.id, g.id));
          updatedGeracoes++;
        }
      }
    }

    return { updatedFaturas, deletedFaturas, updatedGeracoes, deletedGeracoes };
  }
}

export const storage = new DatabaseStorage();
