import { chromium } from "playwright";
const out = process.argv[2] || "shot.png";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1180, height: 1000 }, deviceScaleFactor: 2 });
await page.goto("http://localhost:3939/", { waitUntil: "networkidle" });
await page.waitForTimeout(800);
await page.screenshot({ path: out, fullPage: true });
await browser.close();
console.log("saved", out);
