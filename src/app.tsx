import { Hono } from "hono";
import { newPublicId, parseGuestInput, parseTicketInput, randomToken, sha256, type User } from "./domain";
import type { Repo } from "./repo";
import { PgRepo } from "./repo-pg";
import { loadUser } from "./auth";
import { authRoutes } from "./routes-auth";
import { Home, NewTicket, NotFound, TicketView } from "./views/tickets";

export type Env = { Bindings: { DATABASE_URL: string; DEMO_MODE?: string }; Variables: { repo: Repo; user: User | null } };

export interface AppOptions {
  /** Inject a repository (tests use MemoryRepo). Defaults to Neon Postgres. */
  repo?: Repo;
  /** Show the public demo credentials on the sign-in page. */
  demo?: boolean;
}

const form = async (req: Request) => Object.fromEntries((await req.formData()).entries()) as Record<string, string>;

export function createApp(opts: AppOptions = {}) {
  const app = new Hono<Env>();

  app.use("*", async (c, next) => {
    c.set("repo", opts.repo ?? new PgRepo(c.env.DATABASE_URL));
    c.set("user", null);
    await next();
  });
  app.use("*", loadUser);
  app.route("/", authRoutes(opts.demo ?? true));

  app.get("/healthz", (c) => c.json({ ok: true, service: "deskline" }));
  app.get("/", (c) => c.html(<Home user={c.var.user} />));

  app.get("/tickets/new", (c) => c.html(<NewTicket user={c.var.user} />));

  app.post("/tickets/new", async (c) => {
    const user = c.var.user;
    const f = await form(c.req.raw);
    const t = parseTicketInput(f);
    const g = user ? null : parseGuestInput(f);
    const errors = { ...(t.ok ? {} : t.errors), ...(g && !g.ok ? g.errors : {}) };
    if (!t.ok || (g && !g.ok)) return c.html(<NewTicket user={user} errors={errors} values={f} />, 422);

    const token = user ? null : randomToken();
    const ticket = await c.var.repo.createTicket({
      ...t.value,
      publicId: newPublicId(),
      requesterId: user?.id ?? null,
      guestName: g?.ok ? g.value.name : null,
      guestEmail: g?.ok ? g.value.email : null,
      guestTokenHash: token ? await sha256(token) : null,
      actorLabel: user?.name ?? (g?.ok ? g.value.name : "Guest"),
    });
    if (token) return c.redirect(`/t/${ticket.publicId}?k=${token}&new=1`, 303);
    return c.redirect(`/t/${ticket.publicId}?new=1`, 303);
  });

  /** Can the current visitor see this ticket? Owners, admins, or holders of the guest link. */
  async function canView(repo: Repo, publicId: string, user: User | null, key: string | undefined) {
    const t = await repo.getTicket(publicId);
    if (!t) return null;
    if (user?.role === "admin" || (user && t.requesterId === user.id)) return t;
    if (t.isGuest && key) {
      const h = await repo.getGuestTokenHash(publicId);
      if (h && h === (await sha256(key))) return t;
    }
    return null;
  }

  app.get("/t/:id", async (c) => {
    const id = c.req.param("id");
    const key = c.req.query("k");
    const t = await canView(c.var.repo, id, c.var.user, key);
    if (!t) return c.html(<NotFound user={c.var.user} />, 404);
    const isAdmin = c.var.user?.role === "admin";
    if (isAdmin) return c.redirect(`/admin/t/${id}`, 302);
    const events = await c.var.repo.listEvents(id, false);
    const self = `${new URL(c.req.url).origin}/t/${id}${key ? `?k=${key}` : ""}`;
    return c.html(
      <TicketView user={c.var.user} ticket={t} events={events} replyAction={`/t/${id}/reply${key ? `?k=${key}` : ""}`} justCreatedLink={c.req.query("new") && key ? self : undefined} />,
    );
  });

  app.post("/t/:id/reply", async (c) => {
    const id = c.req.param("id");
    const key = c.req.query("k");
    const t = await canView(c.var.repo, id, c.var.user, key);
    if (!t) return c.html(<NotFound user={c.var.user} />, 404);
    const body = (await form(c.req.raw)).body?.trim() ?? "";
    if (body.length > 0 && body.length <= 5000) {
      await c.var.repo.addEvent(id, { actorId: c.var.user?.id ?? null, actorLabel: c.var.user?.name ?? t.requesterName, kind: "reply", body, internal: false });
      if (t.status === "waiting" || t.status === "resolved") await c.var.repo.updateTicket(id, { status: "open" });
    }
    return c.redirect(`/t/${id}${key ? `?k=${key}` : ""}`, 303);
  });

  app.notFound((c) => c.html(<NotFound user={c.var.user ?? null} />, 404));
  return app;
}
