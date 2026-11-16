import { Hono } from "hono";
import { isEmail } from "./domain";
import type { Env } from "./app";
import { endSession, requireUser, safeNext, startSession } from "./auth";
import { hashPassword, verifyPassword } from "./password";
import { Login, MyTickets, Signup } from "./views/auth";

const form = async (req: Request) => Object.fromEntries((await req.formData()).entries()) as Record<string, string>;

export function authRoutes(demo: boolean) {
  const r = new Hono<Env>();

  r.get("/login", (c) => c.html(<Login next={c.req.query("next")} demo={demo} />));
  r.post("/login", async (c) => {
    const f = await form(c.req.raw);
    const email = (f.email ?? "").trim().toLowerCase();
    const user = email ? await c.var.repo.findUserByEmail(email) : null;
    // Same message either way, so the form doesn't reveal which emails exist.
    if (!user || !(await verifyPassword(f.password ?? "", user.passwordHash))) {
      return c.html(<Login error="That email and password don't match." email={email} next={c.req.query("next")} demo={demo} />, 401);
    }
    await startSession(c, user);
    const fallback = user.role === "admin" ? "/admin" : "/my";
    const next = c.req.query("next");
    return c.redirect(next ? safeNext(next) : fallback, 303);
  });

  r.get("/signup", (c) => c.html(<Signup />));
  r.post("/signup", async (c) => {
    const f = await form(c.req.raw);
    const name = (f.name ?? "").trim();
    const email = (f.email ?? "").trim().toLowerCase();
    const password = f.password ?? "";
    const errors: Record<string, string> = {};
    if (name.length < 2 || name.length > 80) errors.name = "Tell us your name.";
    if (!isEmail(email)) errors.email = "Enter a valid email.";
    else if (await c.var.repo.findUserByEmail(email)) errors.email = "An account with that email already exists.";
    if (password.length < 10) errors.password = "Use at least 10 characters.";
    if (Object.keys(errors).length) return c.html(<Signup errors={errors} values={{ name, email }} />, 422);
    const user = await c.var.repo.createUser({ name, email, passwordHash: await hashPassword(password), role: "user" });
    await startSession(c, user);
    return c.redirect("/my", 303);
  });

  r.post("/logout", async (c) => {
    await endSession(c);
    return c.redirect("/", 303);
  });

  r.get("/my", requireUser, async (c) => {
    const user = c.var.user!;
    return c.html(<MyTickets user={user} tickets={await c.var.repo.listTicketsForRequester(user.id)} />);
  });

  return r;
}
