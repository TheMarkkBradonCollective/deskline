export const STATUSES = ["open", "in_progress", "waiting", "resolved", "closed"] as const;
export const PRIORITIES = ["low", "normal", "high", "urgent"] as const;
export const CATEGORIES = ["general", "account", "billing", "bug", "feature"] as const;

export type Status = (typeof STATUSES)[number];
export type Priority = (typeof PRIORITIES)[number];
export type Category = (typeof CATEGORIES)[number];
export type Role = "user" | "admin";

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  passwordHash: string;
  createdAt: string;
}

export interface Ticket {
  id: number;
  publicId: string;
  subject: string;
  body: string;
  category: Category;
  priority: Priority;
  status: Status;
  requesterId: string | null;
  requesterName: string;
  requesterEmail: string | null;
  isGuest: boolean;
  assigneeId: string | null;
  assigneeName: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TicketEvent {
  id: number;
  actorLabel: string;
  kind: "created" | "status" | "priority" | "assign" | "note" | "reply";
  body: string;
  internal: boolean;
  createdAt: string;
}

export const STATUS_LABEL: Record<Status, string> = {
  open: "Open",
  in_progress: "In progress",
  waiting: "Waiting on requester",
  resolved: "Resolved",
  closed: "Closed",
};

export interface TicketInput {
  subject: string;
  body: string;
  category: Category;
  priority: Priority;
}

export type Result<T> = { ok: true; value: T } | { ok: false; errors: Record<string, string> };

const clean = (v: unknown) => (typeof v === "string" ? v.trim() : "");

export function isEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) && v.length <= 254;
}

export function parseTicketInput(form: Record<string, unknown>): Result<TicketInput> {
  const errors: Record<string, string> = {};
  const subject = clean(form.subject);
  const body = clean(form.body);
  const category = clean(form.category) || "general";
  const priority = clean(form.priority) || "normal";
  if (subject.length < 4) errors.subject = "Give the ticket a short subject (at least 4 characters).";
  if (subject.length > 120) errors.subject = "Keep the subject under 120 characters.";
  if (body.length < 10) errors.body = "Describe the problem in at least 10 characters.";
  if (body.length > 5000) errors.body = "Keep the description under 5,000 characters.";
  if (!(CATEGORIES as readonly string[]).includes(category)) errors.category = "Pick a category.";
  // Requesters may only choose low / normal / high; admins can escalate to urgent.
  if (!["low", "normal", "high"].includes(priority)) errors.priority = "Pick a priority.";
  if (Object.keys(errors).length) return { ok: false, errors };
  return { ok: true, value: { subject, body, category: category as Category, priority: priority as Priority } };
}

export interface GuestInput {
  name: string;
  email: string;
}

export function parseGuestInput(form: Record<string, unknown>): Result<GuestInput> {
  const errors: Record<string, string> = {};
  const name = clean(form.guest_name);
  const email = clean(form.guest_email).toLowerCase();
  if (name.length < 2 || name.length > 80) errors.guest_name = "Tell us your name.";
  if (!isEmail(email)) errors.guest_email = "Enter a valid email so you can be recognised.";
  if (Object.keys(errors).length) return { ok: false, errors };
  return { ok: true, value: { name, email } };
}

/** Ticket references look like DL-7K3QX9: no 0/O/1/I so they read cleanly aloud. */
const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
export function newPublicId(random: (n: number) => Uint8Array<ArrayBuffer> = randomBytes): string {
  const b = random(6);
  let s = "";
  for (const x of b) s += ALPHABET[x % ALPHABET.length];
  return `DL-${s}`;
}

export function randomBytes(n: number): Uint8Array<ArrayBuffer> {
  const b = new Uint8Array(n);
  crypto.getRandomValues(b);
  return b;
}

export function randomToken(bytes = 24): string {
  return [...randomBytes(bytes)].map((x) => x.toString(16).padStart(2, "0")).join("");
}

export async function sha256(text: string): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(d)].map((x) => x.toString(16).padStart(2, "0")).join("");
}
