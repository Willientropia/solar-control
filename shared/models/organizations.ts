import { sql, relations } from "drizzle-orm";
import { pgTable, text, varchar, boolean, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from "./auth";

/**
 * MULTI-TENANCY - ORGANIZAÇÕES
 *
 * Permite criar múltiplas organizações isoladas no mesmo sistema.
 * Cada organização tem seus próprios dados (usinas, clientes, faturas, etc).
 *
 * Exemplo:
 * - Organização 1: "Minha Empresa Principal" (seus dados atuais)
 * - Organização 2: "Cliente Solar ABC" (dados isolados)
 * - Organização 3: "Parceiro XYZ" (dados isolados)
 */

// ============ ORGANIZATIONS ============
export const organizations = pgTable("organizations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(), // URL-friendly identifier (ex: "minha-empresa")
  description: text("description"),

  // Settings
  settings: jsonb("settings"), // Configurações customizadas por organização

  // Status
  isActive: boolean("is_active").notNull().default(true),

  // Metadata
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("organizations_slug_idx").on(table.slug),
]);

export const organizationsRelations = relations(organizations, ({ many }) => ({
  users: many(users),
}));

export const insertOrganizationSchema = createInsertSchema(organizations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertOrganization = z.infer<typeof insertOrganizationSchema>;
export type Organization = typeof organizations.$inferSelect;

// ============ TIPOS DE ROLES ============
export const ROLES = {
  SUPER_ADMIN: 'super_admin', // Acesso total, cria organizações
  ADMIN: 'admin',              // Admin da organização, acesso total aos dados
  OPERADOR: 'operador',        // Operador, entrada de dados
} as const;

export type Role = typeof ROLES[keyof typeof ROLES];

// ============ ORGANIZATION MEMBERS (relação users ↔ organizations) ============
export const organizationMembers = pgTable("organization_members", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  role: text("role").notNull().default(ROLES.OPERADOR), // super_admin, admin, operador

  // Status
  isActive: boolean("is_active").notNull().default(true),

  // Metadata
  joinedAt: timestamp("joined_at").defaultNow(),
  lastAccessAt: timestamp("last_access_at"),
}, (table) => [
  index("org_members_org_idx").on(table.organizationId),
  index("org_members_user_idx").on(table.userId),
]);

export const organizationMembersRelations = relations(organizationMembers, ({ one }) => ({
  organization: one(organizations, {
    fields: [organizationMembers.organizationId],
    references: [organizations.id],
  }),
  user: one(users, {
    fields: [organizationMembers.userId],
    references: [users.id],
  }),
}));

export const insertOrganizationMemberSchema = createInsertSchema(organizationMembers).omit({
  id: true,
  joinedAt: true,
});

export type InsertOrganizationMember = z.infer<typeof insertOrganizationMemberSchema>;
export type OrganizationMember = typeof organizationMembers.$inferSelect;

// ============ INVITE TOKENS ============
// Para convidar usuários para organizações
export const inviteTokens = pgTable("invite_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  role: text("role").notNull().default(ROLES.OPERADOR),
  token: text("token").notNull().unique(),

  // Metadata
  createdBy: varchar("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  usedBy: varchar("used_by").references(() => users.id),
}, (table) => [
  index("invite_tokens_token_idx").on(table.token),
  index("invite_tokens_org_idx").on(table.organizationId),
]);

export const inviteTokensRelations = relations(inviteTokens, ({ one }) => ({
  organization: one(organizations, {
    fields: [inviteTokens.organizationId],
    references: [organizations.id],
  }),
  creator: one(users, {
    fields: [inviteTokens.createdBy],
    references: [users.id],
  }),
}));

export type InviteToken = typeof inviteTokens.$inferSelect;
