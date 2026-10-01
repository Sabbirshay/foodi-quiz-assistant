import test from "node:test";
import assert from "node:assert/strict";
import { chromium } from "@playwright/test";
import { extractPage } from "../worker/src/extract";
// Opt-in browser test uses tsx (the real worker runtime), not Playwright's
// different transformer, to catch serialization helpers in page.evaluate.
test(
  "worker runtime extracts all Google Sites sections",
  { skip: !process.env.CHROME_PATH },
  async () => {
    const browser = await chromium.launch({
      executablePath: process.env.CHROME_PATH,
    });
    try {
      const page = await browser.newPage();
      await page.route("https://sites.google.com/**", (route) =>
        route.fulfill({
          contentType: "text/html; charset=utf-8",
          body: '<nav>Do not index navigation</nav><div><section><div role="main">Refund</div></section><section><p>Upay partial refund - After 24 hours</p><p>সর্বোচ্চ ৫০ টাকা</p><table><tr><td>Bank</td><td>3–5 days</td></tr></table><div hidden>Wrong policy</div></section></div><footer>Google Sites</footer>',
        }),
      );
      await page.goto(
        "https://sites.google.com/view/foodi-service-guidelines/test",
      );
      const result = await extractPage(page);
      assert.match(result.content, /After 24 hours/);
      assert.match(result.content, /সর্বোচ্চ ৫০ টাকা/);
      assert.match(result.content, /Bank \| 3–5 days \|/);
      assert.doesNotMatch(
        result.content,
        /Do not index|Wrong policy|Google Sites/,
      );
    } finally {
      await browser.close();
    }
  },
);
