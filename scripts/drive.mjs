// Step-by-step driver: keeps one headed Chrome session open and executes one command at a
// time from a JSON command file, so each step can be inspected before the next.
// Usage: node scripts/drive.mjs <cmd-dir>
// Write <cmd-dir>/cmd.json = {"id": n, "op": ..., ...}; result lands in <cmd-dir>/res-<n>.json.
// Ops: goto{path} click{text,nth?,exact?} clickSel{sel,nth?} fill{sel,text} wait{ms} dump{label} quit
import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { redactStr, redactUrl, scrubEntry } from "./redact.mjs";

const CMD_DIR = process.argv[2];
const OUT_NET = "notes/network";
const OUT_SHOTS = "notes/screenshots";
for (const d of [CMD_DIR, OUT_NET, OUT_SHOTS]) fs.mkdirSync(d, { recursive: true });

// Purchases are allowed in this driver; auto-renew mutations and profile/settings writes are not.
const BLOCK = /ride-pack-autorenew\/(pause|resume|cancel|change-plan|change-date)|update-user|preference|profile\/update|add-saved-place/i;

const browser = await chromium.launch({ channel: "chrome", headless: false, slowMo: 100 });
const context = await browser.newContext({
  storageState: "auth.json",
  baseURL: "https://app.cityflostaging.com",
  viewport: { width: 1280, height: 900 },
  timezoneId: "Asia/Kolkata",
  locale: "en-IN",
});
const page = await context.newPage();
context.on("page", (p) => console.log("new page opened:", redactUrl(p.url())));

let current = "start";
const log = {};
const blocked = [];

await context.route("**/*", (route) => {
  const req = route.request();
  if (req.method() !== "GET" && BLOCK.test(new URL(req.url()).pathname)) {
    blocked.push({ step: current, method: req.method(), url: redactUrl(req.url()) });
    return route.abort();
  }
  return route.continue();
});

context.on("response", async (res) => {
  const req = res.request();
  if (!["xhr", "fetch", "document"].includes(req.resourceType())) return;
  const entry = { type: req.resourceType(), method: req.method(), url: req.url(), status: res.status() };
  const body = req.postData();
  if (body) {
    try { entry.requestJson = JSON.parse(body); } catch { entry.requestBody = "[non-JSON body omitted]"; }
  }
  try {
    const ct = res.headers()["content-type"] || "";
    if (ct.includes("json")) entry.responseJson = await res.json();
  } catch { entry.responseJson = "[unreadable]"; }
  (log[current] ||= []).push(scrubEntry(entry));
});

function flush() {
  for (const [label, entries] of Object.entries(log)) {
    fs.writeFileSync(path.join(OUT_NET, `purchase-${label}.json`), JSON.stringify(entries, null, 2));
  }
  fs.writeFileSync(path.join(OUT_NET, "purchase-_blocked.json"), JSON.stringify(blocked, null, 2));
}

const authUser = (() => {
  try {
    const ls = JSON.parse(fs.readFileSync("auth.json", "utf8")).origins[0].localStorage;
    return JSON.parse(ls.find((x) => x.name === "cityflo-auth").value).state.user;
  } catch { return null; }
})();
function masks(p) {
  if (!authUser) return [];
  const { first_name: f = "", last_name: l = "", mobile_number: m = "" } = authUser;
  return [`${f} ${l}`.trim(), f, l, m, m.slice(-10)].filter((t) => t && t.length >= 3).map((t) => p.getByText(t, { exact: false }));
}

async function dump(label) {
  const pages = context.pages();
  const p = pages[pages.length - 1];
  const frames = [];
  for (const f of p.frames()) {
    try {
      const t = await f.evaluate(() => document.body?.innerText?.slice(0, 5000) || "");
      const controls = await f.evaluate(() =>
        [...document.querySelectorAll("a, button, [role=button], [role=checkbox], [role=switch], input, select, label")]
          .filter((el) => el.offsetWidth || el.offsetHeight)
          .map((el) => ({
            tag: el.tagName.toLowerCase(),
            type: el.getAttribute("type") || el.getAttribute("role") || undefined,
            checked: el.checked ?? el.getAttribute("aria-checked") ?? undefined,
            text: (el.innerText || el.getAttribute("aria-label") || el.placeholder || el.name || "").trim().slice(0, 100),
          })),
      );
      frames.push({ url: redactUrl(f.url()), text: redactStr(t), controls });
    } catch {}
  }
  await p.screenshot({ path: path.join(OUT_SHOTS, `purchase-${label}.png`), fullPage: true, mask: masks(p) }).catch(() => {});
  return { pageCount: pages.length, url: redactUrl(p.url()), frames };
}

let lastId = -1;
while (true) {
  await new Promise((r) => setTimeout(r, 400));
  let cmd;
  try { cmd = JSON.parse(fs.readFileSync(path.join(CMD_DIR, "cmd.json"), "utf8")); } catch { continue; }
  if (cmd.id === lastId) continue;
  lastId = cmd.id;
  if (cmd.label) current = cmd.label;
  const pages = context.pages();
  const p = pages[pages.length - 1];
  const res = { id: cmd.id, op: cmd.op, ok: true };
  try {
    if (cmd.op === "goto") await p.goto(cmd.path, { waitUntil: "domcontentloaded" });
    else if (cmd.op === "click") await p.getByText(cmd.text, { exact: cmd.exact !== false }).nth(cmd.nth || 0).click({ timeout: 15000 });
    else if (cmd.op === "clickSel") await p.locator(cmd.sel).nth(cmd.nth || 0).click({ timeout: 15000 });
    else if (cmd.op === "fill") await p.locator(cmd.sel).first().fill(cmd.text, { timeout: 15000 });
    else if (cmd.op === "wait") await p.waitForTimeout(cmd.ms);
    if (cmd.op !== "wait" && cmd.op !== "quit") {
      await p.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {});
      await p.waitForTimeout(cmd.settle ?? 2000);
    }
  } catch (e) { res.ok = false; res.error = e.message.split("\n")[0]; }
  if (cmd.op === "quit") { flush(); fs.writeFileSync(path.join(CMD_DIR, `res-${cmd.id}.json`), JSON.stringify(res)); break; }
  Object.assign(res, await dump(cmd.label || `step-${cmd.id}`));
  flush();
  fs.writeFileSync(path.join(CMD_DIR, `res-${cmd.id}.json`), JSON.stringify(res, null, 2));
}
await browser.close();
