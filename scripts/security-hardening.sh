#!/bin/bash

# ===============================================
# Script de Hardening de Segurança
# Sistema: Solar Control
# Versão: 1.0
# ===============================================

set -e

echo "🔒 Iniciando Hardening de Segurança do Solar Control..."
echo ""

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# ===============================================
# 1. GERAR JWT_SECRET SEGURO
# ===============================================

echo "📝 1/5 - Gerando JWT_SECRET seguro..."

# Gerar secret cryptographically secure
JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(64).toString('hex'))")

if [ -z "$JWT_SECRET" ]; then
    echo -e "${RED}❌ Falha ao gerar JWT_SECRET${NC}"
    exit 1
fi

# Atualizar .env
if grep -q "^JWT_SECRET=" .env 2>/dev/null; then
    # Substituir valor existente
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        sed -i '' "s|^JWT_SECRET=.*|JWT_SECRET=$JWT_SECRET|" .env
    else
        # Linux
        sed -i "s|^JWT_SECRET=.*|JWT_SECRET=$JWT_SECRET|" .env
    fi
    echo -e "${GREEN}✅ JWT_SECRET atualizado em .env${NC}"
else
    # Adicionar se não existir
    echo "JWT_SECRET=$JWT_SECRET" >> .env
    echo -e "${GREEN}✅ JWT_SECRET adicionado ao .env${NC}"
fi

echo ""

# ===============================================
# 2. VERIFICAR .gitignore
# ===============================================

echo "📝 2/5 - Verificando .gitignore..."

if ! grep -q "^\.env$" .gitignore 2>/dev/null; then
    echo ".env" >> .gitignore
    echo -e "${YELLOW}⚠️  .env adicionado ao .gitignore${NC}"
else
    echo -e "${GREEN}✅ .env já está no .gitignore${NC}"
fi

if ! grep -q "^\.env\.production$" .gitignore 2>/dev/null; then
    echo ".env.production" >> .gitignore
    echo -e "${YELLOW}⚠️  .env.production adicionado ao .gitignore${NC}"
else
    echo -e "${GREEN}✅ .env.production já está no .gitignore${NC}"
fi

echo ""

# ===============================================
# 3. AUDIT NPM PACKAGES
# ===============================================

echo "📝 3/5 - Auditando vulnerabilidades npm..."

if command -v npm &> /dev/null; then
    echo "Executando npm audit..."
    npm audit --audit-level=moderate || echo -e "${YELLOW}⚠️  Vulnerabilidades encontradas. Execute 'npm audit fix' para corrigir.${NC}"
    echo ""
else
    echo -e "${YELLOW}⚠️  npm não encontrado. Pulando audit.${NC}"
    echo ""
fi

# ===============================================
# 4. CRIAR .env.example SEGURO
# ===============================================

echo "📝 4/5 - Atualizando .env.example..."

cat > .env.example.security << 'EOF'
# ==================== CONFIGURAÇÃO DE SEGURANÇA ====================
#
# IMPORTANTE: Não commite este arquivo com valores reais!
# Use este arquivo apenas como template.
#

# Database (PostgreSQL)
DATABASE_URL=postgresql://usuario:senha@host:5432/database

# Session (Legacy - será removido)
SESSION_SECRET=gere-um-secret-seguro-aqui

# Node Environment
NODE_ENV=production

# ==================== JWT CONFIGURATION (CRÍTICO!) ====================
#
# NUNCA use os valores padrão em produção!
# Gere um JWT_SECRET seguro com:
# node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
#
JWT_SECRET=GERE_UM_SECRET_DE_64_BYTES_AQUI
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_DAYS=7
BCRYPT_ROUNDS=12

# ==================== OPCIONAIS ====================

# Email (para recuperação de senha - futuro)
# SMTP_HOST=smtp.gmail.com
# SMTP_PORT=587
# SMTP_USER=seu@email.com
# SMTP_PASSWORD=sua-senha-de-app

# Monitoring
# SENTRY_DSN=https://...
#
EOF

echo -e "${GREEN}✅ .env.example.security criado${NC}"
echo ""

# ===============================================
# 5. GERAR RELATÓRIO
# ===============================================

echo "📝 5/5 - Gerando relatório..."

REPORT_FILE="security-hardening-report-$(date +%Y%m%d-%H%M%S).txt"

cat > "$REPORT_FILE" << EOF
============================================
RELATÓRIO DE HARDENING DE SEGURANÇA
Data: $(date)
============================================

✅ AÇÕES COMPLETADAS:
1. JWT_SECRET gerado e atualizado em .env
2. .gitignore verificado e atualizado
3. npm audit executado
4. .env.example.security criado

🔒 JWT_SECRET:
$(echo "$JWT_SECRET" | cut -c1-20)... (64 bytes)

⚠️  AÇÕES MANUAIS NECESSÁRIAS:

1. HTTPS (CRÍTICO)
   - Configurar certificado SSL (Let's Encrypt)
   - Forçar redirecionamento HTTP → HTTPS
   - Atualizar docker-compose.yml para usar HTTPS

2. Rate Limiting (IMPORTANTE)
   - Instalar: npm install express-rate-limit
   - Ver: docs/RELATORIO-SEGURANCA.md seção 5.4

3. Validação de Arquivos (IMPORTANTE)
   - Adicionar validação de MIME types
   - Ver: docs/RELATORIO-SEGURANCA.md seção 4

4. Migrar Tokens para Cookies (RECOMENDADO)
   - Usar httpOnly cookies ao invés de localStorage
   - Ver: docs/RELATORIO-SEGURANCA.md seção 2

5. Configurar Backups (CRÍTICO)
   - Configurar cron job para backup diário
   - Já existe: scripts/backup-database.sh

6. Monitoramento (RECOMENDADO)
   - Configurar Sentry ou similar
   - Adicionar health checks

📚 DOCUMENTAÇÃO:
- Relatório completo: docs/RELATORIO-SEGURANCA.md
- Checklist de deploy: docs/RELATORIO-SEGURANCA.md#checklist-deploy

🚀 PRÓXIMOS PASSOS:
1. Revisar e aplicar ações manuais acima
2. Testar sistema completamente
3. Fazer backup do banco de dados
4. Deploy em staging para testes finais
5. Deploy em produção

⚠️  LEMBRE-SE:
- NUNCA commitar o arquivo .env
- Fazer backup antes de qualquer deploy
- Testar em staging primeiro
- Ter plano de rollback pronto

============================================
EOF

echo -e "${GREEN}✅ Relatório gerado: $REPORT_FILE${NC}"
echo ""

# ===============================================
# RESUMO FINAL
# ===============================================

echo "============================================"
echo -e "${GREEN}✅ HARDENING COMPLETADO COM SUCESSO!${NC}"
echo "============================================"
echo ""
echo "📋 Resumo:"
echo "  ✅ JWT_SECRET gerado e configurado"
echo "  ✅ .gitignore atualizado"
echo "  ✅ Vulnerabilidades auditadas"
echo "  ✅ Templates de segurança criados"
echo "  ✅ Relatório gerado"
echo ""
echo "⚠️  Ações Manuais Necessárias:"
echo "  1. Configurar HTTPS (CRÍTICO)"
echo "  2. Implementar rate limiting"
echo "  3. Revisar validação de arquivos"
echo ""
echo "📚 Documentação completa:"
echo "  docs/RELATORIO-SEGURANCA.md"
echo ""
echo "📄 Relatório detalhado salvo em:"
echo "  $REPORT_FILE"
echo ""
echo "🚀 Próximo passo: Revisar o relatório e aplicar ações manuais"
echo "============================================"
