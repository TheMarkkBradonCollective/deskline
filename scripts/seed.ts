// Usage: DATABASE_URL=... npx tsx scripts/seed.ts   Wipes and reloads the fictional demo data.
import { neon } from "@neondatabase/serverless";
import { PgRepo } from "../src/repo-pg";
import { seedDemo } from "../src/seed";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");
await neon(url).query("truncate ticket_events, tickets, sessions, users restart identity cascade");
const r = await seedDemo(new PgRepo(url));
console.log(`seeded ${r.users} demo users and ${r.tickets} demo tickets`);
