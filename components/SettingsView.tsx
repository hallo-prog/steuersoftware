import React, { useState } from 'react';
import { MailIcon } from './icons/MailIcon';
import { WhatsAppIcon } from './icons/WhatsAppIcon';
import { Document, DocumentSource, DocumentStatus, InvoiceType, NotificationSettings } from '../types';
import LexofficeIcon from './icons/LexofficeIcon';
import CalendarIcon from './icons/CalendarIcon';
import ChatBubbleIcon from './icons/ChatBubbleIcon';

interface SettingsViewProps {
  setDocuments: React.Dispatch<React.SetStateAction<Document[]>>;
  apiKey: string;
  setApiKey: (key: string) => void;
  lexofficeApiKey: string;
  setLexofficeApiKey: (key: string) => void;
  tavilyApiKey: string;
  setTavilyApiKey: (key: string) => void;
  notificationSettings: NotificationSettings;
  setNotificationSettings: React.Dispatch<React.SetStateAction<NotificationSettings>>;
  chatSystemPrompt: string;
  setChatSystemPrompt: (prompt: string) => void;
  DEFAULT_CHAT_PROMPT: string;
  userId?: string;
}

import { useThemeClasses } from '../hooks/useThemeClasses';
import { useFeatureFlags } from '../hooks/useFeatureFlags';

const SettingsCard: React.FC<{ title: string; description: string; children: React.ReactNode }> = ({ title, description, children }) => {
  const ui = useThemeClasses();
  return (
    <div className={`${ui.card} ${ui.border} p-6 rounded-xl shadow-sm`}>
        <h2 className={`text-xl font-bold ${ui.textPrimary}`}>{title}</h2>
        <p className={`${ui.textMuted} mt-1 mb-6`}>{description}</p>
        {children}
    </div>
  );
};


const SettingsView: React.FC<SettingsViewProps> = ({ setDocuments, apiKey, setApiKey, lexofficeApiKey, setLexofficeApiKey, tavilyApiKey, setTavilyApiKey, notificationSettings, setNotificationSettings, chatSystemPrompt, setChatSystemPrompt, DEFAULT_CHAT_PROMPT, userId }) => {
  const { flags, toggle } = useFeatureFlags(userId);
  const [emails, setEmails] = useState<string[]>(['anna.muster@mail.com', 'privat@email.de']);
  const [newEmail, setNewEmail] = useState('');
  const [scanPeriod, setScanPeriod] = useState<string>('30');
  const [isWhatsAppConnected, setIsWhatsAppConnected] = useState(true);
  const [isScanning, setIsScanning] = useState(false);
  const [chatContextLimit, setChatContextLimit] = useState<number>(()=> { try { return Number(localStorage.getItem('chatContextLimit'))||60; } catch { return 60; } });
  const [chatSummarizeThreshold, setChatSummarizeThreshold] = useState<number>(()=> { try { return Number(localStorage.getItem('chatSummarizeThreshold'))||40; } catch { return 40; } });
  const [chatSummaryMaxChars, setChatSummaryMaxChars] = useState<number>(()=> { try { return Number(localStorage.getItem('chatSummaryMaxChars'))||1000; } catch { return 1000; } });

  const handleAddEmail = (e: React.FormEvent) => {
    e.preventDefault();
    if (newEmail && !emails.includes(newEmail)) {
      setEmails([...emails, newEmail]);
      setNewEmail('');
    }
  };

  const handleScanEmails = () => {
    setIsScanning(true);
    setTimeout(() => {
      const foundDocs: Document[] = [
        // ... (simulated documents as before)
      ];
      setDocuments(prev => [...prev, ...foundDocs].sort((a,b) => b.date.getTime() - a.date.getTime()));
      setIsScanning(false);
    }, 2000);
  };
  
  const handleSimulateWhatsApp = () => {
     const newDoc: Document = {
        id: `whatsapp-${Date.now()}`,
        name: 're_supermarkt_3,78€_11_2024.jpg',
        date: new Date(new Date().setDate(new Date().getDate() - 2)),
        year: new Date().getFullYear(),
        quarter: Math.floor((new Date().getMonth() + 3) / 3),
        source: DocumentSource.WHATSAPP,
        status: DocumentStatus.OK,
        fileUrl: 'https://picsum.photos/400/600',
        textContent: 'Supermarkt Quittung\nMilch: 1.29\nBrot: 2.49',
        vendor: 'Supermarkt',
        totalAmount: 3.78,
        vatAmount: 0.25,
        invoiceType: InvoiceType.INCOMING,
     };
     setDocuments(prev => [...prev, newDoc].sort((a, b) => b.date.getTime() - a.date.getTime()));
  };
  
  const handleNotificationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNotificationSettings(prev => ({
        ...prev,
        [e.target.name]: e.target.checked
    }));
  };

  const ui = useThemeClasses();
  return (
    <div className="space-y-8">
      <h1 className={`text-3xl font-bold ${ui.textPrimary}`}>Einstellungen</h1>
      
      {/* API Key Section */}
      <SettingsCard 
        title="Konfiguration" 
        description="Verwalten Sie Ihre API-Schlüssel und passen Sie das Verhalten des KI-Assistenten an."
      >
        <div className="space-y-4">
            <div>
                <label htmlFor="api-key" className={`block text-sm font-medium mb-1 ${ui.textSecondary}`}>Gemini API Schlüssel</label>
                <input
                  type="password"
                  id="api-key"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Geben Sie Ihren API-Schlüssel hier ein"
                  className={`w-full p-2 rounded-lg ${ui.input} ${ui.ringFocus}`}
                />
            </div>
             <div>
                <label htmlFor="lexoffice-api-key" className={`block text-sm font-medium mb-1 ${ui.textSecondary}`}>Lexoffice API Schlüssel</label>
                <input
                  type="password"
                  id="lexoffice-api-key"
                  value={lexofficeApiKey}
                  onChange={(e) => setLexofficeApiKey(e.target.value)}
                  placeholder="Geben Sie Ihren Lexoffice API-Schlüssel ein"
                  className={`w-full p-2 rounded-lg ${ui.input} ${ui.ringFocus}`}
                />
            </div>
            <div>
                <label htmlFor="tavily-api-key" className={`block text-sm font-medium mb-1 ${ui.textSecondary}`}>Tavily API Schlüssel (Websuche)</label>
                <input
                  type="password"
                  id="tavily-api-key"
                  value={tavilyApiKey}
                  onChange={(e) => setTavilyApiKey(e.target.value)}
                  placeholder="Tavily API Key für intelligente Förder-Recherche"
                  className={`w-full p-2 rounded-lg ${ui.input} ${ui.ringFocus}`}
                />
                <p className={`text-xs mt-1 ${ui.textMuted}`}>Falls gesetzt, nutzt die KI eine erweiterte Websuche für Förderprogramme.</p>
            </div>
        </div>
  <p className={`text-xs mt-4 text-center ${ui.textMuted}`}>Ihre API-Schlüssel werden sicher in Ihrem Browser gespeichert.</p>
      </SettingsCard>

      {/* Chat Limits */}
      <SettingsCard
        title="KI-Chat Speicher & Kontext"
        description="Steuern Sie wie viele Nachrichten der Chat direkt sieht und ab wann zusammengefasst wird. Höhere Werte = mehr Kontext aber höhere Kosten/Latenz."
      >
        <div className="grid md:grid-cols-3 gap-6">
          <div>
            <label className={`block text-xs font-semibold mb-1 ${ui.textSecondary}`}>Kontext-Limit (Nachrichten)</label>
            <input type="number" min={10} max={200} value={chatContextLimit} onChange={e=>{ const v=Number(e.target.value); setChatContextLimit(v); localStorage.setItem('chatContextLimit', String(v)); window.dispatchEvent(new CustomEvent('chatConfigChanged')); }} className={`w-full px-3 py-2 rounded-lg text-sm ${ui.input}`} />
            <p className={`text-[10px] mt-1 ${ui.textMuted}`}>Anzahl letzter Nachrichten, die unverändert gesendet werden.</p>
          </div>
          <div>
            <label className={`block text-xs font-semibold mb-1 ${ui.textSecondary}`}>Summarize Schwelle</label>
            <input type="number" min={10} max={300} value={chatSummarizeThreshold} onChange={e=>{ const v=Number(e.target.value); setChatSummarizeThreshold(v); localStorage.setItem('chatSummarizeThreshold', String(v)); window.dispatchEvent(new CustomEvent('chatConfigChanged')); }} className={`w-full px-3 py-2 rounded-lg text-sm ${ui.input}`} />
            <p className={`text-[10px] mt-1 ${ui.textMuted}`}>Ab dieser Gesamtzahl beginnt automatisch die Verdichtung.</p>
          </div>
          <div>
            <label className={`block text-xs font-semibold mb-1 ${ui.textSecondary}`}>Max Summary Zeichen</label>
            <input type="number" min={200} max={4000} value={chatSummaryMaxChars} onChange={e=>{ const v=Number(e.target.value); setChatSummaryMaxChars(v); localStorage.setItem('chatSummaryMaxChars', String(v)); window.dispatchEvent(new CustomEvent('chatConfigChanged')); }} className={`w-full px-3 py-2 rounded-lg text-sm ${ui.input}`} />
            <p className={`text-[10px] mt-1 ${ui.textMuted}`}>Länge der gespeicherten Zusammenfassung (kürzer = schneller).</p>
          </div>
        </div>
        <div className="mt-4 flex gap-2">
          <button type="button" onClick={()=>{ setChatContextLimit(60); setChatSummarizeThreshold(40); setChatSummaryMaxChars(1000); ['chatContextLimit','chatSummarizeThreshold','chatSummaryMaxChars'].forEach(k=> localStorage.removeItem(k)); window.dispatchEvent(new CustomEvent('chatConfigChanged')); }} className="text-xs px-3 py-1 rounded bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600">Standard</button>
        </div>
      </SettingsCard>

      {/* Chat Behavior Section */}
      <SettingsCard 
        title="KI-Chat-Verhalten ('Gehirn')" 
        description="Passen Sie die Systemanweisung des KI-Assistenten an. Dies beeinflusst seine Persönlichkeit, sein Wissen und wie er auf Anfragen reagiert."
      >
    <textarea
            value={chatSystemPrompt}
            onChange={(e) => setChatSystemPrompt(e.target.value)}
            rows={15}
      className={`w-full p-3 rounded-lg font-mono text-xs bg-slate-50/80 dark:bg-slate-900/50 ${ui.textPrimary} ${ui.textSecondary} ${ui.input} ${ui.ringFocus}`}
            placeholder="Geben Sie hier die Systemanweisung für den Chat ein..."
        />
        <div className="flex justify-end mt-4 items-center gap-4">
         <p className={`text-xs mr-auto text-left ${ui.textMuted}`}>
                <strong>Tipp:</strong> Fügen Sie URLs zu vertrauenswürdigen Quellen (z.B. Steuer-Websites) in den Text ein. Der KI-Agent kann diese als Wissensbasis für Recherchen nutzen.
            </p>
            <button 
                onClick={() => setChatSystemPrompt(DEFAULT_CHAT_PROMPT)}
           className={`text-sm font-semibold transition-colors flex-shrink-0 ${ui.textSecondary} hover:text-red-600`}
            >
                Auf Standard zurücksetzen
            </button>
        </div>
      </SettingsCard>
      
      {/* Notifications Section */}
      <SettingsCard
        title="Benachrichtigungen für Fristen"
        description="Legen Sie fest, wann Sie an bevorstehende Steuerfristen erinnert werden möchten."
      >
        <div className="space-y-3">
          <label className="flex items-center p-3 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer bg-slate-50 dark:bg-slate-900/40">
            <input
              type="checkbox"
              name="notify14Days"
              checked={notificationSettings.notify14Days}
              onChange={handleNotificationChange}
              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <span className={`ml-3 text-sm ${ui.textSecondary}`}>Benachrichtigung 2 Wochen vor Fristablauf</span>
          </label>
          <label className="flex items-center p-3 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer bg-slate-50 dark:bg-slate-900/40">
            <input
              type="checkbox"
              name="notify1Day"
              checked={notificationSettings.notify1Day}
              onChange={handleNotificationChange}
              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <span className={`ml-3 text-sm ${ui.textSecondary}`}>Benachrichtigung 1 Tag vor Fristablauf</span>
          </label>
        </div>
      </SettingsCard>

      <SettingsCard
        title="Integrationen (Simuliert)"
        description="Verbinden Sie Ihre Konten, damit der KI-Agent automatisch nach Belegen suchen kann."
      >
        <div className="space-y-6">
            {/* Email */}
            <div>
              <h3 className={`text-lg font-semibold mb-4 flex items-center ${ui.textSecondary}`}><MailIcon className="w-5 h-5 mr-3 text-slate-500 dark:text-slate-400" />E-Mail-Konten</h3>
              <div className="space-y-2 mb-4">
                {emails.map((email, index) => (
                  <div key={index} className="flex justify-between items-center p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900/40">
                    <span className={`text-sm ${ui.textSecondary}`}>{email}</span>
                    <button className="text-red-500 hover:text-red-700 text-xs font-semibold">Entfernen</button>
                  </div>
                ))}
              </div>
              <form onSubmit={handleAddEmail} className="flex items-center space-x-2 mb-4">
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="neue.email@beispiel.de"
                  className={`flex-grow p-2 rounded-lg ${ui.input}`}
                />
                <button type="submit" className="font-semibold py-2 px-4 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-600">
                  Hinzufügen
                </button>
              </form>
              <button
                onClick={handleScanEmails}
                disabled={isScanning}
                className="w-full bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-blue-700 transition duration-300 disabled:bg-blue-300 flex items-center justify-center"
              >
                {isScanning ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div>
                    Scanne E-Mails...
                  </>
                ) : (
                  'Jetzt E-Mails scannen'
                )}
              </button>
            </div>
            {/* WhatsApp */}
            <div>
              <h3 className={`text-lg font-semibold mb-4 flex items-center ${ui.textSecondary}`}><WhatsAppIcon className="w-5 h-5 mr-3 text-green-500" />WhatsApp</h3>
          <div className="flex justify-between items-center p-3 rounded-lg bg-slate-50 dark:bg-slate-900/40">
            <p className={`${ui.textSecondary}`}>Status: {isWhatsAppConnected ? <span className="text-green-600 dark:text-green-400 font-semibold">Verbunden</span> : 'Nicht verbunden'}</p>
                 <label className="inline-flex items-center cursor-pointer">
                    <input type="checkbox" checked={isWhatsAppConnected} onChange={() => setIsWhatsAppConnected(!isWhatsAppConnected)} className="sr-only peer" />
              <div className="relative w-11 h-6 bg-slate-200 dark:bg-slate-700 rounded-full peer peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-600 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:start-[2px] after:bg-white dark:after:bg-slate-200 after:border-slate-300 dark:after:border-slate-500 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600 dark:peer-checked:bg-blue-500"></div>
                </label>
              </div>
            </div>
        </div>
      </SettingsCard>

      <SettingsCard
        title="Feature Flags"
        description="Experimentelle Funktionen aktivieren (pro Nutzer)."
      >
        <div className="space-y-2">
          {['risk_heatmap','anomaly_detection','optimizer','coverage_graph'].map(f => (
            <label key={f} className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900/40 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{f}</span>
              <input type="checkbox" className="h-4 w-4" checked={!!flags[f]} onChange={e=> toggle(f, e.target.checked)} />
            </label>
          ))}
          <p className="text-[10px] text-slate-500 dark:text-slate-400">Persistiert in Supabase Tabelle feature_flags.</p>
        </div>
      </SettingsCard>
    </div>
  );
};

export default SettingsView;