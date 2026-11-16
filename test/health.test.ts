import { describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import { MemoryRepo } from "../src/repo-memory";

const app = createApp({ repo: new MemoryRepo() });

describe("health check", () => {
  it("reports ok", async () => {
    const res = await app.request("/healthz");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, service: "deskline" });
  });
});
