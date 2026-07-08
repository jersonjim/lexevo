import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import {
  StyleSheet, Text, View, ScrollView, TouchableOpacity,
  Modal, TextInput, KeyboardAvoidingView, Platform, Pressable, Alert,
  FlatList, ActivityIndicator, Animated,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTranslation } from 'react-i18next';
import i18n from '../i18n';
import { insertWord, insertWords, checkWordExists } from '../services/words';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { getRepertorioCount, getDueCount, getRepertorioWords, getDueWords, moveRepertorioToBox1, getBoxStats, getWordsByBox, getBox1TodayCount, getHardestVocabulary, getAllRepertorioWords, getStreakInfo, BoxStat, BoxWord, HardestWord, StudyWord, RepertoireWord } from '../services/leitner';
import { getPlan } from '../services/plans';
import { supabase } from '../supabase';
import { useTheme } from '../context/ThemeContext';
import { STREAK_THEMES, getMascotEmoji, getStageIndex, STAGE_MILESTONES } from '../constants/streakThemes';

const BOX_COLORS: Record<number, { bg: string; text: string }> = {
  1: { bg: '#FEF2F2', text: '#EF4444' },
  2: { bg: '#FFF7ED', text: '#F97316' },
  3: { bg: '#FEFCE8', text: '#CA8A04' },
  4: { bg: '#F0FDF4', text: '#16A34A' },
  5: { bg: '#F0F9FF', text: '#0284C7' },
  6: { bg: '#F5F3FF', text: '#7C3AED' },
  7: { bg: '#FDF4FF', text: '#A21CAF' },
};

function boxColor(n: number) { return BOX_COLORS[n] ?? BOX_COLORS[7]; }

function relativeDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  const date = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.round((date.setHours(0,0,0,0) - now.setHours(0,0,0,0)) / 86400000);
  if (diffDays <= 0) return i18n.t('common.today');
  if (diffDays === 1) return i18n.t('common.tomorrow');
  if (diffDays <= 30) return i18n.t('common.inDays', { count: diffDays });
  const locale = i18n.language === 'en' ? 'en-US' : 'es-ES';
  return new Date(dateStr).toLocaleDateString(locale, { day: '2-digit', month: '2-digit' });
}

const FALLBACK_QUOTES = [
  { q: 'An investment in knowledge pays the best interest.', a: 'Benjamin Franklin' },
  { q: 'Live as if you were to die tomorrow. Learn as if you were to live forever.', a: 'Mahatma Gandhi' },
  { q: 'The more that you read, the more things you will know.', a: 'Dr. Seuss' },
  { q: 'Education is the most powerful weapon which you can use to change the world.', a: 'Nelson Mandela' },
  { q: 'Learning never exhausts the mind.', a: 'Leonardo da Vinci' },
  { q: 'The beautiful thing about learning is that nobody can take it away from you.', a: 'B.B. King' },
  { q: 'In learning you will teach, and in teaching you will learn.', a: 'Phil Collins' },
];

async function fetchDailyQuote(): Promise<{ q: string; a: string }> {
  const today = new Date().toDateString();
  try {
    const cached = await AsyncStorage.getItem('daily_quote');
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed.date === today) return { q: parsed.q, a: parsed.a };
    }
    const res = await fetch('https://zenquotes.io/api/today');
    const data = await res.json();
    const quote = { q: data[0].q, a: data[0].a, date: today };
    await AsyncStorage.setItem('daily_quote', JSON.stringify(quote));
    return { q: data[0].q, a: data[0].a };
  } catch {
    const idx = new Date().getDate() % FALLBACK_QUOTES.length;
    return FALLBACK_QUOTES[idx];
  }
}

type TmRect = { x: number; y: number; w: number; h: number };

function treemapLayout(values: number[], W: number, H: number): TmRect[] {
  if (!values.length || !W || !H) return [];
  const total = values.reduce((s, v) => s + v, 0);
  if (!total) return values.map(() => ({ x: 0, y: 0, w: 0, h: 0 }));
  const area = W * H;
  const sorted = values
    .map((v, i) => ({ i, v: (v / total) * area }))
    .sort((a, b) => b.v - a.v);
  const result: TmRect[] = new Array(values.length);

  function worst(row: number[], side: number): number {
    if (!row.length || !side) return Infinity;
    const s = row.reduce((a, b) => a + b, 0);
    const s2 = s * s, side2 = side * side;
    const max = Math.max(...row), min = Math.min(...row);
    return Math.max((side2 * max) / s2, s2 / (side2 * min));
  }

  function commit(row: { i: number; v: number }[], x: number, y: number, w: number, h: number) {
    const s = row.reduce((t, n) => t + n.v, 0);
    if (w >= h) {
      const cw = s / h; let py = y;
      for (const n of row) { const ch = (n.v / s) * h; result[n.i] = { x, y: py, w: cw, h: ch }; py += ch; }
    } else {
      const rh = s / w; let px = x;
      for (const n of row) { const cw = (n.v / s) * w; result[n.i] = { x: px, y, w: cw, h: rh }; px += cw; }
    }
  }

  function sq(items: { i: number; v: number }[], row: { i: number; v: number }[], x: number, y: number, w: number, h: number) {
    if (!items.length) { if (row.length) commit(row, x, y, w, h); return; }
    if (w < 1 || h < 1) { if (row.length) commit(row, x, y, w, h); return; }
    const side = w >= h ? h : w;
    const rv = row.map(n => n.v);
    if (!row.length || worst([...rv, items[0].v], side) <= worst(rv, side)) {
      sq(items.slice(1), [...row, items[0]], x, y, w, h);
    } else {
      const s = row.reduce((t, n) => t + n.v, 0);
      commit(row, x, y, w, h);
      if (w >= h) { const cw = s / h; sq(items, [], x + cw, y, w - cw, h); }
      else        { const rh = s / w; sq(items, [], x, y + rh, w, h - rh); }
    }
  }

  sq(sorted, [], 0, 0, W, H);
  return result;
}

function tmColor(ratio: number): { bg: string; text: string } {
  if (ratio >= 0.75) return { bg: '#7F1D1D', text: '#FCA5A5' };
  if (ratio >= 0.5)  return { bg: '#B91C1C', text: '#FEE2E2' };
  if (ratio >= 0.25) return { bg: '#EA580C', text: '#FFFFFF' };
  return { bg: '#F97316', text: '#FFFFFF' };
}


import { parseCSV, MAX_CSV_SIZE_BYTES, CsvRow } from '../utils/csv';


export default function HomeScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [savedCount, setSavedCount] = useState(0);
  const bannerOpacity = useRef(new Animated.Value(0)).current;
  const bannerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wordInputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (route.params?.openAdd) setAddModalVisible(true);
  }, [route.params?.openAdd]);

  useEffect(() => {
    if (route.params?.openCsv) openCsvModal();
  }, [route.params?.openCsv]);
  const [studyLoading, setStudyLoading] = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [previewWords, setPreviewWords] = useState<StudyWord[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [word, setWord] = useState('');
  const [meaning, setMeaning] = useState('');
  const [repertorioCount, setRepertorioCount] = useState(0);
  const [dueCount, setDueCount] = useState(0);
  const [boxCount, setBoxCount] = useState(5);
  const [box1TodayCount, setBox1TodayCount] = useState(0);
  const [hardestVocab, setHardestVocab] = useState<HardestWord[]>([]);
  const [boxStats, setBoxStats] = useState<BoxStat[]>([]);
  const [csvModalVisible, setCsvModalVisible] = useState(false);
  const [csvStep, setCsvStep] = useState<'instructions' | 'preview' | 'importing' | 'done'>('instructions');
  const [csvRows, setCsvRows] = useState<CsvRow[]>([]);
  const [csvError, setCsvError] = useState<string | null>(null);
  const [csvImportedCount, setCsvImportedCount] = useState(0);
  const [csvSkippedCount, setCsvSkippedCount] = useState(0);
  const [csvSkippedLength, setCsvSkippedLength] = useState(0);
  const [wordDuplicate, setWordDuplicate] = useState(false);
  const [nickname, setNickname] = useState<string | null>(null);
  const [streak, setStreak] = useState(0);
  const [studiedToday, setStudiedToday] = useState(false);
  const [mascotTheme, setMascotTheme] = useState<string>('plant');
  const [mascotModalVisible, setMascotModalVisible] = useState(false);
  const [heatmapVisible, setHeatmapVisible] = useState(false);
  const [repertoireModalVisible, setRepertoireModalVisible] = useState(false);
  const [repertoireWords, setRepertoireWords] = useState<RepertoireWord[]>([]);
  const [loadingRepertoireWords, setLoadingRepertoireWords] = useState(false);
  const [loading, setLoading] = useState(true);
  const [quote, setQuote] = useState<{ q: string; a: string } | null>(null);
  const [boxModalStat, setBoxModalStat] = useState<BoxStat | null>(null);
  const [boxWords, setBoxWords] = useState<BoxWord[]>([]);
  const [loadingBoxWords, setLoadingBoxWords] = useState(false);
  const [tmDims, setTmDims] = useState({ w: 0, h: 0 });
  const tmRects = useMemo(() => {
    if (!tmDims.w || !tmDims.h || !hardestVocab.length) return [];
    return treemapLayout(hardestVocab.map(v => v.fail_count), tmDims.w, tmDims.h);
  }, [hardestVocab, tmDims.w, tmDims.h]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  async function loadData() {
    setLoading(true);
    const [rep, due, todayCount, hardest, streakInfo] = await Promise.all([
      getRepertorioCount(), getDueCount(), getBox1TodayCount(), getHardestVocabulary(), getStreakInfo(),
    ]);
    setStreak(streakInfo.streak);
    setStudiedToday(streakInfo.studiedToday);
    setRepertorioCount(rep);
    setDueCount(due);
    setBox1TodayCount(todayCount);
    setHardestVocab(hardest);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase.from('profiles').select('box_count, nickname').eq('id', user.id).single();
      const count = data?.box_count ?? 5;
      setBoxCount(count);
      setNickname(data?.nickname ?? null);
      const stats = await getBoxStats(count);
      setBoxStats(stats);
    }
    const q = await fetchDailyQuote();
    setQuote(q);
    const storedTheme = await AsyncStorage.getItem('streak_theme');
    if (storedTheme) setMascotTheme(storedTheme);
    setLoading(false);
  }

  function showSavedBanner(savedWord: string) {
    setLastSaved(savedWord);
    if (bannerTimer.current) clearTimeout(bannerTimer.current);
    Animated.sequence([
      Animated.timing(bannerOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.delay(1600),
      Animated.timing(bannerOpacity, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start();
    bannerTimer.current = setTimeout(() => setLastSaved(null), 2200);
  }

  async function handleSave() {
    if (!word.trim() || !meaning.trim()) return;
    const savedWord = word.trim();
    const exists = await checkWordExists(savedWord);
    if (exists) {
      setWordDuplicate(true);
      return;
    }
    await insertWord(savedWord, meaning.trim());
    setWord('');
    setMeaning('');
    setWordDuplicate(false);
    setSavedCount((c) => c + 1);
    showSavedBanner(savedWord);
    loadData();
    setTimeout(() => wordInputRef.current?.focus(), 50);
  }

  function handleCloseAdd() {
    setWord('');
    setMeaning('');
    setLastSaved(null);
    setSavedCount(0);
    setWordDuplicate(false);
    if (bannerTimer.current) clearTimeout(bannerTimer.current);
    setAddModalVisible(false);
  }

  function openCsvModal() {
    setCsvStep('instructions');
    setCsvRows([]);
    setCsvError(null);
    setCsvImportedCount(0);
    setCsvSkippedCount(0);
    setCsvSkippedLength(0);
    setCsvModalVisible(true);
  }

  async function handlePickCSV() {
    setCsvError(null);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      let uri = asset.uri;
      // On Android, copy to cache first so FileSystem can read it
      if (!uri.startsWith('file://')) {
        const dest = FileSystem.cacheDirectory + 'import.csv';
        await FileSystem.copyAsync({ from: uri, to: dest });
        uri = dest;
      }
      const info = await FileSystem.getInfoAsync(uri);
      if (info.exists && info.size > MAX_CSV_SIZE_BYTES) {
        setCsvError(t('home.csvErrorTooLarge'));
        return;
      }
      const content = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.UTF8 });
      const { rows, skippedLength } = parseCSV(content);
      if (rows.length === 0) { setCsvError(t('home.csvErrorEmpty')); return; }
      setCsvRows(rows);
      setCsvSkippedLength(skippedLength);
      setCsvStep('preview');
    } catch (e: any) {
      if (e.message === 'columns') setCsvError(t('home.csvErrorColumns'));
      else if (e.message === 'empty') setCsvError(t('home.csvErrorEmpty'));
      else setCsvError(t('home.csvErrorRead'));
    }
  }

  async function handleImportCSV() {
    setCsvStep('importing');
    const { inserted, skipped, error } = await insertWords(csvRows);
    if (error) { setCsvError(error); setCsvStep('preview'); return; }
    setCsvImportedCount(inserted);
    setCsvSkippedCount(skipped);
    setCsvStep('done');
    loadData();
  }

  async function openRepertoireModal() {
    setRepertoireModalVisible(true);
    setLoadingRepertoireWords(true);
    const words = await getAllRepertorioWords();
    setRepertoireWords(words);
    setLoadingRepertoireWords(false);
  }

  async function openBoxModal(stat: BoxStat) {
    setBoxModalStat(stat);
    setBoxWords([]);
    setLoadingBoxWords(true);
    const words = await getWordsByBox(stat.box_number);
    setBoxWords(words);
    setLoadingBoxWords(false);
  }

  async function openStudyConfirm(newCount: number) {
    setConfirmVisible(true);
    if (newCount > 0) {
      setPreviewLoading(true);
      const words = await getRepertorioWords(newCount);
      setPreviewWords(words);
      setPreviewLoading(false);
    } else {
      setPreviewWords([]);
    }
  }

  async function startCombinedStudy() {
    if (studyLoading) return;
    setStudyLoading(true);
    setConfirmVisible(false);
    const dueWords = await getDueWords();
    let newWords: StudyWord[] = [];
    if (previewWords.length > 0) {
      const wordIds = previewWords.map(w => w.id);
      const error = await moveRepertorioToBox1(wordIds, boxCount);
      if (error) { Alert.alert(t('common.error'), error); setStudyLoading(false); return; }
      setBox1TodayCount(c => c + previewWords.length);
      newWords = previewWords.map(w => ({ ...w, box_number: 1 }));
    }
    setStudyLoading(false);
    const allWords = [...dueWords, ...newWords];
    if (allWords.length === 0) return;
    (navigation as any).navigate('Study', { words: allWords, boxCount });
  }

  const currentPlan = getPlan(boxCount);
  const remaining = Math.max(0, currentPlan.dailyLimit - box1TodayCount);
  const newWordsToday = Math.min(remaining, repertorioCount);
  const totalStudyCount = newWordsToday + dueCount;
  const canStudyToday = totalStudyCount > 0;

  if (loading) {
    return (
      <View style={[styles.container, styles.loadingContainer, { backgroundColor: colors.bg }]}>
        <Text style={styles.loadingLogo}>Lexevo</Text>
        <ActivityIndicator size="large" color="#4F46E5" style={{ marginTop: 24 }} />
        <Text style={[styles.loadingText, { color: colors.textMuted }]}>{t('home.loading')}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.quoteBlock}>
          <Text style={[styles.greeting, { color: colors.text }]}>
            {t('home.hello')}{nickname ? ` ${nickname}` : ''} 👋
          </Text>
          {quote ? (
            <>
              <Text style={styles.quoteText} numberOfLines={3}>"{quote.q}"</Text>
              {!!quote.a && <Text style={styles.quoteAuthor}>— {quote.a}</Text>}
            </>
          ) : (
            <Text style={styles.subtitle}>{t('home.loading')}</Text>
          )}
        </View>
        {/* Streak banner */}
        <View style={[
          styles.streakBanner,
          studiedToday ? styles.streakBannerDone : streak > 0 ? styles.streakBannerRisk : styles.streakBannerZero,
        ]}>
          {/* Mascot: tappable, opens stages popup */}
          <TouchableOpacity
            onPress={() => setMascotModalVisible(true)}
            activeOpacity={0.7}
            style={styles.mascotBtn}
          >
            <Text style={styles.mascotEmoji}>{getMascotEmoji(mascotTheme, streak)}</Text>
          </TouchableOpacity>

          {/* Text: tappable area for studying (only when not done) */}
          <TouchableOpacity
            style={{ flex: 1 }}
            activeOpacity={studiedToday ? 1 : 0.7}
            onPress={studiedToday ? undefined : () => canStudyToday ? openStudyConfirm(newWordsToday) : undefined}
          >
            <Text style={[
              styles.streakTitle,
              { color: studiedToday ? '#15803D' : streak > 0 ? '#B45309' : '#1D4ED8' },
            ]}>
              {studiedToday
                ? t('home.streakDone', { count: streak })
                : streak > 0
                ? t('home.streakRisk', { count: streak })
                : t('home.streakZero')}
            </Text>
            <Text style={[
              styles.streakSub,
              { color: studiedToday ? '#16A34A' : streak > 0 ? '#D97706' : '#3B82F6' },
            ]}>
              {studiedToday
                ? t('home.streakDoneSub')
                : streak > 0
                ? t('home.streakRiskSub')
                : t('home.streakZeroSub')}
            </Text>
          </TouchableOpacity>

          {!studiedToday && (
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => canStudyToday ? openStudyConfirm(newWordsToday) : undefined}
            >
              <Text style={[styles.streakArrow, { color: streak > 0 ? '#D97706' : '#3B82F6' }]}>›</Text>
            </TouchableOpacity>
          )}
          {studiedToday && (
            <View style={styles.streakCheckBadge}>
              <Text style={styles.streakCheckText}>✓</Text>
            </View>
          )}
        </View>

        {hardestVocab.length > 0 && (
          <View style={styles.hardestSection}>
            <View style={styles.hardestSectionHeader}>
              <View>
                <Text style={styles.hardestSectionTitle}>🔥 {t('home.hardestWordTitle')}</Text>
                <Text style={styles.hardestSectionSub}>{t('home.hardestWordSub')}</Text>
              </View>
              <TouchableOpacity style={styles.heatmapBtn} onPress={() => setHeatmapVisible(true)} activeOpacity={0.8}>
                <Text style={styles.heatmapBtnText}>📊 {t('home.heatmapBtn')}</Text>
              </TouchableOpacity>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hardestRow}>
              {hardestVocab.slice(0, 3).map((item, idx) => (
                <View key={item.id} style={styles.hardestCard}>
                  <View style={styles.hardestCardTop}>
                    <Text style={styles.hardestRank}>{['🥇', '🥈', '🥉'][idx]}</Text>
                    <View style={styles.hardestBadge}>
                      <Text style={styles.hardestBadgeText}>
                        {t('home.failedTimes', { count: item.fail_count })}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.hardestWord} numberOfLines={1}>{item.word}</Text>
                  <Text style={styles.hardestMeaning} numberOfLines={2}>{item.meaning}</Text>
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Sección de cajas */}
        {boxStats.length > 0 && (
          <View style={styles.boxesSection}>
            <Text style={styles.boxesSectionTitle}>{t('home.yourBoxes')}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.boxesRow}>
              {boxStats.map((stat) => {
                const bc = boxColor(stat.box_number);
                return (
                  <TouchableOpacity key={stat.box_number} style={[styles.boxCard, { backgroundColor: bc.bg, borderColor: bc.text + '30' }]} onPress={() => openBoxModal(stat)} activeOpacity={0.75}>
                    <Text style={[styles.boxCardLabel, { color: bc.text }]}>{t('common.box', { n: stat.box_number })}</Text>
                    <Text style={[styles.boxCardCount, { color: bc.text }]}>{stat.count}</Text>
                    <Text style={styles.boxCardWordLabel}>{t('home.boxWords', { count: stat.count })}</Text>
                    {stat.dueCount > 0 ? (
                      <View style={styles.boxDuePill}>
                        <Text style={styles.boxDuePillText}>{stat.dueCount} {t('home.today')}</Text>
                      </View>
                    ) : stat.count > 0 && stat.nextReviewAt ? (
                      <Text style={[styles.boxNextDate, { color: bc.text }]}>{relativeDate(stat.nextReviewAt)}</Text>
                    ) : (
                      <Text style={styles.boxEmpty}>{t('home.empty')}</Text>
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        <TouchableOpacity
          style={[styles.card, { borderLeftColor: '#4F46E5', backgroundColor: colors.card }, !canStudyToday && styles.cardInactive]}
          activeOpacity={canStudyToday && !studyLoading ? 0.8 : 1}
          onPress={canStudyToday ? () => openStudyConfirm(newWordsToday) : undefined}
        >
          <View style={styles.cardTop}>
            <Text style={styles.emoji}>📚</Text>
            <View style={styles.cardText}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>{t('home.studyTodayTitle')}</Text>
              <Text style={[styles.cardDescription, { color: colors.textSub }]}>
                {canStudyToday
                  ? [
                      newWordsToday > 0 && t('home.studyNew', { count: newWordsToday }),
                      dueCount > 0 && t('home.studyReview', { count: dueCount }),
                    ].filter(Boolean).join(' · ')
                  : t('home.studyNothingToday')}
              </Text>
            </View>
            <View style={styles.cardCountBlock}>
              <Text style={[styles.cardCountNumber, { color: '#4F46E5' }]}>{totalStudyCount}</Text>
              {canStudyToday && <Text style={styles.cardChevron}>›</Text>}
            </View>
          </View>
          <View style={styles.studyTodayBadges}>
            {newWordsToday > 0 && (
              <View style={[styles.badge, { backgroundColor: '#EEF2FF' }]}>
                <Text style={[styles.badgeText, { color: '#4F46E5' }]}>✨ {t('home.studyNew', { count: newWordsToday })}</Text>
              </View>
            )}
            {dueCount > 0 && (
              <View style={[styles.badge, { backgroundColor: '#E0F2FE' }]}>
                <Text style={[styles.badgeText, { color: '#0284C7' }]}>🎯 {t('home.studyReview', { count: dueCount })}</Text>
              </View>
            )}
            {!canStudyToday && (
              <View style={[styles.badge, { backgroundColor: '#F0FDF4' }]}>
                <Text style={[styles.badgeText, { color: '#16A34A' }]}>✅ {t('home.studyNothingToday')}</Text>
              </View>
            )}
          </View>
        </TouchableOpacity>

        {repertorioCount > 0 && (
          <TouchableOpacity
            style={[styles.card, { borderLeftColor: '#7C3AED', backgroundColor: colors.card }]}
            activeOpacity={0.8}
            onPress={openRepertoireModal}
          >
            <View style={styles.cardTop}>
              <Text style={styles.emoji}>📦</Text>
              <View style={styles.cardText}>
                <Text style={[styles.cardTitle, { color: colors.text }]}>{t('home.repertoireTitle')}</Text>
                <Text style={[styles.cardDescription, { color: colors.textSub }]}>{t('home.repertoireDesc')}</Text>
              </View>
              <View style={styles.cardCountBlock}>
                <Text style={[styles.cardCountNumber, { color: '#7C3AED' }]}>{repertorioCount}</Text>
                <Text style={styles.cardChevron}>›</Text>
              </View>
            </View>
          </TouchableOpacity>
        )}

      </ScrollView>

      {/* Modal: importar CSV */}
      <Modal visible={csvModalVisible} transparent animationType="slide" onRequestClose={() => setCsvModalVisible(false)}>
        <Pressable style={styles.backdrop} onPress={() => setCsvModalVisible(false)} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.sheetWrapper}>
          <View style={[styles.sheet, { backgroundColor: colors.card }]}>
            <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />
            <Text style={[styles.sheetTitle, { color: colors.text }]}>{t('home.csvTitle')}</Text>

            {csvStep === 'instructions' && (
              <>
                <Text style={styles.csvInstructions}>{t('home.csvInstructions')}</Text>
                <View style={styles.csvExampleBox}>
                  <Text style={styles.csvExampleLabel}>{t('home.csvExample')}</Text>
                  <Text style={styles.csvExampleCode}>{'word,meaning\nresilient,Capaz de recuperarse\neloquent,Elocuente'}</Text>
                </View>
                {csvError && <Text style={styles.csvError}>{csvError}</Text>}
                <TouchableOpacity style={styles.csvPickBtn} onPress={handlePickCSV} activeOpacity={0.8}>
                  <Text style={styles.csvPickBtnText}>📂  {t('home.csvChooseFile')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.cancelButton} onPress={() => setCsvModalVisible(false)} activeOpacity={0.8}>
                  <Text style={styles.cancelText}>{t('common.cancel')}</Text>
                </TouchableOpacity>
              </>
            )}

            {csvStep === 'preview' && (
              <>
                <View style={styles.csvPreviewHeader}>
                  <Text style={styles.csvPreviewTitle}>{t('home.csvPreviewTitle', { count: csvRows.length })}</Text>
                  <Text style={styles.csvPreviewSub}>{t('home.csvPreviewSub')}</Text>
                </View>
                <View style={styles.csvTableHeader}>
                  <Text style={[styles.csvTableCell, styles.csvTableHeaderText]}>word</Text>
                  <Text style={[styles.csvTableCell, styles.csvTableHeaderText]}>meaning</Text>
                </View>
                <FlatList
                  data={csvRows.slice(0, 50)}
                  keyExtractor={(_, i) => String(i)}
                  style={styles.csvList}
                  showsVerticalScrollIndicator={false}
                  ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: '#F1F5F9' }} />}
                  renderItem={({ item }) => (
                    <View style={styles.csvTableRow}>
                      <Text style={[styles.csvTableCell, styles.csvWordCell]} numberOfLines={1}>{item.word}</Text>
                      <Text style={[styles.csvTableCell, styles.csvMeaningCell]} numberOfLines={2}>{item.meaning}</Text>
                    </View>
                  )}
                />
                {csvRows.length > 50 && (
                  <Text style={styles.csvMoreText}>+{csvRows.length - 50} más...</Text>
                )}
                {csvSkippedLength > 0 && (
                  <Text style={styles.csvSkippedText}>{t('home.csvSkippedLength', { count: csvSkippedLength })}</Text>
                )}
                {csvError && <Text style={styles.csvError}>{csvError}</Text>}
                <View style={styles.modalActions}>
                  <TouchableOpacity style={styles.cancelButton} onPress={() => setCsvStep('instructions')} activeOpacity={0.8}>
                    <Text style={styles.cancelText}>{t('common.cancel')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.saveButton} onPress={handleImportCSV} activeOpacity={0.8}>
                    <Text style={styles.saveText}>{t('home.csvImportBtn', { count: csvRows.length })}</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}

            {csvStep === 'importing' && (
              <View style={styles.csvLoadingBox}>
                <ActivityIndicator size="large" color="#4F46E5" />
              </View>
            )}

            {csvStep === 'done' && (
              <View style={styles.csvDoneBox}>
                <Text style={styles.csvDoneIcon}>✅</Text>
                <Text style={styles.csvDoneTitle}>{t('home.csvDoneTitle')}</Text>
                <Text style={styles.csvDoneSub}>{t('home.csvDoneMsg', { count: csvImportedCount })}</Text>
                {csvSkippedCount > 0 && (
                  <Text style={styles.csvSkippedText}>{t('home.csvSkipped', { count: csvSkippedCount })}</Text>
                )}
                <TouchableOpacity style={[styles.saveButton, styles.csvDoneCloseBtn]} onPress={() => setCsvModalVisible(false)} activeOpacity={0.8}>
                  <Text style={styles.saveText}>{t('home.csvClose')}</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Modal: palabras de una caja */}
      <Modal visible={!!boxModalStat} transparent animationType="slide" onRequestClose={() => setBoxModalStat(null)}>
        <Pressable style={styles.backdrop} onPress={() => setBoxModalStat(null)} />
        <View style={styles.sheetWrapper}>
          <View style={[styles.sheet, { backgroundColor: colors.card }]}>
            <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />
            {boxModalStat && (() => {
              const bc = boxColor(boxModalStat.box_number);
              return (
                <>
                  <View style={styles.boxModalHeader}>
                    <View style={[styles.boxModalBadge, { backgroundColor: bc.bg, borderColor: bc.text + '40' }]}>
                      <Text style={[styles.boxModalBadgeText, { color: bc.text }]}>{t('common.box', { n: boxModalStat.box_number })}</Text>
                    </View>
                    <Text style={styles.boxModalCount}>{t('home.boxWords', { count: boxModalStat.count })}</Text>
                  </View>

                  {loadingBoxWords ? (
                    <ActivityIndicator color="#4F46E5" style={{ marginVertical: 24 }} />
                  ) : boxWords.length === 0 ? (
                    <Text style={styles.boxModalEmpty}>{t('home.boxEmpty')}</Text>
                  ) : (
                    <FlatList
                      data={boxWords}
                      keyExtractor={(item) => item.id}
                      style={styles.boxWordList}
                      showsVerticalScrollIndicator={false}
                      ItemSeparatorComponent={() => <View style={styles.boxWordSeparator} />}
                      renderItem={({ item }) => {
                        const isDueToday = item.next_review_at ? (() => {
                          const d = new Date(item.next_review_at);
                          const n = new Date();
                          return d.setHours(0,0,0,0) <= n.setHours(0,0,0,0);
                        })() : false;
                        return (
                          <View style={styles.boxWordRow}>
                            <Text style={styles.boxWordText}>{item.word.toUpperCase()}</Text>
                            <Text style={[styles.boxWordDate, isDueToday ? { color: '#F97316', fontWeight: '800' } : {}]}>
                              {item.next_review_at ? relativeDate(item.next_review_at) : '—'}
                            </Text>
                          </View>
                        );
                      }}
                    />
                  )}
                </>
              );
            })()}
          </View>
        </View>
      </Modal>

      {/* Modal: agregar palabra */}
      <Modal visible={addModalVisible} transparent animationType="slide" onRequestClose={handleCloseAdd}>
        <Pressable style={styles.backdrop} onPress={handleCloseAdd} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.sheetWrapper}>
          <View style={[styles.sheet, { backgroundColor: colors.card }]}>
            <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />
            <View style={styles.addModalTitleRow}>
              <Text style={[styles.sheetTitle, { color: colors.text }]}>{t('home.newWord')}</Text>
              {savedCount > 0 && (
                <View style={styles.sessionBadge}>
                  <Text style={styles.sessionBadgeText}>{t('home.sessionCount', { count: savedCount })}</Text>
                </View>
              )}
            </View>
            <Animated.View style={[styles.savedBanner, { opacity: bannerOpacity }]}>
              <Text style={styles.savedBannerText}>✓ {lastSaved ? t('home.wordSaved', { word: lastSaved }) : ''}</Text>
            </Animated.View>
            <Text style={styles.label}>{t('home.wordInEnglish')}</Text>
            <TextInput
              ref={wordInputRef}
              style={styles.input}
              placeholder={t('home.wordPlaceholder')}
              placeholderTextColor="#94A3B8"
              value={word}
              onChangeText={(v) => { setWord(v); setWordDuplicate(false); }}
              autoCapitalize="none"
              autoFocus
            />
            {wordDuplicate && (
              <Text style={styles.duplicateWarning}>{t('home.wordAlreadyExists')}</Text>
            )}
            <Text style={styles.label}>{t('home.meaning')}</Text>
            <TextInput
              style={[styles.input, styles.inputMultiline]}
              placeholder={t('home.meaningPlaceholder')}
              placeholderTextColor="#94A3B8"
              value={meaning}
              onChangeText={setMeaning}
              multiline
              numberOfLines={3}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelButton} onPress={handleCloseAdd} activeOpacity={0.8}>
                <Text style={styles.cancelText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveButton, (!word.trim() || !meaning.trim()) && styles.saveButtonDisabled]}
                onPress={handleSave}
                activeOpacity={0.8}
              >
                <Text style={styles.saveText}>{t('common.save')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Modal: confirmación Study Today */}
      <Modal visible={confirmVisible} transparent animationType="fade" onRequestClose={() => setConfirmVisible(false)}>
        <Pressable style={styles.confirmOverlay} onPress={() => setConfirmVisible(false)}>
          <Pressable style={[styles.confirmModal, { backgroundColor: colors.card }]} onPress={() => {}}>
            <Text style={[styles.confirmTitle, { color: colors.text }]}>📚 {t('home.confirmTitle')}</Text>

            {previewLoading ? (
              <ActivityIndicator color="#4F46E5" style={{ marginVertical: 12 }} />
            ) : previewWords.length > 0 ? (
              <View style={styles.confirmSection}>
                <Text style={styles.confirmSectionLabel}>✨ {t('home.confirmNewWords', { count: previewWords.length })}</Text>
                <ScrollView style={styles.confirmWordList} showsVerticalScrollIndicator={false} nestedScrollEnabled>
                  {previewWords.map((w, i) => (
                    <View key={w.id} style={[styles.confirmWordRow, i < previewWords.length - 1 && styles.confirmWordRowBorder]}>
                      <Text style={styles.confirmWordText}>{w.word}</Text>
                      <Text style={styles.confirmWordMeaning} numberOfLines={1}>{w.meaning}</Text>
                    </View>
                  ))}
                </ScrollView>
              </View>
            ) : null}

            {dueCount > 0 && (
              <View style={styles.confirmReviewRow}>
                <Text style={styles.confirmReviewText}>🎯 {t('home.confirmReview', { count: dueCount })}</Text>
              </View>
            )}

            <View style={styles.confirmActions}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setConfirmVisible(false)} activeOpacity={0.8}>
                <Text style={styles.cancelText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveButton} onPress={startCombinedStudy} activeOpacity={0.8}>
                <Text style={styles.saveText}>{t('home.confirmStart')}</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Modal: palabras del repertorio */}
      <Modal visible={repertoireModalVisible} transparent animationType="slide" onRequestClose={() => setRepertoireModalVisible(false)}>
        <Pressable style={styles.backdrop} onPress={() => setRepertoireModalVisible(false)} />
        <View style={styles.sheetWrapper}>
          <View style={[styles.sheet, { backgroundColor: colors.card }]}>
            <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />
            <View style={styles.boxModalHeader}>
              <View style={[styles.boxModalBadge, { backgroundColor: '#F5F3FF', borderColor: '#7C3AED40' }]}>
                <Text style={[styles.boxModalBadgeText, { color: '#7C3AED' }]}>{t('common.repertoire')}</Text>
              </View>
              <Text style={[styles.boxModalCount, { color: colors.textSub }]}>{t('home.boxWords', { count: repertorioCount })}</Text>
            </View>
            {loadingRepertoireWords ? (
              <ActivityIndicator color="#7C3AED" style={{ marginVertical: 24 }} />
            ) : repertoireWords.length === 0 ? (
              <Text style={styles.boxModalEmpty}>{t('home.boxEmpty')}</Text>
            ) : (
              <FlatList
                data={repertoireWords}
                keyExtractor={(item) => item.id}
                style={styles.boxWordList}
                showsVerticalScrollIndicator={false}
                ItemSeparatorComponent={() => <View style={styles.boxWordSeparator} />}
                renderItem={({ item }) => (
                  <View style={styles.repWordRow}>
                    <Text style={styles.boxWordText}>{item.word.toUpperCase()}</Text>
                    <Text style={styles.repWordMeaning} numberOfLines={1}>{item.meaning}</Text>
                  </View>
                )}
              />
            )}
          </View>
        </View>
      </Modal>

      {/* Modal: heatmap top 20 */}
      <Modal visible={heatmapVisible} transparent animationType="fade" onRequestClose={() => setHeatmapVisible(false)}>
        <Pressable style={styles.heatmapOverlay} onPress={() => setHeatmapVisible(false)}>
          <Pressable style={[styles.heatmapModal, { backgroundColor: colors.card }]} onPress={() => {}}>
            <Text style={styles.heatmapModalTitle}>📊 {t('home.heatmapTitle')}</Text>
            <Text style={styles.heatmapSubText}>{t('home.heatmapSub')}</Text>

            {hardestVocab.length === 0 ? (
              <Text style={styles.heatmapEmpty}>{t('home.heatmapEmpty')}</Text>
            ) : (
              <View
                style={styles.treemapContainer}
                onLayout={(e) => setTmDims({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
              >
                {tmRects.map((rect, idx) => {
                  if (!rect) return null;
                  const item = hardestVocab[idx];
                  const maxFails = hardestVocab[0]?.fail_count ?? 1;
                  const ratio = maxFails > 0 ? item.fail_count / maxFails : 0;
                  const { bg, text: tc } = tmColor(ratio);
                  return (
                    <View
                      key={item.id}
                      style={[styles.treemapCell, { left: rect.x, top: rect.y, width: rect.w, height: rect.h, backgroundColor: bg }]}
                    >
                      {rect.w > 44 && rect.h > 30 && (
                        <Text style={[styles.treemapWord, { color: tc }]} numberOfLines={2}>{item.word}</Text>
                      )}
                      {rect.h > 48 && (
                        <Text style={[styles.treemapCount, { color: tc }]}>{item.fail_count}×</Text>
                      )}
                    </View>
                  );
                })}
              </View>
            )}

            <TouchableOpacity style={styles.heatmapCloseBtn} onPress={() => setHeatmapVisible(false)} activeOpacity={0.8}>
              <Text style={styles.heatmapCloseBtnText}>{t('common.cancel')}</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Modal: mascot stages */}
      <Modal visible={mascotModalVisible} transparent animationType="fade" onRequestClose={() => setMascotModalVisible(false)}>
        <Pressable style={styles.confirmOverlay} onPress={() => setMascotModalVisible(false)}>
          <Pressable style={[styles.mascotModal, { backgroundColor: colors.card }]} onPress={() => {}}>
            {(() => {
              const theme = STREAK_THEMES.find(th => th.id === mascotTheme) ?? STREAK_THEMES[0];
              const currentStage = getStageIndex(streak);
              return (
                <>
                  <Text style={[styles.mascotModalTitle, { color: colors.text }]}>
                    {theme.stages[currentStage]} {t(theme.nameKey)}
                  </Text>
                  <Text style={[styles.mascotModalSub, { color: colors.textMuted }]}>
                    {t('home.mascotProgress', { count: streak })}
                  </Text>
                  <View style={[styles.mascotDivider, { backgroundColor: colors.border }]} />
                  <View style={styles.mascotStagesList}>
                    {theme.stages.map((emoji, i) => {
                      const isActive = i === currentStage;
                      const isDone = i < currentStage;
                      const isLocked = i > currentStage;
                      return (
                        <View key={i} style={[styles.mascotStageRow, isActive && styles.mascotStageRowActive]}>
                          <Text style={styles.mascotStageEmoji}>{emoji}</Text>
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.mascotStageLabel, { color: isLocked ? colors.textMuted : colors.text }]}>
                              {t('home.mascotStage', { n: i + 1 })}
                            </Text>
                            <Text style={[styles.mascotStageDays, { color: colors.textMuted }]}>
                              {STAGE_MILESTONES[i] === 0
                                ? t('home.mascotDay0')
                                : t('home.mascotDayN', { count: STAGE_MILESTONES[i] })}
                            </Text>
                          </View>
                          {isDone && <Text style={styles.mascotDoneIcon}>✓</Text>}
                          {isActive && <View style={styles.mascotActivePill}><Text style={styles.mascotActivePillText}>{t('home.mascotCurrent')}</Text></View>}
                          {isLocked && <Text style={[styles.mascotLockIcon, { color: colors.textMuted }]}>🔒</Text>}
                        </View>
                      );
                    })}
                  </View>
                  <TouchableOpacity
                    style={styles.mascotCloseBtn}
                    onPress={() => setMascotModalVisible(false)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.mascotCloseBtnText}>{t('common.cancel')}</Text>
                  </TouchableOpacity>
                </>
              );
            })()}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  quoteBlock: { paddingTop: 8, paddingBottom: 8 },
  greeting: { fontSize: 22, fontWeight: '700', color: '#0F172A' },
  quoteText: { fontSize: 13, color: '#475569', marginTop: 4, fontStyle: 'italic', lineHeight: 18 },
  quoteAuthor: { fontSize: 11, color: '#94A3B8', marginTop: 2, fontWeight: '600' },
  subtitle: { fontSize: 15, color: '#64748B', marginTop: 4 },
  scroll: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 40, gap: 16 },
  boxesSection: { gap: 10 },
  boxesSectionTitle: { fontSize: 13, fontWeight: '700', color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.8 },
  boxesRow: { gap: 10, paddingBottom: 4 },
  boxCard: {
    width: 100, borderRadius: 14, padding: 12,
    alignItems: 'center', gap: 2,
    borderWidth: 1,
  },
  boxCardLabel: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  boxCardCount: { fontSize: 28, fontWeight: '800', marginTop: 2 },
  boxCardWordLabel: { fontSize: 10, color: '#94A3B8', fontWeight: '500', marginBottom: 4 },
  boxDuePill: { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3, marginTop: 2, backgroundColor: '#F97316' },
  boxDuePillText: { fontSize: 10, fontWeight: '800', color: '#FFFFFF' },
  boxNextDate: { fontSize: 11, fontWeight: '600', marginTop: 2 },
  boxEmpty: { fontSize: 10, color: '#CBD5E1', marginTop: 2 },
  card: {
    backgroundColor: '#FFFFFF', borderRadius: 16, padding: 20, borderLeftWidth: 4,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 3, gap: 14,
  },
  cardInactive: { opacity: 0.6 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  emoji: { fontSize: 36 },
  cardText: { flex: 1 },
  cardTitle: { fontSize: 18, fontWeight: '600', color: '#0F172A' },
  cardDescription: { fontSize: 14, color: '#64748B', marginTop: 2 },
  cardCountBlock: { alignItems: 'center', gap: 2 },
  cardCountNumber: { fontSize: 28, fontWeight: '800', lineHeight: 32 },
  cardChevron: { fontSize: 14, color: '#CBD5E1', fontWeight: '600' },
  badge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  badgeText: { fontSize: 12, fontWeight: '600' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheetWrapper: { justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: 48, gap: 12,
  },
  sheetHandle: { width: 40, height: 4, backgroundColor: '#E2E8F0', borderRadius: 2, alignSelf: 'center', marginBottom: 8 },
  sheetTitle: { fontSize: 20, fontWeight: '700', color: '#0F172A' },
  sheetSubtitle: { fontSize: 14, color: '#64748B', marginBottom: 8 },
  importBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 14, paddingHorizontal: 20,
    backgroundColor: '#F8FAFC', borderRadius: 14,
    borderWidth: 1, borderColor: '#E2E8F0', borderStyle: 'dashed',
  },
  importBtnIcon: { fontSize: 18 },
  importBtnText: { fontSize: 14, fontWeight: '600', color: '#64748B' },
  csvInstructions: { fontSize: 14, color: '#64748B', lineHeight: 20 },
  csvExampleBox: {
    backgroundColor: '#0F172A', borderRadius: 10,
    padding: 14, gap: 6,
  },
  csvExampleLabel: { fontSize: 11, fontWeight: '700', color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.5 },
  csvExampleCode: { fontSize: 13, color: '#7DD3FC', fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', lineHeight: 20 },
  csvError: { fontSize: 13, color: '#EF4444', fontWeight: '500', textAlign: 'center' },
  csvPickBtn: {
    backgroundColor: '#4F46E5', borderRadius: 14, padding: 16, alignItems: 'center',
  },
  csvPickBtnText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
  csvPreviewHeader: { gap: 2 },
  csvPreviewTitle: { fontSize: 17, fontWeight: '700', color: '#0F172A' },
  csvPreviewSub: { fontSize: 13, color: '#94A3B8' },
  csvTableHeader: {
    flexDirection: 'row', backgroundColor: '#F1F5F9',
    borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8,
  },
  csvTableHeaderText: { fontSize: 11, fontWeight: '700', color: '#64748B', textTransform: 'uppercase' },
  csvTableRow: { flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 8 },
  csvTableCell: { flex: 1, fontSize: 13, color: '#0F172A' },
  csvWordCell: { fontWeight: '600', color: '#4F46E5' },
  csvMeaningCell: { color: '#475569' },
  csvList: { maxHeight: 260 },
  csvMoreText: { fontSize: 12, color: '#94A3B8', textAlign: 'center' },
  csvLoadingBox: { paddingVertical: 40, alignItems: 'center' },
  csvDoneBox: { alignItems: 'center', gap: 10, paddingVertical: 12 },
  csvDoneIcon: { fontSize: 48 },
  csvDoneTitle: { fontSize: 20, fontWeight: '800', color: '#0F172A' },
  csvDoneSub: { fontSize: 15, color: '#64748B', textAlign: 'center', marginBottom: 8 },
  hardestSection: { gap: 6 },
  hardestSectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  hardestSectionTitle: { fontSize: 13, fontWeight: '700', color: '#F97316', textTransform: 'uppercase', letterSpacing: 0.5 },
  hardestSectionSub: { fontSize: 12, color: '#94A3B8' },
  heatmapBtn: {
    backgroundColor: '#FFF7ED', borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 6,
    borderWidth: 1.5, borderColor: '#FED7AA',
  },
  heatmapBtnText: { fontSize: 12, fontWeight: '700', color: '#EA580C' },
  hardestRow: { gap: 10, paddingBottom: 4, paddingTop: 8 },
  hardestCard: {
    width: 175, backgroundColor: '#FFF7ED',
    borderRadius: 16, padding: 14, gap: 8,
    borderWidth: 1, borderColor: '#FED7AA',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  hardestCardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  hardestRank: { fontSize: 18 },
  hardestBadge: { backgroundColor: '#FFEDD5', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  hardestBadgeText: { fontSize: 11, fontWeight: '700', color: '#EA580C' },
  hardestWord: { fontSize: 18, fontWeight: '800', color: '#0F172A', letterSpacing: 0.3 },
  hardestMeaning: { fontSize: 12, color: '#64748B', lineHeight: 17 },
  studyTodayBadges: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  boxModalHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 },
  boxModalBadge: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, borderWidth: 1 },
  boxModalBadgeText: { fontSize: 14, fontWeight: '800' },
  boxModalCount: { fontSize: 14, color: '#64748B', fontWeight: '500' },
  boxModalEmpty: { fontSize: 14, color: '#94A3B8', textAlign: 'center', marginVertical: 24 },
  boxWordList: { maxHeight: 360 },
  boxWordRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10 },
  boxWordText: { fontSize: 15, fontWeight: '700', color: '#0F172A', flex: 1 },
  boxWordDate: { fontSize: 13, color: '#94A3B8', fontWeight: '500' },
  boxWordSeparator: { height: 1, backgroundColor: '#F1F5F9' },
  addModalTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  sessionBadge: { backgroundColor: '#DCFCE7', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 },
  sessionBadgeText: { fontSize: 12, fontWeight: '700', color: '#16A34A' },
  savedBanner: {
    backgroundColor: '#F0FDF4', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10,
    borderWidth: 1, borderColor: '#BBF7D0',
  },
  savedBannerText: { fontSize: 14, fontWeight: '600', color: '#15803D' },
  label: { fontSize: 13, fontWeight: '600', color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { backgroundColor: '#F1F5F9', borderRadius: 12, padding: 14, fontSize: 16, color: '#0F172A' },
  inputMultiline: { height: 90, textAlignVertical: 'top' },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 8 },
  cancelButton: { flex: 1, padding: 14, borderRadius: 12, backgroundColor: '#F1F5F9', alignItems: 'center' },
  cancelText: { fontSize: 16, fontWeight: '600', color: '#64748B' },
  saveButton: { flex: 1, padding: 14, borderRadius: 12, backgroundColor: '#4F46E5', alignItems: 'center' },
  saveButtonDisabled: { opacity: 0.4 },
  saveText: { fontSize: 16, fontWeight: '600', color: '#FFFFFF' },
  duplicateWarning: { fontSize: 13, fontWeight: '600', color: '#EF4444', marginTop: -4 },
  csvSkippedText: { fontSize: 13, color: '#F97316', fontWeight: '600', textAlign: 'center' },
  csvDoneCloseBtn: { flex: 0, alignSelf: 'stretch' },

  streakBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: 16, padding: 16, borderLeftWidth: 4,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
  },
  streakBannerDone:  { backgroundColor: '#F0FDF4', borderLeftColor: '#16A34A' },
  streakBannerRisk:  { backgroundColor: '#FFFBEB', borderLeftColor: '#F59E0B' },
  streakBannerZero:  { backgroundColor: '#EFF6FF', borderLeftColor: '#3B82F6' },
  mascotBtn: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: 'rgba(0,0,0,0.06)',
    alignItems: 'center', justifyContent: 'center',
  },
  mascotEmoji: { fontSize: 28 },
  mascotModal: {
    borderRadius: 24, padding: 24, width: '100%', gap: 0,
  },
  mascotModalTitle: { fontSize: 22, fontWeight: '800', marginBottom: 4 },
  mascotModalSub: { fontSize: 13, marginBottom: 16 },
  mascotDivider: { height: 1, marginBottom: 16 },
  mascotStagesList: { gap: 4, marginBottom: 20 },
  mascotStageRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 12, borderRadius: 14,
  },
  mascotStageRowActive: { backgroundColor: '#EEF2FF' },
  mascotStageEmoji: { fontSize: 28, width: 36, textAlign: 'center' },
  mascotStageLabel: { fontSize: 14, fontWeight: '700' },
  mascotStageDays: { fontSize: 12, marginTop: 1 },
  mascotDoneIcon: { fontSize: 16, color: '#16A34A', fontWeight: '800' },
  mascotActivePill: { backgroundColor: '#4F46E5', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 },
  mascotActivePillText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  mascotLockIcon: { fontSize: 14 },
  mascotCloseBtn: { backgroundColor: '#F1F5F9', borderRadius: 12, padding: 14, alignItems: 'center' },
  mascotCloseBtnText: { fontSize: 15, fontWeight: '600', color: '#64748B' },
  streakTitle: { fontSize: 15, fontWeight: '800' },
  streakSub: { fontSize: 12, fontWeight: '500', marginTop: 2 },
  streakArrow: { fontSize: 26, fontWeight: '300' },
  streakCheckBadge: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: '#16A34A', alignItems: 'center', justifyContent: 'center',
  },
  streakCheckText: { color: '#fff', fontSize: 16, fontWeight: '800' },

  repWordRow: { paddingVertical: 10, gap: 2 },
  repWordMeaning: { fontSize: 12, color: '#94A3B8' },

  // Confirm study modal
  confirmOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  confirmModal: { backgroundColor: '#FFFFFF', borderRadius: 24, padding: 24, width: '100%', gap: 14 },
  confirmTitle: { fontSize: 20, fontWeight: '800', color: '#0F172A' },
  confirmSection: { backgroundColor: '#F8FAFC', borderRadius: 16, padding: 4, overflow: 'hidden' },
  confirmSectionLabel: { fontSize: 13, fontWeight: '700', color: '#4F46E5', paddingHorizontal: 12, paddingVertical: 10 },
  confirmWordList: { maxHeight: 220 },
  confirmWordRow: { paddingHorizontal: 12, paddingVertical: 10 },
  confirmWordRowBorder: { borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  confirmWordText: { fontSize: 15, fontWeight: '700', color: '#0F172A' },
  confirmWordMeaning: { fontSize: 12, color: '#94A3B8', marginTop: 1 },
  confirmReviewRow: { backgroundColor: '#E0F2FE', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 },
  confirmReviewText: { fontSize: 14, fontWeight: '600', color: '#0284C7' },
  confirmActions: { flexDirection: 'row', gap: 12, marginTop: 4 },

  // Heatmap modal
  heatmapOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  heatmapModal: { backgroundColor: '#FFFFFF', borderRadius: 24, padding: 24, width: '100%', maxHeight: '80%', gap: 12 },
  heatmapModalTitle: { fontSize: 20, fontWeight: '800', color: '#0F172A' },
  heatmapSubText: { fontSize: 13, color: '#94A3B8', lineHeight: 18 },
  heatmapEmpty: { fontSize: 14, color: '#94A3B8', textAlign: 'center', marginVertical: 24 },
  treemapContainer: { height: 320, position: 'relative', borderRadius: 12, overflow: 'hidden', backgroundColor: '#1E293B' },
  treemapCell: { position: 'absolute', padding: 7, justifyContent: 'flex-end', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.15)' },
  treemapWord: { fontSize: 11, fontWeight: '800', lineHeight: 14 },
  treemapCount: { fontSize: 10, fontWeight: '700', opacity: 0.75, marginTop: 1 },
  heatmapCloseBtn: { backgroundColor: '#F1F5F9', borderRadius: 12, padding: 14, alignItems: 'center', marginTop: 4 },
  heatmapCloseBtnText: { fontSize: 15, fontWeight: '600', color: '#64748B' },
  loadingContainer: { justifyContent: 'center', alignItems: 'center', gap: 8 },
  loadingLogo: { fontSize: 36, fontWeight: '800', color: '#4F46E5', letterSpacing: -1 },
  loadingText: { fontSize: 14, fontWeight: '500', marginTop: 8 },
});
