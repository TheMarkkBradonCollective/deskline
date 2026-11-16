import { newPublicId, randomToken, sha256, type Category, type Priority, type Status } from "./domain";
import { hashPassword } from "./password";
import type { Repo } from "./repo";

/**
 * Demo data. Every person, email, and ticket here is fictional.
 * Emails use the reserved example.com/.example domains so nothing can ever be delivered.
 */
export const DEMO_PASSWORD = "deskline-demo";
export const DEMO_ACCOUNTS = [
  { email: "admin@deskline.example", name: "Ava Admin (demo)", role: "admin" as const },
  { email: "sam@deskline.example", name: "Sam Support (demo)", role: "admin" as const },
  { email: "jordan@deskline.example", name: "Jordan Demo", role: "user" as const },
  { email: "riley@deskline.example", name: "Riley Demo", role: "user" as const },
];

interface SeedTicket {
  subject: string;
  body: string;
  category: Category;
  priority: Priority;
  status: Status;
  by: string | { guest: string; email: string };
  assign?: string;
  note?: string;
}

const T: SeedTicket[] = [
  { subject: "Can't reset my password", body: "The reset email never arrives. I checked spam. (Demo ticket.)", category: "account", priority: "high", status: "open", by: "jordan@deskline.example" },
  { subject: "Invoice shows the wrong company name", body: "Our demo invoice says 'Example Co' but we renamed to 'Example Labs'.", category: "billing", priority: "normal", status: "in_progress", by: "riley@deskline.example", assign: "sam@deskline.example", note: "Checking billing profile. (Demo note.)" },
  { subject: "Export to CSV cuts off long rows", body: "Rows longer than about 500 characters are truncated in the CSV export.", category: "bug", priority: "high", status: "open", by: { guest: "Casey Guest", email: "casey@example.com" } },
  { subject: "Dark mode please", body: "Would love a dark theme for late-night triage. Demo feature request.", category: "feature", priority: "low", status: "waiting", by: "jordan@deskline.example", assign: "admin@deskline.example" },
  { subject: "Site down for our whole team", body: "Getting a 502 on every page since this morning. Demo outage ticket.", category: "bug", priority: "urgent", status: "in_progress", by: { guest: "Morgan Guest", email: "morgan@example.com" }, assign: "admin@deskline.example", note: "Escalated to on-call. (Demo note.)" },
  { subject: "How do I add a teammate?", body: "Where is the invite button? Demo question.", category: "general", priority: "normal", status: "resolved", by: "riley@deskline.example", assign: "sam@deskline.example" },
  { subject: "Charged twice this month", body: "I see two identical demo charges on the 1st.", category: "billing", priority: "high", status: "open", by: { guest: "Taylor Guest", email: "taylor@example.com" } },
  { subject: "Typo on the pricing page", body: "'Recieve' should be 'Receive'. Tiny demo ticket.", category: "general", priority: "low", status: "open", by: { guest: "Jamie Guest", email: "jamie@example.com" } },
];

export interface SeedData {
  users: { id: string; email: string; name: string; role: "user" | "admin"; passwordHash: string }[];
  tickets: {
    publicId: string; subject: string; body: string; category: Category; priority: Priority; status: Status;
    requesterId: string | null; guestName: string | null; guestEmail: string | null; guestTokenHash: string | null; assigneeId: string | null;
  }[];
  events: { publicId: string; actorId: string | null; actorLabel: string; kind: "created" | "status" | "assign" | "note"; body: string; internal: boolean }[];
}

/** Build the whole demo dataset in memory, so it can be written in a single database round trip. */
export async function buildSeed(): Promise<SeedData> {
  const passwordHash = await hashPassword(DEMO_PASSWORD);
  const users = DEMO_ACCOUNTS.map((a) => ({ id: crypto.randomUUID(), passwordHash, ...a }));
  const byEmail = new Map(users.map((u) => [u.email, u]));
  const data: SeedData = { users, tickets: [], events: [] };
  for (const s of T) {
    const user = typeof s.by === "string" ? byEmail.get(s.by)! : null;
    const guest = typeof s.by === "string" ? null : s.by;
    const admin = s.assign ? byEmail.get(s.assign)! : null;
    const publicId = newPublicId();
    data.tickets.push({
      publicId, subject: s.subject, body: s.body, category: s.category, priority: s.priority, status: s.status,
      requesterId: user?.id ?? null, guestName: guest?.guest ?? null, guestEmail: guest?.email ?? null,
      guestTokenHash: guest ? await sha256(randomToken()) : null, assigneeId: admin?.id ?? null,
    });
    const ev = (e: Omit<SeedData["events"][number], "publicId">) => data.events.push({ publicId, ...e });
    ev({ actorId: user?.id ?? null, actorLabel: user?.name ?? guest!.guest, kind: "created", body: "", internal: false });
    if (admin) ev({ actorId: admin.id, actorLabel: admin.name, kind: "assign", body: `Assigned to ${admin.name}`, internal: false });
    if (s.note && admin) ev({ actorId: admin.id, actorLabel: admin.name, kind: "note", body: s.note, internal: true });
    if (s.status !== "open") ev({ actorId: admin?.id ?? null, actorLabel: admin?.name ?? "Deskline", kind: "status", body: `Status set to ${s.status}`, internal: false });
  }
  return data;
}

/** Wipe everything and load the fictional demo data, atomically. */
export async function resetDemo(repo: Repo): Promise<{ users: number; tickets: number }> {
  const data = await buildSeed();
  await repo.replaceAll(data);
  return { users: data.users.length, tickets: data.tickets.length };
}

export const seedDemo = resetDemo;

export const RESET_EVERY_MS = 24 * 3600_000;

/** Reset the demo if the last reset is older than a day. Returns true if it reset. */
export async function maybeResetDemo(repo: Repo, now = new Date()): Promise<boolean> {
  if (!(await repo.claimDemoReset(now, new Date(now.getTime() - RESET_EVERY_MS)))) return false;
  await resetDemo(repo);
  return true;
}
