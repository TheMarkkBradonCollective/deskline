import type { Ticket, TicketEvent, User } from "./domain";
import type { NewTicket, Repo, Stats, TicketFilter, TicketPatch } from "./repo";

interface Row extends Ticket {
  guestTokenHash: string | null;
}

/** In-memory Repo used by the test suite. Mirrors the Postgres behaviour. */
export class MemoryRepo implements Repo {
  users: User[] = [];
  sessions = new Map<string, { userId: string; expiresAt: Date }>();
  tickets: Row[] = [];
  events = new Map<number, TicketEvent[]>();
  private seq = 1;
  private clock = 0;

  private now() {
    // Strictly increasing timestamps keep ordering deterministic in tests.
    this.clock += 1000;
    return new Date(Date.UTC(2026, 10, 16) + this.clock).toISOString();
  }

  async createUser(u: { email: string; name: string; passwordHash: string; role: User["role"] }) {
    if (this.users.some((x) => x.email === u.email)) throw new Error("duplicate email");
    const user: User = { id: crypto.randomUUID(), createdAt: this.now(), ...u };
    this.users.push(user);
    return user;
  }
  async findUserByEmail(email: string) {
    return this.users.find((u) => u.email === email.toLowerCase()) ?? null;
  }
  async findUserById(id: string) {
    return this.users.find((u) => u.id === id) ?? null;
  }
  async listAdmins() {
    return this.users.filter((u) => u.role === "admin");
  }

  async createSession(idHash: string, userId: string, expiresAt: Date) {
    this.sessions.set(idHash, { userId, expiresAt });
  }
  async findSessionUser(idHash: string, now: Date) {
    const s = this.sessions.get(idHash);
    if (!s || s.expiresAt <= now) return null;
    return this.findUserById(s.userId);
  }
  async deleteSession(idHash: string) {
    this.sessions.delete(idHash);
  }

  async createTicket(t: NewTicket) {
    const requester = t.requesterId ? await this.findUserById(t.requesterId) : null;
    const ts = this.now();
    const row: Row = {
      id: this.seq++,
      publicId: t.publicId,
      subject: t.subject,
      body: t.body,
      category: t.category,
      priority: t.priority,
      status: "open",
      requesterId: t.requesterId,
      requesterName: requester?.name ?? t.guestName ?? "Unknown",
      requesterEmail: requester?.email ?? t.guestEmail,
      isGuest: !t.requesterId,
      assigneeId: null,
      assigneeName: null,
      createdAt: ts,
      updatedAt: ts,
      guestTokenHash: t.guestTokenHash,
    };
    this.tickets.push(row);
    this.events.set(row.id, [{ id: 1, actorLabel: t.actorLabel, kind: "created", body: "", internal: false, createdAt: ts }]);
    return strip(row);
  }
  async getTicket(publicId: string) {
    const r = this.tickets.find((t) => t.publicId === publicId);
    return r ? strip(r) : null;
  }
  async getGuestTokenHash(publicId: string) {
    return this.tickets.find((t) => t.publicId === publicId)?.guestTokenHash ?? null;
  }
  async listTicketsForRequester(userId: string) {
    return this.sorted(this.tickets.filter((t) => t.requesterId === userId));
  }
  async listTickets(f: TicketFilter) {
    let rows = this.tickets;
    if (f.status === "active" || !f.status) rows = rows.filter((t) => !["resolved", "closed"].includes(t.status));
    else if (f.status !== "all") rows = rows.filter((t) => t.status === f.status);
    if (f.assignee === "me") rows = rows.filter((t) => t.assigneeId === f.meId);
    if (f.assignee === "unassigned") rows = rows.filter((t) => !t.assigneeId);
    if (f.q) {
      const q = f.q.toLowerCase();
      rows = rows.filter((t) => `${t.publicId} ${t.subject} ${t.body} ${t.requesterName}`.toLowerCase().includes(q));
    }
    return this.sorted(rows);
  }
  async updateTicket(publicId: string, patch: TicketPatch) {
    const r = this.tickets.find((t) => t.publicId === publicId);
    if (!r) return null;
    if (patch.status) r.status = patch.status;
    if (patch.priority) r.priority = patch.priority;
    if (patch.assigneeId !== undefined) {
      r.assigneeId = patch.assigneeId;
      r.assigneeName = patch.assigneeId ? ((await this.findUserById(patch.assigneeId))?.name ?? null) : null;
    }
    r.updatedAt = this.now();
    return strip(r);
  }
  async addEvent(publicId: string, e: { actorId: string | null; actorLabel: string; kind: TicketEvent["kind"]; body: string; internal: boolean }) {
    const r = this.tickets.find((t) => t.publicId === publicId);
    if (!r) throw new Error("no ticket");
    const list = this.events.get(r.id) ?? [];
    list.push({ id: list.length + 1, actorLabel: e.actorLabel, kind: e.kind, body: e.body, internal: e.internal, createdAt: this.now() });
    this.events.set(r.id, list);
    r.updatedAt = this.now();
  }
  async listEvents(publicId: string, includeInternal: boolean) {
    const r = this.tickets.find((t) => t.publicId === publicId);
    const list = r ? (this.events.get(r.id) ?? []) : [];
    return includeInternal ? list : list.filter((e) => !e.internal);
  }
  async stats(): Promise<Stats> {
    const c = (p: (t: Row) => boolean) => this.tickets.filter(p).length;
    const active = (t: Row) => !["resolved", "closed"].includes(t.status);
    return {
      open: c((t) => t.status === "open"),
      inProgress: c((t) => t.status === "in_progress"),
      waiting: c((t) => t.status === "waiting"),
      resolved: c((t) => t.status === "resolved" || t.status === "closed"),
      urgent: c((t) => active(t) && t.priority === "urgent"),
      unassigned: c((t) => active(t) && !t.assigneeId),
    };
  }

  async resetAll() {
    this.users = [];
    this.sessions.clear();
    this.tickets = [];
    this.events.clear();
  }

  private sorted(rows: Row[]) {
    return [...rows].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).map(strip);
  }
}

function strip(r: Row): Ticket {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { guestTokenHash: _omit, ...t } = r;
  return t;
}
