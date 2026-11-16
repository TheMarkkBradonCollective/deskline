import { describe, expect, it } from "vitest";
import { setup } from "./helpers";

const ticket = { guest_name: "Casey Guest", guest_email: "casey@example.com", subject: "Export is broken", body: "CSV export cuts rows off.", category: "bug", priority: "high" };

describe("guest tickets", () => {
  it("renders the new-ticket form in guest mode", async () => {
    const { get } = setup();
    const html = await (await get("/tickets/new")).text();
    expect(html).toContain("filing as a <b>guest</b>");
    expect(html).toContain('name="guest_email"');
  });

  it("creates a guest ticket and returns a private link", async () => {
    const { post, get, repo } = setup();
    const res = await post("/tickets/new", ticket);
    expect(res.status).toBe(303);
    const loc = res.headers.get("location")!;
    expect(loc).toMatch(/^\/t\/DL-[A-Z0-9]{6}\?k=[0-9a-f]{48}&new=1$/);
    expect(repo.tickets[0].guestTokenHash).not.toContain(loc.split("k=")[1].split("&")[0]);
    const page = await (await get(loc)).text();
    expect(page).toContain("Export is broken");
    expect(page).toContain("Bookmark this private link");
  });

  it("rejects invalid input with field errors", async () => {
    const { post } = setup();
    const res = await post("/tickets/new", { ...ticket, guest_email: "nope", subject: "x" });
    expect(res.status).toBe(422);
    const html = await res.text();
    expect(html).toContain("valid email");
    expect(html).toContain("short subject");
  });

  it("hides the ticket without the right key", async () => {
    const { post, get } = setup();
    const loc = (await post("/tickets/new", ticket)).headers.get("location")!;
    const id = loc.split("?")[0];
    expect((await get(id)).status).toBe(404);
    expect((await get(`${id}?k=deadbeef`)).status).toBe(404);
  });

  it("lets the guest reply with their link", async () => {
    const { post, get } = setup();
    const loc = (await post("/tickets/new", ticket)).headers.get("location")!;
    const [path, qs] = loc.split("?");
    const key = new URLSearchParams(qs).get("k")!;
    const r = await post(`${path}/reply?k=${key}`, { body: "Still happening on Firefox." });
    expect(r.status).toBe(303);
    expect(await (await get(`${path}?k=${key}`)).text()).toContain("Still happening on Firefox.");
  });
});
