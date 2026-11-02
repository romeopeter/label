/**
 * Regenerates src/data/emojis.json from emoji-api.com.
 *
 * The list is fetched here, at build time, so the API key in .env never ships
 * inside the app. Re-run only to pick up new emoji; the output is committed.
 */
import { readFileSync, writeFileSync } from "node:fs";

const OUTPUT = new URL("../src/data/emojis.json", import.meta.url);
// Skin tone and hair swatches: only meaningful when combined with another emoji.
const SKIPPED_GROUPS = new Set(["component"]);

const readApiKey = () => {
  const env = readFileSync(new URL("../.env", import.meta.url), "utf8");
  const match = env.match(/^FREE_EMOJI_KEY\s*=\s*(\S+)\s*$/m);
  if (!match) throw new Error("FREE_EMOJI_KEY is missing from .env");
  return match[1].replace(/^["']|["']$/g, "");
};

const response = await fetch(
  `https://emoji-api.com/emojis?access_key=${readApiKey()}`,
);
if (!response.ok) throw new Error(`emoji-api.com returned ${response.status}`);

const entries = await response.json();
if (!Array.isArray(entries)) throw new Error("Unexpected emoji-api.com response");

const emojis = entries
  .filter((entry) => !SKIPPED_GROUPS.has(entry.group))
  .map((entry) => ({
    char: entry.character,
    // "E1.0 grinning face" → "grinning face"
    name: entry.unicodeName.replace(/^E\d+(\.\d+)?\s+/, ""),
    group: entry.group,
  }));

writeFileSync(OUTPUT, `${JSON.stringify(emojis)}\n`);
console.log(`Wrote ${emojis.length} emoji`);
