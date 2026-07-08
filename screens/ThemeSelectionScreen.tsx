import { useState } from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity, ScrollView, Platform, StatusBar,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTranslation } from 'react-i18next';
import { STREAK_THEMES, StreakTheme } from '../constants/streakThemes';

export default function ThemeSelectionScreen({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleStart() {
    if (!selected || saving) return;
    setSaving(true);
    await AsyncStorage.setItem('streak_theme', selected);
    onDone();
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>{t('themeSelect.title')}</Text>
          <Text style={styles.subtitle}>{t('themeSelect.subtitle')}</Text>
        </View>

        <View style={styles.grid}>
          {STREAK_THEMES.map((theme) => {
            const isSelected = selected === theme.id;
            return (
              <TouchableOpacity
                key={theme.id}
                style={[styles.card, isSelected && styles.cardSelected]}
                onPress={() => setSelected(theme.id)}
                activeOpacity={0.8}
              >
                {isSelected && <View style={styles.cardCheckBadge}><Text style={styles.cardCheck}>✓</Text></View>}
                <Text style={styles.cardMainEmoji}>{theme.stages[0]}</Text>
                <Text style={styles.cardName}>{t(theme.nameKey)}</Text>
                <View style={styles.stagesRow}>
                  {theme.stages.map((emoji, i) => (
                    <Text key={i} style={styles.stageEmoji}>{emoji}</Text>
                  ))}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.startBtn, !selected && styles.startBtnDisabled]}
          onPress={handleStart}
          activeOpacity={0.8}
          disabled={!selected || saving}
        >
          <Text style={styles.startBtnText}>{t('themeSelect.start')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A' },
  content: { paddingHorizontal: 24, paddingTop: Platform.OS === 'ios' ? 60 : 40, paddingBottom: 120 },
  header: { marginBottom: 32, gap: 8 },
  title: { fontSize: 30, fontWeight: '800', color: '#F1F5F9' },
  subtitle: { fontSize: 15, color: '#94A3B8', lineHeight: 22 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  card: {
    width: '47.5%', backgroundColor: '#1E293B', borderRadius: 20,
    padding: 16, alignItems: 'center', gap: 8,
    borderWidth: 2, borderColor: 'transparent',
  },
  cardSelected: { borderColor: '#4F46E5', backgroundColor: '#1E1B4B' },
  cardCheckBadge: {
    position: 'absolute', top: 10, right: 10,
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: '#4F46E5', alignItems: 'center', justifyContent: 'center',
  },
  cardCheck: { color: '#fff', fontSize: 12, fontWeight: '800' },
  cardMainEmoji: { fontSize: 44, marginTop: 4 },
  cardName: { fontSize: 14, fontWeight: '700', color: '#F1F5F9' },
  stagesRow: { flexDirection: 'row', gap: 2, marginTop: 2 },
  stageEmoji: { fontSize: 13 },
  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    padding: 24, paddingBottom: Platform.OS === 'ios' ? 48 : 24,
    backgroundColor: '#0F172A',
    borderTopWidth: 1, borderTopColor: '#1E293B',
  },
  startBtn: {
    backgroundColor: '#4F46E5', borderRadius: 16, padding: 18,
    alignItems: 'center',
    shadowColor: '#4F46E5', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 12, elevation: 6,
  },
  startBtnDisabled: { opacity: 0.35, shadowOpacity: 0 },
  startBtnText: { color: '#FFFFFF', fontSize: 17, fontWeight: '800' },
});
