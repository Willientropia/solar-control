#!/bin/bash

# Script de Limpeza de Backups Antigos
# Remove backups com mais de N dias

set -e

# Configurações
BACKUP_DIR="./backups"
DAYS_TO_KEEP=30  # Manter backups dos últimos 30 dias

# Cores para output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}================================================${NC}"
echo -e "${YELLOW}  LIMPEZA DE BACKUPS ANTIGOS${NC}"
echo -e "${YELLOW}================================================${NC}"
echo ""
echo "Diretório: $BACKUP_DIR"
echo "Manter backups dos últimos: $DAYS_TO_KEEP dias"
echo ""

# Verificar se o diretório existe
if [ ! -d "$BACKUP_DIR" ]; then
    echo -e "${RED}❌ Diretório de backups não encontrado: $BACKUP_DIR${NC}"
    exit 1
fi

# Contar backups atuais
TOTAL_BACKUPS=$(find "$BACKUP_DIR" -name "*.sql*" -type f | wc -l)
echo "📊 Total de backups: $TOTAL_BACKUPS"
echo ""

# Listar backups que serão removidos
echo -e "${YELLOW}🗑️  Backups que serão removidos (mais de $DAYS_TO_KEEP dias):${NC}"
find "$BACKUP_DIR" -name "*.sql*" -type f -mtime +$DAYS_TO_KEEP -exec ls -lh {} \; | wc -l > /tmp/count.txt
OLD_COUNT=$(cat /tmp/count.txt)

if [ "$OLD_COUNT" -eq 0 ]; then
    echo "  Nenhum backup antigo encontrado."
    echo ""
    echo -e "${GREEN}✅ Nada a fazer. Todos os backups estão dentro do período de retenção.${NC}"
    exit 0
fi

find "$BACKUP_DIR" -name "*.sql*" -type f -mtime +$DAYS_TO_KEEP -exec ls -lh {} \;
echo ""

# Confirmar ação
read -p "Deseja remover estes $OLD_COUNT arquivo(s)? (s/n): " CONFIRM

if [ "$CONFIRM" != "s" ] && [ "$CONFIRM" != "S" ]; then
    echo -e "${YELLOW}❌ Limpeza cancelada pelo usuário${NC}"
    exit 0
fi

echo ""
echo -e "${YELLOW}🗑️  Removendo backups antigos...${NC}"

# Remover backups antigos
find "$BACKUP_DIR" -name "*.sql*" -type f -mtime +$DAYS_TO_KEEP -delete

echo -e "${GREEN}✅ Backups antigos removidos!${NC}"
echo ""

# Mostrar backups restantes
REMAINING_BACKUPS=$(find "$BACKUP_DIR" -name "*.sql*" -type f | wc -l)
echo "📊 Backups restantes: $REMAINING_BACKUPS"
echo ""

echo -e "${GREEN}================================================${NC}"
echo -e "${GREEN}  LIMPEZA CONCLUÍDA!${NC}"
echo -e "${GREEN}================================================${NC}"
