import { sql } from "drizzle-orm";
import { index, jsonb, pgTable, timestamp, varchar, text, boolean } from "drizzle-orm/pg-core";

// Session storage table.
// (IMPORTANT) This table is mandatory for Replit Auth, don't drop it.
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)]
);

// User storage table with JWT authentication support
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

  // Basic info
  email: varchar("email").unique().notNull(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),

  // Authentication (JWT)
  passwordHash: text("password_hash"), // bcrypt hash, nullable for backward compatibility

  // Account status
  isActive: boolean("is_active").notNull().default(true),
  emailVerified: boolean("email_verified").notNull().default(false),

  // Last login
  lastLoginAt: timestamp("last_login_at"),

  // Timestamps
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("users_email_idx").on(table.email),
]);

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

// ============ REFRESH TOKENS ============
// Para JWT com refresh token rotation
export const refreshTokens = pgTable("refresh_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),

  // Metadata
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  revokedAt: timestamp("revoked_at"),
}, (table) => [
  index("refresh_tokens_user_idx").on(table.userId),
  index("refresh_tokens_token_idx").on(table.token),
]);

export type RefreshToken = typeof refreshTokens.$inferSelect;
