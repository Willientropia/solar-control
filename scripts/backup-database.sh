#!/bin/bash

# Script de Backup do PostgreSQL para Docker
# Este script cria um dump completo do banco de dados

set -e

# Configurações
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_DIR="./backups"
BACKUP_FILE="solar-control-backup-${TIMESTAMP}.sql"
CONTAINER_NAME="solar-control-db-1"
DB_NAME="soltech"
DB_USER="postgres"

# Cores para output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}================================================${NC}"
echo -e "${GREEN}  BACKUP DO BANCO DE DADOS SOLAR CONTROL${NC}"
echo -e "${GREEN}================================================${NC}"
echo ""

# Criar diretório de backups se não existir
mkdir -p "$BACKUP_DIR"

echo -e "${YELLOW}📦 Criando backup do banco de dados...${NC}"
echo "Container: $CONTAINER_NAME"
echo "Banco de dados: $DB_NAME"
echo "Arquivo: $BACKUP_FILE"
echo ""

# Executar pg_dump dentro do container
docker exec -t "$CONTAINER_NAME" pg_dump -U "$DB_USER" -d "$DB_NAME" \
  --clean \
  --if-exists \
  --create \
  --column-inserts \
  --no-owner \
  --no-acl \
  > "$BACKUP_DIR/$BACKUP_FILE"

# Verificar se o backup foi criado
if [ -f "$BACKUP_DIR/$BACKUP_FILE" ]; then
    FILE_SIZE=$(du -h "$BACKUP_DIR/$BACKUP_FILE" | cut -f1)
    echo -e "${GREEN}✅ Backup criado com sucesso!${NC}"
    echo "📁 Localização: $BACKUP_DIR/$BACKUP_FILE"
    echo "📊 Tamanho: $FILE_SIZE"
    echo ""

    # Criar também um backup comprimido
    echo -e "${YELLOW}🗜️  Comprimindo backup...${NC}"
    gzip -c "$BACKUP_DIR/$BACKUP_FILE" > "$BACKUP_DIR/$BACKUP_FILE.gz"

    COMPRESSED_SIZE=$(du -h "$BACKUP_DIR/$BACKUP_FILE.gz" | cut -f1)
    echo -e "${GREEN}✅ Backup comprimido criado!${NC}"
    echo "📁 Localização: $BACKUP_DIR/$BACKUP_FILE.gz"
    echo "📊 Tamanho: $COMPRESSED_SIZE"
    echo ""

    # Listar backups existentes
    echo -e "${YELLOW}📋 Backups disponíveis:${NC}"
    ls -lh "$BACKUP_DIR" | grep -v total
    echo ""

    echo -e "${GREEN}================================================${NC}"
    echo -e "${GREEN}  BACKUP CONCLUÍDO COM SUCESSO!${NC}"
    echo -e "${GREEN}================================================${NC}"
    echo ""
    echo "💡 Dicas:"
    echo "  • Guarde este backup em local seguro (Google Drive, Dropbox, etc)"
    echo "  • Para restaurar: ./scripts/restore-database.sh $BACKUP_DIR/$BACKUP_FILE"
    echo "  • Para limpeza automática de backups antigos: ./scripts/cleanup-old-backups.sh"
    echo ""
else
    echo -e "${RED}❌ Erro ao criar backup!${NC}"
    exit 1
fi
