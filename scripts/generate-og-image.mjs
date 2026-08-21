import { chromium } from "playwright-core";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");

const template = readFileSync(path.join(root, "scripts/brand-src/og-template.html"), "utf-8");
const logoPng = readFileSync(path.join(root, "scripts/brand-src/logo-source.png"));
const logoDataUri = `data:image/png;base64,${logoPng.toString("base64")}`;
const html = template.replace("__LOGO_DATA_URI__", logoDataUri);

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.setContent(html);
await page.waitForTimeout(100);
const outPath = path.join(root, "public/og-image.png");
await page.screenshot({ path: outPath });
await browser.close();
console.log("wrote", outPath);
