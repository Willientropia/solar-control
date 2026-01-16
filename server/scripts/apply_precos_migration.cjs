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

    console.log('Aplicando migração de preços kWh...');

    const migrationPath = path.join(__dirname, '..', '..', 'migrations', '0003_create_precos_kwh_table.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');

    await client.query(migrationSQL);

    console.log('✅ Migração aplicada com sucesso!');
    console.log('A tabela precos_kwh foi criada.');

    client.release();
  } catch (error) {
    console.error('❌ Erro ao aplicar migração:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

applyMigration();
