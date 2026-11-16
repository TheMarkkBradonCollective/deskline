import type { Priority, Role, Status, Ticket, TicketEvent, TicketInput, User } from "./domain";

export interface NewTicket extends TicketInput {
  publicId: string;
  requesterId: string | null;
  guestName: string | null;
  guestEmail: string | null;
  guestTokenHash: string | null;
  actorLabel: string;
}

export interface TicketFilter {
  status?: Status | "active" | "all";
  assignee?: "me" | "unassigned" | "all";
  q?: string;
  meId?: string;
}

export interface TicketPatch {
  status?: Status;
  priority?: Priority;
  assigneeId?: string | null;
}

export interface Stats {
  open: number;
  inProgress: number;
  waiting: number;
  resolved: number;
  urgent: number;
  unassigned: number;
}

/** Storage boundary. Postgres (Neon) in production, in-memory in tests. */
export interface Repo {
  createUser(u: { email: string; name: string; passwordHash: string; role: Role }): Promise<User>;
  findUserByEmail(email: string): Promise<User | null>;
  findUserById(id: string): Promise<User | null>;
  listAdmins(): Promise<User[]>;

  createSession(idHash: string, userId: string, expiresAt: Date): Promise<void>;
  findSessionUser(idHash: string, now: Date): Promise<User | null>;
  deleteSession(idHash: string): Promise<void>;

  createTicket(t: NewTicket): Promise<Ticket>;
  getTicket(publicId: string): Promise<Ticket | null>;
  getGuestTokenHash(publicId: string): Promise<string | null>;
  listTicketsForRequester(userId: string): Promise<Ticket[]>;
  listTickets(f: TicketFilter): Promise<Ticket[]>;
  updateTicket(publicId: string, patch: TicketPatch): Promise<Ticket | null>;
  addEvent(publicId: string, e: { actorId: string | null; actorLabel: string; kind: TicketEvent["kind"]; body: string; internal: boolean }): Promise<void>;
  listEvents(publicId: string, includeInternal: boolean): Promise<TicketEvent[]>;
  stats(): Promise<Stats>;
  /** Delete every row. Used only by the public demo's daily reset. */
  resetAll(): Promise<void>;
  /** Atomically claim the daily demo reset: true only if the last reset is older than `cutoff` (or never). */
  claimDemoReset(now: Date, cutoff: Date): Promise<boolean>;
}
