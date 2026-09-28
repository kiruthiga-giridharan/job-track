# Kiruthiga's Job Board

A shared job tracker with no sign-in: anyone with the link can use it. It is built on the original Figma Make export: React 19, Vite 8, TypeScript and Tailwind CSS v4, with the same pink/purple doodle styling.

| Feature | How it works |
| --- | --- |
| Newest first | Sorted by **Date added** (editable), then by creation time |
| Add / edit | Manual form: title, company, location, description, application URL, date added (plus optional date posted, salary, tags) |
| Add with assistant | Paste a posting URL **or** a description + application URL → suggested fields → you review/edit → **Confirm & Save**. Nothing is saved before you confirm |
| Apply | Opens the validated `http(s)` application URL in a new tab. Never changes Applied status |
| Applied | A toggle you switch on/off yourself (timestamp recorded) |
| Notes | Autosaved notes per job (résumé used, contacts, …) |
| Irrelevant | Mark irrelevant → moves to the **Irrelevant** tab → **Restore** any time |
| Tabs / search / filters | All Jobs, Applied, Irrelevant; search across title, company, location, description, notes and tags; filter by status, location, tag and date range |
| Live updates | Everyone sees each other's changes instantly (Supabase Realtime) |

## Architecture

```
Browser (React SPA, Vite)
  │  supabase-js with the public anon key (no sign-in)
  ▼
Supabase
  ├─ Postgres: a single public jobs table
  ├─ Realtime: pushes jobs changes to everyone who has the board open
  └─ Edge Function extract-job (Deno), which holds ANTHROPIC_API_KEY server-side
        ├─ fetches the posting URL (blocks private/local addresses, re-checks redirects, 15 s timeout, 3 MB cap)
        ├─ reads schema.org JobPosting data when the page has it
        ├─ calls Claude (structured output) to suggest fields
        └─ explains blocked or unreadable pages, so you can paste the description instead
```

**Access rules** (in `supabase/migrations/20260928020000_public_board.sql`):

- There is no sign-in. **Anyone with the app link can view, add, edit and delete jobs, and use the assistant** (which spends your Anthropic credits). Keep the link private.
- The old sign-in tables (`members`, `invites`) and the `added_by` / `updated_by` columns are dropped.

## Project layout

```
src/
  App.tsx                 page routing (hash-based: #/job/:id, #/add)
  components/             Figma doodle UI split into components (JobCard, JobDetail, JobForm, AddJobPage, …)
  hooks/                  useBoard (data + realtime + optimistic updates), useHashRoute
  lib/                    supabase client, API calls, filtering/sorting/validation, URL safety
supabase/
  migrations/             database schema, triggers and RLS policies
  functions/extract-job/  Edge Function entry point + deno.json (pinned npm versions)
  functions/_shared/      extraction logic shared by the function and the tests
  config.toml             Supabase CLI config
tests/                    Vitest: RLS/migration tests (in-memory Postgres via PGlite), extractor, filters, rendering
```

## Accounts and API keys

| Service | Needed for | Required? |
| --- | --- | --- |
| **Supabase** (free tier works) | Database, realtime, and hosting the assistant function | **Yes** |
| **Anthropic API key** (or an Anthropic-compatible gateway such as BytePlus ModelArk) | AI extraction in “Add with assistant” | Optional. Without it the assistant still fetches pages and uses the page's structured data plus simple pattern matching, and shows a warning asking you to check every field |
| **Static host** (Vercel, Netlify, Cloudflare Pages, or Figma Make deploy) | Serving the frontend | Yes, to deploy |

## 1. Install dependencies

Requirements: Node 22+ and pnpm 10 (`.mise.toml` pins these; `npm i -g pnpm@10` also works).

```bash
pnpm install
```

## 2. Set up Supabase

1. Create a project at <https://supabase.com/dashboard>.
2. **Apply the migration.** Either:
   - **Dashboard:** open **SQL Editor**, paste and **Run** each file in `supabase/migrations/` in filename order; or
   - **CLI:**
     ```bash
     pnpm supabase login
     pnpm supabase link --project-ref <your-project-ref>
     pnpm supabase db push
     ```
3. **Realtime** is enabled for `jobs` by the migration. If live updates don't appear, check **Database → Publications → supabase_realtime** includes `jobs`.

## 3. Deploy the assistant (Edge Function)

```bash
cp supabase/functions/.env.example supabase/functions/.env   # add ANTHROPIC_API_KEY (optional)
pnpm supabase secrets set --env-file supabase/functions/.env
pnpm supabase functions deploy extract-job
```

**Using an Anthropic-compatible gateway instead (e.g. BytePlus ModelArk):** set `ANTHROPIC_BASE_URL`, `ANTHROPIC_AUTH_TOKEN` and `ANTHROPIC_MODEL` (for example `deepseek-v4-flash`) rather than `ANTHROPIC_API_KEY`. Gateways often don't support structured outputs, so in this mode the function asks the model to return the fields through a tool call and checks them before use. The model ID must be one your gateway plan supports, written in lowercase.

The key or token is stored as a Supabase secret and never reaches the browser. The default model is `claude-opus-5-5`; you can change it with `ANTHROPIC_MODEL`. Extraction runs at low effort and is set up to fall back automatically (on the API side) if the model declines a request.

## 4. Run locally in VS Code

1. Open the folder in VS Code and install the recommended extensions when prompted (Deno for `supabase/functions`, Tailwind, Vitest).
2. Create your local env file:
   ```bash
   cp .env.example .env.local
   # set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (Project Settings → API)
   ```
3. Start the dev server from the VS Code terminal:
   ```bash
   pnpm dev
   ```
   Then open <http://localhost:8443>.

The frontend can talk to your hosted Supabase project directly, so you don't need Docker. If you'd rather run the whole stack locally, install Docker and run:

```bash
pnpm supabase start                 # local Postgres/Auth/Studio; applies migrations
pnpm supabase functions serve --env-file supabase/functions/.env
# use the printed local API URL + anon key in .env.local
```

## 5. Checks

```bash
pnpm typecheck   # TypeScript
pnpm test        # Vitest (includes RLS tests against an in-memory Postgres)
pnpm build       # production build → dist/
pnpm check       # all three
```

## 6. Deploy the frontend

It is a static site: `pnpm build` outputs `dist/`.

- **Vercel:** import the repo (a `vercel.json` is included) and add the environment variables `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
- **Netlify / Cloudflare Pages:** use build command `pnpm build` and publish directory `dist`, with the same two environment variables.
- **Figma Make:** `.figma/make/deploy` still works, but the two `VITE_` variables must be available at build time.

After deploying:

- Optionally set `ALLOWED_ORIGINS` for the function to your production URL, then redeploy the function.

## Everyday use

- **Share the board:** send someone the app link. There's no sign-in, so they can use it straight away.
- **Blocked sites:** LinkedIn, Indeed and some company career sites block automated fetching or need sign-in. The assistant tells you when this happens; click **Paste the description instead**, and the link is kept as the application URL.
