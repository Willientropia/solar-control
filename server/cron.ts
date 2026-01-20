import cron from "node-cron";
import fs from "fs/promises";
import path from "path";
import { log } from "./index";

export function setupCronJobs() {
  console.log("[Cron] Initializing cron jobs...");

  // Schedule task to run every day at midnight (00:00)
  // Deletes files in uploads/faturas_geradas older than 30 days
  cron.schedule("0 0 * * *", async () => {
    console.log("[Cron] Starting cleanup of old generated invoices...");
    
    try {
      // Deletes files in uploads/faturas (nested) older than 30 days
      // This is for utility bills uploaded by users
      const uploadsDir = path.join(process.cwd(), "uploads", "faturas");
      console.log(`[Cron] Scanning uploaded utility bills in: ${uploadsDir}`);

      // Helper function for recursive deletion
      async function deleteOldFilesRecursive(dirPath: string) {
        try {
          // Check if directory exists
          try {
            await fs.access(dirPath);
          } catch {
            return; // Skip if directory doesn't exist
          }

          const entries = await fs.readdir(dirPath, { withFileTypes: true });
          
          for (const entry of entries) {
            const fullPath = path.join(dirPath, entry.name);
            
            if (entry.isDirectory()) {
              await deleteOldFilesRecursive(fullPath);
              
              // Optional: Remove empty directories
              const files = await fs.readdir(fullPath);
              if (files.length === 0) {
                await fs.rmdir(fullPath);
                // console.log(`[Cron] Removed empty directory: ${fullPath}`);
              }
            } else if (entry.isFile()) {
              try {
                const stats = await fs.stat(fullPath);
                const fileAge = now - stats.mtimeMs;
                
                if (fileAge > thirtyDaysInMs) {
                  await fs.unlink(fullPath);
                  console.log(`[Cron] Deleted old utility bill: ${entry.name}`);
                  deletedCount++;
                }
              } catch (err) {
                console.error(`[Cron] Error checking file ${fullPath}:`, err);
              }
            }
          }
        } catch (err) {
          console.error(`[Cron] Error processing directory ${dirPath}:`, err);
        }
      }

      await deleteOldFilesRecursive(uploadsDir);
      
      // Also clean generated invoices (aggressive cleanup - e.g. 24 hours)
      // Since they are generated on demand, we don't need to keep them for long
      const generatedDir = path.join(process.cwd(), "uploads", "faturas_geradas");
      const oneDayInMs = 24 * 60 * 60 * 1000;
      
      try {
        await fs.access(generatedDir);
        const genFiles = await fs.readdir(generatedDir);
        
        for (const file of genFiles) {
          const filePath = path.join(generatedDir, file);
          const stats = await fs.stat(filePath);
          if (stats.isFile() && (now - stats.mtimeMs > oneDayInMs)) {
            await fs.unlink(filePath);
            // console.log(`[Cron] Deleted temp generated file: ${file}`);
          }
        }
      } catch (e) {
        // Ignore if directory missing
      }

      if (deletedCount > 0) {
        console.log(`[Cron] Cleanup finished. Deleted ${deletedCount} old utility bills.`);
      } else {
        console.log("[Cron] Cleanup finished. No utility bills older than 30 days found.");
      }
      
    } catch (err) {
      console.error("[Cron] Error executing cleanup cron job:", err);
    }
  });

  console.log("[Cron] Cron jobs scheduled successfully.");
}
