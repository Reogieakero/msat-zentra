const { chromium } = require("playwright");
const { execSync } = require("child_process");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function readBadges(page) {
  return page.evaluate(() => {
    const out = {};
    document.querySelectorAll("aside a").forEach((a) => {
      const href = a.getAttribute("href");
      const b = a.querySelector("span");
      out[href] = b ? b.textContent : null;
    });
    return {
      badges: out,
      seen: Object.keys(window.localStorage)
        .filter((k) => k.startsWith("zentra.guidance.nav.seen"))
        .map((k) => k),
    };
  });
}

(async () => {
  const login = await (
    await fetch("http://localhost:4000/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "guidance_counselor@zentra.test",
        password: "Zentra2025!",
        role: "staff",
      }),
    })
  ).json();

  const browser = await chromium.launch();
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.log("[pageerror]", e.message));

  await page.goto("http://localhost:3000/errors/404", {
    waitUntil: "domcontentloaded",
    timeout: 90000,
  });
  await page.evaluate((t) => {
    window.localStorage.clear();
    window.localStorage.setItem("zentra.access", t);
  }, login.accessToken);

  await page.goto("http://localhost:3000/guidance/alerts", {
    waitUntil: "domcontentloaded",
    timeout: 90000,
  });
  await sleep(6000);
  console.log("BEFORE", JSON.stringify(await readBadges(page)));

  const out = execSync("npx tsx scripts/tmp-referral-badge.ts create-referral", {
    cwd: "C:/Users/Akiro/OneDrive/Desktop/Capstone/msat-zentra/backend",
    encoding: "utf8",
  });
  console.log("NEW REFERRAL", out.trim());

  await sleep(20000);
  console.log("AFTER 20s (on alerts)", JSON.stringify(await readBadges(page)));

  await page.reload({ waitUntil: "domcontentloaded" });
  await sleep(6000);
  console.log("AFTER reload", JSON.stringify(await readBadges(page)));

  await browser.close();
})();
