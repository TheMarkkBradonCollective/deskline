import { describe, expect, it } from "vitest";
import { isEmail, newPublicId, parseGuestInput, parseTicketInput, sha256 } from "../src/domain";
import { hashPassword, verifyPassword } from "../src/password";

describe("ticket validation", () => {
  it("accepts a well-formed ticket", () => {
    const r = parseTicketInput({ subject: "Login broken", body: "I cannot sign in at all.", category: "account", priority: "high" });
    expect(r.ok).toBe(true);
  });
  it("rejects short subjects and bodies", () => {
    const r = parseTicketInput({ subject: "hi", body: "short" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.errors).sort()).toEqual(["body", "subject"]);
  });
  it("does not let requesters self-assign urgent priority", () => {
    const r = parseTicketInput({ subject: "Help me", body: "Everything is on fire.", priority: "urgent" });
    expect(r.ok).toBe(false);
  });
  it("validates guest name and email", () => {
    expect(parseGuestInput({ guest_name: "Casey", guest_email: "Casey@Example.com" })).toEqual({ ok: true, value: { name: "Casey", email: "casey@example.com" } });
    expect(parseGuestInput({ guest_name: "", guest_email: "nope" }).ok).toBe(false);
    expect(isEmail("a@b.co")).toBe(true);
  });
});

describe("ids and hashing", () => {
  it("makes readable ticket ids", () => {
    expect(newPublicId()).toMatch(/^DL-[2-9A-HJ-NP-Z]{6}$/);
  });
  it("hashes deterministically", async () => {
    expect(await sha256("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });
  it("verifies passwords and rejects wrong ones", async () => {
    const h = await hashPassword("correct horse", 1000);
    expect(h).toMatch(/^pbkdf2\$1000\$/);
    expect(await verifyPassword("correct horse", h)).toBe(true);
    expect(await verifyPassword("wrong horse", h)).toBe(false);
  });
});
