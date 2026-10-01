# Verification — 2026-10-02 (Asia/Dhaka)

## Confirmed

- 15 regression tests pass, including Postgres permissions/budget/queue behavior, strict model payloads, citations, Unicode, schedules, and Chromium extraction under the actual tsx worker runtime.
- Five isolated browser tests pass against a separate preview server on port 3100.
- Live owner sign-in, OpenRouter model selector, settings save, local worker startup and heartbeat, employee creation/sign-in, admin authorization, immediate disabled-session denial, and mobile layout checked. Temporary employee identity removed afterward.
- Google service account authenticates and reads the specified workbook (HTTP 200).
- Real Foodi policy pages inspected. Fixed two crawler failures: tsx serialization helpers inside page.evaluate, and Google Sites marking only its heading as role=main. Full refund/return/delivery policy text now extracted; image/embed gaps remain explicitly flagged.
- No automatic crawler retry after potentially charged model calls. Short/empty policy pages are flagged for review without blocking the complete inventory.
- Sheets staging/readback uses batch requests to avoid one request per page. Hosted quiz requests refresh spreadsheet integrity while the local crawler is offline.
- Supabase schema is deployed in Hustle; private snapshot bucket and server-only database access verified.
- Production secrets configured in the Vercel project with explicit owner approval. They are excluded from source control and deployment uploads.

## Pending owner configuration / live validation

- Owner chose to select models and budgets personally; last observed settings have blank models and a zero budget. No paid AI call was made.
- A complete paid crawl, candidate review, Sheet publication, and actual evidence-backed AI answer remain unverified until those settings are saved and a knowledge revision is approved.
- Image-only policies and embedded documents need manual ingestion support before they can be approved; the current version intentionally blocks those candidates.
- Semantic/Banglish retrieval quality needs an owner-reviewed quiz set. Current retrieval is lexical.
- The local device must be running for crawling/publication. Schedules remain paused; no Render resources are used.

Production deployment is READY at https://foodi-quiz-assistant.vercel.app (Vercel deployment `dpl_3X9LWYeprt7tmmYcZ5nMxjdJbRTt`). Production browser verification passed: login, live model selector, settings save (200), hosted worker-start rejection (403), and no JavaScript runtime errors. Quiz requests correctly return 503 until a knowledge revision is published.

Project code is published to https://github.com/Sabbirshay/foodi-quiz-assistant on `main`.
