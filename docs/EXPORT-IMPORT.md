# 📊 Sistema de Export/Import Excel - Solar Control

Sistema completo de backup, export e import de dados em formato Excel (.xlsx).

---

## 🎯 Objetivos

1. **Backup Legível**: Todos os dados em formato Excel editável
2. **Segurança Extra**: Backup portável que pode ser guardado em qualquer lugar
3. **Migração Fácil**: Copiar dados entre organizações ou sistemas
4. **Edição em Massa**: Modificar múltiplos registros no Excel e importar de uma vez

---

## 📋 Funcionalidades

### ✅ Export (Exportar Dados)

- **Export Completo**: Todos os dados do sistema em um único arquivo
- **Export Parcial**: Apenas entidades específicas (Usinas, Clientes, etc)
- **Filtros**: Por Usina ou Mês de Referência
- **Formato**: Excel 2007+ (.xlsx) com múltiplas abas coloridas
- **Auto-filtro**: Todas as tabelas com filtros automáticos
- **Metadados**: Aba com informações sobre o export

### ✅ Import (Importar Dados)

- **Validation Preview**: Visualizar o que será criado/atualizado ANTES de salvar
- **3 Modos de Import**:
  - **MERGE** (Recomendado): Atualiza existentes + cria novos
  - **REPLACE** (Cuidado!): Apaga tudo e recria
  - **APPEND**: Só adiciona novos, não atualiza
- **Validação Automática**: Verifica campos obrigatórios e integridade
- **Relatório Detalhado**: Mostra quantos registros foram criados/atualizados/erro

---

## 🚀 Como Usar

### 📤 EXPORTAR DADOS

#### Opção 1: Via API (para desenvolvedores)

```bash
# Export completo
curl -X GET "http://localhost:5000/api/admin/export/all" \
  -H "Cookie: connect.sid=YOUR_SESSION" \
  --output backup-completo.xlsx

# Export de usinas apenas
curl -X GET "http://localhost:5000/api/admin/export/usinas" \
  -H "Cookie: connect.sid=YOUR_SESSION" \
  --output backup-usinas.xlsx

# Export com filtro por usina
curl -X GET "http://localhost:5000/api/admin/export/all?usinaId=abc123" \
  -H "Cookie: connect.sid=YOUR_SESSION" \
  --output backup-usina-especifica.xlsx

# Export com filtro por mês
curl -X GET "http://localhost:5000/api/admin/export/all?mesReferencia=JAN/2026" \
  -H "Cookie: connect.sid=YOUR_SESSION" \
  --output backup-janeiro-2026.xlsx
```

#### Opção 2: Via Interface Web (em breve)

A página de Backup/Restore terá botões para exportar diretamente.

---

### 📥 IMPORTAR DADOS

#### Passo 1: Preparar o Arquivo Excel

1. Baixe um export atual do sistema (serve como template)
2. Edite no Excel/LibreOffice
3. **IMPORTANTE**: Não mude os nomes das abas ou colunas!
4. Salve como `.xlsx`

#### Passo 2: Preview (Validação)

Antes de importar, veja o que vai acontecer:

```bash
curl -X POST "http://localhost:5000/api/admin/import/preview" \
  -H "Cookie: connect.sid=YOUR_SESSION" \
  -F "file=@meu-backup.xlsx"
```

**Resposta:**
```json
{
  "usinas": {
    "criar": 2,
    "atualizar": 3,
    "erros": []
  },
  "clientes": {
    "criar": 10,
    "atualizar": 5,
    "erros": ["Linha 15: Usina ID não encontrado"]
  },
  "faturas": {
    "criar": 50,
    "atualizar": 0,
    "erros": []
  },
  "geracao": {
    "criar": 12,
    "atualizar": 0,
    "erros": []
  },
  "precos": {
    "criar": 6,
    "atualizar": 0,
    "erros": []
  }
}
```

#### Passo 3: Importar

Se o preview estiver OK, execute o import:

```bash
# MERGE (Recomendado): Atualiza existentes + cria novos
curl -X POST "http://localhost:5000/api/admin/import" \
  -H "Cookie: connect.sid=YOUR_SESSION" \
  -F "file=@meu-backup.xlsx" \
  -F "mode=merge"

# REPLACE (CUIDADO!): Apaga tudo e recria
curl -X POST "http://localhost:5000/api/admin/import" \
  -H "Cookie: connect.sid=YOUR_SESSION" \
  -F "file=@meu-backup.xlsx" \
  -F "mode=replace"

# APPEND: Só adiciona novos
curl -X POST "http://localhost:5000/api/admin/import" \
  -H "Cookie: connect.sid=YOUR_SESSION" \
  -F "file=@meu-backup.xlsx" \
  -F "mode=append"
```

---

## 📊 Estrutura do Arquivo Excel

### Arquivo Exportado

```
SolarControl-Export-2026-01-18T14-30-00.xlsx
├── 📋 Metadados (informações sobre o export)
├── 🏭 Usinas (dados das usinas solares)
├── 👥 Clientes (unidades consumidoras)
├── 📄 Faturas (faturas cadastradas)
├── ⚡ Geração Mensal (produção mensal das usinas)
└── 💰 Preços kWh (tabela de preços mensais)
```

### Aba "📋 Metadados"

Informações sobre o export:
- Sistema e versão
- Data do export
- Entidades incluídas
- Filtros aplicados
- **Instruções importantes de import**

### Aba "🏭 Usinas"

| ID | Nome | UC | Produção Mensal | Potência | Desconto | Endereço | Criado Em |
|----|------|----|-----------------|----------|----------|----------|-----------|
| abc-123 | SOLTECH Lote 7 | 123456 | 20000.00 | 150.500 | 10.00 | Rua ABC | 2025-01-01 |

### Aba "👥 Clientes"

| ID | Nome | CPF/CNPJ | UC | Usina ID | Desconto | É Pagante | Ativo |
|----|------|----------|-----|----------|----------|-----------|-------|
| xyz-456 | João Silva | 123.456.789-00 | 999888 | abc-123 | 15.00 | Sim | Sim |

### Aba "📄 Faturas"

| ID | Cliente ID | Usina ID | Mês Ref | Consumo SCEE | Valor Total | Status |
|----|------------|----------|---------|--------------|-------------|--------|
| fat-001 | xyz-456 | abc-123 | JAN/2026 | 500.00 | 250.00 | pago |

### Aba "⚡ Geração Mensal"

| ID | Usina ID | Mês Ref | kWh Gerado | Alerta | Observações |
|----|----------|---------|------------|--------|-------------|
| ger-001 | abc-123 | JAN/2026 | 25000.00 | Não | Geração normal |

### Aba "💰 Preços kWh"

| ID | Mês Ref | TUSD | TE | ICMS | PIS | COFINS | Preço Calculado |
|----|---------|------|-----|------|-----|--------|-----------------|
| preco-001 | JAN/2026 | 0.35 | 0.25 | 18.00 | 1.65 | 7.60 | 0.825 |

---

## 💡 Casos de Uso

### 1️⃣ Backup Semanal

```bash
#!/bin/bash
# backup-semanal.sh

DATE=$(date +%Y-%m-%d)
BACKUP_FILE="backup-solar-control-${DATE}.xlsx"

curl -X GET "http://localhost:5000/api/admin/export/all" \
  -H "Cookie: connect.sid=$SESSION_COOKIE" \
  --output "$BACKUP_FILE"

# Copiar para Google Drive (exemplo)
rclone copy "$BACKUP_FILE" "gdrive:Backups/SolarControl/"

echo "Backup criado: $BACKUP_FILE"
```

### 2️⃣ Edição em Massa de Descontos

1. Exportar clientes: `GET /api/admin/export/clientes`
2. Abrir no Excel
3. Filtrar clientes da Usina X
4. Mudar desconto de 15% para 20% (editar coluna "Desconto (%)")
5. Salvar arquivo
6. Importar em modo MERGE: `POST /api/admin/import` (mode=merge)
7. ✅ Todos os descontos atualizados automaticamente!

### 3️⃣ Copiar Estrutura para Nova Organização

1. Exportar dados completos
2. Abrir no Excel
3. Remover aba "📄 Faturas" (não copiar faturas antigas)
4. Remover aba "⚡ Geração Mensal" (não copiar histórico)
5. Manter apenas:
   - 🏭 Usinas
   - 👥 Clientes
   - 💰 Preços kWh
6. Gerar novos IDs (ou deixar o sistema gerar)
7. Importar na nova organização

### 4️⃣ Migração de Sistema Legado

Se você tem dados em outro formato:

1. Baixar template: `GET /api/admin/export/all` (vai vir vazio ou com 1 registro de exemplo)
2. Ver estrutura das colunas
3. Copiar/colar seus dados legados nas abas corretas
4. Ajustar formatos (datas, números, etc)
5. Preview: `POST /api/admin/import/preview`
6. Corrigir erros apontados
7. Import final: `POST /api/admin/import` (mode=replace)

---

## ⚠️ Avisos Importantes

### 🚨 MODO REPLACE - EXTREMA CAUTELA!

O modo `replace` **APAGA TODOS OS DADOS** antes de importar!

**Use apenas quando:**
- Você tem certeza absoluta do que está fazendo
- Tem backup de segurança
- Está migrando sistema completamente
- Está em ambiente de testes/desenvolvimento

**NÃO use replace em produção a não ser que seja REALMENTE necessário!**

### 🔒 Segurança

- ✅ Apenas usuários **ADMIN** podem exportar/importar
- ✅ Todos os imports são logados em auditoria
- ✅ Arquivos de import são salvos em `/backups` para auditoria
- ✅ Validação automática antes de salvar no banco

### 📁 Onde os Arquivos São Salvos

```
solar-control/
├── backups/
│   ├── import-2026-01-18T14-30-00-dados.xlsx  (imports recebidos)
│   └── solar-control-backup-20260118_143000.sql  (backups SQL)
└── uploads/
    └── (arquivos PDF das faturas)
```

---

## 🐛 Tratamento de Erros

### Erros Comuns

#### 1. "Linha X: Nome é obrigatório"
**Solução**: Preencher a coluna "Nome" na linha indicada

#### 2. "Linha X: Usina ID não encontrado"
**Solução**: A usina referenciada não existe. Criar a usina primeiro ou corrigir o ID

#### 3. "Linha X: Unidade Consumidora duplicada"
**Solução**: UC deve ser única. Verificar se já existe no sistema

#### 4. "Only Excel files (.xlsx) are allowed"
**Solução**: Salvar arquivo como .xlsx (não .xls ou .csv)

#### 5. "Arquivo muito grande"
**Solução**: Limite é 10MB. Dividir em múltiplos arquivos ou remover abas não necessárias

### Como Debugar Problemas

1. **Sempre use Preview primeiro**: `POST /api/admin/import/preview`
2. **Leia a lista de erros retornada**
3. **Corrija no Excel linha por linha**
4. **Execute preview novamente até não ter erros**
5. **Só então execute o import real**

---

## 🔧 Endpoints da API

### Export

| Endpoint | Método | Descrição | Admin Only |
|----------|--------|-----------|------------|
| `/api/admin/export/all` | GET | Export completo | ✅ |
| `/api/admin/export/usinas` | GET | Apenas usinas | ✅ |
| `/api/admin/export/clientes` | GET | Apenas clientes | ✅ |
| `/api/admin/export/faturas` | GET | Apenas faturas | ✅ |
| `/api/admin/export/geracao` | GET | Apenas geração mensal | ✅ |
| `/api/admin/export/precos` | GET | Apenas preços kWh | ✅ |

### Import

| Endpoint | Método | Descrição | Admin Only |
|----------|--------|-----------|------------|
| `/api/admin/import/preview` | POST | Validar arquivo sem salvar | ✅ |
| `/api/admin/import` | POST | Importar dados (merge/replace/append) | ✅ |

### Query Parameters (Export)

- `usinaId`: Filtrar por ID da usina
- `mesReferencia`: Filtrar por mês (formato: "JAN/2026")

### Form Data (Import)

- `file`: Arquivo .xlsx (multipart/form-data)
- `mode`: `merge` | `replace` | `append`

---

## 📈 Performance

### Tempo Estimado

| Operação | Registros | Tempo Aproximado |
|----------|-----------|------------------|
| Export completo | 1.000 | ~2 segundos |
| Export completo | 10.000 | ~10 segundos |
| Import (merge) | 1.000 | ~5 segundos |
| Import (merge) | 10.000 | ~30 segundos |
| Import (replace) | 10.000 | ~35 segundos (inclui delete) |

**Nota**: Tempos variam conforme hardware e carga do servidor.

### Limites

- **Tamanho máximo do arquivo**: 10 MB
- **Número máximo de linhas**: Sem limite técnico, mas recomendado < 50.000 linhas por aba
- **Timeout de import**: 5 minutos

---

## 🎓 Boas Práticas

### ✅ DO (Faça)

- ✅ **Sempre exporte antes de importar** (ter backup de segurança)
- ✅ **Use Preview antes de Import** (validar dados)
- ✅ **Guarde exports em múltiplos locais** (Google Drive, Dropbox, HD externo)
- ✅ **Use modo MERGE por padrão** (mais seguro)
- ✅ **Documente suas mudanças** (ex: "Atualização de descontos Jan/2026")
- ✅ **Teste em ambiente de desenvolvimento primeiro**

### ❌ DON'T (Não Faça)

- ❌ **Não use REPLACE em produção sem backup**
- ❌ **Não mude nomes de abas ou colunas**
- ❌ **Não remova a aba de Metadados** (serve como documentação)
- ❌ **Não edite IDs sem saber o que está fazendo** (pode quebrar relações)
- ❌ **Não compartilhe exports com pessoas não autorizadas** (contém dados sensíveis)

---

## 🔄 Rotina Recomendada

### Diário
- Export automático via cron (00:00)
- Salvar em pasta local
- **Não limpar backups diários ainda**

### Semanal (Domingo)
- Export manual
- Salvar em Google Drive/Dropbox
- Nomear com data: `solar-2026-01-18.xlsx`

### Mensal
- Export completo
- Compactar em .zip
- Arquivar em local externo (AWS S3, Backblaze, etc)
- Limpar backups diários com mais de 30 dias

### Antes de Atualizações
- **SEMPRE** fazer export completo
- Guardar em local seguro
- Anotar versão do sistema

---

## 📞 Suporte

Em caso de dúvidas ou problemas:

1. Verificar esta documentação
2. Verificar logs do servidor: `docker logs solar-control-app-1`
3. Verificar auditoria: página `/auditoria` do sistema
4. Abrir issue no repositório (se aplicável)

---

## 🆕 Próximas Funcionalidades

Planejado para futuras versões:

- [ ] Interface web completa de Backup/Restore
- [ ] Agendamento de exports automáticos
- [ ] Envio automático de backups para email/cloud
- [ ] Import incremental (apenas mudanças)
- [ ] Versionamento de backups
- [ ] Comparação entre dois exports (diff)
- [ ] Templates de Excel com validação embutida
- [ ] Suporte a formato CSV

---

## 🎉 Conclusão

O sistema de Export/Import Excel fornece:

✅ **Backup legível e editável** dos seus dados
✅ **Portabilidade total** - leve seus dados para qualquer lugar
✅ **Segurança extra** - múltiplas cópias em diferentes formatos
✅ **Flexibilidade** - edite no Excel e importe de volta
✅ **Migração fácil** - copie estruturas entre organizações

**Use com sabedoria e mantenha sempre backups atualizados! 📊🔒**
