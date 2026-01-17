const { Pool } = require('pg');
require('dotenv').config();

async function checkDatabase() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    console.log('🔍 Conectando ao banco de dados...');
    console.log('📍 DATABASE_URL:', process.env.DATABASE_URL?.replace(/:[^:@]+@/, ':****@')); // Hide password

    const client = await pool.connect();
    console.log('✅ Conectado com sucesso!\n');

    // Listar todos os schemas
    console.log('📂 Schemas disponíveis:');
    const schemasResult = await client.query(`
      SELECT schema_name
      FROM information_schema.schemata
      WHERE schema_name NOT IN ('pg_catalog', 'information_schema')
      ORDER BY schema_name;
    `);
    schemasResult.rows.forEach(row => {
      console.log(`  - ${row.schema_name}`);
    });
    console.log('');

    // Listar todas as tabelas em todos os schemas
    console.log('📋 Tabelas disponíveis:');
    const tablesResult = await client.query(`
      SELECT table_schema, table_name
      FROM information_schema.tables
      WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
      ORDER BY table_schema, table_name;
    `);

    if (tablesResult.rows.length === 0) {
      console.log('  ⚠️  Nenhuma tabela encontrada! O banco parece estar vazio.');
      console.log('  💡 Dica: Você precisa rodar as migrations do Drizzle primeiro!');
    } else {
      tablesResult.rows.forEach(row => {
        console.log(`  - ${row.table_schema}.${row.table_name}`);
      });
    }
    console.log('');

    // Verificar se a tabela faturas existe especificamente
    console.log('🔎 Procurando tabela "faturas":');
    const faturasResult = await client.query(`
      SELECT table_schema, table_name
      FROM information_schema.tables
      WHERE table_name = 'faturas';
    `);

    if (faturasResult.rows.length > 0) {
      faturasResult.rows.forEach(row => {
        console.log(`  ✅ Encontrada em: ${row.table_schema}.${row.table_name}`);
      });

      // Listar colunas da tabela faturas
      console.log('\n📊 Colunas da tabela faturas:');
      const columnsResult = await client.query(`
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_name = 'faturas'
        ORDER BY ordinal_position;
      `);
      columnsResult.rows.forEach(row => {
        console.log(`  - ${row.column_name} (${row.data_type})`);
      });
    } else {
      console.log('  ❌ Tabela "faturas" NÃO encontrada!');
      console.log('  💡 Você precisa rodar as migrations do Drizzle: npm run db:push');
    }

    client.release();
  } catch (error) {
    console.error('❌ Erro ao conectar:', error.message);
    if (error.code === 'ECONNREFUSED') {
      console.log('\n💡 Dicas:');
      console.log('  1. Verifique se o PostgreSQL está rodando');
      console.log('  2. Confira o DATABASE_URL no arquivo .env');
      console.log('  3. Se estiver usando Docker: docker compose up -d');
    }
  } finally {
    await pool.end();
  }
}

checkDatabase();
