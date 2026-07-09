# Database Migrations

Changes applied to the database after the initial schema, in chronological order.

---

## 2026-07 — streak_start_date

```sql
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS streak_start_date date;
```

**Why:** When a user changes their mascot theme, their streak resets to 0. This column stores the date of the last reset so that `word_box_history` entries before that date are excluded from the streak calculation.

---

## 2026-07 — mark_word_correct / mark_word_incorrect RPCs

Replaces the non-atomic client-side sequence (UPDATE → INSERT history → decrement fail_count) with two PostgreSQL functions that execute everything in a single transaction.

```sql
CREATE OR REPLACE FUNCTION public.mark_word_correct(
  p_word_id uuid,
  p_next_box int,
  p_next_review_at timestamptz,
  p_mastered boolean
) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF p_mastered THEN
    UPDATE words
    SET box_number     = 0,
        next_review_at = NULL,
        mastered_count = mastered_count + 1,
        fail_count     = GREATEST(0, COALESCE(fail_count, 0) - 1)
    WHERE id = p_word_id;

    INSERT INTO word_box_history (word_id, box_number)
    VALUES (p_word_id, 0);
  ELSE
    UPDATE words
    SET box_number     = p_next_box,
        next_review_at = p_next_review_at,
        fail_count     = GREATEST(0, COALESCE(fail_count, 0) - 1)
    WHERE id = p_word_id;

    INSERT INTO word_box_history (word_id, box_number)
    VALUES (p_word_id, p_next_box);
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_word_incorrect(
  p_word_id uuid,
  p_next_review_at timestamptz
) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  UPDATE words
  SET box_number     = 1,
      next_review_at = p_next_review_at
  WHERE id = p_word_id;

  INSERT INTO word_box_history (word_id, box_number)
  VALUES (p_word_id, 1);
END;
$$;
```

**Why:** `markCorrect()` and `markIncorrect()` previously made 3–4 separate Supabase calls. If any intermediate call failed (network timeout, RLS mismatch), the word state and history would be inconsistent — e.g. word advanced to next box but no history entry recorded.

---

## 2026-07 — streak_theme

```sql
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS streak_theme text DEFAULT 'plant';
```

**Why:** Stores the user's chosen mascot theme (plant, dragon, rocket, flame, lion, wizard, ocean, warrior) in the database so it persists across devices and reinstalls. Previously stored only in AsyncStorage (local to the device).
