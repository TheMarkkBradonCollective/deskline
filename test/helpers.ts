import { createApp } from "../src/app";
import { MemoryRepo } from "../src/repo-memory";

export function setup() {
  const repo = new MemoryRepo();
  const app = createApp({ repo });
  const post = (path: string, data: Record<string, string>, headers: Record<string, string> = {}) =>
    app.request(path, { method: "POST", body: new URLSearchParams(data), headers: { "content-type": "application/x-www-form-urlencoded", ...headers } });
  const get = (path: string, headers: Record<string, string> = {}) => app.request(path, { headers });
  return { repo, app, post, get };
}
