// Copies the OCForm-01 template artwork (DepEd + MSAT logos) next to the
// compiled anecdotal module so `ocform01.service` can embed them at runtime
// via `new URL('./assets/...', import.meta.url)` in both dev (tsx) and
// prod (node dist/). Run as part of `npm run build`. No dependencies.
import { cp, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(
  path.dirname(fileURLToPath(import.meta.url))
); // backend/
const src = path.join(root, "src", "modules", "anecdotal", "assets");
const dest = path.join(root, "dist", "modules", "anecdotal", "assets");

await mkdir(dest, { recursive: true });
for (const file of ["deped-logo.png", "msat-logo.png"]) {
  await cp(path.join(src, file), path.join(dest, file));
  console.log(`[copy-anecdotal-assets] ${file} -> dist/modules/anecdotal/assets/`);
}
