import { neon } from "@neondatabase/serverless";
import type { Ticket, TicketEvent, User } from "./domain";
import type { NewTicket, Repo, Stats, TicketFilter, TicketPatch } from "./repo";

type Sql = ReturnType<typeof neon>;
type R = Record<string, unknown>;

const TICKET_COLS = `
  t.id, t.public_id, t.subject, t.body, t.category, t.priority, t.status,
  t.requester_id, coalesce(u.name, t.guest_name, 'Unknown') as requester_name,
  coalesce(u.email, t.guest_email) as requester_email, (t.requester_id is null) as is_guest,
  t.assignee_id, a.name as assignee_name, t.created_at, t.updated_at`;
const TICKET_FROM = `tickets t left join users u on u.id = t.requester_id left join users a on a.id = t.assignee_id`;

const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : String(v));

function toUser(r: R): User {
  return { id: String(r.id), email: String(r.email), name: String(r.name), role: r.role as User["role"], passwordHash: String(r.password_hash), createdAt: iso(r.created_at) };
}
function toTicket(r: R): Ticket {
  return {
    id: Number(r.id),
    publicId: String(r.public_id),
    subject: String(r.subject),
    body: String(r.body),
    category: r.category as Ticket["category"],
    priority: r.priority as Ticket["priority"],
    status: r.status as Ticket["status"],
    requesterId: (r.requester_id as string) ?? null,
    requesterName: String(r.requester_name),
    requesterEmail: (r.requester_email as string) ?? null,
    isGuest: Boolean(r.is_guest),
    assigneeId: (r.assignee_id as string) ?? null,
    assigneeName: (r.assignee_name as string) ?? null,
    createdAt: iso(r.created_at),
    updatedAt: iso(r.updated_at),
  };
}

/** Postgres-backed Repo using Neon's serverless HTTP driver (works inside Workers). */
export class PgRepo implements Repo {
  private sql: Sql;
  constructor(databaseUrl: string) {
    this.sql = neon(databaseUrl);
  }
  private async q(text: string, params: unknown[] = []): Promise<R[]> {
    return (await this.sql.query(text, params)) as R[];
  }

  async createUser(u: { email: string; name: string; passwordHash: string; role: User["role"] }) {
    const [r] = await this.q(`insert into users (email, name, password_hash, role) values ($1, $2, $3, $4) returning *`, [u.email, u.name, u.passwordHash, u.role]);
    return toUser(r);
  }
  async findUserByEmail(email: string) {
    const [r] = await this.q(`select * from users where email = $1`, [email.toLowerCase()]);
    return r ? toUser(r) : null;
  }
  async findUserById(id: string) {
    const [r] = await this.q(`select * from users where id = $1`, [id]);
    return r ? toUser(r) : null;
  }
  async listAdmins() {
    return (await this.q(`select * from users where role = 'admin' order by name`)).map(toUser);
  }

  async createSession(idHash: string, userId: string, expiresAt: Date) {
    await this.q(`insert into sessions (id, user_id, expires_at) values ($1, $2, $3)`, [idHash, userId, expiresAt.toISOString()]);
  }
  async findSessionUser(idHash: string, now: Date) {
    const [r] = await this.q(`select u.* from sessions s join users u on u.id = s.user_id where s.id = $1 and s.expires_at > $2`, [idHash, now.toISOString()]);
    return r ? toUser(r) : null;
  }
  async deleteSession(idHash: string) {
    await this.q(`delete from sessions where id = $1`, [idHash]);
  }

  async createTicket(t: NewTicket) {
    const [row] = await this.q(
      `with ins as (
         insert into tickets (public_id, subject, body, category, priority, requester_id, guest_name, guest_email, guest_token_hash)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9) returning id
       ), ev as (
         insert into ticket_events (ticket_id, actor_id, actor_label, kind) select id, $6, $10, 'created' from ins
       ) select id from ins`,
      [t.publicId, t.subject, t.body, t.category, t.priority, t.requesterId, t.guestName, t.guestEmail, t.guestTokenHash, t.actorLabel],
    );
    const [r] = await this.q(`select ${TICKET_COLS} from ${TICKET_FROM} where t.id = $1`, [row.id]);
    return toTicket(r);
  }
  async getTicket(publicId: string) {
    const [r] = await this.q(`select ${TICKET_COLS} from ${TICKET_FROM} where t.public_id = $1`, [publicId]);
    return r ? toTicket(r) : null;
  }
  async getGuestTokenHash(publicId: string) {
    const [r] = await this.q(`select guest_token_hash from tickets where public_id = $1`, [publicId]);
    return (r?.guest_token_hash as string) ?? null;
  }
  async listTicketsForRequester(userId: string) {
    return (await this.q(`select ${TICKET_COLS} from ${TICKET_FROM} where t.requester_id = $1 order by t.updated_at desc limit 200`, [userId])).map(toTicket);
  }
  async listTickets(f: TicketFilter) {
    const where: string[] = [];
    const params: unknown[] = [];
    const p = (v: unknown) => {
      params.push(v);
      return `$${params.length}`;
    };
    if (f.status === "active" || !f.status) where.push(`t.status not in ('resolved', 'closed')`);
    else if (f.status !== "all") where.push(`t.status = ${p(f.status)}`);
    if (f.assignee === "me") where.push(`t.assignee_id = ${p(f.meId)}`);
    if (f.assignee === "unassigned") where.push(`t.assignee_id is null`);
    if (f.q) where.push(`(t.public_id || ' ' || t.subject || ' ' || t.body || ' ' || coalesce(u.name, t.guest_name, '')) ilike ${p(`%${f.q}%`)}`);
    const sql = `select ${TICKET_COLS} from ${TICKET_FROM} ${where.length ? "where " + where.join(" and ") : ""} order by t.updated_at desc limit 200`;
    return (await this.q(sql, params)).map(toTicket);
  }
  async updateTicket(publicId: string, patch: TicketPatch) {
    const sets: string[] = [];
    const params: unknown[] = [publicId];
    const p = (v: unknown) => {
      params.push(v);
      return `$${params.length}`;
    };
    if (patch.status) sets.push(`status = ${p(patch.status)}`);
    if (patch.priority) sets.push(`priority = ${p(patch.priority)}`);
    if (patch.assigneeId !== undefined) sets.push(`assignee_id = ${p(patch.assigneeId)}`);
    sets.push(`updated_at = now()`);
    await this.q(`update tickets set ${sets.join(", ")} where public_id = $1`, params);
    return this.getTicket(publicId);
  }
  async addEvent(publicId: string, e: { actorId: string | null; actorLabel: string; kind: TicketEvent["kind"]; body: string; internal: boolean }) {
    await this.q(
      `with t as (update tickets set updated_at = now() where public_id = $1 returning id)
       insert into ticket_events (ticket_id, actor_id, actor_label, kind, body, internal) select id, $2, $3, $4, $5, $6 from t`,
      [publicId, e.actorId, e.actorLabel, e.kind, e.body, e.internal],
    );
  }
  async listEvents(publicId: string, includeInternal: boolean) {
    const rows = await this.q(
      `select e.* from ticket_events e join tickets t on t.id = e.ticket_id where t.public_id = $1 ${includeInternal ? "" : "and not e.internal"} order by e.created_at, e.id`,
      [publicId],
    );
    return rows.map((r) => ({ id: Number(r.id), actorLabel: String(r.actor_label), kind: r.kind as TicketEvent["kind"], body: String(r.body), internal: Boolean(r.internal), createdAt: iso(r.created_at) }));
  }
  async stats(): Promise<Stats> {
    const [r] = await this.q(`select
      count(*) filter (where status = 'open') as open,
      count(*) filter (where status = 'in_progress') as in_progress,
      count(*) filter (where status = 'waiting') as waiting,
      count(*) filter (where status in ('resolved', 'closed')) as resolved,
      count(*) filter (where priority = 'urgent' and status not in ('resolved', 'closed')) as urgent,
      count(*) filter (where assignee_id is null and status not in ('resolved', 'closed')) as unassigned
      from tickets`);
    return { open: Number(r.open), inProgress: Number(r.in_progress), waiting: Number(r.waiting), resolved: Number(r.resolved), urgent: Number(r.urgent), unassigned: Number(r.unassigned) };
  }
  async resetAll() {
    await this.q(`truncate ticket_events, tickets, sessions, users restart identity cascade`);
  }
  async claimDemoReset(now: Date, cutoff: Date) {
    // One statement, so concurrent isolates can't both win the claim.
    const rows = await this.q(
      `insert into demo_meta (key, at) values ('last_reset', $1)
       on conflict (key) do update set at = excluded.at where demo_meta.at < $2
       returning key`,
      [now.toISOString(), cutoff.toISOString()],
    );
    return rows.length > 0;
  }
}
