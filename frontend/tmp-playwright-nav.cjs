const { chromium } = require("playwright");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function readBadges(page) {
  return page.evaluate(() => {
    const out = {};
    document.querySelectorAll("aside > ul > li > a").forEach((a) => {
      const href = a.getAttribute("href");
      const b = a.querySelector("span");
      out[href] = b ? b.textContent : null;
    });
    return out;
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
  const page = await (await browser.newContext()).newPage();
  page.on("pageerror", (e) => console.log("[pageerror]", e.message));

  await page.goto("http://localhost:3000/errors/404", { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.evaluate((t) => {
    window.localStorage.clear();
    window.localStorage.setItem("zentra.access", t);
  }, login.accessToken);

  for (const path of ["/guidance/settings", "/guidance/overview", "/guidance/interventions", "/guidance/settings"]) {
    await page.goto("http://localhost:3000" + path, { waitUntil: "domcontentloaded", timeout: 90000 });
    await sleep(8000);
    console.log(path, JSON.stringify(await readBadges(page)), "seen:", Object.keys(await page.evaluate(() => window.localStorage)).filter((k) => k.startsWith("zentra.guidance.nav.seen")).join(","));
  }

  await browser.close();
})();
