import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { realpathSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "@playwright/test";
test(
  "original-image review loads private evidence and requires explicit confirmation",
  { skip: !process.env.CHROME_PATH },
  async () => {
    const require = createRequire(
      realpathSync("node_modules/tsx/package.json"),
    );
    const { build } = require("esbuild");
    const directory = mkdtempSync(join(tmpdir(), "foodi-vision-ui-"));
    const file = join(directory, "fixture.js");
    await build({
      stdin: {
        contents:
          'import React from "react"; import {createRoot} from "react-dom/client"; import {ImageReview} from "./src/components/image-review"; createRoot(document.getElementById("root")).render(<ImageReview id="fixture" hash="hash" onReviewed={value=>{window.reviewed=value}}/>);',
        loader: "tsx",
        resolveDir: process.cwd(),
      },
      bundle: true,
      platform: "browser",
      outfile: file,
    });
    const browser = await chromium.launch({
      executablePath: process.env.CHROME_PATH,
    });
    try {
      const page = await browser.newPage();
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.route("http://vision.test/**", (route) =>
        route.request().url().includes("/api/")
          ? route.fulfill({
              json: {
                hash: "hash",
                images: [
                  {
                    source_url: "https://lh3.googleusercontent.com/chart",
                    sha256: "sha",
                    data_url:
                      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jXioAAAAASUVORK5CYII=",
                    analysis: {
                      title: "Refund flow",
                      kind: "flowchart",
                      text: "Paid?",
                      nodes: [
                        { id: "A", text: "Paid?" },
                        { id: "B", text: "Refund" },
                      ],
                      edges: [{ from: "A", to: "B", condition: "Yes" }],
                    },
                  },
                ],
              },
            })
          : route.fulfill({
              contentType: "text/html",
              body: '<div id="root"></div>',
            }),
      );
      await page.goto("http://vision.test/");
      await page.addScriptTag({ path: file });
      await page
        .getByRole("button", { name: "Review original images" })
        .click();
      await page.getByRole("img", { name: /Original SOP image/ }).waitFor();
      assert.match(await page.locator("pre").innerText(), /A → B \[Yes\]/);
      assert.equal(await page.getByRole("checkbox").isChecked(), false);
      await page.getByRole("checkbox").check();
      assert.equal(
        await page.evaluate(
          () => (window as unknown as { reviewed: boolean }).reviewed,
        ),
        true,
      );
      assert.deepEqual(errors, []);
    } finally {
      await browser.close();
      rmSync(directory, { recursive: true, force: true });
    }
  },
);
