
import { pgTable, serial, text, numeric, timestamp, integer, boolean, jsonb } from "drizzle-orm/pg-core";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";

const { Pool } = pg;

// Define minimal schema for querying
const faturas = pgTable("faturas", {
  id: text("id").primaryKey(),
  mesReferencia: text("mes_referencia").notNull(),
});

const geracaoMensal = pgTable("geracao_mensal", {
  id: text("id").primaryKey(),
  mesReferencia: text("mes_referencia").notNull(),
});

async function main() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/om_react_db",
  });

  const db = drizzle(pool);

  const res = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
  console.log("Tables:", res.rows.map(r => r.table_name));

  /*
  console.log("Checking Faturas mesReferencia...");
  const faturasResult = await db.select({ mesReferencia: faturas.mesReferencia }).from(faturas);
  const faturasMonths = [...new Set(faturasResult.map(f => f.mesReferencia))];
  console.log("Faturas months:", faturasMonths);

  console.log("Checking GeracaoMensal mesReferencia...");
  const geracaoResult = await db.select({ mesReferencia: geracaoMensal.mesReferencia }).from(geracaoMensal);
  const geracaoMonths = [...new Set(geracaoResult.map(g => g.mesReferencia))];
  console.log("Geracao months:", geracaoMonths);
  */
  await pool.end();
}

main().catch(console.error);
