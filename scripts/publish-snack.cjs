// Uploads the app to Expo Snack so it opens in Expo Go without a computer.
const fs = require("fs");
const path = require("path");
const { Snack } = require("snack-sdk");

const root = path.join(__dirname, "..");
const files = {};
function add(rel) {
  files[rel] = { type: "CODE", contents: fs.readFileSync(path.join(root, rel), "utf8") };
}
add("App.tsx");
(function walk(dir) {
  for (const f of fs.readdirSync(path.join(root, dir))) {
    const rel = path.join(dir, f);
    if (fs.statSync(path.join(root, rel)).isDirectory()) walk(rel);
    else if (/\.tsx?$/.test(f) && !/\.test\./.test(f)) add(rel);
  }
})("src");

(async () => {
  const sdkVersion = process.env.SNACK_SDK || "57.0.0";
  const snack = new Snack({
    name: "Even Trade",
    description: "Trade fairness checker for Pokémon and Magic",
    sdkVersion,
    files,
    dependencies: {
      "@react-native-async-storage/async-storage": { version: "*" },
      "expo-status-bar": { version: "*" },
    },
  });
  const saved = await snack.saveAsync();
  const id = saved.id || saved.hashId;
  const web = saved.url || `https://snack.expo.dev/${id}`;
  console.log(JSON.stringify({ sdkVersion, id, web, expoGo: `exp://exp.host/@snack/${id}` }));
})().catch((e) => { console.error(e); process.exit(1); });
