import { describe, expect, it } from "vitest";
import { hashPassword } from "../src/password";
import { seedDemo } from "../src/seed";
import { setup } from "./helpers";

const cookieOf = (res: Response) => res.headers.get("set-cookie")!.split(";")[0];

async function adminSession() {
  const s = setup();
  await seedDemo(s.repo);
  const cookie = cookieOf(await s.post("/login", { email: "admin@deskline.example", password: "deskline-demo" }));
  return { ...s, cookie };
}

describe("admin triage", () => {
  it("blocks non-admins", async () => {
    const s = setup();
    await s.repo.createUser({ email: "u@deskline.example", name: "U", role: "user", passwordHash: await hashPassword("user-password-1", 1000) });
    expect((await s.get("/admin")).status).toBe(302);
    const cookie = cookieOf(await s.post("/login", { email: "u@deskline.example", password: "user-password-1" }));
    expect((await s.get("/admin", { cookie })).status).toBe(403);
  });

  it("lands admins on the dashboard with live counts", async () => {
    const { post, get, cookie } = await adminSession();
    const login = await post("/login", { email: "admin@deskline.example", password: "deskline-demo" });
    expect(login.headers.get("location")).toBe("/admin");
    const html = await (await get("/admin", { cookie })).text();
    expect(html).toContain("Triage");
    expect(html).toContain("Site down for our whole team");
    expect(html).not.toContain("How do I add a teammate?"); // resolved tickets are not in Active
  });

  it("filters unassigned tickets and searches", async () => {
    const { get, cookie } = await adminSession();
    const un = await (await get("/admin?tab=unassigned", { cookie })).text();
    expect(un).toContain("Charged twice this month");
    expect(un).not.toContain("Site down for our whole team");
    const q = await (await get("/admin?tab=all&q=pricing", { cookie })).text();
    expect(q).toContain("Typo on the pricing page");
    expect(q).not.toContain("Charged twice");
  });

  it("triages a ticket: status, priority, assignee, with an audit trail", async () => {
    const { get, post, cookie, repo } = await adminSession();
    const t = (await repo.listTickets({ q: "Charged twice" }))[0];
    const admin = (await repo.findUserByEmail("admin@deskline.example"))!;
    const r = await post(`/admin/t/${t.publicId}/triage`, { status: "in_progress", priority: "urgent", assignee: admin.id }, { cookie });
    expect(r.headers.get("location")).toBe(`/admin/t/${t.publicId}?saved=1`);
    const after = (await repo.getTicket(t.publicId))!;
    expect([after.status, after.priority, after.assigneeId]).toEqual(["in_progress", "urgent", admin.id]);
    const page = await (await get(`/admin/t/${t.publicId}?saved=1`, { cookie })).text();
    expect(page).toContain("Status: Open → In progress");
    expect(page).toContain("Priority: high → urgent");
    expect(page).toContain("Assigned to Ava Admin (demo)");
  });

  it("keeps internal notes away from the requester", async () => {
    const { post, cookie, repo } = await adminSession();
    const t = (await repo.listTickets({ q: "reset my password" }))[0];
    await post(`/admin/t/${t.publicId}/comment`, { body: "Check the mail logs first.", internal: "1" }, { cookie });
    await post(`/admin/t/${t.publicId}/comment`, { body: "Can you try again now?" }, { cookie });
    const pub = await repo.listEvents(t.publicId, false);
    expect(pub.map((e) => e.body)).toContain("Can you try again now?");
    expect(pub.map((e) => e.body)).not.toContain("Check the mail logs first.");
  });
});
