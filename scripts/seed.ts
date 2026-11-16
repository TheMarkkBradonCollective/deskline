// Usage: DATABASE_URL=... npx tsx scripts/seed.ts   Wipes and reloads the fictional demo data.
import { PgRepo } from "../src/repo-pg";
import { seedDemo } from "../src/seed";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");
const repo = new PgRepo(url);
await repo.resetAll();
const r = await seedDemo(repo);
console.log(`seeded ${r.users} demo users and ${r.tickets} demo tickets`);
