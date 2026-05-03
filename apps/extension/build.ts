#!/usr/bin/env bun
import plugin from "bun-plugin-tailwind";
import { existsSync } from "node:fs";
import { readFile, writeFile, rm } from "node:fs/promises";
import path from "node:path";

import { env } from "./src/env";

const outdir = path.join(process.cwd(), "dist");

if (existsSync(outdir)) {
  await rm(outdir, { recursive: true, force: true });
}

await Bun.build({
  entrypoints: [
    path.resolve("src/background.ts"),
    path.resolve("src/content.tsx"),
    path.resolve("src/page-bridge.ts"),
    path.resolve("src/popup.html")
  ],
  outdir,
  plugins: [plugin],
  minify: true,
  naming: "[name].[ext]",
  sourcemap: "linked",
  target: "browser",
  define: {
    "process.env.NODE_ENV": JSON.stringify("production"),
    "process.env.MEMSYNC_APP_URL": JSON.stringify(env.MEMSYNC_APP_URL)
  }
});

const manifestPath = path.resolve("src/manifest.json");
const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as {
  host_permissions?: string[];
};

const appUrl = env.MEMSYNC_APP_URL;
if (appUrl) {
  const normalized = `${appUrl.replace(/\/$/, "")}/*`;
  manifest.host_permissions = Array.from(new Set([...(manifest.host_permissions ?? []), normalized]));
}

await writeFile(path.join(outdir, "manifest.json"), JSON.stringify(manifest, null, 2));

console.log(`Built extension to ${outdir}`);
