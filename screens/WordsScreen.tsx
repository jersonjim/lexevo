import { useState, useCallback, useMemo } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  StyleSheet, Text, View, FlatList, TouchableOpacity,
  Modal, TextInput, KeyboardAvoidingView, Platform, Pressable,
  Alert, ActivityIndicator, ScrollView,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import i18n from '../i18n';
import { getAllWords, updateWord, deleteWord, Word } from '../services/words';
import { getWordBoxHistory, getLastStudyEntry, BoxHistoryEntry, LastStudyEntry } from '../services/leitner';
import { useTheme } from '../context/ThemeContext';

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  const date = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.round((date.setHours(0,0,0,0) - now.setHours(0,0,0,0)) / 86400000);
  if (diffDays === 0) return i18n.t('common.today');
  if (diffDays === 1) return i18n.t('common.tomorrow');
  if (diffDays === -1) return i18n.t('common.yesterday');
  if (diffDays > 1 && diffDays <= 30) return i18n.t('common.inDays', { count: diffDays });
  if (diffDays < -1 && diffDays >= -30) return i18n.t('common.daysAgo', { count: Math.abs(diffDays) });
  const locale = i18n.language === 'en' ? 'en-US' : 'es-ES';
  return new Date(dateStr).toLocaleDateString(locale, { day: '2-digit', month: '2-digit', year: '2-digit' });
}

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

const BOX_STYLE: Record<number, { bg: string; text: string }> = {
  0: { bg: '#F1F5F9', text: '#64748B' },
  1: { bg: '#FEF2F2', text: '#EF4444' },
  2: { bg: '#FFF7ED', text: '#F97316' },
  3: { bg: '#FEFCE8', text: '#CA8A04' },
  4: { bg: '#F0FDF4', text: '#16A34A' },
  5: { bg: '#F0F9FF', text: '#0284C7' },
  6: { bg: '#F5F3FF', text: '#7C3AED' },
  7: { bg: '#FDF4FF', text: '#A21CAF' },
};

function getBoxStyle(box: number) {
  return BOX_STYLE[box] ?? BOX_STYLE[7];
}

export default function WordsScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const boxLabel = (n: number) => n === 0 ? t('common.repertoire') : t('common.box', { n });
  const [words, setWords] = useState<Word[]>([]);
  const [searchText, setSearchText] = useState('');
  const [selectedLetter, setSelectedLetter] = useState<string | null>(null);

  const [selectedWord, setSelectedWord] = useState<Word | null>(null);
  const [wordText, setWordText] = useState('');
  const [meaningText, setMeaningText] = useState('');
  const [history, setHistory] = useState<BoxHistoryEntry[]>([]);
  const [lastStudy, setLastStudy] = useState<LastStudyEntry | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      getAllWords().then(data => { setWords(data); setLoading(false); });
    }, [])
  );

  const filteredWords = useMemo(() => {
    if (searchText.length >= 3) {
      const q = searchText.toLowerCase();
      return words.filter(
        (w) => w.word.toLowerCase().includes(q) || w.meaning.toLowerCase().includes(q)
      );
    }
    if (selectedLetter) {
      return words.filter((w) => w.word[0]?.toUpperCase() === selectedLetter);
    }
    return words;
  }, [words, searchText, selectedLetter]);

  const availableLetters = useMemo(
    () => new Set(words.map((w) => w.word[0]?.toUpperCase())),
    [words]
  );

  function handleLetterPress(letter: string) {
    setSelectedLetter((prev) => (prev === letter ? null : letter));
    setSearchText('');
  }

  function handleSearch(text: string) {
    setSearchText(text);
    if (text.length >= 3) setSelectedLetter(null);
  }

  async function openWord(item: Word) {
    setSelectedWord(item);
    setWordText(item.word);
    setMeaningText(item.meaning);
    setHistory([]);
    setLastStudy(null);
    setLoadingHistory(true);
    const [historyData, lastStudyData] = await Promise.all([
      getWordBoxHistory(item.id),
      getLastStudyEntry(item.id),
    ]);
    setHistory(historyData);
    setLastStudy(lastStudyData);
    setLoadingHistory(false);
  }

  function handleClose() {
    setSelectedWord(null);
    setWordText('');
    setMeaningText('');
    setHistory([]);
    setLastStudy(null);
  }

  async function handleSave() {
    if (!selectedWord || !wordText.trim() || !meaningText.trim()) return;
    setSaving(true);
    await updateWord(selectedWord.id, wordText.trim(), meaningText.trim());
    setWords(await getAllWords());
    setSaving(false);
    handleClose();
  }

  function handleDelete() {
    if (!selectedWord) return;
    Alert.alert(
      t('words.deleteTitle'),
      t('words.deleteConfirm', { word: selectedWord.word }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            await deleteWord(selectedWord.id);
            setWords(await getAllWords());
            handleClose();
          },
        },
      ]
    );
  }

  const maxCount = history.reduce((m, e) => Math.max(m, e.count), 0);
  const isFiltering = searchText.length >= 3 || !!selectedLetter;
  const boxStyle = selectedWord ? getBoxStyle(selectedWord.box_number) : null;
  const isEditable = selectedWord ? selectedWord.box_number <= 1 : false;

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={[styles.header, { backgroundColor: colors.bg }]}>
        <Text style={[styles.title, { color: colors.text }]}>{t('words.title')}</Text>
        <Text style={[styles.subtitle, { color: colors.textSub }]}>
          {isFiltering
            ? `${t('words.wordCount', { count: filteredWords.length })} ${t('words.of')} ${words.length}`
            : t('words.wordCount', { count: words.length })
          }
        </Text>
      </View>

      <View style={[styles.searchRow, { backgroundColor: colors.bg }]}>
        <View style={[styles.searchBox, { backgroundColor: colors.surface }]}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder={t('words.searchPlaceholder')}
            placeholderTextColor={colors.textMuted}
            value={searchText}
            onChangeText={handleSearch}
            autoCapitalize="none"
          />
          {searchText.length > 0 && (
            <TouchableOpacity onPress={() => setSearchText('')} style={styles.clearBtn}>
              <Text style={styles.clearBtnText}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {selectedLetter && (
        <View style={styles.filterChipRow}>
          <View style={styles.filterChip}>
            <Text style={styles.filterChipText}>{t('words.letterFilter', { letter: selectedLetter })}</Text>
            <TouchableOpacity onPress={() => setSelectedLetter(null)}>
              <Text style={styles.filterChipClear}>  ✕</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <View style={styles.body}>
        {/* Sidebar alfabético */}
        <ScrollView
          style={styles.sidebar}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.sidebarContent}
        >
          {ALPHABET.map((letter) => {
            const hasWords = availableLetters.has(letter);
            const isSelected = selectedLetter === letter;
            return (
              <TouchableOpacity
                key={letter}
                style={[
                  styles.letterBtn,
                  isSelected && styles.letterBtnSelected,
                ]}
                onPress={() => hasWords && handleLetterPress(letter)}
                activeOpacity={hasWords ? 0.7 : 1}
              >
                <Text style={[
                  styles.letterText,
                  isSelected && styles.letterTextSelected,
                  !hasWords && styles.letterTextEmpty,
                ]}>
                  {letter}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Lista */}
        {loading ? (
          <View style={styles.empty}>
            <ActivityIndicator size="large" color="#4F46E5" />
          </View>
        ) : filteredWords.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>{words.length === 0 ? '📭' : '🔍'}</Text>
            <Text style={styles.emptyText}>
              {words.length === 0 ? t('words.noWords') : t('words.noResults')}
            </Text>
            {searchText.length > 0 && searchText.length < 3 && (
              <Text style={styles.emptyHint}>{t('words.searchHint')}</Text>
            )}
          </View>
        ) : (
          <FlatList
            data={filteredWords}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => {
              const bs = getBoxStyle(item.box_number);
              return (
                <TouchableOpacity style={[styles.row, { backgroundColor: colors.card }]} onPress={() => openWord(item)} activeOpacity={0.75}>
                  <View style={styles.rowTop}>
                    <Text style={[styles.wordText, { color: colors.text }]}>{item.word}</Text>
                    {item.mastered_count > 0 && (
                      <View style={styles.masteredBadge}>
                        <Text style={styles.masteredBadgeText}>⭐ ×{item.mastered_count}</Text>
                      </View>
                    )}
                    <View style={[styles.boxBadge, { backgroundColor: bs.bg }]}>
                      <Text style={[styles.boxBadgeText, { color: bs.text }]}>{boxLabel(item.box_number)}</Text>
                    </View>
                  </View>
                  <Text style={[styles.meaningText, { color: colors.textSub }]} numberOfLines={2}>{item.meaning}</Text>
                  {item.box_number > 0 && item.next_review_at && (
                    <Text style={styles.reviewDate}>
                      🗓 {formatDate(item.next_review_at)}
                    </Text>
                  )}
                </TouchableOpacity>
              );
            }}
            ItemSeparatorComponent={() => <View style={[styles.separator, { backgroundColor: colors.separator }]} />}
          />
        )}
      </View>

      {/* Popup combinado: editar + historial + eliminar */}
      <Modal visible={!!selectedWord} transparent animationType="slide" onRequestClose={handleClose}>
        <Pressable style={styles.backdrop} onPress={handleClose} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.sheetWrapper}>
          <View style={[styles.sheet, { backgroundColor: colors.card }]}>
            <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />

            {/* Badge de caja */}
            {boxStyle && (
              <View style={styles.sheetBadgeRow}>
                <View style={[styles.sheetBadge, { backgroundColor: boxStyle.bg }]}>
                  <Text style={[styles.sheetBadgeText, { color: boxStyle.text }]}>{selectedWord ? boxLabel(selectedWord.box_number) : ''}</Text>
                </View>
                {selectedWord && selectedWord.mastered_count > 0 && (
                  <View style={styles.sheetMasteredBadge}>
                    <Text style={styles.sheetMasteredText}>
                      ⭐ {t('words.cycleCompleted', { count: selectedWord.mastered_count })}
                    </Text>
                  </View>
                )}
              </View>
            )}

            {/* Fechas */}
            <View style={styles.datesRow}>
              <View style={styles.dateBox}>
                <Text style={styles.dateLabel}>{t('words.lastReview')}</Text>
                {loadingHistory ? (
                  <ActivityIndicator size="small" color="#94A3B8" />
                ) : lastStudy ? (
                  <>
                    <Text style={styles.dateValue}>{formatDate(lastStudy.moved_at)}</Text>
                    <View style={[styles.dateBadge, { backgroundColor: getBoxStyle(lastStudy.box_number).bg }]}>
                      <Text style={[styles.dateBadgeText, { color: getBoxStyle(lastStudy.box_number).text }]}>
                        {boxLabel(lastStudy.box_number)}
                      </Text>
                    </View>
                  </>
                ) : (
                  <Text style={styles.dateValue}>—</Text>
                )}
              </View>

              <View style={styles.dateDivider} />

              <View style={styles.dateBox}>
                <Text style={styles.dateLabel}>{t('words.nextReview')}</Text>
                {selectedWord?.box_number === 0 ? (
                  <Text style={styles.dateValue}>{t('words.inRepertoire')}</Text>
                ) : selectedWord?.next_review_at ? (
                  <>
                    <Text style={styles.dateValue}>{formatDate(selectedWord.next_review_at)}</Text>
                    <View style={[styles.dateBadge, { backgroundColor: getBoxStyle(selectedWord.box_number).bg }]}>
                      <Text style={[styles.dateBadgeText, { color: getBoxStyle(selectedWord.box_number).text }]}>
                        {boxLabel(selectedWord.box_number)}
                      </Text>
                    </View>
                  </>
                ) : (
                  <Text style={styles.dateValue}>—</Text>
                )}
              </View>
            </View>

            {/* Campos editar */}
            <Text style={styles.label}>{t('words.wordInEnglish')}</Text>
            <TextInput
              style={[styles.input, !isEditable && styles.inputReadOnly]}
              placeholderTextColor="#94A3B8"
              value={wordText}
              onChangeText={setWordText}
              autoCapitalize="none"
              editable={isEditable}
            />

            <Text style={styles.label}>{t('words.meaning')}</Text>
            <TextInput
              style={[styles.input, styles.inputMultiline, !isEditable && styles.inputReadOnly]}
              placeholderTextColor="#94A3B8"
              value={meaningText}
              onChangeText={setMeaningText}
              multiline
              numberOfLines={3}
              editable={isEditable}
            />

            {/* Historial */}
            <Text style={styles.historyTitle}>{t('words.historyTitle')}</Text>
            {loadingHistory ? (
              <ActivityIndicator color="#4F46E5" style={{ marginVertical: 8 }} />
            ) : history.length === 0 ? (
              <Text style={styles.noHistoryHint}>{t('words.noHistory')}</Text>
            ) : (
              <View style={styles.historyList}>
                {history.map((entry) => {
                  const bs = getBoxStyle(entry.box_number);
                  const barWidth = maxCount > 0 ? (entry.count / maxCount) * 100 : 0;
                  return (
                    <View key={entry.box_number} style={styles.historyRow}>
                      <View style={[styles.historyBadge, { backgroundColor: bs.bg }]}>
                        <Text style={[styles.historyBadgeText, { color: bs.text }]}>{boxLabel(entry.box_number)}</Text>
                      </View>
                      <View style={styles.barTrack}>
                        <View style={[styles.barFill, { width: `${barWidth}%`, backgroundColor: bs.text }]} />
                      </View>
                      <Text style={[styles.historyCount, { color: bs.text }]}>{entry.count}×</Text>
                    </View>
                  );
                })}
              </View>
            )}

            {/* Acciones */}
            <View style={styles.actions}>
              <TouchableOpacity style={styles.deleteButton} onPress={handleDelete} activeOpacity={0.8}>
                <Text style={styles.deleteText}>{t('common.delete')}</Text>
              </TouchableOpacity>
              {isEditable && (
                <TouchableOpacity
                  style={[styles.saveButton, (!wordText.trim() || !meaningText.trim()) && styles.saveButtonDisabled]}
                  onPress={handleSave}
                  activeOpacity={0.8}
                  disabled={saving}
                >
                  {saving
                    ? <ActivityIndicator color="#fff" />
                    : <Text style={styles.saveText}>{t('common.save')}</Text>
                  }
                </TouchableOpacity>
              )}
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: { paddingTop: 16, paddingHorizontal: 24, paddingBottom: 12 },
  title: { fontSize: 28, fontWeight: '700', color: '#0F172A' },
  subtitle: { fontSize: 15, color: '#64748B', marginTop: 2 },

  searchRow: { paddingHorizontal: 16, paddingBottom: 8 },
  searchBox: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FFFFFF', borderRadius: 12,
    paddingHorizontal: 12, height: 44,
    borderWidth: 1, borderColor: '#E2E8F0',
  },
  searchIcon: { fontSize: 16, marginRight: 8 },
  searchInput: { flex: 1, fontSize: 15, color: '#0F172A' },
  clearBtn: { padding: 4 },
  clearBtnText: { fontSize: 14, color: '#94A3B8' },

  filterChipRow: { paddingHorizontal: 16, paddingBottom: 8 },
  filterChip: {
    flexDirection: 'row', alignSelf: 'flex-start',
    backgroundColor: '#EEF2FF', borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 5, alignItems: 'center',
  },
  filterChipText: { fontSize: 13, fontWeight: '600', color: '#4F46E5' },
  filterChipClear: { fontSize: 13, color: '#4F46E5' },

  body: { flex: 1, flexDirection: 'row' },

  sidebar: { width: 32 },
  sidebarContent: { paddingVertical: 4, alignItems: 'center', gap: 1 },
  letterBtn: { width: 26, height: 26, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  letterBtnSelected: { backgroundColor: '#4F46E5' },
  letterText: { fontSize: 11, fontWeight: '700', color: '#334155' },
  letterTextSelected: { color: '#FFFFFF' },
  letterTextEmpty: { color: '#CBD5E1' },

  list: { paddingRight: 16, paddingLeft: 4, paddingBottom: 40 },
  row: {
    backgroundColor: '#FFFFFF', borderRadius: 12, padding: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 2, gap: 4,
  },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  wordText: { fontSize: 16, fontWeight: '600', color: '#0F172A', textTransform: 'uppercase' },
  boxBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 20 },
  boxBadgeText: { fontSize: 10, fontWeight: '700' },
  meaningText: { fontSize: 13, color: '#64748B' },
  separator: { height: 8 },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 32 },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyEmoji: { fontSize: 40 },
  emptyText: { fontSize: 16, fontWeight: '600', color: '#0F172A', textAlign: 'center' },
  emptyHint: { fontSize: 13, color: '#94A3B8', textAlign: 'center' },

  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheetWrapper: { justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: 48, gap: 10,
  },
  sheetHandle: { width: 40, height: 4, backgroundColor: '#E2E8F0', borderRadius: 2, alignSelf: 'center', marginBottom: 4 },
  sheetBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  sheetBadge: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20 },
  sheetBadgeText: { fontSize: 13, fontWeight: '700' },
  sheetMasteredBadge: { backgroundColor: '#FFFBEB', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, borderWidth: 1, borderColor: '#FDE68A' },
  sheetMasteredText: { fontSize: 12, fontWeight: '700', color: '#92400E' },
  masteredBadge: { backgroundColor: '#FFFBEB', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 20, borderWidth: 1, borderColor: '#FDE68A' },
  masteredBadgeText: { fontSize: 10, fontWeight: '700', color: '#92400E' },

  label: { fontSize: 12, fontWeight: '600', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { backgroundColor: '#F1F5F9', borderRadius: 12, padding: 13, fontSize: 16, color: '#0F172A' },
  inputReadOnly: { backgroundColor: '#F8FAFC', color: '#94A3B8' },
  inputMultiline: { height: 80, textAlignVertical: 'top' },

  historyTitle: { fontSize: 12, fontWeight: '600', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 4 },
  historyList: { gap: 8 },
  historyRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  historyBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, minWidth: 84, alignItems: 'center' },
  historyBadgeText: { fontSize: 11, fontWeight: '700' },
  barTrack: { flex: 1, height: 7, backgroundColor: '#F1F5F9', borderRadius: 4, overflow: 'hidden' },
  barFill: { height: 7, borderRadius: 4, opacity: 0.75 },
  historyCount: { fontSize: 13, fontWeight: '700', minWidth: 24, textAlign: 'right' },
  noHistoryHint: { fontSize: 13, color: '#94A3B8' },

  reviewDate: { fontSize: 11, color: '#94A3B8', marginTop: 2 },

  datesRow: {
    flexDirection: 'row', backgroundColor: '#F8FAFC',
    borderRadius: 12, padding: 12, gap: 8,
  },
  dateBox: { flex: 1, alignItems: 'center', gap: 4 },
  dateLabel: { fontSize: 10, fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.5 },
  dateValue: { fontSize: 14, fontWeight: '600', color: '#0F172A' },
  dateBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 20 },
  dateBadgeText: { fontSize: 10, fontWeight: '700' },
  dateDivider: { width: 1, backgroundColor: '#E2E8F0', marginVertical: 4 },

  actions: { flexDirection: 'row', gap: 12, marginTop: 6 },
  deleteButton: { flex: 1, padding: 14, borderRadius: 12, backgroundColor: '#FEF2F2', alignItems: 'center' },
  deleteText: { fontSize: 15, fontWeight: '700', color: '#EF4444' },
  saveButton: { flex: 1, padding: 14, borderRadius: 12, backgroundColor: '#4F46E5', alignItems: 'center' },
  saveButtonDisabled: { opacity: 0.4 },
  saveText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
});
