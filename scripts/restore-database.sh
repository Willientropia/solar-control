#!/bin/bash

# Script de Restauração do PostgreSQL
# Restaura um backup do banco de dados

set -e

# Configurações
CONTAINER_NAME="solar-control-db-1"
DB_NAME="soltech"
DB_USER="postgres"

# Cores para output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Verificar se foi passado o arquivo de backup
if [ -z "$1" ]; then
    echo -e "${RED}❌ Erro: Arquivo de backup não especificado${NC}"
    echo ""
    echo "Uso: ./scripts/restore-database.sh <arquivo-backup>"
    echo "Exemplo: ./scripts/restore-database.sh ./backups/solar-control-backup-20260118_143000.sql"
    echo ""
    echo "Backups disponíveis:"
    ls -lh ./backups/*.sql 2>/dev/null || echo "  Nenhum backup encontrado"
    exit 1
fi

BACKUP_FILE="$1"

# Verificar se o arquivo existe
if [ ! -f "$BACKUP_FILE" ]; then
    echo -e "${RED}❌ Erro: Arquivo de backup não encontrado: $BACKUP_FILE${NC}"
    exit 1
fi

echo -e "${RED}================================================${NC}"
echo -e "${RED}  RESTAURAÇÃO DO BANCO DE DADOS${NC}"
echo -e "${RED}================================================${NC}"
echo ""
echo -e "${YELLOW}⚠️  ATENÇÃO: Esta operação irá substituir TODOS os dados atuais!${NC}"
echo ""
echo "Container: $CONTAINER_NAME"
echo "Banco de dados: $DB_NAME"
echo "Backup: $BACKUP_FILE"
echo ""

# Confirmar ação
read -p "Deseja continuar? (digite 'SIM' em maiúsculas para confirmar): " CONFIRM

if [ "$CONFIRM" != "SIM" ]; then
    echo -e "${YELLOW}❌ Restauração cancelada pelo usuário${NC}"
    exit 0
fi

echo ""
echo -e "${YELLOW}📦 Criando backup de segurança antes da restauração...${NC}"
SAFETY_BACKUP="./backups/pre-restore-backup-$(date +"%Y%m%d_%H%M%S").sql"
docker exec -t "$CONTAINER_NAME" pg_dump -U "$DB_USER" -d "$DB_NAME" \
  --clean \
  --if-exists \
  --create \
  --column-inserts \
  --no-owner \
  --no-acl \
  > "$SAFETY_BACKUP"
echo -e "${GREEN}✅ Backup de segurança criado: $SAFETY_BACKUP${NC}"
echo ""

echo -e "${YELLOW}🔄 Restaurando banco de dados...${NC}"

# Se o arquivo for .gz, descompactar primeiro
if [[ "$BACKUP_FILE" == *.gz ]]; then
    echo "🗜️  Descompactando backup..."
    gunzip -c "$BACKUP_FILE" | docker exec -i "$CONTAINER_NAME" psql -U "$DB_USER" -d postgres
else
    cat "$BACKUP_FILE" | docker exec -i "$CONTAINER_NAME" psql -U "$DB_USER" -d postgres
fi

echo ""
echo -e "${GREEN}================================================${NC}"
echo -e "${GREEN}  RESTAURAÇÃO CONCLUÍDA COM SUCESSO!${NC}"
echo -e "${GREEN}================================================${NC}"
echo ""
echo "💡 Backup de segurança salvo em: $SAFETY_BACKUP"
echo "   (caso precise reverter a restauração)"
echo ""
