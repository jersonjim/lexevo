import { useState } from 'react';
import {
  StyleSheet, Text, View, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { supabase } from '../supabase';

type Props = { onGoToRegister: () => void };

export default function LoginScreen({ onGoToRegister }: Props) {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    if (!email.trim() || !password.trim()) return;
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setLoading(false);
    if (error) Alert.alert(t('common.error'), error.message);
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={styles.inner}>
        <View style={styles.logoBox}>
          <Text style={styles.logoEmoji}>📖</Text>
        </View>
        <Text style={styles.title}>{t('login.welcome')}</Text>
        <Text style={styles.subtitle}>{t('login.subtitle')}</Text>

        <View style={styles.form}>
          <Text style={styles.label}>{t('login.email')}</Text>
          <TextInput
            style={styles.input}
            placeholder="tu@email.com"
            placeholderTextColor="#94A3B8"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />

          <Text style={styles.label}>{t('login.password')}</Text>
          <TextInput
            style={styles.input}
            placeholder="••••••••"
            placeholderTextColor="#94A3B8"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          <TouchableOpacity
            style={[styles.button, (!email.trim() || !password.trim()) && styles.buttonDisabled]}
            onPress={handleLogin}
            activeOpacity={0.8}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.buttonText}>{t('login.loginBtn')}</Text>
            }
          </TouchableOpacity>
        </View>

        <TouchableOpacity onPress={onGoToRegister} style={styles.footer}>
          <Text style={styles.footerText}>
            {t('login.noAccount')}<Text style={styles.footerLink}>{t('login.registerLink')}</Text>
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  inner: { flex: 1, paddingHorizontal: 28, justifyContent: 'center', gap: 8 },
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
