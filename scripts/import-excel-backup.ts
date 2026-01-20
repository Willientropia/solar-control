
import { ExcelService } from "../server/services/excel-service";
import path from "path";
import fs from "fs";

// Pega o nome do arquivo dos argumentos ou usa o padrão
const filename = process.argv[2] || "backup_full.xlsx";
const filePath = path.resolve(process.cwd(), filename);

async function run() {
  if (!fs.existsSync(filePath)) {
    console.error(`❌ Arquivo não encontrado: ${filePath}`);
    console.log("Uso: npx tsx scripts/import-excel-backup.ts [nome-do-arquivo.xlsx]");
    process.exit(1);
  }

  console.log(`🚀 Iniciando importação de: ${filePath}`);
  console.log("Isso pode levar alguns segundos...");

  try {
    // Chama o serviço diretamente com mode 'replace'
    const result = await ExcelService.importFromExcel(filePath, { mode: 'replace' });
    
    console.log("✅ Importação concluída com sucesso!");
    console.log(JSON.stringify(result, null, 2));
    process.exit(0);
  } catch (error) {
    console.error("❌ Erro fatal na importação:", error);
    process.exit(1);
  }
}

run();
