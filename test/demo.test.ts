import { describe, expect, it } from "vitest";
import { maybeResetDemo, resetDemo } from "../src/seed";
import { setup } from "./helpers";

describe("public demo hardening", () => {
  it("reset wipes visitor data and restores the fictional seed", async () => {
    const { repo, post } = setup({ demo: true });
    await maybeResetDemo(repo);
    await post("/tickets/new", { guest_name: "Visitor", guest_email: "v@example.com", subject: "Visitor ticket", body: "Left behind by a demo visitor." });
    expect(repo.tickets.some((t) => t.subject === "Visitor ticket")).toBe(true);
    await resetDemo(repo);
    expect(repo.tickets.length).toBe(8);
    expect(repo.tickets.some((t) => t.subject === "Visitor ticket")).toBe(false);
  });

  it("resets lazily at most once a day, without a cron trigger", async () => {
    const { repo } = setup({ demo: true });
    const t0 = new Date("2026-11-16T00:00:00Z");
    expect(await maybeResetDemo(repo, t0)).toBe(true);
    expect(await maybeResetDemo(repo, new Date(t0.getTime() + 23 * 3600_000))).toBe(false);
    expect(await maybeResetDemo(repo, new Date(t0.getTime() + 25 * 3600_000))).toBe(true);
  });

  it("the first request to a fresh demo seeds it", async () => {
    const { repo, get } = setup({ demo: true });
    expect(repo.tickets.length).toBe(0);
    await get("/");
    expect(repo.tickets.length).toBe(8);
  });

  it("is mobile-ready and sends security headers", async () => {
    const { get } = setup({ demo: true });
    const res = await get("/");
    expect(await res.text()).toContain('name="viewport" content="width=device-width, initial-scale=1"');
    expect(res.headers.get("content-security-policy")).toContain("frame-ancestors 'none'");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
  });

  it("shows the demo credentials on the sign-in page", async () => {
    const { get } = setup({ demo: true });
    expect(await (await get("/login")).text()).toContain("admin@deskline.example");
  });
});
