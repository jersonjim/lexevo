import { supabase } from '../supabase';

function localDateString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export const BOX_INTERVALS: Record<number, number[]> = {
  3: [1, 3, 7],
  5: [1, 2, 4, 8, 16],
  7: [1, 2, 4, 7, 14, 30, 60],
};

export type StudyWord = {
  id: string;
  word: string;
  meaning: string;
  box_number: number;
};

export type BoxHistoryEntry = {
  box_number: number;
  count: number;
};

function addDays(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

export async function getRepertorioCount(): Promise<number> {
  const { count } = await supabase
    .from('words')
    .select('*', { count: 'exact', head: true })
    .eq('box_number', 0);
  return count ?? 0;
}

export type RepertoireWord = { id: string; word: string; meaning: string };

export async function getAllRepertorioWords(): Promise<RepertoireWord[]> {
  const { data } = await supabase
    .from('words')
    .select('id, word, meaning')
    .eq('box_number', 0)
    .order('word', { ascending: true });
  return data ?? [];
}

function endOfToday(): string {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d.toISOString();
}

export async function getDueCount(): Promise<number> {
  const { count } = await supabase
    .from('words')
    .select('*', { count: 'exact', head: true })
    .gt('box_number', 0)
    .lte('next_review_at', endOfToday());
  return count ?? 0;
}

export async function getRepertorioWords(limit: number): Promise<StudyWord[]> {
  const { data } = await supabase
    .from('words')
    .select('id, word, meaning, box_number')
    .eq('box_number', 0);
  if (!data || data.length === 0) return [];
  for (let i = data.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [data[i], data[j]] = [data[j], data[i]];
  }
  return data.slice(0, limit);
}

export async function getBox1TodayCount(): Promise<number> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return 0;
  const today = localDateString();
  const { data } = await supabase
    .from('profiles')
    .select('daily_box1_count, daily_box1_date')
    .eq('id', user.id)
    .single();
  if (!data || data.daily_box1_date !== today) return 0;
  return data.daily_box1_count ?? 0;
}

export async function moveRepertorioToBox1(wordIds: string[], boxCount: number): Promise<string | null> {
  const intervals = BOX_INTERVALS[boxCount];
  if (!intervals) return `boxCount inválido: ${boxCount}`;
  const { error } = await supabase
    .from('words')
    .update({ box_number: 1, next_review_at: new Date().toISOString() })
    .in('id', wordIds);
  if (error) return error.message;
  const historyEntries = wordIds.map((id) => ({ word_id: id, box_number: 1 }));
  await supabase.from('word_box_history').insert(historyEntries);

  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    const today = localDateString();
    const { data: profile } = await supabase
      .from('profiles')
      .select('daily_box1_count, daily_box1_date')
      .eq('id', user.id)
      .single();
    const isToday = profile?.daily_box1_date === today;
    const current = isToday ? (profile?.daily_box1_count ?? 0) : 0;
    await supabase
      .from('profiles')
      .update({ daily_box1_count: current + wordIds.length, daily_box1_date: today })
      .eq('id', user.id);
  }

  return null;
}

export async function getDueWords(): Promise<StudyWord[]> {
  const { data } = await supabase
    .from('words')
    .select('id, word, meaning, box_number')
    .gt('box_number', 0)
    .lte('next_review_at', endOfToday())
    .order('box_number', { ascending: false });
  return data ?? [];
}

export type LastStudyEntry = {
  box_number: number;
  moved_at: string;
};

export async function getLastStudyEntry(wordId: string): Promise<LastStudyEntry | null> {
  const { data } = await supabase
    .from('word_box_history')
    .select('box_number, moved_at')
    .eq('word_id', wordId)
    .order('moved_at', { ascending: false })
    .limit(2);
  if (!data || data.length === 0) return null;
  // Show the source box (where the word was when reviewed), not the destination.
  // data[0] = last action (timestamp), data[1] = previous state (source box).
  if (data.length === 1) return data[0];
  return { box_number: data[1].box_number, moved_at: data[0].moved_at };
}

export async function getWordBoxHistory(wordId: string): Promise<BoxHistoryEntry[]> {
  const { data } = await supabase
    .from('word_box_history')
    .select('box_number')
    .eq('word_id', wordId);

  if (!data || data.length === 0) return [];

  const counts: Record<number, number> = {};
  data.forEach(({ box_number }) => {
    counts[box_number] = (counts[box_number] ?? 0) + 1;
  });

  return Object.entries(counts)
    .map(([box, count]) => ({ box_number: Number(box), count }))
    .sort((a, b) => a.box_number - b.box_number);
}

export type BoxWord = {
  id: string;
  word: string;
  next_review_at: string | null;
};

export async function getWordsByBox(boxNumber: number): Promise<BoxWord[]> {
  const { data } = await supabase
    .from('words')
    .select('id, word, next_review_at')
    .eq('box_number', boxNumber)
    .order('next_review_at', { ascending: true });
  return data ?? [];
}

export type BoxStat = {
  box_number: number;
  count: number;
  nextReviewAt: string | null;
  dueCount: number;
};

export async function getBoxStats(boxCount: number): Promise<BoxStat[]> {
  const { data } = await supabase
    .from('words')
    .select('box_number, next_review_at')
    .gt('box_number', 0);

  const eod = endOfToday();
  const stats: Record<number, BoxStat> = {};
  for (let i = 1; i <= boxCount; i++) {
    stats[i] = { box_number: i, count: 0, nextReviewAt: null, dueCount: 0 };
  }

  (data ?? []).forEach(({ box_number, next_review_at }) => {
    if (!stats[box_number]) return;
    stats[box_number].count++;
    if (next_review_at && next_review_at <= eod) stats[box_number].dueCount++;
    if (next_review_at) {
      if (!stats[box_number].nextReviewAt || next_review_at < stats[box_number].nextReviewAt!) {
        stats[box_number].nextReviewAt = next_review_at;
      }
    }
  });

  return Object.values(stats).sort((a, b) => a.box_number - b.box_number);
}

export type HardestWord = {
  id: string;
  word: string;
  meaning: string;
  fail_count: number;
};

async function getStreakStartDate(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from('profiles').select('streak_start_date').eq('id', user.id).single();
  return data?.streak_start_date ?? null;
}

export async function resetStreakDate(): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from('profiles').update({ streak_start_date: localDateString() }).eq('id', user.id);
}

export function computeStreak(data: { moved_at: string }[], startDate: string | null): { streak: number; studiedToday: boolean } {
  const today = localDateString();
  const yesterday = (() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  })();

  const uniqueDates = [...new Set(
    data
      .filter(e => !startDate || e.moved_at.slice(0, 10) >= startDate)
      .map(e => {
        const d = new Date(e.moved_at);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      })
  )].sort().reverse();

  if (uniqueDates.length === 0) return { streak: 0, studiedToday: false };

  const studiedToday = uniqueDates[0] === today;
  if (uniqueDates[0] !== today && uniqueDates[0] !== yesterday) return { streak: 0, studiedToday: false };

  let streak = 1;
  for (let i = 1; i < uniqueDates.length; i++) {
    const prev = new Date(uniqueDates[i - 1]);
    const curr = new Date(uniqueDates[i]);
    if (Math.round((prev.getTime() - curr.getTime()) / 86400000) === 1) streak++;
    else break;
  }
  return { streak, studiedToday };
}

export async function getStreakInfo(): Promise<{ streak: number; studiedToday: boolean }> {
  const [{ data }, startDate] = await Promise.all([
    supabase.from('word_box_history').select('moved_at, words!inner(id)').order('moved_at', { ascending: false }),
    getStreakStartDate(),
  ]);
  if (!data || data.length === 0) return { streak: 0, studiedToday: false };
  return computeStreak(data, startDate);
}

export async function getStudyStreak(): Promise<number> {
  const [{ data }, startDate] = await Promise.all([
    supabase.from('word_box_history').select('moved_at, words!inner(id)').order('moved_at', { ascending: false }),
    getStreakStartDate(),
  ]);
  if (!data || data.length === 0) return 0;
  return computeStreak(data, startDate).streak;
}

export async function getHardestVocabulary(): Promise<HardestWord[]> {
  const { data } = await supabase
    .from('words')
    .select('id, word, meaning, fail_count')
    .gt('fail_count', 0)
    .order('fail_count', { ascending: false })
    .limit(20);
  return data ?? [];
}

export async function incrementFailCount(wordId: string): Promise<void> {
  await supabase.rpc('increment_word_fail_count', { word_id: wordId });
}

export async function decrementFailCount(wordId: string): Promise<void> {
  await supabase.rpc('decrement_word_fail_count', { word_id: wordId });
}

export type MarkResult = { error: string | null; mastered: boolean };

export async function markCorrect(wordId: string, currentBox: number, boxCount: number): Promise<MarkResult> {
  const mastered = currentBox >= boxCount;
  let nextBox = 0;
  let nextReviewAt: string | null = null;

  if (!mastered) {
    const intervals = BOX_INTERVALS[boxCount];
    if (!intervals) return { error: `boxCount inválido: ${boxCount}`, mastered: false };
    nextBox = currentBox + 1;
    nextReviewAt = addDays(intervals[nextBox - 1]);
  }

  const { error } = await supabase.rpc('mark_word_correct', {
    p_word_id: wordId,
    p_next_box: nextBox,
    p_next_review_at: nextReviewAt,
    p_mastered: mastered,
  });

  if (error) return { error: error.message, mastered: false };
  return { error: null, mastered };
}

export async function markIncorrect(wordId: string, boxCount: number): Promise<MarkResult> {
  const intervals = BOX_INTERVALS[boxCount];
  if (!intervals) return { error: `boxCount inválido: ${boxCount}`, mastered: false };

  const { error } = await supabase.rpc('mark_word_incorrect', {
    p_word_id: wordId,
    p_next_review_at: new Date().toISOString(),
  });

  if (error) return { error: error.message, mastered: false };
  return { error: null, mastered: false };
}

export async function markIncorrectTomorrow(wordId: string): Promise<MarkResult> {
  const { error } = await supabase.rpc('mark_word_incorrect', {
    p_word_id: wordId,
    p_next_review_at: addDays(1),
  });

  if (error) return { error: error.message, mastered: false };
  return { error: null, mastered: false };
}
