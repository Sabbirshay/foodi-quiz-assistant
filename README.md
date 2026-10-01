# Foodi Quiz Assistant

A private employee quiz helper built with Next.js, Supabase, OpenRouter, Crawlee, and Google Sheets. Employees provide a question and options; the app returns a supported selection, an explanation, and exact source excerpts. It does not create weekly quizzes or submit employees’ answers.

## Current state

The web application and crawler worker are implemented. The Supabase project **Foodi Quiz Assistant** (`knphmvevpmmhdqlfvueg`) is created in the **Hustle** organization, with its initial schema and private snapshot bucket applied. The local preview is available at `http://127.0.0.1:3000`. Live Supabase sign-in, the OpenRouter model catalog, and Google Sheets read access have been verified. The training example is synthetic and never calls an AI provider.

## Run locally

Requires Node.js 24 and pnpm 11.25.0.

```sh
pnpm install --frozen-lockfile
cp .env.example .env.local  # Only for a new checkout; do not overwrite configured values.
pnpm dev
```

For a new checkout, configure the following in the ignored `.env.local`:

- `SUPABASE_SECRET_KEY`: the Foodi project's server secret key. Never use a `NEXT_PUBLIC_` name for this value.
- `OPENROUTER_API_KEY`: the owner's OpenRouter key.
- `APP_ORIGIN`: the exact browser origin, currently `http://127.0.0.1:3000`. Change this for Vercel.
- `GOOGLE_SERVICE_ACCOUNT_EMAIL` and `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`: a Google service account with the Sheets API enabled. Share only the intended workbook with this account as Editor. Escaped `\n` characters in the private key are supported.

Keep the workbook private. The crawler manages `_manifest` and one `page_<id>` tab per source. Each row contains a revision, source identity/title/URL, content hash, text part, order, and timestamp. RAW writes prevent formula evaluation. Unrelated tabs are preserved. Direct edits to active managed content block answers until a verified revision is restored.

## Create the owner account

Set the temporary `FOODI_ADMIN_EMAIL` and `FOODI_ADMIN_PASSWORD` values in `.env.local`, then run:

```sh
pnpm bootstrap
```

The chosen owner email is `mdronykhan4632@gmail.com`. Password must be at least 12 characters. The script creates a Supabase Auth identity and a super admin membership, and refuses if an admin already exists. Remove both bootstrap variables immediately after success. No invitation email is sent. The super admin can create employee accounts and enable/disable access in the app. Disable public signups in Supabase Auth before production; app membership checks deny non-members regardless.

## Configure models and schedule

Sign in, then open `/admin`:

1. Load the live OpenRouter model catalog.
2. Choose quiz-answering and crawler-analysis models separately. Only text models advertising structured outputs are accepted.
3. Set a daily USD budget and maximum per-call reservation. Both default to zero (AI disabled).
4. Set a five-field cron expression and timezone. The proposed `0 */12 * * *` schedule means midnight/noon in Asia/Dhaka. Scheduling starts paused.
5. Start the worker, then run a crawl, inspect candidates, approve complete sources, and publish.

Model choices come from the admin's database settings. Employee requests cannot override a model, prompt, URL, or budget. The model catalog includes current input/output prices. Provider data collection is denied, fallback routing is disabled, and a budget reservation is made before a model call. Unknown provider charges retain their reservation. There are no automatic charged retries at the model adapter.

## Crawler and publication worker

```sh
pnpm --filter @foodi/crawler exec playwright install chromium
pnpm worker
```

The crawler runs on your local device; no Render account is needed.

1. Run `pnpm dev`, then sign in at `http://127.0.0.1:3000/admin`.
2. Open **Crawl activity → Start local crawler**. This button is available only on the local server with `LOCAL_WORKER_ENABLED=1`.
3. Refresh until the crawler shows **Online**, then click **Run crawl now**. Once online, the hosted admin can also queue jobs for this device.
4. Review candidates, approve complete sources, and publish while the device remains awake.

Alternatively, run `./start-crawler.sh` from the project folder (no pnpm command needed on this configured Linux device), or `pnpm worker`. Both start the same local worker in your terminal. It automatically uses an installed Chrome on Linux, or the Playwright Chromium installed above; `CHROME_PATH` can override the executable. A local process lock prevents duplicate workers. Dashboard-started logs are in ignored `storage/worker.log`.

Keep schedules paused for manual crawling. Optional schedules only execute while the local worker is running. The worker uses Supabase's queue, renews job leases, and verifies the spreadsheet every five minutes. The hosted quiz endpoint also verifies the spreadsheet on demand, so employee answers do not require the local device to remain online. Sources still expire after the admin's source-age limit and need a fresh crawl. Browser security means a hosted page cannot launch a process on your computer; start the worker through the local dashboard first.

The crawl boundary is exactly `https://sites.google.com/view/foodi-service-guidelines/`. Source changes immediately make the old page ineligible. Crawlee loads pages; the selected OpenRouter model analyzes exact text and flags coverage gaps. Raw snapshots go into private Supabase Storage. Models cannot approve content. Initial publication requires a completed crawl.

Publication appends a staged revision without deleting the prior rows, reads it back, verifies hashes/digest, updates a small manifest, reads it again, and atomically activates the Sheet-derived database content. A publication journal permits recovery after a manifest commit followed by a process crash. Sheet integrity failures block answering. Snapshot and spreadsheet revision retention is manual in this first version; do not delete active or staged content while jobs run.

## Security and answer behavior

- Every protected API route validates the Supabase user and current membership; admin operations require `super_admin`.
- Database tables have RLS enabled, but no client policies or grants. All corpus access runs through authenticated application routes using the server key. The advisor's “RLS Enabled No Policy” notices are intentional default-deny behavior.
- Source snapshots are private. Employee clients never receive server or provider keys.
- Mutations require an exact matching Origin and bounded JSON bodies.
- Retrieval uses a PostgreSQL lexical baseline with Unicode terms. Semantic embeddings/Banglish translation are not implemented; missed matches abstain.
- Answers validate selection cardinality, current source IDs, exact quotes, and numeric claims. Citation checks do not prove full semantic correctness; human evaluation remains necessary.
- Stale sources and a spreadsheet not verified for an hour are excluded/blocked. Role and source eligibility are checked again after generation.
- Raw quiz inputs and generated answers are not persisted. Usage, jobs, and audit records contain metadata.
- The crawler model must support image inputs and structured output. It transcribes SOP images and preserves flowchart nodes, arrows, and branch conditions. Original images are stored privately with the candidate; admin confirmation is required before approval.
- Unreadable/cropped/ambiguous images, unsupported hosts/formats, more than eight images, or oversized image sets remain blocked. PDF/Drive embeds and unresolved collapsed sections still require manual ingestion.
- Vision calls conservatively reserve the full selected model input-context cost plus output/per-image costs against the same daily/per-call budgets. Choose spending limits accordingly; unused reservations are reconciled when the provider reports actual usage.

## Verification

```sh
pnpm typecheck
pnpm test
pnpm build
# With the dev server running and Chromium installed:
pnpm test:browser
# Or use an installed Chrome:
CHROME_PATH=/usr/bin/google-chrome pnpm test:browser
```

Tests cover schema/RLS isolation, budget reservations, stale/revoked sources, queue deduplication, strict OpenRouter payloads with mocked HTTP, source URL boundaries, cron validation, Bangla terms/numerals, exact evidence, option selection, desktop/mobile interactions, and unconfigured API guards. Browser tests start a separate unconfigured preview on port 3100. Live authenticated checks have also verified owner sign-in, model loading, settings save, local worker startup, employee provisioning, access restrictions and disabling active sessions.

## Vercel

`vercel.json` deploys the Next.js app. Production requires the public Supabase URL/key, server Supabase/OpenRouter keys, Google service account credentials and spreadsheet ID, plus `APP_ORIGIN` set to the production domain. Google credentials allow read-only integrity verification from the hosted quiz endpoint; crawling/publication run locally. Do not enable `LOCAL_WORKER_ENABLED` in Vercel. Never upload `.env.local`, bootstrap passwords, or `storage/` to GitHub.

The GitHub repository is https://github.com/Sabbirshay/foodi-quiz-assistant. Deployment status and pending live AI checks are recorded in `docs/verification.md`.

See `docs/connection-status.md` for the verified project connection and `docs/verification.md` for the current test evidence and remaining live checks.
