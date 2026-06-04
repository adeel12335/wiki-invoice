const fs = require("fs");
const url = process.env.SUPABASE_URL || "";
const key = process.env.SUPABASE_ANON_KEY || "";
const content = `window.SUPABASE_URL="${url}";window.SUPABASE_ANON_KEY="${key}";`;
fs.writeFileSync("supabase-config.js", content);
console.log("supabase-config.js generated ✓");
