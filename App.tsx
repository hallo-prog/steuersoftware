import React, { useState, useMemo, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import DocumentsView from './components/DocumentsView';
import SettingsView from './components/SettingsView';
import AnalysisView from './components/AnalysisView';
import RulesView from './components/RulesView';
import DeadlinesView from './components/DeadlinesView';
import LexofficeView from './components/LexofficeView';
import ProfileView from './components/ProfileView';
import LoginView from './components/LoginView';
import RuleSuggestionToast from './components/RuleSuggestionToast';
import ChatPanel from './components/ChatPanel';
import DocumentDetailModal from './components/DocumentDetailModal';
import DeadlineNotification from './components/DeadlineNotification';
import FörderungenView from './components/FörderungenView';
import { Document, View, Rule, InvoiceType, RuleSuggestion, NotificationSettings, Deadline, UserProfile, DocumentFilter } from './types';
import { getDeadlines } from './services/deadlineService';

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


const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => sessionStorage.getItem('isAuthenticated') === 'true');
  const [documents, setDocuments] = useState<Document[]>([]);
  const [activeView, setActiveView] = useState<View>(View.DOCUMENTS);
  const [activeFilter, setActiveFilter] = useState<DocumentFilter | null>(null);
  const [rules, setRules] = useState<Rule[]>(initialRules);
  const [ruleSuggestion, setRuleSuggestion] = useState<RuleSuggestion | null>(null);
  
  // App State for responsiveness
  const [isDesktopSidebarOpen, setIsDesktopSidebarOpen] = useState<boolean>(true);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState<boolean>(false);
  
  // API Keys, Chat State, and Profile
  const [apiKey, setApiKey] = useState<string>(() => localStorage.getItem('geminiApiKey') || '');
  const [lexofficeApiKey, setLexofficeApiKey] = useState<string>(() => localStorage.getItem('lexofficeApiKey') || '');
  const [isChatOpen, setIsChatOpen] = useState<boolean>(false);
  const [documentToView, setDocumentToView] = useState<Document | null>(null);
  const [chatSystemPrompt, setChatSystemPrompt] = useState<string>(() => localStorage.getItem('chatSystemPrompt') || DEFAULT_CHAT_PROMPT);
  const [userProfile, setUserProfile] = useState<UserProfile>(() => {
    const saved = localStorage.getItem('userProfile');
    return saved ? JSON.parse(saved) : { name: 'Admin User', taxId: '', vatId: '', taxNumber: '', companyForm: '', profilePicture: undefined };
  });

  // Deadlines & Notifications
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>(() => {
    const saved = localStorage.getItem('notificationSettings');
    return saved ? JSON.parse(saved) : { notify14Days: true, notify1Day: true };
  });
  const [deadlines, setDeadlines] = useState<Deadline[]>([]);
  const [activeNotification, setActiveNotification] = useState<Deadline | null>(null);

  const handleLogin = () => {
    setIsAuthenticated(true);
    sessionStorage.setItem('isAuthenticated', 'true');
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    sessionStorage.removeItem('isAuthenticated');
    setActiveView(View.DOCUMENTS);
  };

  useEffect(() => {
      localStorage.setItem('geminiApiKey', apiKey);
  }, [apiKey]);

  useEffect(() => {
    localStorage.setItem('lexofficeApiKey', lexofficeApiKey);
  }, [lexofficeApiKey]);
  
  useEffect(() => {
    localStorage.setItem('notificationSettings', JSON.stringify(notificationSettings));
  }, [notificationSettings]);

  useEffect(() => {
    localStorage.setItem('chatSystemPrompt', chatSystemPrompt);
  }, [chatSystemPrompt]);

  useEffect(() => {
    localStorage.setItem('userProfile', JSON.stringify(userProfile));
  }, [userProfile]);

  useEffect(() => {
    const calculatedDeadlines = getDeadlines();
    setDeadlines(calculatedDeadlines);

    const notificationToShow = calculatedDeadlines.find(d => 
        (notificationSettings.notify14Days && d.remainingDays <= 14 && d.remainingDays > 1) ||
        (notificationSettings.notify1Day && d.remainingDays <= 1)
    );
    setActiveNotification(notificationToShow || null);
  }, [notificationSettings]);


  const filteredDocuments = useMemo(() => {
    if (!activeFilter) {
      return documents;
    }
    return documents.filter(doc => {
      if (activeFilter.quarter) {
        return doc.year === activeFilter.year && doc.quarter === activeFilter.quarter;
      }
      return doc.year === activeFilter.year;
    });
  }, [documents, activeFilter]);

  const handleSetRuleSuggestion = (suggestion: RuleSuggestion) => {
    const similarRuleExists = rules.some(rule => {
      if (rule.conditionType !== 'vendor') return false;
      const vendorExistsInRule = rule.conditionValue.toLowerCase().split(',').map(v => v.trim()).includes(suggestion.vendor.toLowerCase());
      const categoryMatches = rule.resultCategory.toLowerCase() === suggestion.taxCategory.toLowerCase();
      return vendorExistsInRule && categoryMatches;
    });
    if (!similarRuleExists) setRuleSuggestion(suggestion);
  };

  const handleAcceptSuggestion = () => {
    if (ruleSuggestion) {
      const newRule: Rule = {
        id: `rule-${Date.now()}`,
        conditionType: 'vendor',
        conditionValue: ruleSuggestion.vendor,
        invoiceType: ruleSuggestion.invoiceType,
        resultCategory: ruleSuggestion.taxCategory,
      };
      setRules(prevRules => [...prevRules, newRule]);
      setRuleSuggestion(null);
    }
  };

  const handleDismissSuggestion = () => {
    setRuleSuggestion(null);
  };

  const handleOpenDocumentFromChat = (docId: string) => {
    const docToOpen = documents.find(doc => doc.id === docId);
    if (docToOpen) {
        setDocumentToView(docToOpen);
        setIsChatOpen(false); // Close chat on mobile to see the modal
    }
  };
  
  const handleDocumentUpdate = (updatedDocument: Document) => {
    setDocuments(prevDocs => 
      prevDocs.map(doc => doc.id === updatedDocument.id ? updatedDocument : doc)
    );
  };

  if (!isAuthenticated) {
    return <LoginView onLogin={handleLogin} />;
  }

  return (
    <div className="flex h-screen bg-slate-50 font-sans">
       {isMobileSidebarOpen && (
        <div 
            className="fixed inset-0 bg-black bg-opacity-50 z-30 md:hidden"
            onClick={() => setIsMobileSidebarOpen(false)}
        ></div>
       )}
      <Sidebar 
        activeView={activeView} 
        setActiveView={setActiveView} 
        documents={documents}
        activeFilter={activeFilter}
        setActiveFilter={setActiveFilter}
        isDesktopOpen={isDesktopSidebarOpen}
        setIsDesktopOpen={setIsDesktopSidebarOpen}
        isMobileOpen={isMobileSidebarOpen}
        setIsMobileOpen={setIsMobileSidebarOpen}
      />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header 
            onToggleChat={() => setIsChatOpen(!isChatOpen)} 
            onToggleMobileSidebar={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
            onProfileClick={() => setActiveView(View.PROFILE)}
            userProfile={userProfile}
        />
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-slate-50 p-4 sm:p-6 lg:p-8 relative">
           {activeNotification && <DeadlineNotification deadline={activeNotification} onClose={() => setActiveNotification(null)} />}
          {activeView === View.DOCUMENTS && (
            <DocumentsView 
              documents={filteredDocuments} 
              setDocuments={setDocuments} 
              activeFilter={activeFilter} 
              rules={rules} 
              onRuleSuggestion={handleSetRuleSuggestion}
              apiKey={apiKey}
              lexofficeApiKey={lexofficeApiKey}
              onSelectDocument={setDocumentToView}
            />
          )}
          {activeView === View.SETTINGS && <SettingsView setDocuments={setDocuments} apiKey={apiKey} setApiKey={setApiKey} lexofficeApiKey={lexofficeApiKey} setLexofficeApiKey={setLexofficeApiKey} notificationSettings={notificationSettings} setNotificationSettings={setNotificationSettings} chatSystemPrompt={chatSystemPrompt} setChatSystemPrompt={setChatSystemPrompt} DEFAULT_CHAT_PROMPT={DEFAULT_CHAT_PROMPT} />}
          {activeView === View.ANALYSIS && <AnalysisView documents={documents} />}
          {activeView === View.RULES && <RulesView rules={rules} setRules={setRules} />}
          {activeView === View.DEADLINES && <DeadlinesView deadlines={deadlines} />}
          {activeView === View.LEXOFFICE && <LexofficeView documents={documents} setDocuments={setDocuments} lexofficeApiKey={lexofficeApiKey} />}
          {activeView === View.PROFILE && <ProfileView userProfile={userProfile} setUserProfile={setUserProfile} onLogout={handleLogout} />}
          {activeView === View.FÖRDERUNGEN && <FörderungenView userProfile={userProfile} apiKey={apiKey} />}
        </main>
      </div>
       {isChatOpen && (
          <ChatPanel 
            apiKey={apiKey}
            lexofficeApiKey={lexofficeApiKey}
            documents={documents}
            rules={rules}
            userProfile={userProfile}
            onOpenDocument={handleOpenDocumentFromChat}
            onClose={() => setIsChatOpen(false)}
            systemPrompt={chatSystemPrompt}
          />
        )}
       {ruleSuggestion && (
        <RuleSuggestionToast 
          suggestion={ruleSuggestion}
          onAccept={handleAcceptSuggestion}
          onDismiss={handleDismissSuggestion}
        />
      )}
      {documentToView && (
        <DocumentDetailModal
          document={documentToView}
          onClose={() => setDocumentToView(null)}
          onUpdate={handleDocumentUpdate}
        />
      )}
    </div>
  );
};

export default App;
