# Lexevo

Vocabulary learning app using the Leitner spaced repetition method. Built with React Native + Expo + Supabase.

## Tech Stack

- **Frontend:** React Native + Expo (TypeScript)
- **Backend:** Supabase (PostgreSQL + Auth + Storage)
- **i18n:** i18next — English, Spanish, Portuguese

## Local Setup

### 1. Clone and install dependencies

```bash
git clone https://github.com/jersonjim/lexevo.git
cd lexevo
npm install
```

### 2. Create a Supabase project

Go to [supabase.com](https://supabase.com), create a new project, and note your **Project URL** and **anon key** (Settings → API).

### 3. Set up the database

In **Supabase Dashboard → SQL Editor**, run the full script:

```
supabase/schema.sql
```

This creates all tables, RLS policies, RPC functions, and seed data (plans).

Then go to **Storage → New bucket**, create a bucket named `avatars` and set it to **Public**.

### 4. Configure environment variables

```bash
cp .env.example .env
```

Edit `.env` and fill in your Supabase credentials:

```
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here
```

> **Note:** Environment variable loading via `app.json` is pending (issue [#10](https://github.com/jersonjim/vocab-app/issues/10)). For now, update `supabase.ts` directly with your credentials.

### 5. Run the app

```bash
npm start        # Expo Dev Tools
npm run ios      # iOS Simulator
npm run android  # Android Emulator
```

## Database Schema

See [`supabase/schema.sql`](supabase/schema.sql) for the full schema.

| Table | Description |
|-------|-------------|
| `plans` | Available plans: Bronze (3 boxes), Silver (5), Golden (7) |
| `profiles` | One row per user — plan, nickname, avatar, streak info, mascot |
| `words` | User vocabulary — word, meaning, current box, review schedule |
| `word_box_history` | Every box transition recorded — drives streak and history UI |

See [`supabase/migrations.md`](supabase/migrations.md) for changes applied after the initial schema.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for the branch and PR workflow.
