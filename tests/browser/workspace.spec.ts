import { test, expect } from "@playwright/test";
test("employee preview, example evidence, editing, options and missing-setup state", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Ask a quiz question" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Try a training example" }).click();
  await expect(
    page.getByText("SYNTHETIC EXAMPLE · NOT FOODI POLICY"),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Supporting evidence" }),
  ).toBeVisible();
  await page
    .getByRole("textbox", { name: "Option A", exact: true })
    .fill("A changed option");
  await expect(
    page.getByRole("heading", { name: "Supporting evidence" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Add option", exact: true }).click();
  await expect(
    page.getByRole("textbox", { name: "Option E", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Remove option E", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Find the answer", exact: true })
    .click();
  await expect(page.locator(".error-message[role=alert]")).toContainText(
    "not connected",
  );
  await page.getByRole("button", { name: "Reset", exact: true }).click();
  await expect(
    page.getByRole("textbox", { name: "Quiz question Required" }),
  ).toHaveValue("");
  expect(errors).toEqual([]);
});
test("admin preview exposes models/schedule, rejects writes without setup, and navigates tabs", async ({
  page,
}) => {
  await page.goto("/admin");
  await expect(
    page.getByRole("combobox", { name: "Quiz answering model", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("textbox", { name: "Cron expression" })
    .fill("0 6 * * *");
  await page.getByRole("button", { name: "Save settings" }).click();
  await expect(page.locator(".error-message[role=alert]")).toContainText(
    "Connect a Supabase project",
  );
  await page.getByRole("tab", { name: "Review queue (0)" }).click();
  await expect(page.getByText("No sources waiting for review")).toBeVisible();
  await page.getByRole("tab", { name: "Crawl activity" }).click();
  await expect(page.getByText("No crawl activity yet")).toBeVisible();
  await page.getByRole("tab", { name: "Employees" }).click();
  await expect(
    page.getByRole("button", { name: "Create account" }),
  ).toBeVisible();
});
test("sensitive endpoints cannot run without authentication/configuration", async ({
  request,
}) => {
  for (const path of [
    "/api/quiz",
    "/api/admin/jobs",
    "/api/admin/reviews",
    "/api/admin/members",
    "/api/admin/sources",
  ]) {
    const result = await request.post(path, {
      data: {},
      headers: { origin: "http://127.0.0.1:3100" },
    });
    expect(result.status()).toBe(503);
    expect(await result.json()).toHaveProperty("error");
  }
  const result = await request.get("/api/admin/models");
  expect(result.status()).toBe(503);
});
test("mobile screens fit viewport and navigation is usable", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Try a training example" }).click();
  await expect(page.getByRole("button", { name: "Copy answer" })).toBeVisible();
  await page.getByRole("link", { name: "Knowledge base", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Knowledge base", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
test("crawler extraction preserves headings, Bangla, table relationships and exclusions", async ({
  page,
}) => {
  const { extractPage } = await import("../../worker/src/extract");
  await page.setContent(
    "<title>Synthetic policy</title><nav>Do not index navigation</nav><main><h1>Training rules</h1><p>সর্বোচ্চ <strong>৫০ টাকা</strong>, not 500.</p><table><tr><th>Condition</th><th>Action</th></tr><tr><td>Conflicting sources</td><td>Ask policy owner</td></tr></table><ul><li>Keep all exceptions.</li></ul><div hidden>Hidden false rule</div><script>dangerous()</script></main>",
  );
  const extracted = await extractPage(page);
  expect(extracted.content).toContain("Training rules");
  expect(extracted.content).toContain("সর্বোচ্চ ৫০ টাকা, not 500.");
  expect(extracted.content).toContain("Condition | Action |");
  expect(extracted.content).toContain(
    "Conflicting sources | Ask policy owner |",
  );
  expect(extracted.content).not.toContain("Do not index navigation");
  expect(extracted.content).not.toContain("Hidden false rule");
  expect(extracted.content).not.toContain("dangerous");
});
