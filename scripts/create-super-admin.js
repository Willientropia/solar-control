#!/usr/bin/env node

/**
 * Script para criar Super Admin
 * Uso: node scripts/create-super-admin.js
 */

import bcrypt from 'bcrypt';
import { createInterface } from 'readline';
import { spawn } from 'child_process';

const CONTAINER_NAME = 'solar-control-db-1';
const DB_NAME = 'soltech';
const DB_USER = 'postgres';
const BCRYPT_ROUNDS = 12;

// Cores
const colors = {
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
  reset: '\x1b[0m',
};

function log(color, message) {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// Criar interface readline
const rl = createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(query) {
  return new Promise((resolve) => rl.question(query, resolve));
}

function questionHidden(query) {
  return new Promise((resolve) => {
    const stdin = process.stdin;
    const stdout = process.stdout;

    stdout.write(query);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');

    let password = '';

    const onData = (char) => {
      if (char === '\n' || char === '\r' || char === '\u0004') {
        stdin.setRawMode(false);
        stdin.pause();
        stdin.removeListener('data', onData);
        stdout.write('\n');
        resolve(password);
      } else if (char === '\u0003') {
        process.exit();
      } else if (char === '\u007f') {
        password = password.slice(0, -1);
        stdout.clearLine();
        stdout.cursorTo(0);
        stdout.write(query + '*'.repeat(password.length));
      } else {
        password += char;
        stdout.write('*');
      }
    };

    stdin.on('data', onData);
  });
}

async function execSQL(sql) {
  return new Promise((resolve, reject) => {
    const psql = spawn('docker', [
      'exec',
      '-i',
      CONTAINER_NAME,
      'psql',
      '-U',
      DB_USER,
      '-d',
      DB_NAME,
      '-t',
      '-c',
      sql,
    ]);

    let output = '';
    let error = '';

    psql.stdout.on('data', (data) => {
      output += data.toString();
    });

    psql.stderr.on('data', (data) => {
      error += data.toString();
    });

    psql.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(error || `psql exited with code ${code}`));
      } else {
        resolve(output.trim());
      }
    });
  });
}

async function main() {
  try {
    log('blue', '================================================');
    log('blue', '  CRIAR SUPER ADMIN - Solar Control');
    log('blue', '================================================');
    console.log('');

    log('yellow', 'Este script vai criar sua conta pessoal como SUPER ADMIN');
    log('yellow', 'antes de executar a migration completa.');
    console.log('');

    // Pedir informações
    log('green', '📧 Informações da sua conta:');
    console.log('');

    const email = (await question('Seu Email: ')).toLowerCase().trim();
    const firstName = (await question('Seu Nome: ')).trim();
    const lastName = (await question('Seu Sobrenome (opcional): ')).trim();
    const password = await questionHidden('Sua Senha: ');
    const passwordConfirm = await questionHidden('Confirme a Senha: ');

    console.log('');

    // Validações
    if (!email || !email.includes('@')) {
      log('red', '❌ Email inválido!');
      process.exit(1);
    }

    if (!firstName) {
      log('red', '❌ Nome é obrigatório!');
      process.exit(1);
    }

    if (password !== passwordConfirm) {
      log('red', '❌ Senhas não conferem!');
      process.exit(1);
    }

    if (password.length < 8) {
      log('red', '❌ Senha deve ter pelo menos 8 caracteres!');
      process.exit(1);
    }

    // Verificar se usuário já existe
    log('yellow', '🔄 Verificando se usuário já existe...');

    const existingCount = await execSQL(
      `SELECT COUNT(*) FROM users WHERE email = '${email}';`
    );

    if (parseInt(existingCount) > 0) {
      log('red', '❌ Email já cadastrado no sistema!');
      console.log('');
      console.log('Opções:');
      console.log('1. Use outro email');
      console.log('2. Use o script promote-to-admin.sh para promover usuário existente');
      process.exit(1);
    }

    log('green', '✅ Email disponível!');
    console.log('');

    // Gerar hash bcrypt
    log('yellow', '🔐 Gerando hash bcrypt da senha...');

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    log('green', '✅ Hash gerado com sucesso!');
    console.log('');

    // Criar usuário
    log('yellow', '👤 Criando sua conta...');

    const lastNameValue = lastName ? `'${lastName}'` : 'NULL';

    await execSQL(`
      INSERT INTO users (email, first_name, last_name, password_hash, is_active, email_verified)
      VALUES (
        '${email}',
        '${firstName}',
        ${lastNameValue},
        '${passwordHash}',
        true,
        true
      );
    `);

    log('green', '✅ Usuário criado!');
    console.log('');

    // Verificar/criar organização
    log('yellow', '🏢 Verificando organização...');

    const orgCount = await execSQL(
      `SELECT COUNT(*) FROM organizations WHERE slug = 'organizacao-principal';`
    );

    if (parseInt(orgCount) === 0) {
      log('yellow', '📦 Criando Organização Principal...');

      await execSQL(`
        INSERT INTO organizations (name, slug, description, is_active)
        VALUES (
          'Organização Principal',
          'organizacao-principal',
          'Organização criada para seus dados atuais',
          true
        );
      `);

      log('green', '✅ Organização criada!');
    } else {
      log('green', '✅ Organização Principal já existe!');
    }

    console.log('');

    // Vincular usuário à organização
    log('yellow', '🔗 Vinculando você à Organização Principal como SUPER_ADMIN...');

    await execSQL(`
      INSERT INTO organization_members (organization_id, user_id, role, is_active)
      SELECT
        o.id,
        u.id,
        'super_admin',
        true
      FROM organizations o
      CROSS JOIN users u
      WHERE o.slug = 'organizacao-principal'
        AND u.email = '${email}'
      ON CONFLICT (organization_id, user_id) DO UPDATE
      SET role = 'super_admin', is_active = true;
    `);

    log('green', '✅ Vinculação concluída!');
    console.log('');

    // Sucesso!
    log('green', '================================================');
    log('green', '  🎉 TUDO PRONTO!');
    log('green', '================================================');
    console.log('');
    log('blue', '✅ Você agora é SUPER_ADMIN da Organização Principal');
    console.log('');
    log('yellow', '📊 O que você pode fazer:');
    console.log('  1. Login com suas credenciais');
    console.log('  2. Acesso total aos dados atuais');
    console.log('  3. Criar novas organizações');
    console.log('  4. Adicionar admins e operadores');
    console.log('  5. Gerenciar todas as organizações');
    console.log('');
    log('blue', '🔐 Suas credenciais:');
    console.log(`  Email: ${email}`);
    console.log('  Senha: (a que você definiu)');
    console.log('  Role: SUPER_ADMIN');
    console.log('');
    log('yellow', '📝 Próximos passos:');
    console.log('  1. Executar migration completa: ./scripts/run-migration.sh');
    console.log('  2. Fazer login no sistema');
    console.log('  3. Adicionar outros usuários');
    console.log('');
    log('green', '💡 Dica: Guarde suas credenciais em local seguro!');
    console.log('');
  } catch (error) {
    console.error('');
    log('red', '❌ Erro ao criar super admin:');
    console.error(error.message);
    console.error('');
    log('yellow', 'Verifique se:');
    console.log('  1. Docker está rodando');
    console.log('  2. Container do PostgreSQL está ativo');
    console.log('  3. Banco de dados "soltech" existe');
    console.log('  4. Tabelas users e organizations existem');
    console.log('');
    process.exit(1);
  } finally {
    rl.close();
  }
}

main();
