import { Hono } from "hono";
import { PRIORITIES, STATUSES, STATUS_LABEL, type Priority, type Status } from "./domain";
import type { Env } from "./app";
import { requireAdmin } from "./auth";
import type { TicketFilter, TicketPatch } from "./repo";
import { AdminTicket, Dashboard } from "./views/admin";
import { NotFound } from "./views/tickets";

const form = async (req: Request) => Object.fromEntries((await req.formData()).entries()) as Record<string, string>;

function filterFor(tab: string, meId: string, q: string): TicketFilter {
  const base: TicketFilter = { q: q || undefined, meId };
  switch (tab) {
    case "unassigned":
      return { ...base, status: "active", assignee: "unassigned" };
    case "mine":
      return { ...base, status: "active", assignee: "me" };
    case "waiting":
      return { ...base, status: "waiting" };
    case "resolved":
      return { ...base, status: "resolved" };
    case "all":
      return { ...base, status: "all" };
    default:
      return { ...base, status: "active" };
  }
}

export function adminRoutes() {
  const r = new Hono<Env>();
  r.use("*", requireAdmin);

  r.get("/", async (c) => {
    const tab = c.req.query("tab") ?? "active";
    const q = (c.req.query("q") ?? "").trim().slice(0, 100);
    const [stats, tickets] = await Promise.all([c.var.repo.stats(), c.var.repo.listTickets(filterFor(tab, c.var.user!.id, q))]);
    return c.html(<Dashboard user={c.var.user!} stats={stats} tickets={tickets} tab={tab} q={q} />);
  });

  r.get("/t/:id", async (c) => {
    const id = c.req.param("id");
    const t = await c.var.repo.getTicket(id);
    if (!t) return c.html(<NotFound user={c.var.user} />, 404);
    const [events, admins] = await Promise.all([c.var.repo.listEvents(id, true), c.var.repo.listAdmins()]);
    return c.html(<AdminTicket user={c.var.user!} ticket={t} events={events} admins={admins} saved={c.req.query("saved") === "1"} />);
  });

  r.post("/t/:id/triage", async (c) => {
    const id = c.req.param("id");
    const t = await c.var.repo.getTicket(id);
    if (!t) return c.html(<NotFound user={c.var.user} />, 404);
    const f = await form(c.req.raw);
    const me = c.var.user!;
    const patch: TicketPatch = {};
    const log: { kind: "status" | "priority" | "assign"; body: string }[] = [];
    if ((STATUSES as readonly string[]).includes(f.status) && f.status !== t.status) {
      patch.status = f.status as Status;
      log.push({ kind: "status", body: `Status: ${STATUS_LABEL[t.status]} → ${STATUS_LABEL[patch.status]}` });
    }
    if ((PRIORITIES as readonly string[]).includes(f.priority) && f.priority !== t.priority) {
      patch.priority = f.priority as Priority;
      log.push({ kind: "priority", body: `Priority: ${t.priority} → ${patch.priority}` });
    }
    const assignee = f.assignee || null;
    if (assignee !== t.assigneeId) {
      const admin = assignee ? (await c.var.repo.listAdmins()).find((a) => a.id === assignee) : null;
      if (!assignee || admin) {
        patch.assigneeId = assignee;
        log.push({ kind: "assign", body: admin ? `Assigned to ${admin.name}` : "Unassigned" });
      }
    }
    if (log.length) {
      await c.var.repo.updateTicket(id, patch);
      for (const l of log) await c.var.repo.addEvent(id, { actorId: me.id, actorLabel: me.name, kind: l.kind, body: l.body, internal: false });
    }
    return c.redirect(`/admin/t/${id}?saved=1`, 303);
  });

  r.post("/t/:id/comment", async (c) => {
    const id = c.req.param("id");
    const t = await c.var.repo.getTicket(id);
    if (!t) return c.html(<NotFound user={c.var.user} />, 404);
    const f = await form(c.req.raw);
    const body = (f.body ?? "").trim();
    if (body && body.length <= 5000) {
      const me = c.var.user!;
      const internal = f.internal === "1";
      await c.var.repo.addEvent(id, { actorId: me.id, actorLabel: me.name, kind: internal ? "note" : "reply", body, internal });
    }
    return c.redirect(`/admin/t/${id}`, 303);
  });

  return r;
}
