import { sql, relations } from "drizzle-orm";
import { pgTable, text, varchar, integer, decimal, boolean, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Re-export auth models
export * from "./models/auth";

// Re-export organizations models
export * from "./models/organizations";

// ============ USINAS (Solar Plants) ============
export const usinas = pgTable("usinas", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  nome: text("nome").notNull(),
  unidadeConsumidora: text("unidade_consumidora").notNull().unique(),
  producaoMensalPrevista: decimal("producao_mensal_prevista", { precision: 12, scale: 2 }).notNull(),
  potenciaKwp: decimal("potencia_kwp", { precision: 10, scale: 3 }),
  descontoPadrao: decimal("desconto_padrao", { precision: 5, scale: 2 }).notNull().default("15.00"),
  endereco: text("endereco"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const usinasRelations = relations(usinas, ({ many }) => ({
  clientes: many(clientes),
  geracaoMensal: many(geracaoMensal),
}));

export const insertUsinaSchema = createInsertSchema(usinas).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertUsina = z.infer<typeof insertUsinaSchema>;
export type Usina = typeof usinas.$inferSelect;

// ============ CLIENTES (Clients/Consumer Units) ============
export const clientes = pgTable("clientes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  nome: text("nome").notNull(),
  cpfCnpj: text("cpf_cnpj"),
  endereco: text("endereco"), // Campo legado, mantido para compatibilidade
  enderecoSimplificado: text("endereco_simplificado"), // Ex: "SLMB" - usado em relatórios
  enderecoCompleto: text("endereco_completo"), // Endereço completo - usado em faturas
  unidadeConsumidora: text("unidade_consumidora").notNull().unique(),
  usinaId: varchar("usina_id").notNull().references(() => usinas.id, { onDelete: "cascade" }),
  desconto: decimal("desconto", { precision: 5, scale: 2 }).notNull().default("15.00"),
  isPagante: boolean("is_pagante").notNull().default(true),
  numeroContrato: text("numero_contrato"),
  valorContratadoKwh: decimal("valor_contratado_kwh", { precision: 12, scale: 2 }),
  porcentagemEnvioCredito: decimal("porcentagem_envio_credito", { precision: 5, scale: 2 }),
  ativo: boolean("ativo").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const clientesRelations = relations(clientes, ({ one, many }) => ({
  usina: one(usinas, {
    fields: [clientes.usinaId],
    references: [usinas.id],
  }),
  faturas: many(faturas),
}));

export const insertClienteSchema = createInsertSchema(clientes).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertCliente = z.infer<typeof insertClienteSchema>;
export type Cliente = typeof clientes.$inferSelect;

// ============ FATURAS (Invoices from Utility Company) ============
export const faturas = pgTable("faturas", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clienteId: varchar("cliente_id").notNull().references(() => clientes.id, { onDelete: "cascade" }),
  usinaId: varchar("usina_id").references(() => usinas.id),
  mesReferencia: text("mes_referencia").notNull(),
  dataVencimento: text("data_vencimento"),
  
  // Dados extraídos da fatura original
  consumoScee: decimal("consumo_scee", { precision: 12, scale: 2 }),
  consumoNaoCompensado: decimal("consumo_nao_compensado", { precision: 12, scale: 2 }),
  energiaInjetada: decimal("energia_injetada", { precision: 12, scale: 2 }),
  saldoKwh: decimal("saldo_kwh", { precision: 12, scale: 2 }),
  contribuicaoIluminacao: decimal("contribuicao_iluminacao", { precision: 12, scale: 2 }),
  precoKwh: decimal("preco_kwh", { precision: 10, scale: 6 }),
  precoAdcBandeira: decimal("preco_adc_bandeira", { precision: 10, scale: 6 }),
  precoFioB: decimal("preco_fio_b", { precision: 10, scale: 6 }),
  valorTotal: decimal("valor_total", { precision: 12, scale: 2 }),
  
  // Valores calculados
  valorSemDesconto: decimal("valor_sem_desconto", { precision: 12, scale: 2 }),
  valorComDesconto: decimal("valor_com_desconto", { precision: 12, scale: 2 }),
  economia: decimal("economia", { precision: 12, scale: 2 }),
  lucro: decimal("lucro", { precision: 12, scale: 2 }),
  
  // Metadados
  dadosExtraidos: jsonb("dados_extraidos"),
  status: text("status").notNull().default("aguardando_upload"), // aguardando_upload, aguardando_pagamento, pagamento_pendente_confirmacao, pago
  arquivoPdfUrl: text("arquivo_pdf_url"),
  faturaGeradaUrl: text("fatura_gerada_url"),

  // Rastreamento da fatura do cliente (com desconto)
  faturaClienteGeradaAt: timestamp("fatura_cliente_gerada_at"),
  faturaClienteEnviadaAt: timestamp("fatura_cliente_enviada_at"),
  faturaClienteRecebidaAt: timestamp("fatura_cliente_recebida_at"),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  createdBy: varchar("created_by").references(() => users.id),
}, (table) => [
  index("faturas_cliente_id_idx").on(table.clienteId),
  index("faturas_usina_id_idx").on(table.usinaId),
  index("faturas_mes_referencia_idx").on(table.mesReferencia),
]);

// Need to import users from auth model
import { users } from "./models/auth";

export const faturasRelations = relations(faturas, ({ one }) => ({
  cliente: one(clientes, {
    fields: [faturas.clienteId],
    references: [clientes.id],
  }),
  usina: one(usinas, {
    fields: [faturas.usinaId],
    references: [usinas.id],
  }),
  createdByUser: one(users, {
    fields: [faturas.createdBy],
    references: [users.id],
  }),
}));

export const insertFaturaSchema = createInsertSchema(faturas).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertFatura = z.infer<typeof insertFaturaSchema>;
export type Fatura = typeof faturas.$inferSelect;

// ============ GERAÇÃO MENSAL (Monthly Generation) ============
export const geracaoMensal = pgTable("geracao_mensal", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  usinaId: varchar("usina_id").notNull().references(() => usinas.id, { onDelete: "cascade" }),
  mesReferencia: text("mes_referencia").notNull(),
  kwhGerado: decimal("kwh_gerado", { precision: 12, scale: 2 }).notNull(),
  alertaBaixaGeracao: boolean("alerta_baixa_geracao").default(false),
  observacoes: text("observacoes"),
  createdAt: timestamp("created_at").defaultNow(),
  createdBy: varchar("created_by").references(() => users.id),
}, (table) => [
  index("geracao_mensal_usina_id_idx").on(table.usinaId),
  index("geracao_mensal_mes_referencia_idx").on(table.mesReferencia),
]);

export const geracaoMensalRelations = relations(geracaoMensal, ({ one }) => ({
  usina: one(usinas, {
    fields: [geracaoMensal.usinaId],
    references: [usinas.id],
  }),
  createdByUser: one(users, {
    fields: [geracaoMensal.createdBy],
    references: [users.id],
  }),
}));

export const insertGeracaoMensalSchema = createInsertSchema(geracaoMensal).omit({
  id: true,
  createdAt: true,
  alertaBaixaGeracao: true,
});

export type InsertGeracaoMensal = z.infer<typeof insertGeracaoMensalSchema>;
export type GeracaoMensal = typeof geracaoMensal.$inferSelect;

// ============ PREÇOS KWH (kWh Price Calculations) ============
export const precosKwh = pgTable("precos_kwh", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  mesReferencia: text("mes_referencia").notNull().unique(), // Ex: "Jan/2026"
  tusd: decimal("tusd", { precision: 10, scale: 6 }).notNull(), // TUSD
  te: decimal("te", { precision: 10, scale: 6 }).notNull(), // TE (Tarifa de Energia)
  icms: decimal("icms", { precision: 5, scale: 2 }).notNull(), // ICMS (%)
  pis: decimal("pis", { precision: 5, scale: 2 }).notNull(), // PIS (%)
  cofins: decimal("cofins", { precision: 5, scale: 2 }).notNull(), // COFINS (%)
  precoKwhCalculado: decimal("preco_kwh_calculado", { precision: 10, scale: 6 }).notNull(), // Resultado do cálculo
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertPrecoKwhSchema = createInsertSchema(precosKwh).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  precoKwhCalculado: true, // Será calculado automaticamente
});

export type InsertPrecoKwh = z.infer<typeof insertPrecoKwhSchema>;
export type PrecoKwh = typeof precosKwh.$inferSelect;

// ============ LOGS DE AUDITORIA (Audit Logs) ============
export const auditLogs = pgTable("audit_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  acao: text("acao").notNull(),
  entidade: text("entidade").notNull(),
  entidadeId: varchar("entidade_id"),
  detalhes: jsonb("detalhes"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("audit_logs_user_id_idx").on(table.userId),
  index("audit_logs_created_at_idx").on(table.createdAt),
]);

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  user: one(users, {
    fields: [auditLogs.userId],
    references: [users.id],
  }),
}));

export const insertAuditLogSchema = createInsertSchema(auditLogs).omit({
  id: true,
  createdAt: true,
});

export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
export type AuditLog = typeof auditLogs.$inferSelect;

// ============ USER ROLES (Extended User) ============
// We'll add role to users table via a separate userProfiles table
export const userProfiles = pgTable("user_profiles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }).unique(),
  role: text("role").notNull().default("operador"), // admin, operador
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const userProfilesRelations = relations(userProfiles, ({ one }) => ({
  user: one(users, {
    fields: [userProfiles.userId],
    references: [users.id],
  }),
}));

export const insertUserProfileSchema = createInsertSchema(userProfiles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertUserProfile = z.infer<typeof insertUserProfileSchema>;
export type UserProfile = typeof userProfiles.$inferSelect;
