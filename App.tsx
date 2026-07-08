import { useEffect, useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, View, TouchableOpacity, Text, Image, StyleSheet, Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';
import './i18n';
import { applyStoredLanguage } from './i18n';
import { ProfileProvider, useProfileContext } from './context/ProfileContext';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import HomeScreen from './screens/HomeScreen';
import WordsScreen from './screens/WordsScreen';
import ProfileScreen from './screens/ProfileScreen';
import LoginScreen from './screens/LoginScreen';
import RegisterScreen from './screens/RegisterScreen';
import BoxSelectionScreen from './screens/BoxSelectionScreen';
import ThemeSelectionScreen from './screens/ThemeSelectionScreen';
import StudyScreen from './screens/StudyScreen';
import PracticeScreen from './screens/PracticeScreen';

const Tab = createBottomTabNavigator();
const RootStack = createNativeStackNavigator();

function TabHeader({ navigation }: { navigation: any }) {
  const { avatarUrl, headerInitial, syncProfile } = useProfileContext();
  const { colors } = useTheme();
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    setImgError(false);
  }, [avatarUrl]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase.from('profiles').select('nickname, avatar_url').eq('id', user.id).single()
        .then(({ data }) => {
          const url = data?.avatar_url ?? null;
          const initial = data?.nickname ? data.nickname[0].toUpperCase() : '?';
          syncProfile(url, initial);
        });
    });
  }, []);

  return (
    <View style={[headerStyles.container, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
      <TouchableOpacity
        onPress={() => navigation.navigate('Profile')}
        activeOpacity={0.8}
        style={headerStyles.avatarBtn}
      >
        <View style={headerStyles.avatarCircle}>
          {avatarUrl && !imgError ? (
            <Image
              source={{ uri: avatarUrl }}
              style={headerStyles.avatarImg}
              onError={() => setImgError(true)}
            />
          ) : (
            <Text style={headerStyles.avatarInitial}>{headerInitial}</Text>
          )}
        </View>
      </TouchableOpacity>

      <View style={headerStyles.rightButtons}>
        <TouchableOpacity
          style={headerStyles.csvBtn}
          activeOpacity={0.8}
          onPress={() => navigation.navigate('Home', { openCsv: Date.now() })}
        >
          <Text style={headerStyles.csvBtnText}>CSV</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={headerStyles.addBtn}
          activeOpacity={0.8}
          onPress={() => navigation.navigate('Home', { openAdd: Date.now() })}
        >
          <Text style={headerStyles.addBtnText}>+</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const headerStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 54 : 20,
    paddingBottom: 10,
    backgroundColor: '#F8FAFC',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  avatarBtn: { padding: 2 },
  avatarCircle: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#4F46E5',
    overflow: 'hidden',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarImg: { width: 40, height: 40 },
  avatarInitial: { fontSize: 16, fontWeight: '700', color: '#fff' },
  addBtn: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: '#4F46E5',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#4F46E5', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 5,
  },
  addBtnText: { color: '#fff', fontSize: 26, lineHeight: 30, fontWeight: '300' },
  rightButtons: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  csvBtn: {
    height: 40, borderRadius: 20, backgroundColor: '#EEF2FF',
    paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: '#4F46E5',
  },
  csvBtnText: { color: '#4F46E5', fontSize: 12, fontWeight: '800', letterSpacing: 0.5 },
});

function MainTabs() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  return (
    <Tab.Navigator
      screenOptions={({ navigation }) => ({
        header: () => <TabHeader navigation={navigation} />,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
          paddingBottom: 28,
          paddingTop: 10,
          height: 80,
        },
        tabBarActiveTintColor: '#4F46E5',
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
      })}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{ tabBarIcon: () => <Text style={{ fontSize: 22 }}>🏠</Text>, tabBarLabel: t('tabs.home') }}
      />
      <Tab.Screen
        name="Practice"
        component={PracticeScreen}
        options={{ tabBarIcon: () => <Text style={{ fontSize: 22 }}>🎯</Text>, tabBarLabel: t('tabs.practice') }}
      />
      <Tab.Screen
        name="Words"
        component={WordsScreen}
        options={{ tabBarIcon: () => <Text style={{ fontSize: 22 }}>📚</Text>, tabBarLabel: t('tabs.vocabulary') }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ headerShown: false, tabBarIcon: () => <Text style={{ fontSize: 22 }}>👤</Text>, tabBarLabel: t('tabs.account') }}
      />
    </Tab.Navigator>
  );
}

function MainStack() {
  return (
    <RootStack.Navigator screenOptions={{ headerShown: false }}>
      <RootStack.Screen name="MainTabs" component={MainTabs} />
      <RootStack.Screen
        name="Study"
        component={StudyScreen}
        options={{ animation: 'slide_from_bottom' }}
      />
    </RootStack.Navigator>
  );
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [boxCount, setBoxCount] = useState<number | null>(null);
  const [planId, setPlanId] = useState<string | null | undefined>(undefined);
  const [showRegister, setShowRegister] = useState(false);
  const [themeChosen, setThemeChosen] = useState<boolean | null>(null);

  useEffect(() => {
    async function init() {
      await applyStoredLanguage();
      setLoading(false);
    }
    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      if (session) {
        setPlanId(undefined);
        const { data } = await supabase
          .from('profiles')
          .select('plan_id, box_count, streak_theme')
          .eq('id', session.user.id)
          .single();
        setPlanId(data?.plan_id ?? null);
        setBoxCount(data?.box_count ?? null);
        const remoteTheme = data?.streak_theme ?? null;
        if (remoteTheme) {
          await AsyncStorage.setItem('streak_theme', remoteTheme);
          setThemeChosen(true);
        } else {
          const localTheme = await AsyncStorage.getItem('streak_theme');
          setThemeChosen(!!localTheme);
        }
      } else {
        setPlanId(undefined);
        setBoxCount(null);
        setShowRegister(false);
        setThemeChosen(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8FAFC' }}>
        <ActivityIndicator size="large" color="#4F46E5" />
      </View>
    );
  }

  return (
    <ThemeProvider>
    <ProfileProvider>
      <NavigationContainer>
        <StatusBar style="auto" />
        {!session ? (
          showRegister
            ? <RegisterScreen onGoToLogin={() => setShowRegister(false)} />
            : <LoginScreen onGoToRegister={() => setShowRegister(true)} />
        ) : planId === undefined || themeChosen === null ? (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8FAFC' }}>
            <ActivityIndicator size="large" color="#4F46E5" />
          </View>
        ) : planId === null ? (
          <BoxSelectionScreen onDone={(count, pid) => { setBoxCount(count); setPlanId(pid); }} />
        ) : !themeChosen ? (
          <ThemeSelectionScreen onDone={() => setThemeChosen(true)} />
        ) : (
          <MainStack />
        )}
      </NavigationContainer>
    </ProfileProvider>
    </ThemeProvider>
  );
}
