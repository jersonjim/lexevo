# How to Rotate Supabase Credentials

Do this if credentials were ever exposed (committed to git, shared accidentally, etc.).

---

## Step 1 — Regenerate the anon key in Supabase

1. Go to [supabase.com](https://supabase.com) and open your project
2. Click **Settings** (gear icon in the left sidebar)
3. Click **API** in the settings menu
4. Under **Project API keys**, find the `anon` `public` key
5. Click the **Regenerate** button next to it
6. Confirm the action — the old key stops working immediately

> **Note:** The `service_role` key has full database access and bypasses RLS. Never expose it in client code. Only the `anon` key is used in this app.

---

## Step 2 — Update your local .env

Open `.env` and replace the old key:

```
EXPO_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-new-anon-key-here
```

---

## Step 3 — Restart the Expo dev server

The dev server needs to reload environment variables:

```bash
# Stop the current server (Ctrl+C), then:
npm start
```

---

## Step 4 — Verify the app still works

Open the app on your device and confirm:
- Login works
- Words load correctly
- No "Invalid API key" errors in the console

---

## If you also need to rotate the database password

1. **Settings → Database → Database password → Reset database password**
2. This does NOT affect the anon key — it's a separate credential used for direct PostgreSQL connections (not used by this app)

---

## What does NOT need to change

- The **Project URL** (`EXPO_PUBLIC_SUPABASE_URL`) — this never changes unless you create a new project
- The database schema, tables, or RLS policies — these are unaffected by key rotation
- User accounts and vocabulary data — all preserved

---

## After rotating in production (EAS / App Store)

If the app is already published on the App Store or Play Store, users with the old version will stop working until they update. You'll need to:

1. Update the key in your EAS secrets: `eas secret:push --scope project`
2. Build and publish a new version with `eas build` + `eas submit`
