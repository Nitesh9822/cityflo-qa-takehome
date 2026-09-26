// Read-only exploration helper: opens headed Chrome with auth.json, visits a list of
// paths, screenshots each, and records API traffic (redacted) to notes/network/.
// Usage: node scripts/explore.mjs <label> <path> [<label> <path> ...]
// Safety: aborts any non-GET request whose URL looks like payment/order/renewal/settings.
import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { redactStr, redactUrl, scrubEntry } from "./redact.mjs";

const OUT_NET = "notes/network";
const OUT_SHOTS = "notes/screenshots";
const OUT_DUMP = process.env.DUMP_DIR || "notes/dumps";
for (const d of [OUT_NET, OUT_SHOTS, OUT_DUMP]) fs.mkdirSync(d, { recursive: true });

const BLOCK = /pay|order|purchase|checkout|renew|subscri|book|setting|preference|profile|consent|mandate|wallet|refund|cancel|address|favou?rite|save|update|toggle|seat|reserve/i;

const args = process.argv.slice(2);
const steps = [];
for (let i = 0; i < args.length; i += 2) steps.push({ label: args[i], path: args[i + 1] });

const browser = await chromium.launch({ channel: "chrome", headless: false, slowMo: 150 });
const context = await browser.newContext({
  storageState: "auth.json",
  baseURL: "https://app.cityflostaging.com",
  viewport: { width: 1280, height: 900 },
  timezoneId: "Asia/Kolkata",
  locale: "en-IN",
});
const page = await context.newPage();

let current = "boot";
const log = {};
const blocked = [];

await context.route("**/*", (route) => {
  const req = route.request();
  if (req.method() !== "GET" && req.method() !== "OPTIONS" && BLOCK.test(new URL(req.url()).pathname)) {
    blocked.push({ step: current, method: req.method(), url: redactUrl(req.url()) });
    return route.abort();
  }
  return route.continue();
});

// Optional: keep a copy of every script the page itself loads (no extra requests).
const JS_DIR = process.env.JS_DIR;
if (JS_DIR) fs.mkdirSync(JS_DIR, { recursive: true });

page.on("response", async (res) => {
  const req = res.request();
  if (JS_DIR && req.resourceType() === "script") {
    const u = new URL(req.url());
    const file = (u.host + u.pathname).replace(/[^\w.-]+/g, "_").slice(-150);
    res.body().then((b) => fs.writeFileSync(path.join(JS_DIR, file), b)).catch(() => {});
    return;
  }
  if (!["xhr", "fetch"].includes(req.resourceType())) return;
  const host = new URL(req.url()).host;
  const entry = { method: req.method(), url: req.url(), status: res.status(), host };
  let body = req.postData();
  if (body) {
    try { entry.requestJson = JSON.parse(body); } catch { entry.requestBody = "[non-JSON body omitted]"; }
  }
  try {
    const ct = res.headers()["content-type"] || "";
    if (ct.includes("json")) entry.responseJson = await res.json();
  } catch { entry.responseJson = "[unreadable]"; }
  (log[current] ||= []).push(scrubEntry(entry));
});

// Screenshot masks for the logged-in user's name, initials and phone number.
const authUser = (() => {
  try {
    const ls = JSON.parse(fs.readFileSync("auth.json", "utf8")).origins[0].localStorage;
    return JSON.parse(ls.find((x) => x.name === "cityflo-auth").value).state.user;
  } catch { return null; }
})();
function personalMasks() {
  if (!authUser) return [];
  const { first_name: f = "", last_name: l = "", mobile_number: m = "" } = authUser;
  const texts = [`${f} ${l}`.trim(), f, l, m, m.slice(-10), (f[0] || "") + (l[0] || "")].filter((t) => t && t.length >= 2);
  return texts.map((t) => page.getByText(t, { exact: false }));
}

async function dump(label) {
  const info = await page.evaluate(() => {
    const vis = (el) => !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
    const clickables = [...document.querySelectorAll("a, button, [role=button], [role=tab], [role=option], input, select")]
      .filter(vis)
      .map((el) => ({ tag: el.tagName.toLowerCase(), text: (el.innerText || el.value || el.getAttribute("aria-label") || el.placeholder || "").trim().slice(0, 80), href: el.getAttribute("href") || undefined }));
    return { url: location.pathname + location.search, title: document.title, text: document.body.innerText.slice(0, 6000), clickables };
  });
  info.text = redactStr(info.text);
  // Non-personal app state keys, read live from the page.
  info.localStorage = await page.evaluate(() =>
    Object.fromEntries(["cityflo_active_product", "cityflo-pending-booking"].map((k) => [k, localStorage.getItem(k)])),
  );
  fs.writeFileSync(path.join(OUT_DUMP, `${label}.json`), JSON.stringify(info, null, 2));
  await page.screenshot({ path: path.join(OUT_SHOTS, `${label}.png`), fullPage: true, mask: personalMasks() });
  console.log(`[${label}] ${info.url} — ${info.clickables.length} clickables`);
}

for (const s of steps) {
  current = s.label;
  if (s.path.startsWith("click:")) {
    // Navigation-only click on an exact visible label, e.g. "click:Ride Pack".
    const name = s.path.slice(6);
    await page.getByText(name, { exact: true }).first().click().catch((e) => console.log("click error", e.message));
  } else if (s.path.startsWith("wait:")) {
    await page.waitForTimeout(Number(s.path.slice(5)));
  } else if (s.path.startsWith("clicknth:")) {
    // "clicknth:1:Proceed" clicks the second exact match (0-based).
    const [, n, ...rest] = s.path.split(":");
    await page.getByText(rest.join(":"), { exact: true }).nth(Number(n)).click().catch((e) => console.log("click error", e.message));
  } else if (s.path.startsWith("type:")) {
    // Types into the focused (or first visible) text input; used for location search only.
    const input = page.locator("input:focus, input[type=text]:visible, input[type=search]:visible, input:not([type]):visible").first();
    await input.fill(s.path.slice(5)).catch((e) => console.log("type error", e.message));
  } else {
    await page.goto(s.path, { waitUntil: "domcontentloaded" }).catch((e) => console.log("goto error", e.message));
  }
  await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1500);
  await dump(s.label);
}

for (const [label, entries] of Object.entries(log)) {
  fs.writeFileSync(path.join(OUT_NET, `${label}.json`), JSON.stringify(entries, null, 2));
}
if (blocked.length) fs.writeFileSync(path.join(OUT_NET, "_blocked.json"), JSON.stringify(blocked, null, 2));
console.log("blocked requests:", blocked.length);
await page.waitForTimeout(2000);
await browser.close();
