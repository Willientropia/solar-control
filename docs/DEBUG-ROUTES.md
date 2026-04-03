# 🐛 DEBUG - Problema com Rotas JWT

## Problema
As rotas `/api/auth/login` estão retornando HTML ao invés de JSON, indicando que as rotas não estão sendo registradas.

## Causas Possíveis

1. **Erro de importação** - Algum módulo não pode ser carregado
2. **Erro de runtime** - Erro ao executar o código de registro das rotas
3. **Servidor não reiniciado** - Mudanças não foram aplicadas

## Como Debugar

### 1. Ver Logs do Docker

```bash
# Ver logs do servidor
docker-compose logs web

# Ver logs em tempo real
docker-compose logs -f web

# Ver apenas as últimas 100 linhas
docker-compose logs --tail=100 web
```

**Procure por erros como:**
- `Cannot find module`
- `SyntaxError`
- `TypeError`
- `Error loading routes`

### 2. Verificar se Docker foi Reiniciado

```bash
# Parar containers
docker-compose down

# Iniciar novamente
docker-compose up -d

# Aguardar 5-10 segundos
# Testar novamente o login
```

### 3. Verificar se Variáveis de Ambiente Estão Carregadas

```bash
# Ver variáveis dentro do container
docker-compose exec web env | grep JWT

# Deve mostrar:
# JWT_SECRET=sua-chave-secreta-jwt-muito-segura-aqui-2024
# JWT_EXPIRES_IN=15m
# REFRESH_TOKEN_EXPIRES_DAYS=7
# BCRYPT_ROUNDS=12
```

### 4. Teste Manual Dentro do Container

```bash
# Entrar no container
docker-compose exec web sh

# Dentro do container, testar import
node -e "import('./server/services/auth-service.ts').then(() => console.log('OK')).catch(e => console.error(e))"
```

## Erros Comuns

### Erro: "Cannot find module 'auth-service'"
**Solução:** Verificar imports no middleware/auth.ts (já corrigido)

### Erro: "users is not exported from shared/schema"
**Solução:** Imports devem vir de shared/models/auth (já corrigido)

### Erro: "organizationMembers is not exported"
**Solução:** Import deve vir de shared/models/organizations (já corrigido)

### Erro: "AuthService.verifyAccessToken is not a function"
**Solução:** Import deve ser `import * as AuthService` (já corrigido)

## Checklist de Verificação

- [ ] Docker foi reiniciado após últimas mudanças?
- [ ] Logs do Docker não mostram erros?
- [ ] Variáveis de ambiente estão no .env?
- [ ] Container web está rodando? (`docker-compose ps`)
- [ ] Porta 5000 não está sendo usada por outro processo?

## Teste Rápido

Depois de reiniciar o Docker:

```bash
# Teste 1: Health check básico
curl http://localhost:5000/api/dashboard/stats

# Teste 2: Login
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "willie.engenharia@gmail.com", "password": "pedro201203"}'
```

Se o Teste 1 funcionar (retornar JSON) mas o Teste 2 não, é problema específico das rotas JWT.
Se o Teste 1 também retornar HTML, o problema é mais geral (servidor não está carregando).

## Solução Alternativa

Se os logs mostrarem um erro específico que não consigo resolver, posso:
1. Criar endpoints em arquivo separado
2. Simplificar a implementação
3. Adicionar try/catch em volta do código de registro de rotas

**POR FAVOR, COMPARTILHE OS LOGS DO DOCKER!**
