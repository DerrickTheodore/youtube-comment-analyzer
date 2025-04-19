import { execSync } from "child_process";
import glob from "fast-glob";

const INHERIT = "inherit";

glob([
  "src/**/*.{ts,js,html,wasm,png,jsx}",
  "manifest.json",
  "images/**/*.{png,jpg,jpeg,gif,svg}",
  // TODO: Uncomment the following lines to exclude test files
  //   "!**/*.test.*",
  //   "!**/__tests__/**",
])
  .then((files) => {
    execSync(`parcel build ${files.join(" ")} --dist-dir dist`, {
      stdio: INHERIT,
    });
  })
  .catch((error) => {
    console.error("Error during build:", error?.message ?? error);
    process.exit(1);
  });
