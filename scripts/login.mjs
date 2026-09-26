// One-time manual login: opens Chrome on staging, waits for you to finish phone + OTP,
// then saves the authenticated session to auth.json. Never automates the OTP itself.
import { chromium } from "@playwright/test";

const URL = "https://app.cityflostaging.com";
const TIMEOUT_MS = 5 * 60_000;
const t = () => new Date().toLocaleTimeString("en-IN", { hour12: false });

const browser = await chromium.launch({ channel: "chrome", headless: false });
browser.on("disconnected", () => console.log(`[${t()}] browser disconnected`));
const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: "en-IN", timezoneId: "Asia/Kolkata" });

const watch = (p) => {
  p.on("close", () => console.log(`[${t()}] tab closed: ${p.url()}`));
  p.on("framenavigated", (f) => f === p.mainFrame() && console.log(`[${t()}] navigated: ${f.url()}`));
  p.on("pageerror", (e) => console.log(`[${t()}] page error: ${e.message}`));
};
context.on("page", (p) => { console.log(`[${t()}] new tab`); watch(p); });

const page = await context.newPage();
await page.goto(URL);
console.log("Log in with your phone number + OTP in the Chrome window (5 min limit). Do not close the window.");

// The app persists auth in localStorage["cityflo-auth"] as { state: { isAuthenticated, token, ... } }.
const isAuthed = (p) =>
  p.evaluate(() => {
    try {
      const s = JSON.parse(localStorage.getItem("cityflo-auth") || "{}").state;
      return Boolean(s && s.isAuthenticated && s.token);
    } catch {
      return false;
    }
  }).catch(() => false);

let saved = false;
const deadline = Date.now() + TIMEOUT_MS;
while (Date.now() < deadline && browser.isConnected()) {
  const pages = context.pages();
  if (pages.length === 0) { console.log(`[${t()}] all tabs closed`); break; }
  const authed = await Promise.all(pages.map(isAuthed));
  if (authed.some(Boolean)) {
    await new Promise((r) => setTimeout(r, 3000)); // let post-login writes land
    await context.storageState({ path: "auth.json" });
    saved = true;
    break;
  }
  await new Promise((r) => setTimeout(r, 1000));
}

if (saved) console.log(`[${t()}] Logged in. Session saved to auth.json.`);
else if (!browser.isConnected() || context.pages().length === 0) console.error(`[${t()}] Browser/tabs closed before login was detected; auth.json NOT updated.`);
else console.error(`[${t()}] No login detected within 5 minutes; auth.json NOT updated.`);
if (!saved) process.exitCode = 1;
await browser.close().catch(() => {});
