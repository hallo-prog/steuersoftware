import React, { useState, useEffect, useRef } from 'react';
import { Document, ChatMessage, Rule, UserProfile } from '../types';
import { getChatResponse } from '../services/geminiLazy';
import { XIcon } from './icons/XIcon';
import UserIcon from './icons/UserIcon';
import SparklesIcon from './icons/SparklesIcon';
import FileIcon from './icons/FileIcon';
import { useThemeClasses } from '../hooks/useThemeClasses';

interface ChatPanelProps {
    apiKey: string;
    lexofficeApiKey: string;
    documents: Document[];
    rules: Rule[];
    userProfile: UserProfile;
    onOpenDocument: (docId: string) => void;
    onClose: () => void;
    systemPrompt: string;
    chatConfig?: {
        contextLimit?: number;
        summarizeThreshold?: number;
        summaryMaxChars?: number;
        summaryRefreshDelayMs?: number;
    };
    showToast?: (msg:string,type?:'success'|'error'|'info')=>void;
}

// Chat History Service Funktionen
import { fetchChatThreads, createChatThread, fetchChatMessages, appendChatMessage, ChatThreadRow, renameChatThread, deleteChatThread, getCondensedChatContext, maybeSummarizeThread } from '../services/supabaseDataService';
import { supabase } from '../src/supabaseClient';

const ChatPanel: React.FC<ChatPanelProps> = ({ apiKey, lexofficeApiKey, documents, rules, userProfile, onOpenDocument, onClose, systemPrompt, chatConfig, showToast }) => {
    const [threads, setThreads] = useState<ChatThreadRow[]>([]);
    const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
    const [messages, setMessages] = useState<ChatMessage[]>([
        { role: 'model', content: 'Hallo! Ich bin Ihr KI-Steuerassistent. Fragen Sie mich nach Ihren Belegen, lassen Sie sich Finanzen zusammenfassen oder stellen Sie mir allgemeine Fragen zu Steuerfristen.', rawContent: 'Hallo! Ich bin Ihr KI-Steuerassistent. Fragen Sie mich nach Ihren Belegen, lassen Sie sich Finanzen zusammenfassen oder stellen Sie mir allgemeine Fragen zu Steuerfristen.' }
    ]);
    const [userInput, setUserInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [renamingThreadId, setRenamingThreadId] = useState<string|null>(null);
    const [tempTitle, setTempTitle] = useState('');
    const [threadSummary, setThreadSummary] = useState<string|undefined>();
    const [summaryCollapsed, setSummaryCollapsed] = useState<boolean>(()=>{ try { return localStorage.getItem('chatSummaryCollapsed')==='1'; } catch { return false; } });
    const [liveConfigVersion, setLiveConfigVersion] = useState(0);
    const lastSummaryRef = useRef<Record<string, number>>({});
    const [forceSummarizing, setForceSummarizing] = useState(false);
    const [chatError, setChatError] = useState<string|undefined>();
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(scrollToBottom, [messages]);

    // Neue anpassbare Konstanten (über Props konfigurierbar)
    // Werte aus Props oder aus LocalStorage (SettingsView speichert dort)
    const lsNum = (k:string, fallback:number) => { try { const v = Number(localStorage.getItem(k)); return v>0? v : fallback; } catch { return fallback; } };
    const CONTEXT_LIMIT = chatConfig?.contextLimit ?? lsNum('chatContextLimit',60);
    const SUMMARIZE_THRESHOLD = chatConfig?.summarizeThreshold ?? lsNum('chatSummarizeThreshold',40);
    const SUMMARY_MAX_CHARS = chatConfig?.summaryMaxChars ?? lsNum('chatSummaryMaxChars',1000);
    const SUMMARY_REFRESH_DELAY_MS = chatConfig?.summaryRefreshDelayMs ?? 200;
    // Reagiere auf dynamische Settings-Änderungen
    useEffect(()=>{
        const handler = () => setLiveConfigVersion(v=>v+1);
        window.addEventListener('chatConfigChanged', handler);
        return ()=> window.removeEventListener('chatConfigChanged', handler);
    },[]);

    useEffect(()=>{ try { localStorage.setItem('chatSummaryCollapsed', summaryCollapsed? '1':'0'); } catch {} },[summaryCollapsed]);

    const forceSummarize = async () => {
        if (!activeThreadId) return;
        setForceSummarizing(true);
        try {
            const { data: all } = await supabase.from('chat_messages').select('*').eq('thread_id', activeThreadId).order('created_at',{ascending:true});
            if (all && all.length) {
                await maybeSummarizeThread(apiKey, activeThreadId, all as any, 0, SUMMARY_MAX_CHARS);
                lastSummaryRef.current[activeThreadId] = Date.now();
                const { data: th } = await supabase.from('chat_threads').select('summary').eq('id', activeThreadId).single();
                setThreadSummary(th?.summary || undefined);
            }
            showToast?.('Zusammenfassung aktualisiert','success');
        } catch (e) {
            console.warn('Force summarize failed', e);
            showToast?.('Zusammenfassung fehlgeschlagen','error');
        } finally { setForceSummarizing(false); }
    };

    // Initial Threads laden (mit Summary)
    useEffect(() => {
        (async () => {
            const { data: userData } = await supabase.auth.getUser();
            const uid = userData.user?.id;
            if (!uid) return;
            try {
                const t = await fetchChatThreads(uid);
                setThreads(t);
                if (t.length) {
                    const first = t[0];
                    setActiveThreadId(first.id);
                    setThreadSummary(first.summary || undefined);
                    const msgs = await fetchChatMessages(first.id);
                    setMessages(msgs.length ? msgs.map(m => ({ role: m.role, content: m.content, rawContent: m.raw_content || undefined })) : messages);
                }
            } catch (e) { console.warn('Chat Threads laden fehlgeschlagen', e); }
        })();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Neuer Thread -> Summary zurücksetzen
    const handleNewThread = async () => {
        const { data: userData } = await supabase.auth.getUser();
        const uid = userData.user?.id; if (!uid) return;
        try {
            const th = await createChatThread(uid, 'Neue Unterhaltung');
            setThreads(prev => [th, ...prev]);
            setActiveThreadId(th.id);
            setThreadSummary(undefined);
            setMessages([{ role: 'model', content: 'Neue Unterhaltung gestartet. Wie kann ich helfen?', rawContent: 'Neue Unterhaltung gestartet. Wie kann ich helfen?' }]);
        } catch (e) { console.warn('Thread erstellen fehlgeschlagen', e); }
    };

    const persistMessage = async (threadId: string, msg: ChatMessage) => {
        try { await appendChatMessage(threadId, msg.role, msg.content, msg.rawContent); } catch (e) { console.warn('Persist Chat Message fehlgeschlagen', e); }
    };

    const handleToolUse = (toolName: string) => {
        const actionMessage: ChatMessage = { role: 'model', content: 'Verstanden. Starte die Übertragung an Lexoffice...' };
        setMessages(prev => [...prev, actionMessage]);
        setIsLoading(true);

        setTimeout(() => {
            if (!lexofficeApiKey) {
                const errorMessage: ChatMessage = { role: 'model', content: 'Fehler: Es wurde kein Lexoffice API-Schlüssel gefunden. Bitte fügen Sie ihn in den Einstellungen hinzu.' };
                setMessages(prev => [...prev, errorMessage]);
            } else {
                const successMessage: ChatMessage = { role: 'model', content: `Erfolgreich! ${documents.length} Belege wurden an Lexoffice gesendet.` };
                setMessages(prev => [...prev, successMessage]);
            }
            setIsLoading(false);
        }, 2500);
    };


    const autoTitleIfNeeded = async (thread: ChatThreadRow, firstUserText: string) => {
        if (!thread || thread.title !== 'Neue Unterhaltung') return;
        const title = (firstUserText||'').slice(0,60).replace(/\n/g,' ').trim() || 'Unterhaltung';
        try { await renameChatThread(thread.id, title); setThreads(prev=> prev.map(t=> t.id===thread.id? {...t, title}: t)); } catch {}
    };

    // Ersetzt alte handleSendMessage Logik (Kontextkürzung + Summarize)
    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!userInput.trim() || isLoading) return;
        const firstUserInThread = !messages.some(m => m.role === 'user');
        const newUserMessage: ChatMessage = { role: 'user', content: userInput, rawContent: userInput };
        const newMessages = [...messages, newUserMessage];
        setMessages(newMessages);
        setUserInput('');
        setIsLoading(true);
        if (activeThreadId) {
            persistMessage(activeThreadId, newUserMessage);
            if (firstUserInThread) {
                const th = threads.find(t => t.id === activeThreadId);
                if (th) autoTitleIfNeeded(th, userInput);
            }
        }
        try {
            setChatError(undefined);
            let contextMessages = newMessages;
            if (newMessages.length > CONTEXT_LIMIT) {
                contextMessages = newMessages.slice(-CONTEXT_LIMIT);
                if (activeThreadId) {
                    try {
                        const { data: all } = await supabase.from('chat_messages').select('*').eq('thread_id', activeThreadId).order('created_at', { ascending: true });
                        if (all && all.length >= SUMMARIZE_THRESHOLD) {
                            const now = Date.now();
                            const last = lastSummaryRef.current[activeThreadId] || 0;
                            if (now - last > 45000) { // mindestens 45s Abstand
                                await maybeSummarizeThread(apiKey, activeThreadId, all as any, SUMMARIZE_THRESHOLD, SUMMARY_MAX_CHARS);
                                lastSummaryRef.current[activeThreadId] = now;
                            }
                            setTimeout(async () => {
                                try {
                                    const { data: th } = await supabase.from('chat_threads').select('summary').eq('id', activeThreadId).single();
                                    setThreadSummary(th?.summary || undefined);
                                } catch { }
                            }, SUMMARY_REFRESH_DELAY_MS);
                        }
                    } catch { }
                }
            }
            if (threadSummary) {
                contextMessages = [{ role: 'model', content: 'Bisherige Zusammenfassung:\n' + threadSummary } as any, ...contextMessages];
            }
            const responseText = await getChatResponse(apiKey, contextMessages, documents, rules, userProfile, userInput, systemPrompt);
            // Tool Use optional JSON
            try {
                const responseJson = JSON.parse(responseText);
                if (responseJson.tool_use && responseJson.tool_use.name) {
                    handleToolUse(responseJson.tool_use.name);
                    return;
                }
            } catch { }
            const modelResponse: ChatMessage = { role: 'model', content: responseText, rawContent: responseText };
            setMessages(prev => [...prev, modelResponse]);
            if (activeThreadId) persistMessage(activeThreadId, modelResponse);
        } catch (error: any) {
            console.error(error);
            const friendly = 'Fehler bei der KI-Anfrage: ' + (error?.message || 'Unbekannt');
            setChatError(friendly);
            const errorMessage: ChatMessage = { role: 'model', content: friendly };
            setMessages(prev => [...prev, errorMessage]);
            if (activeThreadId) persistMessage(activeThreadId, errorMessage);
        } finally { setIsLoading(false); }
    };
    
    const renderWithMarkdown = (text: string) => {
        const parts = text.split(/(\*\*.*?\*\*)/g).filter(Boolean);
        return (
            <>
                {parts.map((part, index) => {
                    if (part.startsWith('**') && part.endsWith('**')) {
                        return <strong key={index}>{part.slice(2, -2)}</strong>;
                    }
                    return <span key={index}>{part}</span>;
                })}
            </>
        );
    };

    const renderMessageContent = (content: string) => {
        const docButtonRegex = /%%DOC_BUTTON\(([^)]+)\)%%/g;
        const parts = content.split(docButtonRegex);

        return (
            <>
                {parts.map((part, index) => {
                    if (index % 2 === 1) { // This is a docId
                        const doc = documents.find(d => d.id === part);
                        return (
                             <button
                                key={index}
                                onClick={() => onOpenDocument(part)}
                                className="flex items-center gap-3 w-full text-left mt-2 bg-blue-50 hover:bg-blue-100 text-blue-800 p-2 rounded-lg transition-colors border border-blue-200"
                            >
                                <FileIcon className="w-6 h-6 text-blue-500 flex-shrink-0" />
                                <div className="flex flex-col min-w-0">
                                    <span className="text-xs font-semibold text-blue-700">Beleg öffnen</span>
                                    <span className="text-sm font-medium truncate">{doc?.name || 'Unbekannt'}</span>
                                </div>
                            </button>
                        );
                    }
                    // This is a regular text part, process for markdown
                    return <span key={index} className="whitespace-pre-wrap">{renderWithMarkdown(part)}</span>;
                })}
            </>
        );
    }

    const ui = useThemeClasses();
    return (
    <aside className={`fixed inset-0 z-40 md:relative md:w-[480px] md:inset-auto ${ui.sidebar} border-l ${ui.border} flex flex-col h-full flex-shrink-0 transition-colors duration-300 transform md:translate-x-0 shadow-2xl md:shadow-none`}>
            <div className={`p-4 ${ui.divider} flex justify-between items-center flex-shrink-0`}>
                <h3 className={`text-lg font-bold ${ui.textPrimary}`}>KI-Chat</h3>
                <button onClick={onClose} className={`p-2 rounded-full ${ui.buttonGhost}`}><XIcon className="w-5 h-5" /></button>
            </div>
            {/* Thread List */}
            <div className="flex-shrink-0 px-4 py-2 border-b border-slate-200 dark:border-slate-700 space-y-2 max-h-36 overflow-auto">
                <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Verläufe</span>
                    <button onClick={handleNewThread} className="text-xs px-2 py-1 rounded bg-blue-600 text-white font-semibold hover:bg-blue-700">Neu</button>
                </div>
                <div className="space-y-1">
                    {threads.map(th => (
                        <div key={th.id} className="flex items-center gap-1">
                          {renamingThreadId===th.id ? (
                            <form className="flex-1" onSubmit={async ev=>{ev.preventDefault(); try { await renameChatThread(th.id, tempTitle||'Ohne Titel'); setThreads(prev=> prev.map(t=> t.id===th.id?{...t,title:tempTitle||'Ohne Titel'}:t)); setRenamingThreadId(null);} catch {} }}>
                              <input autoFocus value={tempTitle} onChange={e=>setTempTitle(e.target.value)} className="w-full text-xs px-2 py-1 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800" />
                            </form>
                          ) : (
                            <button onClick={async ()=>{
                                setActiveThreadId(th.id);
                                try { const msgs = await fetchChatMessages(th.id); setMessages(msgs.length ? msgs.map(m=>({ role: m.role, content: m.content, rawContent: m.raw_content||undefined })) : messages); } catch {}
                              }} className={`flex-1 text-left text-xs px-2 py-1 rounded ${th.id===activeThreadId? 'bg-blue-600 text-white':'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'} truncate`}>{th.title}</button>
                          )}
                          {renamingThreadId!==th.id && (
                            <div className="flex gap-0.5">
                              <button title="Umbenennen" onClick={()=>{setRenamingThreadId(th.id); setTempTitle(th.title);}} className="text-[10px] px-1 py-1 rounded bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">✎</button>
                              <button title="Löschen" onClick={async ()=>{ if (confirm('Verlauf löschen?')) { try { await deleteChatThread(th.id); setThreads(prev=> prev.filter(t=> t.id!==th.id)); if (activeThreadId===th.id) { setActiveThreadId(null); setMessages([{ role: 'model', content: 'Verlauf gelöscht. Neue Frage starten.', rawContent: 'Verlauf gelöscht. Neue Frage starten.' }]); } } catch {} } }} className="text-[10px] px-1 py-1 rounded bg-red-200 dark:bg-red-700 text-red-700 dark:text-red-200">×</button>
                            </div>
                          )}
                        </div>
                    ))}
                    {!threads.length && <div className="text-[10px] text-slate-400">Keine Verläufe</div>}
                </div>
            </div>
            <div className={`flex-grow p-4 overflow-y-auto ${ui.scrollArea} transition-colors`}>
                <div className="space-y-6">
                    {threadSummary && (
                        <div className="text-xs bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 text-amber-800 dark:text-amber-200 p-3 rounded-md leading-relaxed">
                            <div className="flex items-center justify-between mb-1">
                                <span className="font-semibold uppercase tracking-wide text-[10px] opacity-70">Zusammenfassung</span>
                                <div className="flex items-center gap-2">
                                  <button type="button" onClick={()=> setSummaryCollapsed(c=>!c)} className="text-[10px] underline">{summaryCollapsed? 'Einblenden':'Ausblenden'}</button>
                                  <button type="button" onClick={async () => { if (!activeThreadId) return; try { const { data: th } = await supabase.from('chat_threads').select('summary').eq('id', activeThreadId).single(); setThreadSummary(th?.summary || undefined); } catch { } }} className="text-[10px] underline">Aktualisieren</button>
                                                                      {messages.filter(m=>m.role==='user').length >= SUMMARIZE_THRESHOLD && (
                                                                        <button type="button" disabled={forceSummarizing} onClick={forceSummarize} className="text-[10px] underline disabled:opacity-40">{forceSummarizing? 'Verdichte…':'Jetzt verdichten'}</button>
                                                                    )}
                                </div>
                            </div>
                            {!summaryCollapsed && <div className="whitespace-pre-wrap">{threadSummary}</div>}
                        </div>
                    )}
                    {messages.map((msg, index) => (
                        <div key={index} className="flex items-start gap-3">
                           {msg.role === 'model' && (
                               <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center flex-shrink-0">
                                   <SparklesIcon className="w-5 h-5 text-blue-600 dark:text-blue-400"/>
                               </div>
                           )}
                           <div className={`w-full max-w-xs lg:max-w-sm px-4 py-2.5 rounded-2xl ${msg.role === 'user' ? 'bg-blue-600 text-white rounded-br-lg ml-auto' : `${ui.cardAlt} ${ui.textPrimary} rounded-bl-lg` }`}>
                               <div className="text-sm">
                                  {renderMessageContent(msg.content)}
                               </div>
                           </div>
                           {msg.role === 'user' && (
                                <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center flex-shrink-0">
                                    <UserIcon className="w-5 h-5 text-slate-600 dark:text-slate-300"/>
                                </div>
                           )}
                        </div>
                    ))}
                    {isLoading && (
                        <div className="flex items-start gap-3 justify-start">
                            <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center flex-shrink-0">
                                <SparklesIcon className="w-5 h-5 text-blue-600 dark:text-blue-400"/>
                            </div>
                            <div className={`max-w-xs lg:max-w-sm px-4 py-2.5 rounded-2xl ${ui.cardAlt} ${ui.textPrimary} rounded-bl-lg`}>
                                <div className="flex items-center space-x-2">
                                    <div className="w-2 h-2 bg-slate-500 dark:bg-slate-400 rounded-full animate-pulse"></div>
                                    <div className="w-2 h-2 bg-slate-500 dark:bg-slate-400 rounded-full animate-pulse [animation-delay:0.2s]"></div>
                                    <div className="w-2 h-2 bg-slate-500 dark:bg-slate-400 rounded-full animate-pulse [animation-delay:0.4s]"></div>
                                </div>
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>
            </div>
            <form onSubmit={handleSendMessage} className={`p-4 border-t ${ui.border} flex-shrink-0 ${ui.surface}`}>
              {chatError && (
                <div className="mb-2 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 px-3 py-2 rounded-md flex justify-between items-center">
                  <span>{chatError}</span>
                  <button type="button" onClick={()=>setChatError(undefined)} className="text-[10px] underline">x</button>
                </div>
              )}
              <div className="relative">
                    <input
                        type="text"
                        value={userInput}
                        onChange={(e) => setUserInput(e.target.value)}
                        placeholder="Frage stellen..."
                        className={`w-full pl-4 pr-12 py-2.5 rounded-full ${ui.input} ${ui.ringFocus}`}
                        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) handleSendMessage(e as any); }}
                    />
                    <button type="submit" disabled={isLoading || !userInput.trim()} className="absolute inset-y-1 right-1 flex items-center justify-center w-10 h-10 text-white bg-blue-600 rounded-full disabled:bg-blue-300 hover:bg-blue-700 transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor"><path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.428A1 1 0 0011 16.171V11.182l4.243 4.243a1 1 0 001.414-1.414L12.53 10.881l1.414-1.414a1 1 0 00-1.414-1.414L10.894 9.683V4.693z" /></svg>
                    </button>
                </div>
            </form>
        </aside>
    );
};

export default ChatPanel;