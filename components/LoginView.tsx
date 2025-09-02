import React, { useState } from 'react';
import { useThemeClasses } from '../hooks/useThemeClasses';

interface LoginViewProps {
  onLogin: () => void;
}

const LoginView: React.FC<LoginViewProps> = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (username === 'admin' && password === 'admin') {
      setError('');
      onLogin();
    } else {
      setError('Ungültiger Benutzername oder Passwort.');
    }
  };

  const ui = useThemeClasses();
  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors">
      <div className="w-full max-w-sm p-8 space-y-6">
        <div className="flex flex-col items-center">
          <div className="bg-blue-600 text-white rounded-lg p-3 mb-4">
            <svg xmlns="http://www.w.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </div>
          <h1 className={`text-2xl font-bold ${ui.textPrimary}`}>Willkommen beim Steuer Agent</h1>
          <p className={`${ui.textMuted}`}>Bitte melden Sie sich an, um fortzufahren.</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="username" className={`text-sm font-medium ${ui.textSecondary}`}>Benutzername</label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              className={`w-full px-3 py-2 mt-1 rounded-lg shadow-sm ${ui.input} ${ui.ringFocus}`}
            />
          </div>
          <div>
            <label htmlFor="password" className={`text-sm font-medium ${ui.textSecondary}`}>Passwort</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className={`w-full px-3 py-2 mt-1 rounded-lg shadow-sm ${ui.input} ${ui.ringFocus}`}
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className={`text-center text-xs ${ui.textMuted}`}>
            Demo: <span className="font-mono">admin</span> / <span className="font-mono">admin</span>
          </div>
          <button
            type="submit"
            className="w-full py-2.5 px-4 font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Anmelden
          </button>
        </form>
      </div>
    </div>
  );
};

export default LoginView;