// Renders the CV HTML sources to PDF.
// Usage (from repo root): node design/cv/build.mjs
import { chromium } from "playwright";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");

const targets = [
  ["cv-en.html", "cv.pdf"],
  ["cv-fr.html", "cv-fr.pdf"],
];

const browser = await chromium.launch();
const page = await browser.newPage();
for (const [src, out] of targets) {
  await page.goto(pathToFileURL(path.join(here, src)).href, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  await page.pdf({ path: path.join(root, out), format: "A4", printBackground: true, preferCSSPageSize: true });
  console.log(`${src} -> ${out}`);
}
await browser.close();
