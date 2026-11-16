import { PRIORITIES, STATUSES, STATUS_LABEL, type Ticket, type TicketEvent, type User } from "../domain";
import type { Stats } from "../repo";
import { Layout } from "./layout";
import { PriorityPill, StatusPill } from "./tickets";

const ADMIN_CSS = `
.stats{display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin:0 0 16px}
@media(min-width:760px){.stats{grid-template-columns:repeat(6,1fr)}}
.stat{background:#fff;border:1px solid var(--line);border-radius:12px;padding:12px 14px}
.stat b{display:block;font-size:26px;line-height:1.1}.stat span{color:var(--muted);font-size:13px}
.stat.hot b{color:var(--bad)}
.tabs{display:flex;gap:6px;overflow-x:auto;margin:0 0 12px;padding-bottom:4px}
.tabs a{white-space:nowrap;padding:7px 12px;border-radius:999px;border:1px solid var(--line);background:#fff;text-decoration:none;color:var(--ink);font-size:14px}
.tabs a.on{background:var(--ink);color:#fff;border-color:var(--ink)}
.search{display:flex;gap:8px;margin:0 0 14px}.search input{flex:1}.search .btn{margin:0}
.tlist{display:grid;gap:10px}
.trow{display:grid;gap:6px;background:#fff;border:1px solid var(--line);border-radius:12px;padding:12px 14px;text-decoration:none;color:inherit}
.trow:hover{border-color:#b9c0ff}
@media(min-width:760px){.trow{grid-template-columns:110px 1fr 180px 150px;align-items:center}}
.trow .id{font-family:ui-monospace,Menlo,monospace;font-size:13px;color:var(--muted)}
.triage{display:grid;gap:10px}@media(min-width:760px){.triage{grid-template-columns:2fr 1fr}}
`;

const TABS: [string, string][] = [
  ["active", "Active"],
  ["unassigned", "Unassigned"],
  ["mine", "Assigned to me"],
  ["waiting", "Waiting"],
  ["resolved", "Resolved"],
  ["all", "All"],
];

export function Dashboard(p: { user: User; stats: Stats; tickets: Ticket[]; tab: string; q: string }) {
  const s = p.stats;
  return (
    <Layout title="Admin" user={p.user}>
      <style dangerouslySetInnerHTML={{ __html: ADMIN_CSS }} />
      <h1>Triage</h1>
      <div class="stats">
        <div class="stat"><b>{s.open}</b><span>Open</span></div>
        <div class="stat"><b>{s.inProgress}</b><span>In progress</span></div>
        <div class="stat"><b>{s.waiting}</b><span>Waiting</span></div>
        <div class={`stat ${s.urgent ? "hot" : ""}`}><b>{s.urgent}</b><span>Urgent</span></div>
        <div class={`stat ${s.unassigned ? "hot" : ""}`}><b>{s.unassigned}</b><span>Unassigned</span></div>
        <div class="stat"><b>{s.resolved}</b><span>Resolved</span></div>
      </div>
      <nav class="tabs">
        {TABS.map(([k, label]) => (
          <a class={p.tab === k ? "on" : ""} href={`/admin?tab=${k}`}>
            {label}
          </a>
        ))}
      </nav>
      <form class="search" method="get" action="/admin">
        <input type="hidden" name="tab" value={p.tab} />
        <input name="q" value={p.q} placeholder="Search tickets, IDs, requesters" aria-label="Search" />
        <button class="btn ghost" type="submit">Search</button>
      </form>
      <div class="tlist">
        {p.tickets.length === 0 && <div class="card muted">Nothing here. Inbox zero.</div>}
        {p.tickets.map((t) => (
          <a class="trow" href={`/admin/t/${t.publicId}`}>
            <span class="id">{t.publicId}</span>
            <span>
              <b>{t.subject}</b>
              <br />
              <span class="small muted">
                {t.requesterName}
                {t.isGuest ? " · guest" : ""} · {t.category}
              </span>
            </span>
            <span>
              <StatusPill s={t.status} /> <PriorityPill p={t.priority} />
            </span>
            <span class="small muted">{t.assigneeName ?? "Unassigned"}</span>
          </a>
        ))}
      </div>
    </Layout>
  );
}

export function AdminTicket(p: { user: User; ticket: Ticket; events: TicketEvent[]; admins: User[]; saved?: boolean }) {
  const t = p.ticket;
  return (
    <Layout title={t.publicId} user={p.user}>
      <style dangerouslySetInnerHTML={{ __html: ADMIN_CSS }} />
      <p class="small" style="margin:0">
        <a href="/admin">← Back to triage</a>
      </p>
      {p.saved && <div class="notice ok" style="margin-top:10px">Saved.</div>}
      <p class="muted small" style="margin:8px 0 0">{t.publicId}</p>
      <h1>{t.subject}</h1>
      <p>
        <StatusPill s={t.status} /> <PriorityPill p={t.priority} /> <span class="pill">{t.category}</span>
      </p>
      <div class="triage">
        <div>
          <div class="card">
            <p class="muted small" style="margin-top:0">
              {t.requesterName} {t.isGuest ? "(guest)" : ""} {t.requesterEmail ? `· ${t.requesterEmail}` : ""}
            </p>
            <p style="white-space:pre-wrap;margin-bottom:0">{t.body}</p>
          </div>
          <h2>Activity</h2>
          <ul class="timeline">
            {p.events.map((e) => (
              <li class={e.internal ? "internal" : ""}>
                <b>{e.actorLabel}</b> <span class="muted small">{e.internal ? "internal note" : e.kind === "created" ? "opened the ticket" : e.kind}</span>
                {e.body && <div style="white-space:pre-wrap">{e.body}</div>}
              </li>
            ))}
          </ul>
          <form class="card" method="post" action={`/admin/t/${t.publicId}/comment`}>
            <label for="body">Reply or note</label>
            <textarea id="body" name="body" style="min-height:90px" />
            <label style="font-weight:400">
              <input type="checkbox" name="internal" value="1" style="width:auto" /> Internal note (hidden from the requester)
            </label>
            <button class="btn" type="submit">Post</button>
          </form>
        </div>
        <form class="card" method="post" action={`/admin/t/${t.publicId}/triage`} style="align-self:start">
          <h2 style="margin-top:0">Triage</h2>
          <label for="status">Status</label>
          <select id="status" name="status">
            {STATUSES.map((s) => (
              <option value={s} selected={t.status === s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
          <label for="priority">Priority</label>
          <select id="priority" name="priority">
            {PRIORITIES.map((x) => (
              <option value={x} selected={t.priority === x}>
                {x}
              </option>
            ))}
          </select>
          <label for="assignee">Assignee</label>
          <select id="assignee" name="assignee">
            <option value="">Unassigned</option>
            {p.admins.map((a) => (
              <option value={a.id} selected={t.assigneeId === a.id}>
                {a.name}
              </option>
            ))}
          </select>
          <button class="btn" type="submit" style="width:100%">Save triage</button>
        </form>
      </div>
    </Layout>
  );
}
