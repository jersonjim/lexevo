import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  'https://siyicqfvggxlvpbnrktr.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNpeWljcWZ2Z2d4bHZwYm5ya3RyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMyOTgxMDcsImV4cCI6MjA5ODg3NDEwN30.JacTFsaw7NYkSSva80YtsswFZu60Tp3vNdqn4dRLx94',
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  }
);
