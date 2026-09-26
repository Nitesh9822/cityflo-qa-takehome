// Redaction rules for recorded network traffic. Used by explore.mjs and for re-scrubbing
// existing files: node scripts/redact.mjs notes/network/*.json
import fs from "node:fs";

const SECRET_KEY = /token|secret|password|otp|phone|mobile|msisdn|email|first_?name|last_?name|full_?name|user_?id|customer_?id|customer_?pk|api_?key|distinct_id|anonymous_id|address|dob|device|authorization|cookie|lat$|lng$|latitude|longitude|picture|google/i;

// The logged-in user's own identifiers, removed wherever they appear (e.g. inside order ids).
const NEEDLES = (() => {
  try {
    const ls = JSON.parse(fs.readFileSync("auth.json", "utf8")).origins[0].localStorage;
    const s = JSON.parse(ls.find((x) => x.name === "cityflo-auth").value).state;
    const u = s.user || {};
    return [u.first_name, u.last_name, u.mobile_number, u.email, s.userId && String(s.userId)]
      .filter((x) => x && String(x).length >= 4)
      .map((x) => String(x));
  } catch { return []; }
})();
// "name" is only personal inside user-like objects; route/stop names stay readable.
const PERSON_PARENT = /user|profile|customer|account|rider|passenger|referr|properties|traits/i;
// Analytics beacons carry user identity in free-form properties; keep only that they happened.
export const ANALYTICS_HOST = /ts-ingest\.cityflo\.net/;

export function redactStr(s) {
  for (const n of NEEDLES) s = s.split(n).join("[ME]");
  return s
    .replace(/eyJ[\w-]+\.[\w-]+\.[\w-]+/g, "[JWT]")
    .replace(/(\+?91[\s-]?)?\b[6-9]\d{9}\b/g, "[PHONE]")
    .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, "[EMAIL]");
}

export function redact(v, key = "", parent = "") {
  const personalName = key === "name" && PERSON_PARENT.test(parent);
  if (key && (SECRET_KEY.test(key) || personalName) && v !== null && typeof v !== "boolean") return "[REDACTED]";
  if (Array.isArray(v)) return v.map((x) => redact(x, "", key || parent));
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, redact(x, k, key || parent)]));
  if (typeof v === "string") return redactStr(v);
  if (typeof v === "number" && NEEDLES.includes(String(v))) return "[ME]";
  return v;
}

export function redactUrl(u) {
  const url = new URL(u);
  for (const k of [...url.searchParams.keys()]) if (SECRET_KEY.test(k)) url.searchParams.set(k, "[REDACTED]");
  return redactStr(url.toString());
}

export function scrubEntry(e) {
  const out = { ...e, url: redactUrl(e.url) };
  if (ANALYTICS_HOST.test(e.url)) {
    if ("requestJson" in out) out.requestJson = "[analytics payload omitted]";
    if (out.responseJson && typeof out.responseJson === "object") out.responseJson = "[analytics response omitted]";
  } else {
    if ("requestJson" in out) out.requestJson = redact(out.requestJson);
    if ("responseJson" in out) out.responseJson = redact(out.responseJson);
  }
  return out;
}

if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, "/")}`) {
  for (const f of process.argv.slice(2)) {
    const entries = JSON.parse(fs.readFileSync(f, "utf8"));
    if (!Array.isArray(entries)) continue;
    fs.writeFileSync(f, JSON.stringify(entries.map(scrubEntry), null, 2));
    console.log("scrubbed", f);
  }
}
