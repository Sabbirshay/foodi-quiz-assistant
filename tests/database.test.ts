import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
const migration = new URL(
  "../supabase/migrations/20261001053137_initial_quiz_assistant.sql",
  import.meta.url,
);
async function setup() {
  const db = new PGlite();
  await db.exec(
    `create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);`,
  );
  await db.exec(await readFile(migration, "utf8"));
  return db;
}
test("migration creates private storage and denies direct employee corpus/RPC access", async () => {
  const db = await setup();
  try {
    const bucket = await db.query<{ public: boolean }>(
      "select public from storage.buckets where id='crawl-snapshots'",
    );
    assert.equal(bucket.rows[0].public, false);
    const rls = await db.query<{ relrowsecurity: boolean }>(
      "select relrowsecurity from pg_class where relname in ('members','app_settings','source_pages','jobs','candidates','dataset_state','usage_events','audit_events')",
    );
    assert.equal(rls.rows.length, 8);
    assert.ok(rls.rows.every((r) => r.relrowsecurity));
    await db.exec("set role authenticated");
    await assert.rejects(
      db.query("select * from public.source_pages"),
      /permission denied/,
    );
    await assert.rejects(
      db.query("select public.reserve_usage(null,'model','quiz',0.1)"),
      /permission denied/,
    );
  } finally {
    await db.close();
  }
});
test("budget reservation fails closed and counts outstanding reservations", async () => {
  const db = await setup();
  try {
    await assert.rejects(
      db.query("select reserve_usage(null,'model','quiz',0.01)"),
      /Budget disabled/,
    );
    await db.exec(
      "update app_settings set daily_budget_usd=0.1,max_call_usd=0.1",
    );
    await db.query("select reserve_usage(null,'model','quiz',0.06)");
    await assert.rejects(
      db.query("select reserve_usage(null,'model','quiz',0.06)"),
      /Daily budget exhausted/,
    );
    await db.exec("update usage_events set actual_usd=0.01");
    await db.query("select reserve_usage(null,'model','quiz',0.06)");
  } finally {
    await db.close();
  }
});
test("only current eligible sources are retrieved; activation cannot restore revoked guidance", async () => {
  const db = await setup();
  try {
    const id = "11111111-1111-1111-1111-111111111111";
    await db.query(
      "insert into source_pages(id,url,title,content,hash,observed_hash,eligible,state,verified_at) values($1,'https://sites.google.com/view/foodi-service-guidelines/test','Refund policy','Refund guidance test','hash','hash',true,'approved',now())",
      [id],
    );
    let result = await db.query(
      "select * from search_sources(array['refund'],36)",
    );
    assert.equal(result.rows.length, 1);
    await db.exec("update source_pages set state='revoked',eligible=false");
    await db.exec(
      "insert into publications(revision,digest,manifest) values('rev','digest','{}')",
    );
    await db.query("select activate_dataset($1,$2,$3)", [
      "rev",
      "digest",
      JSON.stringify([
        {
          id,
          title: "Refund policy",
          content: "Refund guidance test",
          hash: "hash",
        },
      ]),
    ]);
    result = await db.query("select * from search_sources(array['refund'],36)");
    assert.equal(result.rows.length, 0);
    await db.exec(
      "update source_pages set state='approved',eligible=true,verified_at=now()-interval '40 hours'",
    );
    result = await db.query("select * from search_sources(array['refund'],36)");
    assert.equal(result.rows.length, 0);
  } finally {
    await db.close();
  }
});
test("one active job per type prevents duplicate scheduling", async () => {
  const db = await setup();
  try {
    await db.exec("insert into jobs(kind) values('crawl')");
    await assert.rejects(
      db.exec("insert into jobs(kind) values('crawl')"),
      /duplicate key/,
    );
    await db.exec("update jobs set status='completed'");
    await db.exec("insert into jobs(kind) values('crawl')");
  } finally {
    await db.close();
  }
});
