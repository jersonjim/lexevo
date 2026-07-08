import { useState, useCallback, useRef } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  StyleSheet, Text, View, ScrollView, TouchableOpacity,
  Alert, ActivityIndicator, Modal, Pressable, TextInput, KeyboardAvoidingView, Platform, Image,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../supabase';
import { useProfileContext } from '../context/ProfileContext';
import { getWordCount } from '../services/words';
import { BOX_INTERVALS, getStudyStreak, resetStreakDate } from '../services/leitner';
import { PLANS, getPlan } from '../services/plans';
import { setLanguage } from '../i18n';
import { useTheme } from '../context/ThemeContext';
import { STREAK_THEMES, getMascotEmoji } from '../constants/streakThemes';

export default function ProfileScreen() {
  const { t, i18n } = useTranslation();
  const { syncProfile } = useProfileContext();
  const { colors, mode, toggleTheme } = useTheme();
  const [nickname, setNickname] = useState('');
  const [email, setEmail] = useState('');
  const [wordCount, setWordCount] = useState(0);
  const [streak, setStreak] = useState(0);
  const [boxCount, setBoxCount] = useState(5);
  const [loading, setLoading] = useState(false);
  const [profileLoading, setProfileLoading] = useState(true);
  const [planModalVisible, setPlanModalVisible] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(5);
  const [savingPlan, setSavingPlan] = useState(false);
  const [nicknameModalVisible, setNicknameModalVisible] = useState(false);
  const [nicknameInput, setNicknameInput] = useState('');
  const [savingNickname, setSavingNickname] = useState(false);
  const [aboutModalVisible, setAboutModalVisible] = useState(false);
  const [mascotModalVisible, setMascotModalVisible] = useState(false);
  const [mascotTheme, setMascotTheme] = useState('plant');
  const [mascotSelected, setMascotSelected] = useState('plant');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarKey, setAvatarKey] = useState(0);
  const [avatarError, setAvatarError] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const skipAvatarReload = useRef(false);

  useFocusEffect(
    useCallback(() => {
      loadProfile();
      getWordCount().then(setWordCount);
      getStudyStreak().then(setStreak);
      AsyncStorage.getItem('streak_theme').then(t => {
        if (t) { setMascotTheme(t); setMascotSelected(t); }
      });
    }, [])
  );

  async function loadProfile() {
    setProfileLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setProfileLoading(false); return; }
    setEmail(user.email ?? '');
    const { data } = await supabase.from('profiles').select('nickname, box_count, avatar_url, streak_theme').eq('id', user.id).single();
    if (data) {
      setNickname(data.nickname);
      const count = data.box_count ?? 5;
      setBoxCount(count);
      setSelectedPlan(count);
      const url = data.avatar_url ?? null;
      const initial = data.nickname ? data.nickname[0].toUpperCase() : '?';
      if (!skipAvatarReload.current) {
        setAvatarError(false);
        setAvatarUrl(url);
      }
      syncProfile(url, initial);
      if (data.streak_theme) {
        await AsyncStorage.setItem('streak_theme', data.streak_theme);
        setMascotTheme(data.streak_theme);
        setMascotSelected(data.streak_theme);
      }
    }
    setProfileLoading(false);
  }

  async function handleSignOut() {
    Alert.alert(t('profile.signOutTitle'), t('profile.signOutConfirm'), [
      { text: t('profile.signOutCancel'), style: 'cancel' },
      {
        text: t('profile.signOutBtn'),
        style: 'destructive',
        onPress: async () => {
          setLoading(true);
          await supabase.auth.signOut();
        },
      },
    ]);
  }

  function handleLanguagePress() {
    Alert.alert(t('profile.langPickerTitle'), undefined, [
      { text: 'Español', onPress: () => setLanguage('es') },
      { text: 'English', onPress: () => setLanguage('en') },
      { text: 'Português', onPress: () => setLanguage('pt') },
      { text: t('profile.langPickerCancel'), style: 'cancel' },
    ]);
  }

  async function handlePickAvatar() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permiso requerido', 'Necesitamos acceso a tu galería para cambiar la foto.');
      return;
    }

    // Bloquear antes de abrir el picker para que useFocusEffect no pise el avatar
    skipAvatarReload.current = true;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.6,
      base64: true,
    });

    if (result.canceled) {
      skipAvatarReload.current = false;
      return;
    }

    const asset = result.assets[0];

    // Usar base64 para preview inmediato garantizado (no depende de file system)
    const preview = asset.base64
      ? `data:image/jpeg;base64,${asset.base64}`
      : asset.uri;
    setAvatarUrl(preview);
    setAvatarError(false);
    setAvatarKey((k) => k + 1);
    setUploadingAvatar(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      if (!asset.base64) {
        Alert.alert(t('common.error'), 'No se pudo leer la imagen.');
        return;
      }

      const path = `${user.id}/avatar.jpg`;

      // Decodificar base64 → ArrayBuffer (funciona de forma confiable en React Native)
      const binaryStr = atob(asset.base64);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, bytes.buffer, { contentType: 'image/jpeg', upsert: true });

      if (uploadError) { Alert.alert(t('common.error'), uploadError.message); return; }

      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path);

      const remoteUrl = `${urlData.publicUrl}?t=${Date.now()}`;
      await supabase.from('profiles')
        .update({ avatar_url: remoteUrl })
        .eq('id', user.id);
      setAvatarUrl(remoteUrl);
      setAvatarError(false);
      setAvatarKey((k) => k + 1);
      syncProfile(remoteUrl, initial);
    } catch (e: any) {
      Alert.alert(t('common.error'), e.message);
    } finally {
      skipAvatarReload.current = false;
      setUploadingAvatar(false);
    }
  }

  async function handleSaveNickname() {
    if (!nicknameInput.trim()) return;
    setSavingNickname(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { error } = await supabase
        .from('profiles')
        .upsert({ id: user.id, nickname: nicknameInput.trim() }, { onConflict: 'id' });
      if (error) {
        Alert.alert(t('common.error'), error.message);
        setSavingNickname(false);
        return;
      }
      setNickname(nicknameInput.trim());
    }
    setSavingNickname(false);
    setNicknameModalVisible(false);
  }

  async function handleConfirmPlan() {
    if (selectedPlan === boxCount) { setPlanModalVisible(false); return; }
    setSavingPlan(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const plan = PLANS.find(p => p.boxCount === selectedPlan)!;
      await supabase.from('profiles').update({ box_count: selectedPlan, plan_id: plan.id }).eq('id', user.id);
      setBoxCount(selectedPlan);
    }
    setSavingPlan(false);
    setPlanModalVisible(false);
  }

  async function handleSaveMascot() {
    if (mascotSelected === mascotTheme) {
      setMascotModalVisible(false);
      return;
    }
    setMascotModalVisible(false);
    Alert.alert(
      t('profile.mascotChangeTitle'),
      t('profile.mascotChangeConfirm'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('profile.mascotChangeBtn'),
          style: 'destructive',
          onPress: async () => {
            await resetStreakDate();
            await AsyncStorage.setItem('streak_theme', mascotSelected);
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
              await supabase.from('profiles').update({ streak_theme: mascotSelected }).eq('id', user.id);
            }
            setMascotTheme(mascotSelected);
            setStreak(0);
          },
        },
      ]
    );
  }

  const currentPlan = getPlan(boxCount);
  const currentLangName = i18n.language === 'en' ? 'English' : i18n.language === 'pt' ? 'Português' : 'Español';
  const initial = nickname ? nickname[0].toUpperCase() : '?';
  const currentTheme = STREAK_THEMES.find(t => t.id === mascotTheme) ?? STREAK_THEMES[0];

  const menuItems = [
    {
      id: 'language',
      icon: '🌐',
      label: t('profile.language'),
      description: currentLangName,
      onPress: handleLanguagePress,
    },
    { id: 'notifications', icon: '🔔', label: t('profile.notifications'), description: t('profile.notificationsDesc'), onPress: () => {} },
    { id: 'theme', icon: '🎨', label: t('profile.theme'), description: mode === 'dark' ? t('profile.themeDark') : t('profile.themeLight'), onPress: toggleTheme },
    {
      id: 'mascot', icon: getMascotEmoji(mascotTheme, streak),
      label: t('profile.mascot'),
      description: t(currentTheme.nameKey),
      onPress: () => { setMascotSelected(mascotTheme); setMascotModalVisible(true); },
    },
    { id: 'about', icon: 'ℹ️', label: t('profile.about'), description: t('profile.aboutVersion'), onPress: () => setAboutModalVisible(true) },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={[styles.header, { backgroundColor: colors.bg }]}>
        <Text style={[styles.title, { color: colors.text }]}>{t('profile.title')}</Text>
      </View>

      {profileLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4F46E5" />
        </View>
      ) : (
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Perfil */}
        <View style={[styles.profileCard, { backgroundColor: colors.card }]}>
          <TouchableOpacity onPress={handlePickAvatar} activeOpacity={0.8} style={styles.avatarContainer}>
            <View style={styles.avatarCircle}>
              {avatarUrl && !avatarError ? (
                <Image
                  key={avatarKey}
                  source={{ uri: avatarUrl }}
                  style={styles.avatarImage}
                  onError={() => setAvatarError(true)}
                />
              ) : (
                <Text style={styles.avatarText}>{initial}</Text>
              )}
            </View>
            <View style={styles.cameraOverlay}>
              {uploadingAvatar
                ? <ActivityIndicator size="small" color="#fff" />
                : <Text style={styles.cameraIcon}>📷</Text>
              }
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.nameRow}
            onPress={() => { setNicknameInput(nickname); setNicknameModalVisible(true); }}
            activeOpacity={0.7}
          >
            <Text style={[styles.name, { color: colors.text }]}>{nickname || t('profile.nicknameLabel')}</Text>
            <Text style={styles.editIcon}>✏️</Text>
          </TouchableOpacity>
          <Text style={styles.emailText}>{email}</Text>
        </View>

        {/* Stats */}
        <View style={[styles.statsRow, { backgroundColor: colors.card }]}>
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>{wordCount}</Text>
            <Text style={styles.statLabel}>{t('profile.words')}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>{streak}</Text>
            <Text style={styles.statLabel}>{t('profile.streak')}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>0</Text>
            <Text style={styles.statLabel}>{t('profile.practiced')}</Text>
          </View>
        </View>

        {/* Plan card */}
        <TouchableOpacity
          style={[styles.planCard, { borderColor: currentPlan.color + '40', backgroundColor: currentPlan.bg }]}
          onPress={() => { setSelectedPlan(boxCount); setPlanModalVisible(true); }}
          activeOpacity={0.8}
        >
          <View style={styles.planCardLeft}>
            <Text style={styles.planEmoji}>{currentPlan.emoji}</Text>
            <View>
              <Text style={styles.planCardLabel}>{t('plans.currentPlan')}</Text>
              <Text style={[styles.planCardName, { color: currentPlan.color }]}>{t(currentPlan.nameKey)}</Text>
              <Text style={styles.planCardBoxes}>{t('plans.boxes', { count: currentPlan.boxCount })}</Text>
            </View>
          </View>
          <View style={[styles.changePlanBtn, { backgroundColor: currentPlan.color }]}>
            <Text style={styles.changePlanText}>{t('plans.changePlan')}</Text>
          </View>
        </TouchableOpacity>

        {/* Menu */}
        <View style={[styles.menuCard, { backgroundColor: colors.card }]}>
          {menuItems.map((item, index) => (
            <View key={item.id}>
              <TouchableOpacity style={styles.menuRow} activeOpacity={0.7} onPress={item.onPress}>
                <Text style={styles.menuIcon}>{item.icon}</Text>
                <View style={styles.menuText}>
                  <Text style={[styles.menuLabel, { color: colors.text }]}>{item.label}</Text>
                  <Text style={[styles.menuDescription, { color: colors.textMuted }]}>{item.description}</Text>
                </View>
                <Text style={[styles.menuArrow, { color: colors.border }]}>›</Text>
              </TouchableOpacity>
              {index < menuItems.length - 1 && <View style={[styles.menuSeparator, { backgroundColor: colors.separator }]} />}
            </View>
          ))}
        </View>

        <TouchableOpacity style={styles.logoutButton} onPress={handleSignOut} activeOpacity={0.8} disabled={loading}>
          {loading
            ? <ActivityIndicator color="#EF4444" />
            : <Text style={styles.logoutText}>{t('profile.signOut')}</Text>
          }
        </TouchableOpacity>
      </ScrollView>
      )}

      {/* Modal: editar nickname */}
      <Modal visible={nicknameModalVisible} transparent animationType="slide" onRequestClose={() => setNicknameModalVisible(false)}>
        <Pressable style={styles.backdrop} onPress={() => setNicknameModalVisible(false)} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.sheetWrapper}>
          <View style={[styles.sheet, { backgroundColor: colors.card }]}>
            <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />
            <Text style={[styles.sheetTitle, { color: colors.text }]}>{t('profile.editNickname')}</Text>
            <Text style={[styles.nicknameLabel, { color: colors.textMuted }]}>{t('profile.nicknameLabel')}</Text>
            <TextInput
              style={[styles.nicknameInput, { backgroundColor: colors.surface, color: colors.text }]}
              value={nicknameInput}
              onChangeText={setNicknameInput}
              autoCapitalize="none"
              autoFocus
              placeholderTextColor="#94A3B8"
              placeholder="ej. johnlearner"
            />
            <View style={styles.nicknameActions}>
              <TouchableOpacity style={styles.nicknameCancelBtn} onPress={() => setNicknameModalVisible(false)} activeOpacity={0.8}>
                <Text style={styles.nicknameCancelText}>{t('profile.nicknameCancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.nicknameSaveBtn, (!nicknameInput.trim() || savingNickname) && { opacity: 0.4 }]}
                onPress={handleSaveNickname}
                activeOpacity={0.8}
                disabled={!nicknameInput.trim() || savingNickname}
              >
                {savingNickname
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.nicknameSaveText}>{t('profile.nicknameSave')}</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Modal: about */}
      <Modal visible={aboutModalVisible} transparent animationType="slide" onRequestClose={() => setAboutModalVisible(false)}>
        <Pressable style={styles.backdrop} onPress={() => setAboutModalVisible(false)} />
        <View style={styles.sheetWrapper}>
          <View style={[styles.sheet, { backgroundColor: colors.card }]}>
            <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />
            <View style={styles.aboutHeader}>
              <View style={styles.aboutIconCircle}>
                <Text style={styles.aboutIconText}>📖</Text>
              </View>
              <Text style={[styles.aboutAppName, { color: colors.text }]}>Lexevo</Text>
              <Text style={[styles.aboutVersion, { color: colors.textMuted }]}>{t('profile.aboutVersion')}</Text>
            </View>
            <View style={[styles.aboutDivider, { backgroundColor: colors.border }]} />
            <Text style={[styles.aboutDesc, { color: colors.textSub }]}>{t('profile.aboutDesc')}</Text>
            <View style={[styles.aboutInfoCard, { backgroundColor: colors.surface }]}>
              <View style={styles.aboutInfoRow}>
                <Text style={[styles.aboutInfoLabel, { color: colors.textMuted }]}>{t('profile.aboutDeveloper')}</Text>
                <Text style={[styles.aboutInfoValue, { color: colors.text }]}>Jerson</Text>
              </View>
              <View style={[styles.aboutInfoSep, { backgroundColor: colors.border }]} />
              <View style={styles.aboutInfoRow}>
                <Text style={[styles.aboutInfoLabel, { color: colors.textMuted }]}>{t('profile.aboutContact')}</Text>
                <Text style={[styles.aboutInfoValue, { color: '#4F46E5' }]}>jersonjim@gmail.com</Text>
              </View>
            </View>
            <Text style={[styles.aboutCopyright, { color: colors.textMuted }]}>© 2026 Lexevo</Text>
            <TouchableOpacity style={styles.confirmBtn} onPress={() => setAboutModalVisible(false)} activeOpacity={0.8}>
              <Text style={styles.confirmBtnText}>{t('profile.aboutClose')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal: cambiar mascota */}
      <Modal visible={mascotModalVisible} transparent animationType="slide" onRequestClose={() => setMascotModalVisible(false)}>
        <Pressable style={styles.backdrop} onPress={() => setMascotModalVisible(false)} />
        <View style={styles.sheetWrapper}>
          <View style={[styles.sheet, { backgroundColor: colors.card }]}>
            <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />
            <Text style={[styles.sheetTitle, { color: colors.text }]}>{t('profile.mascotTitle')}</Text>
            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 400 }} contentContainerStyle={styles.mascotGrid}>
              {STREAK_THEMES.map((theme) => {
                const isSelected = mascotSelected === theme.id;
                return (
                  <TouchableOpacity
                    key={theme.id}
                    style={[styles.mascotCard, { backgroundColor: colors.surface, borderColor: isSelected ? '#4F46E5' : colors.border }, isSelected && styles.mascotCardSelected]}
                    onPress={() => setMascotSelected(theme.id)}
                    activeOpacity={0.8}
                  >
                    {isSelected && (
                      <View style={styles.mascotCheckBadge}>
                        <Text style={styles.mascotCheckText}>✓</Text>
                      </View>
                    )}
                    <Text style={styles.mascotMainEmoji}>{getMascotEmoji(theme.id, streak)}</Text>
                    <Text style={[styles.mascotCardName, { color: colors.text }, isSelected && { color: '#4F46E5' }]}>{t(theme.nameKey)}</Text>
                    <View style={styles.mascotStagesRow}>
                      {theme.stages.map((s, i) => (
                        <Text key={i} style={styles.mascotStageEmoji}>{s}</Text>
                      ))}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <TouchableOpacity style={styles.confirmBtn} onPress={handleSaveMascot} activeOpacity={0.8}>
              <Text style={styles.confirmBtnText}>{t('common.save')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal: cambiar plan */}
      <Modal visible={planModalVisible} transparent animationType="slide" onRequestClose={() => setPlanModalVisible(false)}>
        <Pressable style={styles.backdrop} onPress={() => setPlanModalVisible(false)} />
        <View style={styles.sheetWrapper}>
          <View style={[styles.sheet, { backgroundColor: colors.card }]}>
            <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />
            <Text style={[styles.sheetTitle, { color: colors.text }]}>{t('plans.changePlanTitle')}</Text>

            <View style={styles.planOptions}>
              {PLANS.map((plan) => {
                const intervals = BOX_INTERVALS[plan.boxCount];
                const isSelected = selectedPlan === plan.boxCount;
                return (
                  <TouchableOpacity
                    key={plan.boxCount}
                    style={[styles.planOption, isSelected && { borderColor: plan.color, backgroundColor: plan.bg }]}
                    onPress={() => setSelectedPlan(plan.boxCount)}
                    activeOpacity={0.8}
                  >
                    <View style={styles.planOptionLeft}>
                      <Text style={styles.planOptionEmoji}>{plan.emoji}</Text>
                      <View>
                        <View style={styles.planNameRow}>
                          <Text style={[styles.planOptionName, isSelected && { color: plan.color }]}>{t(plan.nameKey)}</Text>
                          {plan.recommended && (
                            <View style={[styles.recBadge, { backgroundColor: plan.color }]}>
                              <Text style={styles.recBadgeText}>{t('plans.recommended')}</Text>
                            </View>
                          )}
                        </View>
                        <Text style={styles.planOptionBoxes}>{t('plans.boxes', { count: plan.boxCount })}</Text>
                      </View>
                    </View>
                    <View style={styles.intervalRow}>
                      {intervals.map((days, i) => (
                        <View key={i} style={[styles.intervalBox, isSelected && { backgroundColor: plan.color }]}>
                          <Text style={styles.intervalNum}>{i + 1}</Text>
                        </View>
                      ))}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity
              style={[styles.confirmBtn, savingPlan && { opacity: 0.6 }]}
              onPress={handleConfirmPlan}
              activeOpacity={0.8}
              disabled={savingPlan}
            >
              {savingPlan
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.confirmBtnText}>{t('plans.confirm')}</Text>
              }
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: { paddingTop: 60, paddingHorizontal: 24, paddingBottom: 20 },
  title: { fontSize: 28, fontWeight: '700', color: '#0F172A' },
  scroll: { paddingHorizontal: 24, paddingBottom: 40, gap: 16 },
  profileCard: {
    backgroundColor: '#FFFFFF', borderRadius: 20, padding: 24,
    alignItems: 'center', gap: 6,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  avatarContainer: { width: 88, height: 88, marginBottom: 8 },
  avatarCircle: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: '#4F46E5',
    overflow: 'hidden',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarImage: { width: 88, height: 88 },
  avatarText: { fontSize: 32, fontWeight: '700', color: '#FFFFFF' },
  cameraOverlay: {
    position: 'absolute', bottom: 0, right: 0,
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: '#4F46E5', alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#fff',
  },
  cameraIcon: { fontSize: 13 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { fontSize: 20, fontWeight: '700', color: '#0F172A' },
  editIcon: { fontSize: 14 },
  emailText: { fontSize: 14, color: '#64748B' },
  nicknameLabel: { fontSize: 12, fontWeight: '600', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.5 },
  nicknameInput: { backgroundColor: '#F1F5F9', borderRadius: 12, padding: 14, fontSize: 16, color: '#0F172A' },
  nicknameActions: { flexDirection: 'row', gap: 12 },
  nicknameCancelBtn: { flex: 1, padding: 14, borderRadius: 12, backgroundColor: '#F1F5F9', alignItems: 'center' },
  nicknameCancelText: { fontSize: 15, fontWeight: '600', color: '#64748B' },
  nicknameSaveBtn: { flex: 1, padding: 14, borderRadius: 12, backgroundColor: '#4F46E5', alignItems: 'center' },
  nicknameSaveText: { fontSize: 15, fontWeight: '600', color: '#FFFFFF' },
  statsRow: {
    backgroundColor: '#FFFFFF', borderRadius: 16, flexDirection: 'row', padding: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  statBox: { flex: 1, alignItems: 'center', gap: 4 },
  statNumber: { fontSize: 24, fontWeight: '700', color: '#4F46E5' },
  statLabel: { fontSize: 12, color: '#64748B', fontWeight: '500', textAlign: 'center' },
  statDivider: { width: 1, backgroundColor: '#E2E8F0', marginVertical: 4 },
  // Plan card
  planCard: {
    borderRadius: 18, padding: 18, borderWidth: 1.5,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
  },
  planCardLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  planEmoji: { fontSize: 36 },
  planCardLabel: { fontSize: 11, fontWeight: '600', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.5 },
  planCardName: { fontSize: 20, fontWeight: '800' },
  planCardBoxes: { fontSize: 12, color: '#94A3B8', marginTop: 1 },
  changePlanBtn: { borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  changePlanText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  // Menu
  menuCard: {
    backgroundColor: '#FFFFFF', borderRadius: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 3, overflow: 'hidden',
  },
  menuRow: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 14 },
  menuIcon: { fontSize: 22, width: 28, textAlign: 'center' },
  menuText: { flex: 1 },
  menuLabel: { fontSize: 16, fontWeight: '500', color: '#0F172A' },
  menuDescription: { fontSize: 13, color: '#94A3B8', marginTop: 1 },
  menuArrow: { fontSize: 22, color: '#CBD5E1', fontWeight: '300' },
  menuSeparator: { height: 1, backgroundColor: '#F1F5F9', marginLeft: 58 },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  logoutButton: { backgroundColor: '#FEF2F2', borderRadius: 14, padding: 16, alignItems: 'center' },
  logoutText: { fontSize: 16, fontWeight: '600', color: '#EF4444' },
  // Modal
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheetWrapper: { justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 48, gap: 14 },
  sheetHandle: { width: 40, height: 4, backgroundColor: '#E2E8F0', borderRadius: 2, alignSelf: 'center', marginBottom: 4 },
  sheetTitle: { fontSize: 20, fontWeight: '700', color: '#0F172A' },
  planOptions: { gap: 10 },
  planOption: {
    borderRadius: 16, padding: 14, borderWidth: 2, borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF', gap: 10,
  },
  planOptionLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  planOptionEmoji: { fontSize: 26 },
  planNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  planOptionName: { fontSize: 17, fontWeight: '800', color: '#0F172A' },
  planOptionBoxes: { fontSize: 12, color: '#94A3B8', marginTop: 1 },
  recBadge: { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2 },
  recBadgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  intervalRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  intervalBox: { width: 28, height: 28, borderRadius: 7, backgroundColor: '#E2E8F0', alignItems: 'center', justifyContent: 'center' },
  intervalNum: { fontSize: 11, fontWeight: '700', color: '#fff' },
  confirmBtn: { backgroundColor: '#4F46E5', borderRadius: 14, padding: 16, alignItems: 'center', marginTop: 4 },
  confirmBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  // Mascot picker
  mascotGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'space-between' },
  mascotCard: {
    width: '47%', borderRadius: 14, padding: 12, borderWidth: 2,
    alignItems: 'center', gap: 6, position: 'relative',
  },
  mascotCardSelected: { backgroundColor: '#EEF2FF' },
  mascotCheckBadge: {
    position: 'absolute', top: 6, right: 6, width: 20, height: 20,
    borderRadius: 10, backgroundColor: '#4F46E5', alignItems: 'center', justifyContent: 'center',
  },
  mascotCheckText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  mascotMainEmoji: { fontSize: 40 },
  mascotCardName: { fontSize: 13, fontWeight: '700' },
  mascotStagesRow: { flexDirection: 'row', gap: 2, flexWrap: 'wrap', justifyContent: 'center' },
  mascotStageEmoji: { fontSize: 11 },
  // About modal
  aboutHeader: { alignItems: 'center', gap: 6, paddingTop: 8 },
  aboutIconCircle: {
    width: 72, height: 72, borderRadius: 20, backgroundColor: '#EEF2FF',
    alignItems: 'center', justifyContent: 'center', marginBottom: 4,
  },
  aboutIconText: { fontSize: 36 },
  aboutAppName: { fontSize: 24, fontWeight: '800', color: '#0F172A' },
  aboutVersion: { fontSize: 13, color: '#94A3B8', fontWeight: '500' },
  aboutDivider: { height: 1, backgroundColor: '#E2E8F0' },
  aboutDesc: { fontSize: 15, color: '#64748B', textAlign: 'center', lineHeight: 22 },
  aboutInfoCard: { borderRadius: 14, overflow: 'hidden' },
  aboutInfoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14, paddingHorizontal: 16 },
  aboutInfoLabel: { fontSize: 13, fontWeight: '500', color: '#94A3B8' },
  aboutInfoValue: { fontSize: 13, fontWeight: '600', color: '#0F172A' },
  aboutInfoSep: { height: 1, backgroundColor: '#E2E8F0', marginHorizontal: 16 },
  aboutCopyright: { fontSize: 12, color: '#94A3B8', textAlign: 'center' },
});
