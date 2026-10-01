import { JWT } from "google-auth-library";
import { createHash, randomUUID } from "node:crypto";
import { database, must } from "../../src/lib/db";
export type PublishedPage = {
  id: string;
  title: string;
  url: string;
  content: string;
  hash: string;
};
type Manifest = {
  revision: string;
  digest: string;
  pages: { id: string; tab: string; hash: string }[];
};
const spreadsheet = () => {
  const id = process.env.GOOGLE_SPREADSHEET_ID;
  if (!id) throw new Error("Google spreadsheet ID is missing.");
  return id;
};
export function hash(s: string) {
  return createHash("sha256").update(s).digest("hex");
}
export function datasetDigest(pages: PublishedPage[]) {
  return hash(
    JSON.stringify(
      [...pages]
        .sort((a, b) => a.id.localeCompare(b.id))
        .map((p) => [p.id, p.title, p.url, p.hash, p.content]),
    ),
  );
}
async function google(path: string, method = "GET", payload?: unknown) {
  const client = new JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  const { token } = await client.getAccessToken();
  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheet()}${path}`,
    {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: payload ? JSON.stringify(payload) : undefined,
      signal: AbortSignal.timeout(30000),
    },
  );
  if (!response.ok)
    throw new Error(`Sheets request failed (${response.status}).`);
  return response.json();
}
async function readRange(range: string): Promise<string[][]> {
  return (await google(`/values/${encodeURIComponent(range)}`)).values ?? [];
}
async function readRanges(ranges: string[]): Promise<string[][][]> {
  if (!ranges.length) return [];
  const query = new URLSearchParams();
  ranges.forEach((range) => query.append("ranges", range));
  const result = await google(`/values:batchGet?${query}`);
  if (result.valueRanges?.length !== ranges.length)
    throw new Error("Incomplete spreadsheet batch.");
  return result.valueRanges.map(
    (range: { values?: string[][] }) => range.values ?? [],
  );
}
async function readManifest(): Promise<Manifest> {
  const rows = await readRange("'_manifest'!A1:B2");
  if (rows[0]?.[0] !== "foodi_revision_v1" || !rows[1]?.[1])
    throw new Error("Spreadsheet manifest is missing or invalid.");
  const value = JSON.parse(rows[1][1]);
  if (
    !value.revision ||
    !value.digest ||
    !Array.isArray(value.pages) ||
    value.pages.length > 200
  )
    throw new Error("Invalid manifest.");
  return value;
}
async function readRevision(manifest: Manifest): Promise<PublishedPage[]> {
  const pages: PublishedPage[] = [];
  const ids = new Set<string>();
  for (const entry of manifest.pages) {
    if (
      !/^[a-f0-9-]{36}$/.test(entry.id) ||
      !/^page_[a-f0-9]{32}$/.test(entry.tab) ||
      ids.has(entry.id)
    )
      throw new Error("Invalid page manifest.");
    ids.add(entry.id);
  }
  const batches = await readRanges(
    manifest.pages.map((entry) => `'${entry.tab}'!A1:H20000`),
  );
  for (const [index, entry] of manifest.pages.entries()) {
    const all = batches[index];
    if (all.length >= 20000)
      throw new Error(
        "Sheet row cap reached; archive old revisions before publishing.",
      );
    const rows = all
      .filter((r) => r[0] === manifest.revision)
      .sort((a, b) => Number(a[6]) - Number(b[6]));
    if (
      !rows.length ||
      rows.some(
        (r, i) =>
          r[1] !== entry.id ||
          r[4] !== entry.hash ||
          Number(r[6]) !== i ||
          r[2] !== rows[0][2] ||
          r[3] !== rows[0][3],
      )
    )
      throw new Error("Mixed or incomplete sheet revision.");
    const content = rows.map((r) => r[5] ?? "").join("");
    if (hash(content) !== entry.hash)
      throw new Error("Spreadsheet source hash mismatch.");
    pages.push({
      id: entry.id,
      title: rows[0][2],
      url: rows[0][3],
      hash: entry.hash,
      content,
    });
  }
  if (datasetDigest(pages) !== manifest.digest)
    throw new Error("Spreadsheet revision digest mismatch.");
  return pages;
}
export async function verifySpreadsheet() {
  const db = database();
  const state = must(
    await db.from("dataset_state").select("*").eq("id", 1).single(),
  );
  const journal = must(
    await db.from("publications").select("revision").limit(1),
  );
  if (!state.revision && !journal.length) return;
  try {
    const a = await readManifest();
    const pages = await readRevision(a);
    const b = await readManifest();
    if (JSON.stringify(a) !== JSON.stringify(b))
      throw new Error("Spreadsheet changed during verification.");
    const registered = must(
      await db
        .from("publications")
        .select("digest,manifest,created_at")
        .eq("revision", a.revision)
        .maybeSingle(),
    );
    if (
      !registered ||
      registered.digest !== a.digest ||
      JSON.stringify(registered.manifest.pages) !== JSON.stringify(a.pages)
    )
      throw new Error("Unregistered spreadsheet publication.");
    if (a.revision !== state.revision) {
      if (state.revision) {
        const previous = must(
          await db
            .from("publications")
            .select("created_at")
            .eq("revision", state.revision)
            .single(),
        );
        if (registered.created_at <= previous.created_at)
          throw new Error("Manual spreadsheet rollback is not allowed.");
      }
      // Recover a committed Sheet revision after a crash before database activation.
      must(
        await db.rpc("activate_dataset", {
          p_revision: a.revision,
          p_digest: a.digest,
          p_pages: pages,
        }),
      );
    } else {
      if (a.digest !== state.digest)
        throw new Error("Spreadsheet digest mismatch.");
      must(
        await db
          .from("dataset_state")
          .update({
            sheet_verified_at: new Date().toISOString(),
            blocked: false,
          })
          .eq("id", 1)
          .eq("revision", a.revision),
      );
    }
  } catch (error) {
    must(await db.from("dataset_state").update({ blocked: true }).eq("id", 1));
    throw error;
  }
}
export async function publish() {
  const db = database();
  const originalState = must(
    await db.from("dataset_state").select("revision").eq("id", 1).single(),
  );
  if (originalState.revision) await verifySpreadsheet();
  else {
    try {
      await verifySpreadsheet();
    } catch {
      /* An uncommitted initial stage is safe to restage below. */
    }
  }
  const state = must(
    await db.from("dataset_state").select("*").eq("id", 1).single(),
  );
  if (!state.revision) {
    const last = must(
      await db
        .from("jobs")
        .select("id")
        .eq("kind", "crawl")
        .eq("status", "completed")
        .limit(1),
    );
    if (!last.length)
      throw new Error(
        "A complete initial crawl is required before publication.",
      );
  }
  const [existing, approved] = await Promise.all([
    db.from("source_pages").select("*").eq("eligible", true).then(must),
    db
      .from("candidates")
      .select("*,source_pages(observed_hash,state)")
      .eq("status", "approved")
      .then(must),
  ]);
  const map = new Map<string, PublishedPage>(
    existing.map((p) => [
      p.id,
      {
        id: p.id,
        title: p.title,
        url: p.url,
        content: p.content,
        hash: p.hash,
      },
    ]),
  );
  for (const c of approved) {
    if (
      c.hash !== c.source_pages.observed_hash ||
      c.coverage_notes.length ||
      ["revoked", "access_denied", "not_found", "coverage_gap"].includes(
        c.source_pages.state,
      )
    )
      continue;
    map.set(c.page_id, {
      id: c.page_id,
      title: c.title,
      url: c.url,
      content: c.content,
      hash: c.hash,
    });
  }
  const pages = [...map.values()];
  if (!pages.length) throw new Error("No approved complete pages to publish.");
  const manifest: Manifest = {
    revision: randomUUID(),
    digest: datasetDigest(pages),
    pages: pages.map((p) => ({
      id: p.id,
      hash: p.hash,
      tab: "page_" + p.id.replaceAll("-", ""),
    })),
  };
  must(
    await db.from("publications").insert({
      revision: manifest.revision,
      digest: manifest.digest,
      manifest,
    }),
  );
  const metadata = await google("?fields=sheets.properties");
  const tabs = new Set(
    (metadata.sheets ?? []).map(
      (s: { properties: { title: string } }) => s.properties.title,
    ),
  );
  if (!state.revision && tabs.has("_manifest")) {
    const current = await readRange("'_manifest'!A1:B2");
    if (current.some((row) => row.some(Boolean)))
      throw new Error(
        "Existing spreadsheet manifest needs recovery before publication.",
      );
  }
  const needed = ["_manifest", ...manifest.pages.map((p) => p.tab)].filter(
    (t) => !tabs.has(t),
  );
  if (needed.length)
    await google(":batchUpdate", "POST", {
      requests: needed.map((title) => ({
        addSheet: { properties: { title } },
      })),
    });
  const priorRows = await readRanges(
    manifest.pages.map((entry) => `'${entry.tab}'!A1:H20000`),
  );
  const staged = pages.map((p, index) => {
    const tab = manifest.pages[index].tab;
    const pieces = p.content.match(/[\s\S]{1,20000}/g) ?? [""];
    if (priorRows[index].length + pieces.length >= 20000)
      throw new Error(
        "Sheet row cap reached; archive old revisions before publishing.",
      );
    return {
      range: `'${tab}'!A${priorRows[index].length + 1}:H${priorRows[index].length + pieces.length}`,
      values: pieces.map((text, i) => [
        manifest.revision,
        p.id,
        p.title,
        p.url,
        p.hash,
        text,
        i,
        new Date().toISOString(),
      ]),
    };
  });
  await google("/values:batchUpdate", "POST", {
    valueInputOption: "RAW",
    data: staged,
  });
  // Read staged data back before publishing the active pointer.
  await readRevision(manifest);
  if (state.revision) {
    const before = await readManifest();
    if (before.revision !== state.revision || before.digest !== state.digest)
      throw new Error("Concurrent spreadsheet edit detected.");
  }
  await google("/values:batchUpdate", "POST", {
    valueInputOption: "RAW",
    data: [
      {
        range: "'_manifest'!A1:B2",
        values: [
          ["foodi_revision_v1", "active revision"],
          ["manifest", JSON.stringify(manifest)],
        ],
      },
    ],
  });
  const observed = await readManifest();
  if (JSON.stringify(observed) !== JSON.stringify(manifest))
    throw new Error("Publication commit not verified.");
  const imported = await readRevision(observed);
  const final = await readManifest();
  if (JSON.stringify(final) !== JSON.stringify(observed))
    throw new Error("Revision changed during import.");
  // Serving content is the exact read-back Sheet content, never an unverified candidate.
  must(
    await db.rpc("activate_dataset", {
      p_revision: observed.revision,
      p_digest: observed.digest,
      p_pages: imported,
    }),
  );
  return { published: imported.length };
}
