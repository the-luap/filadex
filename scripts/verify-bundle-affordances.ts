import fs from "node:fs";
import path from "node:path";

const assetsDir = path.resolve("dist/public/assets");

if (!fs.existsSync(assetsDir)) {
  console.error(`ERROR: Client assets directory not found at ${assetsDir}. Run \`npm run build\` first.`);
  process.exit(1);
}

const jsFiles = fs
  .readdirSync(assetsDir)
  .filter((f) => f.endsWith(".js"))
  .map((f) => path.join(assetsDir, f));

if (jsFiles.length === 0) {
  console.error(`ERROR: No compiled JS files found in ${assetsDir}.`);
  process.exit(1);
}

const leakedKeywords = ["filadex:scan", "E2EScanAffordance"];
let hasLeak = false;

for (const filePath of jsFiles) {
  const content = fs.readFileSync(filePath, "utf-8");
  for (const keyword of leakedKeywords) {
    if (content.includes(keyword)) {
      console.error(`LEAK: Found test affordance keyword "${keyword}" in ${path.relative(process.cwd(), filePath)}`);
      hasLeak = true;
    }
  }
}

if (hasLeak) {
  console.error("FAIL: Standard production build contains test affordances that should have been dead-code eliminated.");
  process.exit(1);
}

console.log("PASS: Standard production bundle is clean (zero test affordances detected).");
