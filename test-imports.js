// Script para testar se os módulos podem ser carregados
console.log('🧪 Testando imports...\n');

async function test() {
  try {
    console.log('1. Testando auth-service...');
    const authService = await import('./server/services/auth-service.ts');
    console.log('✅ auth-service OK');

    console.log('\n2. Testando middleware/auth...');
    const authMiddleware = await import('./server/middleware/auth.ts');
    console.log('✅ middleware/auth OK');

    console.log('\n3. Testando storage...');
    const storage = await import('./server/storage.ts');
    console.log('✅ storage OK');

    console.log('\n4. Testando routes...');
    const routes = await import('./server/routes.ts');
    console.log('✅ routes OK');

    console.log('\n✅ Todos os imports funcionaram!\n');
  } catch (error) {
    console.error('\n❌ ERRO ao importar:', error.message);
    console.error('\nStack trace:', error.stack);
    process.exit(1);
  }
}

test();
