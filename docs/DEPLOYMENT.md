# Praxis — Deployment Guide

This guide walks you from a fresh repo to a publicly reachable Praxis MVP, on
**three free tiers**:

| Layer        | Host             | Why                                                        |
| ------------ | ---------------- | ---------------------------------------------------------- |
| Frontend     | Cloudflare Workers | The Vite build already emits a Cloudflare Worker bundle (`wrangler.jsonc` + `dist/server/`). |
| Backend API  | Render Web Service | Long-running Node/Express + sibling `agents/` import path. |
| Database     | Supabase         | Postgres 15 + pgvector for the RAG feedback loop.          |

Total cost: **$0/month** while you stay within free quotas.

> **Why not Vercel for the frontend?** The lovable preset (`@lovable.dev/vite-tanstack-config`) targets Cloudflare Workers via the bundled `@cloudflare/vite-plugin`. The build literally emits `dist/server/wrangler.json`. Switching to Vercel would mean fighting the preset.

---

## 0 · Pre-flight (5 min)

```powershell
# from repo root
git status                  # working tree should be clean
git log --oneline -- frontend/.env  # confirm no .env was *recently* committed
```

If you see history entries for `frontend/.env`, the only secret ever exposed
was the Supabase **anon (publishable) key**, which is *designed* to be
browser-visible. Still, you should:

1. Open Supabase → **Settings → API → Reset anon key** (1-click).
2. Make sure **Row Level Security is ON** for every public table.

The service-role key, Groq key, Tavily key, and Gemini key were **never**
committed (only `frontend/.env` ever made it into git history).

---

## 1 · Database (Supabase) — already done if you ran the migrations

If the Supabase project is fresh, run the bundled migrations:

```powershell
cd database
npm install
# Set SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in database/.env first
npm run migrate
```

Capture three values from **Supabase → Settings → API**:

| Variable                       | Where it goes                                |
| ------------------------------ | -------------------------------------------- |
| `SUPABASE_URL`                 | Render (backend) **and** Cloudflare (frontend, as `VITE_SUPABASE_URL`) |
| `SUPABASE_SERVICE_ROLE_KEY`    | Render only — **never** in the frontend     |
| `SUPABASE_PUBLISHABLE_KEY` (anon) | Cloudflare as `VITE_SUPABASE_PUBLISHABLE_KEY` |

---

## 2 · Backend (Render)

### 2a · Push to GitHub

If you haven't already:

```powershell
git add render.yaml backend/.env.example frontend/.env.example backend/server.js backend/package.json agents/package.json docs/DEPLOYMENT.md
git commit -m "chore: prep monorepo for deployment"
git push origin main
```

### 2b · Create the service via Blueprint (one-click)

1. Go to <https://dashboard.render.com/blueprints> → **New Blueprint Instance**.
2. Connect your GitHub repo. Render auto-detects `render.yaml`.
3. Render shows a list with one service: `praxis-backend`. Click **Apply**.
4. After the first build kicks off, open the service → **Environment** tab and
   fill in the secrets that `render.yaml` marked `sync: false`:

   | Key                          | Value source                                         |
   | ---------------------------- | ---------------------------------------------------- |
   | `GROQ_API_KEY`               | <https://console.groq.com/keys>                      |
   | `TAVILY_API_KEY`             | <https://app.tavily.com/home> (free tier: 1000/mo)   |
   | `GEMINI_API_KEY`             | <https://aistudio.google.com/app/apikey>             |
   | `SUPABASE_URL`               | from Step 1                                          |
   | `SUPABASE_SERVICE_ROLE_KEY`  | from Step 1                                          |
   | `FRONTEND_ORIGIN`            | leave **blank for now** — we set it in Step 4        |

5. Click **Save Changes**. Render redeploys automatically.
6. When the deploy turns green, copy the public URL — it looks like
   `https://praxis-backend.onrender.com`. Test it:

   ```powershell
   curl https://praxis-backend.onrender.com/api/health
   # → {"ok":true,"name":"praxis-backend"}
   ```

> **Free tier gotcha**: Render free Web Services sleep after 15 min of
> inactivity. The first request after sleep takes ~30 s while the dyno wakes
> *and* `@xenova/transformers` re-downloads the embedding model (~25 MB).
> Subsequent requests are fast. If this hurts your demo, upgrade to **Starter**
> ($7/mo) or ping `/api/health` from a free uptime service every 10 min.

---

## 3 · Frontend (Cloudflare Workers)

### 3a · Install Wrangler + log in

```powershell
cd frontend
npm install                            # if you haven't already
npx wrangler login                     # opens a browser to auth Cloudflare
```

If you don't have a Cloudflare account, sign up at <https://dash.cloudflare.com/sign-up>
(credit card NOT required for the free Workers plan).

### 3b · (Recommended) rename the Worker

Open `frontend/wrangler.jsonc` and change:

```jsonc
"name": "tanstack-start-app",
```

to something specific to your project, e.g.:

```jsonc
"name": "praxis-mvp",
```

This determines your subdomain: `https://praxis-mvp.<your-cf-subdomain>.workers.dev`.

### 3c · Set frontend env vars (build-time + runtime)

Vite **inlines** `VITE_*` vars at *build time*, so they need to be present when
`npm run build` runs locally. Create a fresh `frontend/.env`:

```dotenv
VITE_PRAXIS_API_URL=https://praxis-backend.onrender.com
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOi...your-anon-key...
VITE_SUPABASE_PROJECT_ID=your-project-ref
```

> The lovable preset auto-copies these into `dist/server/.dev.vars` so the
> Worker has them at runtime too — no extra step needed for the first deploy.

### 3d · Build + deploy

```powershell
# still in frontend/
npm run build
npx wrangler deploy
```

The first deploy takes ~60 s. When it finishes, Wrangler prints:

```
Published praxis-mvp (1.23 sec)
  https://praxis-mvp.<subdomain>.workers.dev
```

Open that URL — you should see the Praxis landing page.

### 3e · (Optional) connect a custom domain

In the Cloudflare dashboard → **Workers & Pages → praxis-mvp → Settings →
Triggers → Custom Domains → Add Custom Domain**. Cloudflare handles the SSL
cert automatically.

---

## 4 · Wire frontend ↔ backend (CORS)

Now that you know your Worker URL, lock down the backend CORS:

1. Go to Render → `praxis-backend` → **Environment** → edit `FRONTEND_ORIGIN`:

   ```
   https://praxis-mvp.<subdomain>.workers.dev
   ```

   Or, if you have multiple origins (custom domain + workers.dev):

   ```
   https://praxis-mvp.<subdomain>.workers.dev,https://praxis.example.com
   ```

2. Save → Render auto-redeploys (~1 min).
3. Reload the frontend, open DevTools → Network → submit a hypothesis.
   The `POST /api/praxis/generate` request should succeed with a `200`.

If you get **CORS error: origin … not allowed**, the value of `FRONTEND_ORIGIN`
doesn't *exactly* match the browser's `Origin` header. Check for trailing
slashes, `http` vs `https`, and `www.` vs apex.

---

## 5 · Smoke-test the full pipeline

```powershell
# 1. Health
curl https://praxis-backend.onrender.com/api/health

# 2. Generate a plan (this takes 30-90 s — agents are working)
curl -X POST https://praxis-backend.onrender.com/api/praxis/generate `
  -H "Content-Type: application/json" `
  -d '{"hypothesis":"A 30-day intermittent fasting protocol reduces fasting glucose in adults with prediabetes."}'
```

Or just use the deployed UI — submit a hypothesis from the Cloudflare URL.

---

## 6 · Updating the deploy

Both services auto-deploy on `git push origin main`:

| What changed                  | What ships                                      |
| ----------------------------- | ----------------------------------------------- |
| Anything under `backend/` or `agents/` | Render rebuilds + redeploys (~3 min)    |
| Anything under `frontend/`    | Run `npm run build && npx wrangler deploy` from `frontend/` (or set up a Cloudflare git integration). |

For Cloudflare git auto-deploys, see <https://developers.cloudflare.com/workers/ci-cd/builds/>.

---

## 7 · Common errors & fixes

| Symptom                                                    | Fix                                                                                  |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Render build fails with `Could not find agents orchestrator` | Confirm the Render service has `rootDir: backend` and the build command runs `cd ../agents && npm install`. |
| Frontend loads but API calls fail with `NetworkError`      | `VITE_PRAXIS_API_URL` was empty when you ran `npm run build`. Rebuild after setting it. |
| Frontend gets 502 / 504 on first request                   | Render free dyno is waking up. Wait ~30 s and retry. Add a cron uptime ping if it matters for your demo. |
| `[warn] GROQ_API_KEY is not set`                           | Set `GROQ_API_KEY` in Render → Environment.                                          |
| `429 Too Many Requests` from Groq                          | Multi-model rotation already kicks in; if all candidates are exhausted the agent falls back to Gemini. Add more models to `GROQ_MODEL_CANDIDATES` if needed. |
| Cloudflare Worker bundle is > 1 MB                         | Already true for this app (~1.4 MB after gzip-equivalent). Free plan limit is 10 MB compressed, you have plenty of headroom. |
| `npx wrangler deploy` fails with `nodejs_compat` error     | Already handled — `wrangler.jsonc` sets `compatibility_flags: ["nodejs_compat"]`.    |

---

## 8 · Hardening checklist (post-MVP)

- [ ] Rotate the Supabase anon key (it was in `frontend/.env` historically).
- [ ] Enable RLS on every public Supabase table.
- [ ] Add a real domain on Cloudflare (free SSL).
- [ ] Move the embedding model out of `@xenova/transformers` cold-start
      (e.g. pre-warm in `postinstall` or switch to a hosted embedding API).
- [ ] Upgrade Render to Starter ($7/mo) to kill cold starts.
- [ ] Add Cloudflare Turnstile in front of `POST /api/praxis/generate` to
      prevent abuse (the Groq token budget is shared across all visitors).

That's it — you're live. Good luck at the hackathon. 🎯
