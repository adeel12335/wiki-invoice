# Supabase Setup

This project is designed for a single admin first, while keeping `owner_id` on every business table so it can grow into multiple users later.

## 1. Required Environment

Use these values in the frontend later:

```env
SUPABASE_URL=https://ettnzcekagjwqixmjyfp.supabase.co
SUPABASE_ANON_KEY=your-anon-public-key
```

Do not expose the `service_role` key in frontend code.

## 2. Run Migration

Open Supabase:

1. Project dashboard
2. SQL Editor
3. New query
4. Delete any old query text
5. Paste `supabase/migrations/000_RESET_AND_CREATE_INVOICE_PORTAL.sql`
6. Run

This reset migration drops and recreates only this portal's public tables/views:

- `profiles`
- `companies`
- `clients`
- `invoices`
- `invoice_items`
- `payments`
- `invoice_summary`

Use it while the project is still new or test-only. Once real data exists, use incremental migrations instead.

If it runs successfully, you should see these tables in Table Editor:

- `profiles`
- `companies`
- `clients`
- `invoices`
- `invoice_items`
- `payments`

## 3. Auth

Enable Email/Password auth:

1. Authentication
2. Providers
3. Email
4. Enable Email provider

Create the single admin user:

1. Authentication
2. Users
3. Add user
4. Use the admin email/password you want for the portal

## 4. Tables

- `profiles`: one row per Supabase auth user
- `companies`: your company profile and invoice defaults
- `clients`: reusable client records
- `invoices`: invoice header, status, currency, totals and payment link
- `invoice_items`: line items and bullet details
- `payments`: payment history per invoice

## 5. Security

Row Level Security is enabled. Authenticated users can only access rows where:

```sql
owner_id = auth.uid()
```

For this first version, there is one admin user, so all business records belong to that admin.

## 6. Frontend Config

Copy the example file:

```text
supabase-config.example.js -> supabase-config.js
```

Then paste your anon public key:

```js
window.INVOICE_PORTAL_SUPABASE = {
  url: "https://ettnzcekagjwqixmjyfp.supabase.co",
  anonKey: "your-anon-public-key",
};
```

The anon key is public-client safe when RLS is enabled. Never put the `service_role` key here.
