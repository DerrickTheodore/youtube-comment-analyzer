import { execSync } from "child_process";
import glob from "fast-glob";

const INHERIT = "inherit";
let cmd = null;

try {
  const files = await glob([
    "src/**/*.{ts,js,html,wasm,png,jsx}",
    "manifest.json",
    "images/**/*.{png,jpg,jpeg,gif,svg}",
    // TODO: Uncomment the following lines to exclude test files
    //   "!**/*.test.*",
    //   "!**/__tests__/**",
  ]);

  cmd = `parcel build ${files.join(" ")} --dist-dir dist`;
  execSync(cmd, { stdio: INHERIT });
} catch (error) {
  console.error("Error during build:", error?.message ?? error);
  process.exit(1);
}
