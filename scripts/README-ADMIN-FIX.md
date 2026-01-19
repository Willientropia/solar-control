# 🔓 Como Resolver Problema de Acesso Admin

## 🚨 Problema

Você está logado mas seu usuário está como **operador** e precisa ser **admin** para acessar:
- Export/Import de dados
- Relatórios
- Auditoria
- Configurações
- Gerenciamento de usuários

---

## ✅ SOLUÇÃO RÁPIDA (3 métodos)

### 🎯 MÉTODO 1: Script Automático (RECOMENDADO)

**Promove TODOS os usuários para admin** (use se você é o único usuário):

```bash
# Dar permissão
chmod +x scripts/promote-all-to-admin.sh

# Executar
./scripts/promote-all-to-admin.sh
```

**O que acontece:**
1. Lista todos os usuários atuais
2. Pede confirmação
3. Promove todos para admin
4. Mostra resultado

**Depois:**
1. Faça **logout** do sistema
2. Faça **login** novamente
3. ✅ Pronto! Você é admin agora

---

### 🎯 MÉTODO 2: Script com Email Específico

Se você tem múltiplos usuários e quer promover apenas um:

```bash
# Dar permissão
chmod +x scripts/promote-to-admin.sh

# Executar
./scripts/promote-to-admin.sh
```

Vai pedir o email do usuário e promover apenas ele.

---

### 🎯 MÉTODO 3: SQL Direto (se scripts não funcionarem)

Execute diretamente no PostgreSQL:

```bash
# 1. Entrar no container do PostgreSQL
docker exec -it solar-control-db-1 psql -U postgres -d soltech

# 2. Executar comandos SQL
```

**Depois de entrar no psql, cole isso:**

```sql
-- Ver usuários atuais
SELECT
  u.email,
  COALESCE(up.role, 'SEM ROLE') as role_atual
FROM users u
LEFT JOIN user_profiles up ON u.id = up.user_id;

-- Promover TODOS para admin
INSERT INTO user_profiles (user_id, role)
SELECT u.id, 'admin'
FROM users u
WHERE NOT EXISTS (
  SELECT 1 FROM user_profiles up WHERE up.user_id = u.id
);

UPDATE user_profiles SET role = 'admin';

-- Verificar
SELECT u.email, up.role FROM users u
JOIN user_profiles up ON u.id = up.user_id;

-- Sair
\q
```

---

## 🔍 Como Verificar se Funcionou

Depois de fazer logout e login novamente, verifique se você tem acesso a:

### No Menu Lateral:
- ✅ **Relatórios** (ícone 📊)
- ✅ **Auditoria** (ícone 🔍)
- ✅ **Configurações** (ícone ⚙️)

### Endpoints que agora funcionam:
```bash
# Testar export (com seu cookie de sessão)
curl -X GET "http://localhost:5000/api/admin/export/all" \
  -H "Cookie: connect.sid=SEU_COOKIE" \
  --output teste-admin.xlsx
```

Se o arquivo `teste-admin.xlsx` for criado, **está funcionando!** ✅

---

## 🆘 Solução de Problemas

### Problema: "Container não encontrado"

**Verificar nome do container:**
```bash
docker ps
```

Se o nome for diferente, edite os scripts e mude `solar-control-db-1` para o nome correto.

### Problema: Scripts não executam

**Dar permissão:**
```bash
chmod +x scripts/*.sh
```

### Problema: "Permission denied" no Docker

**Executar com sudo:**
```bash
sudo ./scripts/promote-all-to-admin.sh
```

### Problema: Mesmo após promover, ainda não é admin

**Motivos possíveis:**

1. **Você não fez logout/login**
   - Solução: Feche o navegador completamente e abra novamente

2. **Cache do navegador**
   - Solução: Limpar cookies e cache (Ctrl+Shift+Delete)

3. **Sessão não atualizou**
   - Solução: Reiniciar servidor Docker
   ```bash
   docker-compose restart
   ```

4. **Banco não atualizou**
   - Solução: Verificar SQL direto
   ```bash
   docker exec -it solar-control-db-1 psql -U postgres -d soltech -c \
     "SELECT u.email, up.role FROM users u JOIN user_profiles up ON u.id = up.user_id;"
   ```

---

## 📊 Como Pegar o Cookie de Sessão (para testar API)

### Google Chrome / Edge:

1. Abra o sistema no navegador
2. Faça login
3. Pressione **F12** (DevTools)
4. Aba **Application** (ou **Aplicativo**)
5. Menu lateral: **Storage** → **Cookies** → `http://localhost:5000`
6. Procure: `connect.sid`
7. Copie o **Value** (valor)

### Firefox:

1. Abra o sistema no navegador
2. Faça login
3. Pressione **F12**
4. Aba **Armazenamento** (Storage)
5. Cookies → `http://localhost:5000`
6. Procure: `connect.sid`
7. Copie o **Valor**

### Exemplo de uso:

```bash
# Substitua XXXXX pelo valor copiado
curl -X GET "http://localhost:5000/api/admin/export/all" \
  -H "Cookie: connect.sid=s%3AjYmVhNzgtMDI0Zi00..." \
  --output backup.xlsx
```

---

## 🎯 Teste Completo

Depois de se tornar admin, teste tudo:

```bash
# 1. Promover para admin
./scripts/promote-all-to-admin.sh

# 2. Logout e Login no navegador

# 3. Pegar cookie de sessão (via DevTools)

# 4. Testar export
curl -X GET "http://localhost:5000/api/admin/export/all" \
  -H "Cookie: connect.sid=SEU_COOKIE_AQUI" \
  --output teste-completo.xlsx

# 5. Verificar arquivo criado
ls -lh teste-completo.xlsx

# 6. Abrir no Excel
# Se criou o arquivo, SUCESSO! 🎉
```

---

## ✅ Checklist Final

- [ ] Executei script de promoção
- [ ] Fiz logout do sistema
- [ ] Fiz login novamente
- [ ] Vejo opções de admin no menu
- [ ] Testei export via API
- [ ] Arquivo Excel foi criado
- [ ] Consegui abrir arquivo no Excel

Se todos marcados: **PROBLEMA RESOLVIDO!** 🎉

---

## 💡 Dica Pro

Depois que virar admin, faça um export completo para ter seu primeiro backup Excel:

```bash
# Export completo
curl -X GET "http://localhost:5000/api/admin/export/all" \
  -H "Cookie: connect.sid=SEU_COOKIE" \
  --output "backup-solar-$(date +%Y%m%d).xlsx"

# Guardar em local seguro
cp backup-solar-*.xlsx ~/Google\ Drive/Backups/
```

Agora você tem:
- ✅ Acesso admin
- ✅ Backup SQL
- ✅ Backup Excel
- ✅ Sistema protegido

**Pronto para a Fase 2!** 🚀
