
import { storage } from "../storage";

async function main() {
  console.log("Checking for duplicate generations...");
  const geracoes = await storage.getGeracoes();
  
  // Filter for Dec 2025
  const dez2025 = geracoes.filter(g => g.mesReferencia.toLowerCase().includes("dez/2025"));
  
  console.log("Found records for Dez/2025:");
  dez2025.forEach(g => {
    console.log(`ID: ${g.id}, Mes: ${g.mesReferencia}, Usina: ${g.usinaId}, kWh: ${g.kwhGerado}`);
  });
  
  // Identify the bad one (uppercase DEZ)
  const badOne = dez2025.find(g => g.mesReferencia === "DEZ/2025");
  
  if (badOne) {
    console.log(`\nFound bad record (DEZ/2025) with ID: ${badOne.id}`);
    console.log("Deleting...");
    await storage.deleteGeracao(badOne.id);
    console.log("Successfully deleted bad record.");
  } else {
    console.log("\nNo record with exact 'DEZ/2025' found. Checking for other anomalies...");
    // If we have duplicates of "Dez/2025" (same casing), we might want to delete one too.
    const goodOnes = dez2025.filter(g => g.mesReferencia === "Dez/2025");
    if (goodOnes.length > 1) {
        console.log(`Found ${goodOnes.length} records with 'Dez/2025'. You might want to investigate.`);
    }
  }
  
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
