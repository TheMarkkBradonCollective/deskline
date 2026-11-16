# Deskline

A small, open-source help desk built on **Cloudflare Workers** and **Neon Postgres**.
Users and guests file tickets. Admins triage them.

Built start to finish with AI coding agents for **THE FUTURE**, a series from The Markk Brandon Collective.
Every feature landed through a pull request with CI (lint, typecheck, tests, build) passing first.

**Live demo:** https://deskline.themarkkbrandoncollective-2d9.workers.dev

| Demo login | Email | Password |
| --- | --- | --- |
| Admin | `admin@deskline.example` | `deskline-demo` |
| Requester | `jordan@deskline.example` | `deskline-demo` |

All demo people, emails, and tickets are fictional (reserved `.example` / `example.com` domains) and reset automatically once a day.
Please don't enter real personal information into the public demo.

## Features

- **Guest mode:** file a ticket with just a name and email, follow it through a private link (only a SHA-256 hash of the link key is stored).
- **Accounts:** sign up / sign in with PBKDF2-SHA256 password hashing and HttpOnly, SameSite=Lax session cookies (only token hashes are stored).
- **Admin triage dashboard:** live counts, filter tabs, search, status / priority / assignee changes with an audit trail, internal notes hidden from requesters.
- **Mobile-first layout:** server-rendered HTML, no client JavaScript.
- **Security headers:** strict CSP, `nosniff`, `no-referrer`, no framing.

## Stack

- Cloudflare Workers + [Hono](https://hono.dev) (server-rendered JSX)
- Neon Postgres via `@neondatabase/serverless` (HTTP driver)
- Vitest, ESLint, TypeScript; GitHub Actions CI on every PR

## Run it yourself

```sh
npm install
export DATABASE_URL=...        # your own Neon connection string; never commit it
npm run db:migrate             # applies migrations/*.sql
npm run db:seed                # loads the fictional demo data
echo "DATABASE_URL=$DATABASE_URL" > .dev.vars   # git-ignored
npm run dev
```

Deploy: `npx wrangler deploy`, then `npx wrangler secret put DATABASE_URL`.

## Known limits

- No rate limiting on sign-in or ticket creation yet.
- No outbound email; guests keep their private link.

## License

MIT
