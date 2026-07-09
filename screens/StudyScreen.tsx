import { useState, useEffect, useRef } from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity, Alert,
  TextInput, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { markCorrect, markIncorrectTomorrow, incrementFailCount, StudyWord } from '../services/leitner';
import { useTheme } from '../context/ThemeContext';

const BOX_COLORS: Record<number, { bg: string; text: string }> = {
  1: { bg: '#FEF2F2', text: '#EF4444' },
  2: { bg: '#FFF7ED', text: '#F97316' },
  3: { bg: '#FEFCE8', text: '#CA8A04' },
  4: { bg: '#F0FDF4', text: '#16A34A' },
  5: { bg: '#F0F9FF', text: '#0284C7' },
  6: { bg: '#F5F3FF', text: '#7C3AED' },
  7: { bg: '#FDF4FF', text: '#A21CAF' },
};

function getLetterGrade(correct: number, total: number): { grade: string; color: string } {
  const pct = total === 0 ? 0 : (correct / total) * 100;
  if (pct >= 100) return { grade: 'A+', color: '#16A34A' };
  if (pct >= 90)  return { grade: 'A',  color: '#16A34A' };
  if (pct >= 80)  return { grade: 'A-', color: '#16A34A' };
  if (pct >= 70)  return { grade: 'B+', color: '#0284C7' };
  if (pct >= 60)  return { grade: 'B',  color: '#0284C7' };
  if (pct >= 50)  return { grade: 'B-', color: '#0284C7' };
  if (pct >= 40)  return { grade: 'C+', color: '#F97316' };
  if (pct >= 30)  return { grade: 'C',  color: '#F97316' };
  if (pct >= 20)  return { grade: 'C-', color: '#F97316' };
  if (pct >= 10)  return { grade: 'D+', color: '#EF4444' };
  return { grade: 'D', color: '#EF4444' };
}

function getBoxModeKey(n: number): string {
  if (n === 2) return 'study.modeBox2';
  if (n === 3) return 'study.modeBox3';
  if (n === 4) return 'study.modeBox4';
  return 'study.modeBox1';
}

function getBoxModeEmoji(n: number): string {
  if (n === 2) return '✍️';
  if (n === 3) return '🔤';
  if (n === 4) return '⏱️';
  return '🃏';
}

type StudyParams = {
  Study: { words: StudyWord[]; boxCount: number; practiceMode?: boolean };
};

const MAX_ROUNDS = 3;
const BOX4_TIMER = 15;

export default function StudyScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const route = useRoute<RouteProp<StudyParams, 'Study'>>();
  const navigation = useNavigation();
  const { words, boxCount, practiceMode = false } = route.params;

  const isBox1Session = words[0]?.box_number === 1;

  const [queue, setQueue] = useState<StudyWord[]>([...words]);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [correct, setCorrect] = useState(0);
  const [incorrect, setIncorrect] = useState(0);
  const [mastered, setMastered] = useState(0);
  const [done, setDone] = useState(false);
  const [round, setRound] = useState(1);
  const [failedThisRound, setFailedThisRound] = useState<StudyWord[]>([]);
  const failedThisRoundRef = useRef<StudyWord[]>([]);
  const [roundCorrect, setRoundCorrect] = useState(0);
  const [roundIncorrect, setRoundIncorrect] = useState(0);
  const [showRoundSummary, setShowRoundSummary] = useState(false);
  const [typedAnswer, setTypedAnswer] = useState('');
  const [box3Result, setBox3Result] = useState<'correct' | 'incorrect' | null>(null);
  const [showBoxTransition, setShowBoxTransition] = useState(words.length > 0);
  const [transitionBox, setTransitionBox] = useState(words[0]?.box_number ?? 1);

  // Box 4 timer
  const [timeLeft, setTimeLeft] = useState(BOX4_TIMER);
  const [timedOut, setTimedOut] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const submittedRef = useRef(false);

  const currentWord = queue[index];
  const progress = Math.min(index, queue.length) / queue.length;
  const isBox2 = currentWord?.box_number === 2;
  const isBox3 = currentWord?.box_number === 3;
  const isBox4 = currentWord?.box_number === 4;

  const boxLabel = (n: number) => n === 0 ? t('common.repertoire') : t('common.box', { n });

  function clearTimer() {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }

  // Start / stop Box 4 timer
  useEffect(() => {
    if (!isBox4 || revealed) { clearTimer(); return; }
    submittedRef.current = false;
    setTimeLeft(BOX4_TIMER);
    setTimedOut(false);
    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) { clearTimer(); return 0; }
        return t - 1;
      });
    }, 1000);
    return clearTimer;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, revealed, isBox4]);

  // Auto-submit when timer hits 0
  useEffect(() => {
    if (timeLeft === 0 && isBox4 && !revealed) handleBox4Submit(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft]);

  function advanceCard() {
    clearTimer();
    setTypedAnswer('');
    setBox3Result(null);
    setTimedOut(false);
    submittedRef.current = false;
    const nextIndex = index + 1;
    if (nextIndex >= queue.length) {
      if (isBox1Session && failedThisRoundRef.current.length > 0 && round < MAX_ROUNDS) {
        setFailedThisRound(failedThisRoundRef.current);
        setShowRoundSummary(true);
      } else {
        setDone(true);
      }
      return;
    }
    const currentBox = queue[index].box_number;
    const nextBox = queue[nextIndex].box_number;
    setIndex(nextIndex);
    setRevealed(false);
    if (nextBox !== currentBox) {
      setTransitionBox(nextBox);
      setShowBoxTransition(true);
    }
  }

  function startNextRound() {
    const nextQueue = [...failedThisRoundRef.current];
    failedThisRoundRef.current = [];
    setRound(r => r + 1);
    setQueue(nextQueue);
    setFailedThisRound([]);
    setIndex(0);
    setRoundCorrect(0);
    setRoundIncorrect(0);
    setRevealed(false);
    setTypedAnswer('');
    setBox3Result(null);
    setShowRoundSummary(false);
  }

  // Box 1 / Box 2: self-evaluation
  async function handleAnswer(wasCorrect: boolean) {
    if (practiceMode) {
      if (wasCorrect) { setCorrect(c => c + 1); setRoundCorrect(c => c + 1); }
      else {
        setIncorrect(i => i + 1);
        setRoundIncorrect(i => i + 1);
        if (isBox1Session) failedThisRoundRef.current = [...failedThisRoundRef.current, currentWord];
      }
      advanceCard();
      return;
    }
    try {
      if (wasCorrect) {
        const result = await markCorrect(currentWord.id, currentWord.box_number, boxCount);
        if (result.error) { Alert.alert(t('study.errorSaving'), result.error); return; }
        if (result.mastered) setMastered(m => m + 1);
        setCorrect(c => c + 1);
        setRoundCorrect(c => c + 1);
      } else {
        setIncorrect(i => i + 1);
        setRoundIncorrect(i => i + 1);
        await incrementFailCount(currentWord.id);
        if (isBox1Session) failedThisRoundRef.current = [...failedThisRoundRef.current, currentWord];
        const result = await markIncorrectTomorrow(currentWord.id);
        if (result.error) { Alert.alert(t('study.errorSaving'), result.error); return; }
      }
    } catch (e: any) {
      Alert.alert(t('common.error'), e?.message ?? ''); return;
    }
    advanceCard();
  }

  // Box 3: auto-validation
  async function handleBox3Submit() {
    const isCorrect = typedAnswer.trim().toLowerCase() === currentWord.word.trim().toLowerCase();
    setRevealed(true);
    if (practiceMode) {
      if (isCorrect) { setCorrect(c => c + 1); setBox3Result('correct'); }
      else { setIncorrect(i => i + 1); setBox3Result('incorrect'); }
      return;
    }
    try {
      if (isCorrect) {
        setCorrect(c => c + 1);
        const result = await markCorrect(currentWord.id, currentWord.box_number, boxCount);
        if (result.error) Alert.alert(t('study.errorSaving'), result.error);
        if (result.mastered) setMastered(m => m + 1);
        setBox3Result('correct');
      } else {
        setIncorrect(i => i + 1);
        await incrementFailCount(currentWord.id);
        const result = await markIncorrectTomorrow(currentWord.id);
        if (result.error) Alert.alert(t('study.errorSaving'), result.error);
        setBox3Result('incorrect');
      }
    } catch (e: any) { Alert.alert(t('common.error'), e?.message ?? ''); }
  }

  // Box 4: timed auto-validation
  async function handleBox4Submit(isTimeout = false) {
    if (submittedRef.current) return;
    submittedRef.current = true;
    clearTimer();
    if (isTimeout) setTimedOut(true);
    const isCorrect = !isTimeout &&
      typedAnswer.trim().toLowerCase() === currentWord.word.trim().toLowerCase();
    setRevealed(true);
    if (practiceMode) {
      if (isCorrect) { setCorrect(c => c + 1); setBox3Result('correct'); }
      else { setIncorrect(i => i + 1); setBox3Result('incorrect'); }
      return;
    }
    try {
      if (isCorrect) {
        setCorrect(c => c + 1);
        const result = await markCorrect(currentWord.id, currentWord.box_number, boxCount);
        if (result.error) Alert.alert(t('study.errorSaving'), result.error);
        if (result.mastered) setMastered(m => m + 1);
        setBox3Result('correct');
      } else {
        setIncorrect(i => i + 1);
        await incrementFailCount(currentWord.id);
        const result = await markIncorrectTomorrow(currentWord.id);
        if (result.error) Alert.alert(t('study.errorSaving'), result.error);
        setBox3Result('incorrect');
      }
    } catch (e: any) { Alert.alert(t('common.error'), e?.message ?? ''); }
  }

  // ── Box transition screen ──
  if (showBoxTransition && !done) {
    const bc = BOX_COLORS[transitionBox] ?? BOX_COLORS[7];
    const wordsInBox = queue.slice(index).filter(w => w.box_number === transitionBox).length;
    return (
      <View style={styles.transitionContainer}>
        <View style={styles.transitionTopBar}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.closeButton}>
            <Text style={styles.closeText}>✕</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.transitionContent}>
          <Text style={styles.transitionUpNext}>{t('study.transitionUpNext')}</Text>
          <View style={[styles.transitionBoxBadge, { backgroundColor: bc.bg, borderColor: bc.text + '50' }]}>
            <Text style={[styles.transitionBoxLabel, { color: bc.text }]}>
              {t('common.box', { n: transitionBox })}
            </Text>
          </View>
          <View style={[styles.transitionModeCard, { borderLeftColor: bc.text }]}>
            <Text style={styles.transitionModeEmoji}>{getBoxModeEmoji(transitionBox)}</Text>
            <Text style={styles.transitionModeText}>
              {t(getBoxModeKey(transitionBox), { seconds: BOX4_TIMER })}
            </Text>
          </View>
          {wordsInBox > 0 && (
            <Text style={styles.transitionWordCount}>
              {t('study.transitionWordCount', { count: wordsInBox })}
            </Text>
          )}
          <TouchableOpacity
            style={[styles.transitionBtn, { backgroundColor: bc.text }]}
            onPress={() => setShowBoxTransition(false)}
            activeOpacity={0.8}
          >
            <Text style={styles.transitionBtnText}>{t('study.letsGo')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── Round summary screen (box 1 only, between rounds) ──
  if (showRoundSummary) {
    const isLastRound = round >= MAX_ROUNDS;
    const nextRoundLabel = round === 1 ? t('study.secondChance') : t('study.lastChance');
    return (
      <View style={[styles.container, { backgroundColor: colors.bg }]}>
        <View style={styles.summary}>
          <Text style={styles.summaryEmoji}>{roundIncorrect === 0 ? '🎉' : round === 1 ? '💪' : '🔄'}</Text>
          <Text style={[styles.summaryTitle, { color: colors.text }]}>{t('study.roundSummary', { n: round })}</Text>
          <Text style={styles.summarySubtitle}>{t('study.round', { n: round, total: MAX_ROUNDS })}</Text>
          <View style={styles.resultsRow}>
            <View style={[styles.resultBox, styles.resultGreen]}>
              <Text style={[styles.resultNumber, { color: '#16A34A' }]}>{roundCorrect}</Text>
              <Text style={styles.resultLabel}>{t('study.knewIt')}</Text>
            </View>
            <View style={[styles.resultBox, styles.resultRed]}>
              <Text style={[styles.resultNumber, { color: '#DC2626' }]}>{roundIncorrect}</Text>
              <Text style={styles.resultLabel}>{t('study.didntKnow')}</Text>
            </View>
          </View>
          {!isLastRound && failedThisRound.length > 0 && (
            <TouchableOpacity style={styles.doneButton} onPress={startNextRound} activeOpacity={0.8}>
              <Text style={styles.doneButtonText}>{nextRoundLabel} ({failedThisRound.length})</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.doneButton, { backgroundColor: '#64748B', marginTop: 8 }]}
            onPress={() => navigation.goBack()}
            activeOpacity={0.8}
          >
            <Text style={styles.doneButtonText}>{t('study.finish')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── Summary screen ──
  if (done) {
    if (practiceMode) {
      const total = correct + incorrect;
      const { grade, color } = getLetterGrade(correct, total);
      const pct = total === 0 ? 0 : Math.round((correct / total) * 100);
      const gradeEmoji = grade.startsWith('A') ? '🎯' : grade.startsWith('B') ? '💪' : grade.startsWith('C') ? '📚' : '🔄';
      return (
        <View style={[styles.container, { backgroundColor: colors.bg }]}>
          <View style={styles.summary}>
            <Text style={styles.summaryEmoji}>{gradeEmoji}</Text>
            <Text style={[styles.summaryTitle, { color: colors.text }]}>{t('study.practiceComplete')}</Text>
            <Text style={styles.summarySubtitle}>{t('study.wordsStudied', { count: words.length })}</Text>
            <View style={[styles.gradeCircle, { borderColor: color }]}>
              <Text style={[styles.gradeText, { color }]}>{grade}</Text>
            </View>
            <Text style={[styles.gradePct, { color: colors.textSub }]}>{pct}%</Text>
            <View style={styles.resultsRow}>
              <View style={[styles.resultBox, styles.resultGreen]}>
                <Text style={[styles.resultNumber, { color: '#16A34A' }]}>{correct}</Text>
                <Text style={styles.resultLabel}>{t('study.knewIt')}</Text>
              </View>
              <View style={[styles.resultBox, styles.resultRed]}>
                <Text style={[styles.resultNumber, { color: '#DC2626' }]}>{incorrect}</Text>
                <Text style={styles.resultLabel}>{t('study.didntKnow')}</Text>
              </View>
            </View>
            <TouchableOpacity style={styles.doneButton} onPress={() => navigation.goBack()} activeOpacity={0.8}>
              <Text style={styles.doneButtonText}>{t('study.finish')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }
    const pct = Math.round((correct / words.length) * 100);
    return (
      <View style={styles.container}>
        <View style={styles.summary}>
          <Text style={styles.summaryEmoji}>{mastered > 0 ? '🏆' : pct >= 80 ? '🎉' : pct >= 50 ? '💪' : '📚'}</Text>
          <Text style={styles.summaryTitle}>{t('study.sessionComplete')}</Text>
          <Text style={styles.summarySubtitle}>{t('study.wordsStudied', { count: words.length })}</Text>
          <View style={styles.resultsRow}>
            <View style={[styles.resultBox, styles.resultGreen]}>
              <Text style={[styles.resultNumber, { color: '#16A34A' }]}>{correct}</Text>
              <Text style={styles.resultLabel}>{t('study.knewIt')}</Text>
            </View>
            <View style={[styles.resultBox, styles.resultRed]}>
              <Text style={[styles.resultNumber, { color: '#DC2626' }]}>{incorrect}</Text>
              <Text style={styles.resultLabel}>{t('study.didntKnow')}</Text>
            </View>
          </View>
          {mastered > 0 && (
            <View style={styles.masteredBanner}>
              <Text style={styles.masteredEmoji}>⭐</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.masteredTitle}>{t('study.mastered', { count: mastered })}</Text>
                <Text style={styles.masteredSubtitle}>{t('study.masteredSub', { count: mastered })}</Text>
              </View>
            </View>
          )}
          <TouchableOpacity style={styles.doneButton} onPress={() => navigation.goBack()} activeOpacity={0.8}>
            <Text style={styles.doneButtonText}>{t('study.finish')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── Timer color ──
  const timerColor = timeLeft > 10 ? '#16A34A' : timeLeft > 5 ? '#F97316' : '#EF4444';

  return (
    <KeyboardAvoidingView style={[styles.container, { backgroundColor: colors.bg }]} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>

      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => {
            if (isBox1Session && round > 1) {
              Alert.alert(
                t('study.exitRoundTitle'),
                t('study.exitRoundMsg'),
                [
                  { text: t('common.cancel'), style: 'cancel' },
                  { text: t('study.exitRoundConfirm'), style: 'destructive', onPress: () => navigation.goBack() },
                ]
              );
            } else {
              navigation.goBack();
            }
          }}
          style={styles.closeButton}
        >
          <Text style={styles.closeText}>✕</Text>
        </TouchableOpacity>
        <Text style={styles.progressText}>
          {Math.min(index + 1, queue.length)} / {queue.length}
          {isBox1Session && round > 1 ? `  ·  R${round}` : ''}
        </Text>
        <View style={{ width: 36 }} />
      </View>

      <View style={styles.progressBar}>
        <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
      </View>

      <Text style={styles.boxLabel}>{boxLabel(currentWord.box_number)}</Text>


      {/* ── Card ── */}
      <View style={[styles.card, (isBox2 || isBox3 || isBox4) && styles.cardCompact, { backgroundColor: colors.card }]}>
        {(isBox3 || isBox4) ? (
          <>
            <Text style={styles.meaningLabel}>{t('study.meaningLabel')}</Text>
            <Text style={styles.meaning}>{currentWord.meaning}</Text>
          </>
        ) : (
          <>
            <Text style={styles.wordLabel}>{t('study.wordLabel')}</Text>
            <Text style={[styles.word, { color: colors.text }]}>{currentWord.word}</Text>
            {revealed && !isBox2 && (
              <>
                <View style={styles.divider} />
                <Text style={styles.meaningLabel}>{t('study.meaningLabel')}</Text>
                <Text style={styles.meaning}>{currentWord.meaning}</Text>
              </>
            )}
          </>
        )}
      </View>

      {/* ── Box 2: type definition ── */}
      {isBox2 && !revealed && (
        <>
          <TextInput
            style={[styles.typeInput, { backgroundColor: colors.card, color: colors.text, borderColor: colors.border }]}
            placeholder={t('study.typeDefinition')}
            placeholderTextColor={colors.textMuted}
            value={typedAnswer}
            onChangeText={setTypedAnswer}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
            autoFocus
          />
          <TouchableOpacity
            style={[styles.actionButton, !typedAnswer.trim() && styles.actionButtonDisabled]}
            onPress={() => setRevealed(true)}
            activeOpacity={0.8}
            disabled={!typedAnswer.trim()}
          >
            <Text style={styles.actionButtonText}>{t('study.checkAnswer')}</Text>
          </TouchableOpacity>
        </>
      )}

      {isBox2 && revealed && (
        <ScrollView style={styles.comparisonScroll} showsVerticalScrollIndicator={false}>
          <View style={styles.comparisonBlock}>
            <Text style={styles.comparisonLabel}>{t('study.yourAnswer')}</Text>
            <Text style={styles.comparisonText}>{typedAnswer}</Text>
          </View>
          <View style={[styles.comparisonBlock, { marginTop: 8 }]}>
            <Text style={styles.comparisonLabel}>{t('study.meaningLabel')}</Text>
            <Text style={styles.comparisonMeaning}>{currentWord.meaning}</Text>
          </View>
        </ScrollView>
      )}

      {/* ── Box 3: type the word ── */}
      {isBox3 && !revealed && (
        <>
          <TextInput
            style={styles.typeInput}
            placeholder={t('study.typeTheWord')}
            placeholderTextColor="#94A3B8"
            value={typedAnswer}
            onChangeText={setTypedAnswer}
            autoCapitalize="none"
            autoCorrect={false}
            autoFocus
          />
          <TouchableOpacity
            style={[styles.actionButton, !typedAnswer.trim() && styles.actionButtonDisabled]}
            onPress={handleBox3Submit}
            activeOpacity={0.8}
            disabled={!typedAnswer.trim()}
          >
            <Text style={styles.actionButtonText}>{t('study.submit')}</Text>
          </TouchableOpacity>
        </>
      )}

      {/* ── Box 4: timed — type the word ── */}
      {isBox4 && !revealed && (
        <>
          {/* Timer */}
          <View style={styles.timerRow}>
            <View style={[styles.timerCircle, { borderColor: timerColor }]}>
              <Text style={[styles.timerNumber, { color: timerColor }]}>{timeLeft}</Text>
            </View>
          </View>
          <TextInput
            style={styles.typeInput}
            placeholder={t('study.typeTheWord')}
            placeholderTextColor="#94A3B8"
            value={typedAnswer}
            onChangeText={setTypedAnswer}
            autoCapitalize="none"
            autoCorrect={false}
            autoFocus
          />
          <TouchableOpacity
            style={[styles.actionButton, !typedAnswer.trim() && styles.actionButtonDisabled]}
            onPress={() => handleBox4Submit(false)}
            activeOpacity={0.8}
            disabled={!typedAnswer.trim()}
          >
            <Text style={styles.actionButtonText}>{t('study.submit')}</Text>
          </TouchableOpacity>
        </>
      )}

      {/* ── Box 3 & 4 result ── */}
      {(isBox3 || isBox4) && revealed && box3Result && (
        <View style={styles.box3Result}>
          <View style={[styles.box3Banner, box3Result === 'correct' ? styles.box3BannerCorrect : styles.box3BannerWrong]}>
            <Text style={[styles.box3BannerIcon, { color: box3Result === 'correct' ? '#16A34A' : '#DC2626' }]}>
              {box3Result === 'correct' ? '✓' : timedOut ? '⏰' : '✗'}
            </Text>
            <Text style={[styles.box3BannerText, { color: box3Result === 'correct' ? '#15803D' : '#B91C1C' }]}>
              {box3Result === 'correct' ? t('study.correctAnswer') : timedOut ? t('study.timeUp') : t('study.incorrectAnswer')}
            </Text>
          </View>

          <View style={styles.box3WordBlock}>
            <Text style={styles.box3WordLabel}>{t('study.theWordWas')}</Text>
            <Text style={styles.box3Word}>{currentWord.word.toUpperCase()}</Text>
          </View>

          {box3Result === 'incorrect' && typedAnswer.trim().length > 0 && (
            <View style={styles.box3YourBlock}>
              <Text style={styles.box3YourLabel}>{t('study.yourAnswer')}</Text>
              <Text style={styles.box3YourText}>{typedAnswer}</Text>
            </View>
          )}

          <TouchableOpacity style={styles.continueButton} onPress={advanceCard} activeOpacity={0.8}>
            <Text style={styles.continueButtonText}>{t('study.continue')}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Box 1: reveal button ── */}
      {!isBox2 && !isBox3 && !isBox4 && !revealed && (
        <TouchableOpacity style={styles.revealButton} onPress={() => setRevealed(true)} activeOpacity={0.8}>
          <Text style={styles.revealText}>{t('study.reveal')}</Text>
        </TouchableOpacity>
      )}

      {/* ── Box 1 & 2 answer buttons ── */}
      {(isBox2 || (!isBox3 && !isBox4)) && revealed && (
        <View style={styles.answerRow}>
          <TouchableOpacity style={styles.wrongButton} onPress={() => handleAnswer(false)} activeOpacity={0.8}>
            <Text style={styles.wrongIcon}>✗</Text>
            <Text style={styles.wrongText}>{t('study.didntKnow')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.correctButton} onPress={() => handleAnswer(true)} activeOpacity={0.8}>
            <Text style={styles.correctIcon}>✓</Text>
            <Text style={styles.correctText}>{t('study.knewIt')}</Text>
          </TouchableOpacity>
        </View>
      )}

    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC', paddingHorizontal: 24 },

  header: {
    paddingTop: 60, paddingBottom: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  closeButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  closeText: { fontSize: 18, color: '#64748B', fontWeight: '600' },
  progressText: { fontSize: 15, fontWeight: '600', color: '#64748B' },
  progressBar: { height: 6, backgroundColor: '#E2E8F0', borderRadius: 3, marginBottom: 20 },
  progressFill: { height: 6, backgroundColor: '#4F46E5', borderRadius: 3 },
  boxLabel: {
    fontSize: 12, fontWeight: '700', color: '#4F46E5',
    textAlign: 'center', marginBottom: 16,
    textTransform: 'uppercase', letterSpacing: 1,
  },
  retryBanner: {
    backgroundColor: '#FFF7ED', borderRadius: 10, paddingVertical: 6, paddingHorizontal: 14,
    alignSelf: 'center', marginBottom: 10, borderWidth: 1, borderColor: '#FED7AA',
  },
  retryText: { fontSize: 13, fontWeight: '600', color: '#C2410C' },

  // Card
  card: {
    flex: 1, backgroundColor: '#FFFFFF', borderRadius: 24, padding: 32,
    alignItems: 'center', justifyContent: 'center', gap: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08, shadowRadius: 16, elevation: 4, marginBottom: 24,
  },
  cardCompact: { flex: 0, minHeight: 150, marginBottom: 16 },
  wordLabel: { fontSize: 12, fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 1 },
  word: { fontSize: 38, fontWeight: '800', color: '#0F172A', textAlign: 'center' },
  divider: { width: '80%', height: 1, backgroundColor: '#F1F5F9', marginVertical: 4 },
  meaningLabel: { fontSize: 12, fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 1 },
  meaning: { fontSize: 20, color: '#334155', textAlign: 'center', lineHeight: 28 },

  // Timer
  timerRow: { alignItems: 'center', marginBottom: 12 },
  timerCircle: {
    width: 64, height: 64, borderRadius: 32,
    borderWidth: 3, alignItems: 'center', justifyContent: 'center',
  },
  timerNumber: { fontSize: 26, fontWeight: '800' },

  // Shared input + action button (Box 2, 3, 4)
  typeInput: {
    backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16,
    fontSize: 16, color: '#0F172A', minHeight: 56,
    borderWidth: 1.5, borderColor: '#E2E8F0',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04, shadowRadius: 8, elevation: 2, marginBottom: 12,
  },
  actionButton: {
    backgroundColor: '#4F46E5', borderRadius: 14, padding: 18,
    alignItems: 'center', marginBottom: 16,
  },
  actionButtonDisabled: { opacity: 0.35 },
  actionButtonText: { color: '#FFFFFF', fontSize: 17, fontWeight: '700' },

  // Box 2 comparison
  comparisonScroll: { flex: 1, marginBottom: 16 },
  comparisonBlock: {
    backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, gap: 6,
    borderWidth: 1, borderColor: '#E2E8F0',
  },
  comparisonLabel: { fontSize: 10, fontWeight: '800', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.8 },
  comparisonText: { fontSize: 16, color: '#64748B', lineHeight: 22 },
  comparisonMeaning: { fontSize: 16, color: '#0F172A', lineHeight: 22, fontWeight: '600' },

  // Box 3 & 4 result
  box3Result: { flex: 1, gap: 12, marginBottom: 16 },
  box3Banner: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: 16, padding: 18, borderWidth: 1.5,
  },
  box3BannerCorrect: { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' },
  box3BannerWrong: { backgroundColor: '#FEF2F2', borderColor: '#FECACA' },
  box3BannerIcon: { fontSize: 28, fontWeight: '800' },
  box3BannerText: { fontSize: 18, fontWeight: '800' },
  box3WordBlock: {
    backgroundColor: '#FFFFFF', borderRadius: 16, padding: 20,
    alignItems: 'center', gap: 6,
    borderWidth: 1, borderColor: '#E2E8F0',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04, shadowRadius: 8, elevation: 2,
  },
  box3WordLabel: { fontSize: 11, fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.8 },
  box3Word: { fontSize: 32, fontWeight: '800', color: '#0F172A', letterSpacing: 1 },
  box3YourBlock: {
    backgroundColor: '#FFF7ED', borderRadius: 14, padding: 14, gap: 4,
    borderWidth: 1, borderColor: '#FED7AA',
  },
  box3YourLabel: { fontSize: 10, fontWeight: '700', color: '#F97316', textTransform: 'uppercase', letterSpacing: 0.8 },
  box3YourText: { fontSize: 15, color: '#92400E', fontWeight: '500' },
  continueButton: {
    backgroundColor: '#4F46E5', borderRadius: 14, padding: 18,
    alignItems: 'center', marginTop: 4,
  },
  continueButtonText: { color: '#FFFFFF', fontSize: 17, fontWeight: '700' },

  // Box 1 buttons
  revealButton: { backgroundColor: '#4F46E5', borderRadius: 14, padding: 18, alignItems: 'center', marginBottom: 48 },
  revealText: { color: '#FFFFFF', fontSize: 17, fontWeight: '700' },
  answerRow: { flexDirection: 'row', gap: 12, marginBottom: 48 },
  wrongButton: { flex: 1, backgroundColor: '#FEF2F2', borderRadius: 14, padding: 16, alignItems: 'center', gap: 4 },
  wrongIcon: { fontSize: 24, color: '#DC2626' },
  wrongText: { color: '#DC2626', fontSize: 14, fontWeight: '700' },
  correctButton: { flex: 1, backgroundColor: '#F0FDF4', borderRadius: 14, padding: 16, alignItems: 'center', gap: 4 },
  correctIcon: { fontSize: 24, color: '#16A34A' },
  correctText: { color: '#16A34A', fontSize: 14, fontWeight: '700' },

  // Summary
  summary: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 8 },
  summaryEmoji: { fontSize: 72, marginBottom: 8 },
  summaryTitle: { fontSize: 28, fontWeight: '800', color: '#0F172A' },
  summarySubtitle: { fontSize: 16, color: '#64748B', marginBottom: 4 },
  resultsRow: { flexDirection: 'row', gap: 16, marginTop: 4 },
  resultBox: { flex: 1, borderRadius: 18, padding: 20, alignItems: 'center', gap: 6 },
  resultGreen: { backgroundColor: '#F0FDF4' },
  resultRed: { backgroundColor: '#FEF2F2' },
  resultNumber: { fontSize: 40, fontWeight: '800' },
  resultLabel: { fontSize: 14, color: '#64748B', fontWeight: '600' },
  masteredBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#FFFBEB', borderRadius: 16,
    padding: 16, borderWidth: 1, borderColor: '#FDE68A', alignSelf: 'stretch',
  },
  masteredEmoji: { fontSize: 32 },
  masteredTitle: { fontSize: 15, fontWeight: '700', color: '#92400E' },
  masteredSubtitle: { fontSize: 12, color: '#B45309', marginTop: 2 },
  doneButton: { backgroundColor: '#4F46E5', borderRadius: 14, paddingVertical: 16, paddingHorizontal: 56, marginTop: 8 },
  doneButtonText: { color: '#FFFFFF', fontSize: 17, fontWeight: '700' },

  // Grade circle (practice summary)
  gradeCircle: {
    width: 110, height: 110, borderRadius: 55, borderWidth: 4,
    alignItems: 'center', justifyContent: 'center', marginVertical: 4,
  },
  gradeText: { fontSize: 44, fontWeight: '900' },
  gradePct: { fontSize: 17, fontWeight: '600', marginBottom: 4 },

  // Transition screen
  transitionContainer: { flex: 1, backgroundColor: '#F8FAFC' },
  transitionTopBar: { paddingTop: 60, paddingHorizontal: 24, paddingBottom: 8 },
  transitionContent: {
    flex: 1, paddingHorizontal: 32,
    alignItems: 'center', justifyContent: 'center', gap: 20,
  },
  transitionUpNext: {
    fontSize: 12, fontWeight: '700', color: '#94A3B8',
    textTransform: 'uppercase', letterSpacing: 1.2,
  },
  transitionBoxBadge: {
    paddingHorizontal: 28, paddingVertical: 12,
    borderRadius: 32, borderWidth: 1.5,
  },
  transitionBoxLabel: { fontSize: 26, fontWeight: '800', letterSpacing: 0.5 },
  transitionModeCard: {
    backgroundColor: '#FFFFFF', borderRadius: 20, padding: 24,
    borderLeftWidth: 4, alignItems: 'center', gap: 14,
    alignSelf: 'stretch',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06, shadowRadius: 12, elevation: 3,
  },
  transitionModeEmoji: { fontSize: 44 },
  transitionModeText: { fontSize: 15, color: '#475569', textAlign: 'center', lineHeight: 22 },
  transitionWordCount: { fontSize: 13, color: '#94A3B8', fontWeight: '600' },
  transitionBtn: {
    borderRadius: 16, paddingVertical: 18,
    alignItems: 'center', alignSelf: 'stretch', marginTop: 8,
  },
  transitionBtnText: { color: '#FFFFFF', fontSize: 18, fontWeight: '800' },
});
