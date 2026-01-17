const { Pool } = require('pg');
require('dotenv').config();

async function checkPrecos() {
  // Tentar conectar no banco Docker
  const connectionString = 'postgresql://postgres:postgres@localhost:5432/soltech';
  const pool = new Pool({ connectionString });

  try {
    console.log('🔍 Conectando ao banco Docker (soltech)...');
    const client = await pool.connect();
    console.log('✅ Conectado!\n');

    // Listar todos os preços de kWh cadastrados
    console.log('📋 Preços de kWh cadastrados:\n');
    const result = await client.query(`
      SELECT
        id,
        mes_referencia,
        tusd,
        te,
        icms,
        pis,
        cofins,
        preco_kwh_calculado,
        created_at
      FROM precos_kwh
      ORDER BY mes_referencia DESC;
    `);

    if (result.rows.length === 0) {
      console.log('  ⚠️  Nenhum preço de kWh encontrado!');
    } else {
      console.log('  Mês Ref.     | Preço kWh Calc. | TUSD    | TE      | ICMS  | Criado em');
      console.log('  ' + '-'.repeat(90));

      result.rows.forEach(row => {
        const mes = row.mes_referencia?.padEnd(12) || 'N/A         ';
        const preco = row.preco_kwh_calculado || 'N/A';
        const tusd = row.tusd || 'N/A';
        const te = row.te || 'N/A';
        const icms = row.icms || 'N/A';
        const createdAt = row.created_at ? new Date(row.created_at).toLocaleDateString() : 'N/A';

        console.log(`  ${mes} | ${preco.padEnd(15)} | ${tusd.padEnd(7)} | ${te.padEnd(7)} | ${icms.padEnd(5)} | ${createdAt}`);
      });

      console.log('\n📊 Total de registros:', result.rows.length);

      // Verificar se há meses com formatos diferentes
      const formatos = new Set();
      result.rows.forEach(row => {
        const mes = row.mes_referencia?.split('/')[0];
        if (mes) {
          if (mes === mes.toUpperCase()) {
            formatos.add('MAIÚSCULO');
          } else if (mes.charAt(0) === mes.charAt(0).toUpperCase()) {
            formatos.add('PrimeiraLetraMaiúscula');
          } else {
            formatos.add('minúsculo');
          }
        }
      });

      console.log('\n🔤 Formatos de mês encontrados:', Array.from(formatos).join(', '));

      // Teste específico: buscar preço de Janeiro/2026
      console.log('\n🧪 Teste de busca: Janeiro/2026');
      const testFormats = ['JAN/2026', 'Jan/2026', 'jan/2026'];

      for (const format of testFormats) {
        const testResult = await client.query(
          'SELECT mes_referencia, preco_kwh_calculado FROM precos_kwh WHERE mes_referencia = $1',
          [format]
        );

        if (testResult.rows.length > 0) {
          console.log(`  ✅ "${format}" → Encontrado! Preço: ${testResult.rows[0].preco_kwh_calculado}`);
        } else {
          console.log(`  ❌ "${format}" → Não encontrado`);
        }
      }

      // Busca case-insensitive
      console.log('\n🔍 Busca case-insensitive para JAN/2026:');
      const caseInsensitiveResult = await client.query(`
        SELECT mes_referencia, preco_kwh_calculado
        FROM precos_kwh
        WHERE UPPER(mes_referencia) = 'JAN/2026'
      `);

      if (caseInsensitiveResult.rows.length > 0) {
        console.log(`  ✅ Encontrado: ${caseInsensitiveResult.rows[0].mes_referencia} = ${caseInsensitiveResult.rows[0].preco_kwh_calculado}`);
      } else {
        console.log(`  ❌ Não encontrado mesmo com case-insensitive`);
      }
    }

    client.release();
  } catch (error) {
    console.error('❌ Erro:', error.message);
  } finally {
    await pool.end();
  }
}

checkPrecos();
