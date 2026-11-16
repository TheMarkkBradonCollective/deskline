import { createApp } from "./app";
import { PgRepo } from "./repo-pg";
import { resetDemo } from "./seed";

export const app = createApp();

export default {
  fetch: app.fetch,
  /** Cron trigger (see wrangler.toml): wipe and reload the fictional demo data once a day. */
  async scheduled(_event: ScheduledController, env: { DATABASE_URL: string }) {
    await resetDemo(new PgRepo(env.DATABASE_URL));
  },
} satisfies ExportedHandler<{ DATABASE_URL: string }>;
