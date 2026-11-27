import { build } from "esbuild";
import { mkdir, copyFile, rm } from "node:fs/promises";
import { execFileSync } from "node:child_process";

await mkdir("dist", { recursive: true });
await build({entryPoints: ["src/main.cjs"], outfile: "dist/index.js", bundle: true,
  platform: "browser", format: "cjs", external: ["siyuan"], minify: true});
const files = ["icon.png", "index.css", "plugin.json", "README.md", "LICENSE"];
for (const file of files) await copyFile(file, "dist/" + file);
await copyFile("node_modules/pele/LICENSE", "dist/PELE-LICENSE");
await rm("package.zip", {force: true});
execFileSync("zip", ["-q", "../package.zip", "index.js", ...files, "PELE-LICENSE"], {cwd: "dist"});
