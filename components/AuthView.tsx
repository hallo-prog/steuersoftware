import React, { useState } from 'react';
import { supabase } from '../src/supabaseClient';
import { useThemeClasses } from '../hooks/useThemeClasses';

interface AuthViewProps {
  onAuthSuccess: () => void;
}

const AuthView: React.FC<AuthViewProps> = ({ onAuthSuccess }) => {
  const [mode, setMode] = useState<'signin'|'signup'|'magic'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError(''); setInfo('');
    try {
      if (mode==='signup') {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      onAuthSuccess();
    } catch (e:any) {
      setError(e.message||'Auth Fehler');
    } finally { setLoading(false); }
  };

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError(''); setInfo('');
    try {
      const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin } });
      if (error) throw error;
      setInfo('Magic Link gesendet (prüfen Sie Ihren Posteingang).');
    } catch (e:any) {
      setError(e.message||'Magic Link Fehler');
    } finally { setLoading(false); }
  };

  const signInWithProvider = async (provider: 'google' | 'github') => {
    setError('');
    const { error } = await supabase.auth.signInWithOAuth({ provider, options: { redirectTo: window.location.origin } });
    if (error) setError(error.message);
  };

  const handleReset = async () => {
    if (!email) { setError('E-Mail für Reset eingeben'); return; }
    setLoading(true); setError(''); setInfo('');
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
      if (error) throw error;
      setInfo('Passwort-Reset Link wurde gesendet (falls Konto existiert).');
    } catch(e:any) {
      setError(e.message||'Reset fehlgeschlagen');
    } finally { setLoading(false); }
  };

  const ui = useThemeClasses();
  return (
    <div className={`flex items-center justify-center min-h-screen p-4 ${ui.layout}`}>
      <div className={`w-full max-w-sm rounded-xl p-6 shadow-sm space-y-6 ${ui.card} ${ui.border}`}>
        <div className="text-center space-y-1">
          <h1 className={`text-xl font-bold ${ui.textPrimary}`}>Steuer Agent</h1>
          <p className={`text-sm ${ui.textMuted}`}>{mode==='signin'?'Anmelden':'Registrieren'} mit Supabase</p>
        </div>
        <div className={`flex rounded-lg p-1 text-xs font-medium ${ui.surfaceSubtle}`}>
          <button onClick={()=>setMode('signin')} className={`w-1/3 py-1.5 rounded-md transition-colors ${mode==='signin'?`${ui.card} shadow text-blue-600`:`${ui.textMuted}`}`}>Login</button>
          <button onClick={()=>setMode('signup')} className={`w-1/3 py-1.5 rounded-md transition-colors ${mode==='signup'?`${ui.card} shadow text-blue-600`:`${ui.textMuted}`}`}>Sign Up</button>
          <button onClick={()=>setMode('magic')} className={`w-1/3 py-1.5 rounded-md transition-colors ${mode==='magic'?`${ui.card} shadow text-blue-600`:`${ui.textMuted}`}`}>Magic Link</button>
        </div>
        {(mode==='signin' || mode==='signup') && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className={`block text-xs font-semibold ${ui.textSecondary}`}>E-Mail</label>
              <input type="email" required value={email} onChange={e=>setEmail(e.target.value)} className={`mt-1 w-full px-3 py-2 rounded-lg text-sm ${ui.input} ${ui.ringFocus}`} />
            </div>
            <div>
              <label className={`block text-xs font-semibold ${ui.textSecondary}`}>Passwort</label>
              <input type="password" required value={password} onChange={e=>setPassword(e.target.value)} className={`mt-1 w-full px-3 py-2 rounded-lg text-sm ${ui.input} ${ui.ringFocus}`} />
            </div>
            {(error || info) && (
              <div className="text-[11px]">
                {error && <div className="mb-1 px-2 py-1 rounded bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-700">{error}</div>}
                {info && <div className="px-2 py-1 rounded bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-700">{info}</div>}
              </div>
            )}
            <button disabled={loading} type="submit" className={`w-full py-2.5 rounded-lg font-semibold text-sm disabled:opacity-40 ${ui.buttonPrimary}`}>{loading? 'Bitte warten...' : (mode==='signin'?'Anmelden':'Konto erstellen')}</button>
            {mode==='signin' && <button type="button" onClick={handleReset} className={`w-full text-center text-[11px] hover:underline ${ui.textMuted}`}>Passwort vergessen?</button>}
          </form>
        )}
        {mode==='magic' && (
          <form onSubmit={handleMagicLink} className="space-y-4">
            <div>
              <label className={`block text-xs font-semibold ${ui.textSecondary}`}>E-Mail</label>
              <input type="email" required value={email} onChange={e=>setEmail(e.target.value)} className={`mt-1 w-full px-3 py-2 rounded-lg text-sm ${ui.input} ${ui.ringFocus}`} />
            </div>
            {(error || info) && (
              <div className="text-[11px]">
                {error && <div className="mb-1 px-2 py-1 rounded bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-700">{error}</div>}
                {info && <div className="px-2 py-1 rounded bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-700">{info}</div>}
              </div>
            )}
            <button disabled={loading} type="submit" className={`w-full py-2.5 rounded-lg font-semibold text-sm disabled:opacity-40 ${ui.buttonPrimary}`}>{loading? 'Sende...' : 'Magic Link senden'}</button>
          </form>
        )}
        <div className="space-y-2">
          <div className={`text-center text-[10px] ${ui.textMuted}`}>Oder mit</div>
          <div className="flex gap-2">
            <button onClick={()=>signInWithProvider('google')} className={`flex-1 py-2 text-xs rounded border ${ui.border} hover:bg-slate-100 dark:hover:bg-slate-700`}>Google</button>
            <button onClick={()=>signInWithProvider('github')} className={`flex-1 py-2 text-xs rounded border ${ui.border} hover:bg-slate-100 dark:hover:bg-slate-700`}>GitHub</button>
          </div>
        </div>
        <p className={`text-[10px] text-center ${ui.textMuted}`}>Mit Anmeldung akzeptieren Sie die Demo-Nutzung. Keine echten Steuerdaten hochladen.</p>
      </div>
    </div>
  );
};

export default AuthView;