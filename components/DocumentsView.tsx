import React, { useState, useMemo, useCallback } from 'react';
import { Document, DocumentStatus, InvoiceType, Rule, RuleSuggestion, LexofficeStatus, DocumentFilter } from '../types';
// Dynamische KI-Funktionen (Code-Splitting)
import { suggestTaxCategoryAndFlags, summarizeDocumentsFinancially } from '../services/geminiLazy';
import DocumentItem from './DocumentItem';
import UploadModal from './UploadModal';
import { PlusIcon } from './icons/PlusIcon';
import FolderIcon from './icons/FolderIcon';
import ChevronDownIcon from './icons/ChevronDownIcon';
import SearchIcon from './icons/SearchIcon';
import ArchiveIcon from './icons/ArchiveIcon';
import TrashIcon from './icons/TrashIcon';
import SortAscIcon from './icons/SortAscIcon';
import SortDescIcon from './icons/SortDescIcon';
import FilterIcon from './icons/FilterIcon';

interface DocumentsViewProps {
  userId: string;
  documents: Document[];
  setDocuments: React.Dispatch<React.SetStateAction<Document[]>>;
  activeFilter: DocumentFilter | null;
  rules: Rule[];
  setRules?: React.Dispatch<React.SetStateAction<Rule[]>>; // für Bulk-AI-Regeln
  onRuleSuggestion: (suggestion: RuleSuggestion) => void;
  apiKey: string;
  lexofficeApiKey: string;
  onSelectDocument: (document: Document) => void;
}

interface GroupedDocuments {
  [year: number]: {
    [quarter: number]: Document[];
  };
}

import { updateDocument, deleteDocument, deleteFileFromPublicUrl, insertRule } from '../services/supabaseDataService';
import { semanticSearchDocuments, embedTexts } from '../services/geminiLazy';
import { useThemeClasses } from '../hooks/useThemeClasses';

const DocumentsView: React.FC<DocumentsViewProps> = ({ userId, documents, setDocuments, activeFilter, rules, setRules, onRuleSuggestion, apiKey, lexofficeApiKey, onSelectDocument }) => {
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [expandedFolders, setExpandedFolders] = useState<{ [key: string]: boolean }>({ [new Date().getFullYear()]: true, [`${new Date().getFullYear()}-Q${Math.floor((new Date().getMonth() + 3) / 3)}`]: true});
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDocumentIds, setSelectedDocumentIds] = useState<Set<string>>(new Set());
  const [sendingDocId, setSendingDocId] = useState<string | null>(null);
  const [aiAnalyzingIds, setAiAnalyzingIds] = useState<Set<string>>(new Set());
  const [financialSummary, setFinancialSummary] = useState<string>('');
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [showOnlyAnomalies, setShowOnlyAnomalies] = useState(false);
  const [semanticQuery, setSemanticQuery] = useState('');
  const [semanticResults, setSemanticResults] = useState<Set<string>|null>(null);
  const [isSemanticSearching, setIsSemanticSearching] = useState(false);
  const [isReindexing, setIsReindexing] = useState(false);
  
  const [sortConfig, setSortConfig] = useState<{ key: 'date' | 'name' | 'vendor' | 'amount'; direction: 'ascending' | 'descending' }>({ key: 'date', direction: 'descending' });
  const [statusFilter, setStatusFilter] = useState<DocumentStatus | 'all'>('all');
  const [typeFilter, setTypeFilter] = useState<InvoiceType | 'all'>('all');
  const [providerFilter, setProviderFilter] = useState<'all'|'supabase'|'r2'>('all');

  const activeDocuments = useMemo(() => {
      return documents.filter(doc => doc.status !== DocumentStatus.ARCHIVED);
  }, [documents]);
  
  const handleSendSingleToLexoffice = useCallback(async (docId: string) => {
    if (!lexofficeApiKey) {
        alert('Bitte hinterlegen Sie zuerst Ihren Lexoffice API-Schlüssel in den Einstellungen.');
        return;
    }
    setSendingDocId(docId);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1500));

    const isSuccess = Math.random() > 0.1; // Simulate random failure for demo

    setDocuments(prevDocs => 
        prevDocs.map(doc => {
            if (doc.id === docId) {
                return {
                    ...doc,
                    lexoffice: {
                        status: isSuccess ? LexofficeStatus.SUCCESS : LexofficeStatus.FAILED,
                        sentAt: new Date(),
                    }
                };
            }
            return doc;
        })
    );
    setSendingDocId(null);
  }, [lexofficeApiKey, setDocuments]);

  const processedDocuments = useMemo(() => {
    let filtered = activeDocuments.filter(doc => {
      const statusMatch = statusFilter === 'all' || doc.status === statusFilter;
      const typeMatch = typeFilter === 'all' || doc.invoiceType === typeFilter;
      const providerMatch = providerFilter === 'all' || (doc.storageProvider || 'supabase') === providerFilter;
      if (!statusMatch || !typeMatch || !providerMatch) return false;
      if (showOnlyAnomalies && !(doc.flags||[]).length && (doc.anomalyScore==null || doc.anomalyScore < 0.4)) return false;
  const matchesSemantic = !semanticResults || semanticResults.has(doc.id);
  if (!matchesSemantic) return false;
  if (searchQuery.trim()) {
        const lowerCaseQuery = searchQuery.toLowerCase();
        return doc.name.toLowerCase().includes(lowerCaseQuery) ||
               doc.vendor?.toLowerCase().includes(lowerCaseQuery) ||
               doc.textContent?.toLowerCase().includes(lowerCaseQuery);
      }
      return true;
    });

    filtered.sort((a, b) => {
      let comparison = 0;
      switch (sortConfig.key) {
        case 'name': comparison = a.name.localeCompare(b.name); break;
        case 'vendor': comparison = (a.vendor || '').localeCompare(b.vendor || ''); break;
        case 'amount': comparison = (a.totalAmount || 0) - (b.totalAmount || 0); break;
        case 'date': default: comparison = new Date(a.date).getTime() - new Date(b.date).getTime(); break;
      }
      return sortConfig.direction === 'ascending' ? comparison : -comparison;
    });
    return filtered;
  }, [activeDocuments, searchQuery, sortConfig, statusFilter, typeFilter]);

  const groupedDocuments = useMemo(() => {
    return processedDocuments.reduce((acc, doc) => {
      const { year, quarter } = doc;
      if (!acc[year]) acc[year] = { 1: [], 2: [], 3: [], 4: [] };
      if (!acc[year][quarter]) acc[year][quarter] = [];
      acc[year][quarter].push(doc);
      return acc;
    }, {} as GroupedDocuments);
  }, [processedDocuments]);

  // Zusätzliche Gruppierung nach Steuerkategorie (virtuelle Ordner)
  const categoryGroups = useMemo(() => {
    const map: Record<string, Document[]> = {};
    processedDocuments.forEach(d => {
      const key = (d.taxCategory || d.aiSuggestedTaxCategory || 'Unkategorisiert');
      if (!map[key]) map[key] = [];
      map[key].push(d);
    });
    return Object.entries(map).sort((a,b)=> b[1].length - a[1].length);
  }, [processedDocuments]);

  const toggleFolder = (key: string) => {
    setExpandedFolders(prev => ({ ...prev, [key]: !prev[key] }));
  };
  
  const handleToggleSelection = useCallback((id: string) => {
    setSelectedDocumentIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) newSet.delete(id); else newSet.add(id);
      return newSet;
    });
  }, []);

  const handleToggleSelectAll = () => {
    if (selectedDocumentIds.size === processedDocuments.length) {
      setSelectedDocumentIds(new Set());
    } else {
      setSelectedDocumentIds(new Set(processedDocuments.map(doc => doc.id)));
    }
  };

  const handleDelete = async () => {
    if (!selectedDocumentIds.size) return;
    if (window.confirm(`Möchten Sie ${selectedDocumentIds.size} Beleg(e) wirklich endgültig löschen?`)) {
      const ids: string[] = Array.from(selectedDocumentIds) as string[];
      for (const id of ids) {
        const doc = documents.find(d=>d.id===id);
        try { await deleteFileFromPublicUrl(doc?.fileUrl); await deleteDocument(id as string); } catch (e) { console.warn('Delete DB fail', e); }
      }
      setDocuments(prev => prev.filter(doc => !selectedDocumentIds.has(doc.id)));
      setSelectedDocumentIds(new Set());
    }
  };

  const handleArchive = async () => {
    if (!selectedDocumentIds.size) return;
    if (window.confirm(`Möchten Sie ${selectedDocumentIds.size} Beleg(e) wirklich archivieren?`)) {
      const ids: string[] = Array.from(selectedDocumentIds) as string[];
      for (const id of ids) {
        try { await updateDocument(id as string, { status: DocumentStatus.ARCHIVED }); } catch (e) { console.warn('Archive DB fail', e); }
      }
      setDocuments(prev => prev.map(doc => selectedDocumentIds.has(doc.id) ? { ...doc, status: DocumentStatus.ARCHIVED } : doc));
      setSelectedDocumentIds(new Set());
    }
  };

  const handleSortDirectionToggle = () => setSortConfig(prev => ({ ...prev, direction: prev.direction === 'ascending' ? 'descending' : 'ascending' }));
  const handleSortKeyChange = (e: React.ChangeEvent<HTMLSelectElement>) => setSortConfig(prev => ({ ...prev, key: e.target.value as any }));

  const runAiForDocument = async (doc: Document) => {
    if (!apiKey || aiAnalyzingIds.has(doc.id)) return;
    setAiAnalyzingIds(prev => new Set(prev).add(doc.id));
    const result = await suggestTaxCategoryAndFlags(apiKey, doc);
    setDocuments(prev => prev.map(d => d.id === doc.id ? { ...d, ...result } : d));
    // Regelvorschlag, falls sinnvoll
    if (result.aiSuggestedTaxCategory && doc.vendor) {
      const vendorLower = doc.vendor.toLowerCase();
      const already = rules.some(r => r.conditionType==='vendor' && r.resultCategory.toLowerCase() === result.aiSuggestedTaxCategory!.toLowerCase() && r.conditionValue.toLowerCase().includes(vendorLower));
      if (!already) {
        onRuleSuggestion({ vendor: doc.vendor, taxCategory: result.aiSuggestedTaxCategory, invoiceType: doc.invoiceType });
      }
    }
    setAiAnalyzingIds(prev => { const n = new Set(prev); n.delete(doc.id); return n; });
  };

  const runBulkAi = async () => {
    if (!apiKey) { alert('API Key fehlt.'); return; }
    const targets = processedDocuments.filter(d => !d.aiSuggestedTaxCategory || !(d.flags&&d.flags.length));
    for (const doc of targets) {
      await runAiForDocument(doc);
    }
  };

  const generateBulkRulesFromAI = async () => {
    if (!userId) return;
    const candidates = documents.filter(d => d.vendor && d.aiSuggestedTaxCategory && d.aiSuggestedTaxCategory !== 'Sonstiges');
    const existingKeys = new Set(rules.map(r => r.conditionType + '|' + r.conditionValue.toLowerCase() + '|' + r.resultCategory.toLowerCase()));
    const groups: { vendor:string; category:string; invoiceType:InvoiceType }[] = [];
    for (const d of candidates) {
      const key = 'vendor|' + d.vendor!.toLowerCase() + '|' + d.aiSuggestedTaxCategory!.toLowerCase();
      const alreadyRule = existingKeys.has(key);
      if (!alreadyRule) {
        groups.push({ vendor: d.vendor!, category: d.aiSuggestedTaxCategory!, invoiceType: d.invoiceType });
        existingKeys.add(key);
      }
    }
    if (!groups.length) { alert('Keine neuen Regeln erforderlich.'); return; }
    if (!confirm(`${groups.length} neue Regel(n) aus KI-Vorschlägen anlegen?`)) return;
    const inserted: Rule[] = [];
    for (const g of groups) {
      try {
        const r = await insertRule(userId, { conditionType: 'vendor', conditionValue: g.vendor, invoiceType: g.invoiceType, resultCategory: g.category });
        inserted.push(r);
      } catch (e) { console.warn('Insert rule failed', e); }
    }
    if (inserted.length && setRules) setRules(prev => [...prev, ...inserted]);
    alert(`${inserted.length} Regel(n) erstellt.`);
  };

  const runSemanticSearch = async () => {
    if (!apiKey || !semanticQuery.trim()) { setSemanticResults(null); return; }
    setIsSemanticSearching(true);
    try {
      const results = await semanticSearchDocuments(apiKey, semanticQuery.trim(), documents, 50);
      setSemanticResults(new Set(results.map(r=>r.id)));
    } catch (e) { console.warn('Semantic search fail', e); }
    finally { setIsSemanticSearching(false); }
  };

  const applySuggestedCategories = async () => {
    const targets = documents.filter(d => d.aiSuggestedTaxCategory && d.taxCategory !== d.aiSuggestedTaxCategory);
    for (const doc of targets) {
      setDocuments(prev => prev.map(d => d.id===doc.id ? { ...d, taxCategory: doc.aiSuggestedTaxCategory } : d));
      try { await updateDocument(doc.id, { taxCategory: doc.aiSuggestedTaxCategory }); } catch (e) { console.warn('Update DB fail', e); }
    }
  };

  const exportCSV = () => {
    const rows = [[ 'ID','Name','Datum','Typ','Status','Vendor','Betrag','MwSt','Kategorie','KI_Kategorie','Flags','AnomalieScore' ]];
    processedDocuments.forEach(d => rows.push([
      d.id,
      d.name,
      d.date.toISOString(),
      d.invoiceType,
      d.status,
      d.vendor||'',
  (Number.isFinite(d.totalAmount as any) ? d.totalAmount : '').toString(),
  (Number.isFinite(d.vatAmount as any) ? d.vatAmount : '').toString(),
      d.taxCategory||'',
      d.aiSuggestedTaxCategory||'',
      (d.flags||[]).join('|'),
      d.anomalyScore!=null? d.anomalyScore.toFixed(3):''
    ]));
    const csv = rows.map(r => r.map(f => '"'+f.replace(/"/g,'""')+'"').join(';')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'belege.csv'; a.click(); URL.revokeObjectURL(url);
  };

  const exportPDF = () => {
    const win = window.open('', '_blank'); if (!win) return;
    win.document.write('<html><head><title>Belege Export</title><style>body{font-family:sans-serif;font-size:11px;} table{border-collapse:collapse;width:100%;} th,td{border:1px solid #999;padding:3px;} th{background:#eee;}</style></head><body>');
    win.document.write('<h1>Belege</h1><table><thead><tr>'+['Name','Datum','Typ','Vendor','Betrag','MwSt','Kat','KI','Flags','A-Score'].map(h=>'<th>'+h+'</th>').join('')+'</tr></thead><tbody>');
    processedDocuments.forEach(d => {
      const row = [
        d.name,
        d.date.toLocaleDateString('de-DE'),
        d.invoiceType,
        d.vendor||'',
        (Number.isFinite(d.totalAmount as any) && d.totalAmount!=null ? (d.totalAmount as number).toFixed(2) : ''),
        (Number.isFinite(d.vatAmount as any) && d.vatAmount!=null ? (d.vatAmount as number).toFixed(2) : ''),
        d.taxCategory||'',
        d.aiSuggestedTaxCategory||'',
        (d.flags||[]).join(','),
        d.anomalyScore!=null?(d.anomalyScore*100).toFixed(0)+'%':''
      ];
      win.document!.write('<tr>'+row.map(c => '<td>'+String(c).replace(/</g,'&lt;')+'</td>').join('')+'</tr>');
    });
    win.document.write('</tbody></table></body></html>');
    win.document.close(); win.focus(); win.print();
  };

  const categorySummary = useMemo(() => {
    const map: {[k:string]: {count:number; amount:number}} = {};
    processedDocuments.forEach(d => {
      const cat = d.taxCategory || d.aiSuggestedTaxCategory || 'Unkategorisiert';
      if (!map[cat]) map[cat] = { count:0, amount:0 };
      map[cat].count++; map[cat].amount += d.totalAmount || 0;
    });
    return Object.entries(map).sort((a,b)=>b[1].amount - a[1].amount).slice(0,8);
  }, [processedDocuments]);

  const runFinancialSummary = async () => {
    if (!apiKey) { alert('API Key fehlt.'); return; }
    setIsSummarizing(true);
    const txt = await summarizeDocumentsFinancially(apiKey, processedDocuments);
    setFinancialSummary(txt);
    setIsSummarizing(false);
  };

  const viewTitle = useMemo(() => {
    if (!activeFilter) return "Alle Belege";
    if (activeFilter.quarter) return `Belege für ${activeFilter.year} / Q${activeFilter.quarter}`;
    return `Alle Belege für ${activeFilter.year}`;
  }, [activeFilter]);

  const sortedYears = Object.keys(groupedDocuments).map(Number).sort((a, b) => b - a);

  const ui = useThemeClasses();
  return (
    <>
      <div className="flex flex-col md:flex-row justify-between md:items-center mb-6 gap-4">
        <h2 className={`text-3xl font-bold ${ui.textPrimary}`}>{viewTitle}</h2>
        <button
          onClick={() => setIsUploadModalOpen(true)}
          className="flex items-center justify-center bg-blue-600 text-white font-semibold py-2 px-5 rounded-lg hover:bg-blue-700 transition duration-300 shadow-sm w-full md:w-auto"
        >
          <PlusIcon className="w-5 h-5 mr-2" />
          Beleg hinzufügen
        </button>
      </div>

  <div className={`${ui.card} p-4 rounded-xl shadow-sm ${ui.border}`}>
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative flex-grow w-full">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><SearchIcon className="w-5 h-5 text-slate-400" /></div>
              <input type="text" placeholder="Belege durchsuchen..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className={`block w-full pl-10 pr-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-900 focus:bg-white dark:focus:bg-slate-900 placeholder:text-slate-400 dark:placeholder:text-slate-500 ${ui.input}`} />
            </div>
            {selectedDocumentIds.size > 0 && (
              <div className="flex items-center space-x-2 w-full sm:w-auto justify-end">
                <span className="text-sm text-slate-600 dark:text-slate-300">{selectedDocumentIds.size} ausgewählt</span>
                <button onClick={handleArchive} className="p-2 text-slate-500 hover:text-blue-600 hover:bg-slate-100 rounded-lg" title="Archivieren"><ArchiveIcon className="w-5 h-5" /></button>
                <button onClick={handleDelete} className="p-2 text-slate-500 hover:text-red-600 hover:bg-slate-100 rounded-lg" title="Löschen"><TrashIcon className="w-5 h-5" /></button>
              </div>
            )}
          </div>
          <div className="flex flex-col md:flex-row items-center flex-wrap gap-4 text-sm">
              <div className="flex items-center space-x-2 w-full md:w-auto">
                  <label htmlFor="status-filter" className="text-slate-600 dark:text-slate-300 font-medium">Status:</label>
                  <select id="status-filter" value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)} className={`flex-grow text-sm rounded-lg bg-slate-50 dark:bg-slate-900 focus:bg-white dark:focus:bg-slate-900 ${ui.input}`}>
                      <option value="all">Alle</option>
                      {Object.values(DocumentStatus).filter(s => s !== DocumentStatus.ANALYZING && s !== DocumentStatus.ARCHIVED).map(status => <option key={status} value={status}>{status}</option>)}
                  </select>
              </div>
              <div className="flex items-center space-x-2 w-full md:w-auto">
                  <label htmlFor="type-filter" className="text-slate-600 dark:text-slate-300 font-medium">Typ:</label>
                  <select id="type-filter" value={typeFilter} onChange={e => setTypeFilter(e.target.value as any)} className={`flex-grow text-sm rounded-lg bg-slate-50 dark:bg-slate-900 focus:bg-white dark:focus:bg-slate-900 ${ui.input}`}>
                      <option value="all">Alle Typen</option>
                      <option value={InvoiceType.INCOMING}>Ausgaben</option>
                      <option value={InvoiceType.OUTGOING}>Einnahmen</option>
                  </select>
              </div>
        <div className="flex items-center space-x-2 w-full md:w-auto">
          <label htmlFor="provider-filter" className="text-slate-600 dark:text-slate-300 font-medium">Speicher:</label>
          <select id="provider-filter" value={providerFilter} onChange={e => setProviderFilter(e.target.value as any)} className={`flex-grow text-sm rounded-lg bg-slate-50 dark:bg-slate-900 focus:bg-white dark:focus:bg-slate-900 ${ui.input}`}>
            <option value="all">Alle</option>
            <option value="supabase">Supabase</option>
            <option value="r2">R2</option>
          </select>
        </div>
              <div className="flex items-center space-x-2 w-full md:w-auto">
                 <label className="text-slate-600 dark:text-slate-300 font-medium">Anomalien:</label>
                 <label className="inline-flex items-center text-xs gap-1">
                   <input type="checkbox" checked={showOnlyAnomalies} onChange={()=>setShowOnlyAnomalies(v=>!v)} /> nur auffällige
                 </label>
              </div>
              <div className="flex-grow hidden md:block"></div>
              <div className="flex items-center space-x-2 w-full md:w-auto justify-end">
                  <label htmlFor="sort-by" className="text-slate-600 dark:text-slate-300 font-medium">Sortieren:</label>
                  <select id="sort-by" value={sortConfig.key} onChange={handleSortKeyChange} className={`flex-grow md:flex-grow-0 text-sm rounded-lg bg-slate-50 dark:bg-slate-900 focus:bg-white dark:focus:bg-slate-900 ${ui.input}`}>
                      <option value="date">Datum</option><option value="name">Name</option><option value="vendor">Verkäufer</option><option value="amount">Betrag</option>
                  </select>
                  <button onClick={handleSortDirectionToggle} className="p-2 hover:bg-slate-100 rounded-lg" title={`Sortierung: ${sortConfig.direction}`}>
                      {sortConfig.direction === 'ascending' ? <SortAscIcon className="w-5 h-5 text-slate-600" /> : <SortDescIcon className="w-5 h-5 text-slate-600" />}
                  </button>
              </div>
          </div>
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap gap-2 text-xs items-center">
               <button onClick={runBulkAi} disabled={!apiKey || aiAnalyzingIds.size>0} className="px-3 py-1.5 rounded bg-blue-600 text-white font-semibold disabled:opacity-50">KI Kategorisieren</button>
               <button onClick={applySuggestedCategories} disabled={!processedDocuments.some(d=>d.aiSuggestedTaxCategory && d.taxCategory!==d.aiSuggestedTaxCategory)} className="px-3 py-1.5 rounded bg-emerald-600 text-white font-semibold disabled:opacity-40">KI Kategorien anwenden</button>
               <button onClick={runFinancialSummary} disabled={!apiKey || isSummarizing} className="px-3 py-1.5 rounded bg-indigo-600 text-white font-semibold disabled:opacity-50">Finanz-Kurzbericht</button>
               <button onClick={generateBulkRulesFromAI} disabled={!apiKey} className="px-3 py-1.5 rounded bg-amber-600 text-white font-semibold disabled:opacity-50">AI Regeln erzeugen</button>
               <button onClick={async ()=>{
                 if (!apiKey) { alert('API Key fehlt'); return; }
                 setIsReindexing(true);
                 try {
                   const targets = documents.filter(d=> d.textContent && (!d.embedding || d.embedding.length<2));
                   for (const batch of [targets]) { // einfache Sequenz, könnte später chunked werden
                     for (const doc of batch) {
                       try {
                         const [vec] = await embedTexts(apiKey, [doc.textContent!.slice(0,4000)]);
                         await updateDocument(doc.id, { embedding: vec } as any);
                         setDocuments(prev => prev.map(p => p.id===doc.id ? { ...p, embedding: vec } : p));
                       } catch (e) { console.warn('Embedding fail', e); }
                     }
                   }
                   alert('Reindex abgeschlossen');
                 } finally { setIsReindexing(false); }
               }} disabled={isReindexing || !documents.some(d=>d.textContent && !d.embedding)} className="px-3 py-1.5 rounded bg-teal-600 text-white font-semibold disabled:opacity-30">{isReindexing? 'Reindex...' : 'Reindex'}</button>
               <div className="flex items-center gap-1">
                 <input value={semanticQuery} onChange={e=>setSemanticQuery(e.target.value)} placeholder="Semantische Suche…" className={`px-2 py-1.5 rounded text-xs ${ui.input}`} />
                 <button onClick={runSemanticSearch} disabled={!apiKey || isSemanticSearching} className="px-2 py-1.5 rounded bg-fuchsia-600 text-white text-xs font-semibold disabled:opacity-40">{isSemanticSearching? '...' : 'Semantik'}</button>
                 {semanticResults && <button onClick={()=>{setSemanticResults(null); setSemanticQuery('');}} className="px-2 py-1.5 rounded bg-slate-200 text-slate-600 text-xs">Reset</button>}
               </div>
               <button onClick={exportCSV} disabled={!processedDocuments.length} className="px-3 py-1.5 rounded bg-green-600 text-white font-semibold disabled:opacity-40">CSV</button>
               <button onClick={exportPDF} disabled={!processedDocuments.length} className="px-3 py-1.5 rounded bg-purple-600 text-white font-semibold disabled:opacity-40">PDF</button>
               {isSummarizing && <span className="text-slate-500">Analysiere...</span>}
            </div>
            <div className="flex flex-wrap gap-2 text-[10px]">
              {categorySummary.map(([cat, info]) => (
                <span key={cat} className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-medium" title={info.count+ ' Belege'}>{cat} · {Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR'}).format(info.amount)}</span>
              ))}
            </div>
            {financialSummary && (
              <div className="bg-indigo-50 dark:bg-indigo-900/40 border border-indigo-200 dark:border-indigo-800 rounded p-3 text-[11px] whitespace-pre-line text-slate-800 dark:text-slate-200">
                {financialSummary}
              </div>
            )}
          </div>
        </div>

        <div className="mt-6">
          {processedDocuments.length === 0 ? (
            <div className="text-center py-16 border-2 border-dashed border-slate-200 dark:border-slate-600 rounded-lg">
              <p className="text-slate-500 dark:text-slate-400">Keine Belege für Ihre Auswahl gefunden.</p>
            </div>
          ) : (
            <div className="space-y-8">
               {/* Kategorie-Ordner */}
               <div>
                 <h3 className="text-sm font-semibold text-slate-700 px-2 mb-2">Nach Steuerkategorie</h3>
                 <div className="flex flex-wrap gap-2">
                   {categoryGroups.map(([cat, docs]) => (
                     <button key={cat} onClick={() => {
                        setSearchQuery(q => q === cat ? '' : cat);
                     }} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${searchQuery===cat? ui.chipActive : ui.chip}`} title={`${docs.length} Beleg(e)`}>
                       {cat} <span className="opacity-60 ml-1">{docs.length}</span>
                     </button>
                   ))}
                 </div>
               </div>
               <div className="flex items-center px-4 py-2 border-b border-slate-200">
                  <input type="checkbox" className="h-4 w-4 text-blue-600 rounded border-slate-300" checked={selectedDocumentIds.size > 0 && selectedDocumentIds.size === processedDocuments.length} onChange={handleToggleSelectAll} aria-label="Alle auswählen" />
                  <span className="ml-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Belegdetails</span>
               </div>
              {sortedYears.map(year => (
                <div key={year}>
                  <button onClick={() => toggleFolder(`${year}`)} className="w-full flex items-center p-3 text-left text-base font-semibold text-slate-700 rounded-md hover:bg-slate-50"><ChevronDownIcon className={`w-4 h-4 mr-3 text-slate-400 transition-transform ${expandedFolders[`${year}`] ? '' : '-rotate-90'}`} />{year}</button>
                  {expandedFolders[`${year}`] && (
                    <div className="pl-4 space-y-2">
                      {([4, 3, 2, 1]).map(quarter => {
                        const quarterDocs = groupedDocuments[year]?.[quarter] || [];
                        if (quarterDocs.length > 0) {
                          const quarterKey = `${year}-Q${quarter}`;
                          return (
                            <div key={quarterKey}>
                              <button onClick={() => toggleFolder(quarterKey)} className="w-full flex items-center p-2 pl-6 text-left text-sm font-medium text-slate-600 rounded-md hover:bg-slate-50"><ChevronDownIcon className={`w-4 h-4 mr-2 text-slate-400 transition-transform ${expandedFolders[quarterKey] ? '' : '-rotate-90'}`} />Quartal {quarter}</button>
                              {expandedFolders[quarterKey] && (
                                <div className="pl-8 mt-1 space-y-px">
                                    {/* Gruppierung innerhalb Quartal nach Steuerkategorie */}
                                    {(Object.entries(quarterDocs.reduce((acc:Record<string,Document[]>,d:Document)=>{ const k = d.taxCategory||d.aiSuggestedTaxCategory||'Unkategorisiert'; (acc[k]=acc[k]||[]).push(d); return acc; },{})) as [string, Document[]][])
                                      .sort((a,b)=> b[1].length - a[1].length)
                                      .map(([cat, catDocs]:[string,Document[]]) => (
                                        <div key={cat} className="border-l border-slate-200 pl-3 mb-2">
                                          <div className="text-[11px] font-semibold text-slate-500 mb-1 flex items-center gap-2"><FolderIcon className="w-3 h-3 text-slate-400" />{cat} <span className="text-slate-400 font-normal">{catDocs.length}</span></div>
                                          <div className="space-y-px">
                                            {catDocs.map(doc => <DocumentItem key={doc.id} document={doc} onSelect={onSelectDocument} isSelected={selectedDocumentIds.has(doc.id)} onToggleSelection={handleToggleSelection} onSendToLexoffice={handleSendSingleToLexoffice} isSendingToLexoffice={sendingDocId === doc.id} />)}
                                          </div>
                                        </div>
                                      ))}
                                </div>
                              )}
                            </div>
                          )
                        }
                        return null;
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {isUploadModalOpen && (
        <UploadModal
          onClose={() => setIsUploadModalOpen(false)}
          setDocuments={setDocuments}
            rules={rules}
            onRuleSuggestion={onRuleSuggestion}
            apiKey={apiKey}
            userId={userId}
            showToast={(msg,type)=>{ try { (window as any).appToast?.(msg,type); } catch { alert(msg); } }}
        />
      )}
    </>
  );
};

export default DocumentsView;
