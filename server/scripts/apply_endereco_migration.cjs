#!/usr/bin/env node
const { Pool } = require("pg");
const fs = require("fs");
const path = require("path");

async function applyMigration() {
  const databaseUrl = process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/om_react_db";
  const pool = new Pool({ connectionString: databaseUrl });
  const migrationPath = path.join(process.cwd(), "migrations", "0002_migrate_endereco_to_simplificado.sql");
  const sql = fs.readFileSync(migrationPath, "utf-8");

  try {
    console.log("Aplicando migração de endereço...");
    const result = await pool.query(sql);
    console.log(`Migração aplicada com sucesso! ${result.rowCount || 0} registros atualizados.`);
  } catch (error) {
    console.error("Erro ao aplicar migração:", error);
    throw error;
  } finally {
    await pool.end();
  }
}

applyMigration();
