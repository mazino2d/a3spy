/**
 * Pushes telegram/profile.json (and optionally telegram/avatar.jpg) to the Bot API.
 * Idempotent for text fields: each is read back first and only written when it differs,
 * because setMyName/setMyDescription are rate-limited.
 *
 *   TELEGRAM_BOT_TOKEN=... node scripts/sync-telegram-profile.ts [--avatar] [--dry-run]
 */
import { readFile } from "node:fs/promises";
import { loadProfile } from "../src/telegram-profile.ts";

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) throw new Error("TELEGRAM_BOT_TOKEN is not set");
const api = `https://api.telegram.org/bot${token}`;

async function call<T>(method: string, body?: Record<string, unknown> | FormData): Promise<T> {
  const init: RequestInit =
    body instanceof FormData
      ? { method: "POST", body }
      : { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body ?? {}) };
  const res = await fetch(`${api}/${method}`, init);
  const json = (await res.json()) as { ok: boolean; result: T; description?: string };
  if (!json.ok) throw new Error(`${method}: ${json.description ?? res.status}`);
  return json.result;
}

const profile = loadProfile(JSON.parse(await readFile(new URL("../telegram/profile.json", import.meta.url), "utf8")));

const dryRun = process.argv.includes("--dry-run");

async function sync(label: string, current: string, wanted: string, set: () => Promise<unknown>) {
  if (current === wanted) return console.log(`= ${label} unchanged`);
  if (dryRun) return console.log(`~ ${label} would change`);
  await set();
  console.log(`✓ ${label} updated`);
}

const { name } = await call<{ name: string }>("getMyName");
await sync("name", name, profile.name, () => call("setMyName", { name: profile.name }));

const { short_description } = await call<{ short_description: string }>("getMyShortDescription");
await sync("short description", short_description, profile.short_description, () =>
  call("setMyShortDescription", { short_description: profile.short_description }),
);

const { description } = await call<{ description: string }>("getMyDescription");
await sync("description", description, profile.description, () =>
  call("setMyDescription", { description: profile.description }),
);

const commands = await call<{ command: string; description: string }[]>("getMyCommands");
await sync("commands", JSON.stringify(commands), JSON.stringify(profile.commands), () =>
  call("setMyCommands", { commands: profile.commands }),
);

const { type: menu } = await call<{ type: string }>("getChatMenuButton");
await sync("menu button", menu, "commands", () => call("setChatMenuButton", { menu_button: { type: "commands" } }));

if (process.argv.includes("--avatar") && dryRun) {
  console.log("~ profile photo would be uploaded");
} else if (process.argv.includes("--avatar")) {
  const form = new FormData();
  const photo = await readFile(new URL("../telegram/avatar.jpg", import.meta.url));
  form.append("photo", JSON.stringify({ type: "static", photo: "attach://avatar" }));
  form.append("avatar", new Blob([photo], { type: "image/jpeg" }), "avatar.jpg");
  await call("setMyProfilePhoto", form);
  console.log("✓ profile photo uploaded");
}
