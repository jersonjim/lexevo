# Database Migrations

Changes applied to the database after the initial schema, in chronological order.

---

## 2026-07 — streak_start_date

```sql
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS streak_start_date date;
```

**Why:** When a user changes their mascot theme, their streak resets to 0. This column stores the date of the last reset so that `word_box_history` entries before that date are excluded from the streak calculation.

---

## 2026-07 — streak_theme

```sql
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS streak_theme text DEFAULT 'plant';
```

**Why:** Stores the user's chosen mascot theme (plant, dragon, rocket, flame, lion, wizard, ocean, warrior) in the database so it persists across devices and reinstalls. Previously stored only in AsyncStorage (local to the device).
