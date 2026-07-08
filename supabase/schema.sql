-- ============================================================
-- Lexevo — Supabase Database Schema
-- Run this in Supabase SQL Editor to set up a fresh project
-- ============================================================

-- ============================================================
-- TABLES
-- ============================================================

-- Plans (Bronze / Silver / Golden)
CREATE TABLE public.plans (
  id         text        NOT NULL,
  name       text        NOT NULL,
  box_count  integer     NOT NULL,
  sort_order integer     NOT NULL,
  CONSTRAINT plans_pkey PRIMARY KEY (id)
);

-- User profiles (extends Supabase auth.users)
CREATE TABLE public.profiles (
  id                uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nickname          text,
  created_at        timestamptz DEFAULT now(),
  box_count         integer,
  plan_id           text        REFERENCES public.plans(id),
  avatar_url        text,
  daily_box1_count  integer     NOT NULL DEFAULT 0,
  daily_box1_date   date,
  streak_start_date date,
  streak_theme      text        DEFAULT 'plant',
  CONSTRAINT profiles_pkey PRIMARY KEY (id)
);

-- Vocabulary words
CREATE TABLE public.words (
  id             uuid        NOT NULL DEFAULT gen_random_uuid(),
  user_id        uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  word           text        NOT NULL,
  meaning        text        NOT NULL,
  created_at     timestamptz DEFAULT now(),
  box_number     integer     NOT NULL DEFAULT 0,
  next_review_at timestamptz,
  mastered_count integer     NOT NULL DEFAULT 0,
  fail_count     integer     NOT NULL DEFAULT 0,
  CONSTRAINT words_pkey PRIMARY KEY (id)
);

-- Study history per word per box
CREATE TABLE public.word_box_history (
  id         uuid        NOT NULL DEFAULT gen_random_uuid(),
  word_id    uuid        NOT NULL REFERENCES public.words(id) ON DELETE CASCADE,
  box_number integer     NOT NULL,
  moved_at   timestamptz DEFAULT now(),
  CONSTRAINT word_box_history_pkey PRIMARY KEY (id)
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE public.plans           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.words           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.word_box_history ENABLE ROW LEVEL SECURITY;

-- Plans: readable by any authenticated user
CREATE POLICY "plans_readable_by_all"
  ON public.plans FOR SELECT
  USING (true);

-- Profiles: users can only read/write their own row
CREATE POLICY "own profile"
  ON public.profiles FOR ALL
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Words: users can only read/write their own words
CREATE POLICY "own words"
  ON public.words FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Word box history: access only through owned words
CREATE POLICY "own word history"
  ON public.word_box_history FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.words
      WHERE words.id = word_box_history.word_id
        AND words.user_id = auth.uid()
    )
  );

-- ============================================================
-- FUNCTIONS (RPC)
-- ============================================================

CREATE OR REPLACE FUNCTION public.increment_word_fail_count(word_id uuid)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  UPDATE words
  SET fail_count = fail_count + 1
  WHERE id = word_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.decrement_word_fail_count(word_id uuid)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  UPDATE words
  SET fail_count = GREATEST(0, COALESCE(fail_count, 0) - 1)
  WHERE id = word_id;
END;
$$;

-- ============================================================
-- STORAGE
-- ============================================================

-- Create the avatars bucket (run via Supabase Dashboard or API)
-- Dashboard → Storage → New bucket → name: "avatars", Public: true
--
-- Storage policy (add via Dashboard → Storage → avatars → Policies):
--   INSERT: auth.uid()::text = (storage.foldername(name))[1]
--   UPDATE: auth.uid()::text = (storage.foldername(name))[1]
--   SELECT: true (public bucket)

-- ============================================================
-- SEED DATA
-- ============================================================

INSERT INTO public.plans (id, name, box_count, sort_order) VALUES
  ('bronze', 'Bronze', 3, 1),
  ('silver', 'Silver', 5, 2),
  ('golden', 'Golden', 7, 3)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- PROFILE AUTO-CREATION TRIGGER
-- ============================================================
-- When a new user signs up, automatically create their profile row.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.profiles (id)
  VALUES (NEW.id)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
