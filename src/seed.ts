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

export async function seedDemo(repo: Repo): Promise<{ users: number; tickets: number }> {
  const passwordHash = await hashPassword(DEMO_PASSWORD);
  const ids = new Map<string, { id: string; name: string }>();
  for (const a of DEMO_ACCOUNTS) {
    const u = (await repo.findUserByEmail(a.email)) ?? (await repo.createUser({ ...a, passwordHash }));
    ids.set(a.email, { id: u.id, name: u.name });
  }
  for (const s of T) {
    const user = typeof s.by === "string" ? ids.get(s.by)! : null;
    const guest = typeof s.by === "string" ? null : s.by;
    const t = await repo.createTicket({
      publicId: newPublicId(),
      subject: s.subject,
      body: s.body,
      category: s.category,
      priority: s.priority,
      requesterId: user?.id ?? null,
      guestName: guest?.guest ?? null,
      guestEmail: guest?.email ?? null,
      guestTokenHash: guest ? await sha256(randomToken()) : null,
      actorLabel: user?.name ?? guest!.guest,
    });
    const admin = s.assign ? ids.get(s.assign)! : null;
    if (admin) {
      await repo.updateTicket(t.publicId, { assigneeId: admin.id });
      await repo.addEvent(t.publicId, { actorId: admin.id, actorLabel: admin.name, kind: "assign", body: `Assigned to ${admin.name}`, internal: false });
    }
    if (s.note && admin) await repo.addEvent(t.publicId, { actorId: admin.id, actorLabel: admin.name, kind: "note", body: s.note, internal: true });
    if (s.status !== "open") {
      await repo.updateTicket(t.publicId, { status: s.status });
      await repo.addEvent(t.publicId, { actorId: admin?.id ?? null, actorLabel: admin?.name ?? "Deskline", kind: "status", body: `Status set to ${s.status}`, internal: false });
    }
  }
  return { users: DEMO_ACCOUNTS.length, tickets: T.length };
}

/** Public demo reset: wipe everything, then reload the fictional seed. */
export async function resetDemo(repo: Repo) {
  await repo.resetAll();
  return seedDemo(repo);
}
