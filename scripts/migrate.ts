// Usage: DATABASE_URL=... npx tsx scripts/migrate.ts   (reads the URL from the environment, never from the repo)
import { neon } from "@neondatabase/serverless";
import { readFileSync, readdirSync } from "node:fs";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");
const sql = neon(url);

const files = readdirSync("migrations").filter((f) => f.endsWith(".sql")).sort();
for (const f of files) {
  const text = readFileSync(`migrations/${f}`, "utf8");
  const statements = text.split(/;\s*\n/).map((s) => s.replace(/--.*$/gm, "").trim()).filter(Boolean);
  for (const s of statements) await sql.query(s);
  console.log(`applied ${f} (${statements.length} statements)`);
}
