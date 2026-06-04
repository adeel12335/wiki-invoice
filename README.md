# WikiStudi Invoice Portal

A clean, single-admin invoice management portal built with vanilla HTML/CSS/JS and Supabase.

---

## ⚙️ Setup (One-time, takes ~5 minutes)

### Step 1 — Run the Database Schema

1. Go to [Supabase Dashboard](https://supabase.com/dashboard/project/ettnzcekagjwqixmjyfp/sql/new)
2. Copy the entire contents of `supabase/migrations/000_full_clean_invoice_portal_schema.sql`
3. Paste into the SQL Editor and click **Run**

### Step 2 — Paste Your Anon Key

1. Go to [Supabase API Settings](https://supabase.com/dashboard/project/ettnzcekagjwqixmjyfp/settings/api)
2. Copy the **anon / public** key (the long `eyJ...` string)
3. Open `supabase-config.js` and replace `PASTE_YOUR_ANON_KEY_HERE` with it

### Step 3 — Create Your Admin User

1. Go to [Supabase Auth → Users](https://supabase.com/dashboard/project/ettnzcekagjwqixmjyfp/auth/users)
2. Click **Add user → Create new user**
3. Enter your email and a strong password
4. Use those credentials to log in to the portal

---

## 🚀 Deploy to Vercel (Free)

### Option A — GitHub + Vercel (Recommended)

1. Push this folder to a **private** GitHub repo:
   ```bash
   git init
   git add .
   git commit -m "initial"
   git remote add origin https://github.com/YOUR_USERNAME/invoice-portal.git
   git push -u origin main
   ```
   > **Note:** `supabase-config.js` is in `.gitignore` so your anon key won't be committed.

2. Go to [vercel.com](https://vercel.com) → **Add New Project** → Import your repo

3. In Vercel project settings → **Environment Variables**, add:
   - `SUPABASE_URL` = `https://ettnzcekagjwqixmjyfp.supabase.co`
   - `SUPABASE_ANON_KEY` = your anon key

4. Add a `supabase-config.js` that reads from those env vars — OR — for a simple static site, just create a new `supabase-config.js` in the Vercel dashboard via the **Override** feature.

   **Simplest approach:** In Vercel → Settings → Environment Variables, add the anon key, then create a build command that generates the config file:
   
   **Build Command:**
   ```bash
   echo "window.SUPABASE_URL='https://ettnzcekagjwqixmjyfp.supabase.co';window.SUPABASE_ANON_KEY='$SUPABASE_ANON_KEY';" > supabase-config.js
   ```
   **Output Directory:** `.` (root)

5. Deploy → Vercel gives you a free `*.vercel.app` URL ✓

### Option B — Drag & Drop Deploy

1. Open `supabase-config.js` and paste your real anon key
2. Go to [vercel.com/new](https://vercel.com/new)
3. Drag and drop the entire `invoice` folder
4. Done — gets a `*.vercel.app` URL instantly

---

## 📁 File Structure

```
invoice/
├── index.html            ← Full portal UI + invoice preview
├── app.js                ← All logic (Supabase auth + DB)
├── styles.css            ← All styles (portal + invoice PDF)
├── supabase-config.js    ← Your keys (gitignored)
├── vercel.json           ← Vercel routing config
├── .gitignore            ← Keeps keys out of git
└── supabase/
    └── migrations/
        └── 000_full_clean_invoice_portal_schema.sql
```

---

## 🔐 Security

- Row Level Security (RLS) is enabled on all tables — each user only sees their own data
- The anon key is safe to expose in a browser app — it cannot bypass RLS
- Auth is handled by Supabase (bcrypt passwords, JWT sessions)

---

## 📄 PDF Export

Click **Download PDF** in the invoice editor. The browser print dialog opens with an A4-optimised layout that exactly matches the original invoice design.
