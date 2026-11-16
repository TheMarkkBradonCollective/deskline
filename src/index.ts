import { Hono } from "hono";

export const app = new Hono();

app.get("/healthz", (c) => c.json({ ok: true, service: "deskline" }));
app.get("/", (c) => c.text("Deskline is under construction."));

export default app;
