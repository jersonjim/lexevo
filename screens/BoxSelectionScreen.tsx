import { useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ActivityIndicator, ScrollView } from 'react-native';
import { useTranslation } from 'react-i18next';
import { supabase } from '../supabase';
import { BOX_INTERVALS } from '../services/leitner';
import { PLANS } from '../services/plans';

type Props = { onDone: (count: number, planId: string) => void };

export default function BoxSelectionScreen({ onDone }: Props) {
  const { t } = useTranslation();
  const [selected, setSelected] = useState(5);
  const [loading, setLoading] = useState(false);

  async function handleConfirm() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const plan = PLANS.find(p => p.boxCount === selected)!;
    await supabase.from('profiles').upsert(
      { id: user.id, box_count: selected, plan_id: plan.id },
      { onConflict: 'id' }
    );
    onDone(selected, plan.id);
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.inner} showsVerticalScrollIndicator={false}>
        <Text style={styles.emoji}>🗃️</Text>
        <Text style={styles.title}>{t('boxSelection.title')}</Text>
        <Text style={styles.subtitle}>{t('boxSelection.subtitle')}</Text>

        <View style={styles.options}>
          {PLANS.map((plan) => {
            const intervals = BOX_INTERVALS[plan.boxCount];
            const isSelected = selected === plan.boxCount;
            return (
              <TouchableOpacity
                key={plan.boxCount}
                style={[styles.card, isSelected && { borderColor: plan.color, backgroundColor: plan.bg }]}
                onPress={() => setSelected(plan.boxCount)}
                activeOpacity={0.8}
              >
                {plan.recommended && (
                  <View style={[styles.badge, { backgroundColor: plan.color }]}>
                    <Text style={styles.badgeText}>{t('plans.recommended')}</Text>
                  </View>
                )}

                <View style={styles.cardHeader}>
                  <Text style={styles.planEmoji}>{plan.emoji}</Text>
                  <View>
                    <Text style={[styles.planName, isSelected && { color: plan.color }]}>{t(plan.nameKey)}</Text>
                    <Text style={styles.planBoxes}>{t('plans.boxes', { count: plan.boxCount })}</Text>
                  </View>
                </View>

                <Text style={styles.cardDescription}>{t(plan.descKey)}</Text>

                <View style={styles.boxRow}>
                  {intervals.map((days, i) => (
                    <View key={i} style={styles.boxItem}>
                      <View style={[styles.box, isSelected && { backgroundColor: plan.color }]}>
                        <Text style={styles.boxNumber}>{i + 1}</Text>
                      </View>
                      <Text style={styles.boxDays}>{days}d</Text>
                    </View>
                  ))}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        <TouchableOpacity style={styles.button} onPress={handleConfirm} activeOpacity={0.8} disabled={loading}>
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.buttonText}>{t('boxSelection.start')}</Text>
          }
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  inner: { paddingHorizontal: 24, paddingTop: 80, paddingBottom: 48, gap: 16 },
  emoji: { fontSize: 52, textAlign: 'center' },
  title: { fontSize: 28, fontWeight: '700', color: '#0F172A', textAlign: 'center' },
  subtitle: { fontSize: 15, color: '#64748B', lineHeight: 22, textAlign: 'center', marginBottom: 8 },
  options: { gap: 12 },
  card: {
    backgroundColor: '#FFFFFF', borderRadius: 18, padding: 20,
    borderWidth: 2, borderColor: '#E2E8F0', gap: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  badge: { alignSelf: 'flex-start', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  planEmoji: { fontSize: 32 },
  planName: { fontSize: 20, fontWeight: '800', color: '#0F172A' },
  planBoxes: { fontSize: 13, color: '#94A3B8', fontWeight: '500', marginTop: 1 },
  cardDescription: { fontSize: 13, color: '#64748B' },
  boxRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: 4 },
  boxItem: { alignItems: 'center', gap: 4 },
  box: { width: 32, height: 32, borderRadius: 8, backgroundColor: '#E2E8F0', alignItems: 'center', justifyContent: 'center' },
  boxNumber: { fontSize: 13, fontWeight: '700', color: '#fff' },
  boxDays: { fontSize: 10, color: '#94A3B8', fontWeight: '600' },
  button: { backgroundColor: '#4F46E5', borderRadius: 14, padding: 18, alignItems: 'center', marginTop: 8 },
  buttonText: { color: '#FFFFFF', fontSize: 17, fontWeight: '700' },
});
