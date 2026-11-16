import { describe, expect, it } from "vitest";
import { hashPassword } from "../src/password";
import { setup } from "./helpers";

const cookieOf = (res: Response) => res.headers.get("set-cookie")!.split(";")[0];

async function withUser(role: "user" | "admin" = "user") {
  const s = setup();
  await s.repo.createUser({ email: "pat@deskline.example", name: "Pat Demo", role, passwordHash: await hashPassword("correct-horse-battery", 1000) });
  return s;
}

describe("auth", () => {
  it("signs in with the right password and sets an HttpOnly session cookie", async () => {
    const { post, repo } = await withUser();
    const res = await post("/login", { email: "Pat@Deskline.example", password: "correct-horse-battery" });
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/my");
    const sc = res.headers.get("set-cookie")!;
    expect(sc).toMatch(/dl_session=[0-9a-f]{64}/);
    expect(sc).toContain("HttpOnly");
    expect(sc).toContain("SameSite=Lax");
    // Only the hash of the token is stored.
    const token = sc.split(";")[0].split("=")[1];
    expect(repo.sessions.has(token)).toBe(false);
    expect(repo.sessions.size).toBe(1);
  });

  it("rejects a wrong password without saying which part was wrong", async () => {
    const { post } = await withUser();
    const res = await post("/login", { email: "pat@deskline.example", password: "nope" });
    expect(res.status).toBe(401);
    expect(await res.text()).toContain("don&#39;t match");
  });

  it("signs up, shows my tickets, and files tickets under the account", async () => {
    const { post, get } = setup();
    const res = await post("/signup", { name: "New Person", email: "new@deskline.example", password: "long-enough-pass" });
    expect(res.status).toBe(303);
    const cookie = cookieOf(res);
    const t = await post("/tickets/new", { subject: "Signed in ticket", body: "Filed with an account.", category: "general", priority: "normal" }, { cookie });
    expect(t.headers.get("location")).toMatch(/^\/t\/DL-\w{6}\?new=1$/);
    const my = await (await get("/my", { cookie })).text();
    expect(my).toContain("Signed in ticket");
  });

  it("requires sign-in for /my and ignores off-site next= redirects", async () => {
    const { get, post } = await withUser();
    const r = await get("/my");
    expect(r.status).toBe(302);
    expect(r.headers.get("location")).toBe("/login?next=%2Fmy");
    const res = await post("/login?next=//evil.example", { email: "pat@deskline.example", password: "correct-horse-battery" });
    expect(res.headers.get("location")).toBe("/my");
  });

  it("signs out and invalidates the session", async () => {
    const { post, get, repo } = await withUser();
    const cookie = cookieOf(await post("/login", { email: "pat@deskline.example", password: "correct-horse-battery" }));
    await post("/logout", {}, { cookie });
    expect(repo.sessions.size).toBe(0);
    expect((await get("/my", { cookie })).status).toBe(302);
  });
});
