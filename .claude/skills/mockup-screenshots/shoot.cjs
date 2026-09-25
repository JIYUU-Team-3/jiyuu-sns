// Screenshots design/mockup/index.html across pages × devices × themes.
// Run: NODE_PATH=~/.cache/jiyuu-shots/node_modules node .claude/skills/mockup-screenshots/shoot.cjs [page-filter]
const path = require("path");
const fs = require("fs");
const { chromium } = require("playwright");

const ROOT = path.resolve(__dirname, "../../..");
const MOCKUP = path.join(ROOT, "design/mockup/index.html");
const OUT = path.join(ROOT, "design/mockup/screenshots");

// [file name, hash route]
const PAGES = [
  ["auth", "auth"],
  ["home", "home"],
  ["explore", "explore"],
  ["notifications", "notifications"],
  ["profile", "profile/mikatanaka"],
  ["post", "post/p2"],
  ["messages", "messages"],
];
const DEVICES = {
  desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
  mobile: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
};
const THEMES = ["light", "dark"];

function pageUrl(route, theme) {
  return `file://${MOCKUP}?theme=${theme}#/${route}`;
}

async function waitForImages(page) {
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForFunction(() => [...document.images]
    .filter(i => i.getBoundingClientRect().top < innerHeight && i.style.visibility !== "hidden")
    .every(i => i.complete), null, { timeout: 15000 }).catch(() => console.warn("  images timed out"));
  await page.waitForTimeout(400);
}

async function shoot(browser, device, theme, pages) {
  const ctx = await browser.newContext({ ...DEVICES[device], colorScheme: theme, reducedMotion: "reduce" });
  const page = await ctx.newPage();
  for (const [name, route] of pages) {
    await page.goto(pageUrl(route, theme));
    await waitForImages(page);
    const file = path.join(OUT, `${name}-${device}-${theme}.png`);
    await page.screenshot({ path: file });
    console.log("saved", path.relative(ROOT, file));
  }
  await ctx.close();
}

(async () => {
  const filter = process.argv[2];
  const pages = filter ? PAGES.filter(([n]) => n === filter) : PAGES;
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  for (const device of Object.keys(DEVICES))
    for (const theme of THEMES) await shoot(browser, device, theme, pages);
  await browser.close();
})();
