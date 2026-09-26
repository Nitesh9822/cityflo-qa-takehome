import fs from "node:fs";

// Fail the whole run up front when the saved session's access token has expired,
// instead of letting every test bounce to /login.
export default function globalSetup() {
  const state = JSON.parse(fs.readFileSync("auth.json", "utf8"));
  const raw = state.origins?.[0]?.localStorage?.find((x: { name: string }) => x.name === "auth_token")?.value;
  if (!raw) throw new Error("session expired, run npm run auth (no auth_token in auth.json)");
  const payload = JSON.parse(Buffer.from(raw.replace(/"/g, "").split(".")[1], "base64url").toString());
  if (payload.exp * 1000 <= Date.now()) {
    throw new Error(`session expired, run npm run auth (auth_token exp ${new Date(payload.exp * 1000).toISOString()})`);
  }
}
