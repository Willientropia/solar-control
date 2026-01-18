# 📦 Scripts de Backup do Solar Control

Scripts para backup e restauração do banco de dados PostgreSQL.

## 🚀 Como Usar

### 1️⃣ Criar Backup

```bash
# Dar permissão de execução (primeira vez)
chmod +x scripts/backup-database.sh

# Executar backup
./scripts/backup-database.sh
```

**O que faz:**
- Cria dump SQL completo do banco de dados
- Salva em `./backups/solar-control-backup-YYYYMMDD_HHMMSS.sql`
- Cria versão comprimida `.gz` (menor tamanho)
- Lista todos os backups disponíveis

**Exemplo de saída:**
```
================================================
  BACKUP DO BANCO DE DADOS SOLAR CONTROL
================================================

📦 Criando backup do banco de dados...
Container: solar-control-db-1
Banco de dados: soltech
Arquivo: solar-control-backup-20260118_143000.sql

✅ Backup criado com sucesso!
📁 Localização: ./backups/solar-control-backup-20260118_143000.sql
📊 Tamanho: 2.4M

✅ Backup comprimido criado!
📁 Localização: ./backups/solar-control-backup-20260118_143000.sql.gz
📊 Tamanho: 512K
```

---

### 2️⃣ Restaurar Backup

```bash
# Dar permissão de execução (primeira vez)
chmod +x scripts/restore-database.sh

# Executar restauração
./scripts/restore-database.sh ./backups/solar-control-backup-20260118_143000.sql
```

**⚠️ ATENÇÃO:** Isso irá **substituir TODOS os dados atuais**!

**O que faz:**
- Cria backup de segurança ANTES de restaurar
- Restaura o banco de dados do arquivo especificado
- Suporta arquivos `.sql` e `.sql.gz`

**Exemplo de saída:**
```
================================================
  RESTAURAÇÃO DO BANCO DE DADOS
================================================

⚠️  ATENÇÃO: Esta operação irá substituir TODOS os dados atuais!

Container: solar-control-db-1
Banco de dados: soltech
Backup: ./backups/solar-control-backup-20260118_143000.sql

Deseja continuar? (digite 'SIM' em maiúsculas para confirmar): SIM

📦 Criando backup de segurança antes da restauração...
✅ Backup de segurança criado: ./backups/pre-restore-backup-20260118_150000.sql

🔄 Restaurando banco de dados...

✅ RESTAURAÇÃO CONCLUÍDA COM SUCESSO!
```

---

### 3️⃣ Limpar Backups Antigos

```bash
# Dar permissão de execução (primeira vez)
chmod +x scripts/cleanup-old-backups.sh

# Executar limpeza
./scripts/cleanup-old-backups.sh
```

**O que faz:**
- Remove backups com mais de 30 dias
- Mantém backups recentes
- Pede confirmação antes de deletar

---

## 📅 Rotina Recomendada

### **Backup Diário Automático** (Opcional)

Adicione ao crontab do seu sistema:

```bash
# Editar crontab
crontab -e

# Adicionar linha (backup todo dia às 3h da manhã)
0 3 * * * cd /caminho/para/solar-control && ./scripts/backup-database.sh
```

### **Backup Manual Semanal**

Todo domingo, criar backup e salvar em local seguro:

```bash
./scripts/backup-database.sh

# Copiar para Google Drive, Dropbox, etc
cp ./backups/solar-control-backup-*.sql.gz ~/Google\ Drive/Backups/
```

### **Limpeza Mensal**

Uma vez por mês, limpar backups antigos:

```bash
./scripts/cleanup-old-backups.sh
```

---

## 🔐 Segurança

### **Onde Guardar Backups**

✅ **Locais Seguros:**
- Google Drive / Dropbox
- Servidor externo (AWS S3, Backblaze)
- HD externo (desconectado do computador)
- Pendrive guardado em local seguro

❌ **Evitar:**
- Apenas no mesmo servidor
- Apenas no computador local
- Sem backup em nuvem

### **Regra 3-2-1 de Backup**

- **3** cópias dos seus dados
- **2** tipos de mídia diferentes
- **1** cópia em local externo (offsite)

**Exemplo:**
1. Dados originais no Docker
2. Backup SQL no computador
3. Backup SQL comprimido no Google Drive

---

## 📊 Estrutura dos Backups

```
./backups/
├── solar-control-backup-20260118_143000.sql      (Backup SQL)
├── solar-control-backup-20260118_143000.sql.gz   (Comprimido)
├── solar-control-backup-20260119_030000.sql      (Backup automático)
├── solar-control-backup-20260119_030000.sql.gz
└── pre-restore-backup-20260118_150000.sql        (Backup de segurança)
```

---

## 🆘 Problemas Comuns

### **Erro: Container não encontrado**

```bash
# Verificar nome do container
docker ps

# Se o nome for diferente, editar os scripts:
# Mudar CONTAINER_NAME="solar-control-db-1" para o nome correto
```

### **Erro: Permissão negada**

```bash
# Dar permissão de execução
chmod +x scripts/*.sh
```

### **Erro: Arquivo não encontrado**

```bash
# Verificar se está na pasta raiz do projeto
pwd
# Deve retornar: /caminho/para/solar-control

# Listar backups disponíveis
ls -lh ./backups/
```

---

## 💡 Dicas Importantes

1. **Sempre teste a restauração** de um backup antigo para garantir que funciona
2. **Faça backup ANTES de qualquer atualização** do sistema
3. **Mantenha múltiplas cópias** em locais diferentes
4. **Documente seus backups** (data, o que contém, etc)
5. **Criptografe backups sensíveis** antes de enviar para nuvem

---

## 🔄 Próximos Passos

Além dos backups SQL, você terá acesso ao sistema de **Export/Import Excel** que permite:

- ✅ Backup legível e editável (Excel)
- ✅ Importação em massa de dados
- ✅ Migração entre organizações
- ✅ Edição de dados fora do sistema

Veja a documentação completa em `/docs/EXPORT-IMPORT.md` (em breve).
