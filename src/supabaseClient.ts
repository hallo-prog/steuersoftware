import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Vite spezifische Typen (falls nicht vorhanden)
interface ImportMetaEnv {
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_ANON_KEY?: string;
}
interface ImportMeta { env: ImportMetaEnv }

// Nur noch .env / Build-Zeit Variablen (keine window.* Fallbacks für klarere & sichere Konfiguration)
const SUPABASE_URL = (import.meta as any).env?.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || '';

let supabase: SupabaseClient | null = null;
if (SUPABASE_URL && SUPABASE_ANON_KEY) {
  try {
    supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: true } });
  } catch (e) {
    console.warn('Supabase Client Init Fehler', e);
  }
} else {
  if (typeof window !== 'undefined') {
    console.info('Supabase nicht konfiguriert (fehlende VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY) – Funktionen deaktiviert.');
  }
}

export { supabase };
