const { Pool } = require('pg');
require('dotenv').config();

async function checkDatabase(databaseName) {
  const connectionString = process.env.DATABASE_URL?.replace(/\/[^/]*$/, `/${databaseName}`);

  const pool = new Pool({ connectionString });

  try {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🔍 Verificando banco: ${databaseName}`);
    console.log('='.repeat(60));

    const client = await pool.connect();

    // Contar registros nas tabelas principais
    const tables = ['faturas', 'clientes', 'usinas', 'precos_kwh', 'geracao_mensal'];

    for (const table of tables) {
      try {
        const result = await client.query(`SELECT COUNT(*) as count FROM ${table}`);
        console.log(`  ✅ ${table.padEnd(20)} → ${result.rows[0].count} registros`);
      } catch (error) {
        if (error.code === '42P01') {
          console.log(`  ❌ ${table.padEnd(20)} → tabela não existe`);
        } else {
          console.log(`  ⚠️  ${table.padEnd(20)} → erro: ${error.message}`);
        }
      }
    }

    // Se faturas existir, mostrar exemplo de mes_referencia
    try {
      const faturasResult = await client.query(`
        SELECT mes_referencia, COUNT(*) as count
        FROM faturas
        GROUP BY mes_referencia
        ORDER BY mes_referencia DESC
        LIMIT 5
      `);

      if (faturasResult.rows.length > 0) {
        console.log(`\n  📅 Exemplos de meses nas faturas:`);
        faturasResult.rows.forEach(row => {
          console.log(`     - ${row.mes_referencia} (${row.count} faturas)`);
        });
      }
    } catch (error) {
      // Tabela não existe, já foi reportado acima
    }

    client.release();
  } catch (error) {
    console.log(`  ❌ Erro ao conectar: ${error.message}`);
  } finally {
    await pool.end();
  }
}

async function main() {
  console.log('📊 Verificando ambos os databases...\n');
  console.log('DATABASE_URL atual:', process.env.DATABASE_URL?.replace(/:[^:@]+@/, ':****@'));

  await checkDatabase('om_react_db');
  await checkDatabase('soltech');

  console.log('\n' + '='.repeat(60));
  console.log('💡 RECOMENDAÇÃO:');
  console.log('   Use o database que tem a tabela "faturas" com dados!');
  console.log('   Atualize o DATABASE_URL no arquivo .env se necessário.');
  console.log('='.repeat(60) + '\n');
}

main();
