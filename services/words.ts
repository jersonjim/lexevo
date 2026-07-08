import { supabase } from '../supabase';

export type Word = {
  id: string;
  word: string;
  meaning: string;
  user_id: string;
  box_number: number;
  next_review_at: string | null;
  mastered_count: number;
};

export async function getWordCount(): Promise<number> {
  const { count } = await supabase
    .from('words')
    .select('*', { count: 'exact', head: true });
  return count ?? 0;
}

export async function getAllWords(): Promise<Word[]> {
  const { data } = await supabase
    .from('words')
    .select('*')
    .order('word', { ascending: true });
  return data ?? [];
}

export async function checkWordExists(word: string): Promise<boolean> {
  const { count } = await supabase
    .from('words')
    .select('*', { count: 'exact', head: true })
    .ilike('word', word.trim());
  return (count ?? 0) > 0;
}

export async function insertWord(word: string, meaning: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  await supabase.from('words').insert({ word, meaning, user_id: user!.id });
}

export async function updateWord(id: string, word: string, meaning: string): Promise<void> {
  await supabase.from('words').update({ word, meaning }).eq('id', id);
}

export async function deleteWord(id: string): Promise<void> {
  await supabase.from('words').delete().eq('id', id);
}

export async function insertWords(
  rows: { word: string; meaning: string }[]
): Promise<{ inserted: number; skipped: number; error: string | null }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { inserted: 0, skipped: 0, error: 'No session' };

  const { data: existing } = await supabase.from('words').select('word');
  const existingSet = new Set((existing ?? []).map(w => w.word.toLowerCase().trim()));

  const newRows = rows.filter(r => !existingSet.has(r.word.toLowerCase().trim()));
  const skipped = rows.length - newRows.length;

  if (newRows.length === 0) return { inserted: 0, skipped, error: null };

  const records = newRows.map(r => ({ word: r.word, meaning: r.meaning, user_id: user.id }));
  const { error } = await supabase.from('words').insert(records);
  if (error) return { inserted: 0, skipped, error: error.message };
  return { inserted: newRows.length, skipped, error: null };
}
