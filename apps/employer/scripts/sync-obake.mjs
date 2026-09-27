// Copies the obake illustrations used by the employer app from the marketing
// page, so the images live in one place. Runs before `next dev` and `next build`.
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const source = join(root, "..", "marketing", "img", "rares");
const target = join(root, "public", "obake");

const obake = [
  "amagasa",
  "asatsuyu",
  "hajimete",
  "hatsukoe",
  "hirunen",
  "kazaguruma",
  "kazoeuta",
  "kirari",
  "mitsuboshi",
  "morattan",
  "nakayoshi",
  "nemurin",
  "okurimono",
  "sakura",
  "senpai",
  "teamwork",
  "totonou",
];

mkdirSync(target, { recursive: true });
for (const name of obake) {
  const from = join(source, `${name}.webp`);
  if (!existsSync(from)) {
    console.warn(`sync-obake: ${from} is missing; the app will show a blank where ${name} would be`);
    continue;
  }
  copyFileSync(from, join(target, `${name}.webp`));
}
