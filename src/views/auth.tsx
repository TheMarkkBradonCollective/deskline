import type { Ticket, User } from "../domain";
import { Err, Layout } from "./layout";
import { PriorityPill, StatusPill } from "./tickets";

export function Login(p: { error?: string; email?: string; next?: string; demo: boolean }) {
  return (
    <Layout title="Sign in">
      <h1>Sign in</h1>
      {p.demo && (
        <div class="notice small">
          <b>Public demo.</b> Try the admin view with <span class="code">admin@deskline.example</span> / <span class="code">deskline-demo</span>, or a requester with{" "}
          <span class="code">jordan@deskline.example</span>. All data is fictional and resets daily.
        </div>
      )}
      <form class="card" method="post" action={`/login${p.next ? `?next=${encodeURIComponent(p.next)}` : ""}`}>
        {p.error && <div class="err">{p.error}</div>}
        <label for="email">Email</label>
        <input id="email" name="email" type="email" value={p.email} autocomplete="username" />
        <label for="password">Password</label>
        <input id="password" name="password" type="password" autocomplete="current-password" />
        <button class="btn" type="submit">
          Sign in
        </button>
        <p class="small muted">
          No account? <a href="/signup">Create one</a> or <a href="/tickets/new">continue as a guest</a>.
        </p>
      </form>
    </Layout>
  );
}

export function Signup(p: { errors?: Record<string, string>; values?: Record<string, string> }) {
  const v = p.values ?? {};
  return (
    <Layout title="Create account">
      <h1>Create an account</h1>
      <form class="card" method="post" action="/signup">
        <label for="name">Name</label>
        <input id="name" name="name" value={v.name} autocomplete="name" />
        <Err e={p.errors} k="name" />
        <label for="email">Email</label>
        <input id="email" name="email" type="email" value={v.email} autocomplete="email" />
        <Err e={p.errors} k="email" />
        <label for="password">Password (10+ characters)</label>
        <input id="password" name="password" type="password" autocomplete="new-password" />
        <Err e={p.errors} k="password" />
        <button class="btn" type="submit">
          Create account
        </button>
      </form>
    </Layout>
  );
}

export function MyTickets(p: { user: User; tickets: Ticket[] }) {
  return (
    <Layout title="My tickets" user={p.user}>
      <h1>My tickets</h1>
      {p.tickets.length === 0 ? (
        <div class="card">
          No tickets yet. <a href="/tickets/new">Open one</a>.
        </div>
      ) : (
        p.tickets.map((t) => (
          <a href={`/t/${t.publicId}`} class="card" style="display:block;text-decoration:none;color:inherit">
            <div class="muted small">{t.publicId}</div>
            <b>{t.subject}</b>
            <div style="margin-top:6px">
              <StatusPill s={t.status} /> <PriorityPill p={t.priority} />
            </div>
          </a>
        ))
      )}
    </Layout>
  );
}
