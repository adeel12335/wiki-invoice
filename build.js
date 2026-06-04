/**
 * build.js — Vercel build script for WikiStudi Invoice Portal
 * Copies all static files into /dist and injects Supabase credentials.
 */

const fs   = require("fs");
const path = require("path");

const DIST = path.join(__dirname, "dist");

// Files/folders to copy into dist
const STATIC_FILES = [
  "index.html",
  "app.js",
  "styles.css",
];

// ── Create dist dir ────────────────────────────────────────────────────────
if (fs.existsSync(DIST)) fs.rmSync(DIST, { recursive: true });
fs.mkdirSync(DIST);

// ── Copy static files ──────────────────────────────────────────────────────
STATIC_FILES.forEach((file) => {
  const src  = path.join(__dirname, file);
  const dest = path.join(DIST, file);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
    console.log(`Copied ${file}`);
  }
});

// ── Generate supabase-config.js with injected env vars ────────────────────
const url = process.env.SUPABASE_URL     || "";
const key = process.env.SUPABASE_ANON_KEY || "";

if (!url || !key) {
  console.warn("⚠  SUPABASE_URL or SUPABASE_ANON_KEY is not set — app will not connect to DB.");
}

const config = `window.SUPABASE_URL="${url}";window.SUPABASE_ANON_KEY="${key}";`;
fs.writeFileSync(path.join(DIST, "supabase-config.js"), config);
console.log("supabase-config.js generated ✓");

console.log("Build complete — dist/ ready.");
