const { chromium } = require("playwright");
const { execSync } = require("child_process");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function login() {
  const res = await fetch("http://localhost:4000/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      email: "guidance_counselor@zentra.test",
      password: "Zentra2025!",
      role: "staff",
    }),
  });
  return (await res.json()).accessToken;
}

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
      seen: Object.fromEntries(
        Object.keys(window.localStorage)
          .filter((k) => k.startsWith("zentra.guidance.nav.seen"))
          .map((k) => [k, Object.keys(JSON.parse(window.localStorage.getItem(k))).length]),
      ),
    };
  });
}

(async () => {
  const token = await login();
  const browser = await chromium.launch();
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const net = [];
  page.on("response", (r) => {
    if (r.url().includes("nav-counts")) net.push(`${r.status()} ${Date.now()}`);
  });

  await page.goto("http://localhost:3000/errors/404", { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.evaluate((t) => {
    window.localStorage.clear();
    window.localStorage.setItem("zentra.access", t);
  }, token);

  await page.goto("http://localhost:3000/guidance/interventions", { waitUntil: "domcontentloaded", timeout: 90000 });
  await sleep(4000);
  console.log("BEFORE", JSON.stringify(await readBadges(page)));

  const out = execSync("npx tsx scripts/tmp-bump-intervention.ts", {
    cwd: "C:/Users/Akiro/OneDrive/Desktop/Capstone/msat-zentra/backend",
    encoding: "utf8",
  });
  console.log("BUMP", out.trim());

  await sleep(20000);
  console.log("AFTER 20s (still on interventions)", JSON.stringify(await readBadges(page)));

  await page.goto("http://localhost:3000/guidance/overview", { waitUntil: "domcontentloaded", timeout: 90000 });
  await sleep(3000);
  console.log("AFTER nav to overview", JSON.stringify(await readBadges(page)));

  console.log("nav-counts responses", net.length);
  await browser.close();
})();
