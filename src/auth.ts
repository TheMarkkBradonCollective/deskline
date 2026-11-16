import type { Context, MiddlewareHandler } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { randomToken, sha256, type User } from "./domain";
import type { Env } from "./app";

export const SESSION_COOKIE = "dl_session";
const SESSION_DAYS = 14;

/** Issue a session: random token in an HttpOnly cookie, only its hash stored server-side. */
export async function startSession(c: Context<Env>, user: User) {
  const token = randomToken(32);
  const expires = new Date(Date.now() + SESSION_DAYS * 86400_000);
  await c.var.repo.createSession(await sha256(token), user.id, expires);
  setCookie(c, SESSION_COOKIE, token, { httpOnly: true, secure: new URL(c.req.url).protocol === "https:", sameSite: "Lax", path: "/", expires });
}

export async function endSession(c: Context<Env>) {
  const token = getCookie(c, SESSION_COOKIE);
  if (token) await c.var.repo.deleteSession(await sha256(token));
  deleteCookie(c, SESSION_COOKIE, { path: "/" });
}

export const loadUser: MiddlewareHandler<Env> = async (c, next) => {
  const token = getCookie(c, SESSION_COOKIE);
  c.set("user", token ? await c.var.repo.findSessionUser(await sha256(token), new Date()) : null);
  await next();
};

export const requireUser: MiddlewareHandler<Env> = async (c, next) => {
  if (!c.var.user) return c.redirect(`/login?next=${encodeURIComponent(new URL(c.req.url).pathname)}`, 302);
  await next();
};

export const requireAdmin: MiddlewareHandler<Env> = async (c, next) => {
  if (!c.var.user) return c.redirect(`/login?next=${encodeURIComponent(new URL(c.req.url).pathname)}`, 302);
  if (c.var.user.role !== "admin") return c.text("Admins only", 403);
  await next();
};

/** Only allow same-site relative redirects after login. */
export function safeNext(next: string | undefined | null): string {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/my";
}
