import { build as esbuild, type Plugin } from "esbuild";
import { build as viteBuild } from "vite";
import { rm, readFile } from "fs/promises";
import { existsSync } from "fs";
import path from "path";

// server deps to bundle to reduce openat(2) syscalls
// which helps cold start times
const allowlist = [
  "@google/generative-ai",
  "axios",
  "connect-pg-simple",
  "cors",
  "date-fns",
  "drizzle-orm",
  "drizzle-zod",
  "express",
  "express-rate-limit",
  "express-session",
  "jsonwebtoken",
  "memorystore",
  "multer",
  "nanoid",
  "nodemailer",
  "openai",
  "passport",
  "passport-local",
  "pg",
  "stripe",
  "uuid",
  "ws",
  "exceljs",
  "xlsx",
  "zod",
  "zod-validation-error",
];

/** Plugin that resolves @shared/* imports to the shared/ directory */
function sharedAliasPlugin(): Plugin {
  return {
    name: "shared-alias",
    setup(build) {
      build.onResolve({ filter: /^@shared(\/|$)/ }, (args) => {
        const relativePath = args.path.replace(/^@shared\/?/, "");
        const base = path.resolve("shared", relativePath);

        // Try: shared/<path>.ts
        if (existsSync(base + ".ts")) {
          return { path: base + ".ts" };
        }
        // Try: shared/<path>/index.ts
        if (existsSync(path.join(base, "index.ts"))) {
          return { path: path.join(base, "index.ts") };
        }
        // Try: shared/<path>.js
        if (existsSync(base + ".js")) {
          return { path: base + ".js" };
        }
        // Fallback: return as-is and let esbuild handle the error
        return { path: base };
      });
    },
  };
}

async function buildAll() {
  await rm("dist", { recursive: true, force: true });

  console.log("building client...");
  await viteBuild();

  console.log("building server...");
  const pkg = JSON.parse(await readFile("package.json", "utf-8"));
  const allDeps = [
    ...Object.keys(pkg.dependencies || {}),
    ...Object.keys(pkg.devDependencies || {}),
  ];
  const externals = allDeps.filter((dep) => !allowlist.includes(dep));

  await esbuild({
    entryPoints: ["server/index.ts"],
    platform: "node",
    bundle: true,
    format: "cjs",
    outfile: "dist/index.cjs",
    define: {
      "process.env.NODE_ENV": '"production"',
    },
    plugins: [sharedAliasPlugin()],
    minify: true,
    external: externals,
    logLevel: "info",
  });
}

buildAll().catch((err) => {
  console.error(err);
  process.exit(1);
});
