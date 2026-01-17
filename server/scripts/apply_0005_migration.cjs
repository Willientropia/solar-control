const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function applyMigration() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    console.log('Conectando ao banco de dados...');
    const client = await pool.connect();

    console.log('Aplicando migração 0005: normalização de formato de mês...');

    const migrationPath = path.join(__dirname, '..', '..', 'migrations', '0005_normalize_existing_months.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');

    await client.query(migrationSQL);

    console.log('✅ Migração 0005 aplicada com sucesso!');
    console.log('Todos os meses foram normalizados para MAIÚSCULO (JAN/2026, DEZ/2025)');

    client.release();
  } catch (error) {
    console.error('❌ Erro ao aplicar migração:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

applyMigration();
