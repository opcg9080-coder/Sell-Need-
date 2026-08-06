# Marketplace

A minimal, admin-moderated marketplace. Anyone can list an item; it only appears publicly after an admin approves it.

Two **completely separate, unlinked** apps in this one project:
- **User site** (`/`) — no login, no accounts. Browse, search, and list items.
- **Admin panel** (`) — password-gated, separate codebase, never linked from the user site.

## ⚠️ Important security note (please read)

GitHub Pages is **public static hosting** — anything you upload can be opened by anyone who has the exact URL, no matter which folder it's in. The  folder name and the login screen are two independent layers of protection:
- **The folder name** stops casual/accidental discovery (no link to it exists anywhere on the public site, and it's excluded from search engines via `robots meta`).
- **The password** stops anyone who *does* find the URL from getting in.

Neither of these is a substitute for a real backend. The current login check runs entirely in the browser — good enough to keep this demo private while you're testing, but before handling real users' data you should move authentication to a real backend (see "Going further" below).

**Before you deploy — do both of these:**
1. Rename the ` folder to your own random string so the default name isn't guessable.
2. Open `/js/db.js`, find `ADMIN_EMAIL` and  near the top, and replace both with your own values.

**Never commit real credentials to this file if the repo is public** — anyone can view a public repo's source, including this file. Treat whatever you put here as visible to the world; don't reuse a password you use anywhere else.

## Run locally
```bash
cd marketplace
python3 -m http.server 8080
```
Open `http://localhost:8080` for the user site, and `http://localhost:8080` (use your renamed folder) for the admin panel.

## Deploy to GitHub Pages
1. Push this whole folder to a new GitHub repo (root = this folder's contents).
2. Repo → **Settings → Pages** → Source: **Deploy from a branch** → Branch: `main`, folder: `/ (root)` → Save.
3. Your user site: `https://username.github.io/repo-name/`
   Your admin panel: `` (after renaming, use your new folder name)

## How data flows (no server yet)
Both apps store data in the browser's `localStorage`, under the same key (`marketplace:v1`), on the same domain — that's how an admin approval on `` makes an item show up on `/`. The two folders never `import` each other's code; `db.js` is intentionally duplicated in both places so the codebases stay fully independent.

## Admin panel features
- Dashboard (pending/approved/rejected counts)
- Pending Listings — search, **bulk approve/reject**, edit an item before approving, block a seller's contact from listing again
- Approved / Rejected Listings — searchable lists, CSV export
- **Audit Log** — every approve/reject/settings change is recorded with a timestamp
- Settings — site name, currency symbol, minimum price, whether contact info is required, manage blocked sellers, export all data as CSV

## Going further (real backend)
When you're ready to move off `localStorage`, only move the admin password check into that backend (e.g. Firebase custom claims) instead of the client-side check used here.
