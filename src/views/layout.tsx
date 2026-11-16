import type { Child } from "hono/jsx";
import type { User } from "../domain";

const CSS = `
:root{--bg:#f6f7fb;--card:#fff;--ink:#141a2a;--muted:#5d6579;--line:#e3e6ef;--brand:#3a4cf0;--brand-ink:#fff;--ok:#11845b;--warn:#b26a00;--bad:#c2283a;--r:12px}
*{box-sizing:border-box}html{-webkit-text-size-adjust:100%}
body{margin:0;font:16px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;background:var(--bg);color:var(--ink)}
a{color:var(--brand)}
.top{background:var(--ink);color:#fff}
.top .in{max-width:1080px;margin:auto;padding:12px 16px;display:flex;gap:12px;align-items:center;flex-wrap:wrap}
.logo{font-weight:800;letter-spacing:.3px;color:#fff;text-decoration:none;font-size:18px}
.logo b{color:#8f9bff}
.nav{margin-left:auto;display:flex;gap:6px;flex-wrap:wrap}
.nav a,.nav button{color:#dfe3ff;text-decoration:none;padding:6px 10px;border-radius:8px;font:inherit;background:none;border:0;cursor:pointer}
.nav a:hover,.nav button:hover{background:#ffffff1a}
main{max-width:1080px;margin:auto;padding:20px 16px 48px}
h1{font-size:26px;line-height:1.2;margin:8px 0 16px}h2{font-size:19px;margin:24px 0 10px}
.card{background:var(--card);border:1px solid var(--line);border-radius:var(--r);padding:18px;margin:0 0 14px}
.grid{display:grid;gap:14px}@media(min-width:760px){.grid.two{grid-template-columns:1fr 1fr}}
label{display:block;font-weight:600;margin:12px 0 4px}
input,select,textarea{width:100%;font:inherit;padding:10px 12px;border:1px solid var(--line);border-radius:10px;background:#fff;color:var(--ink)}
textarea{min-height:130px;resize:vertical}
.row{display:flex;gap:10px;flex-wrap:wrap}.row>*{flex:1 1 160px}
.btn{display:inline-block;background:var(--brand);color:var(--brand-ink);border:0;border-radius:10px;padding:11px 16px;font:inherit;font-weight:700;cursor:pointer;text-decoration:none;margin-top:14px}
.btn.ghost{background:#fff;color:var(--brand);border:1px solid var(--line)}
.err{color:var(--bad);font-size:14px;margin-top:4px}
.muted{color:var(--muted)}.small{font-size:14px}
.pill{display:inline-block;font-size:12px;font-weight:700;padding:2px 9px;border-radius:999px;background:#eef0ff;color:#2b37b8;white-space:nowrap}
.pill.open{background:#e7f0ff;color:#1d4ed8}.pill.in_progress{background:#fff4dc;color:var(--warn)}.pill.waiting{background:#f1e9ff;color:#6d28d9}
.pill.resolved,.pill.closed{background:#e4f6ee;color:var(--ok)}
.pill.urgent{background:#fde4e7;color:var(--bad)}.pill.high{background:#fff0e0;color:#b45309}.pill.low{background:#eef1f5;color:var(--muted)}
.notice{background:#eef0ff;border:1px solid #cfd5ff;border-radius:var(--r);padding:14px 16px;margin:0 0 16px}
.notice.ok{background:#e9f8f1;border-color:#bfe8d4}
.code{font-family:ui-monospace,Menlo,monospace;word-break:break-all;background:#f1f3f9;padding:2px 6px;border-radius:6px}
.timeline{list-style:none;padding:0;margin:0}.timeline li{border-left:3px solid var(--line);padding:4px 0 12px 14px}
.timeline li.internal{border-color:#f2c94c;background:#fffbea}
.hero{padding:22px 0 6px}.hero p{font-size:18px;color:var(--muted);max-width:640px}
footer{max-width:1080px;margin:auto;padding:0 16px 32px;color:var(--muted);font-size:13px}
`;

export function Layout(props: { title: string; user?: User | null; children: Child }) {
  const u = props.user;
  return (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{`${props.title} · Deskline`}</title>
        <style dangerouslySetInnerHTML={{ __html: CSS }} />
      </head>
      <body>
        <header class="top">
          <div class="in">
            <a class="logo" href="/">
              Desk<b>line</b>
            </a>
            <nav class="nav">
              <a href="/tickets/new">New ticket</a>
              {u ? (
                <>
                  <a href="/my">My tickets</a>
                  {u.role === "admin" && <a href="/admin">Admin</a>}
                  <form method="post" action="/logout" style="display:inline">
                    <button type="submit">Sign out</button>
                  </form>
                </>
              ) : (
                <a href="/login">Sign in</a>
              )}
            </nav>
          </div>
        </header>
        <main>{props.children}</main>
        <footer>Deskline is an open-source demo built with AI coding agents. All data here is fictional.</footer>
      </body>
    </html>
  );
}

export const Err = (p: { e?: Record<string, string>; k: string }) => (p.e?.[p.k] ? <div class="err">{p.e[p.k]}</div> : null);
