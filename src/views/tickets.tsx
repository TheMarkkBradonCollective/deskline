import { CATEGORIES, STATUS_LABEL, type Ticket, type TicketEvent, type User } from "../domain";
import { Err, Layout } from "./layout";

export const StatusPill = (p: { s: Ticket["status"] }) => <span class={`pill ${p.s}`}>{STATUS_LABEL[p.s]}</span>;
export const PriorityPill = (p: { p: Ticket["priority"] }) => <span class={`pill ${p.p}`}>{p.p}</span>;

export function Home(p: { user: User | null }) {
  return (
    <Layout title="Help desk" user={p.user}>
      <section class="hero">
        <h1>Get help, fast.</h1>
        <p>File a ticket as a guest or with an account. Our (fictional) support team triages every request.</p>
        <a class="btn" href="/tickets/new">
          Open a ticket
        </a>{" "}
        {!p.user && (
          <a class="btn ghost" href="/login">
            Sign in
          </a>
        )}
      </section>
    </Layout>
  );
}

export function NewTicket(p: { user: User | null; errors?: Record<string, string>; values?: Record<string, string> }) {
  const v = p.values ?? {};
  return (
    <Layout title="New ticket" user={p.user}>
      <h1>Open a ticket</h1>
      {!p.user && (
        <div class="notice small">
          You're filing as a <b>guest</b>. You'll get a private link to follow your ticket. <a href="/login">Sign in</a> to keep all your tickets in one place.
        </div>
      )}
      <form class="card" method="post" action="/tickets/new">
        {!p.user && (
          <div class="row">
            <div>
              <label for="guest_name">Your name</label>
              <input id="guest_name" name="guest_name" value={v.guest_name} autocomplete="name" />
              <Err e={p.errors} k="guest_name" />
            </div>
            <div>
              <label for="guest_email">Email</label>
              <input id="guest_email" name="guest_email" type="email" value={v.guest_email} autocomplete="email" />
              <Err e={p.errors} k="guest_email" />
            </div>
          </div>
        )}
        <label for="subject">Subject</label>
        <input id="subject" name="subject" value={v.subject} maxlength={120} />
        <Err e={p.errors} k="subject" />
        <div class="row">
          <div>
            <label for="category">Category</label>
            <select id="category" name="category">
              {CATEGORIES.map((c) => (
                <option value={c} selected={v.category === c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label for="priority">Priority</label>
            <select id="priority" name="priority">
              {["low", "normal", "high"].map((x) => (
                <option value={x} selected={(v.priority ?? "normal") === x}>
                  {x}
                </option>
              ))}
            </select>
          </div>
        </div>
        <label for="body">What's going on?</label>
        <textarea id="body" name="body">
          {v.body}
        </textarea>
        <Err e={p.errors} k="body" />
        <button class="btn" type="submit">
          Submit ticket
        </button>
      </form>
    </Layout>
  );
}

export function TicketView(p: { user: User | null; ticket: Ticket; events: TicketEvent[]; replyAction: string; justCreatedLink?: string; showInternal?: boolean }) {
  const t = p.ticket;
  return (
    <Layout title={t.publicId} user={p.user}>
      {p.justCreatedLink && (
        <div class="notice ok">
          <b>Ticket {t.publicId} created.</b> Bookmark this private link to check on it later:
          <div class="code" style="margin-top:6px">{p.justCreatedLink}</div>
        </div>
      )}
      <p class="muted small" style="margin:0">{t.publicId}</p>
      <h1>{t.subject}</h1>
      <p>
        <StatusPill s={t.status} /> <PriorityPill p={t.priority} /> <span class="pill">{t.category}</span>
      </p>
      <div class="card">
        <p class="muted small" style="margin-top:0">
          {t.requesterName}
          {t.isGuest ? " (guest)" : ""} · {new Date(t.createdAt).toUTCString()}
        </p>
        <p style="white-space:pre-wrap;margin-bottom:0">{t.body}</p>
      </div>
      <h2>Activity</h2>
      <ul class="timeline">
        {p.events.map((e) => (
          <li class={e.internal ? "internal" : ""}>
            <b>{e.actorLabel}</b> <span class="muted small">{e.kind === "created" ? "opened the ticket" : e.internal ? "internal note" : e.kind}</span>
            {e.body && <div style="white-space:pre-wrap">{e.body}</div>}
          </li>
        ))}
      </ul>
      {t.status !== "closed" && (
        <form class="card" method="post" action={p.replyAction}>
          <label for="reply">Add a reply</label>
          <textarea id="reply" name="body" style="min-height:90px" />
          <button class="btn" type="submit">
            Send reply
          </button>
        </form>
      )}
    </Layout>
  );
}

export function NotFound(p: { user: User | null; what?: string }) {
  return (
    <Layout title="Not found" user={p.user}>
      <h1>Not found</h1>
      <p class="muted">{p.what ?? "That page doesn't exist, or the link is no longer valid."}</p>
    </Layout>
  );
}
