import { useState } from 'react';
import {
  StyleSheet, Text, View, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert, ScrollView,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { supabase } from '../supabase';

type Props = { onGoToLogin: () => void };

export default function RegisterScreen({ onGoToLogin }: Props) {
  const { t } = useTranslation();
  const [nickname, setNickname] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleRegister() {
    if (!nickname.trim() || !email.trim() || !password.trim()) return;
    if (password.length < 6) {
      Alert.alert(t('common.error'), t('register.passwordError'));
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({ email: email.trim(), password });
    if (error) {
      setLoading(false);
      Alert.alert(t('common.error'), error.message);
      return;
    }
    if (data.user) {
      await supabase.from('profiles').upsert(
        { id: data.user.id, nickname: nickname.trim() },
        { onConflict: 'id' }
      );
    }
    setLoading(false);
    if (!data.session) {
      Alert.alert('📧 Confirma tu email', 'Te enviamos un enlace de confirmación. Una vez confirmado podrás iniciar sesión.');
    }
  }

  const canSubmit = nickname.trim() && email.trim() && password.trim();

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.inner} showsVerticalScrollIndicator={false}>
        <View style={styles.logoBox}>
          <Text style={styles.logoEmoji}>📖</Text>
        </View>
        <Text style={styles.title}>{t('register.title')}</Text>
        <Text style={styles.subtitle}>{t('register.subtitle')}</Text>

        <View style={styles.form}>
          <Text style={styles.label}>{t('register.nickname')}</Text>
          <TextInput
            style={styles.input}
            placeholder={t('register.nicknamePlaceholder')}
            placeholderTextColor="#94A3B8"
            value={nickname}
            onChangeText={setNickname}
            autoCapitalize="none"
            autoFocus
          />

          <Text style={styles.label}>{t('register.email')}</Text>
          <TextInput
            style={styles.input}
            placeholder="tu@email.com"
            placeholderTextColor="#94A3B8"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />

          <Text style={styles.label}>{t('register.password')}</Text>
          <TextInput
            style={styles.input}
            placeholder={t('register.passwordPlaceholder')}
            placeholderTextColor="#94A3B8"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          <TouchableOpacity
            style={[styles.button, !canSubmit && styles.buttonDisabled]}
            onPress={handleRegister}
            activeOpacity={0.8}
            disabled={loading || !canSubmit}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.buttonText}>{t('register.registerBtn')}</Text>
            }
          </TouchableOpacity>
        </View>

        <TouchableOpacity onPress={onGoToLogin} style={styles.footer}>
          <Text style={styles.footerText}>
            {t('register.hasAccount')}<Text style={styles.footerLink}>{t('register.loginLink')}</Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  inner: { flexGrow: 1, paddingHorizontal: 28, justifyContent: 'center', gap: 8, paddingVertical: 60 },
  logoBox: {
    width: 80, height: 80, borderRadius: 24,
    backgroundColor: '#EEF2FF',
    alignItems: 'center', justifyContent: 'center',
    alignSelf: 'center', marginBottom: 16,
  },
  logoEmoji: { fontSize: 40 },
  title: { fontSize: 30, fontWeight: '700', color: '#0F172A', textAlign: 'center' },
  subtitle: { fontSize: 16, color: '#64748B', textAlign: 'center', marginBottom: 16 },
  form: { gap: 10 },
  label: { fontSize: 13, fontWeight: '600', color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.5 },
  input: {
    backgroundColor: '#FFFFFF', borderRadius: 14, padding: 16,
    fontSize: 16, color: '#0F172A',
    borderWidth: 1, borderColor: '#E2E8F0',
    marginBottom: 6,
  },
  button: {
    backgroundColor: '#4F46E5', borderRadius: 14,
    padding: 16, alignItems: 'center', marginTop: 8,
  },
  buttonDisabled: { opacity: 0.4 },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  footer: { marginTop: 24, alignItems: 'center' },
  footerText: { fontSize: 15, color: '#64748B' },
  footerLink: { color: '#4F46E5', fontWeight: '700' },
});
