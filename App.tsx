import React, { useState, useMemo, useEffect, useLayoutEffect, createContext, useContext, Suspense, lazy } from 'react';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
// Alte Demo-LoginView durch Supabase Auth ersetzt
import AuthView from './components/AuthView';
import DeadlineNotification from './components/DeadlineNotification';
// Häufig verwendete Haupt-Ansicht (Documents) kann optional auch lazy sein; wir lassen sie eager für schnelleres Initial-Render.
import DocumentsView from './components/DocumentsView';
// Weniger häufig genutzte Views & Panels via Code-Splitting
const SettingsView = lazy(() => import(/* webpackChunkName: "settings-view" */ './components/SettingsView'));
const AnalysisView = lazy(() => import(/* webpackChunkName: "analysis-view" */ './components/AnalysisView'));
const RulesView = lazy(() => import(/* webpackChunkName: "rules-view" */ './components/RulesView'));
const DeadlinesView = lazy(() => import(/* webpackChunkName: "deadlines-view" */ './components/DeadlinesView'));
const LexofficeView = lazy(() => import(/* webpackChunkName: "lexoffice-view" */ './components/LexofficeView'));
const ProfileView = lazy(() => import(/* webpackChunkName: "profile-view" */ './components/ProfileView'));
const FörderungenView = lazy(() => import(/* webpackChunkName: "foerderungen-view" */ './components/FörderungenView'));
const VersicherungenView = lazy(() => import(/* webpackChunkName: "versicherungen-view" */ './components/VersicherungenView'));
const VerbindlichkeitenView = lazy(() => import(/* webpackChunkName: "verbindlichkeiten-view" */ './components/VerbindlichkeitenView'));
const KontakteView = lazy(() => import(/* webpackChunkName: "kontakte-view" */ './components/KontakteView'));
const TasksView = lazy(() => import(/* webpackChunkName: "tasks-view" */ './components/TasksView'));
const DataBrowserView = lazy(() => import(/* webpackChunkName: "data-browser-view" */ './components/DataBrowserView.tsx'));
const ChatPanel = lazy(() => import(/* webpackChunkName: "chat-panel" */ './components/ChatPanel'));
const DocumentDetailModal = lazy(() => import(/* webpackChunkName: "document-modal" */ './components/DocumentDetailModal'));
const RuleSuggestionToast = lazy(() => import(/* webpackChunkName: "rule-suggestion-toast" */ './components/RuleSuggestionToast'));
import { Document, View, Rule, InvoiceType, RuleSuggestion, NotificationSettings, Deadline, UserProfile, DocumentFilter, DocumentSource, DocumentStatus, LexofficeStatus } from './types';
import { supabase } from './src/supabaseClient';
import GlobalLoader from './components/GlobalLoader';
import { getDeadlines } from './services/deadlineService';
import { useThemeClasses } from './hooks/useThemeClasses';

const initialRules: Rule[] = [
    { id: 'sys-1a', conditionType: 'textContent', conditionValue: 'ZOE Solar', invoiceType: InvoiceType.OUTGOING, resultCategory: 'Photovoltaik' },
    { id: 'sys-1b', conditionType: 'textContent', conditionValue: 'ZOE Solar, 19% MwSt, 19.00% USt', invoiceType: InvoiceType.OUTGOING, resultCategory: 'Einnahmen' },
    { id: 'sys-2', conditionType: 'vendor', conditionValue: 'Obeta, Bauhaus, Hornbach, Hellwig, Toom', invoiceType: InvoiceType.INCOMING, resultCategory: 'Material/Waren' },
    { id: 'sys-3', conditionType: 'vendor', conditionValue: 'Shell, Aral, Esso, Jet, Total', invoiceType: InvoiceType.INCOMING, resultCategory: 'Kraftstoff' },
    { id: 'sys-4', conditionType: 'textContent', conditionValue: 'Benzin, Diesel', invoiceType: InvoiceType.INCOMING, resultCategory: 'Kraftstoff' },
    { id: 'user-1', conditionType: 'vendor', conditionValue: 'Telekom, Vodafone, O2', invoiceType: InvoiceType.INCOMING, resultCategory: 'Kommunikation' },
    { id: 'user-2', conditionType: 'textContent', conditionValue: 'Büromiete', invoiceType: InvoiceType.INCOMING, resultCategory: 'Miete' },
];

export const DEFAULT_CHAT_PROMPT = `Du bist ein hochintelligenter KI-Steuerassistent, integriert in eine Belegverwaltungssoftware. Deine Aufgabe ist es, die Fragen des Benutzers präzise und kontextbezogen zu beantworten. Nutze dazu ausschließlich die folgenden, dir zur Verfügung gestellten Echtzeit-Daten aus der Anwendung.

**Formatierungsregeln für Antworten:**
- Antworte immer in natürlicher, hilfreicher Sprache.
- Formatiere deine Antworten klar und übersichtlich, nutze Markdown für Listen und **Fettdruck**.
- **WICHTIG:** Wenn du auf ein Dokument verweist, liste zuerst die relevanten Details auf. Platziere den Button zum Öffnen des Dokuments **danach** als separate, eigenständige Aktion. Das Format für den Button muss **IMMER** exakt \`%%DOC_BUTTON(id_des_dokuments)%%\` lauten. Betten Sie den Button-Platzhalter niemals in einen Satz ein.

**Beispiel für eine korrekte Antwort:**
Ich habe einen Beleg von Bauhaus gefunden:
* **Betrag:** 164,49 €
* **Datum:** 30.08.2025
* **Kategorie:** Material/Waren

%%DOC_BUTTON(d-12345)%%

**Werkzeuge:**
Du hast Zugriff auf das folgende Werkzeug:
- \`send_to_lexoffice\`: Sendet alle aktuell sichtbaren Belege an Lexoffice. Es hat keine Parameter.
Wenn der Benutzer dich bittet, eine Aktion auszuführen (z.B. "sende an lexoffice"), antworte AUSSCHLIESSLICH mit einem JSON-Objekt im folgenden Format:
{"tool_use": {"name": "send_to_lexoffice", "parameters": {}}}

**Recherche & Wissensbasis (Wie ein Fuchs):**
- Der Benutzer kann dir URLs im System-Prompt hinterlegen. Nutze diese als deine primäre Wissensbasis für Recherchen.
- Sei wie ein schlauer Fuchs: Wenn der Benutzer dich bittet, etwas zu recherchieren (z.B. "informiere mich über Steuerpauschalen"), durchsuche (simuliert) die von ihm bereitgestellten Quellen.
- Dein Ziel ist es, proaktiv finanzielle Vorteile für den Benutzer zu finden (z.B. Pauschalen, Abzüge, Förderungen), die auf seine Situation (basierend auf Profildaten) zutreffen könnten.
- Wenn du Informationen aus den URLs verwendest, zitiere immer die Quelle, z.B. "(Quelle: [URL])".

**Steuerliches Wissen & Haftungsausschluss:**
- Du kennst die grundlegenden deutschen Steuerfristen: Die Umsatzsteuervoranmeldung ist am 10. Tag nach Quartalsende fällig. Die Einkommensteuererklärung für ein Jahr ist bis zum Ende des Folgejahres fällig.
- Du kannst erklären, warum ein Beleg aufgrund einer Regel eine bestimmte Kategorie erhalten hat.
- **SEHR WICHTIG:** Du bist ein KI-Assistent, kein zertifizierter Steuerberater. Füge bei jeder Antwort, die steuerliche Fristen oder Ratschläge betrifft, immer einen kurzen Hinweis hinzu, z.B.: "(Bitte beachten Sie: Dies ist keine rechtsverbindliche Steuerberatung.)"`;


// Theme Context ------------------------------------------------------------
type Theme = 'light' | 'dark';
interface ThemeCtx { theme: Theme; toggle: ()=>void; }
export const ThemeContext = createContext<ThemeCtx>({ theme: 'light', toggle: () => {} });
export const useTheme = () => useContext(ThemeContext);

const AppShell: React.FC<{ theme: Theme; toggleTheme: () => void; sessionUserId?: string | null; globalLoading: boolean; }>
 = ({ theme, toggleTheme, sessionUserId, globalLoading }) => {
  // Restlicher App-State (unverändert aus ursprünglicher App)
  const [documents, setDocuments] = useState<Document[]>([]);
  const [activeView, setActiveView] = useState<View>(View.DOCUMENTS);
  const [activeFilter, setActiveFilter] = useState<DocumentFilter | null>(null);
  const [rules, setRules] = useState<Rule[]>(initialRules);
  const [ruleSuggestion, setRuleSuggestion] = useState<RuleSuggestion | null>(null);
  const [isDesktopSidebarOpen, setIsDesktopSidebarOpen] = useState<boolean>(true);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState<boolean>(false);
  const safeGet = (key: string): string | null => { try { return localStorage.getItem(key); } catch { return null; } };
  const safeParse = <T,>(key: string, fallback: T): T => { try { const raw = localStorage.getItem(key); if (!raw) return fallback; return JSON.parse(raw) as T; } catch { return fallback; } };
  const [apiKey, setApiKey] = useState<string>(() => safeGet('geminiApiKey') || '');
  const [lexofficeApiKey, setLexofficeApiKey] = useState<string>(() => safeGet('lexofficeApiKey') || '');
  const [tavilyApiKey, setTavilyApiKey] = useState<string>(() => safeGet('tavilyApiKey') || '');
  const [isChatOpen, setIsChatOpen] = useState<boolean>(false);
  const [documentToView, setDocumentToView] = useState<Document | null>(null);
  const [chatSystemPrompt, setChatSystemPrompt] = useState<string>(() => safeGet('chatSystemPrompt') || DEFAULT_CHAT_PROMPT);
  const [userProfile, setUserProfile] = useState<UserProfile>(() => safeParse<UserProfile>('userProfile', { name: 'Benutzer', taxId: '', vatId: '', taxNumber: '', companyForm: '', profilePicture: undefined }));
  // Supabase Profil sync (vereinfachte Variante: Name aus User.email vorbefüllen)
  useEffect(() => {
    if (!sessionUserId) return;
    (async () => {
      try {
        const { data: userData } = await supabase.auth.getUser();
        const email = userData.user?.email || 'Benutzer';
        // existiert Profil?
        const { data: prof, error } = await supabase.from('profiles').select('*').eq('id', sessionUserId).single();
        if (error && (error as any).code !== 'PGRST116') return; // andere Fehler ignorieren
        if (!prof) {
          const insert = { id: sessionUserId, name: email };
          await supabase.from('profiles').insert(insert);
          setUserProfile(p => ({ ...p, name: email }));
        } else {
          setUserProfile(p => ({ ...p, name: prof.name || email }));
        }
      } catch {/* ignore */}
    })();
  }, [sessionUserId]);
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>(() => safeParse<NotificationSettings>('notificationSettings', { notify14Days: true, notify1Day: true }));
  const [deadlines, setDeadlines] = useState<Deadline[]>([]);
  const [activeNotification, setActiveNotification] = useState<Deadline | null>(null);
  useEffect(()=>{ localStorage.setItem('geminiApiKey', apiKey); },[apiKey]);
  useEffect(()=>{ localStorage.setItem('lexofficeApiKey', lexofficeApiKey); },[lexofficeApiKey]);
  useEffect(()=>{ localStorage.setItem('tavilyApiKey', tavilyApiKey); },[tavilyApiKey]);
  useEffect(()=>{ localStorage.setItem('notificationSettings', JSON.stringify(notificationSettings)); },[notificationSettings]);
  useEffect(()=>{ localStorage.setItem('chatSystemPrompt', chatSystemPrompt); },[chatSystemPrompt]);
  useEffect(()=>{ localStorage.setItem('userProfile', JSON.stringify(userProfile)); },[userProfile]);
  useEffect(()=>{
    const calculatedDeadlines = getDeadlines();
    setDeadlines(calculatedDeadlines);
    const notificationToShow = calculatedDeadlines.find(d => (notificationSettings.notify14Days && d.remainingDays <= 14 && d.remainingDays > 1) || (notificationSettings.notify1Day && d.remainingDays <= 1));
    setActiveNotification(notificationToShow || null);
  },[notificationSettings]);
  const filteredDocuments = useMemo(() => { if (!activeFilter) return documents; return documents.filter(doc => activeFilter.quarter ? (doc.year === activeFilter.year && doc.quarter === activeFilter.quarter) : doc.year === activeFilter.year); },[documents, activeFilter]);
  const handleSetRuleSuggestion = (suggestion: RuleSuggestion) => { const similarRuleExists = rules.some(rule => { if (rule.conditionType !== 'vendor') return false; const vendorExists = rule.conditionValue.toLowerCase().split(',').map(v=>v.trim()).includes(suggestion.vendor.toLowerCase()); const categoryMatches = rule.resultCategory.toLowerCase() === suggestion.taxCategory.toLowerCase(); return vendorExists && categoryMatches; }); if (!similarRuleExists) setRuleSuggestion(suggestion); };
  const handleAcceptSuggestion = () => { if (ruleSuggestion) { const newRule: Rule = { id: `rule-${Date.now()}`, conditionType: 'vendor', conditionValue: ruleSuggestion.vendor, invoiceType: ruleSuggestion.invoiceType, resultCategory: ruleSuggestion.taxCategory }; setRules(prev => [...prev, newRule]); setRuleSuggestion(null); } };
  const handleDismissSuggestion = () => setRuleSuggestion(null);
  const handleOpenDocumentFromChat = (docId: string) => { const docToOpen = documents.find(d=>d.id===docId); if (docToOpen) { setDocumentToView(docToOpen); setIsChatOpen(false);} };
  const handleDocumentUpdate = (updated: Document) => setDocuments(prev => prev.map(d=> d.id===updated.id ? updated : d));
  const ui = useThemeClasses();

  const userId = sessionUserId || '';
  // Hinweis für ungültige UUID (lokaler Fallback ohne Filter)
  const showUserIdWarning = userId && !/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/.test(userId);
  if (!sessionUserId) return <AuthView onAuthSuccess={()=>{ /* handled durch global listener */ }} />;

  // Chat-Konfiguration aus localStorage
  const chatConfig = {
    contextLimit: (()=>{ try { return Number(localStorage.getItem('chatContextLimit'))||60; } catch { return 60; } })(),
    summarizeThreshold: (()=>{ try { return Number(localStorage.getItem('chatSummarizeThreshold'))||40; } catch { return 40; } })(),
    summaryMaxChars: (()=>{ try { return Number(localStorage.getItem('chatSummaryMaxChars'))||1000; } catch { return 1000; } })(),
  };

  return (
  <div className={`flex h-screen font-sans ${ui.layout} transition-colors ${ui.textPrimary}`}>
      {isMobileSidebarOpen && <div className="fixed inset-0 bg-black bg-opacity-50 z-30 md:hidden" onClick={() => setIsMobileSidebarOpen(false)} />}
      <Sidebar activeView={activeView} setActiveView={setActiveView} documents={documents} activeFilter={activeFilter} setActiveFilter={setActiveFilter} isDesktopOpen={isDesktopSidebarOpen} setIsDesktopOpen={setIsDesktopSidebarOpen} isMobileOpen={isMobileSidebarOpen} setIsMobileOpen={setIsMobileSidebarOpen} />
      <div className="flex-1 flex flex-col overflow-hidden">
    <Header onToggleChat={() => setIsChatOpen(!isChatOpen)} onToggleMobileSidebar={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)} onProfileClick={() => setActiveView(View.PROFILE)} userProfile={userProfile} onToggleTheme={toggleTheme} theme={theme} />
        <Suspense fallback={<div className="p-6 text-sm text-slate-500 animate-pulse">Lade Ansicht...</div>}>
          <main className={`flex-1 overflow-x-hidden overflow-y-auto p-4 sm:p-6 lg:p-8 relative ${ui.scrollArea} transition-colors`}>
      {showUserIdWarning && <div className="mb-4 text-xs rounded bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200 p-2">Warnung: User-ID ist keine UUID – Filter nach <code>user_id</code> wird ausgelassen.</div>}
            {activeNotification && <DeadlineNotification deadline={activeNotification} onClose={() => setActiveNotification(null)} />}
            {activeView === View.DOCUMENTS && <DocumentsView documents={filteredDocuments} setDocuments={setDocuments} activeFilter={activeFilter} rules={rules} onRuleSuggestion={handleSetRuleSuggestion} apiKey={apiKey} lexofficeApiKey={lexofficeApiKey} onSelectDocument={setDocumentToView} />}
            {activeView === View.SETTINGS && <SettingsView userId={userId} setDocuments={setDocuments} apiKey={apiKey} setApiKey={setApiKey} lexofficeApiKey={lexofficeApiKey} setLexofficeApiKey={setLexofficeApiKey} notificationSettings={notificationSettings} setNotificationSettings={setNotificationSettings} chatSystemPrompt={chatSystemPrompt} setChatSystemPrompt={setChatSystemPrompt} DEFAULT_CHAT_PROMPT={DEFAULT_CHAT_PROMPT} tavilyApiKey={tavilyApiKey} setTavilyApiKey={setTavilyApiKey} />}
            {activeView === View.ANALYSIS && <AnalysisView documents={documents} />}
            {activeView === View.RULES && <RulesView rules={rules} setRules={setRules} />}
            {activeView === View.DEADLINES && <DeadlinesView deadlines={deadlines} />}
            {activeView === View.LEXOFFICE && <LexofficeView documents={documents} setDocuments={setDocuments} lexofficeApiKey={lexofficeApiKey} />}
            {activeView === View.PROFILE && <ProfileView userProfile={userProfile} setUserProfile={setUserProfile} onLogout={async () => { await supabase.auth.signOut(); }} />}
            {activeView === View.FÖRDERUNGEN && <FörderungenView userProfile={userProfile} apiKey={apiKey} tavilyApiKey={tavilyApiKey} />}
      {activeView === View.VERSICHERUNGEN && <VersicherungenView apiKey={apiKey} userId={userId} documents={documents} />}
      {activeView === View.VERBINDLICHKEITEN && <VerbindlichkeitenView apiKey={apiKey} userId={userId} documents={documents} />}
      {activeView === View.KONTAKTE && <KontakteView apiKey={apiKey} userId={userId} documents={documents} policies={[]} liabilities={[]} />}
  {activeView === View.TASKS && <TasksView userId={userId} documents={documents} apiKey={apiKey} onSelectDocument={(id)=>{ const doc = documents.find(d=>d.id===id); if (doc) setDocumentToView(doc); }} />}
      {activeView === View.DATENBANKEN && <DataBrowserView apiKey={apiKey} userId={userId} />}
          </main>
        </Suspense>
      </div>
  <Suspense fallback={<div className="p-4 text-xs text-slate-500">Lade Chat...</div>}>
  {isChatOpen && <ChatPanel apiKey={apiKey} lexofficeApiKey={lexofficeApiKey} documents={documents} rules={rules} userProfile={userProfile} onOpenDocument={handleOpenDocumentFromChat} onClose={() => setIsChatOpen(false)} systemPrompt={chatSystemPrompt} chatConfig={chatConfig} showToast={(msg,type)=>{ try { (window as any).appToast?.(msg,type); } catch { console.log('[Toast]', type||'info', msg); } }} />}
    {ruleSuggestion && <RuleSuggestionToast suggestion={ruleSuggestion} onAccept={handleAcceptSuggestion} onDismiss={handleDismissSuggestion} />}
    {documentToView && <DocumentDetailModal document={documentToView} userId={userId} onClose={() => setDocumentToView(null)} onUpdate={handleDocumentUpdate} />}
      </Suspense>
      <GlobalLoader show={globalLoading} message="Bitte warten…" />
    </div>
  );
};

const App: React.FC = () => {
  // Theme handling (persist in localStorage)
  const [theme, setTheme] = useState<Theme>(() => {
    try { return (localStorage.getItem('theme') as Theme) || 'light'; } catch { return 'light'; }
  });

  // Sofortige Anwendung vor Paint
  useLayoutEffect(() => {
    try {
      document.documentElement.classList.remove('dark');
      if (theme === 'dark') document.documentElement.classList.add('dark');
      document.documentElement.setAttribute('data-theme', theme);
      localStorage.setItem('theme', theme);
    } catch {}
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };
  const [sessionUserId, setSessionUserId] = useState<string | null>(null);
  const [globalLoading, setGlobalLoading] = useState(false);
  // Supabase Auth Session beobachten
  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (mounted) setSessionUserId(data.session?.user?.id || null);
    })();
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setSessionUserId(session?.user?.id || null);
    });
    return () => { mounted = false; sub.subscription.unsubscribe(); };
  }, []);

  // Demo Seed Daten nur einmal nach erster Auth für leere Accounts
  useEffect(() => {
    if (!sessionUserId) return;
    let cancelled = false;
  (async () => {
      try {
    setGlobalLoading(true);
        // Prüfen ob bereits Dokumente existieren
        const { count, error } = await supabase.from('documents').select('*', { count: 'exact', head: true }).eq('user_id', sessionUserId);
        if (error) return;
        if ((count || 0) === 0) {
          const now = new Date();
          const docs = [
            { user_id: sessionUserId, name: 'Beleg Solar Einkauf', date: now.toISOString(), year: now.getFullYear(), quarter: Math.floor((now.getMonth()+3)/3), source: DocumentSource.MANUAL, status: DocumentStatus.OK, invoice_type: 'Eingangsrechnung', tax_category: 'Material/Waren', total_amount: 199.99, vat_amount: 31.98, invoice_number: 'INV-1001', lexoffice_status: LexofficeStatus.NOT_SENT },
            { user_id: sessionUserId, name: 'Rechnung Kunde A', date: now.toISOString(), year: now.getFullYear(), quarter: Math.floor((now.getMonth()+3)/3), source: DocumentSource.MANUAL, status: DocumentStatus.OK, invoice_type: 'Ausgangsrechnung', tax_category: 'Einnahmen', total_amount: 1250.00, vat_amount: 237.50, invoice_number: 'AR-2025-001', lexoffice_status: LexofficeStatus.NOT_SENT }
          ];
      await supabase.from('documents').insert(docs);
        }
      } catch {/* ignore */}
    finally { setGlobalLoading(false); }
      if (cancelled) return;
    })();
    return () => { cancelled = true; };
  }, [sessionUserId]);

  return (
    <ThemeContext.Provider value={{ theme, toggle: toggleTheme }}>
  <AppShell theme={theme} toggleTheme={toggleTheme} sessionUserId={sessionUserId} globalLoading={globalLoading} />
    </ThemeContext.Provider>
  );
};

export default App;
