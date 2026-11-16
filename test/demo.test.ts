import { describe, expect, it } from "vitest";
import { resetDemo } from "../src/seed";
import { setup } from "./helpers";

describe("public demo hardening", () => {
  it("daily reset wipes visitor data and restores the fictional seed", async () => {
    const { repo, post } = setup();
    await resetDemo(repo);
    await post("/tickets/new", { guest_name: "Visitor", guest_email: "v@example.com", subject: "Visitor ticket", body: "Left behind by a demo visitor." });
    expect(repo.tickets.length).toBe(9);
    await resetDemo(repo);
    expect(repo.tickets.length).toBe(8);
    expect(repo.tickets.some((t) => t.subject === "Visitor ticket")).toBe(false);
  });

  it("is mobile-ready and sends security headers", async () => {
    const { get } = setup();
    const res = await get("/");
    expect(await res.text()).toContain('name="viewport" content="width=device-width, initial-scale=1"');
    expect(res.headers.get("content-security-policy")).toContain("frame-ancestors 'none'");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
  });

  it("shows the demo credentials on the sign-in page", async () => {
    const { get } = setup();
    expect(await (await get("/login")).text()).toContain("admin@deskline.example");
  });
});
