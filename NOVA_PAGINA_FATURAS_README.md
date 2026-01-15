# ✨ Nova Página de Faturas - Instruções de Aplicação

## 🎯 O que foi implementado

### 1. **Novo Sistema de Rastreamento**
Agora o sistema rastreia **dois fluxos completos**:

#### **Fluxo A - Fatura da Concessionária**
- ✅ Upload da fatura original (tem/não tem)
- ✅ Pagamento à concessionária (pago/pendente)

#### **Fluxo B - Fatura com Desconto ao Cliente**
- ✅ Fatura gerada (sim/não) + botão gerar/download
- ✅ Enviada ao cliente (sim/não)
- ✅ Recebida do cliente (sim/não)

**Nota**: Clientes de uso próprio (`isPagante: false`) mostram apenas o Fluxo A.

### 2. **Nova Interface Hierárquica**
- Organização por usina (colapsável)
- Cards individuais por cliente
- Indicadores visuais de status
- Estatísticas por usina e gerais
- Ordenação de clientes por número de contrato
- Contador de expiração de PDFs (30 dias)

### 3. **Novos Endpoints da API**
- `POST /api/faturas/:id/generate-pdf` - Atualizado para registrar timestamp
- `PATCH /api/faturas/:id/marcar-enviada` - Marca como enviada ao cliente
- `PATCH /api/faturas/:id/marcar-recebida` - Marca como recebida do cliente
- `PATCH /api/faturas/:id/desmarcar-enviada` - Desmarca envio
- `PATCH /api/faturas/:id/desmarcar-recebida` - Desmarca recebimento

### 4. **Novos Componentes**
- `FaturaFlowIndicators`: Indicadores visuais dos dois fluxos
- `FaturaStatusCard`: Card individual por cliente com ações contextuais
- `UsinaSection`: Agrupamento colapsável por usina com estatísticas

## 📦 Arquivos Modificados/Criados

### Schema e Backend
- `shared/schema.ts` - Adicionados 3 novos campos timestamp
- `server/routes.ts` - Adicionados 4 novos endpoints

### Frontend - Componentes Novos
- `client/src/components/fatura-flow-indicators.tsx`
- `client/src/components/fatura-status-card.tsx`
- `client/src/components/usina-section.tsx`

### Frontend - Páginas
- `client/src/pages/faturas.tsx` - **SUBSTITUÍDA** pela nova interface
- `client/src/pages/faturas-old-backup.tsx` - Backup da página antiga
- `client/src/pages/faturas-new.tsx` - Nova implementação (já aplicada)

## 🚀 Como Aplicar as Mudanças

### Passo 1: Atualizar o Banco de Dados
Execute o comando para sincronizar o schema com o banco:

```bash
npm run db:push
```

Isso adicionará os novos campos:
- `fatura_cliente_gerada_at`
- `fatura_cliente_enviada_at`
- `fatura_cliente_recebida_at`

### Passo 2: Reiniciar o Servidor
Se o servidor estiver rodando, reinicie para carregar as novas rotas:

```bash
# Se estiver em desenvolvimento
npm run dev
```

### Passo 3: Testar a Nova Interface
1. Acesse `/faturas` no navegador
2. Verifique se as usinas aparecem corretamente agrupadas
3. Teste os indicadores de fluxo
4. Teste gerar fatura com desconto
5. Teste marcar como enviada/recebida

## 🔄 Reverter para a Versão Antiga (se necessário)

Se encontrar algum problema, você pode reverter:

```bash
cp client/src/pages/faturas-old-backup.tsx client/src/pages/faturas.tsx
```

## 📊 Diferenças Principais

### Antes (Tabela Plana)
```
Cliente A | Usina 1 | Jan/2026 | R$ 500,00 | Status
Cliente A | Usina 1 | Dez/2025 | R$ 480,00 | Status  ❌ Duplicado
Cliente B | Usina 2 | Jan/2026 | R$ 600,00 | Status
```

### Agora (Hierárquica)
```
📊 Resumo: 3 faturas | 2 completas | 1 pendente

⚡ USINA 1
  └─ Cliente A (UC: 12345)
     📤 Upload: ✅  💰 Pago Concess.: ✅
     📄 Gerada: ✅  ✉️ Enviada: ✅  ✅ Recebida: ⏳
     [Baixar PDF] [Marcar Recebida]

⚡ USINA 2
  └─ Cliente B (UC: 67890) - Uso Próprio
     📤 Upload: ✅  💰 Pago Concess.: ✅
     [Baixar PDF]
```

## ✨ Funcionalidades Adicionais

### 1. Contador de Expiração
PDFs exibem um alerta quando:
- ⚠️ Faltam 7 dias ou menos para expirar
- 🚨 PDF já expirou (30 dias)

### 2. Ações Contextuais
Cada card tem um menu dropdown com ações relevantes:
- Baixar fatura original
- Gerar/baixar fatura com desconto
- Marcar como enviada
- Marcar como recebida
- Fazer upload (se pendente)
- Excluir

### 3. Estatísticas em Tempo Real
- Total de faturas
- Faturas completas (todos os passos concluídos)
- Faturas pendentes
- Total de clientes

### 4. Filtros Funcionais
- **Por mês**: Filtra faturas do mês selecionado
- **Por usina**: Mostra apenas uma usina específica

## 🎨 Valores Exibidos

Na nova interface, apenas mostramos:
- **Valor Total**: O que a concessionária cobrou
- **Valor com Desconto**: O que o cliente paga (apenas se não for uso próprio)

**Não exibimos mais**: economia, lucro, etc. (conforme solicitado)

## 📝 Notas Importantes

1. **Clientes de Uso Próprio**: Não exibem o fluxo de fatura do cliente (desconto), apenas o fluxo da concessionária.

2. **Ordenação**: Clientes são ordenados por `numeroContrato` dentro de cada usina.

3. **Compatibilidade**: A API antiga continua funcionando, então outras partes do sistema não serão afetadas.

4. **Migração Suave**: Os dados existentes continuam funcionando. Os novos campos de timestamp serão `null` para faturas antigas até serem atualizados.

## 🐛 Solução de Problemas

### Erro ao gerar PDF
- Verifique se o script Python está disponível: `server/scripts/generate_pdf.py`
- Verifique permissões da pasta `uploads/faturas_geradas`

### Faturas não aparecem
- Verifique o filtro de mês selecionado
- Execute "Gerar Pendências" para criar placeholders

### Endpoints retornam 500
- Execute `npm run db:push` para sincronizar o schema
- Reinicie o servidor

## 📞 Suporte

Se encontrar problemas, verifique:
1. Console do navegador para erros JavaScript
2. Console do servidor para erros de API
3. Logs do banco de dados

---

**Data de Implementação**: 2026-01-14
**Versão**: 2.0.0
**Autor**: Claude AI Assistant
