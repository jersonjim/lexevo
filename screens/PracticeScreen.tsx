import { useState, useCallback } from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity, Alert, ScrollView, ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { getAllRepertorioWords, BOX_INTERVALS, StudyWord } from '../services/leitner';
import { useTheme } from '../context/ThemeContext';
import { supabase } from '../supabase';

const BOX_COLORS: Record<number, { bg: string; text: string }> = {
  1: { bg: '#FEF2F2', text: '#EF4444' },
  2: { bg: '#FFF7ED', text: '#F97316' },
  3: { bg: '#FEFCE8', text: '#CA8A04' },
  4: { bg: '#F0FDF4', text: '#16A34A' },
  5: { bg: '#F0F9FF', text: '#0284C7' },
  6: { bg: '#F5F3FF', text: '#7C3AED' },
  7: { bg: '#FDF4FF', text: '#A21CAF' },
};

const BOX_MODES: Record<number, { emoji: string; nameKey: string }> = {
  1: { emoji: '🃏', nameKey: 'study.modeBox1Short' },
  2: { emoji: '✍️', nameKey: 'study.modeBox2Short' },
  3: { emoji: '🔤', nameKey: 'study.modeBox3Short' },
  4: { emoji: '⏱️', nameKey: 'study.modeBox4Short' },
  5: { emoji: '🃏', nameKey: 'study.modeBox1Short' },
  6: { emoji: '🃏', nameKey: 'study.modeBox1Short' },
  7: { emoji: '🃏', nameKey: 'study.modeBox1Short' },
};

const INTERVALS = BOX_INTERVALS[7]; // [1, 2, 4, 7, 14, 30, 60]

function buildRows(count: number): number[][] {
  const rows: number[][] = [];
  for (let i = 1; i <= count; i += 2) {
    rows.push(i + 1 <= count ? [i, i + 1] : [i]);
  }
  return rows;
}

export default function PracticeScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const navigation = useNavigation<any>();

  const [repertoireCount, setRepertoireCount] = useState(0);
  const [boxCount, setBoxCount] = useState<number | null>(null);
  const [loading, setLoading] = useState<number | null>(null);

  useFocusEffect(
    useCallback(() => {
      async function load() {
        const [words, { data: { user } }] = await Promise.all([
          getAllRepertorioWords(),
          supabase.auth.getUser(),
        ]);
        setRepertoireCount(words.length);
        if (user) {
          const { data } = await supabase
            .from('profiles')
            .select('box_count')
            .eq('id', user.id)
            .single();
          setBoxCount(data?.box_count ?? 5);
        }
      }
      load();
    }, [])
  );

  async function handleStart(boxNum: number) {
    setLoading(boxNum);
    try {
      const repertoireWords = await getAllRepertorioWords();
      if (repertoireWords.length === 0) {
        Alert.alert(t('practice.noWordsTitle'), t('practice.noWords'));
        return;
      }
      // Fisher-Yates shuffle
      const arr = [...repertoireWords];
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      const words: StudyWord[] = arr.slice(0, 20).map(w => ({ ...w, box_number: boxNum }));
      navigation.navigate('Study', { words, boxCount: 7, practiceMode: true });
    } finally {
      setLoading(null);
    }
  }

  const isDisabled = loading !== null || repertoireCount === 0;

  function renderCard(boxNum: number, flex?: number) {
    const bc = BOX_COLORS[boxNum];
    const mode = BOX_MODES[boxNum];
    const intervalDays = INTERVALS[boxNum - 1];
    const isLoading = loading === boxNum;

    return (
      <View
        key={boxNum}
        style={[
          styles.card,
          { backgroundColor: colors.card, flex: flex ?? 1 },
        ]}
      >
        {/* Box pill */}
        <View style={[styles.boxPill, { backgroundColor: bc.bg }]}>
          <Text style={[styles.boxPillText, { color: bc.text }]}>
            {t('common.box', { n: boxNum })}
          </Text>
        </View>

        {/* Mode emoji + name */}
        <Text style={styles.modeEmoji}>{mode.emoji}</Text>
        <Text style={[styles.modeName, { color: colors.text }]} numberOfLines={2}>
          {t(mode.nameKey)}
        </Text>

        {/* Interval badge */}
        <View style={[styles.intervalBadge, { backgroundColor: colors.bg }]}>
          <Text style={[styles.intervalText, { color: colors.textMuted }]}>
            {'🗓️ '}{intervalDays}d
          </Text>
        </View>

        {/* Start button */}
        <TouchableOpacity
          style={[
            styles.startButton,
            { backgroundColor: bc.text },
            isDisabled && styles.startButtonDisabled,
          ]}
          onPress={() => handleStart(boxNum)}
          activeOpacity={0.8}
          disabled={isDisabled}
        >
          <Text style={styles.startButtonText}>
            {isLoading ? '...' : t('practice.start')}
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.bg }]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>{t('practice.title')}</Text>
        <Text style={[styles.subtitle, { color: colors.textSub }]}>{t('practice.subtitle')}</Text>

        {/* Repertoire count badge */}
        <View style={[styles.repertoireBadge, { backgroundColor: colors.card }]}>
          <Text style={[styles.repertoireBadgeLabel, { color: colors.textMuted }]}>
            {t('practice.repertoireLabel')}
          </Text>
          <Text style={[styles.repertoireBadgeCount, { color: colors.text }]}>
            {t('practice.words', { count: repertoireCount })}
          </Text>
        </View>
      </View>

      {/* Grid: pairs of boxes, last odd box gets full width */}
      {boxCount === null ? (
        <ActivityIndicator size="large" color="#4F46E5" style={{ marginTop: 40 }} />
      ) : (
        buildRows(boxCount).map((row, ri) => (
          <View key={ri} style={row.length === 1 ? styles.rowSingle : styles.row}>
            {row.map(n => renderCard(n))}
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 20, paddingBottom: 40 },

  header: { paddingTop: 24, paddingBottom: 20, gap: 6 },
  title: { fontSize: 26, fontWeight: '800' },
  subtitle: { fontSize: 14, fontWeight: '500', marginBottom: 8 },

  repertoireBadge: {
    borderRadius: 14, paddingVertical: 12, paddingHorizontal: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  repertoireBadgeLabel: { fontSize: 13, fontWeight: '600' },
  repertoireBadgeCount: { fontSize: 15, fontWeight: '800' },

  row: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  rowSingle: { flexDirection: 'row', marginBottom: 12 },

  card: {
    borderRadius: 20, padding: 16, gap: 8,
    alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 10, elevation: 3,
  },

  boxPill: {
    borderRadius: 20, paddingVertical: 4, paddingHorizontal: 12,
  },
  boxPillText: { fontSize: 12, fontWeight: '700' },

  modeEmoji: { fontSize: 28, marginTop: 4 },
  modeName: { fontSize: 12, fontWeight: '600', textAlign: 'center', lineHeight: 16 },

  intervalBadge: {
    borderRadius: 10, paddingVertical: 3, paddingHorizontal: 8,
    marginTop: 2,
  },
  intervalText: { fontSize: 11, fontWeight: '600' },

  startButton: {
    borderRadius: 12, paddingVertical: 10, paddingHorizontal: 20,
    alignItems: 'center', marginTop: 4, alignSelf: 'stretch',
  },
  startButtonDisabled: { opacity: 0.4 },
  startButtonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
});
