import React, { useState, useMemo, useCallback } from 'react';
import { Document, DocumentStatus, InvoiceType, Rule, RuleSuggestion, LexofficeStatus, DocumentFilter } from '../types';
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
  documents: Document[];
  setDocuments: React.Dispatch<React.SetStateAction<Document[]>>;
  activeFilter: DocumentFilter | null;
  rules: Rule[];
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

const DocumentsView: React.FC<DocumentsViewProps> = ({ documents, setDocuments, activeFilter, rules, onRuleSuggestion, apiKey, lexofficeApiKey, onSelectDocument }) => {
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [expandedFolders, setExpandedFolders] = useState<{ [key: string]: boolean }>({ [new Date().getFullYear()]: true, [`${new Date().getFullYear()}-Q${Math.floor((new Date().getMonth() + 3) / 3)}`]: true});
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDocumentIds, setSelectedDocumentIds] = useState<Set<string>>(new Set());
  const [sendingDocId, setSendingDocId] = useState<string | null>(null);
  
  const [sortConfig, setSortConfig] = useState<{ key: 'date' | 'name' | 'vendor' | 'amount'; direction: 'ascending' | 'descending' }>({ key: 'date', direction: 'descending' });
  const [statusFilter, setStatusFilter] = useState<DocumentStatus | 'all'>('all');
  const [typeFilter, setTypeFilter] = useState<InvoiceType | 'all'>('all');

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
      if (!statusMatch || !typeMatch) return false;
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

  const handleDelete = () => {
    if (window.confirm(`Möchten Sie ${selectedDocumentIds.size} Beleg(e) wirklich endgültig löschen?`)) {
        setDocuments(prev => prev.filter(doc => !selectedDocumentIds.has(doc.id)));
        setSelectedDocumentIds(new Set());
    }
  };

  const handleArchive = () => {
    if (window.confirm(`Möchten Sie ${selectedDocumentIds.size} Beleg(e) wirklich archivieren?`)) {
        setDocuments(prev => prev.map(doc => 
            selectedDocumentIds.has(doc.id) ? { ...doc, status: DocumentStatus.ARCHIVED } : doc
        ));
        setSelectedDocumentIds(new Set());
    }
  };

  const handleSortDirectionToggle = () => setSortConfig(prev => ({ ...prev, direction: prev.direction === 'ascending' ? 'descending' : 'ascending' }));
  const handleSortKeyChange = (e: React.ChangeEvent<HTMLSelectElement>) => setSortConfig(prev => ({ ...prev, key: e.target.value as any }));

  const viewTitle = useMemo(() => {
    if (!activeFilter) return "Alle Belege";
    if (activeFilter.quarter) return `Belege für ${activeFilter.year} / Q${activeFilter.quarter}`;
    return `Alle Belege für ${activeFilter.year}`;
  }, [activeFilter]);

  const sortedYears = Object.keys(groupedDocuments).map(Number).sort((a, b) => b - a);

  return (
    <>
      <div className="flex flex-col md:flex-row justify-between md:items-center mb-6 gap-4">
        <h2 className="text-3xl font-bold text-slate-800">{viewTitle}</h2>
        <button
          onClick={() => setIsUploadModalOpen(true)}
          className="flex items-center justify-center bg-blue-600 text-white font-semibold py-2 px-5 rounded-lg hover:bg-blue-700 transition duration-300 shadow-sm w-full md:w-auto"
        >
          <PlusIcon className="w-5 h-5 mr-2" />
          Beleg hinzufügen
        </button>
      </div>

      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative flex-grow w-full">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><SearchIcon className="w-5 h-5 text-slate-400" /></div>
              <input type="text" placeholder="Belege durchsuchen..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="block w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg bg-slate-50 focus:bg-white" />
            </div>
            {selectedDocumentIds.size > 0 && (
              <div className="flex items-center space-x-2 w-full sm:w-auto justify-end">
                <span className="text-sm text-slate-600">{selectedDocumentIds.size} ausgewählt</span>
                <button onClick={handleArchive} className="p-2 text-slate-500 hover:text-blue-600 hover:bg-slate-100 rounded-lg" title="Archivieren"><ArchiveIcon className="w-5 h-5" /></button>
                <button onClick={handleDelete} className="p-2 text-slate-500 hover:text-red-600 hover:bg-slate-100 rounded-lg" title="Löschen"><TrashIcon className="w-5 h-5" /></button>
              </div>
            )}
          </div>
          <div className="flex flex-col md:flex-row items-center flex-wrap gap-4 text-sm">
              <div className="flex items-center space-x-2 w-full md:w-auto">
                  <label htmlFor="status-filter" className="text-slate-600 font-medium">Status:</label>
                  <select id="status-filter" value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)} className="flex-grow text-sm border-slate-300 rounded-lg bg-slate-50 focus:bg-white">
                      <option value="all">Alle</option>
                      {Object.values(DocumentStatus).filter(s => s !== DocumentStatus.ANALYZING && s !== DocumentStatus.ARCHIVED).map(status => <option key={status} value={status}>{status}</option>)}
                  </select>
              </div>
              <div className="flex items-center space-x-2 w-full md:w-auto">
                  <label htmlFor="type-filter" className="text-slate-600 font-medium">Typ:</label>
                  <select id="type-filter" value={typeFilter} onChange={e => setTypeFilter(e.target.value as any)} className="flex-grow text-sm border-slate-300 rounded-lg bg-slate-50 focus:bg-white">
                      <option value="all">Alle Typen</option>
                      <option value={InvoiceType.INCOMING}>Ausgaben</option>
                      <option value={InvoiceType.OUTGOING}>Einnahmen</option>
                  </select>
              </div>
              <div className="flex-grow hidden md:block"></div>
              <div className="flex items-center space-x-2 w-full md:w-auto justify-end">
                  <label htmlFor="sort-by" className="text-slate-600 font-medium">Sortieren:</label>
                  <select id="sort-by" value={sortConfig.key} onChange={handleSortKeyChange} className="flex-grow md:flex-grow-0 text-sm border-slate-300 rounded-lg bg-slate-50 focus:bg-white">
                      <option value="date">Datum</option><option value="name">Name</option><option value="vendor">Verkäufer</option><option value="amount">Betrag</option>
                  </select>
                  <button onClick={handleSortDirectionToggle} className="p-2 hover:bg-slate-100 rounded-lg" title={`Sortierung: ${sortConfig.direction}`}>
                      {sortConfig.direction === 'ascending' ? <SortAscIcon className="w-5 h-5 text-slate-600" /> : <SortDescIcon className="w-5 h-5 text-slate-600" />}
                  </button>
              </div>
          </div>
        </div>

        <div className="mt-6">
          {processedDocuments.length === 0 ? (
            <div className="text-center py-16 border-2 border-dashed border-slate-200 rounded-lg">
              <p className="text-slate-500">Keine Belege für Ihre Auswahl gefunden.</p>
            </div>
          ) : (
            <div className="space-y-1">
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
                                    {quarterDocs.map(doc => <DocumentItem key={doc.id} document={doc} onSelect={onSelectDocument} isSelected={selectedDocumentIds.has(doc.id)} onToggleSelection={handleToggleSelection} onSendToLexoffice={handleSendSingleToLexoffice} isSendingToLexoffice={sendingDocId === doc.id} />)}
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
        />
      )}
    </>
  );
};

export default DocumentsView;
