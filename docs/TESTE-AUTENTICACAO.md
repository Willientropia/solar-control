# 🧪 Guia de Testes - Sistema de Autenticação JWT

## 📚 Índice
1. [Pré-requisitos](#pre-requisitos)
2. [Testando Autenticação](#testando-autenticacao)
3. [Testando Organizações](#testando-organizacoes)
4. [Casos de Teste Completos](#casos-de-teste)
5. [Troubleshooting](#troubleshooting)

---

## 🔧 Pré-requisitos {#pre-requisitos}

### 1. Verificar que o servidor está rodando

```bash
# Verificar Docker
docker ps

# Deve mostrar: solar-control-db-1 e solar-control-web-1
```

### 2. Verificar variáveis de ambiente

```bash
# Verificar se .env tem as variáveis JWT
cat .env | grep JWT

# Deve mostrar:
# JWT_SECRET=...
# JWT_EXPIRES_IN=15m
# REFRESH_TOKEN_EXPIRES_DAYS=7
# BCRYPT_ROUNDS=12
```

### 3. Verificar se super admin existe

```bash
docker exec -it solar-control-db-1 psql -U postgres -d soltech -c \
  "SELECT email, first_name, is_active FROM users WHERE email = 'willie.engenharia@gmail.com';"
```

---

## 🔐 Testando Autenticação {#testando-autenticacao}

### Teste 1: Login (Super Admin)

**Endpoint:** `POST /api/auth/login`

```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "willie.engenharia@gmail.com",
    "password": "SUA_SENHA_AQUI"
  }'
```

**Resposta esperada (200 OK):**
```json
{
  "message": "Login realizado com sucesso",
  "user": {
    "id": "uuid-here",
    "email": "willie.engenharia@gmail.com",
    "firstName": "Pedro",
    "lastName": null,
    "organization": {
      "id": "org-uuid",
      "name": "Organização Principal",
      "slug": "organizacao-principal"
    },
    "role": "super_admin",
    "isActive": true,
    "emailVerified": true
  },
  "tokens": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": 900
  }
}
```

**⚠️ IMPORTANTE:** Copie o `accessToken` para usar nos próximos testes!

### Teste 2: Get User Info

**Endpoint:** `GET /api/auth/me`

```bash
# Substituir SEU_ACCESS_TOKEN pelo token recebido no login
curl -X GET http://localhost:5000/api/auth/me \
  -H "Authorization: Bearer SEU_ACCESS_TOKEN"
```

**Resposta esperada (200 OK):**
```json
{
  "id": "uuid-here",
  "email": "willie.engenharia@gmail.com",
  "firstName": "Pedro",
  "lastName": null,
  "isActive": true,
  "emailVerified": true,
  "organization": {
    "id": "org-uuid",
    "name": "Organização Principal",
    "slug": "organizacao-principal"
  },
  "role": "super_admin",
  "memberSince": "2024-01-01T00:00:00.000Z"
}
```

### Teste 3: Refresh Token

**Endpoint:** `POST /api/auth/refresh`

```bash
# Substituir SEU_REFRESH_TOKEN pelo refreshToken recebido no login
curl -X POST http://localhost:5000/api/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{
    "refreshToken": "SEU_REFRESH_TOKEN"
  }'
```

**Resposta esperada (200 OK):**
```json
{
  "message": "Token atualizado com sucesso",
  "tokens": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": 900
  }
}
```

### Teste 4: Register New User

**Endpoint:** `POST /api/auth/register`

```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "novo.usuario@exemplo.com",
    "password": "SenhaSegura123",
    "firstName": "Novo",
    "lastName": "Usuário",
    "organizationId": "ORG_UUID_AQUI",
    "role": "operador"
  }'
```

**Resposta esperada (201 Created):**
```json
{
  "message": "Usuário criado com sucesso",
  "user": {
    "id": "new-uuid",
    "email": "novo.usuario@exemplo.com",
    "firstName": "Novo",
    "lastName": "Usuário",
    "organization": {
      "id": "org-uuid",
      "name": "Organização Principal",
      "slug": "organizacao-principal"
    },
    "role": "operador"
  },
  "tokens": {
    "accessToken": "...",
    "refreshToken": "...",
    "expiresIn": 900
  }
}
```

### Teste 5: Logout

**Endpoint:** `POST /api/auth/logout`

```bash
curl -X POST http://localhost:5000/api/auth/logout \
  -H "Authorization: Bearer SEU_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "refreshToken": "SEU_REFRESH_TOKEN"
  }'
```

**Resposta esperada (200 OK):**
```json
{
  "message": "Logout realizado com sucesso"
}
```

---

## 🏢 Testando Organizações {#testando-organizacoes}

### Teste 6: Listar Organizações

**Endpoint:** `GET /api/organizations`

```bash
curl -X GET http://localhost:5000/api/organizations \
  -H "Authorization: Bearer SEU_ACCESS_TOKEN"
```

**Resposta esperada (200 OK - Super Admin):**
```json
[
  {
    "id": "uuid-1",
    "name": "Organização Principal",
    "slug": "organizacao-principal",
    "description": "Organização criada para seus dados atuais",
    "isActive": true,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
]
```

### Teste 7: Criar Nova Organização (Super Admin Only)

**Endpoint:** `POST /api/organizations`

```bash
curl -X POST http://localhost:5000/api/organizations \
  -H "Authorization: Bearer SEU_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Cliente Solar ABC",
    "slug": "cliente-abc",
    "description": "Organização do cliente ABC"
  }'
```

**Resposta esperada (201 Created):**
```json
{
  "message": "Organização criada com sucesso",
  "organization": {
    "id": "new-org-uuid",
    "name": "Cliente Solar ABC",
    "slug": "cliente-abc",
    "description": "Organização do cliente ABC",
    "isActive": true,
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
}
```

### Teste 8: Ver Detalhes da Organização

**Endpoint:** `GET /api/organizations/:id`

```bash
curl -X GET http://localhost:5000/api/organizations/ORG_UUID \
  -H "Authorization: Bearer SEU_ACCESS_TOKEN"
```

### Teste 9: Listar Membros da Organização

**Endpoint:** `GET /api/organizations/:id/members`

```bash
curl -X GET http://localhost:5000/api/organizations/ORG_UUID/members \
  -H "Authorization: Bearer SEU_ACCESS_TOKEN"
```

**Resposta esperada (200 OK):**
```json
[
  {
    "id": "member-uuid-1",
    "organizationId": "org-uuid",
    "userId": "user-uuid-1",
    "role": "super_admin",
    "isActive": true,
    "joinedAt": "2024-01-01T00:00:00.000Z",
    "user": {
      "id": "user-uuid-1",
      "email": "willie.engenharia@gmail.com",
      "firstName": "Pedro"
    }
  }
]
```

### Teste 10: Adicionar Membro à Organização

**Endpoint:** `POST /api/organizations/:id/members`

```bash
curl -X POST http://localhost:5000/api/organizations/ORG_UUID/members \
  -H "Authorization: Bearer SEU_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "USER_UUID",
    "role": "admin"
  }'
```

**Resposta esperada (201 Created):**
```json
{
  "message": "Membro adicionado com sucesso",
  "member": {
    "id": "new-member-uuid",
    "organizationId": "org-uuid",
    "userId": "user-uuid",
    "role": "admin",
    "isActive": true,
    "joinedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

### Teste 11: Atualizar Role do Membro

**Endpoint:** `PATCH /api/organizations/:id/members/:userId`

```bash
curl -X PATCH http://localhost:5000/api/organizations/ORG_UUID/members/USER_UUID \
  -H "Authorization: Bearer SEU_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "role": "operador"
  }'
```

---

## 🧩 Casos de Teste Completos {#casos-de-teste}

### Caso 1: Fluxo Completo - Criar Nova Organização com Admin

```bash
# 1. Login como super_admin
LOGIN_RESPONSE=$(curl -s -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "willie.engenharia@gmail.com",
    "password": "SUA_SENHA"
  }')

# Extrair token (requer jq)
ACCESS_TOKEN=$(echo $LOGIN_RESPONSE | jq -r '.tokens.accessToken')

# 2. Criar nova organização
ORG_RESPONSE=$(curl -s -X POST http://localhost:5000/api/organizations \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Empresa XYZ",
    "slug": "empresa-xyz",
    "description": "Nova empresa cliente"
  }')

ORG_ID=$(echo $ORG_RESPONSE | jq -r '.organization.id')

# 3. Registrar novo usuário admin para essa organização
USER_RESPONSE=$(curl -s -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"admin@empresa-xyz.com\",
    \"password\": \"SenhaAdmin123\",
    \"firstName\": \"Admin\",
    \"lastName\": \"XYZ\",
    \"organizationId\": \"$ORG_ID\",
    \"role\": \"admin\"
  }")

echo "✅ Organização criada: $ORG_ID"
echo "✅ Admin criado: admin@empresa-xyz.com"
```

### Caso 2: Teste de Permissões

```bash
# 1. Login como operador
OPERADOR_TOKEN=$(curl -s -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "operador@exemplo.com",
    "password": "senha123"
  }' | jq -r '.tokens.accessToken')

# 2. Tentar criar organização (deve falhar - 403)
curl -X POST http://localhost:5000/api/organizations \
  -H "Authorization: Bearer $OPERADOR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Teste",
    "slug": "teste"
  }'

# Resposta esperada: 403 Forbidden
# {"error": "Acesso negado", "message": "..."}
```

---

## 🔍 Troubleshooting {#troubleshooting}

### Erro: "Token inválido ou expirado"

**Causa:** Access token expirou (15 minutos)

**Solução:**
```bash
# Use o refresh token para obter novo access token
curl -X POST http://localhost:5000/api/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{
    "refreshToken": "SEU_REFRESH_TOKEN"
  }'
```

### Erro: "Credenciais inválidas"

**Causas possíveis:**
1. Email incorreto
2. Senha incorreta
3. Usuário não existe
4. Usuário inativo

**Verificar no banco:**
```bash
docker exec -it solar-control-db-1 psql -U postgres -d soltech -c \
  "SELECT email, is_active, email_verified FROM users WHERE email = 'seu@email.com';"
```

### Erro: "Acesso negado"

**Causa:** Usuário não tem permissão para a operação

**Verificar role:**
```bash
docker exec -it solar-control-db-1 psql -U postgres -d soltech -c \
  "SELECT u.email, om.role FROM users u
   JOIN organization_members om ON u.id = om.user_id
   WHERE u.email = 'seu@email.com';"
```

### Erro: "Organização não encontrada"

**Verificar organizações no banco:**
```bash
docker exec -it solar-control-db-1 psql -U postgres -d soltech -c \
  "SELECT id, name, slug, is_active FROM organizations;"
```

---

## 📊 Matriz de Permissões

| Endpoint | Super Admin | Admin | Operador |
|----------|-------------|-------|----------|
| POST /api/auth/register | ✅ | ✅ | ❌ |
| POST /api/auth/login | ✅ | ✅ | ✅ |
| GET /api/auth/me | ✅ | ✅ | ✅ |
| POST /api/organizations | ✅ | ❌ | ❌ |
| GET /api/organizations | ✅ (todas) | ✅ (só sua) | ✅ (só sua) |
| PATCH /api/organizations/:id | ✅ (todas) | ✅ (só sua) | ❌ |
| GET /api/organizations/:id/members | ✅ | ✅ (só sua org) | ❌ |
| POST /api/organizations/:id/members | ✅ | ✅ (só sua org) | ❌ |
| PATCH /api/organizations/:id/members/:userId | ✅ | ✅ (só sua org) | ❌ |

---

## ✅ Checklist de Testes

Marque conforme for testando:

### Autenticação
- [ ] Login com super_admin funciona
- [ ] Login com credenciais erradas retorna 401
- [ ] GET /api/auth/me retorna dados corretos
- [ ] Refresh token funciona
- [ ] Refresh token expirado retorna erro
- [ ] Logout revoga refresh token
- [ ] Registro de novo usuário funciona
- [ ] Registro com email duplicado retorna erro

### Organizações
- [ ] Super admin vê todas as organizações
- [ ] Admin vê apenas sua organização
- [ ] Criar organização funciona (super_admin)
- [ ] Criar organização falha (admin/operador)
- [ ] Listar membros funciona
- [ ] Adicionar membro funciona
- [ ] Atualizar role de membro funciona
- [ ] Operador não consegue acessar endpoints de admin

### Segurança
- [ ] Token expirado (15min) não funciona
- [ ] Request sem token retorna 401
- [ ] Token inválido retorna 401
- [ ] Operador não consegue acessar recursos de admin
- [ ] Admin não consegue acessar outra organização

---

## 🚀 Próximos Passos

Após todos os testes passarem:

1. ✅ Fazer commit das mudanças
2. ✅ Criar backup do banco
3. ✅ Documentar endpoints na interface do frontend
4. ✅ Implementar rate limiting (opcional)
5. ✅ Implementar email de verificação (opcional)

---

**Dúvidas?** Consulte a documentação completa ou o código-fonte!
