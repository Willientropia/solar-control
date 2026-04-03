# 🐛 Debug de Cálculos - Guia de Teste

Adicionei logs detalhados para identificar por que os cálculos dão valores diferentes no upload vs recalcular.

## 📋 Como fazer o teste:

### 1️⃣ **Preparação**
```bash
# Certifique-se que está na branch correta
git pull origin claude/fix-pending-invoices-dVb4V

# Rode o app
npm run dev
```

### 2️⃣ **Abrir o Console do Navegador**
- Aperte **F12** (ou Ctrl+Shift+I)
- Clique na aba **Console**
- Clique com botão direito e selecione "**Clear console**" para limpar logs antigos

### 3️⃣ **Fazer Upload de uma Fatura**
1. Vá para a página de **Upload de Faturas**
2. Selecione uma fatura PDF de **JAN/2026** (ou o mês que você tem preço cadastrado)
3. Clique em "**Extrair e Verificar**"
4. Aguarde o modal abrir

**🔍 No console você vai ver logs começando com:**
- `🔍 [UPLOAD] Buscando preço...`
- `📦 [UPLOAD] Resposta da API...`
- `💰 [UPLOAD - CÁLCULOS INICIAIS]`
- `💾 [UPLOAD] Preço kWh armazenado...`
- `✅ [UPLOAD] FormData final...`

### 4️⃣ **Copiar Logs do Upload**
- **Selecione TODOS os logs** que começam com `[UPLOAD]`
- Copie (Ctrl+C)
- Cole em um arquivo de texto ou me mande direto

### 5️⃣ **Clicar em Recalcular**
1. No modal que abriu, clique no botão **"Recalcular"**
2. Aguarde a mensagem de sucesso

**🔍 No console você vai ver novos logs:**
- `🔄 [RECALCULAR] ===================`
- `  Cliente: ...`
- `  → Fio B: ...`
- `✅ [RECALCULAR] Resultados finais...`

### 6️⃣ **Copiar Logs do Recalcular**
- Selecione TODOS os logs que começam com `[RECALCULAR]`
- Copie e me envie

### 7️⃣ **Verificar Campo de Preço**
- No modal, procure o campo **"Preço kWh Usado nos Cálculos (R$)"**
- Me diga:
  - ✅ O campo aparece?
  - 📝 Qual valor está mostrando?
  - 🎨 Está visível ou escondido/em branco?

## 📊 O que vou analisar:

Com os logs, vou identificar:
1. ✅ Se o preço está sendo buscado corretamente da API
2. ✅ Qual preço está sendo usado em cada cálculo
3. ✅ Se há diferença nos valores entre upload e recalcular
4. ✅ Por que o campo de preço não aparece
5. ✅ Onde está o bug exatamente

## 📸 Exemplo de como os logs vão aparecer:

```
🔍 [UPLOAD] Buscando preço para o mês: JAN/2026 -> JAN%2F2026
📦 [UPLOAD] Resposta da API de preço: {precoKwhCalculado: "1.125192", ...}
✅ [UPLOAD] Preço buscado do banco: 1.125192 tipo: string
💰 [UPLOAD - CÁLCULOS INICIAIS]
  Cliente: Fulano de Tal
  isPagante: true
  Consumo SCEE: 70.8
  Preço kWh usado: 1.125192 (fetchedPrecoKwh: 1.125192)
  ...
```

## ⚠️ Importante:
- **NÃO** limpe o console entre upload e recalcular
- **COPIE TODOS** os logs, mesmo que pareçam repetitivos
- Se aparecer algum **erro em vermelho**, me envie também!

---

Depois que você me enviar os logs, vou identificar exatamente onde está o problema e fazer a correção! 🚀
