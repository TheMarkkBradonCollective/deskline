import { describe, expect, it } from "vitest";
import { app } from "../src/index";

describe("health check", () => {
  it("reports ok", async () => {
    const res = await app.request("/healthz");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, service: "deskline" });
  });
});
