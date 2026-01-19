# 🏢 Guia Completo do Sistema Multi-Tenant

## 📚 Índice
1. [Como Funciona](#como-funciona)
2. [Criar Sua Conta de Super Admin](#criar-sua-conta)
3. [O que Fazer com admin@local.com](#admin-local)
4. [Como Adicionar Usuários](#adicionar-usuarios)
5. [Estrutura de Permissões](#permissoes)
6. [Cenários Práticos](#cenarios)

---

## 🎯 Como Funciona {#como-funciona}

### Antes (Sistema Atual)
```
BANCO DE DADOS
├── Usinas
├── Clientes
├── Faturas
└── Usuários (qualquer um vê tudo)
```

### Depois (Multi-Tenant)
```
ORGANIZAÇÕES (isoladas entre si)
├── Organização Principal (SEUS dados atuais)
│   ├── Você (super_admin)
│   ├── Admin 1 (admin) - acesso total aos seus dados
│   ├── Operador 1 (operador) - só entrada de dados
│   ├── Usinas (suas)
│   ├── Clientes (seus)
│   └── Faturas (suas)
│
├── Cliente Solar ABC (dados ISOLADOS)
│   ├── Admin ABC (admin)
│   ├── Operadores ABC
│   └── Dados próprios (você NÃO vê)
│
└── Parceiro XYZ (dados ISOLADOS)
    └── Dados próprios (você NÃO vê)
```

### Conceitos Importantes

**Organização:**
-Container isolado de dados
- Tem seus próprios: Usinas, Clientes, Faturas, etc
- Dados de uma org NÃO aparecem em outra

**Roles (Níveis de Acesso):**
- **super_admin**: Você! Acessa TUDO, cria organizações
- **admin**: Admin de UMA organização específica
- **operador**: Usuário básico de UMA organização

---

## 🔐 Criar Sua Conta de Super Admin {#criar-sua-conta}

### Opção 1: Antes da Migration (Recomendado)

Execute o script que criei:

```bash
# Dar permissão
chmod +x scripts/create-super-admin.sh

# Executar
./scripts/create-super-admin.sh
```

**O que vai acontecer:**

1. Script pede seu email
2. Script pede seu nome
3. Script pede sua senha (mínimo 8 caracteres)
4. Gera hash bcrypt da senha (seguro!)
5. Cria sua conta no banco
6. Cria "Organização Principal" (se não existir)
7. Te vincula como `super_admin`

**Resultado:**
```
✅ Sua conta criada
✅ Senha com hash bcrypt
✅ Vinculado à Organização Principal
✅ Role: SUPER_ADMIN
✅ Acesso total aos seus dados atuais
```

### Opção 2: Via SQL Direto

Se preferir fazer manualmente:

```sql
-- 1. Entrar no PostgreSQL
docker exec -it solar-control-db-1 psql -U postgres -d soltech

-- 2. Criar usuário (substitua os valores)
INSERT INTO users (email, first_name, last_name, password_hash, is_active, email_verified)
VALUES (
  'seu.email@exemplo.com',
  'Seu Nome',
  'Seu Sobrenome',
  -- Você precisa gerar o hash bcrypt da sua senha primeiro
  -- Use: node -e "console.log(require('bcrypt').hashSync('SuaSenha', 12))"
  '$2b$12$HASH_GERADO_AQUI',
  true,
  true
);

-- 3. Criar organização (se não existir)
INSERT INTO organizations (name, slug, description, is_active)
VALUES (
  'Organização Principal',
  'organizacao-principal',
  'Meus dados atuais',
  true
);

-- 4. Vincular você como super_admin
INSERT INTO organization_members (organization_id, user_id, role, is_active)
SELECT
  o.id,
  u.id,
  'super_admin',
  true
FROM organizations o
CROSS JOIN users u
WHERE o.slug = 'organizacao-principal'
  AND u.email = 'seu.email@exemplo.com';

-- 5. Verificar
SELECT
  u.email,
  u.first_name,
  o.name as org,
  om.role
FROM organization_members om
JOIN users u ON om.user_id = u.id
JOIN organizations o ON om.organization_id = o.id
WHERE u.email = 'seu.email@exemplo.com';
```

---

## 🤔 O que Fazer com admin@local.com {#admin-local}

Você tem **3 opções**:

### Opção A: Remover (Recomendado se você não usa)

```sql
-- Entrar no PostgreSQL
docker exec -it solar-control-db-1 psql -U postgres -d soltech

-- Remover usuário (CASCADE remove vinculações)
DELETE FROM users WHERE email = 'admin@local.com';
```

### Opção B: Manter como Admin

Se quiser manter para testes ou backup:

```sql
-- Manter como admin da Organização Principal
INSERT INTO organization_members (organization_id, user_id, role, is_active)
SELECT
  o.id,
  u.id,
  'admin',
  true
FROM organizations o
CROSS JOIN users u
WHERE o.slug = 'organizacao-principal'
  AND u.email = 'admin@local.com'
ON CONFLICT (organization_id, user_id) DO UPDATE
SET role = 'admin';
```

### Opção C: Desativar (Manter no histórico)

```sql
-- Desativar usuário
UPDATE users
SET is_active = false
WHERE email = 'admin@local.com';
```

**Recomendação:** Se você não usa esse email, **remova (Opção A)**.

---

## 👥 Como Adicionar Usuários {#adicionar-usuarios}

### Cenário 1: Adicionar Admin aos SEUS dados

**Situação:** Você quer dar acesso admin para outra pessoa aos SEUS dados atuais.

**Como fazer:**

```bash
# Via endpoints (após implementar Parte 2)
POST /api/organizations/organizacao-principal/invite
{
  "email": "novo.admin@exemplo.com",
  "role": "admin"
}
```

**Ou via SQL:**

```sql
-- 1. Criar usuário
INSERT INTO users (email, first_name, password_hash, is_active, email_verified)
VALUES (
  'novo.admin@exemplo.com',
  'Nome do Admin',
  -- Hash bcrypt da senha
  '$2b$12$...',
  true,
  false  -- false = precisa verificar email
);

-- 2. Vincular à Organização Principal como admin
INSERT INTO organization_members (organization_id, user_id, role, is_active)
SELECT
  o.id,
  u.id,
  'admin',
  true
FROM organizations o
CROSS JOIN users u
WHERE o.slug = 'organizacao-principal'
  AND u.email = 'novo.admin@exemplo.com';
```

**Resultado:**
- ✅ Admin pode ver TODOS os seus dados
- ✅ Admin pode criar/editar/deletar
- ✅ Admin pode adicionar operadores
- ❌ Admin NÃO pode criar novas organizações (só você, super_admin)

### Cenário 2: Adicionar Operador aos SEUS dados

**Situação:** Você quer alguém para só fazer entrada de dados.

**Como fazer:**

```sql
-- Mesmo processo, mas role = 'operador'
INSERT INTO organization_members (organization_id, user_id, role, is_active)
SELECT
  o.id,
  u.id,
  'operador',  -- Mudou aqui!
  true
FROM organizations o
CROSS JOIN users u
WHERE o.slug = 'organizacao-principal'
  AND u.email = 'operador@exemplo.com';
```

**Resultado:**
- ✅ Operador pode ver dados
- ✅ Operador pode criar/editar faturas, usinas, etc
- ❌ Operador NÃO pode ver Relatórios
- ❌ Operador NÃO pode ver Auditoria
- ❌ Operador NÃO pode gerenciar usuários

### Cenário 3: Criar Nova Organização (para Cliente)

**Situação:** Cliente quer sistema próprio com dados isolados.

**Como fazer:**

```bash
# Via endpoint (após Parte 2)
POST /api/organizations
{
  "name": "Cliente Solar ABC",
  "slug": "cliente-abc",
  "description": "Organização do Cliente ABC"
}

# Adicionar admin do cliente
POST /api/organizations/cliente-abc/invite
{
  "email": "admin@clienteabc.com",
  "role": "admin"
}
```

**Resultado:**
- ✅ Cliente tem sistema próprio
- ✅ Dados 100% isolados dos seus
- ✅ Você (super_admin) pode acessar se precisar
- ✅ Admin do cliente NÃO vê seus dados

---

## 🔑 Estrutura de Permissões {#permissoes}

### Super Admin (Você)

**Pode:**
- ✅ Ver TODAS as organizações
- ✅ Criar novas organizações
- ✅ Adicionar/remover usuários de qualquer org
- ✅ Acessar dados de qualquer organização
- ✅ Gerenciar configurações globais
- ✅ Ver auditoria de tudo

**Não pode:**
- ❌ Ser removido (precisa ter pelo menos 1 super_admin)

### Admin (de uma Organização)

**Pode:**
- ✅ Ver TODOS os dados da SUA organização
- ✅ Criar/editar/deletar dados
- ✅ Adicionar usuários à SUA organização
- ✅ Ver relatórios
- ✅ Ver auditoria da organização
- ✅ Export/Import de dados

**Não pode:**
- ❌ Ver dados de outras organizações
- ❌ Criar organizações
- ❌ Acessar configurações globais

### Operador (de uma Organização)

**Pode:**
- ✅ Ver dados da organização
- ✅ Criar/editar faturas
- ✅ Criar/editar usinas e clientes
- ✅ Fazer upload de PDFs
- ✅ Gerar relatórios

**Não pode:**
- ❌ Ver auditoria
- ❌ Gerenciar usuários
- ❌ Export/Import
- ❌ Configurações
- ❌ Ver outras organizações

---

## 🎯 Cenários Práticos {#cenarios}

### Cenário 1: Você + 2 Funcionários

**Estrutura:**
```
Organização Principal
├── Você (super_admin)
├── Funcionário 1 (admin) - confiança total
└── Funcionário 2 (operador) - só entrada de dados
```

**Como fazer:**

1. Criar sua conta:
```bash
./scripts/create-super-admin.sh
```

2. Adicionar Funcionário 1 como admin:
```sql
-- Criar usuário
INSERT INTO users (email, first_name, password_hash, is_active, email_verified)
VALUES ('func1@empresa.com', 'Funcionário 1', '$2b$12$...', true, true);

-- Vincular como admin
INSERT INTO organization_members (organization_id, user_id, role, is_active)
SELECT o.id, u.id, 'admin', true
FROM organizations o, users u
WHERE o.slug = 'organizacao-principal' AND u.email = 'func1@empresa.com';
```

3. Adicionar Funcionário 2 como operador:
```sql
-- Mesmo processo, role = 'operador'
INSERT INTO organization_members (organization_id, user_id, role, is_active)
SELECT o.id, u.id, 'operador', true
FROM organizations o, users u
WHERE o.slug = 'organizacao-principal' AND u.email = 'func2@empresa.com';
```

### Cenário 2: Você + 3 Clientes Isolados

**Estrutura:**
```
Sistema
├── Organização Principal (VOCÊ)
│   └── Você (super_admin)
│
├── Cliente ABC
│   ├── Admin ABC
│   └── Dados isolados
│
├── Cliente XYZ
│   ├── Admin XYZ
│   └── Dados isolados
│
└── Cliente 123
    ├── Admin 123
    └── Dados isolados
```

**Como fazer:**

```sql
-- 1. Criar organização Cliente ABC
INSERT INTO organizations (name, slug, description, is_active)
VALUES ('Cliente Solar ABC', 'cliente-abc', 'Dados do Cliente ABC', true);

-- 2. Criar admin do Cliente ABC
INSERT INTO users (email, first_name, password_hash, is_active, email_verified)
VALUES ('admin@abc.com', 'Admin ABC', '$2b$12$...', true, true);

-- 3. Vincular
INSERT INTO organization_members (organization_id, user_id, role, is_active)
SELECT o.id, u.id, 'admin', true
FROM organizations o, users u
WHERE o.slug = 'cliente-abc' AND u.email = 'admin@abc.com';

-- Repetir para Cliente XYZ e 123...
```

**Resultado:**
- ✅ Cada cliente vê apenas seus dados
- ✅ Você vê tudo (super_admin)
- ✅ Isolamento total entre clientes

### Cenário 3: Setup Inicial Completo

**Passos em ordem:**

```bash
# 1. Criar sua conta de super_admin
./scripts/create-super-admin.sh
# Email: seu@email.com
# Senha: SuaSenhaSegura123

# 2. Executar migration completa
./scripts/run-migration.sh
# (vai criar na Parte 2)

# 3. Fazer login
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "seu@email.com",
    "password": "SuaSenhaSegura123"
  }'
# Retorna: { "accessToken": "...", "refreshToken": "..." }

# 4. Adicionar funcionários
# Via interface web ou SQL

# 5. (Opcional) Remover admin@local.com
docker exec -it solar-control-db-1 psql -U postgres -d soltech \
  -c "DELETE FROM users WHERE email = 'admin@local.com';"
```

---

## 📋 Resumo - Fluxo Completo

### Agora (Antes da Migration)

1. ✅ **Criar sua conta:**
   ```bash
   chmod +x scripts/create-super-admin.sh
   ./scripts/create-super-admin.sh
   ```

2. ✅ **Resultado:**
   - Sua conta criada com senha segura (bcrypt)
   - Você é super_admin
   - Vinculado à "Organização Principal"
   - Organização criada se não existir

### Depois (Após Migration Completa)

3. ✅ **Executar migration:**
   ```bash
   ./scripts/run-migration.sh
   ```

4. ✅ **Resultado:**
   - Todos os dados migrados para "Organização Principal"
   - Tabelas de multi-tenancy criadas
   - Sistema funcionando com isolamento

5. ✅ **Adicionar usuários:**
   - Via interface web (após Parte 2)
   - Ou via SQL conforme exemplos acima

### Login e Uso

6. ✅ **Fazer login:**
   ```bash
   POST /api/auth/login
   {
     "email": "seu@email.com",
     "password": "SuaSenha"
   }
   ```

7. ✅ **Usar o sistema:**
   - Header: `Authorization: Bearer SEU_TOKEN`
   - Acesso total aos seus dados
   - Criar organizações
   - Adicionar usuários

---

## ❓ Perguntas Frequentes

**P: Preciso remover admin@local.com?**
R: Não é obrigatório, mas recomendado se você não usa.

**P: Posso ter múltiplos super_admins?**
R: Sim! Você pode promover outros usuários.

**P: Como adiciono um admin aos meus dados?**
R: Crie usuário e vincule com role='admin' à sua organização.

**P: Meus dados atuais serão apagados?**
R: NÃO! Migration preserva 100% dos dados.

**P: Posso mudar o role de um usuário depois?**
R: Sim! UPDATE na tabela organization_members.

---

## 🚀 Próximos Passos

1. ✅ Executar `./scripts/create-super-admin.sh`
2. ✅ Anotar suas credenciais
3. ✅ Executar migration (Parte 2)
4. ✅ Fazer login
5. ✅ Adicionar outros usuários conforme necessário

---

**Dúvidas?** Consulte este guia ou a documentação completa!
