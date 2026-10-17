// Fails when a feature imports another feature (README, Layout): what two
// features share belongs in src/lib or src/components.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = "src/features";
const problems = [];
for (const feature of readdirSync(root)) {
  for (const file of readdirSync(join(root, feature), { recursive: true })) {
    if (!/\.tsx?$/.test(file)) continue;
    const path = join(root, feature, file);
    readFileSync(path, "utf8")
      .split("\n")
      .forEach((line, i) => {
        const match = line.match(/["']@\/features\/([^/"']+)/);
        if (match && match[1] !== feature) {
          problems.push(`${path}:${i + 1}: imports the ${match[1]} feature`);
        }
      });
  }
}
if (problems.length > 0) {
  process.stderr.write(`${problems.join("\n")}\nA feature never imports another feature: move what they share to src/lib or src/components.\n`);
  process.exit(1);
}
