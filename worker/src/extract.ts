import type { Page } from "playwright";
/** Preserve block/table boundaries instead of flattening detached DOM text. */
export async function extractPage(page: Page) {
  await page
    .locator('[role="main"], main')
    .first()
    .waitFor({ state: "visible", timeout: 15000 });
  // Google Sites marks only its heading as role=main. The policy sections
  // are siblings inside the containing section's parent.
  return page.evaluate(() => {
    const main = document.querySelector('[role="main"],main')!;
    const root =
      location.hostname === "sites.google.com"
        ? (main.closest("section")?.parentElement ?? main)
        : main;
    const walker = {
      text(node: Node): string {
        if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? "";
        if (!(node instanceof HTMLElement)) return "";
        if (
          ["SCRIPT", "STYLE", "NAV", "FOOTER", "NOSCRIPT"].includes(
            node.tagName,
          ) ||
          node.getAttribute("role") === "navigation"
        )
          return "";
        if (
          node.hidden ||
          node.getAttribute("aria-hidden") === "true" ||
          getComputedStyle(node).display === "none"
        )
          return "";
        if (node.tagName === "BR") return "\n";
        const inner = Array.from(node.childNodes)
          .map((child) => walker.text(child))
          .join("");
        if (["TD", "TH"].includes(node.tagName)) return inner.trim() + " | ";
        if (node.tagName === "LI") return "\n• " + inner.trim() + "\n";
        if (
          [
            "P",
            "DIV",
            "SECTION",
            "ARTICLE",
            "H1",
            "H2",
            "H3",
            "H4",
            "H5",
            "H6",
            "TR",
            "TABLE",
            "UL",
            "OL",
            "BLOCKQUOTE",
          ].includes(node.tagName)
        )
          return "\n" + inner.trim() + "\n";
        return inner;
      },
    };
    const imageUrls = [
      ...new Set([
        ...Array.from(root.querySelectorAll("img")).map(
          (img) => img.currentSrc || img.src,
        ),
        ...Array.from(root.querySelectorAll("[style]")).flatMap((element) =>
          Array.from(
            getComputedStyle(element).backgroundImage.matchAll(
              /url\(["']?(https:[^"')]+)["']?\)/g,
            ),
          ).map((match) => match[1]),
        ),
      ]),
    ];
    return {
      title: document.title,
      content: walker.text(root),
      links: Array.from(document.querySelectorAll("a[href]")).map(
        (a) => (a as HTMLAnchorElement).href,
      ),
      embeds: root.querySelectorAll("iframe,object,embed").length,
      images: imageUrls.length,
      imageUrls,
      collapsed: root.querySelectorAll('[aria-expanded="false"]').length,
    };
  });
}
