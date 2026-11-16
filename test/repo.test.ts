import { describe, expect, it } from "vitest";
import { MemoryRepo } from "../src/repo-memory";
import { seedDemo } from "../src/seed";

describe("demo seed + repository", () => {
  it("seeds fictional users and tickets", async () => {
    const repo = new MemoryRepo();
    const r = await seedDemo(repo);
    expect(r).toEqual({ users: 4, tickets: 8 });
    expect(repo.users.every((u) => u.email.endsWith(".example"))).toBe(true);
    expect((await repo.listAdmins()).length).toBe(2);
  });
  it("filters active tickets and computes stats", async () => {
    const repo = new MemoryRepo();
    await seedDemo(repo);
    const active = await repo.listTickets({ status: "active" });
    expect(active.every((t) => t.status !== "resolved" && t.status !== "closed")).toBe(true);
    const s = await repo.stats();
    expect(s.urgent).toBe(1);
    expect(s.resolved).toBe(1);
    expect((await repo.listTickets({ q: "csv" }))[0].subject).toContain("CSV");
  });
  it("hides internal notes from requesters", async () => {
    const repo = new MemoryRepo();
    await seedDemo(repo);
    const t = (await repo.listTickets({ q: "502" }))[0];
    expect((await repo.listEvents(t.publicId, true)).some((e) => e.internal)).toBe(true);
    expect((await repo.listEvents(t.publicId, false)).some((e) => e.internal)).toBe(false);
  });
});
